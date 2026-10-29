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
            ("Соевый соус", "sauce", "ml", Decimal("1.1")),
            ("Вок соус", "sauce", "ml", Decimal("1.1")),
            ("Соус Терияки", "sauce", "ml", Decimal("1.15")),
            ("Кисло-сладкий соус", "sauce", "ml", Decimal("1.2")),
            ("Сладкий чили соус", "sauce", "ml", Decimal("1.15")),
            ("Кунжутное масло", "oil", "ml", Decimal("0.92")),
            ("Растительное масло", "oil", "ml", Decimal("0.92")),
            ("Мёд", "staple", "ml", Decimal("1.4")),
            ("Кукурузный крахмал", "staple", "g", None),
            ("Приправа для вока", "spice", "g", None),
            ("Кайенский перец", "spice", "g", None),
            ("Соль", "spice", "g", None),
            ("Чёрный перец", "spice", "g", None),
            ("Чеснок", "produce", "clove", None),
            ("Лук репчатый", "produce", "pcs", None),
            ("Панировочные сухари", "staple", "g", None),
            ("Куриные яйца", "staple", "pcs", None),
            # Noodles & Staples
            ("Рисовая лапша", "noodles", "g", None),
            ("Сухая удон-лапша", "noodles", "g", None),
            ("Спагетти", "staple", "g", None),
            # Meat
            ("Куриное филе", "meat", "g", None),
            ("Свинина (гуляш)", "meat", "g", None),
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
        now_dt = datetime(2026, 10, 22, 20, 0, 0, tzinfo=timezone.utc)

        pantry_seed = [
            ("Яблочный уксус", None, "ml", "in_stock", now_dt, "Подтверждено пользователем"),
            ("Соевый соус", None, "ml", "needs_confirmation", None, "Проверить остаток"),
            ("Вок соус", None, "ml", "needs_confirmation", None, "Соус для обжарки"),
            ("Соус Терияки", None, "ml", "needs_confirmation", None, "Сладковатый соус"),
            ("Кисло-сладкий соус", None, "ml", "needs_confirmation", None, "Для вока"),
            ("Сладкий чили соус", None, "ml", "needs_confirmation", None, "Для подачи"),
            ("Кунжутное масло", None, "ml", "needs_confirmation", None, "Ароматное масло"),
            ("Мёд", None, "ml", "needs_confirmation", None, "Натуральный мёд"),
            ("Кукурузный крахмал", None, "g", "needs_confirmation", None, "Для соусов"),
            ("Приправа для вока", None, "g", "needs_confirmation", None, "Пряная смесь"),
            ("Кайенский перец", None, "g", "needs_confirmation", None, "Острая специя"),
            ("Рисовая лапша", None, "g", "needs_confirmation", None, "Для вока и супов"),
            ("Панировочные сухари", None, "g", "needs_confirmation", None, "Для панировки"),
            ("Чеснок", None, "clove", "needs_confirmation", None, "Свежий чеснок"),
            ("Лук репчатый", None, "pcs", "needs_confirmation", None, "Базовый овощ"),
            ("Соль", None, "g", "needs_confirmation", None, "Базовая специя"),
            ("Чёрный перец", None, "g", "needs_confirmation", None, "Базовая специя"),
            ("Растительное масло", None, "ml", "needs_confirmation", None, "Масло для жарки"),
            ("Куриное филе", None, "g", "needs_confirmation", None, "Остаток уточнить"),
            ("Свинина (гуляш)", None, "g", "needs_confirmation", None, "Остаток уточнить"),
            ("Сухая удон-лапша", None, "g", "needs_confirmation", None, "Пшеничная лапша"),
            ("Спагетти", None, "g", "needs_confirmation", None, "Паста"),
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
            ("Куриное филе", Decimal("200"), "g", "required", "нарезать тонкими полосками или кусочками на один укус", True),
            ("Рисовая лапша", Decimal("80"), "g", "required", "замочить/отварить по инструкции", True),
            ("Лук репчатый", Decimal("0.3"), "pcs", "required", "нарезать полукольцами или перьями", True),
            ("Чеснок", Decimal("2"), "clove", "required", "мелко измельчить ножом", True),
            ("Растительное масло", Decimal("1"), "tbsp", "required", "для обжарки на сильном огне", False),
            ("Кунжутное масло", Decimal("0.5"), "tsp", "garnish", "добавить в самом конце для аромата", False),
            # Marinade
            ("Соевый соус", Decimal("1"), "tsp", "marinade", "маринад для курицы (5 мл)", True),
            ("Вок соус", Decimal("1"), "tsp", "marinade", "маринад для курицы (5 мл)", True),
            ("Кукурузный крахмал", Decimal("1"), "tsp", "marinade", "для удержания соков в мясе", True),
            ("Приправа для вока", Decimal("0.25"), "tsp", "marinade", "приправа для вока", True),
            ("Чёрный перец", Decimal("1"), "pinch", "marinade", "по вкусу в маринад", False),
            # Main sauce
            ("Вок соус", Decimal("1.5"), "tbsp", "main_sauce", "основа соуса (~22 мл)", True),
            ("Соевый соус", Decimal("2"), "tsp", "main_sauce", "основа соуса (10 мл)", True),
            ("Кисло-сладкий соус", Decimal("2"), "tsp", "main_sauce", "сладко-кислый акцент (10 мл)", True),
            ("Мёд", Decimal("1"), "tsp", "main_sauce", "для баланса и глазирования", True),
            ("Кукурузный крахмал", Decimal("1.5"), "tsp", "main_sauce", "для бархатистого загущения", True),
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
            (2, "Подготовка лапши: Приготовьте рисовую лапшу согласно инструкции (замочите или отварите до состояния аль-денте), промойте холодной водой и откиньте на дуршлаг.", 300, None),
            (3, "Основной соус: В отдельной миске соедините вок-соус (1.5 ст.л.), соевый соус (2 ч.л.), кисло-сладкий соус (2 ч.л.), мед (1 ч.л.), яблочный уксус (0.5 ч.л.), крахмал (1.5 ч.л.) и 90 мл холодной воды. Тщательно размешайте венчиком или вилкой до полного растворения крахмала.", 180, None),
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
            ("Куриное филе", Decimal("200"), "g", "required", "обсушить бумажным полотенцем", True),
            ("Кукурузный крахмал", Decimal("2"), "tbsp", "required", "для создания сухого базового слоя", True),
            ("Куриные яйца", Decimal("1"), "pcs", "required", "взбить вилкой со щепоткой соли", True),
            ("Панировочные сухари", Decimal("60"), "g", "required", "крупные хлопья", True),
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
            (3, "Яйцо и сухари: Окуните филе во взбитое яйцо, затем щедро обваляйте в сухарях, аккуратно прижимая сухари ладонью к мясу.", 180, None),
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
            ("Свинина (гуляш)", Decimal("200"), "g", "required", "нарезать тонкими брусочками поперек волокон", True),
            ("Рисовая лапша", Decimal("80"), "g", "required", "отварить до полуготовности", True),
            ("Лук репчатый", Decimal("0.3"), "pcs", "required", "нарезать перьями", True),
            ("Чеснок", Decimal("2"), "clove", "required", "мелко порубить", True),
            ("Растительное масло", Decimal("1"), "tbsp", "required", "для жарки", False),
            ("Кунжутное масло", Decimal("0.5"), "tsp", "garnish", "для аромата", False),
            ("Вок соус", Decimal("1.5"), "tbsp", "main_sauce", "основной соус", True),
            ("Соевый соус", Decimal("1.5"), "tsp", "main_sauce", "уменьшенная дозировка для контроля соли", True),
            ("Яблочный уксус", Decimal("0.5"), "tsp", "main_sauce", "кислинка", True),
            ("Мёд", Decimal("1"), "tsp", "main_sauce", "сладость", True),
            ("Кукурузный крахмал", Decimal("1"), "tsp", "main_sauce", "для загущения", True),
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


BRAND_REPLACEMENTS = {
    "Maizena кукурузный крахмал": "Кукурузный крахмал",
    "Kikkoman соевый соус": "Соевый соус",
    "Shan’shi Wok Sauce": "Вок соус",
    "Shan'shi Wok Sauce": "Вок соус",
    "Go-Tan Wok Teriyaki": "Соус Терияки",
    "OBAP Sweet & Sour": "Кисло-сладкий соус",
    "Shan’shi Sweet Chili": "Сладкий чили соус",
    "Shan'shi Sweet Chili": "Сладкий чили соус",
    "Kikkoman кунжутное масло": "Кунжутное масло",
    "Мёд Clever": "Мёд",
    "BILLA Wok Gewürzzubereitung": "Приправа для вока",
    "Рисовая лапша Bánh Phở 5 мм": "Рисовая лапша",
    "Свинина для гуляша (Schwein-Gulaschfleisch)": "Свинина (гуляш)",
    "Куриное филе / шницель": "Куриное филе",
    "Панко (панировочные сухари)": "Панировочные сухари",
}

POPULAR_CATALOG = [
    ("Лук репчатый", "produce", "pcs"),
    ("Чеснок", "produce", "clove"),
    ("Морковь", "produce", "pcs"),
    ("Картофель", "produce", "g"),
    ("Помидоры", "produce", "pcs"),
    ("Помидоры черри", "produce", "g"),
    ("Огурцы", "produce", "pcs"),
    ("Кабачок", "produce", "pcs"),
    ("Баклажан", "produce", "pcs"),
    ("Брокколи", "produce", "g"),
    ("Цветная капуста", "produce", "g"),
    ("Белокочанная капуста", "produce", "g"),
    ("Пекинская капуста", "produce", "g"),
    ("Болгарский перец", "produce", "pcs"),
    ("Острый перец чили", "produce", "pcs"),
    ("Зеленый лук", "produce", "g"),
    ("Кинза", "produce", "g"),
    ("Укроп", "produce", "g"),
    ("Петрушка", "produce", "g"),
    ("Шпинат", "produce", "g"),
    ("Листья салата", "produce", "g"),
    ("Корень имбиря", "produce", "g"),
    ("Лимон", "produce", "pcs"),
    ("Лайм", "produce", "pcs"),
    ("Шампиньоны", "produce", "g"),
    ("Авокадо", "produce", "pcs"),
    ("Куриное филе", "meat", "g"),
    ("Куриные бёдра (филе)", "meat", "g"),
    ("Куриные голени", "meat", "g"),
    ("Индейка (филе)", "meat", "g"),
    ("Свинина", "meat", "g"),
    ("Свиная вырезка", "meat", "g"),
    ("Свинина (гуляш)", "meat", "g"),
    ("Говядина", "meat", "g"),
    ("Говяжья вырезка", "meat", "g"),
    ("Фарш домашний (говядина + свинина)", "meat", "g"),
    ("Фарш говяжий", "meat", "g"),
    ("Фарш куриный", "meat", "g"),
    ("Бекон", "meat", "g"),
    ("Сосиски", "meat", "pcs"),
    ("Ветчина", "meat", "g"),
    ("Лосось (филе)", "meat", "g"),
    ("Белая рыба (филе трески/минтая)", "meat", "g"),
    ("Креветки очищенные", "meat", "g"),
    ("Куриные яйца", "dairy", "pcs"),
    ("Молоко", "dairy", "ml"),
    ("Сливочное масло", "dairy", "g"),
    ("Сметана", "dairy", "g"),
    ("Сливки 10%", "dairy", "ml"),
    ("Сливки 20%", "dairy", "ml"),
    ("Сыр твёрдый", "dairy", "g"),
    ("Сыр Моцарелла", "dairy", "g"),
    ("Сыр Пармезан", "dairy", "g"),
    ("Творог", "dairy", "g"),
    ("Творожный сыр", "dairy", "g"),
    ("Греческий йогурт", "dairy", "g"),
    ("Пшеничная мука", "staple", "g"),
    ("Кукурузный крахмал", "staple", "g"),
    ("Картофельный крахмал", "staple", "g"),
    ("Сахар", "staple", "g"),
    ("Мёд", "staple", "ml"),
    ("Панировочные сухари", "staple", "g"),
    ("Спагетти", "noodles", "g"),
    ("Макароны (перья/спирали)", "noodles", "g"),
    ("Лапша удон", "noodles", "g"),
    ("Рисовая лапша", "noodles", "g"),
    ("Фунчоза (стеклянная лапша)", "noodles", "g"),
    ("Яичная лапша", "noodles", "g"),
    ("Рис круглозерный", "staple", "g"),
    ("Рис длиннозерный", "staple", "g"),
    ("Рис жасмин", "staple", "g"),
    ("Рис басмати", "staple", "g"),
    ("Гречневая крупа", "staple", "g"),
    ("Овсяные хлопья", "staple", "g"),
    ("Булгур", "staple", "g"),
    ("Соевый соус", "sauce", "ml"),
    ("Вок соус", "sauce", "ml"),
    ("Соус Терияки", "sauce", "ml"),
    ("Кисло-сладкий соус", "sauce", "ml"),
    ("Сладкий чили соус", "sauce", "ml"),
    ("Устричный соус", "sauce", "ml"),
    ("Рыбный соус", "sauce", "ml"),
    ("Томатная паста", "sauce", "g"),
    ("Кетчуп", "sauce", "g"),
    ("Майонез", "sauce", "g"),
    ("Горчица", "sauce", "g"),
    ("Яблочный уксус", "sauce", "ml"),
    ("Рисовый уксус", "sauce", "ml"),
    ("Бальзамический уксус", "sauce", "ml"),
    ("Столовый уксус 9%", "sauce", "ml"),
    ("Растительное масло", "oil", "ml"),
    ("Подсолнечное масло", "oil", "ml"),
    ("Оливковое масло", "oil", "ml"),
    ("Кунжутное масло", "oil", "ml"),
    ("Соль", "spice", "g"),
    ("Чёрный перец", "spice", "g"),
    ("Паприка сладкая", "spice", "g"),
    ("Паприка копченая", "spice", "g"),
    ("Кайенский перец", "spice", "g"),
    ("Сушеный чеснок", "spice", "g"),
    ("Приправа для вока", "spice", "g"),
    ("Карри (порошок)", "spice", "g"),
    ("Хмели-сунели", "spice", "g"),
    ("Кориандр молотый", "spice", "g"),
    ("Зира (кумин)", "spice", "g"),
    ("Орегано", "spice", "g"),
    ("Базилик сушеный", "spice", "g"),
    ("Прованские травы", "spice", "g"),
    ("Лавровый лист", "spice", "pcs"),
    ("Семена кунжута", "spice", "g"),
    ("Томаты в собственном соку", "staple", "g"),
    ("Кукуруза консервированная", "staple", "g"),
    ("Зеленый горошек консервированный", "staple", "g"),
    ("Красная фасоль консервированная", "staple", "g"),
    ("Белая фасоль консервированная", "staple", "g"),
    ("Кокосовое молоко", "staple", "ml"),
    ("Тунец консервированный", "meat", "g"),
]


async def clean_brands_in_db():
    import re
    async with async_session_factory() as session:
        # 1. Update IngredientModel canonical_name
        stmt = select(IngredientModel)
        res = await session.execute(stmt)
        for ing in res.scalars().all():
            for old_val, new_val in BRAND_REPLACEMENTS.items():
                if old_val.lower() in ing.canonical_name.lower():
                    ing.canonical_name = new_val
            for brand in ("Maizena ", "Kikkoman ", "Shan’shi ", "Shan'shi ", "Go-Tan ", "OBAP ", "Clever ", "Clever", "BILLA "):
                if brand.lower() in ing.canonical_name.lower():
                    ing.canonical_name = re.sub(re.escape(brand), "", ing.canonical_name, flags=re.IGNORECASE).strip()

        # 2. Update PantryItemModel
        stmt2 = select(PantryItemModel)
        res2 = await session.execute(stmt2)
        for p in res2.scalars().all():
            if p.custom_ingredient_name:
                for old_val, new_val in BRAND_REPLACEMENTS.items():
                    if old_val.lower() in p.custom_ingredient_name.lower():
                        p.custom_ingredient_name = new_val
                for brand in ("Maizena ", "Kikkoman ", "Shan’shi ", "Shan'shi ", "Go-Tan ", "OBAP ", "Clever ", "Clever", "BILLA "):
                    if brand.lower() in p.custom_ingredient_name.lower():
                        p.custom_ingredient_name = re.sub(re.escape(brand), "", p.custom_ingredient_name, flags=re.IGNORECASE).strip()
            if p.notes:
                for brand in ("Maizena", "Kikkoman", "Shan’shi", "Shan'shi", "Go-Tan", "OBAP", "Clever", "BILLA"):
                    p.notes = re.sub(re.escape(brand), "", p.notes, flags=re.IGNORECASE).strip()

        # 3. Update RecipeIngredientModel
        stmt3 = select(RecipeIngredientModel)
        res3 = await session.execute(stmt3)
        for ring in res3.scalars().all():
            for old_val, new_val in BRAND_REPLACEMENTS.items():
                if old_val.lower() in ring.ingredient_name_snapshot.lower():
                    ring.ingredient_name_snapshot = new_val
            for brand in ("Maizena ", "Kikkoman ", "Shan’shi ", "Shan'shi ", "Go-Tan ", "OBAP ", "Clever ", "Clever", "BILLA "):
                if brand.lower() in ring.ingredient_name_snapshot.lower():
                    ring.ingredient_name_snapshot = re.sub(re.escape(brand), "", ring.ingredient_name_snapshot, flags=re.IGNORECASE).strip()

        # 4. Update RecipeStepModel
        stmt4 = select(RecipeStepModel)
        res4 = await session.execute(stmt4)
        for step in res4.scalars().all():
            for old_val, new_val in BRAND_REPLACEMENTS.items():
                if old_val in step.instruction:
                    step.instruction = step.instruction.replace(old_val, new_val)
            for brand in ("Bánh Phở", "OBAP", "Kikkoman", "Maizena", "Shan’shi", "Go-Tan", "BILLA", "Clever"):
                step.instruction = step.instruction.replace(brand, "")

        await session.commit()


async def ensure_popular_catalog_in_db():
    async with async_session_factory() as session:
        stmt = select(IngredientModel.canonical_name)
        res = await session.execute(stmt)
        existing_names = {name.lower() for name in res.scalars().all()}

        added = 0
        for name, cat, unit in POPULAR_CATALOG:
            if name.lower() not in existing_names:
                ing = IngredientModel(
                    canonical_name=name,
                    category=cat,
                    default_unit=unit,
                )
                session.add(ing)
                existing_names.add(name.lower())
                added += 1

        if added > 0:
            await session.commit()


async def sync_staples_and_zones():
    from sqlalchemy.orm import selectinload
    async with async_session_factory() as session:
        stmt = select(PantryItemModel).options(selectinload(PantryItemModel.ingredient))
        res = await session.execute(stmt)
        items = res.scalars().all()
        for p in items:
            name = (p.ingredient.canonical_name if p.ingredient else (p.custom_ingredient_name or "")).lower()
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
    await clean_brands_in_db()
    await ensure_popular_catalog_in_db()
    await sync_staples_and_zones()


if __name__ == "__main__":
    asyncio.run(main())
