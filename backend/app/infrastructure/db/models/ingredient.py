import uuid
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.infrastructure.db.base import Base


class IngredientModel(Base):
    __tablename__ = "ingredients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    canonical_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    default_unit: Mapped[str] = mapped_column(String(20), nullable=False, default="pcs")
    density_g_per_ml: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 3), nullable=True)

    pantry_items: Mapped[list["PantryItemModel"]] = relationship("PantryItemModel", back_populates="ingredient")
