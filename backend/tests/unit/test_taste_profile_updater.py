from app.domain.services.taste_profile_updater import TasteProfileUpdaterService


def test_saltiness_triggers_high_sensitivity_rule():
    initial_profile = {
        "meat_preferences": {"beef": True, "pork": True, "chicken": True},
        "sauce_preference": {"sauce_volume": "abundant"},
        "salt_sensitivity": "normal",
        "disliked_ingredients": ["грибы", "болгарский перец"],
        "equipment": ["сковорода", "мультиварка"],
        "habits": {},
    }

    # User rates saltiness as 5 (way too salty!)
    updated = TasteProfileUpdaterService.update_profile_from_review(
        current_profile=initial_profile,
        saltiness_rating=5,
        sauce_amount_rating=3,
        taste_rating=3,
        sweetness_rating=3,
        acidity_rating=3,
        comment="Слишком солёно из-за соевого соуса",
    )

    assert updated["salt_sensitivity"] == "high"
    assert "уменьшать соевый соус" in updated["habits"]["salt_rule"]
    assert "Чувствительность к соли: high" in updated["ai_profile_summary"]


def test_dry_dish_triggers_extra_sauce_preference():
    initial_profile = {
        "meat_preferences": {"beef": True},
        "sauce_preference": {"sauce_volume": "abundant"},
        "salt_sensitivity": "normal",
        "disliked_ingredients": [],
        "equipment": ["сковорода"],
        "habits": {},
    }

    # User rates sauce amount as 1 (too dry)
    updated = TasteProfileUpdaterService.update_profile_from_review(
        current_profile=initial_profile,
        saltiness_rating=3,
        sauce_amount_rating=1,
        taste_rating=3,
        sweetness_rating=3,
        acidity_rating=3,
        comment="Мало соуса для лапши",
    )

    assert updated["sauce_preference"]["sauce_volume"] == "extra_abundant"
