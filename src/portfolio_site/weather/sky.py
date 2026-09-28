import math
from dataclasses import asdict, dataclass

from portfolio_site.weather.forecast import Conditions

# Precipitation rates that count as "as heavy as the canvas gets".
HEAVY_RAIN_MM_H = 10.0
HEAVY_SNOW_CM_H = 3.0
# Wind speed at which particles are blown fully sideways.
GALE_KMH = 50.0


@dataclass(frozen=True)
class _Floor:
    cloud: float = 0.0
    rain: float = 0.0
    snow: float = 0.0
    fog: float = 0.0
    thunder: float = 0.0


# WMO weather codes → minimum intensities. The measured rates can push values
# higher; the code guarantees the sky looks like what the code describes.
_CODE_FLOORS: dict[int, _Floor] = {
    0: _Floor(),
    1: _Floor(cloud=0.15),
    2: _Floor(cloud=0.45),
    3: _Floor(cloud=0.9),
    45: _Floor(cloud=0.7, fog=0.6),
    48: _Floor(cloud=0.7, fog=0.8),
    51: _Floor(cloud=0.75, rain=0.12),
    53: _Floor(cloud=0.75, rain=0.22),
    55: _Floor(cloud=0.8, rain=0.32),
    56: _Floor(cloud=0.8, rain=0.15),
    57: _Floor(cloud=0.8, rain=0.3),
    61: _Floor(cloud=0.8, rain=0.35),
    63: _Floor(cloud=0.85, rain=0.6),
    65: _Floor(cloud=0.95, rain=0.9),
    66: _Floor(cloud=0.85, rain=0.4),
    67: _Floor(cloud=0.95, rain=0.8),
    71: _Floor(cloud=0.8, snow=0.3),
    73: _Floor(cloud=0.85, snow=0.55),
    75: _Floor(cloud=0.95, snow=0.9),
    77: _Floor(cloud=0.8, snow=0.2),
    80: _Floor(cloud=0.7, rain=0.4),
    81: _Floor(cloud=0.8, rain=0.65),
    82: _Floor(cloud=0.9, rain=1.0),
    85: _Floor(cloud=0.75, snow=0.5),
    86: _Floor(cloud=0.9, snow=0.9),
    95: _Floor(cloud=0.95, rain=0.75, thunder=0.6),
    96: _Floor(cloud=0.95, rain=0.85, thunder=0.8),
    99: _Floor(cloud=1.0, rain=1.0, thunder=1.0),
}


@dataclass(frozen=True)
class SkyWeather:
    """Canvas-ready weather. Intensities are 0..1; wind is -1 (westward) .. 1 (eastward)."""

    cloud: float = 0.0
    rain: float = 0.0
    snow: float = 0.0
    fog: float = 0.0
    thunder: float = 0.0
    wind: float = 0.0
    code: int = 0
    lat: float | None = None

    def as_json(self) -> dict[str, float | int | None]:
        return asdict(self)


def precipitation_intensity(rate: float, heavy: float) -> float:
    """Log curve: drizzle is visible, and anything at or past `heavy` saturates at 1."""
    if rate <= 0:
        return 0.0
    return _unit(math.log1p(rate) / math.log1p(heavy))


def wind_drift(speed_kmh: float, from_deg: float) -> float:
    """Horizontal push. Meteorological direction is where the wind comes *from*."""
    eastward = -math.sin(math.radians(from_deg))
    return max(-1.0, min(1.0, _unit(speed_kmh / GALE_KMH) * eastward))


def sky_from_conditions(conditions: Conditions, latitude: float | None = None) -> SkyWeather:
    floor = _CODE_FLOORS.get(conditions.weather_code, _Floor())
    rain = max(floor.rain, precipitation_intensity(conditions.rain_mm_h, HEAVY_RAIN_MM_H))
    snow = max(floor.snow, precipitation_intensity(conditions.snow_cm_h, HEAVY_SNOW_CM_H))
    cloud = max(floor.cloud, _unit(conditions.cloud_cover / 100.0))
    if rain or snow:
        cloud = max(cloud, 0.6)
    return SkyWeather(
        cloud=_round(cloud),
        rain=_round(rain),
        snow=_round(snow),
        fog=_round(floor.fog),
        thunder=_round(floor.thunder),
        wind=_round(wind_drift(conditions.wind_kmh, conditions.wind_from_deg)),
        code=conditions.weather_code,
        lat=None if latitude is None else round(latitude),
    )


def _unit(value: float) -> float:
    return max(0.0, min(1.0, value))


def _round(value: float) -> float:
    return round(value, 2) + 0.0
