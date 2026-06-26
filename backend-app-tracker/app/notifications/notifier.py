"""Pluggable alert notifiers (FEAT-5).

A `Notifier` knows how to deliver a message over a channel (`email` / `sms`).
The default `ConsoleNotifier` just logs — no external credentials required — so
alert delivery works out of the box in dev/CI. `SmtpEmailNotifier` sends real
email via stdlib `smtplib` when SMTP settings are configured; SMS providers
(e.g. Twilio) can be added behind the same interface.
"""

import logging
import smtplib
import time
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from base64 import b64encode
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


class TwilioSmsNotifier(Notifier):
    """Sends `sms` alerts via the Twilio REST API; logs other channels.

    Uses the stdlib HTTP client (no extra dependency). The actual POST is done
    through ``transport`` so it can be swapped out in tests.
    """

    API_ROOT = "https://api.twilio.com/2010-04-01"

    def __init__(self, account_sid, auth_token, sender, fallback=None, transport=None):
        self._account_sid = account_sid
        self._auth_token = auth_token
        self._sender = sender
        self._fallback = fallback or ConsoleNotifier()
        self._transport = transport or self._post

    def send(self, channel: str, recipient: str | None, message: str) -> None:
        if channel != SMS or not recipient:
            self._fallback.send(channel, recipient, message)
            return

        url = f"{self.API_ROOT}/Accounts/{self._account_sid}/Messages.json"
        payload = {"To": recipient, "From": self._sender, "Body": message}
        self._transport(url, payload)

    def _post(self, url: str, payload: dict) -> None:
        data = urllib.parse.urlencode(payload).encode("utf-8")
        token = b64encode(
            f"{self._account_sid}:{self._auth_token}".encode("utf-8")
        ).decode("ascii")
        request = urllib.request.Request(
            url,
            data=data,
            headers={
                "Authorization": f"Basic {token}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()


class RoutingNotifier(Notifier):
    """Dispatches each channel to its own notifier, with a shared fallback."""

    def __init__(self, routes: dict[str, Notifier], fallback=None):
        self._routes = routes
        self._fallback = fallback or ConsoleNotifier()

    def send(self, channel: str, recipient: str | None, message: str) -> None:
        self._routes.get(channel, self._fallback).send(channel, recipient, message)


class RetryingNotifier(Notifier):
    """Wraps a notifier with bounded retries + exponential backoff (CLN-12).

    Transient delivery failures (a flaky SMTP/Twilio call) are retried a few
    times with growing backoff. If every attempt fails the message is logged as
    a **dead letter** and the failure is swallowed — a user-visible drop (a
    password-reset or verification email) is at least observable in the logs,
    and request-time delivery never turns a provider outage into a 500. The
    delay is taken via ``sleep`` so tests can run without really waiting.
    """

    def __init__(self, inner, *, max_attempts=3, backoff_seconds=0.5, sleep=time.sleep):
        self._inner = inner
        self._max_attempts = max(1, max_attempts)
        self._backoff = backoff_seconds
        self._sleep = sleep

    def send(self, channel: str, recipient: str | None, message: str) -> None:
        last_exc: Exception | None = None
        for attempt in range(1, self._max_attempts + 1):
            try:
                self._inner.send(channel, recipient, message)
                return
            except Exception as exc:  # noqa: BLE001 — retry any delivery error
                last_exc = exc
                logger.warning(
                    "ALERT delivery attempt %d/%d failed [%s -> %s]: %s",
                    attempt,
                    self._max_attempts,
                    channel,
                    recipient,
                    exc,
                )
                if attempt < self._max_attempts:
                    self._sleep(self._backoff * (2 ** (attempt - 1)))

        logger.error(
            "ALERT DEAD-LETTER [%s -> %s]: %s | last error: %s",
            channel,
            recipient,
            message,
            last_exc,
        )


def build_notifier(settings) -> Notifier:
    """Choose a notifier from configuration.

    Email (SMTP) and SMS (Twilio) are configured independently; when both are
    set, a ``RoutingNotifier`` sends each channel through its own provider.
    Channels without a configured provider fall back to the console notifier.
    """
    console = ConsoleNotifier()

    def with_retries(notifier: Notifier) -> Notifier:
        # Wrap real (network) providers so transient failures retry and a final
        # failure dead-letters instead of dropping silently (CLN-12).
        attempts = getattr(settings, "notifier_max_attempts", 1)
        if attempts <= 1:
            return notifier
        return RetryingNotifier(
            notifier,
            max_attempts=attempts,
            backoff_seconds=getattr(settings, "notifier_retry_backoff_seconds", 0.5),
        )

    routes: dict[str, Notifier] = {}

    if settings.smtp_host:
        routes[EMAIL] = with_retries(
            SmtpEmailNotifier(
                host=settings.smtp_host,
                port=settings.smtp_port,
                user=settings.smtp_user,
                password=settings.smtp_password,
                sender=settings.smtp_from,
                fallback=console,
            )
        )

    if settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from:
        routes[SMS] = with_retries(
            TwilioSmsNotifier(
                account_sid=settings.twilio_account_sid,
                auth_token=settings.twilio_auth_token,
                sender=settings.twilio_from,
                fallback=console,
            )
        )

    if not routes:
        return console
    return RoutingNotifier(routes, fallback=console)


# A process-wide notifier for request-time delivery (e.g. password-reset and
# verification emails). Built lazily from settings; ``set_notifier`` lets tests
# swap in a collecting/fake notifier.
_notifier: Notifier | None = None


def get_notifier() -> Notifier:
    global _notifier
    if _notifier is None:
        from app.config import settings

        _notifier = build_notifier(settings)
    return _notifier


def set_notifier(notifier: Notifier | None) -> None:
    global _notifier
    _notifier = notifier
