import os, json, re, base64, secrets, sqlite3, uuid
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta, timezone
from functools import wraps
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from apscheduler.jobstores.base import JobLookupError
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, render_template, request, jsonify, session
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(32)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "").lower() == "true",
)

def database_path():
    return app.config.get("DATABASE_PATH") or os.getenv(
        "DATABASE_PATH", str(Path(app.instance_path) / "medguide.sqlite3")
    )

@contextmanager
def connect_db():
    path = Path(database_path())
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

def initialize_database():
    with connect_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                medication_json TEXT
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS followup_reminders (
                user_id TEXT PRIMARY KEY,
                reminder_id TEXT NOT NULL UNIQUE,
                phone_number TEXT NOT NULL,
                scheduled_for TEXT NOT NULL,
                timezone TEXT NOT NULL,
                status TEXT NOT NULL,
                message_sid TEXT,
                message TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        reminder_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(followup_reminders)")
        }
        if "message" not in reminder_columns:
            connection.execute("ALTER TABLE followup_reminders ADD COLUMN message TEXT")

initialize_database()

def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Please sign in to continue."}), 401
        return view(*args, **kwargs)
    return wrapped

def request_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    with connect_db() as connection:
        return connection.execute(
            "SELECT id, email, medication_json FROM users WHERE id = ?", (user_id,)
        ).fetchone()

def twilio_configured():
    return all(os.getenv(name) for name in (
        "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"
    ))

def build_reminder_message(medication):
    follow_up = medication.get("follow_up")
    notes = medication.get("instructions")
    note_text = f"Prescription notes: {notes}" if notes else "No written prescription instructions were saved."
    return (
        f"MedGuide Vision follow-up reminder: Your prescription lists a follow-up for {follow_up}. "
        f"{note_text} For questions, contact your pharmacist or clinician. "
        "Reply STOP to opt out. DEMO / NOT FOR MEDICAL USE."
    )

def deliver_sms(phone_number, message):
    from twilio.rest import Client
    client = Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
    return client.messages.create(
        body=message,
        from_=os.environ["TWILIO_FROM_NUMBER"],
        to=phone_number,
    )

def send_followup_reminder(reminder_id):
    with connect_db() as connection:
        reminder = connection.execute(
            """SELECT r.*, u.medication_json
               FROM followup_reminders r
               JOIN users u ON u.id = r.user_id
               WHERE r.reminder_id = ? AND r.status = 'scheduled'""",
            (reminder_id,),
        ).fetchone()
        if not reminder:
            return
        claimed = connection.execute(
            """UPDATE followup_reminders SET status = 'sending'
               WHERE reminder_id = ? AND status = 'scheduled'""",
            (reminder_id,),
        ).rowcount
    if not claimed:
        return

    try:
        medication = json.loads(reminder["medication_json"] or "{}")
        result = deliver_sms(reminder["phone_number"], build_reminder_message(medication))
        with connect_db() as connection:
            connection.execute(
                """UPDATE followup_reminders SET status = 'sent', message_sid = ?, phone_number = ''
                   WHERE reminder_id = ? AND status = 'sending'""",
                (getattr(result, "sid", None), reminder_id),
            )
    except Exception:
        with connect_db() as connection:
            connection.execute(
                """UPDATE followup_reminders SET status = 'failed', phone_number = '',
                   message = 'SMS delivery failed. Check Twilio configuration and logs.'
                   WHERE reminder_id = ? AND status = 'sending'""",
                (reminder_id,),
            )
        app.logger.exception("Follow-up SMS delivery failed; check Twilio configuration.")

def save_reminder_status(user_id, status, message, scheduled_for=None, timezone_name=None):
    reminder_id = str(uuid.uuid4())
    with connect_db() as connection:
        connection.execute(
            """INSERT INTO followup_reminders
               (user_id, reminder_id, phone_number, scheduled_for, timezone, status, message)
               VALUES (?, ?, '', ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                   reminder_id = excluded.reminder_id,
                   phone_number = '',
                   scheduled_for = excluded.scheduled_for,
                   timezone = excluded.timezone,
                   status = excluded.status,
                   message_sid = NULL,
                   message = excluded.message""",
            (
                user_id,
                reminder_id,
                scheduled_for.isoformat() if scheduled_for else "",
                timezone_name or "",
                status,
                message,
            ),
        )

def schedule_reminder(reminder_id, scheduled_for):
    scheduler.add_job(
        send_followup_reminder,
        trigger="date",
        run_date=scheduled_for,
        args=[reminder_id],
        id=reminder_id,
        replace_existing=True,
        misfire_grace_time=24 * 60 * 60,
    )

