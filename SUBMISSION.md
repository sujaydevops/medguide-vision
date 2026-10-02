# MedGuide Vision — Submission Copy

## Project
**MedGuide Vision**

## One-line pitch
An accessibility-focused medication assistant that uses Gemini multimodal AI to structure an existing prescription, explain confirmed instructions across languages, and compare a scanned medication label against the confirmed prescription without inventing missing medical information.

## Problem
Prescription information can be difficult to access because of visual barriers, language barriers, and complex schedules. A medication label can also be difficult to compare quickly against a stored prescription.

## Solution
MedGuide Vision lets a user upload or photograph a prescription. Gemini extracts structured information, but the user must review and confirm it. The app can explain confirmed instructions in a selected language and read them aloud. At medication-check time, the user scans a label; Gemini extracts the visible medication name and strength, while deterministic code compares those fields against the confirmed prescription.

## Google technology
- Gemini multimodal: prescription and medication-label extraction
- Gemini: multilingual explanation
- Firestore: optional confirmed-medication persistence
- Cloud Run: deployment target

## Responsible AI
Gemini is never asked whether medicine is safe to take. Missing medication values are not inferred. Prescription extraction requires human confirmation, and the final label comparison is deterministic.

## Team
- MEMBER 1: [NAME] — Gemini/backend
- MEMBER 2: [NAME] — camera/verification
- MEMBER 3: [NAME] — frontend/accessibility/deployment

## Links
- Repository: [ADD URL]
- Live demo: [ADD URL]

**Hackathon prototype / DEMO ONLY / NOT FOR MEDICAL USE**
