from typing import Dict, Any, List, Optional
from decimal import Decimal
import json
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from app.presentation.http.dependencies import (
    get_current_user,
    get_ai_provider,
    get_pantry_repo,
    get_taste_profile_repo,
    get_recipe_repo,
    get_cooking_repo,
)
from app.infrastructure.db.models.user import UserModel
from app.infrastructure.ai.gemini_provider import GeminiRecipeAIProvider
from app.infrastructure.db.repositories.pantry_repo import SQLAlchemyPantryRepository
from app.infrastructure.db.repositories.taste_profile_repo import SQLAlchemyTasteProfileRepository
from app.infrastructure.db.repositories.recipe_repo import SQLAlchemyRecipeRepository
from app.infrastructure.db.repositories.cooking_repo import SQLAlchemyCookingRepository
from app.presentation.http.schemas.ai_schemas import (
    GenerateAIRecipeRequest,
    SuggestAdaptationRequest,
)
from app.presentation.http.schemas.recipe_schemas import RecipeResponse

from pydantic import BaseModel
from app.core.config import settings

class ConfigureKeyRequest(BaseModel):
    api_key: str


class SubstituteRequest(BaseModel):
    ingredient_name: str
    recipe_name: Optional[str] = None
    recipe_id: Optional[str] = None


class SubstituteOption(BaseModel):
    name: str
    notes: str
    in_pantry: bool
    pantry_item_id: Optional[str] = None


class SubstituteResponse(BaseModel):
    substitutions: List[SubstituteOption]


router = APIRouter(prefix="/ai", tags=["AI Chef"])


@router.get("/status")
async def get_ai_status(ai_provider: GeminiRecipeAIProvider = Depends(get_ai_provider)):
    return {
        "has_gemini_key": ai_provider.has_api_key,
        "model": settings.GEMINI_MODEL,
        "provider": "gemini" if ai_provider.has_api_key else "mock",
    }


@router.post("/configure-key")
async def configure_gemini_key(
    payload: ConfigureKeyRequest,
    ai_provider: GeminiRecipeAIProvider = Depends(get_ai_provider),
):
    key = payload.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="Ключ API не может быть пустым")

    # Quick test ping to Google Gemini
    try:
        from google import genai
        test_client = genai.Client(api_key=key)
        test_resp = test_client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents="Say 'OK'",
        )
        if not test_resp.text:
            raise Exception("Пустой ответ от Gemini API")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка проверки ключа Gemini: {e}")

    # Set in memory
    settings.GEMINI_API_KEY = key

    # Persist to .env
    import os
    import re
    env_path = os.path.join(os.getcwd(), ".env")
    if not os.path.exists(env_path):
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../.env"))
    try:
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                content = f.read()
            if re.search(r"^GEMINI_API_KEY=.*", content, flags=re.MULTILINE):
                content = re.sub(r"^GEMINI_API_KEY=.*", f"GEMINI_API_KEY={key}", content, flags=re.MULTILINE)
            else:
                content += f"\nGEMINI_API_KEY={key}\n"
            with open(env_path, "w", encoding="utf-8") as f:
                f.write(content)
    except Exception:
        pass

    return {
        "status": "success",
        "has_gemini_key": True,
        "model": settings.GEMINI_MODEL,
        "provider": "gemini",
        "message": "Ключ Google Gemini успешно проверен и сохранён!",
    }