def restore_pending_reminders():
    with connect_db() as connection:
        reminders = connection.execute(
            "SELECT reminder_id, scheduled_for FROM followup_reminders WHERE status = 'scheduled'"
        ).fetchall()
        for reminder in reminders:
            scheduled_for = datetime.fromisoformat(reminder["scheduled_for"])
            if scheduled_for < datetime.now(timezone.utc) - timedelta(days=1):
                connection.execute(
                    """UPDATE followup_reminders SET status = 'missed'
                       WHERE reminder_id = ? AND status = 'scheduled'""",
                    (reminder["reminder_id"],),
                )
                continue
            schedule_reminder(reminder["reminder_id"], scheduled_for)

def replace_pending_reminder(user_id, medication, body):
    with connect_db() as connection:
        old = connection.execute(
            "SELECT reminder_id FROM followup_reminders WHERE user_id = ? AND status = 'scheduled'",
            (user_id,),
        ).fetchone()
        connection.execute(
            "DELETE FROM followup_reminders WHERE user_id = ? AND status = 'scheduled'",
            (user_id,),
        )
    if old:
        try:
            scheduler.remove_job(old["reminder_id"])
        except JobLookupError:
            pass

    if body.get("reminder_consent") is not True:
        result = {"status": "not_requested", "message": "No SMS reminder was requested."}
        save_reminder_status(user_id, result["status"], result["message"])
        return result
    if not medication.get("follow_up"):
        result = {"status": "not_scheduled", "message": "Add a follow-up date before requesting a reminder."}
        save_reminder_status(user_id, result["status"], result["message"])
        return result

    try:
        follow_up = date.fromisoformat(medication["follow_up"])
        if follow_up.isoformat() != medication["follow_up"]:
            raise ValueError
        reminder_time = body.get("reminder_time")
        if not isinstance(reminder_time, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", reminder_time):
            raise ValueError
        local_zone = ZoneInfo(body.get("timezone", ""))
        local_run_date = datetime.combine(
            follow_up - timedelta(days=1),
            time.fromisoformat(reminder_time),
            tzinfo=local_zone,
        )
        phone_number = body.get("phone_number", "")
        if not isinstance(phone_number, str) or not re.fullmatch(r"\+[1-9]\d{7,14}", phone_number.strip()):
            raise ValueError("Enter a phone number in international format, such as +14155550123.")
        if len(medication.get("instructions") or "") > 1000:
            raise ValueError("The written instructions are too long for one SMS. Shorten the instructions before requesting a text reminder.")
    except (TypeError, ValueError, OverflowError, ZoneInfoNotFoundError) as error:
        message = str(error)
        if not message.startswith("Enter a phone number") and not message.startswith("The written instructions"):
            message = "Enter a valid follow-up date, reminder time, and local timezone."
        result = {"status": "not_scheduled", "message": message}
        save_reminder_status(user_id, result["status"], message)
        return result

    scheduled_for = local_run_date.astimezone(timezone.utc)
    if scheduled_for <= datetime.now(timezone.utc):
        message = "The selected reminder time has passed. Choose a future follow-up date to schedule an SMS."
        result = {"status": "too_late", "message": message}
        save_reminder_status(user_id, result["status"], message, scheduled_for, local_zone.key)
        return result
    if not twilio_configured():
        message = "SMS reminder not scheduled. Twilio credentials are not configured."
        result = {"status": "not_configured", "message": message}
        save_reminder_status(user_id, result["status"], message)
        return result

    reminder_id = str(uuid.uuid4())
    with connect_db() as connection:
        connection.execute(
            """INSERT INTO followup_reminders
               (user_id, reminder_id, phone_number, scheduled_for, timezone, status)
               VALUES (?, ?, ?, ?, ?, 'scheduled')
               ON CONFLICT(user_id) DO UPDATE SET
                   reminder_id = excluded.reminder_id,
                   phone_number = excluded.phone_number,
                   scheduled_for = excluded.scheduled_for,
                   timezone = excluded.timezone,
                   status = excluded.status,
                   message_sid = NULL,
                   message = excluded.message""",
            (
                user_id,
                reminder_id,
                phone_number.strip(),
                scheduled_for.isoformat(),
                local_zone.key,
            ),
        )
    try:
        schedule_reminder(reminder_id, scheduled_for)
    except Exception:
        with connect_db() as connection:
            connection.execute(
                """UPDATE followup_reminders SET status = 'failed', phone_number = '',
                   message = 'The SMS reminder could not be scheduled.'
                   WHERE reminder_id = ?""",
                (reminder_id,),
            )
        app.logger.exception("Follow-up SMS could not be scheduled.")
        return {"status": "failed", "message": "The prescription was saved, but the SMS reminder could not be scheduled."}

    return {
        "status": "scheduled",
        "scheduled_for": scheduled_for.isoformat(),
        "timezone": local_zone.key,
        "message": "SMS reminder scheduled for one day before the follow-up.",
    }

def current_reminder(user_id):
    with connect_db() as connection:
        reminder = connection.execute(
            """SELECT status, scheduled_for, timezone, message FROM followup_reminders
               WHERE user_id = ?""",
            (user_id,),
        ).fetchone()
    return dict(reminder) if reminder else {"status": "not_requested"}

scheduler = BackgroundScheduler(timezone="UTC", daemon=True)
scheduler.start()
restore_pending_reminders()

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
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
    try:
        from google import genai
        client = genai.Client(api_key=key)
        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
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
    return jsonify({
        "ok": True,
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "sms_configured": twilio_configured(),
    })

@app.post("/api/auth/register")
def register():
    body = request.get_json(silent=True) or {}
    raw_email, password = body.get("email"), body.get("password")
    if not isinstance(raw_email, str) or not isinstance(password, str):
        return jsonify({"error": "Enter an email address and password."}), 400
    email = raw_email.strip().lower()
    if len(email) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({"error": "Enter a valid email address."}), 400
    if len(password) < 8 or len(password) > 1024:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    user_id = str(uuid.uuid4())
    try:
        with connect_db() as connection:
            connection.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
                (user_id, email, generate_password_hash(password)),
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": "An account with that email already exists. Sign in instead."}), 409

    session.clear()
    session["user_id"] = user_id
    return jsonify({"email": email}), 201

@app.post("/api/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    raw_email, password = body.get("email"), body.get("password")
    if not isinstance(raw_email, str) or not isinstance(password, str):
        return jsonify({"error": "Email or password is incorrect."}), 401
    email = raw_email.strip().lower()
    with connect_db() as connection:
        user = connection.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Email or password is incorrect."}), 401

    session.clear()
    session["user_id"] = user["id"]
    return jsonify({"email": user["email"]})

@app.get("/api/auth/me")
def auth_me():
    user = request_user()
    if not user:
        session.clear()
        return jsonify({"error": "Please sign in to continue."}), 401
    return jsonify({"email": user["email"]})

@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})

