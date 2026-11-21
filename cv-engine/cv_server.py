"""
NutriBite Computer Vision & Nutrition Label / Plate / Cart OCR Microservice
============================================================================
FastAPI microservice running on http://0.0.0.0:8000 powering:
  - GET  /health     -> Service status, Tesseract/Gemini availability & endpoint catalog
  - POST /ocr/label  -> Nutrition label scanner (OpenCV CLAHE + Gemini Vision + Tesseract Fallback)
  - POST /ocr/plate  -> Indian meal & plate recognition
  - POST /ocr/cart   -> Quick-Commerce cart screenshot scanner (Blinkit/Zepto/Instamart)
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
import subprocess
import time
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from dotenv import load_dotenv
from PIL import Image

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("nutribite-cv")


# ==============================================================================
# 1. TESSERACT & GEMINI ENGINE PROBES (PRESERVED FOR test_accuracy.py & FALLBACK)
# ==============================================================================

def _get_tesseract_path() -> Optional[str]:
    env_path = os.getenv("TESSERACT_CMD", "").strip()
    if env_path and os.path.exists(env_path):
        return env_path
    for candidate in [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
        "/usr/bin/tesseract",
        "/usr/local/bin/tesseract",
    ]:
        if os.path.exists(candidate):
            return candidate
    return None


def probe_tesseract() -> bool:
    try:
        cmd = _get_tesseract_path()
        if not cmd:
            return False
        res = subprocess.run([cmd, "--version"], capture_output=True, timeout=2.0)
        return res.returncode == 0
    except Exception:
        return False


def probe_gemini() -> bool:
    key = os.getenv("GOOGLE_API_KEY", "").strip()
    return bool(key and key != "your_gemini_api_key_here")


# ==============================================================================
# 2. FASTAPI APP & CORS + STRICT HTTP 422 NON-FOOD HANDLER
# ==============================================================================

app = FastAPI(
    title="NutriBite CV Engine",
    version="2.6.0",
    description="FastAPI Computer Vision & Nutrition/Plate/Cart OCR microservice for NutriBite",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code == 422:
        reason_str = (
            str(exc.detail)
            if isinstance(exc.detail, str)
            else str(exc.detail.get("reason", exc.detail))
        )
        return JSONResponse(
            status_code=422,
            content={"isFood": False, "reason": reason_str, "detail": reason_str},
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# ==============================================================================
# 3. PYDANTIC SCHEMAS
# ==============================================================================

class MacroProfile(BaseModel):
    sugarG: float = Field(0.0, description="Total/Added sugars in grams")
    satFatG: float = Field(0.0, description="Saturated fat in grams")
    proteinG: float = Field(0.0, description="Protein in grams")
    fiberG: float = Field(0.0, description="Dietary fiber in grams")
    ironMg: float = Field(0.0, description="Iron in milligrams")
    sodiumMg: float = Field(0.0, description="Sodium in milligrams")


class CVResponse(BaseModel):
    isFood: bool = Field(True)
    productName: str
    servingSize: str
    macros: MacroProfile
    ingredients: List[str] = Field(default_factory=list)
    detectedAllergens: List[str] = Field(default_factory=list)
    ocrEngine: str = Field("gemini-vision")
    processingTimeMs: int = Field(0)


class CartItem(BaseModel):
    productName: str
    quantity: int = 1
    macros: MacroProfile
    ingredientsText: str = ""
    detectedAllergens: List[str] = Field(default_factory=list)


class CartResponse(BaseModel):
    isFood: bool = Field(True)
    platform: str = "Quick-Commerce"
    items: List[CartItem] = Field(default_factory=list)
    ocrEngine: str = "gemini-vision"
    processingTimeMs: int = Field(0)


# ==============================================================================
# 4. IMAGE EXTRACTION & OPENCV PREPROCESSING PIPELINE
# ==============================================================================

def get_gemini_client():
    load_dotenv()
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key or api_key == "your_gemini_api_key_here":
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY is missing in SASWATA/.env")
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to initialize google-genai Client: {exc}")


async def extract_image_bytes(request: Request) -> bytes:
    content_type = request.headers.get("content-type", "").lower()
    if "multipart/form-data" in content_type:
        form = await request.form()
        file_obj = form.get("file")
        if file_obj is not None and hasattr(file_obj, "read"):
            data = await file_obj.read()
            if data:
                return data
        b64_field = form.get("image_base64")
        if b64_field and isinstance(b64_field, str):
            b64_clean = b64_field.split(",", 1)[1] if "," in b64_field else b64_field
            return base64.b64decode(b64_clean)
        raise HTTPException(status_code=400, detail="Multipart request must include 'file' or 'image_base64'.")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=415, detail="Send application/json with 'image_base64' or multipart/form-data.")

    b64_val = body.get("image_base64")
    if not b64_val or not isinstance(b64_val, str):
        raise HTTPException(status_code=400, detail="JSON body must contain 'image_base64' string.")
    b64_clean = b64_val.split(",", 1)[1] if "," in b64_val else b64_val
    try:
        return base64.b64decode(b64_clean)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {exc}")


def preprocess_image_for_ocr(raw_bytes: bytes) -> bytes:
    """
    OpenCV preprocessing for glossy Indian packaged snack wrappers:
      1. Decode image bytes safely
      2. Resize overly large images while preserving text sharpness
      3. LAB colorspace CLAHE contrast enhancement to reduce foil/plastic glare
      4. Unsharp masking for crisp FSSAI nutrition table digits
    """
    try:
        nparr = np.frombuffer(raw_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return raw_bytes

        h, w = img.shape[:2]
        max_dim = max(h, w)
        if max_dim > 1600:
            scale = 1600.0 / max_dim
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        enhanced = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)

        gaussian = cv2.GaussianBlur(enhanced, (0, 0), 2.0)
        sharpened = cv2.addWeighted(enhanced, 1.3, gaussian, -0.3, 0)

        success, encoded = cv2.imencode(".jpg", sharpened, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return encoded.tobytes() if success else raw_bytes
    except Exception as exc:
        logger.warning("OpenCV preprocessing skipped (%s), using original bytes.", exc)
        return raw_bytes


# Alias preserved for backward compatibility with test_accuracy.py
preprocess_image = preprocess_image_for_ocr


# ==============================================================================
# 5. OFFLINE TESSERACT + REGEX FALLBACK PARSER (PRESERVED)
# ==============================================================================

ALLERGEN_KEYWORDS: Dict[str, List[str]] = {
    "Peanuts": ["peanut", "groundnut", "arachis", "moongphali"],
    "Tree Nuts": ["almond", "cashew", "walnut", "pistachio", "hazelnut", "badam", "kaju"],
    "Gluten": ["wheat", "maida", "gluten", "barley", "rye", "semolina", "suji", "atta"],
    "Lactose": ["milk", "lactose", "whey", "curd", "paneer", "butter", "ghee", "cream", "casein", "cheese"],
    "Soy": ["soy", "soya", "lecithin"],
    "Shellfish": ["shrimp", "prawn", "crab", "lobster", "shellfish"],
    "Eggs": ["egg", "albumin", "mayonnaise"],
}


def detect_allergens_from_text(text: str) -> List[str]:
    lower = (text or "").lower()
    found = []
    for label, kws in ALLERGEN_KEYWORDS.items():
        if any(re.search(rf"\b{re.escape(kw)}\b", lower) for kw in kws):
            found.append(label)
    return found


def parse_nutrition_text(raw_text: str) -> Dict[str, Any]:
    """
    Deterministic regex parser for FSSAI nutrition tables & ingredient blocks.
    Used by offline Tesseract fallback and accuracy benchmarks.
    """
    text = raw_text or ""

    def _extract_num(pattern: str) -> float:
        m = re.search(pattern, text, re.IGNORECASE)
        if not m:
            return 0.0
        try:
            return float(m.group(1))
        except ValueError:
            return 0.0

    sugar = _extract_num(r"(?:added\s+)?sugars?[^0-9\n]{0,15}([0-9]+(?:\.[0-9]+)?)\s*g\b")
    sat_fat = _extract_num(r"sat(?:urated)?\.?\s*fat[^0-9\n]{0,12}([0-9]+(?:\.[0-9]+)?)\s*g\b")
    protein = _extract_num(r"protein[^0-9\n]{0,12}([0-9]+(?:\.[0-9]+)?)\s*g\b")
    fiber = _extract_num(r"(?:dietary\s+)?fib(?:re|er)[^0-9\n]{0,12}([0-9]+(?:\.[0-9]+)?)\s*g\b")
    iron = _extract_num(r"iron[^0-9\n]{0,12}([0-9]+(?:\.[0-9]+)?)\s*mg\b")
    sodium = _extract_num(r"sodium[^0-9\n]{0,12}([0-9]+(?:\.[0-9]+)?)\s*mg\b")

    ing_match = re.search(r"ingredients?\s*[:\-]\s*(.+)", text, re.IGNORECASE | re.DOTALL)
    ingredients_str = ing_match.group(1).strip() if ing_match else text.strip()
    ingredients_list = [i.strip() for i in re.split(r"[,;\n]+", ingredients_str) if i.strip()][:25]

    return {
        "macros": {
            "sugarG": sugar,
            "satFatG": sat_fat,
            "proteinG": protein,
            "fiberG": fiber,
            "ironMg": iron,
            "sodiumMg": sodium,
        },
        "ingredients": ingredients_list,
        "detectedAllergens": detect_allergens_from_text(text),
    }


def run_tesseract_fallback(image_bytes: bytes) -> Optional[dict]:
    """Offline OCR backup using Tesseract when cloud Vision APIs are unreachable."""
    if not probe_tesseract():
        return None
    try:
        import pytesseract

        cmd = _get_tesseract_path()
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd

        pil_img = Image.open(io.BytesIO(image_bytes)).convert("L")
        raw_text = pytesseract.image_to_string(pil_img, config="--oem 3 --psm 6")
        if not raw_text or len(raw_text.strip()) < 12:
            return None

        parsed = parse_nutrition_text(raw_text)
        first_line = next((ln.strip() for ln in raw_text.splitlines() if len(ln.strip()) > 3), "Packaged Food Item")
        return {
            "isFood": True,
            "productName": first_line[:60],
            "servingSize": "1 serving",
            "macros": parsed["macros"],
            "ingredients": parsed["ingredients"],
            "detectedAllergens": parsed["detectedAllergens"],
            "ocrEngine": "tesseract-offline",
        }
    except Exception as exc:
        logger.warning("Tesseract fallback failed: %s", exc)
        return None


# ==============================================================================
# 6. GEMINI VISION PROMPTS & EXECUTION
# ==============================================================================

def clean_json_response(raw_text: str) -> dict:
    clean = raw_text.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)
    clean = clean.strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", clean, re.DOTALL)
        if match:
            return json.loads(match.group())
    raise HTTPException(status_code=502, detail="Vision model returned invalid JSON response.")


LABEL_PROMPT = """
You are NutriBite's expert AI Computer Vision & Nutrition Label OCR engine for Indian packaged foods and beverages (FSSAI format).
FIRST: Check if this image genuinely contains a packaged food/beverage item, nutrition table, or ingredient list. If it shows a human face, selfie, person, room, electronics, or non-food item, return strictly:
{"isFood": false, "reason": "No food product or nutrition label detected. Point the camera at a food label."}

