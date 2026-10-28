import pytest
from decimal import Decimal
from app.domain.services.unit_converter import (
    UnitConverterService,
    IncompatibleDimensionError,
)


def test_mass_conversions():
    # 500 g -> 0.5 kg
    res = UnitConverterService.convert(Decimal("500"), "g", "kg")
    assert res == Decimal("0.5")

    # 1.2 kg -> 1200 g
    res = UnitConverterService.convert(Decimal("1.2"), "kg", "g")
    assert res == Decimal("1200")


def test_volume_conversions():
    # 1500 ml -> 1.5 l
    res = UnitConverterService.convert(Decimal("1500"), "ml", "l")
    assert res == Decimal("1.5")

    # 1 tbsp -> 3 tsp (15ml / 5ml)
    res = UnitConverterService.convert(Decimal("1"), "tbsp", "tsp")
    assert res == Decimal("3.0")

    # 2 tsp -> 10 ml
    res = UnitConverterService.convert(Decimal("2"), "tsp", "ml")
    assert res == Decimal("10.0")


def test_cross_dimension_error_without_density():
    with pytest.raises(IncompatibleDimensionError):
        UnitConverterService.convert(Decimal("100"), "g", "ml")


def test_cross_dimension_with_density():
    # 100 ml of water (density 1.0 g/ml) -> 100 g
    res = UnitConverterService.convert(
        Decimal("100"), "ml", "g", density_g_per_ml=Decimal("1.0")
    )
    assert res == Decimal("100.0")
