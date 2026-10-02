# AGENTS.md --- MedGuide Vision Hackathon Alignment Guide

> **Read this file before making any change to the repository.**
>
> This is the shared operating contract for every human developer and
> coding agent working on **MedGuide Vision** during the SF Hacks × GDG
> AI Hackathon.

------------------------------------------------------------------------

## 1. Mission

Build a working, polished prototype of **MedGuide Vision**: a
multilingual medication-accessibility assistant that helps a user:

1.  Upload or photograph an existing prescription.
2.  Use **Gemini multimodal** to extract only the medication information
    actually present.
3.  Review and explicitly confirm the extracted information.
4.  Receive an accessible explanation in a selected language.
5.  Store the confirmed medication plan.
6.  View scheduled medication information and follow-up reminders.
7.  Point a camera at a pharmacy/demo medication label.
8.  Use **Gemini multimodal** to extract the visible medication name and
    strength.
9.  Deterministically compare the scanned label with the confirmed
    prescription.
10. Receive an accessible **MATCH / MISMATCH / REVIEW REQUIRED** result
    with optional voice output.

### Product principle

**Gemini can read, structure, translate, and explain. It does not
prescribe.**

The application must never invent a missing medication, strength, dose,
frequency, duration, or instruction.

------------------------------------------------------------------------

## 2. Hackathon Track Alignment

We are targeting the **GDG "Build with AI for Social Good" track**.

The project must visibly demonstrate:

-   Gemini is an important part of the product, not an added chatbot.
-   A clear social/accessibility problem is being addressed.
-   At least one additional Google developer or Google Cloud technology
    is used.
-   Hackathon Google Cloud credits are used where required.
-   A working prototype is demonstrated.

### Planned Google stack

-   **Gemini** --- prescription and medication-label multimodal
    understanding; multilingual explanation.
-   **Firestore** --- confirmed medication/schedule/verification data.
-   **Cloud Run** --- final deployment.
-   Google Cloud project/credits --- deployment and eligible services.

Do not describe a Google technology as implemented unless it is actually
working in the submitted build.

------------------------------------------------------------------------

## 3. Non-Negotiable Safety Rules

These rules override convenience and demo polish.

### NEVER

-   Generate a medication dose from general model knowledge.
-   Infer a missing strength.
-   Infer a missing frequency.
-   Tell the user a medication is "safe to take."
-   Diagnose a condition.
-   recommend changing a prescription.
-   Treat Gemini output as automatically confirmed.
-   Identify a loose pill by appearance and then tell the user to take
    it.
-   Store or expose API keys in source control.

### ALWAYS

-   Extract only what is present in the source prescription/label.
-   Return `null` for missing critical fields.
-   Require user confirmation before extracted prescription data becomes
    the source of truth.
-   Preserve medication names, numbers, units, and frequencies as
    structured fields.
-   Use deterministic code for prescription-vs-label comparison.
-   Use wording such as **"Label matches stored prescription
    information"**, not **"Safe to take."**
-   Clearly mark hackathon medication examples as **DEMO / NOT FOR
    MEDICAL USE**.

------------------------------------------------------------------------

## 4. Architecture

``` text
                         USER
                           |
                           v
                    FRONTEND / UI
                           |
              +------------+-------------+
              |                          |
              v                          v
      Prescription Upload          Camera Capture
              |                          |
              v                          v
      Gemini Multimodal           Gemini Multimodal
      Prescription Extractor       Label Extractor
              |                          |
              v                          v
       Structured JSON            Structured JSON
              |                          |
              v                          |
       USER CONFIRMATION                  |
              |                          |
              v                          |
          FIRESTORE                      |
              |                          |
              +------------+-------------+
                           |
                           v
                Deterministic Matcher
                           |
              +------------+------------+
              |            |            |
              v            v            v
            MATCH       MISMATCH    REVIEW_REQUIRED
              |            |            |
              +------------+------------+
                           |
                           v
                 UI + Voice Feedback
```

------------------------------------------------------------------------

## 5. Shared Data Contract

