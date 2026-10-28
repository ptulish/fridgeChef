# FridgeChef — Архитектурная документация (Clean Architecture)

## 1. Обзор слоёв и потока управления

Архитектура следует классическим принципам Clean Architecture (Роберт Мартин). Все зависимости направлены строго **внутрь** системы.

```
       [HTTP Client (React / Vite)]
                    |
                    v
    +-------------------------------+
    |       Presentation Layer      |  (FastAPI Routers, Pydantic Request/Response Schemas)
    +-------------------------------+
                    |
                    v
    +-------------------------------+
    |       Application Layer       |  (Use Cases, Ports, DTOs, Business Transactions)
    +-------------------------------+
             /             \
            v               v
  +------------------+    +-----------------------+
  |   Domain Layer   |    |  Infrastructure Layer | (SQLAlchemy, DB Repositories,
  | (Pure Business   |    |                        Gemini AI Adapter, Alembic)
  |  Entities, Match,|    +-----------------------+
  |  Unit Converter, |
  |  Taste Logic)    |
  +------------------+
```

### 1. Domain Layer (`backend/app/domain`)
- **Не содержит никаких внешних зависимостей:** никаких импортов из FastAPI, SQLAlchemy, Pydantic, HTTP-клиентов или SDK сторонних провайдеров.
- **Entities & Aggregates:**
  - `User`, `Ingredient`, `PantryItem`, `Recipe`, `RecipeVersion`, `RecipeIngredient`, `RecipeStep`, `CookingSession`, `Review`, `UserTasteProfile`, `ShoppingList`.
- **Value Objects:**
  - `Quantity`, `Unit` (с правилами размерности `Mass`, `Volume`, `Count`), `Role` (marinade, main_sauce, required, optional, garnish), `Status`.
- **Domain Services:**
  - `UnitConverterService`: строгие математические правила перевода совместимых единиц (`g` $\leftrightarrow$ `kg`, `ml` $\leftrightarrow$ `l`, `tbsp` $\leftrightarrow$ `tsp` $\leftrightarrow$ `ml`). Блокирует недопустимые конвертации без калиброванной плотности.
  - `PantryMatcherService`: алгоритм сопоставления рецепта с содержимым холодильника, категоризация на `SUFFICIENT`, `INSUFFICIENT`, `MISSING_REQUIRED`, `MISSING_OPTIONAL`, `NEEDS_CONFIRMATION`, расчёт процента готовности.
  - `TasteProfileUpdaterService`: правила пересчёта вкусовых коэффициентов пользователя на основании оценок сессии (соль, сладость, кислота, соусность, острота).

### 2. Application Layer (`backend/app/application`)
- **Ports (Интерфейсы):**
  - `IPantryRepository`, `IRecipeRepository`, `ICookingSessionRepository`, `IReviewRepository`, `IUserTasteProfileRepository`, `IShoppingListRepository`.
  - `IRecipeAIProvider`: контракт для LLM (генерация рецепта, подбор модификации по отзыву).
  - `IUnitOfWork`: контракт транзакционности.
- **Use Cases:**
  - `GetPantryItemsUseCase`, `UpdatePantryItemUseCase`, `ConfirmPantryItemsBulkUseCase`.
  - `MatchRecipesUseCase`, `GetRecipeDetailsUseCase`.
  - `StartCookingSessionUseCase`, `CompleteCookingSessionUseCase`.
  - `SubmitReviewAndAdaptUseCase`: атомарное сохранение отзыва, обновление вкусовой карточки и генерация/сохранение новой версии рецепта при необходимости.
  - `GenerateAIRecipeUseCase`: формирование запроса в Gemini с актуальной карточкой вкусов пользователя и списком продуктов.

### 3. Infrastructure Layer (`backend/app/infrastructure`)
- **Database & Persistence:**
  - SQLAlchemy 2.0 декларативные модели в `infrastructure/db/models`.
  - Реализации репозиториев (`SQLAlchemyPantryRepository`, etc.).
  - Поддержка PostgreSQL (производственный режим через Docker) и SQLite (легковесный локальный режим разработки и pytest).
- **AI Integration:**
  - `GeminiRecipeAIProvider` реализует `IRecipeAIProvider` с использованием официального SDK `google-genai`.
  - `MockRecipeAIProvider` для предсказуемых unit/интеграционных тестов без расхода токенов и без необходимости сетевого ключа.

### 4. Presentation Layer (`backend/app/presentation`)
- FastAPI роутеры (`/api/v1/...`).
- Pydantic схемы валидации HTTP данных (десериализация входных параметров и сериализация выходных DTO).
- Dependency Injection (`Depends` для сессии БД, репозиториев и текущего пользователя).

---

## 2. Архитектура Frontend (React + TypeScript + Vite)

Модульная feature-first структура:
```
frontend/src/
├── app/               # Роутинг, глобальные провайдеры (Auth, Theme, I18n)
├── features/
│   ├── pantry/        # Содержимое холодильника, модалки добавления/подтверждения
│   ├── recipes/       # Каталог рецептов, индикаторы готовности, фильтры
│   ├── cooking/       # Пошаговый режим приготовления с крупным текстом и таймерами
│   ├── reviews/       # Слайдеры вкусовых характеристик и запуск адаптации
│   ├── profile/       # Карточка вкусового профиля пользователя
│   ├── shopping/      # Список покупок с группировкой
│   └── ai-chef/       # Диалог с AI-поваром и предварительный просмотр рецепта
├── shared/            # Reusable UI компоненты (Button, Input, Badge, Modal, etc.), API клиент
├── locales/           # Языковые словари (ru.json, en.json)
└── types/             # TypeScript типы, согласованные с API backend
```

---

## 3. Карточка вкусового профиля (Taste Profile Card) и Gemini Integration

```
[User completes cooking session]
               |
               v
  [Review Submitted (Salt: 5/5, Sauce: 4/5, Comment: "Немного пересолил соевым соусом")]
               |
               v
  [TasteProfileUpdaterService]
   - Updates Salt Sensitivity flag: HIGH
   - Appends adjustment rule: "Reduce soy sauce by 30-50% in future woks"
   - Updates ai_profile_summary text
               |
               v
  [Next AI Call / Recipe Suggestion]
   - Fetches UserTasteProfile
   - Injects full Taste Profile Card into Gemini System Prompt:
     * User likes: Beef, Pork, Rice Noodles, Sweet & Sour, Rich Sauce
     * Sensitive to Salt: ALWAYS dilute soy sauce with water, DO NOT add table salt
     * Dislikes: Mushrooms, Bell Peppers
     * Equipment: Regular Skillet, Multicooker, Oven
   - Gemini outputs tailored JSON recipe strictly matching user taste constraints
```
