from enum import Enum
from typing import Optional, Tuple
from decimal import Decimal


class Dimension(str, Enum):
    MASS = "mass"
    VOLUME = "volume"
    COUNT = "count"
    UNSPECIFIED = "unspecified"


class StandardUnit(str, Enum):
    # Mass
    G = "g"
    KG = "kg"
    # Volume
    ML = "ml"
    L = "l"
    TSP = "tsp"    # 5 ml
    TBSP = "tbsp"  # 15 ml
    # Count
    PCS = "pcs"
    CLOVE = "clove"
    PINCH = "pinch"
    TO_TASTE = "to_taste"


# Base units for normalization:
# Mass -> grams (g)
# Volume -> milliliters (ml)
# Count -> pieces (pcs)
UNIT_METADATA = {
    StandardUnit.G: (Dimension.MASS, Decimal("1.0")),
    StandardUnit.KG: (Dimension.MASS, Decimal("1000.0")),
    StandardUnit.ML: (Dimension.VOLUME, Decimal("1.0")),
    StandardUnit.L: (Dimension.VOLUME, Decimal("1000.0")),
    StandardUnit.TSP: (Dimension.VOLUME, Decimal("5.0")),
    StandardUnit.TBSP: (Dimension.VOLUME, Decimal("15.0")),
    StandardUnit.PCS: (Dimension.COUNT, Decimal("1.0")),
    StandardUnit.CLOVE: (Dimension.COUNT, Decimal("1.0")),
    StandardUnit.PINCH: (Dimension.UNSPECIFIED, Decimal("1.0")),
    StandardUnit.TO_TASTE: (Dimension.UNSPECIFIED, Decimal("1.0")),
}


def normalize_unit_str(raw_unit: Optional[str]) -> str:
    if not raw_unit:
        return StandardUnit.PCS.value
    u = raw_unit.strip().lower()
    mapping = {
        "г": StandardUnit.G.value,
        "гр": StandardUnit.G.value,
        "грамм": StandardUnit.G.value,
        "g": StandardUnit.G.value,
        "gram": StandardUnit.G.value,
        "grams": StandardUnit.G.value,
        "кг": StandardUnit.KG.value,
        "kg": StandardUnit.KG.value,
        "мл": StandardUnit.ML.value,
        "ml": StandardUnit.ML.value,
        "л": StandardUnit.L.value,
        "l": StandardUnit.L.value,
        "ч. л.": StandardUnit.TSP.value,
        "ч.л.": StandardUnit.TSP.value,
        "ч л": StandardUnit.TSP.value,
        "tsp": StandardUnit.TSP.value,
        "ст. л.": StandardUnit.TBSP.value,
        "ст.л.": StandardUnit.TBSP.value,
        "ст л": StandardUnit.TBSP.value,
        "tbsp": StandardUnit.TBSP.value,
        "шт": StandardUnit.PCS.value,
        "шт.": StandardUnit.PCS.value,
        "pcs": StandardUnit.PCS.value,
        "piece": StandardUnit.PCS.value,
        "pieces": StandardUnit.PCS.value,
        "зубчик": StandardUnit.CLOVE.value,
        "зубчика": StandardUnit.CLOVE.value,
        "зубчиков": StandardUnit.CLOVE.value,
        "clove": StandardUnit.CLOVE.value,
        "cloves": StandardUnit.CLOVE.value,
        "щепотка": StandardUnit.PINCH.value,
        "pinch": StandardUnit.PINCH.value,
        "по вкусу": StandardUnit.TO_TASTE.value,
        "to taste": StandardUnit.TO_TASTE.value,
    }
    return mapping.get(u, u)
