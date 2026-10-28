# FridgeChef — Модель данных (Data Model)

## 1. Диаграмма сущностей (ER Overview)

```
[users] 1 --- 1 [user_taste_profiles]
   |
   +-- 1 --- * [user_pantry_items] * --- 1 [ingredients]
   |
   +-- 1 --- * [cooking_sessions] 1 --- 1 [reviews]
   |                  |
   |                  v
   +-- 1 --- * [recipes] 1 --- * [recipe_versions]
                                       |
                                       +-- 1 --- * [recipe_ingredients]
                                       +-- 1 --- * [recipe_steps]
                                       |
                                       +-- 0..1 --- [personal_recipe_adjustments]
```

---

## 2. Спецификация таблиц

### 1. `users`
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Уникальный идентификатор пользователя |
| `email` | `VARCHAR(255)` | `NULLABLE, UNIQUE` | Email пользователя |
| `name` | `VARCHAR(100)` | `NOT NULL` | Отображаемое имя |
| `auth_subject` | `VARCHAR(255)` | `NULLABLE, UNIQUE` | Внешний ID для интеграции с Auth-провайдерами |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL, DEFAULT now()` | Дата создания |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL, DEFAULT now()` | Дата обновления |

---

### 2. `user_taste_profiles` (Карточка вкусов пользователя)
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK карточки |
| `user_id` | `UUID` | `NOT NULL, UNIQUE, FK -> users.id` | Владелец карточки |
| `meat_preferences` | `JSONB` | `NOT NULL` | `{"beef": true, "pork": true, "chicken": "conditional", "fish": true, "german_sausages": true, "russian_sausages": false}` |
| `favorite_cuisines`| `JSONB` | `NOT NULL` | `["wok", "noodles", "bolognese", "homestyle"]` |
| `sauce_preference` | `JSONB` | `NOT NULL` | `{"sauce_volume": "abundant", "separate_marinade": true, "sweet_sour_garlic": true}` |
| `salt_sensitivity` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'high'` | `normal`, `high`, `extreme` (не добавлять соль, уменьшать соевый соус) |
| `disliked_ingredients` | `JSONB` | `NOT NULL` | `["mushrooms", "bell_peppers"]` |
| `equipment` | `JSONB` | `NOT NULL` | `["skillet", "multicooker", "oven"]` |
| `habits` | `JSONB` | `NOT NULL` | `{"default_meat_portion_g": 200, "exact_measurements": true}` |
| `ai_profile_summary` | `TEXT` | `NOT NULL` | Сформированный текстовый профиль для подачи в системный промпт LLM |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL, DEFAULT now()` | Дата последнего обновления |

---

### 3. `ingredients` (Канонический справочник продуктов)
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK |
| `canonical_name` | `VARCHAR(150)` | `NOT NULL, UNIQUE` | Каноническое название (напр. "Соевый соус Kikkoman") |
| `category` | `VARCHAR(50)` | `NOT NULL` | `sauce`, `meat`, `noodles`, `spice`, `produce`, `staple`, `oil` |
| `default_unit` | `VARCHAR(20)` | `NOT NULL` | `g`, `ml`, `pcs`, `tbsp`, `tsp` |
| `density_g_per_ml`| `NUMERIC(6,3)` | `NULLABLE` | Плотность для безопасного перевода граммов в мл при наличии |

---

