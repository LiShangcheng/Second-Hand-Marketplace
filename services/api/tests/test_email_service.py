from email.message import EmailMessage

import pytest

from services.api.email_service import EmailSender


def test_memory_email_sender_captures_verification_code():
    sender = EmailSender("memory")
    sender.send_verification_code("student@nyu.edu", "123456", 10)

    assert sender.outbox == [
        {
            "to": "student@nyu.edu",
            "subject": "Verify your NYU Swap Hub email",
            "body": (
                "Your NYU Swap Hub verification code is 123456.\n\n"
                "It expires in 10 minutes. If you did not request this code, you can ignore this email."
            ),
            "code": "123456",
        }
    ]


def test_console_email_sender_prints_code(capsys):
    sender = EmailSender("console")
    sender.send_verification_code("student@nyu.edu", "234567", 10)

    output = capsys.readouterr().out
    assert "student@nyu.edu" in output
    assert "234567" in output


def test_email_sender_rejects_unknown_mode():
    sender = EmailSender("unknown")
    with pytest.raises(RuntimeError, match="Unsupported MAIL_MODE"):
        sender.send_verification_code("student@nyu.edu", "345678", 10)


def test_smtp_email_sender(monkeypatch):
    events = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            events.append(("connect", host, port, timeout))

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            events.append(("close",))

        def starttls(self):
            events.append(("starttls",))

        def login(self, username, password):
            events.append(("login", username, password))

        def send_message(self, message: EmailMessage):
            events.append(("send", message["To"], message["From"], message.get_content()))

    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "2525")
    monkeypatch.setenv("SMTP_USERNAME", "mailer")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setenv("SMTP_FROM", "no-reply@example.com")
    monkeypatch.setenv("SMTP_USE_TLS", "1")
    monkeypatch.setattr("services.api.email_service.smtplib.SMTP", FakeSMTP)

    sender = EmailSender("smtp")
    sender.send_verification_code("student@nyu.edu", "456789", 5)

    assert ("connect", "smtp.example.com", 2525, 10) in events
    assert ("starttls",) in events
    assert ("login", "mailer", "secret") in events
    assert any(event[0] == "send" and event[1] == "student@nyu.edu" for event in events)
    assert sender.outbox == []


def test_smtp_email_sender_requires_configuration(monkeypatch):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_FROM", raising=False)
    monkeypatch.delenv("SMTP_USERNAME", raising=False)

    with pytest.raises(RuntimeError, match="SMTP_HOST and SMTP_FROM"):
        EmailSender("smtp").send_verification_code("student@nyu.edu", "567890", 10)
