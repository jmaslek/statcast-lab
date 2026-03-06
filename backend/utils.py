"""Shared math utilities for the backend API."""


def safe_div(num: float, den: float) -> float:
    """Divide two numbers, returning 0.0 if denominator is zero."""
    return num / den if den else 0.0


def safe_pct(num: int, den: int, precision: int = 1) -> float:
    """Compute percentage safely: (num / den) * 100, rounded."""
    return round(num / den * 100, precision) if den else 0.0
