import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

import app as app_module
from app import app, connect_db, initialize_database


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        app.config.update(
            TESTING=True,
            DATABASE_PATH=str(Path(self.temp_dir.name) / "test.sqlite3"),
        )
        initialize_database()
        self.client = app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def register(self, email="person@example.com", password="correct-horse"):
        return self.client.post(
            "/api/auth/register",
            json={"email": email, "password": password},
        )

    def test_registration_creates_a_hashed_account_and_starts_a_session(self):
        response = self.register()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["email"], "person@example.com")
        self.assertEqual(self.client.get("/api/auth/me").status_code, 200)
        with connect_db() as connection:
            stored_password = connection.execute(
                "SELECT password_hash FROM users WHERE email = ?",
                ("person@example.com",),
            ).fetchone()["password_hash"]
        self.assertNotEqual(stored_password, "correct-horse")

    def test_duplicate_email_and_short_password_are_rejected(self):
        self.assertEqual(self.register().status_code, 201)
        duplicate = self.register(email="PERSON@example.com")
        short_password = self.register(email="other@example.com", password="short")

        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(short_password.status_code, 400)

    def test_login_and_logout(self):
        self.register()
        self.client.post("/api/auth/logout")

        invalid = self.client.post(
            "/api/auth/login",
            json={"email": "person@example.com", "password": "incorrect-password"},
        )
        valid = self.client.post(
            "/api/auth/login",
            json={"email": "PERSON@example.com", "password": "correct-horse"},
        )
        self.assertEqual(invalid.status_code, 401)
        self.assertEqual(valid.status_code, 200)
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_prescription_api_requires_authentication(self):
        response = self.client.post(
            "/api/prescription/confirm",
            json={"name": "Metformin", "strength": "500 mg"},
        )

        self.assertEqual(response.status_code, 401)

    def test_confirmed_prescription_is_scoped_to_each_account(self):
        self.register()
        first = self.client.post(
            "/api/prescription/confirm",
            json={"name": "Metformin", "strength": "500 mg", "times": []},
        )
        first_id = first.json["medication"]["id"]
        first_medication = self.client.get("/api/medications/current").json["medication"]

        self.client.post("/api/auth/logout")
        self.register(email="another@example.com")
        second_medication = self.client.get("/api/medications/current").json["medication"]

        self.assertEqual(first.status_code, 200)
        self.assertEqual(first_id, "med001")
        self.assertIsNone(second_medication)
        self.assertEqual(first_medication["name"], "Metformin")

    def test_followup_sms_requires_consent_and_twilio_configuration(self):
        self.register()
        response = self.client.post(
            "/api/prescription/confirm",
            json={
                "name": "Metformin",
                "strength": "500 mg",
                "instructions": "Take with food",
                "follow_up": "2027-10-20",
                "times": [],
                "reminder_consent": True,
                "phone_number": "+14155550123",
                "reminder_time": "09:00",
                "timezone": "America/Los_Angeles",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["reminder"]["status"], "not_configured")
        with connect_db() as connection:
            reminder = connection.execute(
                "SELECT status, phone_number FROM followup_reminders"
            ).fetchone()
        self.assertEqual(reminder["status"], "not_configured")
        self.assertEqual(reminder["phone_number"], "")
        self.assertEqual(
            self.client.get("/api/followups").json["reminder"]["status"],
            "not_configured",
        )

    def test_followup_sms_is_scheduled_one_day_before_in_user_timezone(self):
        self.register()
        with patch.dict(
            "os.environ",
            {
                "TWILIO_ACCOUNT_SID": "ACdemo",
                "TWILIO_AUTH_TOKEN": "demo-token",
                "TWILIO_FROM_NUMBER": "+14155550000",
            },
        ), patch("app.schedule_reminder") as schedule:
            response = self.client.post(
                "/api/prescription/confirm",
                json={
                    "name": "Metformin",
                    "strength": "500 mg",
                    "instructions": "Take with food",
                    "follow_up": "2027-10-20",
                    "times": [],
                    "reminder_consent": True,
                    "phone_number": "+14155550123",
                    "reminder_time": "09:00",
                    "timezone": "America/Los_Angeles",
                },
            )

        self.assertEqual(response.json["reminder"]["status"], "scheduled")
        schedule.assert_called_once()
        reminder_id, scheduled_for = schedule.call_args.args
        self.assertEqual(scheduled_for.isoformat(), "2027-10-19T16:00:00+00:00")
        with connect_db() as connection:
            reminder = connection.execute(
                "SELECT * FROM followup_reminders WHERE reminder_id = ?",
                (reminder_id,),
            ).fetchone()
        self.assertEqual(reminder["phone_number"], "+14155550123")
        self.assertEqual(reminder["status"], "scheduled")
        self.assertNotIn("phone_number", response.json["medication"])
        followups = self.client.get("/api/followups")
        self.assertEqual(followups.json["reminder"]["status"], "scheduled")
        self.assertNotIn("phone_number", followups.json["reminder"])

    def test_sms_contains_prescription_notes_and_delivery_is_idempotent(self):
        self.register()
        self.client.post(
            "/api/prescription/confirm",
            json={
                "name": "Metformin",
                "strength": "500 mg",
                "instructions": "Take with food",
                "follow_up": "2027-10-20",
                "times": [],
            },
        )
        message = app_module.build_reminder_message(
            {"follow_up": "2027-10-20", "instructions": "Take with food"}
        )
        self.assertIn("follow-up for 2027-10-20", message)
        self.assertIn("Prescription notes: Take with food", message)
        self.assertIn("Reply STOP to opt out", message)
        self.assertIn("DEMO / NOT FOR MEDICAL USE", message)

        with connect_db() as connection:
            user_id = connection.execute(
                "SELECT id FROM users WHERE email = ?",
                ("person@example.com",),
            ).fetchone()["id"]
            connection.execute(
                """UPDATE followup_reminders
                   SET reminder_id = ?, phone_number = ?, scheduled_for = ?, timezone = ?, status = 'scheduled'
                   WHERE user_id = ?""",
                ("reminder-id", "+14155550123", "2027-10-19T16:00:00+00:00", "UTC", user_id),
            )

        sms_result = type("SmsResult", (), {"sid": "SMtest"})()
        with patch("app.deliver_sms", return_value=sms_result) as deliver:
            app_module.send_followup_reminder("reminder-id")
            app_module.send_followup_reminder("reminder-id")

        deliver.assert_called_once()
        self.assertIn("Prescription notes: Take with food", deliver.call_args.args[1])
        with connect_db() as connection:
            status = connection.execute(
                "SELECT status FROM followup_reminders WHERE reminder_id = ?",
                ("reminder-id",),
            ).fetchone()["status"]
        self.assertEqual(status, "sent")

    def test_manual_label_comparison_uses_deterministic_statuses(self):
        self.register()
        self.client.post(
            "/api/prescription/confirm",
            json={"name": "Metformin", "strength": "500 mg", "times": []},
        )
        cases = [
            ({"name": "Metformin", "strength": "500 mg"}, "MATCH"),
            ({"name": "Lisinopril", "strength": "10 mg"}, "MEDICINE_MISMATCH"),
            ({"name": "Metformin", "strength": "1000 mg"}, "STRENGTH_MISMATCH"),
            ({"name": "Metformin", "strength": None}, "REVIEW_REQUIRED"),
            ({"name": None, "strength": None}, "UNREADABLE"),
        ]

        for detected, expected_status in cases:
            with self.subTest(detected=detected):
                response = self.client.post(
                    "/api/verify",
                    json={"detected": detected},
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json["status"], expected_status)


if __name__ == "__main__":
    unittest.main()
