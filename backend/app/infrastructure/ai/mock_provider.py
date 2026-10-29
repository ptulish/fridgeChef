from typing import Dict, Any, List, Optional
from decimal import Decimal


class MockRecipeAIProvider:
    """
    Mock AI Provider for development and offline mode when no Gemini API key is configured.
    Dynamically generates tailored, safe recipes aligned with the user's prompt,
    pantry items, and taste profile.
    """

    async def generate_recipe_suggestion(
        self,
        pantry_items: List[Dict[str, Any]],
        taste_profile: Dict[str, Any],
        prompt: Optional[str] = None,
        mode: Optional[str] = None,
        satiety_level: str = "standard",
        recent_feedback: Optional[List[str]] = None,
        marinate_meat: Optional[bool] = False,
        marinate_duration_minutes: Optional[int] = None,
        must_use_ingredients: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        prompt_lower = (prompt or "").lower().strip()

        # 1. Meat Selection
        if any(w in prompt_lower for w in ("говядин", "beef", "rind")):
            meat_name = "Говядина"
            meat_prep = "нарезать тонкими полосками поперек волокон"
            title_meat = "говядиной"
        elif any(w in prompt_lower for w in ("свинин", "гуляш", "schwein", "pork")):
            meat_name = "Свинина для гуляша (Schwein-Gulaschfleisch)"
            meat_prep = "нарезать тонкими брусочками поперек волокон"
            title_meat = "свининой"
        elif any(w in prompt_lower for w in ("куриц", "цыпл", "chicken", "huhn")):
            meat_name = "Куриное филе / шницель"
            meat_prep = "нарезать удобными кусочками на один укус"
            title_meat = "курицей"
        else:
            # Check pantry for in-stock meat
            pantry_names = [
                p.get("name", "").lower()
                for p in pantry_items
                if p.get("status") in ("in_stock", "low")
            ]
            if any("говядин" in n for n in pantry_names):
                meat_name = "Говядина"
                meat_prep = "нарезать тонкими полосками"
                title_meat = "говядиной"
            elif any("свинин" in n for n in pantry_names):
                meat_name = "Свинина для гуляша (Schwein-Gulaschfleisch)"
                meat_prep = "нарезать тонкими брусочками"
                title_meat = "свининой"
            else:
                meat_name = "Куриное филе / шницель"
                meat_prep = "нарезать удобными кусочками"
                title_meat = "курицей"

        # 2. Carbs / Noodles Selection
        if any(w in prompt_lower for w in ("удон", "udon")):
            noodle_name = "Сухая удон-лапша"
            noodle_prep = "отварить до полуготовности 4 минуты"
            title_carb = "пшеничной лапшой удон"
        elif any(w in prompt_lower for w in ("рис", "rice", "reis")) and not any(w in prompt_lower for w in ("лапш", "noodl", "nudel")):
            noodle_name = "Жасминовый рис"
            noodle_prep = "отварить до рассыпчатости (1:1.5 с водой)"
            title_carb = "жасминовым рисом"
        elif any(w in prompt_lower for w in ("спагетти", "spaghetti", "паста", "pasta")):
            noodle_name = "Спагетти"
            noodle_prep = "отварить до состояния al dente"
            title_carb = "спагетти"
        else:
            noodle_name = "Рисовая лапша Bánh Phở 5 мм"
            noodle_prep = "замочить в горячей воде или отварить 3 минуты"
            title_carb = "рисовой лапшой"

        # 3. Sauce Style Selection
        if any(w in prompt_lower for w in ("терияк", "teriyak", "tereyak")):
            style_title = "в соусе Терияки"
            sauce_desc = "густым соусом Терияки"
            sauce_items = [
                {
                    "name": "Go-Tan Wok Teriyaki",
                    "quantity": 2.0,
                    "unit": "tbsp",
                    "role": "main_sauce",
                    "preparation_note": "основа терияки",
                    "scalable": True,
                },
                {
                    "name": "Kikkoman соевый соус",
                    "quantity": 1.0,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "сниженная дозировка",
                    "scalable": True,
                },
                {
                    "name": "Мёд Clever",
                    "quantity": 0.5,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "для карамелизации",
                    "scalable": True,
                },
                {
                    "name": "Maizena кукурузный крахмал",
                    "quantity": 1.0,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "для загущения",
                    "scalable": True,
                },
            ]
            water_ml = 80
        elif any(w in prompt_lower for w in ("сладк", "кисл", "sweet", "chili", "чили", "sour")):
            style_title = "в сладко-кислом соусе"
            sauce_desc = "сладко-кислым соусом"
            sauce_items = [
                {
                    "name": "Shan’shi Sweet Chili",
                    "quantity": 1.5,
                    "unit": "tbsp",
                    "role": "main_sauce",
                    "preparation_note": "сладость и деликатная пряность",
                    "scalable": True,
                },
                {
                    "name": "Яблочный уксус",
                    "quantity": 1.0,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "фруктовая кислинка",
                    "scalable": True,
                },
                {
                    "name": "Мёд Clever",
                    "quantity": 1.0,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "натуральная сладость",
                    "scalable": True,
                },
                {
                    "name": "Kikkoman соевый соус",
                    "quantity": 1.0,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "контроль соли: уменьшено",
                    "scalable": True,
                },
                {
                    "name": "Maizena кукурузный крахмал",
                    "quantity": 1.5,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "для глянцевого соуса",
                    "scalable": True,
                },
            ]
            water_ml = 90
        else:
            style_title = "в чесночно-соевом соусе"
            sauce_desc = "обильным чесночным соусом"
            sauce_items = [
                {
                    "name": "Shan’shi Wok Sauce",
                    "quantity": 2.0,
                    "unit": "tbsp",
                    "role": "main_sauce",
                    "preparation_note": "основной вок-соус",
                    "scalable": True,
                },
                {
                    "name": "Kikkoman соевый соус",
                    "quantity": 1.0,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "сниженная дозировка для контроля соли",
                    "scalable": True,
                },
                {
                    "name": "Яблочный уксус",
                    "quantity": 0.5,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "сбалансированная кислинка",
                    "scalable": True,
                },
                {
                    "name": "Мёд Clever",
                    "quantity": 1.0,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "сладость",
                    "scalable": True,
                },
                {
                    "name": "Maizena кукурузный крахмал",
                    "quantity": 1.5,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "для загущения",
                    "scalable": True,
                },
            ]
            water_ml = 100

        title = f"Домашний вок с {title_meat} и {title_carb} {style_title}"
        description = (
            f"Персональное блюдо, составленное под ваши предпочтения: с {title_meat}, "
            f"{sauce_desc}, контролем соли и без запрещенных продуктов (грибов и перца)."
        )

        all_ingredients = [
            {
                "name": meat_name,
                "quantity": 200.0,
                "unit": "g",
                "role": "required",
                "preparation_note": meat_prep,
                "scalable": True,
            },
            {
                "name": noodle_name,
                "quantity": 80.0,
                "unit": "g",
                "role": "required",
                "preparation_note": noodle_prep,
                "scalable": True,
            },
            {
                "name": "Чеснок",
                "quantity": 3.0,
                "unit": "clove",
                "role": "required",
                "preparation_note": "мелко порубить",
                "scalable": True,
            },
            {
                "name": "Лук репчатый",
                "quantity": 0.5,
                "unit": "pcs",
                "role": "required",
                "preparation_note": "нарезать перьями",
                "scalable": True,
            },
            {
                "name": "Растительное масло",
                "quantity": 1.5,
                "unit": "tbsp",
                "role": "required",
                "preparation_note": "для обжарки на сильном огне",
                "scalable": False,
            },
            {
                "name": "Kikkoman кунжутное масло",
                "quantity": 0.5,
                "unit": "tsp",
                "role": "garnish",
                "preparation_note": "для финального аромата",
                "scalable": False,
            },
        ] + sauce_items

        if must_use_ingredients:
            existing_names = [i["name"].lower() for i in all_ingredients]
            for must_ing in must_use_ingredients:
                if not any(must_ing.lower() in en or en in must_ing.lower() for en in existing_names):
                    all_ingredients.append({
                        "name": must_ing,
                        "quantity": 100.0,
                        "unit": "g",
                        "role": "required",
                        "preparation_note": "выбрано из вашего холодильника",
                        "scalable": True,
                        "availability": "in_stock",
                    })

        steps = [
            {
                "step_number": 1,
                "instruction": f"Подготовка: Нарежьте {title_meat} ({meat_prep}). Подготовьте чеснок и лук. Подготовьте {title_carb}.",
                "duration_seconds": 300,
            },
            {
                "step_number": 2,
                "instruction": f"Соус (контроль соли): В миске смешайте все компоненты основного соуса и добавьте {water_ml} мл холодной воды. Перемешайте венчиком до растворения крахмала.",
                "duration_seconds": 180,
            },
            {
                "step_number": 3,
                "instruction": f"Обжарка мяса: Разогрейте сковороду или вок с растительным маслом до дымка. Быстро обжарьте {title_meat} по 1.5–2 минуты с каждой стороны до золотистости. Переложите на тарелку.",
                "duration_seconds": 240,
            },
            {
                "step_number": 4,
                "instruction": f"Сборка вока: В ту же сковороду добавьте лук и чеснок, обжаривайте 40 секунд. Влейте соус, доведите до кипения и загустения (1 минута). Добавьте мясо и лапшу, прогрейте вместе 1 минуту. Сбрызните кунжутным маслом и снимите с огня.",
                "duration_seconds": 180,
            },
        ]

        total_duration = 25
        if marinate_meat:
            marinate_dur = marinate_duration_minutes or 20
            total_duration += marinate_dur
            # Insert marination step at the beginning
            for st in steps:
                st["step_number"] += 1
            steps.insert(0, {
                "step_number": 1,
                "instruction": f"Предварительное маринование мяса ({marinate_dur} мин): Нарежьте {title_meat} ({meat_prep}). Смешайте с 1 ч. л. соевого соуса, 0.5 ч. л. крахмала и каплей масла. Оставьте мариноваться на {marinate_dur} минут для сочности.",
                "duration_seconds": marinate_dur * 60,
            })

        return {
            "title": title,
            "description": description,
            "cuisine": "Китайская / Вок",
            "difficulty": "medium",
            "duration_minutes": total_duration,
            "base_servings": 1,
            "equipment_used": ["wok", "knife", "cutting_board"],
            "ingredients": all_ingredients,
            "steps": steps,
            "macros_per_serving": {
                "kcal": 520,
                "protein_g": 38.0,
                "fat_g": 16.0,
                "carbs_g": 56.0,
            },
            "why_this_recipe": f"Сбалансированное персональное блюдо с {title_meat} и соусом под ваш кухонный сетап.",
            "generator": "mock",
            "model": "offline-rules",
            "provider_name": "Оффлайн-движок FridgeChef",
        }

    async def refine_recipe_suggestion(
        self,
        current_recipe: Dict[str, Any],
        refinement_prompt: str,
        taste_profile: Optional[Dict[str, Any]] = None,
        pantry_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        import copy
        import re
        recipe = copy.deepcopy(current_recipe)
        prompt_lower = refinement_prompt.lower().strip()

        why_parts = []

        # 1. Salt reduction
        if any(w in prompt_lower for w in ("соль", "солен", "соли", "пересол", "пресн", "менее солен")):
            for ing in recipe.get("ingredients", []):
                name = ing.get("name", "").lower()
                if any(s in name for s in ("соев", "соль", "kikkoman", "соус")):
                    qty = ing.get("quantity")
                    if qty is not None:
                        ing["quantity"] = max(0.5, round(float(qty) * 0.5, 1))
                    ing["preparation_note"] = (ing.get("preparation_note") or "") + " (снижено по вашей просьбе)"
            why_parts.append("Уменьшена соленость (дозировка соевого соуса/соли снижена)")

        # 2. Sauce volume increase
        if any(w in prompt_lower for w in ("соус", "подлив", "жидк", "сочнее")) and not any(w in prompt_lower for w in ("меньше", "убав")):
            for ing in recipe.get("ingredients", []):
                if ing.get("role") == "main_sauce" or "соус" in ing.get("name", "").lower():
                    qty = ing.get("quantity")
                    if qty is not None:
                        ing["quantity"] = round(float(qty) * 1.4, 1)
            why_parts.append("Увеличен объем соуса")

        # 3. Sweetness
        if any(w in prompt_lower for w in ("слад", "сахар", "мед")):
            found_sweet = False
            for ing in recipe.get("ingredients", []):
                if any(sw in ing.get("name", "").lower() for sw in ("мёд", "сахар", "sweet")):
                    qty = ing.get("quantity")
                    if qty is not None:
                        ing["quantity"] = round(float(qty) * 1.5, 1)
                    found_sweet = True
            if not found_sweet:
                recipe.get("ingredients", []).append({
                    "name": "Мёд Clever",
                    "quantity": 1.0,
                    "unit": "tsp",
                    "role": "main_sauce",
                    "preparation_note": "для карамелизации и сладости",
                    "scalable": True,
                })
            why_parts.append("Добавлена приятная сладость")

        # 4. Spiciness
        if any(w in prompt_lower for w in ("остр", "пикант", "перец", "чили")):
            recipe.get("ingredients", []).append({
                "name": "Кайенский перец / чили",
                "quantity": 1.0,
                "unit": "pinch",
                "role": "optional",
                "preparation_note": "для пикантной остроты",
                "scalable": False,
            })
            why_parts.append("Добавлена пикантная острота")

        # 5. Add custom ingredient
        add_match = re.search(r"(?:добавь|добавить|плюс|положи|включи|насыпь|налей)\s+([a-zA-Zа-яА-ЯёЁ\s\-]+)", prompt_lower)
        if add_match:
            candidate = add_match.group(1).strip()
            for noise in ("пожалуйста", "еще", "немного", "чуть-чуть", "в блюдо", "в рецепт"):
                candidate = candidate.replace(noise, "").strip()
            if candidate and len(candidate) > 2 and not any(w in candidate for w in ("соус", "соль", "острот", "сладост")):
                display_name = candidate.capitalize()
                is_pcs = any(u in candidate for u in ("зуб", "шт", "луковиц", "яйц"))
                recipe.get("ingredients", []).append({
                    "name": display_name,
                    "quantity": 1.0 if is_pcs else 100.0,
                    "unit": "pcs" if is_pcs else "g",
                    "role": "required",
                    "preparation_note": "добавлено по вашей просьбе",
                    "scalable": True,
                    "availability": "in_stock",
                })
                steps = recipe.get("steps", [])
                steps.append({
                    "step_number": len(steps) + 1,
                    "instruction": f"Дополнительный ингредиент: подготовьте {display_name.lower()} и добавьте в сковороду/вок вместе с остальными ингредиентами.",
                    "duration_seconds": 60,
                })
                why_parts.append(f"Добавлен ингредиент '{display_name}'")

        if not why_parts:
            why_parts.append(f"Скорректировано по запросу: {refinement_prompt}")

        recipe["why_this_recipe"] = f"Правка шефа: {'; '.join(why_parts)}."
        recipe["generator"] = "mock"
        recipe["model"] = "offline-rules"
        recipe["provider_name"] = "Оффлайн-движок FridgeChef"
        return recipe


    async def suggest_adaptation(
        self,
        original_recipe: Dict[str, Any],
        review: Dict[str, Any],
        taste_profile: Dict[str, Any],
    ) -> Dict[str, Any]:
        saltiness = review.get("saltiness_rating", 3)
        comment = review.get("comment", "")

        adjustments = []
        if saltiness >= 4:
            adjustments.append("Уменьшено количество соевого соуса на 40% и добавлено 20 мл воды для снижения солености.")
        if review.get("sauce_amount_rating", 3) <= 2:
            adjustments.append("Объем соуса увеличен на 30%.")

        reason = "; ".join(adjustments) if adjustments else f"Корректировка по отзыву: {comment}"

        return {
            "reason": reason,
            "modified_ingredients": original_recipe.get("ingredients", []),
            "modified_steps": original_recipe.get("steps", []),
        }
