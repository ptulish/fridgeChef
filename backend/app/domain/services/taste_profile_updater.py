from typing import Optional, Dict, Any, List
from copy import deepcopy


class TasteProfileUpdaterService:
    @staticmethod
    def update_profile_from_review(
        current_profile: Dict[str, Any],
        saltiness_rating: Optional[int],
        sauce_amount_rating: Optional[int],
        taste_rating: Optional[int],
        sweetness_rating: Optional[int],
        acidity_rating: Optional[int],
        comment: Optional[str] = None,
        quick_notes: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Analyzes review ratings and quick notes, then refines the user's taste profile.
        Returns the updated profile dictionary.
        """
        profile = deepcopy(current_profile)

        sauce_pref = profile.get("sauce_preference", {})
        habits = profile.get("habits", {})
        flavor_params = profile.get("flavor_params", {})
        feedback_history = profile.get("feedback_history", [])

        # Process quick notes chips
        if quick_notes:
            for tag in quick_notes:
                if tag == "too_salty":
                    profile["salt_sensitivity"] = "high"
                    habits["salt_rule"] = "Строго не досаливать; уменьшать соевый соус на 30-50%; разбавлять соусы водой."
                elif tag == "more_sauce":
                    sauce_pref["sauce_volume"] = "extra_abundant"
                    sauce_pref["note"] = "Увеличивать базовый объем соуса минимум на 30%, чтобы хватало на гарнир и мясо."
                elif tag == "too_spicy":
                    flavor_params["spice_preference"] = "mild"
                    habits["spice_rule"] = "Минимум остроты; заменять чили на паприку."
                elif tag == "will_repeat":
                    habits["favorite_recipes_note"] = "Пользователь оценил рецепт положительно и готов повторить."

        # 1. Saltiness Analysis
        if saltiness_rating is not None:
            if saltiness_rating >= 4:
                # Dish was too salty!
                profile["salt_sensitivity"] = "high"
                habits["salt_rule"] = "Строго не досаливать; уменьшать соевый соус на 30-50%; разбавлять соусы водой; пробовать перед подачей."
            elif saltiness_rating <= 2:
                # Dish was lacking salt
                if profile.get("salt_sensitivity") != "high":
                    profile["salt_sensitivity"] = "moderate"

        # 2. Sauce Volume Analysis
        if sauce_amount_rating is not None:
            if sauce_amount_rating <= 2:
                # Too dry / not enough sauce
                sauce_pref["sauce_volume"] = "extra_abundant"
                sauce_pref["note"] = "Увеличивать базовый объем соуса минимум на 30%, чтобы хватало на лапшу и мясо."
            elif sauce_amount_rating == 3:
                sauce_pref["sauce_volume"] = "abundant"

        # 3. Sweetness / Acidity Balance
        if sweetness_rating is not None and sweetness_rating >= 4:
            sauce_pref["sweetness_sensitivity"] = "likes_moderate_sweet"
        if acidity_rating is not None and acidity_rating >= 4:
            sauce_pref["acidity_preference"] = "likes_prominent_tang"

        # 4. Log feedback event
        feedback_entry = {
            "taste_rating": taste_rating,
            "saltiness_rating": saltiness_rating,
            "sauce_amount_rating": sauce_amount_rating,
            "comment": comment,
            "quick_notes": quick_notes or [],
        }
        feedback_history.append(feedback_entry)
        profile["feedback_history"] = feedback_history[-10:]  # keep last 10 entries

        profile["sauce_preference"] = sauce_pref
        profile["habits"] = habits
        profile["flavor_params"] = flavor_params

        # 5. Recompile AI Summary
        profile["ai_profile_summary"] = TasteProfileUpdaterService.generate_ai_summary(profile)

        return profile

    @staticmethod
    def generate_ai_summary(profile: Dict[str, Any]) -> str:
        meats = profile.get("meat_preferences", {})
        salt_sens = profile.get("salt_sensitivity", "high")
        salt_rule = profile.get("habits", {}).get(
            "salt_rule",
            "Высокая чувствительность к соли: не солить готовые блюда, разбавлять соевый соус водой."
        )
        sauce = profile.get("sauce_preference", {}).get("sauce_volume", "abundant")
        disliked = ", ".join(profile.get("disliked_ingredients", ["грибы", "болгарский перец"]))
        equipment = ", ".join(profile.get("equipment", ["сковорода", "мультиварка", "духовка"]))
        skill = profile.get("skill_level", "home_cook")
        allergies = profile.get("allergies", [])
        allergies_str = f"- СТРОГИЕ АЛЛЕРГИИ (ЗАПРЕЩЕНО ИСПОЛЬЗОВАТЬ): {', '.join(allergies)}." if allergies else "- Аллергий нет."

        lines = [
            "ПЕРСОНАЛЬНЫЙ КУЛИНАРНЫЙ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ:",
            f"- Уровень кулинарного мастерства: {skill}.",
            allergies_str,
            f"- Предпочтения по мясу: говядина, свинина (любит), курица (готовит, но требователен к соусу), рыба. Сосиски только немецкие.",
            f"- Нелюбимые продукты (ЗАПРЕЩЕНО добавлять без спроса): {disliked}.",
            f"- Соус: требуется {sauce} (обильный соус, покрывающий лапшу и мясо). Обязательно разделять маринад и основной соус.",
            f"- Чувствительность к соли: {salt_sens}. Правило: {salt_rule}",
            f"- Вкусовой баланс: любит баланс сладкого, кислого и чесночного вкуса. Острота регулируемая.",
            f"- Доступное оборудование: {equipment}.",
            "- Стандартная порция: мясо около 200г на порцию. Точные граммы и миллилитры."
        ]
        return "\n".join(lines)
