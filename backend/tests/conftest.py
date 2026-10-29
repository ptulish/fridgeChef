import os
import pytest

# Ensure tests run against an isolated test SQLite database and mock AI provider
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_fridgechef.db"
os.environ["APP_ENV"] = "test"
os.environ["APP_DEBUG"] = "true"

from app.core.config import settings
settings.DATABASE_URL = "sqlite+aiosqlite:///./test_fridgechef.db"

# Re-initialize test db models and seeds before test session
from app.infrastructure.db.session import engine
from app.infrastructure.db.init_db import init_models, seed_data, sync_staples_and_zones

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    import asyncio
    async def init():
        await init_models()
        await seed_data()
        await sync_staples_and_zones()
    asyncio.run(init())
    yield
    # Cleanup test db file after tests
    if os.path.exists("./test_fridgechef.db"):
        try:
            os.remove("./test_fridgechef.db")
        except Exception:
            pass
