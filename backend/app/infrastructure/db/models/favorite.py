from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.infrastructure.db.base import Base


class FavoriteModel(Base):
    __tablename__ = "favorites"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    recipe_id: Mapped[str] = mapped_column(String(36), ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True)
