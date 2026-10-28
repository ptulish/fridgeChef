from typing import Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.presentation.http.schemas.pantry_schemas import PantryItemResponse


class InventoryTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    inventory_item_id: Optional[str] = None
    cooking_session_id: Optional[str] = None
    delta_quantity: Optional[Decimal] = None
    unit: Optional[str] = None
    fuzzy_before: Optional[str] = None
    fuzzy_after: Optional[str] = None
    reason: str
    created_at: datetime


class UndoTransactionResponse(BaseModel):
    status: str
    restored_item: Optional[PantryItemResponse] = None
    message: Optional[str] = None
