from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.db.models.user import UserTasteProfileModel


class SQLAlchemyTasteProfileRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_user_id(self, user_id: str) -> Optional[UserTasteProfileModel]:
        stmt = select(UserTasteProfileModel).where(UserTasteProfileModel.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def update_profile(
        self,
        user_id: str,
        meat_preferences: Optional[dict] = None,
        favorite_cuisines: Optional[list] = None,
        sauce_preference: Optional[dict] = None,
        salt_sensitivity: Optional[str] = None,
        disliked_ingredients: Optional[list] = None,
        equipment: Optional[list] = None,
        habits: Optional[dict] = None,
        ai_profile_summary: Optional[str] = None,
        skill_level: Optional[str] = None,
        diet_modes: Optional[list] = None,
        active_mode: Optional[str] = None,
        weight_kg: Optional[float] = None,
        height_cm: Optional[float] = None,
        activity_level: Optional[str] = None,
        meals_per_day: Optional[int] = None,
        allergies: Optional[list] = None,
        ingredient_affinity: Optional[dict] = None,
        cuisine_affinity: Optional[dict] = None,
        flavor_params: Optional[dict] = None,
    ) -> UserTasteProfileModel:
        profile = await self.get_by_user_id(user_id)
        if not profile:
            profile = UserTasteProfileModel(user_id=user_id)
            self.session.add(profile)

        if meat_preferences is not None:
            profile.meat_preferences = meat_preferences
        if favorite_cuisines is not None:
            profile.favorite_cuisines = favorite_cuisines
        if sauce_preference is not None:
            profile.sauce_preference = sauce_preference
        if salt_sensitivity is not None:
            profile.salt_sensitivity = salt_sensitivity
        if disliked_ingredients is not None:
            profile.disliked_ingredients = disliked_ingredients
        if equipment is not None:
            profile.equipment = equipment
        if habits is not None:
            profile.habits = habits
        if ai_profile_summary is not None:
            profile.ai_profile_summary = ai_profile_summary

        if skill_level is not None:
            profile.skill_level = skill_level
        if diet_modes is not None:
            profile.diet_modes = diet_modes
        if active_mode is not None:
            profile.active_mode = active_mode
        if weight_kg is not None:
            profile.weight_kg = weight_kg
        if height_cm is not None:
            profile.height_cm = height_cm
        if activity_level is not None:
            profile.activity_level = activity_level
        if meals_per_day is not None:
            profile.meals_per_day = meals_per_day
        if allergies is not None:
            profile.allergies = allergies
        if ingredient_affinity is not None:
            profile.ingredient_affinity = ingredient_affinity
        if cuisine_affinity is not None:
            profile.cuisine_affinity = cuisine_affinity
        if flavor_params is not None:
            profile.flavor_params = flavor_params

        profile.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(profile)
        return profile
