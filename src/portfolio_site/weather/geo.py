from dataclasses import dataclass
from urllib.parse import quote

GEOJS_URL = "https://get.geojs.io/v1/ip/geo"


class GeoError(ValueError):
    pass


@dataclass(frozen=True)
class Location:
    latitude: float
    longitude: float
    city: str = ""
    timezone: str = ""


def geo_url(ip: str | None) -> str:
    """GeoJS lookup URL. Without an IP, GeoJS answers for the caller (the server itself)."""
    if not ip:
        return f"{GEOJS_URL}.json"
    return f"{GEOJS_URL}/{quote(ip, safe='.:')}.json"


def parse_geo(payload: object) -> Location:
    if not isinstance(payload, dict):
        raise GeoError("Geolocation response is not an object")
    latitude = _coordinate(payload.get("latitude"), 90.0, "latitude")
    longitude = _coordinate(payload.get("longitude"), 180.0, "longitude")
    return Location(
        latitude=latitude,
        longitude=longitude,
        city=str(payload.get("city") or ""),
        timezone=str(payload.get("timezone") or ""),
    )


def _coordinate(value: object, limit: float, name: str) -> float:
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise GeoError(f"Geolocation response has no usable {name}") from None
    if not -limit <= number <= limit:
        raise GeoError(f"Geolocation {name} {number} is out of range")
    return number
