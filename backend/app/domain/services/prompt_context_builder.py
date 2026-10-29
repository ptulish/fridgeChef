import json
from typing import Dict, Any, List, Optional, Tuple


DEFAULT_STAPLES = [
    {"name": "Соль", "category": "spices", "default_unit": "pinch"},
    {"name": "Чёрный перец", "category": "spices", "default_unit": "pinch"},
    {"name": "Растительное масло", "category": "oils", "default_unit": "tbsp"},
    {"name": "Сахар", "category": "baking", "default_unit": "tsp"},
    {"name": "Вода", "category": "liquids", "default_unit": "ml"},
    {"name": "Соевый соус", "category": "sauces", "default_unit": "tbsp"},
    {"name": "Мука", "category": "baking", "default_unit": "tbsp"},
    {"name": "Чеснок", "category": "vegetables", "default_unit": "clove"},
]

ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}

SATIETY_MULTIPLIERS = {
    "light": 0.65,
    "standard": 1.0,
    "hearty": 1.4,
}


def calculate_daily_kcal(
    weight_kg: Optional[float],
    height_cm: Optional[float],
    activity_level: str = "moderate",
    age: int = 30,
    sex: str = "male",
) -> Optional[int]:
    if not weight_kg or not height_cm:
        return None
    # Mifflin-St Jeor equation
    base = 10.0 * float(weight_kg) + 6.25 * float(height_cm) - 5.0 * age
    bmr = base + 5 if sex == "male" else base - 161
    multiplier = ACTIVITY_MULTIPLIERS.get(activity_level, 1.4)
    return int(round(bmr * multiplier))


def calculate_target_meal_kcal(
    daily_kcal: Optional[int],
    meals_per_day: int = 3,
    satiety_level: str = "standard",
) -> Optional[int]:
    if not daily_kcal:
        return None
    meals = max(1, meals_per_day)
    base_meal = daily_kcal / meals
    mult = SATIETY_MULTIPLIERS.get(satiety_level, 1.0)
    return int(round(base_meal * mult))


