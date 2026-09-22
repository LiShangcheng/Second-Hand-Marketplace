import os
import smtplib
from email.message import EmailMessage
from typing import Dict, List, Optional


class EmailSender:
    """Send verification emails through SMTP or capture them for local tests."""

    def __init__(self, mode: Optional[str] = None):
        self.mode = (mode or os.getenv("MAIL_MODE", "console")).lower()
        self.outbox: List[Dict[str, str]] = []

    def send_verification_code(self, recipient: str, code: str, expires_minutes: int) -> None:
        subject = "Verify your NYU Swap Hub email"
        body = (
            f"Your NYU Swap Hub verification code is {code}.\n\n"
            f"It expires in {expires_minutes} minutes. If you did not request this code, "
            "you can ignore this email."
        )
        message = {
            "to": recipient,
            "subject": subject,
            "body": body,
            "code": code,
        }
        if self.mode == "memory":
            self.outbox.append(message)
            return
        if self.mode == "console":
            self.outbox.append(message)
            print(f"[email-verification] to={recipient} code={code}", flush=True)
            return
        if self.mode != "smtp":
            raise RuntimeError(f"Unsupported MAIL_MODE: {self.mode}")

        host = os.getenv("SMTP_HOST", "").strip()
        port = int(os.getenv("SMTP_PORT", "587"))
        username = os.getenv("SMTP_USERNAME", "").strip()
        password = os.getenv("SMTP_PASSWORD", "")
        sender = os.getenv("SMTP_FROM", username).strip()
        use_tls = os.getenv("SMTP_USE_TLS", "1") == "1"
        if not host or not sender:
            raise RuntimeError("SMTP_HOST and SMTP_FROM are required when MAIL_MODE=smtp")

        email = EmailMessage()
        email["Subject"] = subject
        email["From"] = sender
        email["To"] = recipient
        email.set_content(body)

        with smtplib.SMTP(host, port, timeout=10) as client:
            if use_tls:
                client.starttls()
            if username:
                client.login(username, password)
            client.send_message(email)
