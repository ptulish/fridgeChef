from enum import Enum


class PantryStatus(str, Enum):
    IN_STOCK = "in_stock"
    LOW = "low"
    OUT = "out"
    NEEDS_CONFIRMATION = "needs_confirmation"


class CookingSessionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class RecipeDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class RecipeVisibility(str, Enum):
    SYSTEM = "system"
    PRIVATE = "private"
    SHARED = "shared"