class PromptContextBuilder:
    """
    Builds clean, deterministic prompt payloads for Gemini
    using short inventory references (i1, i2, s1) and user culinary DNA.
    """

    @staticmethod
    def build_context(
        pantry_items: List[Dict[str, Any]],
        taste_profile: Dict[str, Any],
        prompt: Optional[str] = None,
        mode: Optional[str] = None,
        satiety_level: str = "standard",
        recent_feedback: Optional[List[str]] = None,
        staples: Optional[List[Dict[str, Any]]] = None,
        marinate_meat: Optional[bool] = False,
        marinate_duration_minutes: Optional[int] = None,
        must_use_ingredients: Optional[List[str]] = None,
    ) -> Tuple[str, str, Dict[str, Dict[str, Any]]]:
        """
        Returns:
            (system_instruction, user_content_json, ref_map)
        """
        if staples is None:
            staples = DEFAULT_STAPLES

        # 1. Map inventory items to short refs (i1, i2...)
        ref_map: Dict[str, Dict[str, Any]] = {}
        compact_inventory = []
        i_counter = 1
        for item in pantry_items:
            # Skip items explicitly marked out_of_stock if not relevant
            status = item.get("status", "in_stock")
            ref = f"i{i_counter}"
            i_counter += 1
            ref_map[ref] = item

            entry = {
                "ref": ref,
                "name": item.get("name", "Продукт"),
                "status": status,
            }
            if item.get("quantity") is not None:
                entry["qty"] = float(item["quantity"])
                entry["unit"] = item.get("unit", "g")
            if item.get("fuzzy_level"):
                entry["fuzzy"] = item["fuzzy_level"]
            if item.get("storage_zone"):
                entry["zone"] = item["storage_zone"]
            compact_inventory.append(entry)

        # 2. Map staples to short refs (s1, s2...)
        compact_staples = []
        s_counter = 1
        for s in staples:
            ref = f"s{s_counter}"
            s_counter += 1
            ref_map[ref] = {"name": s["name"], "is_staple": True}
            compact_staples.append({"ref": ref, "name": s["name"]})

        # 3. Target portion calculation from body stats
        weight_kg = taste_profile.get("weight_kg")
        height_cm = taste_profile.get("height_cm")
        activity = taste_profile.get("activity_level", "moderate")
        meals_per_day = taste_profile.get("meals_per_day", 3)
        daily_kcal = calculate_daily_kcal(weight_kg, height_cm, activity)
        target_meal_kcal = calculate_target_meal_kcal(daily_kcal, meals_per_day, satiety_level)

        # 4. System Instruction
        skill = taste_profile.get("skill_level", "home_cook")
        equipment = taste_profile.get("equipment", ["wok", "oven", "stove"])
        allergies = taste_profile.get("allergies", [])
        dislikes = taste_profile.get("disliked_ingredients", ["грибы", "болгарский перец"])
        flavor_params = taste_profile.get("flavor_params", {})
        salt_adj = flavor_params.get("salt", 0)
        sauce_adj = flavor_params.get("sauce_volume", 1)

        marinate_instruction = ""
        if marinate_meat:
            dur = marinate_duration_minutes or 20
            marinate_instruction = f"""
7. ТРЕБОВАНИЕ МАРИНОВАНИЯ: Пользователь хочет предварительно замариновать мясо на {dur} минут.
   - Обязательно добавь отдельный шаг маринования с указанием времени (duration_seconds: {dur * 60}).
   - Ингредиенты, входящие в маринад (соус, специи, крахмал/масло), обязательно пометь ролью role: 'marinade'."""

        must_use_instruction = ""
        if must_use_ingredients:
            items_str = ", ".join(must_use_ingredients)
            must_use_instruction = f"""
8. ОБЯЗАТЕЛЬНЫЕ ПРОДУКТЫ ИЗ ХОЛОДИЛЬНИКА: Пользователь выбрал следующие продукты, которые ОБЯЗАНЫ быть включены в рецепт:
   [{items_str}].
   Строго используй их в составе ингредиентов и шагах приготовления!"""

        system_instruction = f"""Ты — персональный шеф-повар и гастрономический ассистент FridgeChef.
Твоя цель — создавать точные, вкусные домашние рецепты с привязкой к имеющимся продуктам.

КУЛИНАРНЫЙ ДНК ПОЛЬЗОВАТЕЛЯ:
- Уровень мастерства: {skill}
- Доступное кухонное оборудование: {', '.join(equipment)} (Используй ТОЛЬКО доступное оборудование!)
- СТРОГИЕ АЛЛЕРГИИ И ЗАПРЕТЫ: {', '.join(allergies) if allergies else 'нет'} (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать любые формы этих продуктов!)
- Нелюбимые продукты: {', '.join(dislikes)} (не использовать)
- Предпочтения по соли: {'пониженная соленость, осторожно с соевым соусом' if salt_adj <= 0 else 'умеренно'}
- Предпочтения по соусу: {'обильный соус, чтобы пропитывал гарнир' if sauce_adj >= 1 else 'умеренный соус'}

ПРАВИЛА ИСПОЛЬЗОВАНИЯ ИНВЕНТАРЯ И ССЫЛОК (REFS):
1. Каждому продукту из холодильника присвоен короткий код 'ref' (i1, i2...), а базовым продуктам — 's1', 's2'...
2. В поле 'inventory_ref' каждого ингредиента ТЫ ОБЯЗАН указать этот точный ref, если ингредиент берется из холодильника или базы.
3. Если нужного ингредиента нет в наличии — укажи inventory_ref: null и availability: 'to_buy'.
4. Базовые продукты (соль, перец, масло, вода, соевый соус) помечай availability: 'staple'.
5. ПРИОРИТЕТ ЗАПРОСА: Если пользователь указал конкретное мясо (например, говядина) или гарнир (удон) — используй их, даже если их нет в наличии (пользователь докупит).
6. РАСЧЕТ КБЖУ: Укажи в 'macros_per_serving' ориентировочные калории (kcal), белки (protein_g), жиры (fat_g) и углеводы (carbs_g) на 1 порцию.{marinate_instruction}{must_use_instruction}
"""

        # 5. User Content
        satiety_descriptions = {
            "light": "Лёгкий приём пищи / перекус (~60% от стандартной нормы)",
            "standard": "Стандартный полноценный обед/ужин (~100% нормы)",
            "hearty": "Очень сытный, плотный приём пищи / от пуза (~140% нормы)",
        }

        user_payload: Dict[str, Any] = {
            "request": prompt or "Предложи вкусное домашнее блюдо на сегодня",
            "active_mode": mode or taste_profile.get("active_mode", "comfort_food"),
            "satiety_level": satiety_level,
            "satiety_description": satiety_descriptions.get(satiety_level, "Стандартная сытная порция"),
            "inventory": compact_inventory,
            "staples": compact_staples,
        }

        if marinate_meat:
            user_payload["marinate_meat"] = True
            user_payload["marinate_duration_minutes"] = marinate_duration_minutes or 20

        if must_use_ingredients:
            user_payload["must_use_ingredients"] = must_use_ingredients

        if target_meal_kcal:
            user_payload["target_meal_calories"] = target_meal_kcal

        if recent_feedback:
            user_payload["recent_feedback"] = recent_feedback[-3:]


        user_content_json = json.dumps(user_payload, ensure_ascii=False, indent=2)
        return system_instruction, user_content_json, ref_map
