import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.presentation.http.dependencies import get_current_user, get_pantry_repo, get_db_session
from app.infrastructure.db.models.user import UserModel
from app.infrastructure.db.models.ingredient import IngredientModel
from app.infrastructure.db.repositories.pantry_repo import SQLAlchemyPantryRepository
from app.presentation.http.schemas.pantry_schemas import (
    PantryItemResponse,
    UpsertPantryItemRequest,
    BulkConfirmRequest,
    IngredientSchema,
)

router = APIRouter(prefix="/pantry", tags=["Pantry"])


@router.get("", response_model=List[PantryItemResponse])
async def list_pantry_items(
    storage_zone: Optional[str] = None,
    is_staple: Optional[bool] = None,
    current_user: UserModel = Depends(get_current_user),
    repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    return await repo.get_user_pantry(current_user.id, storage_zone=storage_zone, is_staple=is_staple)


@router.post("", response_model=PantryItemResponse)
async def upsert_pantry_item(
    payload: UpsertPantryItemRequest,
    current_user: UserModel = Depends(get_current_user),
    repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
    session: AsyncSession = Depends(get_db_session),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    ingredient_id = payload.ingredient_id
    if not ingredient_id and payload.custom_ingredient_name:
        name_clean = payload.custom_ingredient_name.strip()
        if not name_clean:
            raise HTTPException(status_code=400, detail="Ingredient name cannot be empty")

        # Check if already exists in IngredientModel (case-insensitive for both SQLite and Postgres)
        stmt = select(IngredientModel)
        res = await session.execute(stmt)
        all_ings = res.scalars().all()
        existing_ing = next(
            (i for i in all_ings if i.canonical_name.strip().lower() == name_clean.lower()),
            None
        )
        if existing_ing:
            ingredient_id = existing_ing.id
        else:
            new_ing = IngredientModel(
                id=str(uuid.uuid4()),
                canonical_name=name_clean,
                category=payload.category or "other",
                default_unit=payload.unit,
            )
            session.add(new_ing)
            await session.flush()
            ingredient_id = new_ing.id

    if not ingredient_id:
        raise HTTPException(status_code=400, detail="Must provide ingredient_id or custom_ingredient_name")

    item = await repo.add_or_update_item(
        user_id=current_user.id,
        ingredient_id=ingredient_id,
        quantity=payload.quantity,
        unit=payload.unit,
        status=payload.status,
        storage_zone=payload.storage_zone or "fridge",
        is_staple=payload.is_staple or False,
        fuzzy_level=payload.fuzzy_level,
        package_size=payload.package_size,
        best_before=payload.best_before,
        notes=payload.notes,
        source="manual",
    )
    # Refresh to load ingredient relation
    return await repo.get_pantry_item_by_id(item.id, current_user.id)


@router.post("/confirm-bulk", response_model=List[PantryItemResponse])
async def bulk_confirm_items(
    payload: BulkConfirmRequest,
    current_user: UserModel = Depends(get_current_user),
    repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    items_dict = [item.model_dump() for item in payload.items]
    await repo.bulk_confirm(current_user.id, items_dict)
    return await repo.get_user_pantry(current_user.id)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pantry_item(
    item_id: str,
    current_user: UserModel = Depends(get_current_user),
    repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")
    deleted = await repo.delete_item(item_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found")


@router.get("/catalog/ingredients", response_model=List[IngredientSchema])
async def list_canonical_ingredients(session: AsyncSession = Depends(get_db_session)):
    stmt = select(IngredientModel).order_by(IngredientModel.category, IngredientModel.canonical_name)
    res = await session.execute(stmt)
    return list(res.scalars().all())
