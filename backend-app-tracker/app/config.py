from pydantic import field_validator
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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]


settings = Settings()
