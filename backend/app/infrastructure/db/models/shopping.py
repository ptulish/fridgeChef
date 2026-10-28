import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.infrastructure.db.base import Base


class ShoppingListModel(Base):
    __tablename__ = "shopping_lists"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(100), default="Мой список покупок")
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="shopping_lists")
    items: Mapped[list["ShoppingListItemModel"]] = relationship(
        "ShoppingListItemModel", back_populates="shopping_list", cascade="all, delete-orphan"
    )


class ShoppingListItemModel(Base):
    __tablename__ = "shopping_list_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shopping_list_id: Mapped[str] = mapped_column(String(36), ForeignKey("shopping_lists.id", ondelete="CASCADE"), index=True)
    ingredient_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("ingredients.id", ondelete="SET NULL"), nullable=True)
    item_name: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default="pcs")
    is_bought: Mapped[bool] = mapped_column(Boolean, default=False)
    recipe_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)

    shopping_list: Mapped["ShoppingListModel"] = relationship("ShoppingListModel", back_populates="items")
