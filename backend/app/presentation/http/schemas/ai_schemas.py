from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field


class MacrosDraft(BaseModel):
    kcal: int = Field(..., description="Примерная калорийность на 1 порцию")
    protein_g: float = Field(..., description="Белки в граммах на 1 порцию")
    fat_g: float = Field(..., description="Жиры в граммах на 1 порцию")
    carbs_g: float = Field(..., description="Углеводы в граммах на 1 порцию")


class IngredientDraft(BaseModel):
    name: str = Field(..., description="Название ингредиента (на русском)")
    inventory_ref: Optional[str] = Field(None, description="Короткая ссылка на позицию инвентаря: 'i1', 'i2' или 's1', 's2' для базовых. Если нет в холодильнике — null")
    availability: Literal["in_stock", "staple", "to_buy"] = Field(
        "in_stock", description="in_stock: из инвентаря; staple: базовая приправа; to_buy: нужно докупить"
    )
    quantity: Optional[float] = Field(None, description="Количество на базовое число порций")
    unit: str = Field("g", description="Единица измерения: g, ml, pcs, tbsp, tsp, clove, bunch, pinch")
    role: Literal["required", "optional", "garnish", "marinade", "main_sauce"] = Field(
        "required", description="Кулинарная роль ингредиента"
    )
    preparation_note: Optional[str] = Field(None, description="Способ подготовки: нарезать соломкой, обжарить и т.д.")
    scalable: bool = Field(True, description="Масштабируется ли при изменении числа порций")


class StepDraft(BaseModel):
    step_number: int = Field(..., description="Номер шага по порядку (начиная с 1)")
    instruction: str = Field(..., description="Понятная пошаговая инструкция")
    duration_seconds: Optional[int] = Field(None, description="Примерное время выполнения шага в секундах")
    temperature_c: Optional[int] = Field(None, description="Температура приготовления, если релевантно")
    equipment: Optional[str] = Field(None, description="Посуда или прибор: вок, духовка, сковорода, кастрюля")


class RecipeDraft(BaseModel):
    title: str = Field(..., description="Аппетитное название блюда на русском языке")
    description: str = Field(..., description="Краткое описание вкуса и сути блюда")
    cuisine: str = Field("Домашняя", description="Кухня или стиль: Азиатская, Итальянская, Домашняя и т.д.")
    difficulty: Literal["easy", "medium", "hard"] = Field("medium", description="Сложность приготовления")
    duration_minutes: int = Field(25, description="Общее время приготовления в минутах")
    base_servings: int = Field(1, description="Количество порций, на которое рассчитаны ингредиенты")
    equipment_used: List[str] = Field(default_factory=list, description="Используемая техника и посуда")
    ingredients: List[IngredientDraft] = Field(..., description="Список ингредиентов")
    steps: List[StepDraft] = Field(..., description="Пошаговые инструкции")
    macros_per_serving: Optional[MacrosDraft] = Field(None, description="Ориентировочное КБЖУ на 1 порцию")
    why_this_recipe: Optional[str] = Field(None, description="1-2 предложения, объясняющие почему предложено именно это блюдо")

    # Metadata added by server/provider
    generator: Optional[str] = "gemini"
    model: Optional[str] = None
    provider_name: Optional[str] = None
    fallback_reason: Optional[str] = None


class GenerateAIRecipeRequest(BaseModel):
    prompt: Optional[str] = None
    mode: Optional[str] = None  # e.g. quick_15, high_protein, comfort_food, cheat_meal
    satiety_level: Optional[Literal["light", "standard", "hearty"]] = "standard"


class SuggestAdaptationRequest(BaseModel):
    recipe_id: str
    recipe_version_id: str
    cooking_session_id: str


class SubstituteOption(BaseModel):
    name: str
    inventory_ref: Optional[str] = None
    quantity: Optional[float] = None
    unit: str = "g"
    impact: Literal["minimal", "noticeable", "different_dish"] = "minimal"
    note: str


class SubstituteIngredientRequest(BaseModel):
    recipe_version_id: str
    ingredient_name: str