@router.post("/generate-recipe")
async def generate_recipe(
    payload: GenerateAIRecipeRequest,
    current_user: UserModel = Depends(get_current_user),
    ai_provider: GeminiRecipeAIProvider = Depends(get_ai_provider),
    pantry_repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
    taste_repo: SQLAlchemyTasteProfileRepository = Depends(get_taste_profile_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    pantry_items = await pantry_repo.get_user_pantry(current_user.id)
    pantry_summary = [
        {
            "name": p.ingredient.canonical_name if p.ingredient else "Продукт",
            "quantity": float(p.quantity) if p.quantity is not None else None,
            "unit": p.unit,
            "status": p.status,
        }
        for p in pantry_items
    ]

    taste_profile = await taste_repo.get_by_user_id(current_user.id)
    profile_dict = (
        {
            "meat_preferences": taste_profile.meat_preferences,
            "sauce_preference": taste_profile.sauce_preference,
            "salt_sensitivity": taste_profile.salt_sensitivity,
            "disliked_ingredients": taste_profile.disliked_ingredients,
            "equipment": taste_profile.equipment,
            "habits": taste_profile.habits,
            "ai_profile_summary": taste_profile.ai_profile_summary,
        }
        if taste_profile
        else {}
    )

    recipe_data = await ai_provider.generate_recipe_suggestion(
        pantry_items=pantry_summary,
        taste_profile=profile_dict,
        prompt=payload.prompt,
        mode=payload.mode,
        satiety_level=payload.satiety_level or "standard",
    )
    return recipe_data


@router.post("/save-generated-recipe", response_model=RecipeResponse)
async def save_generated_recipe(
    recipe_data: Dict[str, Any],
    current_user: UserModel = Depends(get_current_user),
    recipe_repo: SQLAlchemyRecipeRepository = Depends(get_recipe_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    # Create RecipeModel
    from app.infrastructure.db.models.recipe import RecipeModel, RecipeSourceModel
    from app.infrastructure.db.session import async_session_factory

    async with async_session_factory() as session:
        r = RecipeModel(
            owner_user_id=current_user.id,
            title=recipe_data.get("title", "Новый рецепт от ИИ"),
            description=recipe_data.get("description", "Сгенерировано с учётом вкусового профиля"),
            cuisine=recipe_data.get("cuisine", "Домашняя"),
            difficulty=recipe_data.get("difficulty", "medium"),
            duration_minutes=recipe_data.get("duration_minutes", 30),
            base_servings=recipe_data.get("base_servings", 1),
            visibility="private",
        )
        session.add(r)
        await session.flush()

        is_gemini = recipe_data.get("generator") == "gemini"
        source_name = f"Google Gemini ({settings.GEMINI_MODEL})" if is_gemini else "Оффлайн-движок FridgeChef"
        attribution = (
            f"Сгенерировано нейросетью Google Gemini ({settings.GEMINI_MODEL}) под текущий инвентарь холодильника и личный вкусовой профиль."
            if is_gemini
            else "Сгенерировано локальным алгоритмом FridgeChef под текущий инвентарь холодильника и личный вкусовой профиль."
        )

        src = RecipeSourceModel(
            recipe_id=r.id,
            source_type="ai_generated" if is_gemini else "mock_generated",
            source_name=source_name,
            attribution=attribution,
        )
        session.add(src)

        # Version 1
        from app.infrastructure.db.models.recipe import RecipeVersionModel, RecipeIngredientModel, RecipeStepModel
        from app.infrastructure.db.models.ingredient import IngredientModel
        v = RecipeVersionModel(
            recipe_id=r.id,
            version_number=1,
            change_summary="Начальная версия, созданная ИИ по карточке вкусов.",
            created_by_user_id=current_user.id,
            is_base_version=True,
        )
        session.add(v)
        await session.flush()

        # Load canonical ingredients for auto-mapping
        stmt_canon = select(IngredientModel)
        all_canon = (await session.execute(stmt_canon)).scalars().all()
        canon_map = {c.canonical_name.lower(): c.id for c in all_canon}

        for ing in recipe_data.get("ingredients", []):
            raw_name = ing.get("name", "Ингредиент").strip()
            # Try exact match or substring match with canonical catalog
            matched_id = canon_map.get(raw_name.lower())
            if not matched_id:
                for c_name, c_id in canon_map.items():
                    if c_name in raw_name.lower() or raw_name.lower() in c_name:
                        matched_id = c_id
                        break

            session_ing = RecipeIngredientModel(
                recipe_version_id=v.id,
                ingredient_id=matched_id,
                ingredient_name_snapshot=raw_name,
                quantity=Decimal(str(ing["quantity"])) if ing.get("quantity") is not None else None,
                unit=ing.get("unit", "pcs"),
                role=ing.get("role", "required"),
                preparation_note=ing.get("preparation_note"),
                scalable=ing.get("scalable", True),
            )
            session.add(session_ing)

        for s in recipe_data.get("steps", []):
            session_step = RecipeStepModel(
                recipe_version_id=v.id,
                step_number=s.get("step_number", 1),
                instruction=s.get("instruction", ""),
                duration_seconds=s.get("duration_seconds"),
            )
            session.add(session_step)

        await session.commit()
        saved_id = r.id

    return await recipe_repo.get_recipe_by_id(saved_id)


@router.post("/suggest-adaptation")
async def suggest_adaptation(
    payload: SuggestAdaptationRequest,
    current_user: UserModel = Depends(get_current_user),
    ai_provider: GeminiRecipeAIProvider = Depends(get_ai_provider),
    recipe_repo: SQLAlchemyRecipeRepository = Depends(get_recipe_repo),
    cooking_repo: SQLAlchemyCookingRepository = Depends(get_cooking_repo),
    taste_repo: SQLAlchemyTasteProfileRepository = Depends(get_taste_profile_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    version = await recipe_repo.get_version_by_id(payload.recipe_version_id)
    session_obj = await cooking_repo.get_session(payload.cooking_session_id, current_user.id)
    taste_profile = await taste_repo.get_by_user_id(current_user.id)

    if not version or not session_obj:
        raise HTTPException(status_code=404, detail="Version or session not found")

    review = session_obj.review
    review_dict = {
        "taste_rating": review.taste_rating if review else 3,
        "saltiness_rating": review.saltiness_rating if review else 3,
        "sauce_amount_rating": review.sauce_amount_rating if review else 3,
        "sweetness_rating": review.sweetness_rating if review else 3,
        "acidity_rating": review.acidity_rating if review else 3,
        "comment": review.comment if review else "",
    }

    recipe_dict = {
        "title": version.recipe.title,
        "ingredients": [
            {
                "name": i.ingredient_name_snapshot,
                "quantity": float(i.quantity) if i.quantity is not None else None,
                "unit": i.unit,
                "role": i.role,
                "preparation_note": i.preparation_note,
            }
            for i in version.ingredients
        ],
        "steps": [
            {"step_number": s.step_number, "instruction": s.instruction, "duration_seconds": s.duration_seconds}
            for s in version.steps
        ],
    }

    profile_dict = {"ai_profile_summary": taste_profile.ai_profile_summary if taste_profile else ""}

    return await ai_provider.suggest_adaptation(recipe_dict, review_dict, profile_dict)


@router.post("/substitute", response_model=SubstituteResponse)
async def substitute_ingredient(
    payload: SubstituteRequest,
    current_user: UserModel = Depends(get_current_user),
    ai_provider: GeminiRecipeAIProvider = Depends(get_ai_provider),
    pantry_repo: SQLAlchemyPantryRepository = Depends(get_pantry_repo),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="User not initialized")

    target_name = payload.ingredient_name.strip()
    if not target_name:
        raise HTTPException(status_code=400, detail="Название ингредиента не может быть пустым")

    # Fetch user's in-stock pantry items
    pantry_items = await pantry_repo.get_user_pantry(current_user.id)
    available_items = [
        p for p in pantry_items
        if p.status != "out" and p.ingredient and p.ingredient.canonical_name
    ]
    pantry_names = [p.ingredient.canonical_name for p in available_items]

    # Predefined culinary substitutions dictionary for smart fallback & validation
    SUBSTITUTION_KNOWLEDGE = {
        "уксус": [
            ("Яблочный уксус (1 ч. л.) + щепотка сахара", "Мягкий кисло-сладкий баланс"),
            ("Сок лимона (1 ст. л.)", "Свежая цитрусовая кислинка"),
        ],
        "соевый соус": [
            ("Соль + вода + капля вустерского соуса", "Базовый соленый баланс"),
            ("Терияки соус", "Сладковатый и густой соус, уменьшить сахар"),
        ],
        "курица": [
            ("Индейка (филе)", "1:1 по времени обжарки и текстуре"),
            ("Свиная вырезка", "Нарезать тонкими полосками для вока"),
        ],
        "крахмал": [
            ("Пшеничная мука", "Развести в холодной воде в пропорции 1:1"),
            ("Картофельный крахмал", "Использовать в тех же пропорциях для загущения"),
        ],
        "сливки": [
            ("Молоко + сливочное масло", "Растопить сливочное масло в теплом молоке"),
            ("Сметана", "Добавлять в самом конце на слабом огне"),
        ],
        "чеснок": [
            ("Сушеный гранулированный чеснок", "1/4 ч. л. вместо зубчика"),
            ("Зеленый лук (белая часть)", "Мягкая луковая нота для соуса"),
        ],
        "сахар": [
            ("Мед", "3/4 от указанного объема сахара"),
            ("Соус терияки", "Уже содержит сладость и глазурь"),
        ],
        "масло": [
            ("Оливковое масло", "Для жарки на умеренном огне"),
            ("Сливочное масло", "Нежный сливочный вкус"),
        ],
        "лук": [
            ("Репчатый лук тонкими перьями", "Ошпарить кипятком для мягкости"),
            ("Свежая зелень (петрушка/кинза)", "Свежая пряная нотка"),
        ],
    }

    substitutions: List[SubstituteOption] = []

    # Try Gemini if key configured
    if ai_provider.has_api_key:
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            prompt = (
                f"Кулинарная задача: в рецепте '{payload.recipe_name or 'блюдо'}' требуется '{target_name}'.\n"
                f"В наличии у повара в холодильнике следующие продукты:\n"
                f"{', '.join(pantry_names) if pantry_names else 'Пусто'}.\n\n"
                f"Подбери 2-3 реалистичные кулинарные замены для '{target_name}', отдавая строгий приоритет продуктам из холодильника повара.\n"
                f"Ответь строго JSON-списком объектов: [{{'name': '...', 'notes': '...', 'in_pantry': true/false}}]."
            )
            resp = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            raw = resp.text.strip()
            # Clean markdown codeblocks
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
            parsed = json.loads(raw)
            for item in parsed:
                # Check if matches any pantry item
                found_pantry = next(
                    (p for p in available_items if p.ingredient.canonical_name.lower() in item["name"].lower() or item["name"].lower() in p.ingredient.canonical_name.lower()),
                    None
                )
                substitutions.append(
                    SubstituteOption(
                        name=item["name"],
                        notes=item["notes"],
                        in_pantry=bool(found_pantry) or item.get("in_pantry", False),
                        pantry_item_id=found_pantry.id if found_pantry else None,
                    )
                )
        except Exception:
            pass

    # If Gemini didn't return substitutions, use smart knowledge map
    if not substitutions:
        matched_category = None
        for key in SUBSTITUTION_KNOWLEDGE:
            if key in target_name.lower():
                matched_category = key
                break

        if matched_category:
            for sub_name, sub_note in SUBSTITUTION_KNOWLEDGE[matched_category]:
                found_pantry = next(
                    (p for p in available_items if p.ingredient.canonical_name.lower() in sub_name.lower()),
                    None
                )
                substitutions.append(
                    SubstituteOption(
                        name=sub_name,
                        notes=sub_note,
                        in_pantry=bool(found_pantry),
                        pantry_item_id=found_pantry.id if found_pantry else None,
                    )
                )

        # Also add any items from pantry that might be related
        for p in available_items:
            p_name = p.ingredient.canonical_name
            if p_name.lower() != target_name.lower() and not any(s.name == p_name for s in substitutions):
                # If target is oil and pantry item is oil, etc.
                if p.ingredient.category in ("sauce", "oil", "spice") and any(w in target_name.lower() for w in ("соус", "масло", "уксус")):
                    substitutions.append(
                        SubstituteOption(
                            name=f"{p_name} ({p.quantity or ''} {p.unit})",
                            notes="Доступно на вашей кухне в качестве соусной основы",
                            in_pantry=True,
                            pantry_item_id=p.id,
                        )
                    )
                    break

    # Final fallback if still empty
    if not substitutions:
        substitutions.append(
            SubstituteOption(
                name="Исключить ингредиент или добавить по вкусу соль/перец",
                notes="Если продукт не является главным стержнем блюда, его можно пропустить без потери базовой структуры",
                in_pantry=True,
            )
        )

    # Sort so in_pantry == True comes first!
    substitutions.sort(key=lambda s: s.in_pantry, reverse=True)

    return SubstituteResponse(substitutions=substitutions)