SECOND: If it IS a food/beverage item or label, return ONLY valid JSON:
{
  "isFood": true,
  "productName": "Exact brand & product name",
  "servingSize": "Serving size (e.g. '1 pack (70g)')",
  "macros": {"sugarG": 0.0, "satFatG": 0.0, "proteinG": 0.0, "fiberG": 0.0, "ironMg": 0.0, "sodiumMg": 0.0},
  "ingredients": ["Full ingredient list preserving INS/E codes"],
  "detectedAllergens": ["Peanuts", "Soy", "Gluten", "Milk", "Tree Nuts"]
}
"""

PLATE_PROMPT = """
You are NutriBite's expert AI Computer Vision & Indian Meal / Plate Recognition engine.
FIRST: Check if this image genuinely shows an edible meal plate, bowl of food, Indian thali, or snack. If it shows a human face, selfie, empty plate, or non-food object, return strictly:
{"isFood": false, "reason": "No food plate detected. Point the camera at a meal plate."}

SECOND: If it IS an edible meal/plate, return ONLY valid JSON:
{
  "isFood": true,
  "productName": "Dish or thali name",
  "servingSize": "Estimated visible portion (e.g. '1 plate (~450g)')",
  "macros": {"sugarG": 0.0, "satFatG": 0.0, "proteinG": 0.0, "fiberG": 0.0, "ironMg": 0.0, "sodiumMg": 0.0},
  "ingredients": ["Visible curries, grains, oils, dairy, nuts"],
  "detectedAllergens": ["Dairy", "Gluten"]
}
"""

CART_PROMPT = """
You are NutriBite's AI parser for Indian quick-commerce grocery carts (Blinkit, Zepto, Swiggy Instamart).
FIRST: Check if this image shows a grocery shopping cart / checkout list or multiple packaged food items. If it shows a human face, selfie, or unrelated screen, return strictly:
{"isFood": false, "reason": "No grocery cart or food items detected in this image."}

