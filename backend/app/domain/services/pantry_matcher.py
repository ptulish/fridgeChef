from decimal import Decimal
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from app.domain.value_objects.roles import IngredientRole
from app.domain.value_objects.matching import MatchStatus
from app.domain.value_objects.statuses import PantryStatus
from app.domain.services.unit_converter import UnitConverterService, IncompatibleDimensionError


@dataclass
class MatchedIngredientResult:
    ingredient_id: Optional[str]
    ingredient_name: str
    role: str
    required_quantity: Optional[Decimal]
    required_unit: str
    pantry_quantity: Optional[Decimal]
    pantry_unit: Optional[str]
    pantry_status: Optional[str]
    match_status: MatchStatus
    deficit_quantity: Optional[Decimal]
    notes: Optional[str] = None


@dataclass
class RecipeMatchResult:
    recipe_id: str
    recipe_version_id: str
    recipe_title: str
    match_percentage: float
    can_cook_now: bool
    needs_confirmation_count: int
    missing_required_count: int
    missing_optional_count: int
    insufficient_count: int
    ingredients: List[MatchedIngredientResult]


class PantryMatcherService:
    @staticmethod
    def match_recipe(
        recipe_id: str,
        recipe_version_id: str,
        recipe_title: str,
        recipe_ingredients: List[Any],
        pantry_map: Dict[str, Any],  # ingredient_id (str) -> pantry_item
    ) -> RecipeMatchResult:
        results: List[MatchedIngredientResult] = []
        total_required = 0
        satisfied_required = 0
        needs_confirmation_count = 0
        missing_required_count = 0
        missing_optional_count = 0
        insufficient_count = 0

        for ring in recipe_ingredients:
            ing_id = str(ring.ingredient_id) if getattr(ring, "ingredient_id", None) else None
            role = ring.role if isinstance(ring.role, str) else ring.role.value
            req_qty = Decimal(str(ring.quantity)) if ring.quantity is not None else None
            req_unit = ring.unit or "pcs"
            name = ring.ingredient_name_snapshot

            is_must_have = role in [
                IngredientRole.REQUIRED.value,
                IngredientRole.MARINADE.value,
                IngredientRole.MAIN_SAUCE.value,
            ]
            if is_must_have:
                total_required += 1

            pantry_item = pantry_map.get(ing_id) if ing_id else None

            if not pantry_item:
                if is_must_have:
                    status = MatchStatus.MISSING_REQUIRED
                    missing_required_count += 1
                else:
                    status = MatchStatus.MISSING_OPTIONAL
                    missing_optional_count += 1

                results.append(
                    MatchedIngredientResult(
                        ingredient_id=ing_id,
                        ingredient_name=name,
                        role=role,
                        required_quantity=req_qty,
                        required_unit=req_unit,
                        pantry_quantity=None,
                        pantry_unit=None,
                        pantry_status=None,
                        match_status=status,
                        deficit_quantity=req_qty,
                    )
                )
                continue

            p_status = pantry_item.status if isinstance(pantry_item.status, str) else pantry_item.status.value
            p_qty = Decimal(str(pantry_item.quantity)) if pantry_item.quantity is not None else None
            p_unit = pantry_item.unit

            # If user status is out
            if p_status == PantryStatus.OUT.value:
                if is_must_have:
                    status = MatchStatus.MISSING_REQUIRED
                    missing_required_count += 1
                else:
                    status = MatchStatus.MISSING_OPTIONAL
                    missing_optional_count += 1
                results.append(
                    MatchedIngredientResult(
                        ingredient_id=ing_id,
                        ingredient_name=name,
                        role=role,
                        required_quantity=req_qty,
                        required_unit=req_unit,
                        pantry_quantity=Decimal("0"),
                        pantry_unit=p_unit,
                        pantry_status=p_status,
                        match_status=status,
                        deficit_quantity=req_qty,
                    )
                )
                continue

            # If staple and not out, it is considered sufficient
            is_staple_item = getattr(pantry_item, "is_staple", False)
            fuzzy = getattr(pantry_item, "fuzzy_level", None)

            if is_staple_item and p_status != PantryStatus.OUT.value:
                if is_must_have:
                    satisfied_required += 1
                results.append(
                    MatchedIngredientResult(
                        ingredient_id=ing_id,
                        ingredient_name=name,
                        role=role,
                        required_quantity=req_qty,
                        required_unit=req_unit,
                        pantry_quantity=p_qty,
                        pantry_unit=p_unit,
                        pantry_status=p_status,
                        match_status=MatchStatus.SUFFICIENT,
                        deficit_quantity=None,
                        notes="Базовый продукт (staple) в наличии",
                    )
                )
                continue

            # If fuzzy level indicates presence without exact quantity
            if fuzzy in ("full", "half", "low") and p_qty is None and p_status != PantryStatus.OUT.value:
                if is_must_have:
                    satisfied_required += 1
                results.append(
                    MatchedIngredientResult(
                        ingredient_id=ing_id,
                        ingredient_name=name,
                        role=role,
                        required_quantity=req_qty,
                        required_unit=req_unit,
                        pantry_quantity=None,
                        pantry_unit=p_unit,
                        pantry_status=p_status,
                        match_status=MatchStatus.SUFFICIENT,
                        deficit_quantity=None,
                        notes=f"Остаток на глаз: {fuzzy}",
                    )
                )
                continue

            # If needs confirmation or unknown quantity
            if p_status == PantryStatus.NEEDS_CONFIRMATION.value or p_qty is None:
                needs_confirmation_count += 1
                results.append(
                    MatchedIngredientResult(
                        ingredient_id=ing_id,
                        ingredient_name=name,
                        role=role,
                        required_quantity=req_qty,
                        required_unit=req_unit,
                        pantry_quantity=p_qty,
                        pantry_unit=p_unit,
                        pantry_status=p_status,
                        match_status=MatchStatus.NEEDS_CONFIRMATION,
                        deficit_quantity=None,
                        notes="Наличие или количество требует подтверждения",
                    )
                )
                continue

            # Check quantity with conversion
            if req_qty is None:
                # Qualitative requirement (to taste, pinch, etc.)
                if is_must_have:
                    satisfied_required += 1
                results.append(
                    MatchedIngredientResult(
                        ingredient_id=ing_id,
                        ingredient_name=name,
                        role=role,
                        required_quantity=None,
                        required_unit=req_unit,
                        pantry_quantity=p_qty,
                        pantry_unit=p_unit,
                        pantry_status=p_status,
                        match_status=MatchStatus.SUFFICIENT,
                        deficit_quantity=None,
                    )
                )
                continue

            try:
                converted_p_qty = UnitConverterService.convert(p_qty, from_unit=p_unit, to_unit=req_unit)
                if converted_p_qty >= req_qty:
                    if is_must_have:
                        satisfied_required += 1
                    status = MatchStatus.SUFFICIENT
                    deficit = None
                else:
                    insufficient_count += 1
                    status = MatchStatus.INSUFFICIENT
                    deficit = req_qty - converted_p_qty
            except IncompatibleDimensionError:
                # Incompatible units (e.g. pieces in pantry vs grams in recipe)
                # Treat as needs confirmation rather than crashing
                needs_confirmation_count += 1
                status = MatchStatus.NEEDS_CONFIRMATION
                deficit = req_qty

            results.append(
                MatchedIngredientResult(
                    ingredient_id=ing_id,
                    ingredient_name=name,
                    role=role,
                    required_quantity=req_qty,
                    required_unit=req_unit,
                    pantry_quantity=p_qty,
                    pantry_unit=p_unit,
                    pantry_status=p_status,
                    match_status=status,
                    deficit_quantity=deficit,
                )
            )

        match_pct = (satisfied_required / total_required * 100.0) if total_required > 0 else 100.0
        can_cook_now = (
            missing_required_count == 0
            and insufficient_count == 0
            and needs_confirmation_count == 0
        )

        return RecipeMatchResult(
            recipe_id=recipe_id,
            recipe_version_id=recipe_version_id,
            recipe_title=recipe_title,
            match_percentage=round(match_pct, 1),
            can_cook_now=can_cook_now,
            needs_confirmation_count=needs_confirmation_count,
            missing_required_count=missing_required_count,
            missing_optional_count=missing_optional_count,
            insufficient_count=insufficient_count,
            ingredients=results,
        )
