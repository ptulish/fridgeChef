from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RecipeIngredientSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    ingredient_id: Optional[str] = None
    ingredient_name_snapshot: str
    quantity: Optional[Decimal] = None
    unit: str
    role: str
    preparation_note: Optional[str] = None
    scalable: bool = True


class RecipeStepSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    step_number: int
    instruction: str
    duration_seconds: Optional[int] = None
    temperature_c: Optional[int] = None


class RecipeVersionSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    recipe_id: str
    version_number: int
    parent_version_id: Optional[str] = None
    change_summary: str
    is_base_version: bool
    created_at: datetime
    ingredients: List[RecipeIngredientSchema] = []
    steps: List[RecipeStepSchema] = []


class RecipeSourceSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_type: str
    source_name: str
    source_url: Optional[str] = None
    attribution: Optional[str] = None


class RecipeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    cuisine: Optional[str] = None
    difficulty: str
    duration_minutes: Optional[int] = None
    base_servings: int
    visibility: str
    source: Optional[RecipeSourceSchema] = None
    versions: List[RecipeVersionSchema] = []


class MatchedIngredientResponse(BaseModel):
    ingredient_id: Optional[str] = None
    ingredient_name: str
    role: str
    required_quantity: Optional[Decimal] = None
    required_unit: str
    pantry_quantity: Optional[Decimal] = None
    pantry_unit: Optional[str] = None
    pantry_status: Optional[str] = None
    match_status: str
    deficit_quantity: Optional[Decimal] = None
    notes: Optional[str] = None


class RecipeMatchResponse(BaseModel):
    recipe_id: str
    recipe_version_id: str
    recipe_title: str
    cuisine: Optional[str] = None
    difficulty: str
    duration_minutes: Optional[int] = None
    match_percentage: float
    can_cook_now: bool
    needs_confirmation_count: int
    missing_required_count: int
    missing_optional_count: int
    insufficient_count: int
    ingredients: List[MatchedIngredientResponse] = []


class AdaptRecipeRequest(BaseModel):
    parent_version_id: str
    change_summary: str
    ingredients: List[RecipeIngredientSchema]
    steps: List[RecipeStepSchema]


class RecommendationRibbonResponse(BaseModel):
    id: str
    title_key: str
    type: str
    recipes: List[RecipeMatchResponse]


class RecommendationsResponse(BaseModel):
    ribbons: List[RecommendationRibbonResponse]
