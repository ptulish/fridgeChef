from decimal import Decimal
from typing import Optional, Tuple
from app.domain.value_objects.units import (
    StandardUnit,
    Dimension,
    UNIT_METADATA,
    normalize_unit_str,
)


class UnitConversionError(Exception):
    pass


class IncompatibleDimensionError(UnitConversionError):
    pass


class UnitConverterService:
    @staticmethod
    def get_dimension_and_factor(unit_str: str) -> Tuple[Dimension, Decimal]:
        norm = normalize_unit_str(unit_str)
        try:
            std_unit = StandardUnit(norm)
            if std_unit in UNIT_METADATA:
                return UNIT_METADATA[std_unit]
        except ValueError:
            pass
        return Dimension.UNSPECIFIED, Decimal("1.0")

    @classmethod
    def convert(
        cls,
        quantity: Decimal,
        from_unit: str,
        to_unit: str,
        density_g_per_ml: Optional[Decimal] = None,
    ) -> Decimal:
        """
        Converts quantity from `from_unit` to `to_unit`.
        Guarantees dimensional safety (Mass <-> Mass, Volume <-> Volume).
        Rejects cross-dimension conversion unless density_g_per_ml is provided.
        """
        norm_from = normalize_unit_str(from_unit)
        norm_to = normalize_unit_str(to_unit)

        if norm_from == norm_to:
            return quantity

        dim_from, factor_from = cls.get_dimension_and_factor(norm_from)
        dim_to, factor_to = cls.get_dimension_and_factor(norm_to)

        # Cross-dimension without density is forbidden
        if dim_from != dim_to:
            if dim_from == Dimension.MASS and dim_to == Dimension.VOLUME and density_g_per_ml:
                # mass (g) = volume (ml) * density -> volume (ml) = mass (g) / density
                grams = quantity * factor_from
                ml = grams / density_g_per_ml
                return ml / factor_to
            elif dim_from == Dimension.VOLUME and dim_to == Dimension.MASS and density_g_per_ml:
                # volume (ml) -> mass (g) = volume * density
                ml = quantity * factor_from
                grams = ml * density_g_per_ml
                return grams / factor_to
            raise IncompatibleDimensionError(
                f"Cannot safely convert between {dim_from.value} ({from_unit}) and {dim_to.value} ({to_unit}) without density specification."
            )

        if dim_from == Dimension.UNSPECIFIED:
            # Cannot safely convert custom/unspecified dimensions
            raise IncompatibleDimensionError(
                f"Cannot automatically convert unspecified unit: {from_unit} to {to_unit}."
            )

        # Convert to base unit then to target unit
        base_amount = quantity * factor_from
        target_amount = base_amount / factor_to
        return target_amount

    @classmethod
    def are_compatible(cls, unit_a: str, unit_b: str) -> bool:
        norm_a = normalize_unit_str(unit_a)
        norm_b = normalize_unit_str(unit_b)
        if norm_a == norm_b:
            return True
        dim_a, _ = cls.get_dimension_and_factor(norm_a)
        dim_b, _ = cls.get_dimension_and_factor(norm_b)
        return dim_a == dim_b and dim_a != Dimension.UNSPECIFIED
