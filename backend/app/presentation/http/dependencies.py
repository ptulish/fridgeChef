from typing import Optional
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db.session import get_db_session
from app.infrastructure.db.models.user import UserModel
from app.core.config import settings
from app.core.auth import decode_access_token
from app.infrastructure.db.repositories.pantry_repo import SQLAlchemyPantryRepository
from app.infrastructure.db.repositories.recipe_repo import SQLAlchemyRecipeRepository
from app.infrastructure.db.repositories.cooking_repo import SQLAlchemyCookingRepository
from app.infrastructure.db.repositories.taste_profile_repo import SQLAlchemyTasteProfileRepository
from app.infrastructure.db.repositories.shopping_repo import SQLAlchemyShoppingRepository
from app.infrastructure.ai.gemini_provider import GeminiRecipeAIProvider

ai_provider_instance = GeminiRecipeAIProvider()
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    session: AsyncSession = Depends(get_db_session),
) -> UserModel:
    user_id: Optional[str] = None

    # 1. Bearer Token
    if credentials and credentials.scheme.lower() == "bearer":
        payload = decode_access_token(credentials.credentials)
        if payload and "sub" in payload:
            user_id = payload["sub"]

    # 2. X-User-Id header fallback
    if not user_id and x_user_id:
        user_id = x_user_id

    # 3. Lookup user
    if user_id:
        stmt = select(UserModel).where(UserModel.id == user_id)
        res = await session.execute(stmt)
        user = res.scalars().first()
        if user:
            return user

    # 4. Fallback for test mode
    if settings.APP_ENV == "test":
        stmt_test = select(UserModel).where(UserModel.email == settings.DEFAULT_USER_EMAIL)
        res_test = await session.execute(stmt_test)
        user_test = res_test.scalars().first()
        if not user_test:
            stmt_any = select(UserModel).order_by(UserModel.created_at.asc())
            res_any = await session.execute(stmt_any)
            user_test = res_any.scalars().first()
        if user_test:
            return user_test

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Требуется авторизация",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_pantry_repo(session: AsyncSession = Depends(get_db_session)) -> SQLAlchemyPantryRepository:
    return SQLAlchemyPantryRepository(session)


def get_recipe_repo(session: AsyncSession = Depends(get_db_session)) -> SQLAlchemyRecipeRepository:
    return SQLAlchemyRecipeRepository(session)


def get_cooking_repo(session: AsyncSession = Depends(get_db_session)) -> SQLAlchemyCookingRepository:
    return SQLAlchemyCookingRepository(session)


def get_taste_profile_repo(session: AsyncSession = Depends(get_db_session)) -> SQLAlchemyTasteProfileRepository:
    return SQLAlchemyTasteProfileRepository(session)


def get_shopping_repo(session: AsyncSession = Depends(get_db_session)) -> SQLAlchemyShoppingRepository:
    return SQLAlchemyShoppingRepository(session)


def get_ai_provider() -> GeminiRecipeAIProvider:
    return ai_provider_instance
