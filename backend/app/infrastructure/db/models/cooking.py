import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, SmallInteger, Text, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.infrastructure.db.base import Base


class CookingSessionModel(Base):
    __tablename__ = "cooking_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipe_id: Mapped[str] = mapped_column(String(36), ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    recipe_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("recipe_versions.id", ondelete="CASCADE"), index=True)
    servings: Mapped[float] = mapped_column(Float, default=1.0)
    status: Mapped[str] = mapped_column(String(30), default="in_progress")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actual_changes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    cooked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="cooking_sessions")
    recipe: Mapped["RecipeModel"] = relationship("RecipeModel")
    recipe_version: Mapped["RecipeVersionModel"] = relationship("RecipeVersionModel")
    review: Mapped[Optional["ReviewModel"]] = relationship(
        "ReviewModel", back_populates="cooking_session", uselist=False, cascade="all, delete-orphan"
    )


class ReviewModel(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    cooking_session_id: Mapped[str] = mapped_column(String(36), ForeignKey("cooking_sessions.id", ondelete="CASCADE"), unique=True)
    taste_rating: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    saltiness_rating: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    sauce_amount_rating: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    sweetness_rating: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    acidity_rating: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    texture_rating: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    cooking_session: Mapped["CookingSessionModel"] = relationship("CookingSessionModel", back_populates="review")


class PersonalRecipeAdjustmentModel(Base):
    __tablename__ = "personal_recipe_adjustments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    base_recipe_id: Mapped[str] = mapped_column(String(36), ForeignKey("recipes.id", ondelete="CASCADE"), index=True)
    source_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("recipe_versions.id", ondelete="CASCADE"))
    adapted_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("recipe_versions.id", ondelete="CASCADE"))
    trigger_review_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("reviews.id", ondelete="SET NULL"), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