**Do not rename these fields without team agreement.**

### Confirmed medication

``` json
{
  "id": "med001",
  "name": "Metformin",
  "strength": "500 mg",
  "quantity": "1 tablet",
  "instructions": "1 tablet at 8 AM and 8 PM",
  "times": ["08:00", "20:00"],
  "follow_up": "2026-10-20",
  "language": "en",
  "confirmed": true
}
```

### Label extraction

``` json
{
  "name": "Metformin",
  "strength": "500 mg",
  "confidence": "high"
}
```

### Missing information

``` json
{
  "name": "Paracetamol",
  "strength": null,
  "confidence": "medium"
}
```

### Verification result

``` json
{
  "status": "MATCH",
  "expected": {
    "name": "Metformin",
    "strength": "500 mg"
  },
  "detected": {
    "name": "Metformin",
    "strength": "500 mg"
  }
}
```

Allowed verification statuses:

``` text
MATCH
MEDICINE_MISMATCH
STRENGTH_MISMATCH
REVIEW_REQUIRED
UNREADABLE
```

Do not introduce alternate status names without updating all consumers.

------------------------------------------------------------------------

## 6. API Contract

Target endpoints:

``` text
POST /api/prescription/analyze
POST /api/prescription/confirm
POST /api/translate
GET  /api/medications
GET  /api/medications/current
POST /api/label/analyze
POST /api/verify
GET  /api/followups
GET  /api/health
```

### `POST /api/prescription/analyze`

Input: prescription image/text.

Output should follow the shared medication fields.

**Important:** output is *unconfirmed*.

### `POST /api/prescription/confirm`

Takes reviewed medication data and persists it as confirmed.

### `GET /api/medications/current`

Example:

``` json
{
  "id": "med001",
  "name": "Metformin",
  "strength": "500 mg",
  "quantity": "1 tablet",
  "instructions": "1 tablet at 8 AM and 8 PM",
  "times": ["08:00", "20:00"],
  "language": "en",
  "confirmed": true
}
```

### `POST /api/label/analyze`

Input: camera image.

Output:

``` json
{
  "name": "Metformin",
  "strength": "500 mg",
  "confidence": "high"
}
```

### `POST /api/verify`

Input:

``` json
{
  "expected": {
    "name": "Metformin",
    "strength": "500 mg"
  },
  "detected": {
    "name": "Metformin",
    "strength": "500 mg"
  }
}
```

Output:

``` json
{
  "status": "MATCH"
}
```

------------------------------------------------------------------------

## 7. Deterministic Verification Rules

Gemini extracts visible information. **Gemini does not decide whether
the label matches.**

Normalize capitalization/spacing, then use deterministic logic
equivalent to:

``` python
if not detected_name:
    status = "UNREADABLE"
elif normalize(detected_name) != normalize(expected_name):
    status = "MEDICINE_MISMATCH"
elif not detected_strength:
    status = "REVIEW_REQUIRED"
elif normalize(detected_strength) != normalize(expected_strength):
    status = "STRENGTH_MISMATCH"
else:
    status = "MATCH"
```

If expected prescription data itself is incomplete, do not manufacture
the missing value. Return a review state.

------------------------------------------------------------------------

## 8. Agent / Member Ownership

All three tracks run **in parallel**.

### Agent / Member 1 --- Gemini + Backend + Firestore

**Owns:**

-   Gemini prescription extraction.
-   Structured JSON parsing/validation.
-   Missing-field safety behavior.
-   Prescription confirmation API.
-   Translation/explanation service.
-   Firestore persistence/fallback.
-   Backend API contracts.
-   Health endpoint.

**Must not own:**

-   Main UI styling.
-   Camera UX.
-   Verification screen design.

**Mock dependencies if needed.**

Member 1 can test without the frontend using sample requests.

**Definition of done:**

``` text
Prescription -> Gemini -> JSON -> Confirm -> Persist -> API
```

and `Paracetamol` alone returns no invented strength/dose.

------------------------------------------------------------------------

