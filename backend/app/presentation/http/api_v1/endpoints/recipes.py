from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.presentation.http.dependencies import (
    get_current_user,
    get_recipe_repo,
    get_pantry_repo,
    get_taste_profile_repo,
)
from app.infrastructure.db.models.user import UserModel
from app.infrastructure.db.repositories.recipe_repo import SQLAlchemyRecipeRepository
from app.infrastructure.db.repositories.pantry_repo import SQLAlchemyPantryRepository
from app.infrastructure.db.repositories.taste_profile_repo import SQLAlchemyTasteProfileRepository
from app.domain.services.pantry_matcher import PantryMatcherService
from app.domain.services.recipe_scaler import RecipeScalerService
from app.domain.services.recommendation_engine import RecommendationEngineService
from app.presentation.http.schemas.recipe_schemas import (
    RecipeResponse,
    RecipeMatchResponse,
    AdaptRecipeRequest,
    RecipeVersionSchema,
    RecommendationsResponse,
)

router = APIRouter(prefix="/recipes", tags=["Recipes"])


@router.get("", response_model=List[RecipeResponse])
async def list_recipes(
    recipe_repo: SQLAlchemyRecipeRepository = Depends(get_recipe_repo),
):
    return await recipe_repo.list_recipes()


@router.get("/matched", response_model=List[RecipeMatchResponse])
async def get_matched_recipes(
    current_user: UserModel = Depends(get_current_user),
    recipe_repo: SQLAlchemyRecipeRepository = Depends(get_recipe_repo),
    pantry_repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
):
    recipes = await recipe_repo.list_recipes()
    pantry_items = await pantry_repo.get_user_pantry(current_user.id) if current_user else []

    # Map pantry by ingredient_id
    pantry_map = {item.ingredient_id: item for item in pantry_items if item.ingredient_id}

    matches = []
    for recipe in recipes:
        if not recipe.versions:
            continue
        # Use latest version or base version
        latest_version = recipe.versions[-1]
        match_result = PantryMatcherService.match_recipe(
            recipe_id=recipe.id,
            recipe_version_id=latest_version.id,
            recipe_title=recipe.title,
            recipe_ingredients=latest_version.ingredients,
            pantry_map=pantry_map,
        )

        matches.append(
            RecipeMatchResponse(
                recipe_id=recipe.id,
                recipe_version_id=latest_version.id,
                recipe_title=recipe.title,
                cuisine=recipe.cuisine,
                difficulty=recipe.difficulty,
                duration_minutes=recipe.duration_minutes,
                match_percentage=match_result.match_percentage,
                can_cook_now=match_result.can_cook_now,
                needs_confirmation_count=match_result.needs_confirmation_count,
                missing_required_count=match_result.missing_required_count,
                missing_optional_count=match_result.missing_optional_count,
                insufficient_count=match_result.insufficient_count,
                ingredients=[
                    {
                        "ingredient_id": ing.ingredient_id,
                        "ingredient_name": ing.ingredient_name,
                        "role": ing.role,
                        "required_quantity": ing.required_quantity,
                        "required_unit": ing.required_unit,
                        "pantry_quantity": ing.pantry_quantity,
                        "pantry_unit": ing.pantry_unit,
                        "pantry_status": ing.pantry_status,
                        "match_status": ing.match_status.value,
                        "deficit_quantity": ing.deficit_quantity,
                        "notes": ing.notes,
                    }
                    for ing in match_result.ingredients
                ],
            )
        )

    # Sort: can_cook_now first, then by match_percentage descending
    matches.sort(key=lambda m: (m.can_cook_now, m.match_percentage), reverse=True)
    return matches


@router.get("/recommendations", response_model=RecommendationsResponse)
async def get_recipe_recommendations(
    current_user: UserModel = Depends(get_current_user),
    recipe_repo: SQLAlchemyRecipeRepository = Depends(get_recipe_repo),
    pantry_repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
    taste_repo: SQLAlchemyTasteProfileRepository = Depends(get_taste_profile_repo),
):
    recipes = await recipe_repo.list_recipes()
    pantry_items = await pantry_repo.get_user_pantry(current_user.id) if current_user else []
    taste_profile = await taste_repo.get_by_user_id(current_user.id) if current_user else None

    return RecommendationEngineService.generate_ribbons(
        recipes=recipes,
        pantry_items=pantry_items,
        taste_profile=taste_profile,
    )


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe_details(
    recipe_id: str,
    recipe_repo: SQLAlchemyRecipeRepository = Depends(get_recipe_repo),
):
    recipe = await recipe_repo.get_recipe_by_id(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.post("/{recipe_id}/adapt", response_model=RecipeVersionSchema)
async def adapt_recipe(
    recipe_id: str,
    payload: AdaptRecipeRequest,
    current_user: UserModel = Depends(get_current_user),
    recipe_repo: SQLAlchemyRecipeRepository = Depends(get_recipe_repo),
):
    recipe = await recipe_repo.get_recipe_by_id(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    new_version_number = len(recipe.versions) + 1
    new_version = await recipe_repo.create_new_version(
        recipe_id=recipe_id,
        parent_version_id=payload.parent_version_id,
        version_number=new_version_number,
        change_summary=payload.change_summary,
        created_by_user_id=current_user.id if current_user else None,
        ingredients=[i.model_dump() for i in payload.ingredients],
        steps=[s.model_dump() for s in payload.steps],
    )
    return new_version
