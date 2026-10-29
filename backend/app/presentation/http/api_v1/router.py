from fastapi import APIRouter
from app.presentation.http.api_v1.endpoints import (
    auth,
    pantry,
    recipes,
    cooking,
    profile,
    shopping,
    ai,
    inventory_transactions,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(pantry.router)
api_router.include_router(recipes.router)
api_router.include_router(cooking.router)
api_router.include_router(profile.router)
api_router.include_router(shopping.router)
api_router.include_router(ai.router)
api_router.include_router(inventory_transactions.router)
