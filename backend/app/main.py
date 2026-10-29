from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.infrastructure.db.init_db import (
    init_models,
    seed_data,
    clean_brands_in_db,
    ensure_popular_catalog_in_db,
    sync_staples_and_zones,
)
from app.presentation.http.api_v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables, baseline seed data, brand cleanup, catalog and staples/zones exist
    await init_models()
    await seed_data()
    await clean_brands_in_db()
    await ensure_popular_catalog_in_db()
    await sync_staples_and_zones()
    yield


app = FastAPI(
    title="FridgeChef API",
    description="Smart Pantry & Personal Recipe Studio with Clean Architecture and Taste Profile Evolution",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: if wildcard origin is present, credentials must be False per browser CORS spec
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
is_wildcard = "*" in origins or origins == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else origins,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health():
    return {
        "status": "healthy",
        "app": "FridgeChef",
        "env": settings.APP_ENV,
        "database": "connected",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.APP_DEBUG)
