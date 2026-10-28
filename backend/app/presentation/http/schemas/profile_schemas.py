from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TasteProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    meat_preferences: Dict[str, Any] = {}
    favorite_cuisines: List[str] = []
    sauce_preference: Dict[str, Any] = {}
    salt_sensitivity: str = "high"
    disliked_ingredients: List[str] = []
    equipment: List[str] = []
    habits: Dict[str, Any] = {}

    # Culinary DNA & Body Stats
    skill_level: Optional[str] = "home_cook"
    diet_modes: Optional[List[str]] = []
    active_mode: Optional[str] = "comfort_food"
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    activity_level: Optional[str] = "moderate"
    meals_per_day: Optional[int] = 3
    computed_daily_kcal: Optional[int] = None
    target_meal_kcal: Optional[int] = None
    allergies: Optional[List[str]] = []
    ingredient_affinity: Optional[Dict[str, float]] = {}
    cuisine_affinity: Optional[Dict[str, float]] = {}
    flavor_params: Optional[Dict[str, Any]] = {}

    ai_profile_summary: str
    updated_at: datetime


class UpdateTasteProfileRequest(BaseModel):
    meat_preferences: Optional[Dict[str, Any]] = None
    favorite_cuisines: Optional[List[str]] = None
    sauce_preference: Optional[Dict[str, Any]] = None
    salt_sensitivity: Optional[str] = None
    disliked_ingredients: Optional[List[str]] = None
    equipment: Optional[List[str]] = None
    habits: Optional[Dict[str, Any]] = None

    # Culinary DNA & Body Stats
    skill_level: Optional[str] = None
    diet_modes: Optional[List[str]] = None
    active_mode: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    activity_level: Optional[str] = None
    meals_per_day: Optional[int] = None
    allergies: Optional[List[str]] = None
    ingredient_affinity: Optional[Dict[str, float]] = None
    cuisine_affinity: Optional[Dict[str, float]] = None
    flavor_params: Optional[Dict[str, Any]] = None
