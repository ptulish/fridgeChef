from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

# Engine configuration
engine_kwargs = {"echo": False}

# For SQLite, enable check_same_thread=False
if "sqlite" in settings.DATABASE_URL:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif "postgresql" in settings.DATABASE_URL:
    # Disable prepared statement caching for compatibility with PgBouncer / Neon pooled connections
    engine_kwargs["connect_args"] = {"statement_cache_size": 0}
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db_session():
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
