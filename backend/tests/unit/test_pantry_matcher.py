from decimal import Decimal
from dataclasses import dataclass
from typing import Optional
from app.domain.services.pantry_matcher import PantryMatcherService
from app.domain.value_objects.matching import MatchStatus


@dataclass
class DummyRecipeIngredient:
    ingredient_id: Optional[str]
    ingredient_name_snapshot: str
    quantity: Optional[Decimal]
    unit: str
    role: str
    scalable: bool = True


@dataclass
class DummyPantryItem:
    ingredient_id: str
    quantity: Optional[Decimal]
    unit: str
    status: str


def test_full_match_can_cook():
    recipe_ingredients = [
        DummyRecipeIngredient(
            ingredient_id="chicken-id",
            ingredient_name_snapshot="Chicken Fillet",
            quantity=Decimal("200"),
            unit="g",
            role="required",
        ),
        DummyRecipeIngredient(
            ingredient_id="soy-id",
            ingredient_name_snapshot="Soy Sauce",
            quantity=Decimal("15"),
            unit="ml",
            role="marinade",
        ),
    ]

    pantry_map = {
        "chicken-id": DummyPantryItem(
            ingredient_id="chicken-id",
            quantity=Decimal("500"),
            unit="g",
            status="in_stock",
        ),
        "soy-id": DummyPantryItem(
            ingredient_id="soy-id",
            quantity=Decimal("100"),
            unit="ml",
            status="in_stock",
        ),
    }

    result = PantryMatcherService.match_recipe(
        recipe_id="r1",
        recipe_version_id="rv1",
        recipe_title="Chicken Wok",
        recipe_ingredients=recipe_ingredients,
        pantry_map=pantry_map,
    )

    assert result.can_cook_now is True
    assert result.match_percentage == 100.0
    assert result.missing_required_count == 0
    assert result.insufficient_count == 0


def test_needs_confirmation_when_quantity_is_none():
    recipe_ingredients = [
        DummyRecipeIngredient(
            ingredient_id="vinegar-id",
            ingredient_name_snapshot="Apple Cider Vinegar",
            quantity=Decimal("5"),
            unit="ml",
            role="main_sauce",
        ),
    ]

    # In pantry, but quantity is None (as in user's historical import!)
    pantry_map = {
        "vinegar-id": DummyPantryItem(
            ingredient_id="vinegar-id",
            quantity=None,
            unit="ml",
            status="in_stock",
        ),
    }

    result = PantryMatcherService.match_recipe(
        recipe_id="r1",
        recipe_version_id="rv1",
        recipe_title="Chicken Wok",
        recipe_ingredients=recipe_ingredients,
        pantry_map=pantry_map,
    )

    assert result.can_cook_now is False
    assert result.needs_confirmation_count == 1
    assert result.ingredients[0].match_status == MatchStatus.NEEDS_CONFIRMATION


def test_insufficient_quantity_calculates_deficit():
    recipe_ingredients = [
        DummyRecipeIngredient(
            ingredient_id="noodles-id",
            ingredient_name_snapshot="Rice Noodles",
            quantity=Decimal("80"),
            unit="g",
            role="required",
        ),
    ]

    pantry_map = {
        "noodles-id": DummyPantryItem(
            ingredient_id="noodles-id",
            quantity=Decimal("50"),
            unit="g",
            status="in_stock",
        ),
    }

    result = PantryMatcherService.match_recipe(
        recipe_id="r1",
        recipe_version_id="rv1",
        recipe_title="Chicken Wok",
        recipe_ingredients=recipe_ingredients,
        pantry_map=pantry_map,
    )

    assert result.can_cook_now is False
    assert result.insufficient_count == 1
    assert result.ingredients[0].match_status == MatchStatus.INSUFFICIENT
    assert result.ingredients[0].deficit_quantity == Decimal("30")
