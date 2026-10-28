from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.infrastructure.db.models.recipe import (
    RecipeModel,
    RecipeSourceModel,
    RecipeVersionModel,
    RecipeIngredientModel,
    RecipeStepModel,
)


class SQLAlchemyRecipeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_recipes(self, user_id: Optional[str] = None) -> List[RecipeModel]:
        # Return system shared recipes + user's personal recipes
        stmt = (
            select(RecipeModel)
            .options(
                selectinload(RecipeModel.source),
                selectinload(RecipeModel.versions).selectinload(RecipeVersionModel.ingredients),
                selectinload(RecipeModel.versions).selectinload(RecipeVersionModel.steps),
            )
            .order_by(RecipeModel.title)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_recipe_by_id(self, recipe_id: str) -> Optional[RecipeModel]:
        stmt = (
            select(RecipeModel)
            .where(RecipeModel.id == recipe_id)
            .options(
                selectinload(RecipeModel.source),
                selectinload(RecipeModel.versions).selectinload(RecipeVersionModel.ingredients),
                selectinload(RecipeModel.versions).selectinload(RecipeVersionModel.steps),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_version_by_id(self, version_id: str) -> Optional[RecipeVersionModel]:
        stmt = (
            select(RecipeVersionModel)
            .where(RecipeVersionModel.id == version_id)
            .options(
                selectinload(RecipeVersionModel.recipe),
                selectinload(RecipeVersionModel.ingredients),
                selectinload(RecipeVersionModel.steps),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def create_new_version(
        self,
        recipe_id: str,
        parent_version_id: Optional[str],
        version_number: int,
        change_summary: str,
        created_by_user_id: Optional[str],
        ingredients: list,
        steps: list,
    ) -> RecipeVersionModel:
        version = RecipeVersionModel(
            recipe_id=recipe_id,
            version_number=version_number,
            parent_version_id=parent_version_id,
            change_summary=change_summary,
            created_by_user_id=created_by_user_id,
            is_base_version=False,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(version)
        await self.session.flush()

        for ing in ingredients:
            session_ing = RecipeIngredientModel(
                recipe_version_id=version.id,
                ingredient_id=ing.get("ingredient_id"),
                ingredient_name_snapshot=ing["ingredient_name_snapshot"],
                quantity=Decimal(str(ing["quantity"])) if ing.get("quantity") is not None else None,
                unit=ing.get("unit", "pcs"),
                role=ing.get("role", "required"),
                preparation_note=ing.get("preparation_note"),
                scalable=ing.get("scalable", True),
            )
            self.session.add(session_ing)

        for s in steps:
            session_step = RecipeStepModel(
                recipe_version_id=version.id,
                step_number=s["step_number"],
                instruction=s["instruction"],
                duration_seconds=s.get("duration_seconds"),
                temperature_c=s.get("temperature_c"),
            )
            self.session.add(session_step)

        await self.session.commit()
        await self.session.refresh(version)
        return version
