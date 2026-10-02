# Judge Demo Script — ~5 Minutes

## 0:00–0:45 — Problem
Medication instructions can be difficult to access because of visual and language barriers. MedGuide Vision makes an existing prescription easier to see, hear, understand, and verify.

## 0:45–1:45 — Prescription
Paste/upload the DEMO prescription and click **Analyze with Gemini**.
Explain: Gemini turns an unstructured prescription into structured fields, but we never silently trust it. The user reviews and confirms the result.

## 1:45–2:30 — Accessibility
Show the dashboard, language explanation, and Read Aloud.
Explain that medication numbers/units remain structured and the app does not add medical recommendations.

## 2:30–3:45 — Vision verification
Open **Check my medication label**.
Scan/upload `Metformin 500 mg` and show MATCH.
Then scan/upload `Lisinopril 10 mg` and show MEDICATION MISMATCH.
Explain: Gemini reads the unstructured label; deterministic code performs the comparison.

## 3:45–4:20 — Safety
Show that missing/unreadable information produces a review/unreadable state rather than a guessed value.
Key line: **Gemini understands the unstructured prescription and label, but deterministic code performs the final comparison, and missing medical information is never invented.**

## 4:20–5:00 — Stack / close
Gemini multimodal + Firestore + Cloud Run. The prototype focuses on accessibility and social good. It does not prescribe or decide whether medication is safe to take.
