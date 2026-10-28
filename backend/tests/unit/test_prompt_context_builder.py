import json
import pytest
from app.domain.services.prompt_context_builder import (
    PromptContextBuilder,
    calculate_daily_kcal,
    calculate_target_meal_kcal,
)
from app.presentation.http.schemas.ai_schemas import RecipeDraft, IngredientDraft, StepDraft, MacrosDraft


def test_calculate_daily_and_meal_kcal():
    # 80 kg, 180 cm male, moderate activity
    daily = calculate_daily_kcal(weight_kg=80.0, height_cm=180.0, activity_level="moderate", age=30, sex="male")
    assert daily is not None
    assert 2400 <= daily <= 2900

    # 3 meals per day
    standard_meal = calculate_target_meal_kcal(daily, meals_per_day=3, satiety_level="standard")
    light_meal = calculate_target_meal_kcal(daily, meals_per_day=3, satiety_level="light")
    hearty_meal = calculate_target_meal_kcal(daily, meals_per_day=3, satiety_level="hearty")

    assert light_meal < standard_meal < hearty_meal
    assert round(standard_meal * 0.65) == light_meal or abs(light_meal - standard_meal * 0.65) <= 2
    assert round(standard_meal * 1.4) == hearty_meal or abs(hearty_meal - standard_meal * 1.4) <= 2


def test_build_context_inventory_refs():
    pantry = [
        {"name": "Куриное филе", "quantity": 300, "unit": "g", "status": "in_stock", "storage_zone": "fridge"},
        {"name": "Соус терияки", "fuzzy_level": "low", "status": "low", "storage_zone": "fridge"},
    ]
    profile = {
        "skill_level": "home_cook",
        "equipment": ["wok", "cutting_board"],
        "allergies": ["арахис"],
        "disliked_ingredients": ["грибы"],
        "weight_kg": 75,
        "height_cm": 178,
        "meals_per_day": 3,
    }

    sys_inst, user_json, ref_map = PromptContextBuilder.build_context(
        pantry_items=pantry,
        taste_profile=profile,
        prompt="сытный ужин в воке",
        satiety_level="hearty",
    )

    assert "i1" in ref_map
    assert "i2" in ref_map
    assert ref_map["i1"]["name"] == "Куриное филе"
    assert "s1" in ref_map  # staples

    assert "арахис" in sys_inst
    assert "грибы" in sys_inst
    assert "wok" in sys_inst

    payload = json.loads(user_json)
    assert payload["satiety_level"] == "hearty"
    assert "target_meal_calories" in payload
    assert len(payload["inventory"]) == 2
    assert payload["inventory"][0]["ref"] == "i1"
    assert payload["inventory"][0]["qty"] == 300


def test_recipe_draft_pydantic_validation():
    valid_data = {
        "title": "Курица терияки в воке",
        "description": "Быстрое и сытное блюдо",
        "cuisine": "Азиатская",
        "difficulty": "easy",
        "duration_minutes": 20,
        "base_servings": 1,
        "equipment_used": ["wok"],
        "ingredients": [
            {
                "name": "Куриное филе",
                "inventory_ref": "i1",
                "availability": "in_stock",
                "quantity": 250,
                "unit": "g",
                "role": "required",
            },
            {
                "name": "Соевый соус",
                "inventory_ref": "s1",
                "availability": "staple",
                "quantity": 2,
                "unit": "tbsp",
                "role": "main_sauce",
            },
        ],
        "steps": [
            {
                "step_number": 1,
                "instruction": "Нарезать курицу и обжарить в воке 4 минуты",
                "duration_seconds": 240,
                "equipment": "wok",
            }
        ],
        "macros_per_serving": {
            "kcal": 490,
            "protein_g": 42.0,
            "fat_g": 12.0,
            "carbs_g": 45.0,
        },
        "why_this_recipe": "Использует курицу из холодильника и готовится за 20 минут.",
    }

    draft = RecipeDraft.model_validate(valid_data)
    assert draft.title == "Курица терияки в воке"
    assert draft.macros_per_serving.kcal == 490
    assert len(draft.ingredients) == 2
    assert draft.ingredients[0].inventory_ref == "i1"
