from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.presentation.http.dependencies import (
    get_current_user,
    get_cooking_repo,
    get_taste_profile_repo,
    get_pantry_repo,
    get_recipe_repo,
    get_db_session,
)
from app.infrastructure.db.models.user import UserModel
from app.infrastructure.db.models.inventory_transaction import InventoryTransactionModel
from app.infrastructure.db.repositories.cooking_repo import SQLAlchemyCookingRepository
from app.infrastructure.db.repositories.taste_profile_repo import SQLAlchemyTasteProfileRepository
from app.infrastructure.db.repositories.pantry_repo import SQLAlchemyPantryRepository
from app.infrastructure.db.repositories.recipe_repo import SQLAlchemyRecipeRepository
from app.domain.services.taste_profile_updater import TasteProfileUpdaterService
from app.presentation.http.schemas.cooking_schemas import (
    StartSessionRequest,
    CompleteSessionRequest,
    ReviewRequest,
    CookingSessionResponse,
    ReviewResponse,
    DepletionItem,
    DepletionPreviewResponse,
)

router = APIRouter(prefix="/cooking", tags=["Cooking"])


@router.get("/sessions", response_model=List[CookingSessionResponse])
async def list_cooking_sessions(
    current_user: UserModel = Depends(get_current_user),
    cooking_repo: SQLAlchemyCookingRepository = Depends(get_cooking_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    return await cooking_repo.list_user_sessions(current_user.id)


@router.post("/sessions", response_model=CookingSessionResponse)
async def start_cooking_session(
    payload: StartSessionRequest,
    current_user: UserModel = Depends(get_current_user),
    cooking_repo: SQLAlchemyCookingRepository = Depends(get_cooking_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    session_obj = await cooking_repo.create_session(
        user_id=current_user.id,
        recipe_id=payload.recipe_id,
        recipe_version_id=payload.recipe_version_id,
        servings=payload.servings,
    )
    return await cooking_repo.get_session(session_obj.id, current_user.id)


@router.get("/sessions/{session_id}", response_model=CookingSessionResponse)
async def get_cooking_session(
    session_id: str,
    current_user: UserModel = Depends(get_current_user),
    cooking_repo: SQLAlchemyCookingRepository = Depends(get_cooking_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    session_obj = await cooking_repo.get_session(session_id, current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    return session_obj


@router.post("/sessions/{session_id}/depletion-preview", response_model=DepletionPreviewResponse)
async def get_session_depletion_preview(
    session_id: str,
    current_user: UserModel = Depends(get_current_user),
    cooking_repo: SQLAlchemyCookingRepository = Depends(get_cooking_repo),
    pantry_repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
    recipe_repo: SQLAlchemyRecipeRepository = Depends(get_recipe_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    session_obj = await cooking_repo.get_session(session_id, current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    recipe_version = await recipe_repo.get_version_by_id(session_obj.recipe_version_id)
    if not recipe_version:
        raise HTTPException(status_code=404, detail="Recipe version not found")

    pantry_items = await pantry_repo.get_user_pantry(current_user.id)
    pantry_by_ing_id = {item.ingredient_id: item for item in pantry_items if item.ingredient_id}
    pantry_by_name = {
        item.ingredient.canonical_name.lower(): item
        for item in pantry_items
        if item.ingredient and item.ingredient.canonical_name
    }

    base_servings = recipe_version.recipe.base_servings if recipe_version.recipe else 1
    servings_factor = session_obj.servings / (base_servings or 1)

    deductions: List[DepletionItem] = []
    for ing in recipe_version.ingredients:
        raw_qty = float(ing.quantity) if ing.quantity is not None else 0.0
        scaled_qty = round(raw_qty * servings_factor, 2) if ing.scalable else raw_qty

        p_item = None
        if ing.ingredient_id and ing.ingredient_id in pantry_by_ing_id:
            p_item = pantry_by_ing_id[ing.ingredient_id]
        elif ing.ingredient_name_snapshot.lower() in pantry_by_name:
            p_item = pantry_by_name[ing.ingredient_name_snapshot.lower()]
        else:
            for p_name, item in pantry_by_name.items():
                if p_name in ing.ingredient_name_snapshot.lower() or ing.ingredient_name_snapshot.lower() in p_name:
                    p_item = item
                    break

        p_id = p_item.id if p_item else None
        p_ing_id = p_item.ingredient_id if p_item else ing.ingredient_id
        is_staple = getattr(p_item, "is_staple", False) if p_item else False
        curr_qty = float(p_item.quantity) if p_item and p_item.quantity is not None else None
        curr_fuzzy = p_item.fuzzy_level if p_item else None

        new_qty = None
        new_fuzzy = None
        will_deplete = False

        if curr_qty is not None:
            subtracted_qty = scaled_qty
            if p_item and p_item.unit != ing.unit:
                try:
                    from app.domain.services.unit_converter import UnitConverterService
                    subtracted_qty = float(UnitConverterService.convert(Decimal(str(scaled_qty)), from_unit=ing.unit, to_unit=p_item.unit))
                except Exception:
                    subtracted_qty = scaled_qty

            calc_new_qty = max(0.0, round(curr_qty - subtracted_qty, 2))
            new_qty = calc_new_qty
            if calc_new_qty <= 0.0:
                will_deplete = True
                new_fuzzy = "out"
            elif calc_new_qty < (float(p_item.package_size) * 0.2 if p_item.package_size else 50.0):
                new_fuzzy = "almost_empty"
            elif calc_new_qty < (float(p_item.package_size) * 0.4 if p_item.package_size else 150.0):
                new_fuzzy = "low"
            else:
                new_fuzzy = curr_fuzzy or "half"
        else:
            fuzzy_cycle = {
                "full": "half",
                "half": "low",
                "low": "almost_empty",
                "almost_empty": "out",
                "out": "out",
            }
            new_fuzzy = fuzzy_cycle.get(curr_fuzzy or "full", "half")
            if new_fuzzy == "out" or curr_fuzzy == "out":
                will_deplete = True

        deductions.append(
            DepletionItem(
                ingredient_name=ing.ingredient_name_snapshot,
                pantry_item_id=p_id,
                ingredient_id=p_ing_id,
                amount_needed=scaled_qty,
                unit=ing.unit,
                current_qty=curr_qty,
                new_qty=new_qty,
                current_fuzzy=curr_fuzzy,
                new_fuzzy=new_fuzzy,
                will_deplete=will_deplete,
                is_staple=is_staple,
            )
        )

    return DepletionPreviewResponse(session_id=session_id, deductions=deductions)


@router.post("/sessions/{session_id}/complete", response_model=CookingSessionResponse)
async def complete_cooking_session(
    session_id: str,
    payload: CompleteSessionRequest,
    current_user: UserModel = Depends(get_current_user),
    cooking_repo: SQLAlchemyCookingRepository = Depends(get_cooking_repo),
    pantry_repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
    session: AsyncSession = Depends(get_db_session),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    # 1. Complete session in cooking repo
    session_obj = await cooking_repo.complete_session(
        session_id=session_id,
        user_id=current_user.id,
        notes=payload.notes,
        actual_changes=payload.actual_changes,
    )
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. Process deductions into ledger and user_pantry_items
    if payload.deductions:
        now = datetime.now(timezone.utc)

        for ded in payload.deductions:
            if not ded.pantry_item_id:
                continue

            p_item = await pantry_repo.get_pantry_item_by_id(ded.pantry_item_id, current_user.id)
            if not p_item:
                continue

            fuzzy_before = p_item.fuzzy_level
            fuzzy_after = ded.new_fuzzy or ("out" if ded.set_out else p_item.fuzzy_level)
            delta = None

            if ded.set_out:
                delta = -p_item.quantity if p_item.quantity is not None else None
                p_item.quantity = Decimal("0")
                p_item.status = "out"
                p_item.fuzzy_level = "out"
            else:
                if ded.deduct_qty is not None and ded.deduct_qty > 0:
                    delta = -Decimal(str(ded.deduct_qty))
                    if p_item.quantity is not None:
                        p_item.quantity = max(Decimal("0"), p_item.quantity - Decimal(str(ded.deduct_qty)))
                        if p_item.quantity == Decimal("0"):
                            p_item.status = "out"
                            p_item.fuzzy_level = "out"
                            fuzzy_after = "out"
                if ded.new_fuzzy:
                    p_item.fuzzy_level = ded.new_fuzzy
                    if ded.new_fuzzy == "out":
                        p_item.status = "out"
                        p_item.quantity = Decimal("0")
                    elif p_item.status == "out" and ded.new_fuzzy != "out":
                        p_item.status = "in_stock"

            p_item.last_confirmed_at = now

            # Record in inventory_transactions ledger
            tx = InventoryTransactionModel(
                user_id=current_user.id,
                inventory_item_id=p_item.id,
                cooking_session_id=session_id,
                delta_quantity=delta,
                unit=ded.unit or p_item.unit,
                fuzzy_before=fuzzy_before,
                fuzzy_after=fuzzy_after,
                reason="cooked",
                created_at=now,
            )
            session.add(tx)

        await session.commit()

    return await cooking_repo.get_session(session_id, current_user.id)


@router.post("/sessions/{session_id}/review", response_model=ReviewResponse)
async def submit_session_review(
    session_id: str,
    payload: ReviewRequest,
    current_user: UserModel = Depends(get_current_user),
    cooking_repo: SQLAlchemyCookingRepository = Depends(get_cooking_repo),
    taste_repo: SQLAlchemyTasteProfileRepository = Depends(get_taste_profile_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    session_obj = await cooking_repo.get_session(session_id, current_user.id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")

    # 1. Save review
    review = await cooking_repo.create_review(
        user_id=current_user.id,
        cooking_session_id=session_id,
        taste_rating=payload.taste_rating,
        saltiness_rating=payload.saltiness_rating,
        sauce_amount_rating=payload.sauce_amount_rating,
        sweetness_rating=payload.sweetness_rating,
        acidity_rating=payload.acidity_rating,
        texture_rating=payload.texture_rating,
        comment=payload.comment,
    )

    # 2. Automatically EVOLVE User Taste Profile Card!
    current_taste_profile = await taste_repo.get_by_user_id(current_user.id)
    if current_taste_profile:
        profile_dict = {
            "meat_preferences": current_taste_profile.meat_preferences,
            "sauce_preference": current_taste_profile.sauce_preference,
            "salt_sensitivity": current_taste_profile.salt_sensitivity,
            "disliked_ingredients": current_taste_profile.disliked_ingredients,
            "equipment": current_taste_profile.equipment,
            "habits": current_taste_profile.habits,
            "flavor_params": current_taste_profile.flavor_params or {},
            "ingredient_affinity": current_taste_profile.ingredient_affinity or {},
            "cuisine_affinity": current_taste_profile.cuisine_affinity or {},
            "skill_level": current_taste_profile.skill_level or "home_cook",
            "allergies": current_taste_profile.allergies or [],
        }
        updated_profile = TasteProfileUpdaterService.update_profile_from_review(
            current_profile=profile_dict,
            saltiness_rating=payload.saltiness_rating,
            sauce_amount_rating=payload.sauce_amount_rating,
            taste_rating=payload.taste_rating,
            sweetness_rating=payload.sweetness_rating,
            acidity_rating=payload.acidity_rating,
            comment=payload.comment,
            quick_notes=payload.quick_notes,
        )
        await taste_repo.update_profile(
            user_id=current_user.id,
            sauce_preference=updated_profile.get("sauce_preference"),
            salt_sensitivity=updated_profile.get("salt_sensitivity"),
            habits=updated_profile.get("habits"),
            flavor_params=updated_profile.get("flavor_params"),
            ai_profile_summary=updated_profile.get("ai_profile_summary"),
        )

    return review
