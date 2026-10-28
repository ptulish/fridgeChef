from typing import List
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.presentation.http.dependencies import get_current_user, get_db_session, get_pantry_repo
from app.infrastructure.db.models.user import UserModel
from app.infrastructure.db.models.inventory_transaction import InventoryTransactionModel
from app.infrastructure.db.models.pantry import PantryItemModel
from app.infrastructure.db.repositories.pantry_repo import SQLAlchemyPantryRepository
from app.presentation.http.schemas.inventory_transaction_schemas import (
    InventoryTransactionResponse,
    UndoTransactionResponse,
)
from app.presentation.http.schemas.pantry_schemas import PantryItemResponse

router = APIRouter(prefix="/inventory/transactions", tags=["Inventory Transactions"])


@router.get("", response_model=List[InventoryTransactionResponse])
async def list_transactions(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    stmt = (
        select(InventoryTransactionModel)
        .where(InventoryTransactionModel.user_id == current_user.id)
        .order_by(InventoryTransactionModel.created_at.desc())
        .limit(50)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("/{transaction_id}/undo", response_model=UndoTransactionResponse)
async def undo_transaction(
    transaction_id: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    pantry_repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    stmt = select(InventoryTransactionModel).where(
        InventoryTransactionModel.id == transaction_id,
        InventoryTransactionModel.user_id == current_user.id,
    )
    res = await session.execute(stmt)
    tx = res.scalars().first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if tx.reason == "undo":
        raise HTTPException(status_code=400, detail="Transaction is already undone")

    restored_item_response = None

    if tx.inventory_item_id:
        stmt_item = (
            select(PantryItemModel)
            .where(
                PantryItemModel.id == tx.inventory_item_id,
                PantryItemModel.user_id == current_user.id,
            )
            .options(selectinload(PantryItemModel.ingredient))
        )
        res_item = await session.execute(stmt_item)
        item = res_item.scalars().first()

        if item:
            # Revert delta quantity if available
            if tx.delta_quantity is not None:
                current_qty = item.quantity or Decimal("0")
                item.quantity = max(Decimal("0"), current_qty - tx.delta_quantity)

            # Revert fuzzy level if available
            if tx.fuzzy_before:
                item.fuzzy_level = tx.fuzzy_before

            # Restore status to in_stock unless fuzzy was out
            if item.fuzzy_level != "out" and (item.quantity is None or item.quantity > Decimal("0")):
                item.status = "in_stock"

            item.last_confirmed_at = datetime.now(timezone.utc)
            await session.flush()
            restored_item_response = await pantry_repo.get_pantry_item_by_id(item.id, current_user.id)

    # Mark transaction as undone
    tx.reason = "undo"
    await session.commit()

    return UndoTransactionResponse(
        status="success",
        restored_item=restored_item_response,
        message="Списание успешно отменено!",
    )
