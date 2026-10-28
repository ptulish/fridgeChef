from enum import Enum


class MatchStatus(str, Enum):
    SUFFICIENT = "sufficient"
    INSUFFICIENT = "insufficient"
    NEEDS_CONFIRMATION = "needs_confirmation"
    MISSING_REQUIRED = "missing_required"
    MISSING_OPTIONAL = "missing_optional"
