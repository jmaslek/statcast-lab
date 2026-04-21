"""Shared utilities for the backend API."""

from typing import Any, TypeVar

T = TypeVar("T")


def safe_div(num: float, den: float) -> float:
    """Divide two numbers, returning 0.0 if denominator is zero."""
    return num / den if den else 0.0


def safe_pct(num: int, den: int, precision: int = 1) -> float:
    """Compute percentage safely: (num / den) * 100, rounded."""
    return round(num / den * 100, precision) if den else 0.0


def sort_and_limit(
    items: list[T],
    sort: str,
    allowed: set[str],
    desc: bool = True,
    limit: int | None = None,
    offset: int = 0,
) -> tuple[list[T], int]:
    """Sort a list of Pydantic models by attribute name, putting None values last.

    Returns (paginated_items, total_count_before_pagination).
    """
    if sort in allowed:
        items.sort(
            key=lambda item: _sort_key(getattr(item, sort)),
            reverse=desc,
        )
    total = len(items)
    if offset:
        items = items[offset:]
    if limit is not None:
        items = items[:limit]
    return items, total


def _sort_key(val: Any) -> tuple[bool, Any]:
    """Sort key that puts None values last regardless of sort direction."""
    return (val is not None, val if val is not None else 0)
