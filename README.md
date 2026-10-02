# MedGuide Vision

Hackathon prototype for accessible, multilingual prescription understanding and medication-label verification.

## What works
- Email/password account registration and sign-in with per-account confirmed prescription storage
- Prescription text/image analysis with Gemini multimodal
- Human review and confirmation before data becomes trusted
- Multilingual explanation using Gemini
- Browser text-to-speech
- Opt-in follow-up SMS scheduled one day before, including the prescription's written instructions
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

Create an account from the sign-in screen to open the dashboard. Local accounts are stored in SQLite under `instance/`; configure `FLASK_SECRET_KEY` to keep sign-in sessions stable across app restarts. This hackathon account system is for synthetic demo data only and is not a production identity provider. For public deployment, configure the secret through Secret Manager and use a production identity/database service rather than relying on Cloud Run's ephemeral local filesystem.

### Follow-up SMS

At prescription review, the user can explicitly opt in, enter their phone number in E.164 format (for example `+14155550123`), and choose a local reminder time. The browser supplies its IANA timezone. The app schedules one SMS for one day before the confirmed follow-up date; the text includes the date and the confirmed prescription instructions, and includes `Reply STOP to opt out`. No message is sent without the checkbox consent.

Configure all three Twilio values through environment variables (never commit them): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`. If any value is missing, the prescription can still be saved but the dashboard clearly says the SMS was not scheduled. Use only synthetic demo data in this prototype: SMS content can expose sensitive medication information on a phone.

The prototype scheduler persists pending jobs in local SQLite and restores them on app restart. This works for a continuously running local demo, but is not a reliable Cloud Run scheduler because instances can scale to zero and local storage is ephemeral. A production deployment needs a durable shared datastore and managed scheduled-task delivery (for example Cloud Tasks), plus appropriate privacy, consent, and messaging compliance review.

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
1. Sign in, choose `Continue with demo prescription (skip Gemini)`, and review the prefilled synthetic Metformin details. No Gemini request is made on this path.
2. Edit if needed and confirm the prescription.
3. Show dashboard and language/voice.
4. Check a demo label reading `Metformin 500 mg` -> MATCH.
5. Check `Lisinopril 10 mg` -> MEDICINE_MISMATCH.
6. Check `Metformin 1000 mg` -> STRENGTH_MISMATCH.
7. Check `Paracetamol` -> demonstrates missing-strength review behavior (depending on expected medication, a different-name label correctly yields medicine mismatch first).

If `GEMINI_API_KEY` is not configured or label analysis fails, the camera/upload flow keeps the captured image available and offers clearly labeled manual entry. Compare only the name and strength you can actually read; the deterministic verifier still handles match, mismatch, review, and unreadable outcomes without representing manual entry as Gemini analysis.

Printable physical camera-test props are in [demo/physical_test_props.html](demo/physical_test_props.html). Open it in a browser, print on US Letter paper at 100% scale, cut out the four marked props, and tape the three bottle labels to empty bottles or cups. The **DEMO / NOT FOR MEDICAL USE** warning is printed on every prop.

For Gemini AI Studio structured output, use [demo/label_response_schema.json](demo/label_response_schema.json) for the label extractor. It matches the API fields (`name`, `strength`, `confidence`) and allows missing visible values to be `null`; pair it with the label-extraction prompt in `AGENTS.md` and verify labels deterministically in application code.

## Architecture
Gemini handles unstructured multimodal extraction and multilingual explanation. Deterministic application code handles final comparison. The user confirms prescription extraction before it becomes the source of truth.

## Before submission
Replace placeholders in `SUBMISSION.md`, add team names/repository/deployment URL, verify the live demo, and never commit `.env`.
