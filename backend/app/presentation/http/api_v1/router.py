from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from typing import Optional
from app.presentation.http.dependencies import get_current_user
from app.infrastructure.db.models.user import UserModel
from app.presentation.http.api_v1.endpoints import (
    pantry,
    recipes,
    cooking,
    profile,
    shopping,
    ai,
    inventory_transactions,
)

api_router = APIRouter(prefix="/api/v1")


class CurrentUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: Optional[str] = None


@api_router.get("/auth/me", response_model=CurrentUserResponse, tags=["Auth"])
async def get_me(current_user: UserModel = Depends(get_current_user)):
    return current_user


api_router.include_router(pantry.router)
api_router.include_router(recipes.router)
api_router.include_router(cooking.router)
api_router.include_router(profile.router)
api_router.include_router(shopping.router)
api_router.include_router(ai.router)
api_router.include_router(inventory_transactions.router)