### Agent / Member 2 --- Camera + Gemini Label Vision + Verification

**Owns:**

-   Browser camera access.
-   Image capture.
-   Gemini medication-label extraction.
-   Label JSON validation.
-   Deterministic matcher.
-   Match/mismatch/review test cases.

**Must not own:**

-   Prescription translation.
-   Firestore schema redesign.
-   Main dashboard styling.

Until Member 1 is ready, use:

``` json
{
  "name": "Metformin",
  "strength": "500 mg"
}
```

as the mocked expected medication.

**Definition of done:** all of these work:

``` text
Expected Metformin 500 mg
Detected Metformin 500 mg
=> MATCH

Expected Metformin 500 mg
Detected Lisinopril 10 mg
=> MEDICINE_MISMATCH

Expected Metformin 500 mg
Detected Metformin 1000 mg
=> STRENGTH_MISMATCH

Detected Paracetamol with no strength
=> REVIEW_REQUIRED

Unreadable label
=> UNREADABLE
```

------------------------------------------------------------------------

### Agent / Member 3 --- Frontend + Accessibility + Integration + Deployment

**Owns:**

-   Welcome screen.
-   Language selector.
-   Prescription upload UI.
-   Gemini-processing state.
-   Confirmation/edit UI.
-   Dashboard.
-   Camera-launch UI integration.
-   Verification result screens.
-   Text-to-speech.
-   Follow-up display.
-   Responsive/accessibility polish.
-   Final Cloud Run deployment.
-   Demo flow.

Until real APIs exist, use mock objects matching the shared contracts.

**Definition of done:**

``` text
Welcome
 -> Language
 -> Upload
 -> Analyze
 -> Confirm
 -> Dashboard
 -> Check Medicine
 -> Result
 -> Voice
 -> Follow-up
```

works as one coherent user journey.

------------------------------------------------------------------------

## 9. Parallel Development Rule

**Nobody waits for another agent.**

If an upstream component is unavailable, mock it using the exact shared
data contract.

Examples:

-   Frontend waiting for prescription API -\> use mock medication JSON.
-   Camera waiting for backend -\> use mock expected medication.
-   Backend waiting for frontend -\> test via direct HTTP/API calls.
-   UI waiting for camera -\> use mock verification results.

During integration, replace mocks with real endpoints **without changing
the agreed object shapes**.

------------------------------------------------------------------------

## 10. Git Workflow

Recommended branches:

``` text
main
member1-gemini
member2-camera
member3-frontend
```

### Before starting work

``` bash
git checkout main
git pull
git checkout YOUR_BRANCH
git merge main
```

### Commit small working units

Examples:

``` text
feat(gemini): add prescription extraction
feat(camera): add label capture
feat(verify): add deterministic matcher
feat(ui): add medication dashboard
feat(a11y): add text to speech
fix(api): preserve null strength
```

### Before merging

1.  Pull latest `main`.
2.  Merge `main` into your branch.
3.  Resolve conflicts locally.
4.  Run your tests.
5.  Verify shared JSON fields did not change.
6.  Merge/pull request into `main`.
7.  Smoke-test `main`.

### Never commit

``` text
.env
API keys
service-account JSON
private credentials
```

Keep `.env` in `.gitignore`.

------------------------------------------------------------------------

## 11. Integration Checkpoints

### Checkpoint A --- shared contract

Before independent work:

-   [ ] Everyone has this file.
-   [ ] Everyone agrees on JSON field names.
-   [ ] Everyone agrees on verification statuses.
-   [ ] Google project owner is known.
-   [ ] Branch ownership is clear.

### Checkpoint B --- first integration

Each member demonstrates their module independently.

-   [ ] Member 1 can return a structured medication object.
-   [ ] Member 2 can produce label extraction + verification result.
-   [ ] Member 3 can run the full UI with mocks.

Then replace mocks with real endpoints.

### Checkpoint C --- feature freeze

No new features after feature freeze.

Only:

-   bug fixes
-   integration
-   safety fixes
-   UI clarity
-   deployment
-   README/submission
-   demo rehearsal

