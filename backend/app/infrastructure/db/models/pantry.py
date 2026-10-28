import uuid
from decimal import Decimal
from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import String, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.infrastructure.db.base import Base


class PantryItemModel(Base):
    __tablename__ = "user_pantry_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ingredient_id: Mapped[str] = mapped_column(String(36), ForeignKey("ingredients.id", ondelete="CASCADE"), index=True)
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="needs_confirmation", index=True)
    storage_zone: Mapped[str] = mapped_column(String(50), nullable=False, default="fridge", index=True)
    is_staple: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
    fuzzy_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # full, half, low, almost_empty, out
    package_size: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    best_before: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="pantry_items")
    ingredient: Mapped["IngredientModel"] = relationship("IngredientModel", back_populates="pantry_items")
