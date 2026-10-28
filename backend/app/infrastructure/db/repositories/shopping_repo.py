from typing import List, Optional
from decimal import Decimal
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.infrastructure.db.models.shopping import ShoppingListModel, ShoppingListItemModel
from app.domain.services.unit_converter import UnitConverterService, IncompatibleDimensionError


class SQLAlchemyShoppingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_or_create_active_list(self, user_id: str) -> ShoppingListModel:
        stmt = (
            select(ShoppingListModel)
            .where(ShoppingListModel.user_id == user_id, ShoppingListModel.status == "active")
            .options(selectinload(ShoppingListModel.items))
        )
        result = await self.session.execute(stmt)
        slist = result.scalars().first()
        if not slist:
            slist = ShoppingListModel(user_id=user_id, title="Мой список покупок", status="active")
            self.session.add(slist)
            await self.session.commit()
            await self.session.refresh(slist)
        else:
            await self.session.refresh(slist, ["items"])
        return slist

    async def add_item_or_merge(
        self,
        shopping_list_id: str,
        item_name: str,
        quantity: Optional[Decimal],
        unit: str,
        ingredient_id: Optional[str] = None,
        recipe_id: Optional[str] = None,
    ) -> ShoppingListItemModel:
        # Check if an unbought item with the same ingredient_id or name exists
        stmt = select(ShoppingListItemModel).where(
            ShoppingListItemModel.shopping_list_id == shopping_list_id,
            ShoppingListItemModel.is_bought == False,
        )
        if ingredient_id:
            stmt = stmt.where(ShoppingListItemModel.ingredient_id == ingredient_id)
        else:
            stmt = stmt.where(ShoppingListItemModel.item_name == item_name)

        result = await self.session.execute(stmt)
        existing = result.scalars().first()

        if existing and quantity is not None and existing.quantity is not None:
            # Try to safely merge compatible quantities
            try:
                converted_qty = UnitConverterService.convert(quantity, from_unit=unit, to_unit=existing.unit)
                existing.quantity += converted_qty
                await self.session.commit()
                await self.session.refresh(existing)
                return existing
            except IncompatibleDimensionError:
                pass  # Cannot merge different dimensions, create separate item

        new_item = ShoppingListItemModel(
            shopping_list_id=shopping_list_id,
            ingredient_id=ingredient_id,
            item_name=item_name,
            quantity=quantity,
            unit=unit,
            is_bought=False,
            recipe_id=recipe_id,
        )
        self.session.add(new_item)
        await self.session.commit()
        await self.session.refresh(new_item)
        return new_item

    async def toggle_item(self, item_id: str) -> Optional[ShoppingListItemModel]:
        stmt = select(ShoppingListItemModel).where(ShoppingListItemModel.id == item_id)
        result = await self.session.execute(stmt)
        item = result.scalars().first()
        if item:
            item.is_bought = not item.is_bought
            await self.session.commit()
            await self.session.refresh(item)
        return item

    async def remove_item(self, item_id: str) -> bool:
        stmt = delete(ShoppingListItemModel).where(ShoppingListItemModel.id == item_id)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0

    async def clear_bought_items(self, shopping_list_id: str) -> int:
        stmt = delete(ShoppingListItemModel).where(
            ShoppingListItemModel.shopping_list_id == shopping_list_id,
            ShoppingListItemModel.is_bought == True,
        )
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount
