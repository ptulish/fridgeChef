import os
from typing import List, Optional, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Database: fallback to local SQLite for local dev
    DATABASE_URL: str = "sqlite+aiosqlite:///./fridgechef.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, v: Optional[str]) -> str:
        if not v or not str(v).strip():
            return "sqlite+aiosqlite:///./fridgechef.db"
        v_str = str(v).strip()
        # Render / Neon / Supabase compatibility:
        # Standardize postgres:// and postgresql:// to postgresql+asyncpg://
        if v_str.startswith("postgres://"):
            v_str = v_str.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v_str.startswith("postgresql://") and not v_str.startswith("postgresql+"):
            v_str = v_str.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v_str

    # CORS
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            import json
            return json.loads(v)
        return v

    # AI Configuration (Google Gemini)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Default User for single-user dev mode
    DEFAULT_USER_EMAIL: str = "chef@fridgechef.local"
    DEFAULT_USER_NAME: str = "Personal Chef"


settings = Settings()
