# FridgeChef 🍳
> **Персональная кулинарная студия и умный холодильник на чистой архитектуре (Clean Architecture)**
> С динамической карточкой вкусов пользователя и интеграцией с Google Gemini AI.

---

## 🌟 Ключевые возможности

1. **Мой холодильник (Pantry Management):**
   - Учёт продуктов с безопасными единицами измерения (`g`, `ml`, `pcs`, `tbsp`, `tsp`).
   - Изоляция фактов от догадок: начальный импорт старых упоминаний продуктов имеет статус `needs_confirmation` и `quantity: NULL`.
   - Единственный подтверждённый продукт на старте — **Яблочный уксус** (подтверждён 22 октября 2026 г.).
   - Быстрое массовое подтверждение фактических остатков на кухне.

2. **Подбор рецептов (Pantry Matcher):**
   - Расчёт процента готовности блюда (100% готовность, частичная нехватка, отсутствие обязательных продуктов).
   - Безопасная размерная конвертация единиц (`g` $\leftrightarrow$ `kg`, `ml` $\leftrightarrow$ `l`). Масса и объём не приравниваются без плотности.
   - Динамический пересчёт порций с учётом флага `scalable`.

3. **Принцип неизменности рецептов (Recipe Immutability):**
   - Исходный базовый рецепт **никогда не перезаписывается**.
   - Отзывы пользователя (например, «слишком солёно») создают новую личную версию рецепта (v2, v3), сохраняя историю адаптаций.
   - Чёткое разделение ингредиентов: **маринад**, **основной соус** и **основа**.

4. **Эволюционирующая карточка вкусов (User Taste Profile Card):**
   - За каждым пользователем закреплена динамическая карточка вкусовых предпочтений.
   - Карточка автоматически обновляется на основе отзывов после готовки (например, оценка солёности 5/5 активирует правило снижения соевого соуса на 30–50% и запрет досаливания).
   - **Карточка передается в Google Gemini AI при каждом запросе**, обеспечивая персональный подбор и пересчёт специй под индивидуальный профиль.

5. **AI-Шеф (Google Gemini API):**
   - Генерация рецептов под текущий инвентарь холодильника и вкусовую карточку.
   - Работа через строгие Pydantic-схемы (Structured Outputs).
   - Сохранение в БД только после явного подтверждения пользователем.
   - Встроенный Mock-провайдер для локального тестирования и работы без API-ключа.

6. **Список покупок (Shopping List):**
   - Автоматический сбор дефицита из любых рецептов в один клик.
   - Сложение совместимых количеств одинаковых продуктов.

7. **Двуязычный интерфейс (RU / EN):**
   - Переключение между русским и английским языками в один клик в шапке приложения.

---

## 🏗 Архитектура проекта (Clean Architecture)

```
/Users/windows/Desktop/MyRecepties/
├── backend/
│   ├── app/
│   │   ├── core/                  # Настройки, переменные окружения (.env)
│   │   ├── domain/                # Чистая бизнес-логика (Entities, Value Objects, Unit Converter, Matcher)
│   │   │   ├── services/          # UnitConverterService, PantryMatcherService, TasteProfileUpdaterService
│   │   │   └── value_objects/     # Units, Roles, Statuses, Matching
│   │   ├── infrastructure/        # Адаптеры внешних систем
│   │   │   ├── db/                # SQLAlchemy 2.0 модели, репозитории, init_db
│   │   │   └── ai/                # Адаптер Google Gemini (google-genai) + Mock
│   │   └── presentation/          # Входной слой API (FastAPI)
│   │       ├── api_v1/            # Роутеры: /pantry, /recipes, /cooking, /profile, /shopping, /ai
│   │       └── schemas/           # Pydantic схемы валидации
│   ├── migrations/                # Alembic миграции
│   └── tests/                     # Unit-тесты и интеграционные тесты API
├── frontend/
│   ├── src/
│   │   ├── app/                   # Роутинг, I18nContext (RU / EN)
│   │   ├── features/              # Pantry, Recipes, Cooking, Profile, Shopping, AI-Chef
│   │   ├── locales/               # Словари переводов (ru.ts, en.ts)
│   │   ├── shared/                # Typed API client
│   │   └── types/                 # TypeScript типы
│   ├── package.json
│   └── vite.config.ts
├── docs/                          # Полная документация
│   ├── architecture.md            # Диаграммы слоёв и потоков
│   ├── data-model.md              # Схема базы данных
│   ├── requirements.md            # Спецификация требований
│   └── decisions/                 # ADR (Architecture Decision Records)
├── docker-compose.yml             # Запуск с PostgreSQL 16
├── run-local.sh                   # Запуск без Docker (SQLite + FastAPI + Vite)
├── .env.example
└── README.md
```

---

## 🚀 Запуск проекта

### Вариант 1: Локальный запуск без Docker (Рекомендуемый для разработки)

Для работы требуются Python 3.10+ и Node.js 18+. Запуск выполняется одной командой:

```bash
chmod +x run-local.sh
./run-local.sh
```

Скрипт автоматически:
1. Проверит и активирует виртуальное окружение Python в `backend/.venv`.
2. Установит зависимости из `requirements.txt` и `npm install`.
3. Создаст локальную базу данных SQLite `fridgechef.db` и наполнит её начальными данными (пользователь, карточка вкусов, продукты, базовые рецепты).
4. Запустит Backend на `http://localhost:8000` и Frontend на `http://localhost:5173`.

### Вариант 2: Запуск через Docker Compose (PostgreSQL 16)

```bash
docker compose up --build
```

Сервисы:
- Web App: `http://localhost:5173`
- Backend API & Swagger: `http://localhost:8000/docs`
- PostgreSQL 16: порт 5432

---

## 🔑 Настройка Google Gemini API

В файле `.env` укажите ваш ключ Gemini:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

> **Примечание:** Если ключ не указан, система автоматически переключается на встроенный `MockRecipeAIProvider`, генерирующий интеллектуальные персональные рецепты с учётом вкусовой карточки без обращения к сети.

---

## 🧪 Тестирование

### Тесты Backend (Unit + Integration):
```bash
PYTHONPATH=backend ./backend/.venv/bin/pytest backend/tests
```
- Проверяются математическая безопасность конвертера величин, алгоритм сопоставления с холодильником, обновление вкусовой карточки по отзывам и все HTTP-эндпоинты.

### Сборка и Type-check Frontend:
```bash
cd frontend && npm run build
```

---

## 📚 Документация архитектуры
- [Спецификация требований](file:///Users/windows/Desktop/MyRecepties/docs/requirements.md)
- [Архитектурный дизайн (Clean Architecture)](file:///Users/windows/Desktop/MyRecepties/docs/architecture.md)
- [Спецификация модели данных](file:///Users/windows/Desktop/MyRecepties/docs/data-model.md)
- [ADR 001: Clean Architecture](file:///Users/windows/Desktop/MyRecepties/docs/decisions/001-clean-architecture.md)
- [ADR 002: Неизменность рецептов](file:///Users/windows/Desktop/MyRecepties/docs/decisions/002-recipe-immutability-versioning.md)
- [ADR 003: Эволюционирующая карточка вкусов](file:///Users/windows/Desktop/MyRecepties/docs/decisions/003-evolving-taste-profile-ai.md)
- [ADR 004: Двухрежимная стратегия БД (SQLite / PostgreSQL)](file:///Users/windows/Desktop/MyRecepties/docs/decisions/004-dual-database-sqlite-postgres.md)