### 4. `user_pantry_items` (Запасы пользователя)
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK |
| `user_id` | `UUID` | `NOT NULL, FK -> users.id` | Пользователь |
| `ingredient_id` | `UUID` | `NOT NULL, FK -> ingredients.id` | Связь со справочником |
| `quantity` | `NUMERIC(10,2)` | `NULLABLE` | `NULL` = количество неизвестно/не взвешено |
| `unit` | `VARCHAR(20)` | `NOT NULL` | Единица измерения (`g`, `ml`, `pcs`, etc.) |
| `status` | `VARCHAR(30)` | `NOT NULL` | `in_stock`, `low`, `out`, `needs_confirmation` |
| `best_before` | `DATE` | `NULLABLE` | Срок годности |
| `last_confirmed_at` | `TIMESTAMP WITH TIME ZONE` | `NULLABLE` | Когда пользователь подтвердил фактическое наличие |
| `source` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'manual'` | `history_import`, `manual`, `receipt` |
| `notes` | `TEXT` | `NULLABLE` | Дополнительные заметки |

---

### 5. `recipes` (Обобщённый рецепт)
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK |
| `owner_user_id` | `UUID` | `NULLABLE, FK -> users.id` | `NULL` для базовых рецептов |
| `title` | `VARCHAR(200)` | `NOT NULL` | Название рецепта |
| `description` | `TEXT` | `NOT NULL` | Описание блюда |
| `cuisine` | `VARCHAR(50)` | `NULLABLE` | Кухня (китайская, итальянская и т.д.) |
| `difficulty` | `VARCHAR(20)` | `NOT NULL, DEFAULT 'medium'` | `easy`, `medium`, `hard` |
| `duration_minutes`| `INTEGER` | `NULLABLE` | Время приготовления |
| `base_servings` | `INTEGER` | `NOT NULL, DEFAULT 1` | Базовое количество порций |
| `visibility` | `VARCHAR(20)` | `NOT NULL, DEFAULT 'shared'`| `shared`, `private` |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL, DEFAULT now()` | Дата создания |

---

### 6. `recipe_sources`
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK |
| `recipe_id` | `UUID` | `NOT NULL, UNIQUE, FK -> recipes.id` | Связанный рецепт |
| `source_type` | `VARCHAR(50)` | `NOT NULL` | `historical_context`, `user_created`, `ai_generated` |
| `source_name` | `VARCHAR(150)` | `NOT NULL` | Имя источника / дата согласования |
| `source_url` | `VARCHAR(500)` | `NULLABLE` | Ссылка, если применимо |
| `attribution` | `TEXT` | `NULLABLE` | Заметки об авторстве и оригинале |

---

