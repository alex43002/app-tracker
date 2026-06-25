"""Pluggable alert notifiers (FEAT-5).

A `Notifier` knows how to deliver a message over a channel (`email` / `sms`).
The default `ConsoleNotifier` just logs — no external credentials required — so
alert delivery works out of the box in dev/CI. `SmtpEmailNotifier` sends real
email via stdlib `smtplib` when SMTP settings are configured; SMS providers
(e.g. Twilio) can be added behind the same interface.
"""

import logging
import smtplib
from abc import ABC, abstractmethod
from email.message import EmailMessage

logger = logging.getLogger("careerlog.alerts")

EMAIL = "email"
SMS = "sms"


class Notifier(ABC):
    @abstractmethod
    def send(self, channel: str, recipient: str | None, message: str) -> None:
        """Deliver ``message`` to ``recipient`` over ``channel``."""


class ConsoleNotifier(Notifier):
    """Logs alerts instead of sending them. Default for dev/CI."""

    def send(self, channel: str, recipient: str | None, message: str) -> None:
        logger.info("ALERT[%s] -> %s: %s", channel, recipient, message)


class SmtpEmailNotifier(Notifier):
    """Sends `email` alerts via SMTP; falls back to logging for other channels."""

    def __init__(self, host, port, user, password, sender, fallback=None):
        self._host = host
        self._port = port
        self._user = user
        self._password = password
        self._sender = sender
        self._fallback = fallback or ConsoleNotifier()

    def send(self, channel: str, recipient: str | None, message: str) -> None:
        if channel != EMAIL or not recipient:
            self._fallback.send(channel, recipient, message)
            return

        msg = EmailMessage()
        msg["From"] = self._sender
        msg["To"] = recipient
        msg["Subject"] = "CareerLog reminder"
        msg.set_content(message)

        with smtplib.SMTP(self._host, self._port) as server:
            server.starttls()
            if self._user:
                server.login(self._user, self._password)
            server.send_message(msg)


def build_notifier(settings) -> Notifier:
    """Choose a notifier from configuration."""
    if settings.smtp_host:
        return SmtpEmailNotifier(
            host=settings.smtp_host,
            port=settings.smtp_port,
            user=settings.smtp_user,
            password=settings.smtp_password,
            sender=settings.smtp_from,
        )
    return ConsoleNotifier()
