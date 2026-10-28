from fastapi import APIRouter, Depends, HTTPException
from app.presentation.http.dependencies import get_current_user, get_taste_profile_repo
from app.infrastructure.db.models.user import UserModel
from app.infrastructure.db.repositories.taste_profile_repo import SQLAlchemyTasteProfileRepository
from app.domain.services.taste_profile_updater import TasteProfileUpdaterService
from app.domain.services.prompt_context_builder import calculate_daily_kcal, calculate_target_meal_kcal
from app.presentation.http.schemas.profile_schemas import (
    TasteProfileResponse,
    UpdateTasteProfileRequest,
)

router = APIRouter(prefix="/profile", tags=["Taste Profile"])


def _attach_computed_calories(profile) -> TasteProfileResponse:
    daily = calculate_daily_kcal(
        weight_kg=profile.weight_kg,
        height_cm=profile.height_cm,
        activity_level=profile.activity_level or "moderate",
    )
    meal = calculate_target_meal_kcal(
        daily_kcal=daily,
        meals_per_day=profile.meals_per_day or 3,
        satiety_level="standard",
    )
    resp = TasteProfileResponse.model_validate(profile)
    resp.computed_daily_kcal = daily
    resp.target_meal_kcal = meal
    return resp


@router.get("", response_model=TasteProfileResponse)
async def get_taste_profile(
    current_user: UserModel = Depends(get_current_user),
    taste_repo: SQLAlchemyTasteProfileRepository = Depends(get_taste_profile_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    profile = await taste_repo.get_by_user_id(current_user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Taste profile not found")
    return _attach_computed_calories(profile)


@router.put("", response_model=TasteProfileResponse)
async def update_taste_profile(
    payload: UpdateTasteProfileRequest,
    current_user: UserModel = Depends(get_current_user),
    taste_repo: SQLAlchemyTasteProfileRepository = Depends(get_taste_profile_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    current_profile = await taste_repo.get_by_user_id(current_user.id)
    merged_data = {
        "meat_preferences": payload.meat_preferences if payload.meat_preferences is not None else current_profile.meat_preferences,
        "favorite_cuisines": payload.favorite_cuisines if payload.favorite_cuisines is not None else current_profile.favorite_cuisines,
        "sauce_preference": payload.sauce_preference if payload.sauce_preference is not None else current_profile.sauce_preference,
        "salt_sensitivity": payload.salt_sensitivity if payload.salt_sensitivity is not None else current_profile.salt_sensitivity,
        "disliked_ingredients": payload.disliked_ingredients if payload.disliked_ingredients is not None else current_profile.disliked_ingredients,
        "equipment": payload.equipment if payload.equipment is not None else current_profile.equipment,
        "habits": payload.habits if payload.habits is not None else current_profile.habits,
        "skill_level": payload.skill_level if payload.skill_level is not None else current_profile.skill_level,
        "diet_modes": payload.diet_modes if payload.diet_modes is not None else current_profile.diet_modes,
        "active_mode": payload.active_mode if payload.active_mode is not None else current_profile.active_mode,
        "allergies": payload.allergies if payload.allergies is not None else current_profile.allergies,
    }
    new_summary = TasteProfileUpdaterService.generate_ai_summary(merged_data)

    updated = await taste_repo.update_profile(
        user_id=current_user.id,
        meat_preferences=payload.meat_preferences,
        favorite_cuisines=payload.favorite_cuisines,
        sauce_preference=payload.sauce_preference,
        salt_sensitivity=payload.salt_sensitivity,
        disliked_ingredients=payload.disliked_ingredients,
        equipment=payload.equipment,
        habits=payload.habits,
        ai_profile_summary=new_summary,
        skill_level=payload.skill_level,
        diet_modes=payload.diet_modes,
        active_mode=payload.active_mode,
        weight_kg=payload.weight_kg,
        height_cm=payload.height_cm,
        activity_level=payload.activity_level,
        meals_per_day=payload.meals_per_day,
        allergies=payload.allergies,
        ingredient_affinity=payload.ingredient_affinity,
        cuisine_affinity=payload.cuisine_affinity,
        flavor_params=payload.flavor_params,
    )
    return _attach_computed_calories(updated)
