from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.infrastructure.db.models.pantry import PantryItemModel
from app.infrastructure.db.models.ingredient import IngredientModel


class SQLAlchemyPantryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_user_pantry(
        self,
        user_id: str,
        storage_zone: Optional[str] = None,
        is_staple: Optional[bool] = None,
    ) -> List[PantryItemModel]:
        stmt = (
            select(PantryItemModel)
            .where(PantryItemModel.user_id == user_id)
            .options(selectinload(PantryItemModel.ingredient))
        )
        if storage_zone:
            stmt = stmt.where(PantryItemModel.storage_zone == storage_zone)
        if is_staple is not None:
            stmt = stmt.where(PantryItemModel.is_staple == is_staple)

        stmt = stmt.order_by(PantryItemModel.is_staple, PantryItemModel.status, PantryItemModel.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_pantry_item_by_id(self, item_id: str, user_id: str) -> Optional[PantryItemModel]:
        stmt = (
            select(PantryItemModel)
            .where(PantryItemModel.id == item_id, PantryItemModel.user_id == user_id)
            .options(selectinload(PantryItemModel.ingredient))
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_item_by_ingredient_id(self, user_id: str, ingredient_id: str) -> Optional[PantryItemModel]:
        stmt = (
            select(PantryItemModel)
            .where(PantryItemModel.user_id == user_id, PantryItemModel.ingredient_id == ingredient_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def add_or_update_item(
        self,
        user_id: str,
        ingredient_id: str,
        quantity: Optional[Decimal],
        unit: str,
        status: str,
        storage_zone: str = "fridge",
        is_staple: bool = False,
        fuzzy_level: Optional[str] = None,
        package_size: Optional[Decimal] = None,
        best_before=None,
        notes: Optional[str] = None,
        source: str = "manual",
    ) -> PantryItemModel:
        existing = await self.get_item_by_ingredient_id(user_id, ingredient_id)
        now = datetime.now(timezone.utc)
        if existing:
            existing.quantity = quantity
            existing.unit = unit
            existing.status = status
            if storage_zone is not None:
                existing.storage_zone = storage_zone
            if is_staple is not None:
                existing.is_staple = is_staple
            if fuzzy_level is not None:
                existing.fuzzy_level = fuzzy_level
            if package_size is not None:
                existing.package_size = package_size
            existing.best_before = best_before
            existing.notes = notes
            existing.last_confirmed_at = now
            await self.session.commit()
            await self.session.refresh(existing)
            return existing

        item = PantryItemModel(
            user_id=user_id,
            ingredient_id=ingredient_id,
            quantity=quantity,
            unit=unit,
            status=status,
            storage_zone=storage_zone or "fridge",
            is_staple=is_staple or False,
            fuzzy_level=fuzzy_level,
            package_size=package_size,
            best_before=best_before,
            notes=notes,
            source=source,
            last_confirmed_at=now,
        )
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def bulk_confirm(self, user_id: str, updates: List[Dict[str, Any]]) -> List[PantryItemModel]:
        now = datetime.now(timezone.utc)
        updated_items = []
        for u in updates:
            item_id = u["id"]
            stmt = select(PantryItemModel).where(PantryItemModel.id == item_id, PantryItemModel.user_id == user_id)
            res = await self.session.execute(stmt)
            item = res.scalars().first()
            if item:
                if "quantity" in u:
                    item.quantity = Decimal(str(u["quantity"])) if u["quantity"] is not None else None
                if "unit" in u and u["unit"]:
                    item.unit = u["unit"]
                if "status" in u and u["status"]:
                    item.status = u["status"]
                if "storage_zone" in u and u["storage_zone"]:
                    item.storage_zone = u["storage_zone"]
                if "fuzzy_level" in u:
                    item.fuzzy_level = u["fuzzy_level"]
                if "is_staple" in u and u["is_staple"] is not None:
                    item.is_staple = u["is_staple"]
                item.last_confirmed_at = now
                updated_items.append(item)
        await self.session.commit()
        return updated_items

    async def delete_item(self, item_id: str, user_id: str) -> bool:
        stmt = delete(PantryItemModel).where(PantryItemModel.id == item_id, PantryItemModel.user_id == user_id)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0
