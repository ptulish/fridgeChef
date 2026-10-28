from enum import Enum


class IngredientRole(str, Enum):
    REQUIRED = "required"
    OPTIONAL = "optional"
    GARNISH = "garnish"
    MARINADE = "marinade"
    MAIN_SAUCE = "main_sauce"
