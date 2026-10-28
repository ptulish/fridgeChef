from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.infrastructure.db.models.cooking import (
    CookingSessionModel,
    ReviewModel,
    PersonalRecipeAdjustmentModel,
)


class SQLAlchemyCookingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_session(
        self,
        user_id: str,
        recipe_id: str,
        recipe_version_id: str,
        servings: float = 1.0,
    ) -> CookingSessionModel:
        session_obj = CookingSessionModel(
            user_id=user_id,
            recipe_id=recipe_id,
            recipe_version_id=recipe_version_id,
            servings=servings,
            status="in_progress",
            cooked_at=datetime.now(timezone.utc),
        )
        self.session.add(session_obj)
        await self.session.commit()
        await self.session.refresh(session_obj)
        return session_obj

    async def get_session(self, session_id: str, user_id: str) -> Optional[CookingSessionModel]:
        stmt = (
            select(CookingSessionModel)
            .where(CookingSessionModel.id == session_id, CookingSessionModel.user_id == user_id)
            .options(
                selectinload(CookingSessionModel.recipe),
                selectinload(CookingSessionModel.recipe_version),
                selectinload(CookingSessionModel.review),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_user_sessions(self, user_id: str) -> List[CookingSessionModel]:
        stmt = (
            select(CookingSessionModel)
            .where(CookingSessionModel.user_id == user_id)
            .options(
                selectinload(CookingSessionModel.recipe),
                selectinload(CookingSessionModel.recipe_version),
                selectinload(CookingSessionModel.review),
            )
            .order_by(CookingSessionModel.cooked_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def complete_session(
        self,
        session_id: str,
        user_id: str,
        notes: Optional[str] = None,
        actual_changes: Optional[dict] = None,
    ) -> Optional[CookingSessionModel]:
        session_obj = await self.get_session(session_id, user_id)
        if not session_obj:
            return None
        session_obj.status = "completed"
        session_obj.notes = notes
        session_obj.actual_changes = actual_changes
        await self.session.commit()
        await self.session.refresh(session_obj)
        return session_obj

    async def create_review(
        self,
        user_id: str,
        cooking_session_id: str,
        taste_rating: Optional[int],
        saltiness_rating: Optional[int],
        sauce_amount_rating: Optional[int],
        sweetness_rating: Optional[int],
        acidity_rating: Optional[int],
        texture_rating: Optional[int],
        comment: Optional[str] = None,
    ) -> ReviewModel:
        review = ReviewModel(
            user_id=user_id,
            cooking_session_id=cooking_session_id,
            taste_rating=taste_rating,
            saltiness_rating=saltiness_rating,
            sauce_amount_rating=sauce_amount_rating,
            sweetness_rating=sweetness_rating,
            acidity_rating=acidity_rating,
            texture_rating=texture_rating,
            comment=comment,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(review)
        await self.session.commit()
        await self.session.refresh(review)
        return review

    async def create_adjustment(
        self,
        user_id: str,
        base_recipe_id: str,
        source_version_id: str,
        adapted_version_id: str,
        reason: str,
        trigger_review_id: Optional[str] = None,
    ) -> PersonalRecipeAdjustmentModel:
        adj = PersonalRecipeAdjustmentModel(
            user_id=user_id,
            base_recipe_id=base_recipe_id,
            source_version_id=source_version_id,
            adapted_version_id=adapted_version_id,
            reason=reason,
            trigger_review_id=trigger_review_id,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(adj)
        await self.session.commit()
        await self.session.refresh(adj)
        return adj
