import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Numeric, Integer, Boolean, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.infrastructure.db.base import Base


class RecipeModel(Base):
    __tablename__ = "recipes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    cuisine: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    base_servings: Mapped[int] = mapped_column(Integer, default=1)
    visibility: Mapped[str] = mapped_column(String(20), default="shared")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    source: Mapped[Optional["RecipeSourceModel"]] = relationship(
        "RecipeSourceModel", back_populates="recipe", uselist=False, cascade="all, delete-orphan"
    )
    versions: Mapped[list["RecipeVersionModel"]] = relationship(
        "RecipeVersionModel", back_populates="recipe", cascade="all, delete-orphan", order_by="RecipeVersionModel.version_number"
    )


class RecipeSourceModel(Base):
    __tablename__ = "recipe_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id: Mapped[str] = mapped_column(String(36), ForeignKey("recipes.id", ondelete="CASCADE"), unique=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # historical_context, user_created, ai_generated
    source_name: Mapped[str] = mapped_column(String(150), nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    attribution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    recipe: Mapped["RecipeModel"] = relationship("RecipeModel", back_populates="source")


class RecipeVersionModel(Base):
    __tablename__ = "recipe_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id: Mapped[str] = mapped_column(String(36), ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    parent_version_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("recipe_versions.id", ondelete="SET NULL"), nullable=True)
    change_summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_base_version: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    recipe: Mapped["RecipeModel"] = relationship("RecipeModel", back_populates="versions")
    ingredients: Mapped[list["RecipeIngredientModel"]] = relationship(
        "RecipeIngredientModel", back_populates="version", cascade="all, delete-orphan"
    )
    steps: Mapped[list["RecipeStepModel"]] = relationship(
        "RecipeStepModel", back_populates="version", cascade="all, delete-orphan", order_by="RecipeStepModel.step_number"
    )


class RecipeIngredientModel(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("recipe_versions.id", ondelete="CASCADE"), index=True)
    ingredient_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("ingredients.id", ondelete="SET NULL"), nullable=True)
    ingredient_name_snapshot: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False, default="required")  # marinade, main_sauce, required, optional, garnish
    preparation_note: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    scalable: Mapped[bool] = mapped_column(Boolean, default=True)

    version: Mapped["RecipeVersionModel"] = relationship("RecipeVersionModel", back_populates="ingredients")


class RecipeStepModel(Base):
    __tablename__ = "recipe_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("recipe_versions.id", ondelete="CASCADE"), index=True)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    instruction: Mapped[str] = mapped_column(Text, nullable=False)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    temperature_c: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    version: Mapped["RecipeVersionModel"] = relationship("RecipeVersionModel", back_populates="steps")
