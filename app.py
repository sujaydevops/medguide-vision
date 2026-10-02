import os, json, re, base64
from datetime import datetime
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Hackathon prototype. Demo data only; not medical advice.
DEMO = {
    "id": "med001",
    "name": "Metformin",
    "strength": "500 mg",
    "quantity": "1 tablet",
    "instructions": "1 tablet at 8 AM and 8 PM",
    "times": ["08:00", "20:00"],
    "follow_up": "2026-10-20",
    "language": "en",
    "confirmed": True
}
CURRENT = DEMO.copy()

def normalize(v):
    return re.sub(r"\s+", " ", (v or "").strip().lower())

def verify(expected, detected):
    en, es = normalize(expected.get("name")), normalize(expected.get("strength"))
    dn, ds = normalize(detected.get("name")), normalize(detected.get("strength"))
    if not dn:
        status = "UNREADABLE"
    elif dn != en:
        status = "MEDICINE_MISMATCH"
    elif not ds or not es:
        status = "REVIEW_REQUIRED"
    elif ds != es:
        status = "STRENGTH_MISMATCH"
    else:
        status = "MATCH"
    return {"status": status, "expected": expected, "detected": detected}

def gemini_generate(parts, system_instruction):
    try:

        from google import genai
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
        prompt = system_instruction + "\nReturn valid JSON only."
        contents = [prompt] + parts
        resp = client.models.generate_content(model=model, contents=contents)
        text = (resp.text or "").strip()
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I|re.S)
        return json.loads(text)
    except ImportError:
        raise RuntimeError("Gemini SDK is not installed. Run pip install -r requirements.txt.")

def data_url_part(data_url):
    m = re.match(r"data:(.*?);base64,(.*)", data_url or "", re.S)
    if not m:
        raise ValueError("Invalid image data")
    mime, payload = m.group(1), m.group(2)
    raw = base64.b64decode(payload)
    try:
        from google.genai import types
        return types.Part.from_bytes(data=raw, mime_type=mime)
    except Exception:
        return {"mime_type": mime, "data": raw}

@app.get("/")
def home():
    return render_template("index.html")

@app.get("/api/health")
def health():
    return jsonify({"ok": True, "gemini_configured": bool(os.getenv("GEMINI_API_KEY"))})

@app.get("/api/medications/current")
def current():
    return jsonify(CURRENT)

@app.post("/api/prescription/analyze")
def analyze_prescription():
    body = request.get_json(force=True)
    text = (body.get("text") or "").strip()
    image = body.get("image")
    instruction = """You extract structured prescription information for an accessibility prototype.
Extract ONLY information explicitly present. Never infer, recommend, calculate, complete, or correct
medication information from medical knowledge. Missing/unreadable values must be null.
Return exactly these keys: name, strength, quantity, instructions, times, follow_up.
times must be an array of explicit times if present, otherwise [].
Do not give medical advice."""
    parts = []
    if text: parts.append("Prescription text:\n" + text)
    if image: parts.append(data_url_part(image))
    if not parts:
        return jsonify({"error":"Provide prescription text or image."}), 400
    try:
        result = gemini_generate(parts, instruction)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/api/prescription/confirm")
def confirm():
    global CURRENT
    body = request.get_json(force=True)
    CURRENT = {
        "id": body.get("id", "med001"),
        "name": body.get("name"),
        "strength": body.get("strength"),
        "quantity": body.get("quantity"),
        "instructions": body.get("instructions"),
        "times": body.get("times") or [],
        "follow_up": body.get("follow_up"),
        "language": body.get("language", "en"),
        "confirmed": True
    }
    # Optional Firestore persistence; app remains demoable if unavailable.
    try:
        if os.getenv("USE_FIRESTORE","").lower() == "true":
            from google.cloud import firestore
            firestore.Client().collection("medications").document(CURRENT["id"]).set(CURRENT)
    except Exception as e:
        app.logger.warning("Firestore fallback: %s", e)
    return jsonify(CURRENT)

@app.post("/api/label/analyze")
def analyze_label():
    body = request.get_json(force=True)
    image = body.get("image")
    text = (body.get("text") or "").strip()
    instruction = """Read only the visible medication label. Extract medication name and strength only
when clearly visible. Do not infer missing values. Do not provide medical advice or decide whether a
medicine should be taken. Return exactly: name, strength, confidence. Use null when unreadable."""
    parts = []
    if text: parts.append("Medication label text:\n" + text)
    if image: parts.append(data_url_part(image))
    if not parts:
        return jsonify({"error":"Provide label text or image."}), 400
    try:
        return jsonify(gemini_generate(parts, instruction))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/api/verify")
def verify_api():
    body = request.get_json(force=True)
    return jsonify(verify(body.get("expected") or CURRENT, body.get("detected") or {}))

@app.post("/api/translate")
def translate():
    body = request.get_json(force=True)
    language = body.get("language","English")
    med = body.get("medication") or CURRENT
    instruction = f"""Explain the confirmed prescription instructions in {language}, simply and accessibly.
Do not add, remove, reinterpret, recommend, or change medicine names, strengths, numbers, units,
frequency, or timing. Return JSON with one key named explanation."""
    try:
        return jsonify(gemini_generate([json.dumps(med)], instruction))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT","5000")), debug=os.getenv("FLASK_DEBUG")=="1")
