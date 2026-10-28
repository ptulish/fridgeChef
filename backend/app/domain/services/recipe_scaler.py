from decimal import Decimal
from typing import List, Any
from copy import deepcopy


class RecipeScalerService:
    @staticmethod
    def scale_ingredients(
        ingredients: List[Any],
        base_servings: int,
        target_servings: int,
        sauce_multiplier: Decimal = Decimal("1.0"),
    ) -> List[Any]:
        if base_servings <= 0:
            base_servings = 1
        servings_factor = Decimal(str(target_servings)) / Decimal(str(base_servings))

        scaled = []
        for item in ingredients:
            new_item = deepcopy(item)
            if new_item.quantity is not None:
                orig_qty = Decimal(str(new_item.quantity))
                # Only scale if scalable is True
                if getattr(new_item, "scalable", True):
                    # If item is part of main sauce and sauce_multiplier is specified
                    role = getattr(new_item, "role", "")
                    if role in ("main_sauce", "marinade"):
                        new_qty = orig_qty * servings_factor * sauce_multiplier
                    else:
                        new_qty = orig_qty * servings_factor
                    new_item.quantity = round(new_qty, 2)
            scaled.append(new_item)
        return scaled
