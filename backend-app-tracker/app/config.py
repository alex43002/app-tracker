from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # MongoDB
    mongodb_uri: str = Field(..., env="MONGODB_URI")
    mongodb_db_name: str = Field("jobtracker", env="MONGODB_DB_NAME")

    # JWT
    jwt_secret: str = Field(..., env="JWT_SECRET")
    jwt_algorithm: str = Field("HS256", env="JWT_ALGORITHM")
    jwt_expiry_hours: int = Field(2, env="JWT_EXPIRY_HOURS")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
