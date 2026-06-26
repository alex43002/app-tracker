import sys

from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Obvious placeholder secrets that must never be used to sign real tokens.
_WEAK_SECRETS = {
    "secret",
    "changeme",
    "change-me",
    "your-secret-key",
    "jwt-secret",
}
_MIN_SECRET_LENGTH = 16


class Settings(BaseSettings):
    # MongoDB
    mongodb_uri: str
    mongodb_db_name: str = "jobtracker"

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 2  # access-token lifetime
    refresh_token_expiry_days: int = 7  # refresh-token lifetime

    @field_validator("jwt_secret")
    @classmethod
    def _validate_jwt_secret(cls, value: str) -> str:
        if value.strip().lower() in _WEAK_SECRETS:
            raise ValueError("JWT_SECRET is a known weak/placeholder value")
        if len(value) < _MIN_SECRET_LENGTH:
            raise ValueError(
                f"JWT_SECRET must be at least {_MIN_SECRET_LENGTH} characters"
            )
        return value

    # CORS — comma-separated list of allowed origins for the desktop client.
    # Defaults to the Vite dev server; tighten/extend per environment.
    cors_allow_origins: str = "http://localhost:5173"

    # Rate limit applied to authentication endpoints (login/register).
    auth_rate_limit: str = "5/minute"

    # Alert delivery (background scheduler).
    alerts_enabled: bool = True
    alerts_poll_seconds: int = 60

    # Optional SMTP provider for email alerts. When unset, alerts are logged
    # via the console notifier instead of actually being sent.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "no-reply@careerlog.app"

    # Optional Twilio provider for SMS alerts. When unset, `sms` alerts are
    # logged via the console notifier instead of actually being sent.
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from: str | None = None  # sender phone number, e.g. +15551234567

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]


# Human-readable hints for the required settings, keyed by field name. Used to
# turn a pydantic ValidationError into actionable startup guidance.
_FIELD_HINTS = {
    "mongodb_uri": "MongoDB connection string, e.g. mongodb://localhost:27017",
    "jwt_secret": f"random secret of at least {_MIN_SECRET_LENGTH} characters used to sign auth tokens",
}


def _format_config_error(exc: ValidationError) -> str:
    """Render a ValidationError as a short, friendly checklist of what to fix."""
    lines = [
        "Configuration error: the backend can't start because some required",
        "environment variables are missing or invalid.",
        "",
        "Please set the following in a .env file (see README \"Environment Variables\"):",
        "",
    ]
    for err in exc.errors():
        field = str(err["loc"][0]) if err.get("loc") else "(unknown)"
        env_name = field.upper()
        if err.get("type") == "missing":
            reason = "required but not set"
        else:
            reason = err.get("msg", "invalid value")
        hint = _FIELD_HINTS.get(field)
        line = f"  - {env_name}: {reason}"
        if hint:
            line += f"\n      ({hint})"
        lines.append(line)
    return "\n".join(lines)


def load_settings() -> "Settings":
    try:
        return Settings()
    except ValidationError as exc:
        print(_format_config_error(exc), file=sys.stderr)
        raise SystemExit(1) from None


settings = load_settings()
