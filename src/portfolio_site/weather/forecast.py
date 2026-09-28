import math
from dataclasses import dataclass
from urllib.parse import urlencode

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
CURRENT_FIELDS = (
    "temperature_2m",
    "rain",
    "showers",
    "snowfall",
    "cloud_cover",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m",
)
_DEFAULT_INTERVAL_S = 900


class ForecastError(ValueError):
    pass


@dataclass(frozen=True)
class Conditions:
    weather_code: int
    cloud_cover: float
    rain_mm_h: float
    snow_cm_h: float
    wind_kmh: float
    wind_from_deg: float
    temperature_c: float | None = None


def forecast_url(latitude: float, longitude: float) -> str:
    query = urlencode(
        {
            "latitude": f"{latitude:.2f}",
            "longitude": f"{longitude:.2f}",
            "current": ",".join(CURRENT_FIELDS),
        }
    )
    return f"{OPEN_METEO_URL}?{query}"


def parse_forecast(payload: object) -> Conditions:
    """Open-Meteo `current` block → rates per hour.

    Current precipitation values are sums over the preceding `interval` seconds
    (15 minutes), so they are scaled up to hourly rates.
    """
    current = payload.get("current") if isinstance(payload, dict) else None
    if not isinstance(current, dict):
        raise ForecastError("Forecast response has no current conditions")
    code = current.get("weather_code")
    if isinstance(code, bool) or not isinstance(code, (int, float)):
        raise ForecastError("Forecast response has no weather code")
    interval = _number(current.get("interval")) or _DEFAULT_INTERVAL_S
    per_hour = 3600.0 / interval
    return Conditions(
        weather_code=int(code),
        cloud_cover=_number(current.get("cloud_cover")),
        rain_mm_h=(_number(current.get("rain")) + _number(current.get("showers"))) * per_hour,
        snow_cm_h=_number(current.get("snowfall")) * per_hour,
        wind_kmh=_number(current.get("wind_speed_10m")),
        wind_from_deg=_number(current.get("wind_direction_10m")),
        temperature_c=_optional(current.get("temperature_2m")),
    )


def _optional(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def _number(value: object) -> float:
    number = _optional(value)
    return number if number is not None and number > 0 else 0.0
