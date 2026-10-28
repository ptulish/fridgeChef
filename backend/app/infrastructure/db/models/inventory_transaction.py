import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.infrastructure.db.base import Base


class InventoryTransactionModel(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    inventory_item_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("user_pantry_items.id", ondelete="SET NULL"), nullable=True, index=True)
    cooking_session_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("cooking_sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    delta_quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    fuzzy_before: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    fuzzy_after: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reason: Mapped[str] = mapped_column(String(50), default="cooked")  # cooked, manual, undo
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped["UserModel"] = relationship("UserModel")
    pantry_item: Mapped[Optional["PantryItemModel"]] = relationship("PantryItemModel")
