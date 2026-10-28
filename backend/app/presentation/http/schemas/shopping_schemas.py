from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ShoppingListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    shopping_list_id: str
    ingredient_id: Optional[str] = None
    item_name: str
    quantity: Optional[Decimal] = None
    unit: str
    is_bought: bool
    recipe_id: Optional[str] = None


class ShoppingListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    status: str
    created_at: datetime
    items: List[ShoppingListItemResponse] = []


class AddShoppingItemRequest(BaseModel):
    item_name: str
    quantity: Optional[Decimal] = None
    unit: str = "pcs"
    ingredient_id: Optional[str] = None
    recipe_id: Optional[str] = None


class AddRecipeToShoppingRequest(BaseModel):
    recipe_id: str
    recipe_version_id: str
    servings: int = 1
