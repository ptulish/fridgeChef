from typing import Optional, List
from decimal import Decimal
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict


class IngredientSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    canonical_name: str
    category: str
    default_unit: str
    density_g_per_ml: Optional[Decimal] = None


class PantryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    ingredient_id: str
    quantity: Optional[Decimal] = None
    unit: str
    status: str
    storage_zone: Optional[str] = "fridge"
    is_staple: Optional[bool] = False
    fuzzy_level: Optional[str] = None
    package_size: Optional[Decimal] = None
    best_before: Optional[date] = None
    last_confirmed_at: Optional[datetime] = None
    source: str
    notes: Optional[str] = None
    ingredient: Optional[IngredientSchema] = None


class UpsertPantryItemRequest(BaseModel):
    ingredient_id: Optional[str] = None
    custom_ingredient_name: Optional[str] = None
    category: Optional[str] = "other"
    quantity: Optional[Decimal] = None
    unit: str
    status: str = "in_stock"
    storage_zone: Optional[str] = "fridge"
    is_staple: Optional[bool] = False
    fuzzy_level: Optional[str] = None
    package_size: Optional[Decimal] = None
    best_before: Optional[date] = None
    notes: Optional[str] = None


class BulkConfirmItemRequest(BaseModel):
    id: str
    quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    status: Optional[str] = None
    storage_zone: Optional[str] = None
    fuzzy_level: Optional[str] = None


class BulkConfirmRequest(BaseModel):
    items: List[BulkConfirmItemRequest]
