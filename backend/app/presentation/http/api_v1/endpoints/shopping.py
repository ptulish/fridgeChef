from typing import List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from app.presentation.http.dependencies import (
    get_current_user,
    get_shopping_repo,
    get_recipe_repo,
    get_pantry_repo,
)
from app.infrastructure.db.models.user import UserModel
from app.infrastructure.db.repositories.shopping_repo import SQLAlchemyShoppingRepository
from app.infrastructure.db.repositories.recipe_repo import SQLAlchemyRecipeRepository
from app.infrastructure.db.repositories.pantry_repo import SQLAlchemyPantryRepository
from app.domain.services.pantry_matcher import PantryMatcherService
from app.domain.value_objects.matching import MatchStatus
from app.domain.services.recipe_scaler import RecipeScalerService
from app.presentation.http.schemas.shopping_schemas import (
    ShoppingListResponse,
    ShoppingListItemResponse,
    AddShoppingItemRequest,
    AddRecipeToShoppingRequest,
)

router = APIRouter(prefix="/shopping", tags=["Shopping"])


@router.get("", response_model=ShoppingListResponse)
async def get_shopping_list(
    current_user: UserModel = Depends(get_current_user),
    shopping_repo: SQLAlchemyShoppingRepository = Depends(get_shopping_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    return await shopping_repo.get_or_create_active_list(current_user.id)


@router.post("/items", response_model=ShoppingListItemResponse)
async def add_shopping_item(
    payload: AddShoppingItemRequest,
    current_user: UserModel = Depends(get_current_user),
    shopping_repo: SQLAlchemyShoppingRepository = Depends(get_shopping_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    slist = await shopping_repo.get_or_create_active_list(current_user.id)
    return await shopping_repo.add_item_or_merge(
        shopping_list_id=slist.id,
        item_name=payload.item_name,
        quantity=payload.quantity,
        unit=payload.unit,
        ingredient_id=payload.ingredient_id,
        recipe_id=payload.recipe_id,
    )


@router.post("/add-recipe", response_model=ShoppingListResponse)
async def add_recipe_missing_items(
    payload: AddRecipeToShoppingRequest,
    current_user: UserModel = Depends(get_current_user),
    shopping_repo: SQLAlchemyShoppingRepository = Depends(get_shopping_repo),
    recipe_repo: SQLAlchemyRecipeRepository = Depends(get_recipe_repo),
    pantry_repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    recipe = await recipe_repo.get_recipe_by_id(payload.recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    version = await recipe_repo.get_version_by_id(payload.recipe_version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Match ingredients to compute deficit
    pantry_items = await pantry_repo.get_user_pantry(current_user.id)
    pantry_map = {item.ingredient_id: item for item in pantry_items if item.ingredient_id}

    # Scale ingredients if servings != base_servings
    ingredients = version.ingredients
    if payload.servings != recipe.base_servings:
        ingredients = RecipeScalerService.scale_ingredients(ingredients, recipe.base_servings, payload.servings)

    match_result = PantryMatcherService.match_recipe(
        recipe_id=recipe.id,
        recipe_version_id=version.id,
        recipe_title=recipe.title,
        recipe_ingredients=ingredients,
        pantry_map=pantry_map,
    )

    slist = await shopping_repo.get_or_create_active_list(current_user.id)

    for item in match_result.ingredients:
        # If missing or insufficient, add deficit to shopping list
        if item.match_status in (
            MatchStatus.MISSING_REQUIRED,
            MatchStatus.INSUFFICIENT,
            MatchStatus.NEEDS_CONFIRMATION,
        ):
            needed_qty = item.deficit_quantity or item.required_quantity
            await shopping_repo.add_item_or_merge(
                shopping_list_id=slist.id,
                item_name=item.ingredient_name,
                quantity=needed_qty,
                unit=item.required_unit,
                ingredient_id=item.ingredient_id,
                recipe_id=recipe.id,
            )

    return await shopping_repo.get_or_create_active_list(current_user.id)


@router.patch("/items/{item_id}/toggle", response_model=ShoppingListItemResponse)
async def toggle_shopping_item(
    item_id: str,
    current_user: UserModel = Depends(get_current_user),
    shopping_repo: SQLAlchemyShoppingRepository = Depends(get_shopping_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    item = await shopping_repo.toggle_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shopping_item(
    item_id: str,
    current_user: UserModel = Depends(get_current_user),
    shopping_repo: SQLAlchemyShoppingRepository = Depends(get_shopping_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    deleted = await shopping_repo.remove_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found")


@router.delete("/clear-bought", response_model=ShoppingListResponse)
async def clear_bought_items(
    current_user: UserModel = Depends(get_current_user),
    shopping_repo: SQLAlchemyShoppingRepository = Depends(get_shopping_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    slist = await shopping_repo.get_or_create_active_list(current_user.id)
    await shopping_repo.clear_bought_items(slist.id)
    return await shopping_repo.get_or_create_active_list(current_user.id)