### 7. `recipe_versions` (Версии рецепта — ядро неизменности)
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK версии |
| `recipe_id` | `UUID` | `NOT NULL, FK -> recipes.id` | Рецепт |
| `version_number` | `INTEGER` | `NOT NULL` | 1 (оригинал), 2, 3... |
| `parent_version_id`| `UUID` | `NULLABLE, FK -> recipe_versions.id` | Предыдущая версия |
| `change_summary` | `TEXT` | `NOT NULL` | Описание изменений («Оригинальный рецепт от 22.10.2026», «Уменьшена соль на 30%») |
| `created_by_user_id`| `UUID` | `NULLABLE, FK -> users.id` | Автор версии |
| `is_base_version` | `BOOLEAN` | `NOT NULL, DEFAULT FALSE` | Является ли канонической базовой версией |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL, DEFAULT now()` | Время создания |

---

### 8. `recipe_ingredients` (Ингредиенты версии)
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK |
| `recipe_version_id`| `UUID` | `NOT NULL, FK -> recipe_versions.id`| Версия рецепта |
| `ingredient_id` | `UUID` | `NULLABLE, FK -> ingredients.id` | Канонический продукт |
| `ingredient_name_snapshot` | `VARCHAR(150)` | `NOT NULL` | Точный снимок названия |
| `quantity` | `NUMERIC(10,2)` | `NULLABLE` | Количество |
| `unit` | `VARCHAR(20)` | `NOT NULL` | Единица измерения |
| `role` | `VARCHAR(30)` | `NOT NULL` | `marinade`, `main_sauce`, `required`, `optional`, `garnish` |
| `preparation_note`| `VARCHAR(200)` | `NULLABLE` | «мелко нарезать», «взбить» |
| `scalable` | `BOOLEAN` | `NOT NULL, DEFAULT TRUE` | Масштабируется ли при смене порций |

---

### 9. `recipe_steps` (Шаги приготовления версии)
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK |
| `recipe_version_id`| `UUID` | `NOT NULL, FK -> recipe_versions.id`| Версия рецепта |
| `step_number` | `INTEGER` | `NOT NULL` | Порядковый номер шага (1, 2, 3...) |
| `instruction` | `TEXT` | `NOT NULL` | Инструкция |
| `duration_seconds`| `INTEGER` | `NULLABLE` | Время таймера в секундах |
| `temperature_c` | `INTEGER` | `NULLABLE` | Температура (для духовки/плиты) |

---

### 10. `cooking_sessions`
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK |
| `user_id` | `UUID` | `NOT NULL, FK -> users.id` | Пользователь |
| `recipe_id` | `UUID` | `NOT NULL, FK -> recipes.id` | Готовившееся блюдо |
| `recipe_version_id`| `UUID` | `NOT NULL, FK -> recipe_versions.id`| Конкретная версия |
| `servings` | `INTEGER` | `NOT NULL, DEFAULT 1` | Фактические порции |
| `status` | `VARCHAR(30)` | `NOT NULL` | `in_progress`, `completed`, `abandoned` |
| `notes` | `TEXT` | `NULLABLE` | Заметки по ходу готовки |
| `actual_changes` | `JSONB` | `NULLABLE` | Фактически замененные ингредиенты |
| `cooked_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL, DEFAULT now()` | Время готовки |

---

### 11. `reviews` (Вкусовой отзыв)
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK |
| `user_id` | `UUID` | `NOT NULL, FK -> users.id` | Пользователь |
| `cooking_session_id`| `UUID` | `NOT NULL, UNIQUE, FK -> cooking_sessions.id` | Связанная сессия |
| `taste_rating` | `SMALLINT` | `CHECK (taste_rating BETWEEN 1 AND 5)` | Общая оценка вкуса |
| `saltiness_rating` | `SMALLINT` | `CHECK (saltiness_rating BETWEEN 1 AND 5)` | 1 = пресно, 3 = норма, 5 = пересолено |
| `sauce_amount_rating`| `SMALLINT` | `CHECK (sauce_amount_rating BETWEEN 1 AND 5)` | 1 = мало, 3 = норма, 5 = много |
| `sweetness_rating` | `SMALLINT` | `CHECK (sweetness_rating BETWEEN 1 AND 5)` | Оценка сладости |
| `acidity_rating` | `SMALLINT` | `CHECK (acidity_rating BETWEEN 1 AND 5)` | Оценка кислоты |
| `texture_rating` | `SMALLINT` | `CHECK (texture_rating BETWEEN 1 AND 5)` | Оценка текстуры |
| `comment` | `TEXT` | `NULLABLE` | Текстовый отзыв пользователя |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL, DEFAULT now()` | Время создания |

---

### 12. `personal_recipe_adjustments`
| Поле | Тип | Ограничения | Описание |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | PK |
| `user_id` | `UUID` | `NOT NULL, FK -> users.id` | Пользователь |
| `base_recipe_id` | `UUID` | `NOT NULL, FK -> recipes.id` | Исходный рецепт |
| `source_version_id`| `UUID` | `NOT NULL, FK -> recipe_versions.id`| Исходная версия |
| `adapted_version_id`| `UUID` | `NOT NULL, FK -> recipe_versions.id`| Новая адаптированная версия |
| `trigger_review_id`| `UUID` | `NULLABLE, FK -> reviews.id` | Отзыв, спровоцировавший адаптацию |
| `reason` | `TEXT` | `NOT NULL` | Причина изменения (напр. «Снижение соли по отзыву #12») |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | `NOT NULL, DEFAULT now()` | Время адаптации |

---

### 13. `shopping_lists` и `shopping_list_items`
- `shopping_lists`: `id`, `user_id`, `title`, `status` (`active`, `archived`), `created_at`.
- `shopping_list_items`: `id`, `shopping_list_id`, `ingredient_id` (nullable), `item_name`, `quantity`, `unit`, `is_bought`, `recipe_id` (nullable).
