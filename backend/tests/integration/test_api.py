import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["app"] == "FridgeChef"


@pytest.mark.asyncio
async def test_auth_me():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["name"] == "Chef"


@pytest.mark.asyncio
async def test_pantry_listing():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/pantry")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) > 0
        # Check Apple cider vinegar is present
        vinegar = next((i for i in items if "уксус" in i["ingredient"]["canonical_name"].lower()), None)
        assert vinegar is not None
        assert vinegar["status"] == "in_stock"


@pytest.mark.asyncio
async def test_pantry_add_custom_ingredient():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        custom_name = "Тестовый пармезан для тестов"
        resp = await client.post(
            "/api/v1/pantry",
            json={
                "custom_ingredient_name": custom_name,
                "category": "dairy",
                "quantity": 150,
                "unit": "g",
                "status": "in_stock",
                "notes": "Для пасты",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ingredient"]["canonical_name"] == custom_name
        assert data["ingredient"]["category"] == "dairy"
        assert float(data["quantity"]) == 150.0
        assert data["status"] == "in_stock"
        pantry_item_id = data["id"]
        ingredient_id = data["ingredient_id"]

        # Cleanup so database stays clean
        from app.infrastructure.db.session import async_session_factory
        from sqlalchemy import text
        async with async_session_factory() as session:
            await session.execute(text("DELETE FROM user_pantry_items WHERE id = :id"), {"id": pantry_item_id})
            await session.execute(text("DELETE FROM ingredients WHERE id = :id"), {"id": ingredient_id})
            await session.commit()


@pytest.mark.asyncio
async def test_recipe_matching_pipeline():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/recipes/matched")
        assert resp.status_code == 200
        matches = resp.json()
        assert len(matches) >= 3

        # All dishes should have match calculated
        for m in matches:
            assert "match_percentage" in m
            assert "can_cook_now" in m
            assert "ingredients" in m


@pytest.mark.asyncio
async def test_cooking_session_and_review_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Get recipes
        r_resp = await client.get("/api/v1/recipes")
        recipes = r_resp.json()
        recipe = recipes[0]
        version = recipe["versions"][0]

        # 2. Start cooking session
        start_resp = await client.post(
            "/api/v1/cooking/sessions",
            json={
                "recipe_id": recipe["id"],
                "recipe_version_id": version["id"],
                "servings": 1,
            },
        )
        assert start_resp.status_code == 200
        session_data = start_resp.json()
        session_id = session_data["id"]

        # 3. Complete cooking session
        comp_resp = await client.post(
            f"/api/v1/cooking/sessions/{session_id}/complete",
            json={"notes": "Готовил строго по таймеру", "actual_changes": {"pepper": "щепотка"}},
        )
        assert comp_resp.status_code == 200
        assert comp_resp.json()["status"] == "completed"

        # 4. Submit review: Saltiness = 5 (too salty)
        rev_resp = await client.post(
            f"/api/v1/cooking/sessions/{session_id}/review",
            json={
                "taste_rating": 4,
                "saltiness_rating": 5,
                "sauce_amount_rating": 4,
                "comment": "Получилось слишком солено от соевого соуса!",
            },
        )
        assert rev_resp.status_code == 200
        assert rev_resp.json()["saltiness_rating"] == 5

        # 5. Verify User Taste Profile was automatically updated!
        prof_resp = await client.get("/api/v1/profile")
        assert prof_resp.status_code == 200
        prof_data = prof_resp.json()
        assert prof_data["salt_sensitivity"] == "high"
        assert "уменьшать соевый соус" in prof_data["habits"]["salt_rule"]

        # Cleanup test cooking session & reviews to leave user database clean
        from app.infrastructure.db.session import async_session_factory
        from sqlalchemy import text
        async with async_session_factory() as session:
            await session.execute(text("DELETE FROM reviews WHERE cooking_session_id = :sid"), {"sid": session_id})
            await session.execute(text("DELETE FROM cooking_sessions WHERE id = :sid"), {"sid": session_id})
            await session.commit()


@pytest.mark.asyncio
async def test_shopping_list_add_recipe_items():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Get recipe
        r_resp = await client.get("/api/v1/recipes")
        recipe = r_resp.json()[0]
        version = recipe["versions"][0]

        # Add missing items to shopping list
        add_resp = await client.post(
            "/api/v1/shopping/add-recipe",
            json={
                "recipe_id": recipe["id"],
                "recipe_version_id": version["id"],
                "servings": 2,
            },
        )
        assert add_resp.status_code == 200
        slist = add_resp.json()
        assert len(slist["items"]) > 0

        # Add a dedicated item to test toggle
        item_resp = await client.post(
            "/api/v1/shopping/items",
            json={"item_name": "Тестовый кунжут", "quantity": 10, "unit": "g"},
        )
        assert item_resp.status_code == 200
        test_item = item_resp.json()
        assert test_item["is_bought"] is False

        toggle_resp = await client.patch(f"/api/v1/shopping/items/{test_item['id']}/toggle")
        assert toggle_resp.status_code == 200
        assert toggle_resp.json()["is_bought"] is True

        # Cleanup shopping test items
        from app.infrastructure.db.session import async_session_factory
        from sqlalchemy import text
        async with async_session_factory() as session:
            await session.execute(text("DELETE FROM shopping_list_items WHERE item_name = 'Тестовый кунжут' OR recipe_id = :rid"), {"rid": recipe["id"]})
            await session.commit()


@pytest.mark.asyncio
async def test_ai_status_and_generator_metadata():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Check AI status
        st_resp = await client.get("/api/v1/ai/status")
        assert st_resp.status_code == 200
        st = st_resp.json()
        assert "has_gemini_key" in st
        assert "provider" in st

        # 2. Generate recipe and verify provenance metadata
        gen_resp = await client.post(
            "/api/v1/ai/generate-recipe",
            json={"prompt": "Вкусный ужин с курицей"},
        )
        assert gen_resp.status_code == 200
        data = gen_resp.json()
        assert "generator" in data
        assert data["generator"] in ("gemini", "mock")
        assert "provider_name" in data
        assert "title" in data


@pytest.mark.asyncio
async def test_depletion_preview_complete_and_undo():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Get a recipe
        r_resp = await client.get("/api/v1/recipes")
        recipes = r_resp.json()
        recipe = recipes[0]
        version = recipe["versions"][0]

        # 2. Start cooking session
        start_resp = await client.post(
            "/api/v1/cooking/sessions",
            json={
                "recipe_id": recipe["id"],
                "recipe_version_id": version["id"],
                "servings": 2,
            },
        )
        assert start_resp.status_code == 200
        session_id = start_resp.json()["id"]

        # 3. Test depletion preview
        prev_resp = await client.post(f"/api/v1/cooking/sessions/{session_id}/depletion-preview")
        assert prev_resp.status_code == 200
        preview = prev_resp.json()
        assert preview["session_id"] == session_id
        assert len(preview["deductions"]) > 0

        # Find an item to deduct
        deductible = next((d for d in preview["deductions"] if d["pantry_item_id"]), None)
        assert deductible is not None, "At least one pantry item should be matched"

        # 4. Complete session with deduction
        comp_resp = await client.post(
            f"/api/v1/cooking/sessions/{session_id}/complete",
            json={
                "notes": "Готовка с тестированием списания",
                "deductions": [
                    {
                        "pantry_item_id": deductible["pantry_item_id"],
                        "ingredient_name": deductible["ingredient_name"],
                        "deduct_qty": 50.0,
                        "unit": deductible["unit"],
                        "new_fuzzy": "low",
                        "set_out": False,
                    }
                ],
            },
        )
        assert comp_resp.status_code == 200
        assert comp_resp.json()["status"] == "completed"

        # 5. Verify transaction was logged in ledger
        tx_resp = await client.get("/api/v1/inventory/transactions")
        assert tx_resp.status_code == 200
        txs = tx_resp.json()
        assert len(txs) > 0
        latest_tx = txs[0]
        assert latest_tx["cooking_session_id"] == session_id
        assert latest_tx["reason"] == "cooked"

        # 6. Test undo transaction
        undo_resp = await client.post(f"/api/v1/inventory/transactions/{latest_tx['id']}/undo")
        assert undo_resp.status_code == 200
        undo_data = undo_resp.json()
        assert undo_data["status"] == "success"
        assert undo_data["restored_item"] is not None

        # Cleanup
        from app.infrastructure.db.session import async_session_factory
        from sqlalchemy import text
        async with async_session_factory() as session:
            await session.execute(text("DELETE FROM inventory_transactions WHERE cooking_session_id = :sid"), {"sid": session_id})
            await session.execute(text("DELETE FROM cooking_sessions WHERE id = :sid"), {"sid": session_id})
            await session.commit()


@pytest.mark.asyncio
async def test_recipe_recommendations_three_ribbons():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/recipes/recommendations")
        assert resp.status_code == 200
        data = resp.json()
        assert "ribbons" in data
        assert len(data["ribbons"]) == 3

        ribbon_ids = [r["id"] for r in data["ribbons"]]
        assert "cook_now" in ribbon_ids
        assert "finish_low" in ribbon_ids
        assert "almost_bingo" in ribbon_ids

        for rib in data["ribbons"]:
            assert "title_key" in rib
            assert "recipes" in rib
            assert isinstance(rib["recipes"], list)


@pytest.mark.asyncio
async def test_ai_substitute_ingredient():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/ai/substitute",
            json={
                "ingredient_name": "рисовый уксус",
                "recipe_name": "Курица терияки",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "substitutions" in data
        assert len(data["substitutions"]) > 0
        for sub in data["substitutions"]:
            assert "name" in sub
            assert "notes" in sub
            assert "in_pantry" in sub



