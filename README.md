# MedGuide Vision

Hackathon prototype for accessible, multilingual prescription understanding and medication-label verification.

## What works
- Prescription text/image analysis with Gemini multimodal
- Human review and confirmation before data becomes trusted
- Multilingual explanation using Gemini
- Browser text-to-speech
- Browser camera capture or image upload
- Gemini medication-label extraction
- Deterministic `MATCH`, `MEDICINE_MISMATCH`, `STRENGTH_MISMATCH`, `REVIEW_REQUIRED`, `UNREADABLE`
- Optional Firestore persistence with in-memory fallback
- Cloud Run-ready Dockerfile

## Safety
This is a prototype and **not medical advice**. It does not prescribe, recommend a dose, or decide whether medication is safe to take. Missing information stays missing. Demo records are synthetic.

## Local setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
export GEMINI_API_KEY="YOUR_KEY"
python app.py
```

Open `http://127.0.0.1:5000`.

If you use `.env`, note that Flask does not load it automatically in this starter; export the variables in your shell or use your preferred environment loader.

## Cloud Run

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud run deploy medguide-vision --source . --region us-west1 --allow-unauthenticated --set-env-vars GEMINI_API_KEY=YOUR_KEY
```

For a real deployment, use Secret Manager rather than placing secrets directly in command history.

Optional Firestore:
```bash
export USE_FIRESTORE=true
```
The Cloud Run service account needs Firestore access and Firestore must be created/enabled.

## Demo
1. Use the included Metformin demo prescription text.
2. Confirm the extraction.
3. Show dashboard and language/voice.
4. Check a demo label reading `Metformin 500 mg` -> MATCH.
5. Check `Lisinopril 10 mg` -> MEDICINE_MISMATCH.
6. Check `Metformin 1000 mg` -> STRENGTH_MISMATCH.
7. Check `Paracetamol` -> demonstrates missing-strength review behavior (depending on expected medication, a different-name label correctly yields medicine mismatch first).

## Architecture
Gemini handles unstructured multimodal extraction and multilingual explanation. Deterministic application code handles final comparison. The user confirms prescription extraction before it becomes the source of truth.

## Before submission
Replace placeholders in `SUBMISSION.md`, add team names/repository/deployment URL, verify the live demo, and never commit `.env`.