@app.get("/api/medications/current")
@login_required
def current():
    user = request_user()
    if not user:
        session.clear()
        return jsonify({"error": "Please sign in to continue."}), 401
    medication = json.loads(user["medication_json"]) if user["medication_json"] else None
    return jsonify({"medication": medication, "reminder": current_reminder(user["id"])})

@app.get("/api/followups")
@login_required
def followups():
    user = request_user()
    if not user:
        session.clear()
        return jsonify({"error": "Please sign in to continue."}), 401
    return jsonify({"reminder": current_reminder(user["id"])})

@app.post("/api/prescription/analyze")
@login_required
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
@login_required
def confirm():
    user = request_user()
    if not user:
        session.clear()
        return jsonify({"error": "Please sign in to continue."}), 401
    body = request.get_json(force=True)
    medication = {
        "id": body.get("id", "med001"),
        "name": body.get("name"),
        "strength": body.get("strength"),
        "quantity": body.get("quantity"),
        "instructions": body.get("instructions"),
        "times": body.get("times") or [],
        "follow_up": body.get("follow_up") or None,
        "language": body.get("language", "en"),
        "confirmed": True
    }
    with connect_db() as connection:
        connection.execute(
            "UPDATE users SET medication_json = ? WHERE id = ?",
            (json.dumps(medication), user["id"]),
        )
    reminder = replace_pending_reminder(user["id"], medication, body)
    try:
        if os.getenv("USE_FIRESTORE","").lower() == "true":
            from google.cloud import firestore
            firestore.Client().collection("medications").document(user["id"]).set(medication)
    except Exception as e:
        app.logger.warning("Firestore fallback: %s", e)
    return jsonify({"medication": medication, "reminder": reminder})

@app.post("/api/label/analyze")
@login_required
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
@login_required
def verify_api():
    body = request.get_json(force=True)
    user = request_user()
    if not user:
        session.clear()
        return jsonify({"error": "Please sign in to continue."}), 401
    expected = body.get("expected")
    if expected is None and user["medication_json"]:
        expected = json.loads(user["medication_json"])
    return jsonify(verify(expected or {}, body.get("detected") or {}))

@app.post("/api/translate")
@login_required
def translate():
    user = request_user()
    if not user:
        session.clear()
        return jsonify({"error": "Please sign in to continue."}), 401
    body = request.get_json(force=True)
    language = body.get("language","English")
    med = body.get("medication")
    if med is None and user["medication_json"]:
        med = json.loads(user["medication_json"])
    if not med:
        return jsonify({"error": "Confirm a prescription before requesting an explanation."}), 400
    instruction = f"""Explain the confirmed prescription instructions in {language}, simply and accessibly.
Do not add, remove, reinterpret, recommend, or change medicine names, strengths, numbers, units,
frequency, or timing. Return JSON with one key named explanation."""
    try:
        return jsonify(gemini_generate([json.dumps(med)], instruction))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT","5000")), debug=os.getenv("FLASK_DEBUG")=="1")
