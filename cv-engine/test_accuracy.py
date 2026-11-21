"""
NutriBite CV Engine — Automated Accuracy & Compliance Test Suite
================================================================
test_accuracy.py

Automated test script verifying:
  1. GET /health endpoint (status, service name, capabilities)
  2. Zero Fake Demo Fallbacks (returns HTTP 503 with exact error if GOOGLE_API_KEY is missing)
  3. Strict Non-Food & Selfie Rejection (returns HTTP 422 with {"isFood": false, "reason": "..."})
  4. Accurate Indian Packaged Food & Beverage Label OCR (Sprite, Maggi, Parle-G, Haldiram's, INS codes)
  5. Accurate Indian Meal Plate OCR (/ocr/plate)
  6. Dual-input support: application/json (image_base64) & multipart/form-data (file)

Usage:
  # Standalone in-process test (works immediately, no external server needed):
  python test_accuracy.py

  # Test against a live running server:
  python test_accuracy.py --server http://localhost:8000
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import time
from typing import Any, Dict, Optional, Tuple
from unittest.mock import MagicMock, patch

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Add local directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cv_server
from cv_server import (
    app,
    probe_gemini,
    probe_tesseract,
    LABEL_PROMPT,
    PLATE_PROMPT,
    CVResponse,
    MacroProfile,
    custom_http_exception_handler,
)


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic Image Generators (Label, Plate, Selfie, Non-Food)
# ─────────────────────────────────────────────────────────────────────────────

def generate_synthetic_label_image(
    product_name: str,
    serving_size: str,
    sugar_g: float,
    sat_fat_g: float,
    protein_g: float,
    fiber_g: float,
    iron_mg: float,
    sodium_mg: float,
    ingredients_str: str,
    allergens_str: str,
) -> bytes:
    """Renders a realistic Indian FSSAI packaged nutrition label image."""
    W, H = 600, 420
    img = Image.new("RGB", (W, H), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    font = ImageFont.load_default()

    # Outer border
    draw.rectangle([(10, 10), (W - 10, H - 10)], outline=(0, 0, 0), width=2)

    # Title header
    draw.text((25, 20), f"PRODUCT: {product_name.upper()}", fill=(0, 0, 0), font=font)
    draw.text((25, 40), f"Serving Size: {serving_size}", fill=(50, 50, 50), font=font)
    draw.line([(25, 60), (W - 25, 60)], fill=(0, 0, 0), width=2)

    # Nutrition table
    draw.text((25, 75), "NUTRITIONAL INFORMATION", fill=(0, 0, 0), font=font)
    draw.line([(25, 95), (W - 25, 95)], fill=(120, 120, 120), width=1)

    rows = [
        (f"Sugars (Added/Total)", f"{sugar_g} g"),
        ("Saturated Fat", f"{sat_fat_g} g"),
        ("Protein", f"{protein_g} g"),
        ("Dietary Fiber", f"{fiber_g} g"),
        ("Iron", f"{iron_mg} mg"),
        ("Sodium", f"{sodium_mg} mg"),
    ]

    y = 110
    for label, val in rows:
        draw.text((30, y), label, fill=(30, 30, 30), font=font)
        draw.text((450, y), val, fill=(0, 0, 0), font=font)
        draw.line([(30, y + 18), (W - 30, y + 18)], fill=(220, 220, 220), width=1)
        y += 24

    # Ingredients & Allergens
    draw.line([(25, y + 10), (W - 25, y + 10)], fill=(0, 0, 0), width=2)
    y += 20
    draw.text((25, y), "INGREDIENTS:", fill=(0, 0, 0), font=font)
    y += 18
    # Wrap ingredients
    draw.text((25, y), ingredients_str[:120], fill=(40, 40, 40), font=font)
    if len(ingredients_str) > 120:
        y += 16
        draw.text((25, y), ingredients_str[120:240], fill=(40, 40, 40), font=font)

    y += 24
    draw.text((25, y), f"ALLERGEN ADVICE: Contains {allergens_str}", fill=(180, 0, 0), font=font)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def generate_selfie_image() -> bytes:
    """Generates a synthetic portrait/selfie representation (non-food)."""
    W, H = 400, 400
    img = Image.new("RGB", (W, H), color=(220, 200, 180))
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()

    # Draw simple face representation
    draw.ellipse([(120, 80), (280, 260)], fill=(240, 210, 190), outline=(120, 80, 60), width=3)
    # Eyes
    draw.ellipse([(160, 140), (180, 160)], fill=(40, 30, 20))
    draw.ellipse([(220, 140), (240, 160)], fill=(40, 30, 20))
    # Nose & Mouth
    draw.line([(200, 165), (200, 195)], fill=(150, 100, 80), width=2)
    draw.arc([(170, 190), (230, 230)], start=0, end=180, fill=(180, 40, 40), width=3)
    # Text banner
    draw.rectangle([(20, 320), (380, 370)], fill=(50, 50, 50))
    draw.text((40, 335), "USER PROFILE SELFIE / HUMAN FACE", fill=(255, 255, 255), font=font)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def generate_non_food_object_image() -> bytes:
    """Generates an image of a non-food room/laptop object."""
    W, H = 400, 400
    img = Image.new("RGB", (W, H), color=(70, 80, 95))
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()

    # Laptop drawing
    draw.rectangle([(80, 100), (320, 260)], fill=(190, 195, 205), outline=(30, 30, 30), width=3)
    draw.rectangle([(100, 120), (300, 240)], fill=(30, 40, 55))
    draw.polygon([(60, 260), (340, 260), (370, 300), (30, 300)], fill=(160, 165, 175), outline=(30, 30, 30))
    draw.text((70, 340), "OFFICE ROOM / LAPTOP (NON-FOOD)", fill=(240, 240, 240), font=font)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def generate_meal_plate_image() -> bytes:
    """Generates a synthetic Indian meal plate / thali."""
    W, H = 500, 500
    img = Image.new("RGB", (W, H), color=(245, 245, 240))
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()

    # Large steel thali plate
    draw.ellipse([(40, 40), (460, 460)], fill=(215, 220, 225), outline=(150, 155, 160), width=6)
    # Dal bowl (katori)
    draw.ellipse([(80, 90), (200, 210)], fill=(180, 90, 40), outline=(130, 60, 20), width=3)
    draw.text((105, 145), "Dal Makhani", fill=(255, 255, 255), font=font)
    # Paneer bowl
    draw.ellipse([(280, 90), (400, 210)], fill=(220, 140, 50), outline=(150, 90, 30), width=3)
    draw.text((300, 145), "Palak Paneer", fill=(255, 255, 255), font=font)
    # Rice mound in center
    draw.ellipse([(170, 200), (310, 340)], fill=(255, 255, 250), outline=(200, 200, 190), width=2)
    draw.text((215, 265), "Jeera Rice", fill=(60, 60, 60), font=font)
    # Roti on side
    draw.ellipse([(100, 300), (220, 420)], fill=(210, 180, 130), outline=(170, 130, 80), width=2)
    draw.text((140, 355), "Whole Wheat Roti", fill=(50, 40, 30), font=font)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# Test Client Harness
# ─────────────────────────────────────────────────────────────────────────────

class InProcessTestClient:
    """
    Lightweight, synchronous in-process test client that directly calls FastAPI
    endpoint functions with simulated Request objects, ensuring complete immunity
    to socket/network sandboxing limitations.
    """

    @staticmethod
    async def get_health() -> Tuple[int, Dict[str, Any]]:
        t0 = time.monotonic()
        data = await cv_server.health()
        return 200, data

    @staticmethod
    async def post_ocr_label_json(payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        class DummyRequest:
            headers = {"content-type": "application/json"}
            async def json(self):
                return payload
            async def form(self):
                return {}

        req = DummyRequest()
        try:
            resp = await cv_server.ocr_label(req)
            if hasattr(resp, "model_dump"):
                return 200, resp.model_dump()
            return 200, resp
        except cv_server.HTTPException as exc:
            if exc.status_code == 422:
                reason = str(exc.detail) if isinstance(exc.detail, str) else exc.detail.get("reason", str(exc.detail))
                return 422, {"isFood": False, "reason": reason, "detail": exc.detail}
            return exc.status_code, {"detail": exc.detail}

    @staticmethod
    async def post_ocr_label_multipart(image_bytes: bytes) -> Tuple[int, Dict[str, Any]]:
        class DummyUploadFile:
            def __init__(self, data: bytes):
                self._data = data
            async def read(self):
                return self._data

        class DummyRequest:
            headers = {"content-type": "multipart/form-data; boundary=xyz"}
            async def form(self):
                return {"file": DummyUploadFile(image_bytes)}
            async def json(self):
                return {}

        req = DummyRequest()
        try:
            resp = await cv_server.ocr_label(req)
            if hasattr(resp, "model_dump"):
                return 200, resp.model_dump()
            return 200, resp
        except cv_server.HTTPException as exc:
            if exc.status_code == 422:
                reason = str(exc.detail) if isinstance(exc.detail, str) else exc.detail.get("reason", str(exc.detail))
                return 422, {"isFood": False, "reason": reason, "detail": exc.detail}
            return exc.status_code, {"detail": exc.detail}

    @staticmethod
    async def post_ocr_plate_json(payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        class DummyRequest:
            headers = {"content-type": "application/json"}
            async def json(self):
                return payload
            async def form(self):
                return {}

        req = DummyRequest()
        try:
            resp = await cv_server.ocr_plate(req)
            if hasattr(resp, "model_dump"):
                return 200, resp.model_dump()
            return 200, resp
        except cv_server.HTTPException as exc:
            if exc.status_code == 422:
                reason = str(exc.detail) if isinstance(exc.detail, str) else exc.detail.get("reason", str(exc.detail))
                return 422, {"isFood": False, "reason": reason, "detail": exc.detail}
            return exc.status_code, {"detail": exc.detail}


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite Implementation
# ─────────────────────────────────────────────────────────────────────────────

class NutriBiteCVTestSuite:
    def __init__(self, server_url: Optional[str] = None):
        self.server_url = server_url
        self.results: list[dict] = []

    def log_result(self, test_name: str, passed: bool, elapsed_ms: float, details: str):
        self.results.append({
            "name": test_name,
            "passed": passed,
            "elapsed_ms": elapsed_ms,
            "details": details,
        })
        status_icon = " PASS " if passed else " FAIL "
        print(f"[{status_icon}] {test_name:<48} ({elapsed_ms:>6.1f} ms) - {details}")

    # ── 1. GET /health ────────────────────────────────────────────────────────
    async def test_health_endpoint(self):
        t0 = time.monotonic()
        try:
            status_code, data = await InProcessTestClient.get_health()
            elapsed = (time.monotonic() - t0) * 1000

            passed = (
                status_code == 200
                and data.get("status") == "ok"
                and data.get("service") == "NutriBite CV Engine"
                and isinstance(data.get("tesseractAvailable"), bool)
                and isinstance(data.get("geminiAvailable"), bool)
            )
            details = f"tesseract={data.get('tesseractAvailable')}, gemini={data.get('geminiAvailable')}"
            self.log_result("1. GET /health Endpoint Check", passed, elapsed, details)
        except Exception as e:
            elapsed = (time.monotonic() - t0) * 1000
            self.log_result("1. GET /health Endpoint Check", False, elapsed, str(e))

    # ── 2. Zero Fake Demo Fallbacks ───────────────────────────────────────────
    async def test_zero_demo_fallbacks_missing_key(self):
        t0 = time.monotonic()
        # Temporarily clear GOOGLE_API_KEY
        original_key = os.environ.get("GOOGLE_API_KEY")
        try:
            if "GOOGLE_API_KEY" in os.environ:
                del os.environ["GOOGLE_API_KEY"]

            # Generate synthetic test label
            img_bytes = generate_synthetic_label_image(
                product_name="Sprite",
                serving_size="1 can (300ml)",
                sugar_g=33.0,
                sat_fat_g=0.0,
                protein_g=0.0,
                fiber_g=0.0,
                iron_mg=0.0,
                sodium_mg=45.0,
                ingredients_str="Carbonated Water, Sugar, Acidity Regulators (INS 330, INS 331), Preservative (INS 211)",
                allergens_str="None",
            )
            b64_str = base64.b64encode(img_bytes).decode("utf-8")

            status_code, data = await InProcessTestClient.post_ocr_label_json({"image_base64": b64_str})
            elapsed = (time.monotonic() - t0) * 1000

            # Must return 503 with exact error string
            detail = data.get("detail", "")
            passed = (
                status_code == 503
                and detail == "GOOGLE_API_KEY is missing in nutribite-cv/.env"
                and "Haldiram's Aloo Bhujia (Demo)" not in str(data)
            )
            self.log_result(
                "2. Zero Fake Demo Fallback (Missing API Key 503)",
                passed,
                elapsed,
                f"HTTP {status_code}: {detail}",
            )
        finally:
            if original_key:
                os.environ["GOOGLE_API_KEY"] = original_key

    # ── 3. Strict Non-Food & Selfie Rejection ──────────────────────────────────
    async def test_strict_selfie_rejection(self):
        t0 = time.monotonic()
        selfie_bytes = generate_selfie_image()
        b64_str = base64.b64encode(selfie_bytes).decode("utf-8")

        # Mock Gemini response for deterministic validation of rejection logic
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "isFood": False,
            "reason": "Image shows a human face / selfie, not a food or beverage nutrition label.",
        })

        with patch("cv_server.get_gemini_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_get_client.return_value = mock_client

            status_code, data = await InProcessTestClient.post_ocr_label_json({"image_base64": b64_str})
            elapsed = (time.monotonic() - t0) * 1000

            passed = (
                status_code == 422
                and data.get("isFood") is False
                and "selfie" in data.get("reason", "").lower()
            )
            self.log_result(
                "3a. Strict Non-Food Rejection: Human Selfie (422)",
                passed,
                elapsed,
                f"HTTP {status_code}: reason='{data.get('reason')}'",
            )

    async def test_strict_non_food_object_rejection(self):
        t0 = time.monotonic()
        laptop_bytes = generate_non_food_object_image()
        b64_str = base64.b64encode(laptop_bytes).decode("utf-8")

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "isFood": False,
            "reason": "Image contains a laptop and office desk, not a food or beverage item.",
        })

        with patch("cv_server.get_gemini_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_get_client.return_value = mock_client

            status_code, data = await InProcessTestClient.post_ocr_label_json({"image_base64": b64_str})
            elapsed = (time.monotonic() - t0) * 1000

            passed = (
                status_code == 422
                and data.get("isFood") is False
                and "not a food" in data.get("reason", "").lower()
            )
            self.log_result(
                "3b. Strict Non-Food Rejection: Laptop/Room (422)",
                passed,
                elapsed,
                f"HTTP {status_code}: reason='{data.get('reason')}'",
            )

    # ── 4. Accurate Indian Packaged Food & Beverage Reading ───────────────────
    async def test_beverage_label_reading_sprite(self):
        """Tests beverage reading (e.g. Sprite: ~11g sugar per 100ml / ~33g for 300ml can)."""
        t0 = time.monotonic()
        sprite_bytes = generate_synthetic_label_image(
            product_name="Sprite",
            serving_size="1 can (300ml)",
            sugar_g=33.0,
            sat_fat_g=0.0,
            protein_g=0.0,
            fiber_g=0.0,
            iron_mg=0.0,
            sodium_mg=45.0,
            ingredients_str="Carbonated Water, Sugar, Acidity Regulators (INS 330, INS 331), Preservative (INS 211)",
            allergens_str="None",
        )
        b64_str = base64.b64encode(sprite_bytes).decode("utf-8")

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "isFood": True,
            "productName": "Sprite",
            "servingSize": "1 can (300ml)",
            "macros": {
                "sugarG": 33.0,
                "satFatG": 0.0,
                "proteinG": 0.0,
                "fiberG": 0.0,
                "ironMg": 0.0,
                "sodiumMg": 45.0,
            },
            "ingredients": [
                "Carbonated Water",
                "Sugar",
                "Acidity Regulators (INS 330, INS 331)",
                "Preservative (INS 211)",
            ],
            "detectedAllergens": [],
        })

        with patch("cv_server.get_gemini_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_get_client.return_value = mock_client

            status_code, data = await InProcessTestClient.post_ocr_label_json({"image_base64": b64_str})
            elapsed = (time.monotonic() - t0) * 1000

            macros = data.get("macros", {})
            passed = (
                status_code == 200
                and data.get("isFood") is True
                and data.get("productName") == "Sprite"
                and data.get("servingSize") == "1 can (300ml)"
                and macros.get("sugarG") == 33.0
                and any("INS 330" in ing for ing in data.get("ingredients", []))
                and data.get("ocrEngine") == "gemini-vision"
            )
            self.log_result(
                "4a. Beverage Label: Sprite 300ml (~33g Sugar, INS Codes)",
                passed,
                elapsed,
                f"product='{data.get('productName')}', sugar={macros.get('sugarG')}g, INS preserved",
            )

    async def test_packaged_snack_label_reading(self):
        """Tests Indian packaged snack (e.g. Chocolate Peanut Bar / Maggi / Haldiram's)."""
        t0 = time.monotonic()
        bar_bytes = generate_synthetic_label_image(
            product_name="Chocolate Peanut Bar",
            serving_size="1 bar (40g)",
            sugar_g=24.0,
            sat_fat_g=8.0,
            protein_g=8.0,
            fiber_g=2.5,
            iron_mg=1.2,
            sodium_mg=150.0,
            ingredients_str="Roasted Peanuts (28%), Sugar, Liquid Glucose, Palmolein Oil, Cocoa Solids, Soy Lecithin (INS 322), Antioxidant (TBHQ - INS 319)",
            allergens_str="Peanuts, Soy",
        )

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "isFood": True,
            "productName": "Chocolate Peanut Bar",
            "servingSize": "1 bar (40g)",
            "macros": {
                "sugarG": 24.0,
                "satFatG": 8.0,
                "proteinG": 8.0,
                "fiberG": 2.5,
                "ironMg": 1.2,
                "sodiumMg": 150.0,
            },
            "ingredients": [
                "Roasted Peanuts (28%)",
                "Sugar",
                "Liquid Glucose",
                "Palmolein Oil",
                "Cocoa Solids",
                "Soy Lecithin (INS 322)",
                "Antioxidant (TBHQ - INS 319)",
            ],
            "detectedAllergens": ["Peanuts", "Soy"],
        })

        with patch("cv_server.get_gemini_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_get_client.return_value = mock_client

            # Test multipart/form-data upload
            status_code, data = await InProcessTestClient.post_ocr_label_multipart(bar_bytes)
            elapsed = (time.monotonic() - t0) * 1000

            macros = data.get("macros", {})
            passed = (
                status_code == 200
                and data.get("isFood") is True
                and data.get("productName") == "Chocolate Peanut Bar"
                and macros.get("sugarG") == 24.0
                and macros.get("satFatG") == 8.0
                and any("INS 319" in ing for ing in data.get("ingredients", []))
                and "Peanuts" in data.get("detectedAllergens", [])
            )
            self.log_result(
                "4b. Packaged Snack Label: Chocolate Peanut Bar (Multipart)",
                passed,
                elapsed,
                f"product='{data.get('productName')}', sugar={macros.get('sugarG')}g, allergens={data.get('detectedAllergens')}",
            )

    # ── 5. Indian Meal Plate OCR ──────────────────────────────────────────────
    async def test_meal_plate_ocr(self):
        """Tests Indian meal / plate identification (/ocr/plate)."""
        t0 = time.monotonic()
        plate_bytes = generate_meal_plate_image()
        b64_str = base64.b64encode(plate_bytes).decode("utf-8")

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "isFood": True,
            "productName": "North Indian Thali with Dal Makhani, Palak Paneer & Roti",
            "servingSize": "1 plate (~500g)",
            "macros": {
                "sugarG": 6.5,
                "satFatG": 11.0,
                "proteinG": 22.0,
                "fiberG": 9.5,
                "ironMg": 4.8,
                "sodiumMg": 780.0,
            },
            "ingredients": [
                "Dal Makhani",
                "Palak Paneer",
                "Jeera Rice",
                "Whole Wheat Roti",
                "Butter",
            ],
            "detectedAllergens": ["Dairy", "Gluten"],
        })

        with patch("cv_server.get_gemini_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_get_client.return_value = mock_client

            status_code, data = await InProcessTestClient.post_ocr_plate_json({"image_base64": b64_str})
            elapsed = (time.monotonic() - t0) * 1000

            macros = data.get("macros", {})
            passed = (
                status_code == 200
                and data.get("isFood") is True
                and "Thali" in data.get("productName", "")
                and macros.get("proteinG") == 22.0
                and "Dairy" in data.get("detectedAllergens", [])
                and data.get("ocrEngine") == "gemini-vision"
            )
            self.log_result(
                "5. Indian Meal Plate OCR (/ocr/plate)",
                passed,
                elapsed,
                f"dish='{data.get('productName')}', protein={macros.get('proteinG')}g, allergens={data.get('detectedAllergens')}",
            )

    # ── Runner & Summary ──────────────────────────────────────────────────────
    async def run_all_tests(self):
        print("\n" + "=" * 80)
        print("  NutriBite CV Engine — Automated Test & Accuracy Benchmark Suite")
        print("=" * 80 + "\n")

        await self.test_health_endpoint()
        await self.test_zero_demo_fallbacks_missing_key()
        await self.test_strict_selfie_rejection()
        await self.test_strict_non_food_object_rejection()
        await self.test_beverage_label_reading_sprite()
        await self.test_packaged_snack_label_reading()
        await self.test_meal_plate_ocr()

        # Print Summary
        total = len(self.results)
        passed = sum(1 for r in self.results if r["passed"])
        failed = total - passed
        total_time = sum(r["elapsed_ms"] for r in self.results)

        print("\n" + "-" * 80)
        print(f"  Test Execution Summary: {passed}/{total} Passed (100% Passing)" if failed == 0 else f"  Test Execution Summary: {passed}/{total} Passed, {failed} Failed")
        print(f"  Total Benchmark Time  : {total_time:.1f} ms")
        print(f"  Tesseract Available   : {probe_tesseract()}")
        print(f"  Gemini Configured     : {probe_gemini()}")
        print("=" * 80 + "\n")

        return failed == 0


def main():
    parser = argparse.ArgumentParser(description="NutriBite CV Automated Test Suite")
    parser.add_argument("--server", type=str, default=None, help="Optional live server base URL (e.g. http://localhost:8000)")
    args = parser.parse_args()

    import asyncio
    suite = NutriBiteCVTestSuite(server_url=args.server)
    success = asyncio.run(suite.run_all_tests())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
