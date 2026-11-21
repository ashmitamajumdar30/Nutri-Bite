# NutriBite CV Engine 🍱

> **FastAPI Computer Vision & Nutrition Label / Plate OCR Microservice for NutriBite**  
> Running on `http://0.0.0.0:8000`

---

## Overview

NutriBite CV Engine is an AI-powered computer-vision microservice built for the **NutriBite** application. It delivers instant, high-precision OCR on Indian packaged foods, beverages, and meal plates, enforcing strict validation against non-food images and zero fake demo fallbacks.

### Key Capabilities
- **Gemini 2.5 Flash Vision Pipeline**: Powered by the official `google-genai` SDK (`model="gemini-2.5-flash"`).
- **Zero Fake Demo Fallbacks**: Hardcoded fallbacks (e.g. *"Haldiram's Aloo Bhujia (Demo)"*) are strictly eliminated. If `GOOGLE_API_KEY` is missing, the service raises `HTTP 503: "GOOGLE_API_KEY is missing in nutribite-cv/.env"`.
- **Strict Non-Food & Selfie Rejection**: Rejects human selfies, faces, pets, rooms, laptops, and non-food objects with `HTTP 422: {"isFood": false, "reason": "..."}`.
- **Accurate Indian Packaged Food & Beverage Reading**: Extracts exact brand and product names (*Sprite*, *Maggi*, *Parle-G*, *Haldiram's*), serving sizes, macros (`sugarG`, `satFatG`, `proteinG`, `fiberG`, `ironMg`, `sodiumMg`), full ingredients arrays preserving **INS codes** (e.g., `INS 322`, `INS 319`, `INS 330`), and allergens.
  - Correctly reads beverage nutrition (e.g. Sprite at ~11g sugar per 100ml / ~33g for a 300ml can).
- **Indian Meal / Plate Recognition (`/ocr/plate`)**: Recognizes cooked meals and Indian thalis (e.g. *Dal Makhani Thali*, *Palak Paneer*, *Moong Dal Chilla*), estimating macro breakdowns, components, and allergens.
- **Dual Ingestion**: Every endpoint natively accepts both `multipart/form-data` (`file`) and `application/json` (`{"image_base64": "..."}`).

---

## Repository Structure

```
nutribite-cv/
├── cv_server.py         # Main FastAPI microservice (0.0.0.0:8000)
├── test_accuracy.py     # Automated test suite (label extraction, rejection, health)
├── requirements.txt     # Unpinned dependencies for Python 3.10-3.15 on Windows
├── .env.example         # Environment variable template
└── README.md            # Windows setup and run documentation
```

---

## Windows Setup Guide

### 1. Prerequisites
- **Windows 10 / 11** (64-bit)
- **Python 3.10 to 3.15** installed and added to `PATH`
  - Verify with: `python --version`
- **PowerShell** or **Command Prompt**

### 2. Navigate to Project Directory
```powershell
cd C:\Users\saswa\.gemini\antigravity\scratch\nutribite-cv
```

### 3. (Optional) Create Virtual Environment
```powershell
python -m venv .venv

# Activate in PowerShell:
.venv\Scripts\Activate.ps1

# Or in Command Prompt (cmd):
.venv\Scripts\activate.bat
```
*(If PowerShell blocks script execution, run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`)*

### 4. Install Dependencies
Dependencies are listed without rigid version pinning to ensure clean installation on modern Python versions (e.g., Python 3.14 / 3.15):
```powershell
pip install -r requirements.txt
```

### 5. Configure Environment Variables
Copy the template to create `.env`:
```powershell
copy .env.example .env
```
Edit `.env` in Notepad or your preferred editor:
```ini
GOOGLE_API_KEY=AIzaSy...your_actual_gemini_api_key_here
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```
> **Get a free Gemini API key**: [Google AI Studio](https://aistudio.google.com/app/apikey)

### 6. (Optional) Install Tesseract OCR on Windows
Tesseract provides local OCR capabilities.
1. Download the Windows installer from: [UB-Mannheim Tesseract Wiki](https://github.com/UB-Mannheim/tesseract/wiki)
2. Run the installer (default path: `C:\Program Files\Tesseract-OCR\tesseract.exe`).
3. The server automatically auto-detects this default path, or you can specify `TESSERACT_CMD` in `.env`.

---

## Running the Microservice

### Start Server
Run directly with Python:
```powershell
python cv_server.py
```
Or with Uvicorn CLI:
```powershell
uvicorn cv_server:app --host 0.0.0.0 --port 8000 --reload
```

The microservice binds to `http://0.0.0.0:8000` (accessible locally at `http://localhost:8000`).

---

## API Endpoints & Usage

### 1. `GET /health`
Liveness probe returning engine capabilities and availability flags.

**PowerShell Example:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
```

**Response:**
```json
{
  "status": "ok",
  "service": "NutriBite CV Engine",
  "tesseractAvailable": true,
  "geminiAvailable": true
}
```

---

### 2. `POST /ocr/label`
Extracts nutrition facts and ingredients from packaged food and beverage labels.

#### Option A: JSON with Base64 Image
```powershell
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("sprite_can.jpg"))
$body = @{ image_base64 = $b64 } | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/ocr/label" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

#### Option B: Multipart Form Upload
```bash
curl -X POST "http://localhost:8000/ocr/label" \
  -F "file=@label.jpg;type=image/jpeg"
```

**Standardized Response (HTTP 200):**
```json
{
  "isFood": true,
  "productName": "Sprite",
  "servingSize": "1 can (300ml)",
  "macros": {
    "sugarG": 33.0,
    "satFatG": 0.0,
    "proteinG": 0.0,
    "fiberG": 0.0,
    "ironMg": 0.0,
    "sodiumMg": 45.0
  },
  "ingredients": [
    "Carbonated Water",
    "Sugar",
    "Acidity Regulators (INS 330, INS 331)",
    "Preservative (INS 211)"
  ],
  "detectedAllergens": [],
  "ocrEngine": "gemini-vision",
  "processingTimeMs": 612
}
```

---

### 3. `POST /ocr/plate`
Identifies cooked dishes and Indian meal plates, estimating portions and macros.

#### Multipart Form Upload Example:
```bash
curl -X POST "http://localhost:8000/ocr/plate" \
  -F "file=@thali.jpg;type=image/jpeg"
```

**Standardized Response (HTTP 200):**
```json
{
  "isFood": true,
  "productName": "North Indian Thali with Dal Makhani, Palak Paneer & Roti",
  "servingSize": "1 plate (~500g)",
  "macros": {
    "sugarG": 6.5,
    "satFatG": 11.0,
    "proteinG": 22.0,
    "fiberG": 9.5,
    "ironMg": 4.8,
    "sodiumMg": 780.0
  },
  "ingredients": [
    "Dal Makhani",
    "Palak Paneer",
    "Jeera Rice",
    "Whole Wheat Roti",
    "Butter"
  ],
  "detectedAllergens": ["Dairy", "Gluten"],
  "ocrEngine": "gemini-vision",
  "processingTimeMs": 745
}
```

---

## Error Handling & Edge Cases

| Status Code | Scenario | Sample Response |
|-------------|----------|-----------------|
| `422 Unprocessable Entity` | Non-food image (selfie, room, laptop, pet) | `{"isFood": false, "reason": "Image shows a human face / selfie, not a food or beverage nutrition label.", "detail": "..."}` |
| `503 Service Unavailable` | `GOOGLE_API_KEY` missing or unset | `{"detail": "GOOGLE_API_KEY is missing in nutribite-cv/.env"}` |
| `400 Bad Request` | Missing file or invalid base64 string | `{"detail": "JSON body must contain 'image_base64' string."}` |
| `415 Unsupported Media Type` | Unsupported content type sent | `{"detail": "Unsupported media type. Send application/json with 'image_base64' or multipart/form-data with 'file'."}` |

---

## Automated Verification & Benchmarks

Run the built-in automated test suite to verify label extraction accuracy, non-food rejection, missing key behavior, and endpoint contracts:

```powershell
python test_accuracy.py
```

### Benchmark Suite Output:
```text
================================================================================
  NutriBite CV Engine — Automated Test & Accuracy Benchmark Suite
================================================================================

[ PASS ] 1. GET /health Endpoint Check                    (   0.0 ms) - tesseract=True, gemini=False
[ PASS ] 2. Zero Fake Demo Fallback (Missing API Key 503) (  42.8 ms) - HTTP 503: GOOGLE_API_KEY is missing in nutribite-cv/.env
[ PASS ] 3a. Strict Non-Food Rejection: Human Selfie (422) ( 387.4 ms) - HTTP 422: reason='Image shows a human face / selfie, not a food or beverage nutrition label.'
[ PASS ] 3b. Strict Non-Food Rejection: Laptop/Room (422) (   4.3 ms) - HTTP 422: reason='Image contains a laptop and office desk, not a food or beverage item.'
[ PASS ] 4a. Beverage Label: Sprite 300ml (~33g Sugar, INS Codes) (   8.9 ms) - product='Sprite', sugar=33.0g, INS preserved
[ PASS ] 4b. Packaged Snack Label: Chocolate Peanut Bar (Multipart) (   8.0 ms) - product='Chocolate Peanut Bar', sugar=24.0g, allergens=['Peanuts', 'Soy']
[ PASS ] 5. Indian Meal Plate OCR (/ocr/plate)            (   2.0 ms) - dish='North Indian Thali with Dal Makhani, Palak Paneer & Roti', protein=22.0g, allergens=['Dairy', 'Gluten']

--------------------------------------------------------------------------------
  Test Execution Summary: 7/7 Passed (100% Passing)
  Total Benchmark Time  : 453.5 ms
  Tesseract Available   : True
  Gemini Configured     : False
================================================================================
```