------------------------------------------------------------------------

## 12. Required Test Matrix

Before submission, test every row.

  -----------------------------------------------------------------------
  Scenario                            Expected
  ----------------------------------- -----------------------------------
  Prescription clearly contains       Extract name + strength
  Metformin 500 mg                    

  Prescription contains only          Strength/dose remain null
  `Paracetamol`                       

  Correct label: Metformin 500 mg     `MATCH`

  Wrong medicine: Lisinopril 10 mg    `MEDICINE_MISMATCH`

  Same medicine, wrong strength:      `STRENGTH_MISMATCH`
  Metformin 1000 mg                   

  Medicine visible, strength hidden   `REVIEW_REQUIRED`

  Blurry/unreadable label             `UNREADABLE`

  Gemini returns malformed JSON       Graceful error/retry, no invented
                                      data

  API unavailable                     Friendly error, no fake success

  User selects another language       Explanation/UI responds
                                      appropriately

  Voice unavailable                   UI remains fully usable without
                                      voice
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 13. Demo Data

All sample medication records must be visibly marked:

> **DEMO / NOT FOR MEDICAL USE**

Hackathon test records:

``` text
Paracetamol — 500 mg
Demo record: 1 tablet every 6 hours as needed

Metformin — 500 mg
Demo record: 1 tablet at 8 AM and 8 PM

Amoxicillin — 500 mg
Demo record: 1 capsule at 8 AM, 4 PM and midnight

Atorvastatin — 20 mg
Demo record: 1 tablet at 9 PM

Lisinopril — 10 mg
Demo record: 1 tablet at 8 AM
```

These exist solely to test whether the application faithfully reads and
repeats a stored demo prescription. They are **not medical
recommendations**.

------------------------------------------------------------------------

## 14. Gemini Prompt Contract

Prescription extraction prompts must convey:

``` text
You are extracting structured information from a prescription for an
accessibility application.

Extract only information explicitly present in the supplied content.

Do not infer, recommend, calculate, complete, or correct medication
information from general medical knowledge.

If a medication strength, quantity, frequency, schedule, duration,
or follow-up is missing or unreadable, return null for that field.

Preserve medication names, numbers, units, and timing information.

Return structured JSON only.
```

Label extraction prompts must convey:

``` text
Read only the visible medication label.

Extract the medication name and strength if they are clearly visible.

Do not infer missing values.
Do not provide medical advice.
Do not decide whether the medication should be taken.

Return null for information that cannot be confidently read.

Return structured JSON only.
```

Translation/explanation prompts must convey:

``` text
Explain the confirmed prescription instructions in the requested language.

Do not add, remove, reinterpret, or change medication names, strengths,
numbers, units, frequency, or timing.

Do not provide additional medical recommendations.
```

------------------------------------------------------------------------

## 15. UI Language Contract

Use these phrases consistently.

### Good

``` text
Gemini detected
Review before saving
Confirmed prescription
Scheduled medication
Label matches stored prescription information
Medication mismatch
Strength mismatch
Review required
Unable to read label
Ask for assistance
```

### Avoid

``` text
Safe to take
Correct dose for you
You should take this
Recommended dose
AI prescription
Doctor-approved
Guaranteed match
```

------------------------------------------------------------------------

## 16. Accessibility Requirements

At minimum:

-   Large tap/click targets.
-   Clear typography.
-   Strong visual contrast.
-   Status represented by **text/icon + color**, never color alone.
-   Keyboard-accessible controls where practical.
-   Useful labels on buttons.
-   Voice output is optional enhancement, not the only way to receive
    information.
-   Original/confirmed medication information remains available when
    translated explanations are shown.
-   Error states explain the next action.

------------------------------------------------------------------------

## 17. Scope Control

### MUST HAVE

-   Prescription upload/input.
-   Gemini prescription extraction.
-   Human confirmation.
-   Language selection/explanation.
-   Confirmed medication storage.
-   Dashboard/current medication.
-   Camera or image-based medication label analysis.
-   Gemini label extraction.
-   Deterministic match/mismatch.
-   Missing-information safety.
-   Accessible result screen.
-   Working live demo.

