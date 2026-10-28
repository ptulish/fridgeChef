from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db.session import get_db_session
from app.infrastructure.db.models.user import UserModel
from app.core.config import settings
from app.infrastructure.db.repositories.pantry_repo import SQLAlchemyPantryRepository
from app.infrastructure.db.repositories.recipe_repo import SQLAlchemyRecipeRepository
from app.infrastructure.db.repositories.cooking_repo import SQLAlchemyCookingRepository
from app.infrastructure.db.repositories.taste_profile_repo import SQLAlchemyTasteProfileRepository
from app.infrastructure.db.repositories.shopping_repo import SQLAlchemyShoppingRepository
from app.infrastructure.ai.gemini_provider import GeminiRecipeAIProvider

ai_provider_instance = GeminiRecipeAIProvider()


async def get_current_user(session: AsyncSession = Depends(get_db_session)) -> UserModel:
    # Single-user local development mode: fetch the seeded user
    stmt = select(UserModel).where(UserModel.email == settings.DEFAULT_USER_EMAIL)
    res = await session.execute(stmt)
    user = res.scalars().first()
    if not user:
        # Fallback to first user in db
        stmt_any = select(UserModel)
        res_any = await session.execute(stmt_any)
        user = res_any.scalars().first()
    return user


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
