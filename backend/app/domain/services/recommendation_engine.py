from typing import List, Dict, Any, Optional
from app.domain.services.pantry_matcher import PantryMatcherService, RecipeMatchResult
from app.presentation.http.schemas.recipe_schemas import (
    RecipeMatchResponse,
    RecommendationRibbonResponse,
    RecommendationsResponse,
)


class RecommendationEngineService:
    @staticmethod
    def calculate_recipe_score(
        match_result: RecipeMatchResult,
        recipe: Any,
        pantry_map: Dict[str, Any],
        taste_profile: Optional[Any] = None,
    ) -> float:
        """
        Formula: 0.45 * Coverage + 0.25 * FinishLow + 0.15 * Affinity + 0.15 * ModeFit - infinity * Allergy
        """
        # 1. Check Allergies
        if taste_profile and getattr(taste_profile, "allergies", None):
            allergens = [a.lower() for a in taste_profile.allergies]
            for ing in match_result.ingredients:
                if any(al in ing.ingredient_name.lower() for al in allergens):
                    return -999999.0

        # 2. Coverage [0.0, 1.0]
        coverage = match_result.match_percentage / 100.0

        # 3. FinishLow [0.0, 1.0]
        total_matched = len(match_result.ingredients)
        low_count = 0
        for ing in match_result.ingredients:
            if ing.ingredient_id and ing.ingredient_id in pantry_map:
                p_item = pantry_map[ing.ingredient_id]
                fuzzy = getattr(p_item, "fuzzy_level", None)
                status = getattr(p_item, "status", None)
                if fuzzy in ("low", "almost_empty") or status == "low":
                    low_count += 1
        finish_low = (low_count / total_matched) if total_matched > 0 else 0.0

        # 4. Affinity [0.0, 1.0]
        affinity = 0.5
        if taste_profile:
            ing_affinity = getattr(taste_profile, "ingredient_affinity", {}) or {}
            cuisine_affinity = getattr(taste_profile, "cuisine_affinity", {}) or {}
            if recipe.cuisine and recipe.cuisine in cuisine_affinity:
                affinity += cuisine_affinity[recipe.cuisine] * 0.2
            if ing_affinity:
                ing_scores = []
                for ing in match_result.ingredients:
                    for aff_name, aff_val in ing_affinity.items():
                        if aff_name.lower() in ing.ingredient_name.lower():
                            ing_scores.append(aff_val)
                if ing_scores:
                    affinity += (sum(ing_scores) / len(ing_scores)) * 0.2
        affinity = max(0.0, min(1.0, affinity))

        # 5. ModeFit [0.0, 1.0]
        mode_fit = 0.5
        if taste_profile and getattr(taste_profile, "active_mode", None):
            mode = taste_profile.active_mode
            if mode == "comfort_food":
                mode_fit = 0.8
            elif mode == "high_protein":
                if any(k in recipe.title.lower() for k in ("курица", "говядина", "стейк", "индейка", "рыба", "мясо")):
                    mode_fit = 1.0
            elif mode == "quick":
                if recipe.duration_minutes and recipe.duration_minutes <= 20:
                    mode_fit = 1.0

        score = (
            0.45 * coverage
            + 0.25 * finish_low
            + 0.15 * affinity
            + 0.15 * mode_fit
        )
        return round(score, 3)

    @classmethod
    def generate_ribbons(
        cls,
        recipes: List[Any],
        pantry_items: List[Any],
        taste_profile: Optional[Any] = None,
    ) -> RecommendationsResponse:
        pantry_map = {item.ingredient_id: item for item in pantry_items if item.ingredient_id}

        scored_matches = []
        for recipe in recipes:
            if not recipe.versions:
                continue
            version = recipe.versions[-1]
            match_res = PantryMatcherService.match_recipe(
                recipe_id=recipe.id,
                recipe_version_id=version.id,
                recipe_title=recipe.title,
                recipe_ingredients=version.ingredients,
                pantry_map=pantry_map,
            )

            score = cls.calculate_recipe_score(match_res, recipe, pantry_map, taste_profile)
            if score < 0:
                continue

            match_dto = RecipeMatchResponse(
                recipe_id=recipe.id,
                recipe_version_id=version.id,
                recipe_title=recipe.title,
                cuisine=recipe.cuisine,
                difficulty=recipe.difficulty,
                duration_minutes=recipe.duration_minutes,
                match_percentage=match_res.match_percentage,
                can_cook_now=match_res.can_cook_now,
                needs_confirmation_count=match_res.needs_confirmation_count,
                missing_required_count=match_res.missing_required_count,
                missing_optional_count=match_res.missing_optional_count,
                insufficient_count=match_res.insufficient_count,
                ingredients=[
                    {
                        "ingredient_id": ing.ingredient_id,
                        "ingredient_name": ing.ingredient_name,
                        "role": ing.role,
                        "required_quantity": ing.required_quantity,
                        "required_unit": ing.required_unit,
                        "pantry_quantity": ing.pantry_quantity,
                        "pantry_unit": ing.pantry_unit,
                        "pantry_status": ing.pantry_status,
                        "match_status": ing.match_status.value,
                        "deficit_quantity": ing.deficit_quantity,
                        "notes": ing.notes,
                    }
                    for ing in match_res.ingredients
                ],
            )

            low_ingredients_count = sum(
                1 for ing in match_res.ingredients
                if ing.ingredient_id and ing.ingredient_id in pantry_map
                and (getattr(pantry_map[ing.ingredient_id], "fuzzy_level", "") in ("low", "almost_empty")
                     or getattr(pantry_map[ing.ingredient_id], "status", "") == "low")
            )

            scored_matches.append({
                "recipe": recipe,
                "dto": match_dto,
                "score": score,
                "low_count": low_ingredients_count,
            })

        # Ribbon 1: Cook Now (can_cook_now == True)
        cook_now_recipes = [
            sm["dto"] for sm in sorted(
                [sm for sm in scored_matches if sm["dto"].can_cook_now],
                key=lambda x: x["score"],
                reverse=True,
            )
        ]

        # Ribbon 2: Finish Low (recipes that use low/almost_empty pantry items)
        finish_low_recipes = [
            sm["dto"] for sm in sorted(
                [sm for sm in scored_matches if sm["low_count"] > 0],
                key=lambda x: (x["low_count"], x["score"]),
                reverse=True,
            )
        ]

        # Ribbon 3: Almost Bingo (missing 1-2 items, coverage >= 70%)
        almost_bingo_recipes = [
            sm["dto"] for sm in sorted(
                [
                    sm for sm in scored_matches
                    if not sm["dto"].can_cook_now
                    and 0 < sm["dto"].missing_required_count <= 2
                    and sm["dto"].match_percentage >= 70.0
                ],
                key=lambda x: (x["dto"].match_percentage, x["score"]),
                reverse=True,
            )
        ]

        if not almost_bingo_recipes:
            almost_bingo_recipes = [
                sm["dto"] for sm in sorted(
                    [sm for sm in scored_matches if not sm["dto"].can_cook_now],
                    key=lambda x: x["dto"].match_percentage,
                    reverse=True,
                )[:4]
            ]

        ribbons = [
            RecommendationRibbonResponse(
                id="cook_now",
                title_key="ribbon_cook_now",
                type="cook_now",
                recipes=cook_now_recipes,
            ),
            RecommendationRibbonResponse(
                id="finish_low",
                title_key="ribbon_finish_low",
                type="finish_low",
                recipes=finish_low_recipes,
            ),
            RecommendationRibbonResponse(
                id="almost_bingo",
                title_key="ribbon_almost_bingo",
                type="almost_bingo",
                recipes=almost_bingo_recipes,
            ),
        ]

        return RecommendationsResponse(ribbons=ribbons)
