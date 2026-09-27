import re
from datetime import date

_MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

_RANGE = re.compile(
    r"^([A-Za-z]+(?:\s+\d{4})?)\s*[–—-]\s*(Present|[A-Za-z]+\s+\d{4})$",
    re.IGNORECASE,
)
_POINT = re.compile(r"^([A-Za-z]+)(?:\s+(\d{4}))?$")

# Present sorts after every concrete end date.
_PRESENT = date.max
_UNKNOWN = date.min


def is_date_range(value: str) -> bool:
    return _RANGE.fullmatch(value.strip()) is not None


def span(value: str) -> tuple[date, date]:
    """Return (start, end) for a resume date range. Unknown text sorts last."""
    match = _RANGE.fullmatch(value.strip())
    if match is None:
        return _UNKNOWN, _UNKNOWN
    end = _point(match.group(2), None)
    start = _point(match.group(1), end.year if end is not _PRESENT else None)
    return start, end


def _point(value: str, default_year: int | None) -> date:
    if value.strip().lower() == "present":
        return _PRESENT
    match = _POINT.fullmatch(value.strip())
    if match is None:
        return _UNKNOWN
    month = _MONTHS.get(match.group(1).lower())
    if month is None:
        return _UNKNOWN
    year_text = match.group(2)
    year = int(year_text) if year_text else default_year
    if year is None:
        return _UNKNOWN
    return date(year, month, 1)
