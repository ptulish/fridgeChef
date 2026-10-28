import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import select
from app.infrastructure.db.session import engine, async_session_factory
from app.infrastructure.db.models import (
    Base,
    UserModel,
    UserTasteProfileModel,
    IngredientModel,
    PantryItemModel,
    RecipeModel,
    RecipeSourceModel,
    RecipeVersionModel,
    RecipeIngredientModel,
    RecipeStepModel,
)
from app.domain.services.taste_profile_updater import TasteProfileUpdaterService


async def init_models():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_data():
    async with async_session_factory() as session:
        # Check if already seeded
        result = await session.execute(select(UserModel))
        existing_user = result.scalars().first()
        if existing_user:
            print("Database already initialized and contains users. Skipping seed.")
            return

        print("Seeding initial data for FridgeChef...")

        # 1. Default User
        user = UserModel(
            id=str(uuid.uuid4()),
            email="chef@fridgechef.local",
            name="Chef",
            auth_subject="local_dev_chef",
        )
        session.add(user)
        await session.flush()

        # 2. User Taste Profile Card
        taste_profile_data = {
            "meat_preferences": {
                "beef": True,
                "pork": True,
                "chicken": "conditional",
                "fish": True,
                "german_sausages": True,
                "russian_sausages": False,
            },
            "favorite_cuisines": ["wok", "noodles", "bolognese", "homestyle"],
            "sauce_preference": {
                "sauce_volume": "abundant",
                "separate_marinade": True,
                "sweet_sour_garlic": True,
                "note": "Много соуса для покрытия мяса и лапши",
            },
            "salt_sensitivity": "high",
            "disliked_ingredients": ["грибы", "болгарский перец"],
            "equipment": ["сковорода", "мультиварка", "духовка"],
            "habits": {
                "default_meat_portion_g": 200,
                "exact_measurements": True,
                "salt_rule": "Высокая чувствительность к соли: не солить готовые блюда, разбавлять соевый соус водой, пробовать перед подачей.",
            },
        }
        ai_summary = TasteProfileUpdaterService.generate_ai_summary(taste_profile_data)

        profile = UserTasteProfileModel(
            user_id=user.id,
            meat_preferences=taste_profile_data["meat_preferences"],
            favorite_cuisines=taste_profile_data["favorite_cuisines"],
            sauce_preference=taste_profile_data["sauce_preference"],
            salt_sensitivity="high",
            disliked_ingredients=taste_profile_data["disliked_ingredients"],
            equipment=taste_profile_data["equipment"],
            habits=taste_profile_data["habits"],
            ai_profile_summary=ai_summary,
        )
        session.add(profile)

        # 3. Canonical Ingredients
        ingredients_data = [
            # Sauces & Condiments
            ("Яблочный уксус", "sauce", "ml", Decimal("1.0")),
            ("Kikkoman соевый соус", "sauce", "ml", Decimal("1.1")),
            ("Shan’shi Wok Sauce", "sauce", "ml", Decimal("1.1")),
            ("Go-Tan Wok Teriyaki", "sauce", "ml", Decimal("1.15")),
            ("OBAP Sweet & Sour", "sauce", "ml", Decimal("1.2")),
            ("Shan’shi Sweet Chili", "sauce", "ml", Decimal("1.15")),
            ("Kikkoman кунжутное масло", "oil", "ml", Decimal("0.92")),
            ("Растительное масло", "oil", "ml", Decimal("0.92")),
            ("Мёд Clever", "staple", "ml", Decimal("1.4")),
            ("Maizena кукурузный крахмал", "staple", "g", None),
            ("BILLA Wok Gewürzzubereitung", "spice", "g", None),
            ("Кайенский перец", "spice", "g", None),
            ("Соль", "spice", "g", None),
            ("Чёрный перец", "spice", "g", None),
            ("Чеснок", "produce", "clove", None),
            ("Лук репчатый", "produce", "pcs", None),
            ("Панко (панировочные сухари)", "staple", "g", None),
            ("Куриные яйца", "staple", "pcs", None),
            # Noodles & Staples
            ("Рисовая лапша Bánh Phở 5 мм", "noodles", "g", None),
            ("Сухая удон-лапша", "noodles", "g", None),
            ("Спагетти", "staple", "g", None),
            # Meat
            ("Куриное филе / шницель", "meat", "g", None),
            ("Свинина для гуляша (Schwein-Gulaschfleisch)", "meat", "g", None),
            ("Говядина", "meat", "g", None),
        ]

        ingredient_map = {}
        for name, cat, unit, dens in ingredients_data:
            ing = IngredientModel(
                canonical_name=name,
                category=cat,
                default_unit=unit,
                density_g_per_ml=dens,
            )
            session.add(ing)
            ingredient_map[name] = ing

        await session.flush()

        # 4. User Pantry Initial Import
        # Important rule: Apple cider vinegar is confirmed as in_stock on 2026-10-22 (qty unknown).
        # All others are needs_confirmation!
        now_dt = datetime(2026, 10, 22, 20, 0, 0, tzinfo=timezone.utc)

        pantry_seed = [
            ("Яблочный уксус", None, "ml", "in_stock", now_dt, "Подтверждено пользователем 22.10.2026"),
            ("Kikkoman соевый соус", None, "ml", "needs_confirmation", None, "Ранее упоминался; проверить остаток"),
            ("Shan’shi Wok Sauce", None, "ml", "needs_confirmation", None, "Упоминался в недавних рецептах"),
            ("Go-Tan Wok Teriyaki", None, "ml", "needs_confirmation", None, "Ранее упоминался среди соусов"),
            ("OBAP Sweet & Sour", None, "ml", "needs_confirmation", None, "Использовался при согласовании рецепта"),
            ("Shan’shi Sweet Chili", None, "ml", "needs_confirmation", None, "Ранее упоминался"),
            ("Kikkoman кунжутное масло", None, "ml", "needs_confirmation", None, "Ранее упоминалось"),
            ("Мёд Clever", None, "ml", "needs_confirmation", None, "Ранее упоминался"),
            ("Maizena кукурузный крахмал", None, "g", "needs_confirmation", None, "Упоминался в недавнем рецепте"),
            ("BILLA Wok Gewürzzubereitung", None, "g", "needs_confirmation", None, "Приправа для вока"),
            ("Кайенский перец", None, "g", "needs_confirmation", None, "Упоминался в недавнем рецепте"),
            ("Рисовая лапша Bánh Phở 5 мм", None, "g", "needs_confirmation", None, "Упоминалась среди продуктов"),
            ("Панко (панировочные сухари)", None, "g", "needs_confirmation", None, "Ранее покупались для курицы"),
            ("Чеснок", None, "clove", "needs_confirmation", None, "Регулярно используется"),
            ("Лук репчатый", None, "pcs", "needs_confirmation", None, "Регулярно используется"),
            ("Соль", None, "g", "needs_confirmation", None, "Базовая специя"),
            ("Чёрный перец", None, "g", "needs_confirmation", None, "Базовая специя"),
            ("Растительное масло", None, "ml", "needs_confirmation", None, "Базовое масло для жарки"),
            ("Куриное филе / шницель", None, "g", "needs_confirmation", None, "Упоминалась упаковка ~490г; остаток неизвестен"),
            ("Свинина для гуляша (Schwein-Gulaschfleisch)", None, "g", "needs_confirmation", None, "Упоминалось ~518г; остаток неизвестен"),
            ("Сухая удон-лапша", None, "g", "needs_confirmation", None, "Ранее упоминалась"),
            ("Спагетти", None, "g", "needs_confirmation", None, "Обсуждались для болоньезе"),
        ]

        for ing_name, qty, unit, status, confirmed_at, note in pantry_seed:
            ing_obj = ingredient_map.get(ing_name)
            if ing_obj:
                p_item = PantryItemModel(
                    user_id=user.id,
                    ingredient_id=ing_obj.id,
                    quantity=qty,
                    unit=unit,
                    status=status,
                    last_confirmed_at=confirmed_at,
                    source="historical_context",
                    notes=note,
                )
                session.add(p_item)

        # 5. Seed Baseline Recipes
        # Recipe 1: Chinese Chicken Wok with Rice Noodles (C3)
        r1 = RecipeModel(
            owner_user_id=None,
            title="Китайский вок с курицей и рисовой лапшой",
            description="Согласованный рецепт с обильным соусом, балансом сладко-кислого вкуса и разделением маринада и основного соуса.",
            cuisine="Китайская",
            difficulty="medium",
            duration_minutes=35,
            base_servings=1,
            visibility="shared",
        )
        session.add(r1)
        await session.flush()

        src1 = RecipeSourceModel(
            recipe_id=r1.id,
            source_type="historical_context",
            source_name="Согласованный рецепт от 22 октября 2026 г.",
            attribution="Разработан на 200г курицы с учетом пожелания обильного соуса и контроля солености.",
        )
        session.add(src1)

        v1 = RecipeVersionModel(
            recipe_id=r1.id,
            version_number=1,
            change_summary="Оригинальная предложенная версия от 22.10.2026. Ожидает фактического приготовления и отзыва.",
            is_base_version=True,
        )
        session.add(v1)
        await session.flush()

        r1_ingredients = [
            # Main items
            ("Куриное филе / шницель", Decimal("200"), "g", "required", "нарезать тонкими полосками или кусочками на один укус", True),
            ("Рисовая лапша Bánh Phở 5 мм", Decimal("80"), "g", "required", "замочить/отварить по инструкции", True),
            ("Лук репчатый", Decimal("0.3"), "pcs", "required", "нарезать полукольцами или перьями", True),
            ("Чеснок", Decimal("2"), "clove", "required", "мелко измельчить ножом", True),
            ("Растительное масло", Decimal("1"), "tbsp", "required", "для обжарки на сильном огне", False),
            ("Kikkoman кунжутное масло", Decimal("0.5"), "tsp", "garnish", "добавить в самом конце для аромата", False),
            # Marinade
            ("Kikkoman соевый соус", Decimal("1"), "tsp", "marinade", "маринад для курицы (5 мл)", True),
            ("Shan’shi Wok Sauce", Decimal("1"), "tsp", "marinade", "маринад для курицы (5 мл)", True),
            ("Maizena кукурузный крахмал", Decimal("1"), "tsp", "marinade", "для удержания соков в мясе", True),
            ("BILLA Wok Gewürzzubereitung", Decimal("0.25"), "tsp", "marinade", "приправа для вока", True),
            ("Чёрный перец", Decimal("1"), "pinch", "marinade", "по вкусу в маринад", False),
            # Main sauce
            ("Shan’shi Wok Sauce", Decimal("1.5"), "tbsp", "main_sauce", "основа соуса (~22 мл)", True),
            ("Kikkoman соевый соус", Decimal("2"), "tsp", "main_sauce", "основа соуса (10 мл)", True),
            ("OBAP Sweet & Sour", Decimal("2"), "tsp", "main_sauce", "сладко-кислый акцент (10 мл)", True),
            ("Мёд Clever", Decimal("1"), "tsp", "main_sauce", "для баланса и глазирования", True),
            ("Maizena кукурузный крахмал", Decimal("1.5"), "tsp", "main_sauce", "для бархатистого загущения", True),
            ("Яблочный уксус", Decimal("0.5"), "tsp", "main_sauce", "легкая фруктовая кислинка (2.5 мл)", True),
            ("Кайенский перец", Decimal("1"), "pinch", "optional", "острота по желанию (маленькая щепотка)", False),
        ]

        for ing_name, qty, unit, role, prep, scalable in r1_ingredients:
            ing_obj = ingredient_map.get(ing_name)
            ring = RecipeIngredientModel(
                recipe_version_id=v1.id,
                ingredient_id=ing_obj.id if ing_obj else None,
                ingredient_name_snapshot=ing_name,
                quantity=qty,
                unit=unit,
                role=role,
                preparation_note=prep,
                scalable=scalable,
            )
            session.add(ring)

        r1_steps = [
            (1, "Маринование: Нарежьте курицу кусочками на один укус. Смешайте соевый соус (1 ч.л.), вок-соус (1 ч.л.), крахмал (1 ч.л.), воду (1 ч.л.), приправу вок и перец. Перемешайте с курицей и оставьте на 15–20 минут.", 900, None),
            (2, "Подготовка лапши: Приготовьте рисовую лапшу Bánh Phở согласно инструкции (замочите или отварите до состояния аль-денте), промойте холодной водой и откиньте на дуршлаг.", 300, None),
            (3, "Основной соус: В отдельной миске соедините вок-соус (1.5 ст.л.), соевый соус (2 ч.л.), сладкий соус OBAP (2 ч.л.), мед (1 ч.л.), яблочный уксус (0.5 ч.л.), крахмал (1.5 ч.л.) и 90 мл холодной воды. Тщательно размешайте венчиком или вилкой до полного растворения крахмала.", 180, None),
            (4, "Жарка курицы: Разогрейте сковороду на сильном огне с растительным маслом. Выложите курицу в один слой и обжаривайте 4–5 минут до красивой румяной корочки и полной готовности. Переложите на тарелку.", 300, None),
            (5, "Овощи и соус: В той же сковороде быстро обжарьте нарезанный лук и чеснок (1–2 минуты). Перемешайте соус (крахмал мог осесть) и вылейте в сковороду. Помешивая, доведите до легкого кипения и загустения (30-60 секунд). Если соус кажется слишком густым, добавьте 1-2 ст. л. воды.", 120, None),
            (6, "Финальная сборка: Верните курицу и лапшу в сковороду с горячим соусом. Аккуратно прогрейте все вместе 1 минуту, чтобы соус равномерно покрыл лапшу и мясо. Снимите с огня, сбрызните кунжутным маслом (0.5 ч.л.) и подавайте!", 60, None),
        ]

        for s_num, inst, dur, temp in r1_steps:
            step = RecipeStepModel(
                recipe_version_id=v1.id,
                step_number=s_num,
                instruction=inst,
                duration_seconds=dur,
                temperature_c=temp,
            )
            session.add(step)

        # Recipe 2: Crispy Panko Chicken (C2)
        r2 = RecipeModel(
            owner_user_id=None,
            title="Хрустящая курица в панировке панко",
            description="Технологически выверенный рецепт курицы в сухарях панко с надёжной фиксацией панировки.",
            cuisine="Домашняя / Азиатская",
            difficulty="easy",
            duration_minutes=25,
            base_servings=1,
            visibility="shared",
        )
        session.add(r2)
        await session.flush()

        src2 = RecipeSourceModel(
            recipe_id=r2.id,
            source_type="historical_context",
            source_name="Кулинарный опыт пользователя",
            attribution="Специальная технология двойной фиксации сухарей панко.",
        )
        session.add(src2)

        v2 = RecipeVersionModel(
            recipe_id=r2.id,
            version_number=1,
            change_summary="Базовая технологическая версия с инструкцией против осыпания панировки.",
            is_base_version=True,
        )
        session.add(v2)
        await session.flush()

        r2_ingredients = [
            ("Куриное филе / шницель", Decimal("200"), "g", "required", "обсушить бумажным полотенцем", True),
            ("Maizena кукурузный крахмал", Decimal("2"), "tbsp", "required", "для создания сухого базового слоя", True),
            ("Куриные яйца", Decimal("1"), "pcs", "required", "взбить вилкой со щепоткой соли", True),
            ("Панко (панировочные сухари)", Decimal("60"), "g", "required", "крупные японские хлопья", True),
            ("Растительное масло", Decimal("3"), "tbsp", "required", "для жарки", False),
            ("Соль", Decimal("0.5"), "tsp", "spice", "для курицы и яйца", False),
            ("Чёрный перец", Decimal("1"), "pinch", "spice", "по вкусу", False),
        ]

        for ing_name, qty, unit, role, prep, scalable in r2_ingredients:
            ing_obj = ingredient_map.get(ing_name)
            ring = RecipeIngredientModel(
                recipe_version_id=v2.id,
                ingredient_id=ing_obj.id if ing_obj else None,
                ingredient_name_snapshot=ing_name,
                quantity=qty,
                unit=unit,
                role=role,
                preparation_note=prep,
                scalable=scalable,
            )
            session.add(ring)

        r2_steps = [
            (1, "Подготовка мяса: Тщательно промокните куриное филе бумажными полотенцами. Лишняя влага — главная причина, почему панко сползает при жарке.", 120, None),
            (2, "Базовый слой: Натрите курицу солью и перцем, затем обваляйте в кукурузном крахмале или муке, стряхнув излишки. Поверхность должна быть матовой и сухой.", 180, None),
            (3, "Яйцо и сухари: Окуните филе во взбитое яйцо, затем щедро обваляйте в сухарях панко, аккуратно прижимая сухари ладонью к мясу.", 180, None),
            (4, "Отдых панировки (СЕКРЕТ): Оставьте запанированную курицу на тарелке на 5 минут перед жаркой. Это позволит яйцу и крахмалу образовать плотную связку с сухарями.", 300, None),
            (5, "Обжарка: Разогрейте растительное масло на среднем огне. Жарьте курицу по 3–4 минуты с каждой стороны до золотистой хрустящей корочки. Не перегружайте сковороду!", 480, None),
        ]

        for s_num, inst, dur, temp in r2_steps:
            step = RecipeStepModel(
                recipe_version_id=v2.id,
                step_number=s_num,
                instruction=inst,
                duration_seconds=dur,
                temperature_c=temp,
            )
            session.add(step)

        # Recipe 3: Pork Wok with Rice Noodles (C1 - with salt warning)
        r3 = RecipeModel(
            owner_user_id=None,
            title="Вок со свининой и рисовой лапшой (низкосолевая версия)",
            description="Домашний вок со свининой и рисовой лапшой. Пропорция соевого соуса оптимизирована по результатам предыдущего приготовления, чтобы не пересолить блюдо.",
            cuisine="Китайская",
            difficulty="medium",
            duration_minutes=35,
            base_servings=1,
            visibility="shared",
        )
        session.add(r3)
        await session.flush()

        src3 = RecipeSourceModel(
            recipe_id=r3.id,
            source_type="historical_context",
            source_name="Адаптация исторического приготовления C1",
            attribution="В прошлом приготовлении блюдо получилось пересоленным. В данной базовой версии соевый соус уменьшен, соль не добавляется, рекомендуется разбавлять соус водой.",
        )
        session.add(src3)

        v3 = RecipeVersionModel(
            recipe_id=r3.id,
            version_number=1,
            change_summary="Начальная адаптация по отзыву 'слишком солено': соевый соус снижен на 40%, дополнительная вода для соуса.",
            is_base_version=True,
        )
        session.add(v3)
        await session.flush()

        r3_ingredients = [
            ("Свинина для гуляша (Schwein-Gulaschfleisch)", Decimal("200"), "g", "required", "нарезать тонкими брусочками поперек волокон", True),
            ("Рисовая лапша Bánh Phở 5 мм", Decimal("80"), "g", "required", "отварить до полуготовности", True),
            ("Лук репчатый", Decimal("0.3"), "pcs", "required", "нарезать перьями", True),
            ("Чеснок", Decimal("2"), "clove", "required", "мелко порубить", True),
            ("Растительное масло", Decimal("1"), "tbsp", "required", "для жарки", False),
            ("Kikkoman кунжутное масло", Decimal("0.5"), "tsp", "garnish", "для аромата", False),
            ("Shan’shi Wok Sauce", Decimal("1.5"), "tbsp", "main_sauce", "основной соус", True),
            ("Kikkoman соевый соус", Decimal("1.5"), "tsp", "main_sauce", "уменьшенная дозировка для контроля соли", True),
            ("Яблочный уксус", Decimal("0.5"), "tsp", "main_sauce", "кислинка", True),
            ("Мёд Clever", Decimal("1"), "tsp", "main_sauce", "сладость", True),
            ("Maizena кукурузный крахмал", Decimal("1"), "tsp", "main_sauce", "для загущения", True),
        ]

        for ing_name, qty, unit, role, prep, scalable in r3_ingredients:
            ing_obj = ingredient_map.get(ing_name)
            ring = RecipeIngredientModel(
                recipe_version_id=v3.id,
                ingredient_id=ing_obj.id if ing_obj else None,
                ingredient_name_snapshot=ing_name,
                quantity=qty,
                unit=unit,
                role=role,
                preparation_note=prep,
                scalable=scalable,
            )
            session.add(ring)

        r3_steps = [
            (1, "Подготовка свинины: Нарежьте свинину тонкими полосками. Замаринуйте в 1 ч.л. вок-соуса и 0.5 ч.л. крахмала на 10 минут.", 600, None),
            (2, "Соус (контроль соли): Смешайте соевый соус, вок-соус, уксус, мед, крахмал и 80 мл воды. Обязательно попробуйте соус на кончике ложки перед готовкой!", 120, None),
            (3, "Обжарка: Быстро обжарьте свинину на сильном огне до готовности, переложите на тарелку.", 300, None),
            (4, "Сборка: Обжарьте лук и чеснок, влейте соус, доведите до загустения, соедините с лапшой и свининой.", 180, None),
        ]

        for s_num, inst, dur, temp in r3_steps:
            step = RecipeStepModel(
                recipe_version_id=v3.id,
                step_number=s_num,
                instruction=inst,
                duration_seconds=dur,
                temperature_c=temp,
            )
            session.add(step)

        await session.commit()
        print("Database seeded successfully with user, taste profile card, canonical ingredients, pantry, and 3 base recipes!")


async def sync_staples_and_zones():
    from sqlalchemy.orm import selectinload
    async with async_session_factory() as session:
        stmt = select(PantryItemModel).options(selectinload(PantryItemModel.ingredient))
        res = await session.execute(stmt)
        items = res.scalars().all()
        for p in items:
            name = (p.ingredient.canonical_name if p.ingredient else "").lower()
            if any(s in name for s in ("соль", "перец", "масло растительное", "сахар", "вода", "чеснок", "соевый соус", "мука")):
                p.is_staple = True
                p.status = "in_stock"
            if not p.storage_zone or p.storage_zone == "fridge":
                if any(k in name for k in ("мороз", "фарш", "заморож", "свинина")):
                    p.storage_zone = "freezer"
                elif any(k in name for k in ("лапша", "удон", "рис", "спагетти", "макарон", "мука", "сахар", "перец", "соль", "сухари")):
                    p.storage_zone = "pantry"
                else:
                    p.storage_zone = "fridge"
        await session.commit()


async def main():
    await init_models()
    await seed_data()
    await sync_staples_and_zones()


if __name__ == "__main__":
    asyncio.run(main())
