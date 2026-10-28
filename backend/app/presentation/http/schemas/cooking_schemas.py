from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class StartSessionRequest(BaseModel):
    recipe_id: str
    recipe_version_id: str
    servings: float = 1.0


class DepletionItem(BaseModel):
    ingredient_name: str
    pantry_item_id: Optional[str] = None
    ingredient_id: Optional[str] = None
    amount_needed: float
    unit: str
    current_qty: Optional[float] = None
    new_qty: Optional[float] = None
    current_fuzzy: Optional[str] = None
    new_fuzzy: Optional[str] = None
    will_deplete: bool = False
    is_staple: bool = False


class DepletionPreviewResponse(BaseModel):
    session_id: str
    deductions: List[DepletionItem]


class DeductionConfirmationItem(BaseModel):
    pantry_item_id: Optional[str] = None
    ingredient_name: Optional[str] = None
    deduct_qty: Optional[float] = None
    unit: Optional[str] = None
    new_fuzzy: Optional[str] = None
    set_out: bool = False


class CompleteSessionRequest(BaseModel):
    notes: Optional[str] = None
    actual_changes: Optional[dict] = None
    deductions: Optional[List[DeductionConfirmationItem]] = None


class ReviewRequest(BaseModel):
    taste_rating: Optional[int] = Field(None, ge=1, le=5)
    saltiness_rating: Optional[int] = Field(None, ge=1, le=5)
    sauce_amount_rating: Optional[int] = Field(None, ge=1, le=5)
    sweetness_rating: Optional[int] = Field(None, ge=1, le=5)
    acidity_rating: Optional[int] = Field(None, ge=1, le=5)
    texture_rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None
    quick_notes: Optional[List[str]] = None


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    cooking_session_id: str
    taste_rating: Optional[int] = None
    saltiness_rating: Optional[int] = None
    sauce_amount_rating: Optional[int] = None
    sweetness_rating: Optional[int] = None
    acidity_rating: Optional[int] = None
    texture_rating: Optional[int] = None
    comment: Optional[str] = None
    created_at: datetime


class CookingSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    recipe_id: str
    recipe_version_id: str
    servings: float
    status: str
    notes: Optional[str] = None
    actual_changes: Optional[dict] = None
    cooked_at: datetime
    review: Optional[ReviewResponse] = None