### SHOULD HAVE

-   Text-to-speech.
-   Follow-up reminder.
-   History.
-   Firestore persistence.
-   Cloud Run deployment.

### ONLY IF EVERYTHING ELSE WORKS

-   Caregiver notifications.
-   Pharmacy integration.
-   Refill prediction.
-   Authentication.
-   Doctor portal.
-   Advanced scheduling.
-   Additional AI agents.

**Do not sacrifice the core demo for bonus features.**

------------------------------------------------------------------------

## 18. Failure Policy

The application should fail **closed**, not confidently.

If Gemini is uncertain:

``` text
REVIEW REQUIRED
```

If image is unreadable:

``` text
UNREADABLE
```

If the API fails:

``` text
We couldn't analyze this right now. Please try again.
```

If a critical field is missing:

``` text
This information could not be verified from the source.
```

Never silently replace an error with a guessed medication instruction.

------------------------------------------------------------------------

## 19. Secrets and Privacy

-   Secrets only via environment variables/approved secret storage.
-   Never commit credentials.
-   Do not use real patient prescriptions in the public hackathon
    repository.
-   Use synthetic/demo prescription data for the public demo.
-   Avoid logging prescription images or extracted sensitive information
    unnecessarily.
-   Delete temporary uploaded images when practical.
-   Clearly explain that a production healthcare deployment would
    require additional privacy, security, regulatory, and clinical
    review.

------------------------------------------------------------------------

## 20. Final Demo Path

The final build should be rehearsed around one path:

``` text
1. Open MedGuide Vision.
2. Select language.
3. Upload DEMO prescription.
4. Show Gemini extracting Metformin 500 mg + schedule.
5. Review and confirm.
6. Show translated/accessibility explanation.
7. Open dashboard.
8. Select "Check My Medicine."
9. Scan DEMO Metformin 500 mg label.
10. Show MATCH.
11. Scan DEMO Lisinopril 10 mg label.
12. Show MEDICINE_MISMATCH.
13. Scan/show "Paracetamol" without strength.
14. Show REVIEW_REQUIRED instead of invented dose.
15. Show voice/follow-up if stable.
```

The key line for judges:

> **"Gemini understands the unstructured prescription and medication
> label, but deterministic code performs the final comparison, and
> missing medical information is never invented."**

------------------------------------------------------------------------

## 21. Five-Minute Presentation Ownership

### Member 1 --- Problem + Gemini

Explain:

-   accessibility/language problem
-   Gemini prescription understanding
-   structured extraction
-   confirmation
-   responsible AI safeguards

### Member 2 --- Vision demo

Demonstrate:

-   camera/label scan
-   correct label
-   wrong medication
-   missing strength if time permits
-   deterministic verification

### Member 3 --- Product + Google stack

Demonstrate/explain:

-   UI
-   language
-   voice/accessibility
-   Firestore
-   Cloud Run
-   final user journey

Everyone must understand the complete architecture, not only their own
module.

------------------------------------------------------------------------

## 22. Definition of Project Done

The project is submission-ready when:

-   [ ] App launches reliably.
-   [ ] Gemini performs real prescription extraction.
-   [ ] Missing dosage/strength is not invented.
-   [ ] User can review/confirm extraction.
-   [ ] Confirmed medication reaches dashboard.
-   [ ] Camera/image label extraction works.
-   [ ] Correct label produces `MATCH`.
-   [ ] Wrong medication produces `MEDICINE_MISMATCH`.
-   [ ] Wrong strength produces `STRENGTH_MISMATCH`.
-   [ ] Missing strength produces `REVIEW_REQUIRED`.
-   [ ] UI clearly communicates all states.
-   [ ] At least one additional Google developer/Cloud technology is
    genuinely used.
-   [ ] README accurately identifies actual Gemini/Google integrations.
-   [ ] Secrets are absent from repository.
-   [ ] Demo data is marked as demo data.
-   [ ] Deployment or local demo is stable.
-   [ ] Team has rehearsed the demo.
-   [ ] Submission is completed before the deadline.