SECOND: Extract every food/beverage item visible in the cart and estimate per-serving macros and likely ingredients/allergens.
Return ONLY valid JSON:
{
  "isFood": true,
  "platform": "Blinkit / Zepto / Instamart",
  "items": [
    {
      "productName": "Full item name & pack size",
      "quantity": 1,
      "macros": {"sugarG": 0.0, "satFatG": 0.0, "proteinG": 0.0, "fiberG": 0.0, "ironMg": 0.0, "sodiumMg": 0.0},
      "ingredientsText": "comma-separated likely ingredients incl. palmolein, maltodextrin, INS codes",
      "detectedAllergens": ["Peanuts", "Gluten", "Soy", "Lactose"]
    }
  ]
}
"""


def execute_gemini_vision(client: Any, image_bytes: bytes, prompt: str) -> dict:
    from google.genai import types

    image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
    config = types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1)
    for model_name in ["gemini-2.5-flash", "gemini-2.0-flash"]:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[image_part, prompt],
                config=config,
            )
            return clean_json_response(response.text)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Gemini model %s failed (%s), trying next...", model_name, exc)
    raise HTTPException(status_code=502, detail="Gemini Vision service temporarily unavailable.")


def build_standardized_response(
    parsed: dict,
    elapsed_ms: int,
    default_name: str,
    default_serving: str,
) -> CVResponse:
    if parsed.get("isFood") is False:
        reason = parsed.get("reason", "Image rejected: non-food item detected.")
        raise HTTPException(status_code=422, detail=reason)

    raw_macros = parsed.get("macros", {})
    macros = MacroProfile(
        sugarG=float(raw_macros.get("sugarG", 0.0) or 0.0),
        satFatG=float(raw_macros.get("satFatG", 0.0) or 0.0),
        proteinG=float(raw_macros.get("proteinG", 0.0) or 0.0),
        fiberG=float(raw_macros.get("fiberG", 0.0) or 0.0),
        ironMg=float(raw_macros.get("ironMg", 0.0) or 0.0),
        sodiumMg=float(raw_macros.get("sodiumMg", 0.0) or 0.0),
    )

    ing_list = [str(i) for i in parsed.get("ingredients", [])]
    allergens = [str(a) for a in parsed.get("detectedAllergens", [])]
    if not allergens and ing_list:
        allergens = detect_allergens_from_text(", ".join(ing_list))

    return CVResponse(
        isFood=True,
        productName=str(parsed.get("productName") or default_name),
        servingSize=str(parsed.get("servingSize") or default_serving),
        macros=macros,
        ingredients=ing_list,
        detectedAllergens=allergens,
        ocrEngine=str(parsed.get("ocrEngine") or "gemini-vision"),
        processingTimeMs=elapsed_ms,
    )


# ==============================================================================
# 7. API ENDPOINTS (/health, /ocr/label, /ocr/plate, /ocr/cart)
# ==============================================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "NutriBite CV Engine",
        "endpoints": ["/ocr/label", "/ocr/plate", "/ocr/cart"],
        "tesseractAvailable": probe_tesseract(),
        "geminiAvailable": probe_gemini(),
    }


health_check = health


@app.post("/ocr/label", response_model=CVResponse)
async def ocr_label(request: Request):
    t0 = time.monotonic()
    raw_bytes = await extract_image_bytes(request)
    processed_bytes = preprocess_image_for_ocr(raw_bytes)

    try:
        client = get_gemini_client()
        parsed = execute_gemini_vision(client, processed_bytes, LABEL_PROMPT)
    except HTTPException as exc:
        if exc.status_code == 422:
            raise
        # Offline Tesseract backup if Gemini quota/network fails
        fallback = run_tesseract_fallback(processed_bytes)
        if fallback:
            parsed = fallback
        else:
            raise

    return build_standardized_response(
        parsed,
        int((time.monotonic() - t0) * 1000),
        "Packaged Food Item",
        "1 serving",
    )


@app.post("/ocr/plate", response_model=CVResponse)
async def ocr_plate(request: Request):
    t0 = time.monotonic()
    client = get_gemini_client()
    raw_bytes = await extract_image_bytes(request)
    parsed = execute_gemini_vision(client, raw_bytes, PLATE_PROMPT)
    return build_standardized_response(
        parsed,
        int((time.monotonic() - t0) * 1000),
        "Indian Meal Plate",
        "1 plate",
    )


@app.post("/ocr/cart", response_model=CartResponse)
async def ocr_cart(request: Request):
    t0 = time.monotonic()
    client = get_gemini_client()
    raw_bytes = await extract_image_bytes(request)
    parsed = execute_gemini_vision(client, raw_bytes, CART_PROMPT)

    if parsed.get("isFood") is False:
        raise HTTPException(
            status_code=422,
            detail=parsed.get("reason", "No grocery cart or food items detected."),
        )

    items: List[CartItem] = []
    for raw_item in parsed.get("items", []):
        rm = raw_item.get("macros") or raw_item.get("estimatedMacros") or {}
        macros = MacroProfile(
            sugarG=float(rm.get("sugarG", 0.0) or 0.0),
            satFatG=float(rm.get("satFatG", 0.0) or 0.0),
            proteinG=float(rm.get("proteinG", 0.0) or 0.0),
            fiberG=float(rm.get("fiberG", 0.0) or 0.0),
            ironMg=float(rm.get("ironMg", 0.0) or 0.0),
            sodiumMg=float(rm.get("sodiumMg", 0.0) or 0.0),
        )
        ing = raw_item.get("ingredientsText") or ", ".join(raw_item.get("likelyIngredients", []))
        allergens = [
            str(a)
            for a in (raw_item.get("detectedAllergens") or raw_item.get("likelyAllergens") or [])
        ]
        if not allergens and ing:
            allergens = detect_allergens_from_text(ing)

        items.append(
            CartItem(
                productName=str(raw_item.get("productName") or "Cart Item"),
                quantity=int(raw_item.get("quantity") or 1),
                macros=macros,
                ingredientsText=str(ing),
                detectedAllergens=allergens,
            )
        )

    return CartResponse(
        isFood=True,
        platform=str(parsed.get("platform") or "Quick-Commerce"),
        items=items,
        ocrEngine="gemini-vision",
        processingTimeMs=int((time.monotonic() - t0) * 1000),
    )


if __name__ == "__main__":
    uvicorn.run("cv_server:app", host="0.0.0.0", port=8000, reload=True, log_level="info")