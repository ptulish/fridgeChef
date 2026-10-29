import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, JSON, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.infrastructure.db.base import Base


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    auth_subject: Mapped[str] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    taste_profile: Mapped["UserTasteProfileModel"] = relationship(
        "UserTasteProfileModel", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    pantry_items: Mapped[list["PantryItemModel"]] = relationship(
        "PantryItemModel", back_populates="user", cascade="all, delete-orphan"
    )
    cooking_sessions: Mapped[list["CookingSessionModel"]] = relationship(
        "CookingSessionModel", back_populates="user", cascade="all, delete-orphan"
    )
    shopping_lists: Mapped[list["ShoppingListModel"]] = relationship(
        "ShoppingListModel", back_populates="user", cascade="all, delete-orphan"
    )


class UserTasteProfileModel(Base):
    __tablename__ = "user_taste_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    meat_preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    favorite_cuisines: Mapped[list] = mapped_column(JSON, default=list)
    sauce_preference: Mapped[dict] = mapped_column(JSON, default=dict)
    salt_sensitivity: Mapped[str] = mapped_column(String(50), default="high")
    disliked_ingredients: Mapped[list] = mapped_column(JSON, default=list)
    equipment: Mapped[list] = mapped_column(JSON, default=list)
    habits: Mapped[dict] = mapped_column(JSON, default=dict)
    skill_level: Mapped[str] = mapped_column(String(50), default="home_cook", nullable=True)
    diet_modes: Mapped[list] = mapped_column(JSON, default=list, nullable=True)
    active_mode: Mapped[str] = mapped_column(String(50), default="comfort_food", nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column(nullable=True)
    height_cm: Mapped[Optional[float]] = mapped_column(nullable=True)
    activity_level: Mapped[Optional[str]] = mapped_column(String(50), default="moderate", nullable=True)
    meals_per_day: Mapped[int] = mapped_column(default=3, nullable=True)
    allergies: Mapped[list] = mapped_column(JSON, default=list, nullable=True)
    ingredient_affinity: Mapped[dict] = mapped_column(JSON, default=dict, nullable=True)
    cuisine_affinity: Mapped[dict] = mapped_column(JSON, default=dict, nullable=True)
    flavor_params: Mapped[dict] = mapped_column(JSON, default=dict, nullable=True)
    ai_profile_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="taste_profile")
