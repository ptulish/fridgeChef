import json
import logging
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.infrastructure.ai.mock_provider import MockRecipeAIProvider
from app.domain.services.prompt_context_builder import PromptContextBuilder
from app.presentation.http.schemas.ai_schemas import RecipeDraft

logger = logging.getLogger(__name__)


class GeminiRecipeAIProvider:
    def __init__(self):
        self.mock_fallback = MockRecipeAIProvider()

    @property
    def has_api_key(self) -> bool:
        return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())

    def get_client(self):
        if self.has_api_key:
            try:
                from google import genai
                return genai.Client(api_key=settings.GEMINI_API_KEY.strip())
            except Exception as e:
                logger.error(f"Failed to initialize Gemini Client: {e}")
        return None

    async def generate_recipe_suggestion(
        self,
        pantry_items: List[Dict[str, Any]],
        taste_profile: Dict[str, Any],
        prompt: Optional[str] = None,
        mode: Optional[str] = None,
        satiety_level: str = "standard",
        recent_feedback: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        client = self.get_client()
        if not client:
            return await self.mock_fallback.generate_recipe_suggestion(pantry_items, taste_profile, prompt)

        system_instruction, user_content_json, ref_map = PromptContextBuilder.build_context(
            pantry_items=pantry_items,
            taste_profile=taste_profile,
            prompt=prompt,
            mode=mode,
            satiety_level=satiety_level,
            recent_feedback=recent_feedback,
        )

        try:
            from google.genai import types

            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=user_content_json,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=RecipeDraft,
                    temperature=0.7,
                ),
            )

            # Validate response strictly with Pydantic
            draft = RecipeDraft.model_validate_json(response.text)
            data = draft.model_dump()

            # Post-validation: Allergy verification
            allergies = [a.lower().strip() for a in taste_profile.get("allergies", []) if a]
            if allergies:
                for ing in data.get("ingredients", []):
                    ing_name = ing.get("name", "").lower()
                    for allergen in allergies:
                        if allergen in ing_name:
                            logger.warning(f"Allergen '{allergen}' detected in generated ingredient '{ing_name}'.")
                            raise ValueError(f"Generated recipe contained allergen: {allergen}")

            data["generator"] = "gemini"
            data["model"] = settings.GEMINI_MODEL
            data["provider_name"] = f"Google Gemini ({settings.GEMINI_MODEL})"
            return data

        except Exception as e:
            logger.error(f"Gemini API call failed, falling back to mock provider: {e}")
            res = await self.mock_fallback.generate_recipe_suggestion(pantry_items, taste_profile, prompt)
            res["generator"] = "mock"
            res["model"] = "offline-rules"
            res["provider_name"] = "Оффлайн-движок FridgeChef"
            res["fallback_reason"] = f"Ошибка запроса к Gemini: {e}"
            return res

    async def suggest_adaptation(
        self,
        original_recipe: Dict[str, Any],
        review: Dict[str, Any],
        taste_profile: Dict[str, Any],
    ) -> Dict[str, Any]:
        client = self.get_client()
        if not client:
            return await self.mock_fallback.suggest_adaptation(original_recipe, review, taste_profile)

        system_instruction = f"""
Ты — персональный шеф-повар FridgeChef.
Пользователь только что приготовил блюдо и оставил отзыв.
Твоя задача — предложить точные корректировки в рецепт для создания новой улучшенной версии, не меняя оригинальный рецепт.

{taste_profile.get("ai_profile_summary", "")}

Отзыв пользователя:
- Вкус: {review.get("taste_rating")}/5
- Соленость: {review.get("saltiness_rating")}/5 (1=пресно, 3=норма, 5=пересолено)
- Количество соуса: {review.get("sauce_amount_rating")}/5 (1=мало, 3=норма, 5=много)
- Комментарий: {review.get("comment", "нет комментария")}
"""
        user_content = f"Исходный рецепт:\n{json.dumps(original_recipe, ensure_ascii=False)}"

        try:
            from google.genai import types

            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=user_content,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    temperature=0.5,
                ),
            )
            return json.loads(response.text)
        except Exception as e:
            logger.error(f"Gemini adaptation call failed, falling back to mock: {e}")
            return await self.mock_fallback.suggest_adaptation(original_recipe, review, taste_profile)