------------------------------------------------------------------------

## 23. Rule for Coding Agents

Before modifying the repository, every coding agent must:

1.  Read this entire `AGENTS.md`.
2.  Identify which ownership area the requested task belongs to.
3.  Preserve the shared API/data contracts.
4.  Prefer existing project conventions over introducing new frameworks.
5.  Avoid unrelated refactors during hackathon hours.
6.  Keep changes small and testable.
7.  Never weaken medication-safety behavior.
8.  Never insert fake "working" AI responses into production paths
    without clearly marking them as mocks.
9.  Update documentation when an actual architecture/API decision
    changes.
10. Report blockers explicitly instead of guessing.

If two instructions conflict, prioritize:

``` text
Safety
  >
Shared contracts
  >
Working demo
  >
Track requirements
  >
Accessibility
  >
Polish
  >
Bonus features
```

------------------------------------------------------------------------

## 24. Quick Context for a New Agent

If you are an agent joining this repository with no prior context:

**Project:** MedGuide Vision\
**Goal:** Accessible multilingual prescription understanding +
medication-label verification.\
**AI:** Gemini multimodal.\
**Google services:** Firestore + Cloud Run planned/used as implemented.\
**Backend:** Python/Flask-style API in the current starter.\
**Frontend:** Existing repository frontend; preserve its framework.\
**Core rule:** Never invent medication information.\
**Verification:** deterministic after Gemini extraction.\
**Team:** three parallel workstreams.\
**Priority:** working integrated demo before additional features.

Start by inspecting the existing repository and your assigned module. Do
not redesign the whole application unless the team explicitly agrees.

------------------------------------------------------------------------

# One-Sentence North Star

> **Build the smallest reliable demo that proves Gemini can make
> existing prescription information easier to understand and verify
> without ever becoming the prescriber.**


# AGENTS.md

## Frontend Design Guidelines

When creating or modifying frontend UI, prioritize distinctive, polished,
production-quality design rather than generic AI-generated aesthetics.

### Typography
- Choose typography that gives the product a distinct identity.
- Avoid automatically defaulting to generic fonts such as Arial, Roboto,
  Inter, or system fonts unless they are already part of the project's
  design system.
- Maintain clear hierarchy between headings, body text, labels, and metadata.

### Color
- Use a cohesive visual direction.
- Define reusable colors with CSS variables or the project's existing
  design-token system.
- Use accent colors intentionally.
- Avoid generic purple-gradient-on-white "AI SaaS" aesthetics.

### Layout
- Create deliberate visual hierarchy.
- Use spacing intentionally.
- Avoid making every section a floating rounded card.
- Don't default to predictable dashboard/component arrangements when a
  stronger composition would work.

### Backgrounds and Depth
- Avoid flat, empty-looking interfaces when depth would improve the design.
- Consider subtle gradients, patterns, borders, shadows, textures, and
  layered elements where appropriate.
- Effects should support the product's visual identity rather than being
  decorative noise.

### Motion
- Use motion intentionally.
- Prefer a few polished transitions or interactions over excessive animation.
- Use the project's existing animation tools when available.
- Do not add animation libraries unless necessary.

### Avoid Generic AI Aesthetics
Avoid:
- excessive rounded cards
- excessive pills
- unnecessary glassmorphism
- purple gradients by default
- repetitive card grids
- generic hero sections
- random gradients
- excessive glow effects
- visually interchangeable SaaS designs

The interface should feel designed specifically for this product.

## Working With Existing UI

Before making visual changes:

1. Inspect the existing application and design system.
2. Identify reusable components, tokens, and styling conventions.
3. Preserve existing functionality.
4. Preserve responsive behavior.
5. Reuse existing components where appropriate.
6. Do not introduce dependencies unless necessary.
7. Do not rewrite unrelated code purely for aesthetics.
8. Make changes consistent across the application rather than adding
   isolated one-off styles.