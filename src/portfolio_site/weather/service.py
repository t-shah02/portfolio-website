import logging
import threading
import time
from collections.abc import Callable

from portfolio_site.weather.fetch import FetchError, FetchJson, fetch_json
from portfolio_site.weather.forecast import ForecastError, forecast_url, parse_forecast
from portfolio_site.weather.geo import GeoError, Location, geo_url, parse_geo
from portfolio_site.weather.sky import SkyWeather, sky_from_conditions
from portfolio_site.weather.ttl import TtlCache

logger = logging.getLogger(__name__)

# Open-Meteo refreshes current conditions every 15 minutes.
WEATHER_TTL_S = 10 * 60
GEO_TTL_S = 24 * 60 * 60
FAILURE_TTL_S = 2 * 60
COOLDOWN_S = 60
TIMEOUT_S = 1.5

_SELF = "self"


class _Upstream:
    """Stops calling a host for a while after it fails, so an outage costs one timeout, not one per visitor."""

    def __init__(self, cooldown: float) -> None:
        self._cooldown = cooldown
        self._lock = threading.Lock()
        self._down_until = 0.0

    def available(self, now: float) -> bool:
        with self._lock:
            return now >= self._down_until

    def trip(self, now: float) -> None:
        with self._lock:
            self._down_until = now + self._cooldown


class WeatherService:
    """Answers "what is the sky like for this visitor?" and never raises.

    Locations are cached per IP and weather per ~11 km grid cell, so repeat
    visitors and neighbours share a single upstream call.
    """

    def __init__(
        self,
        fetch: FetchJson = fetch_json,
        *,
        clock: Callable[[], float] = time.monotonic,
        timeout: float = TIMEOUT_S,
        weather_ttl: float = WEATHER_TTL_S,
        geo_ttl: float = GEO_TTL_S,
        failure_ttl: float = FAILURE_TTL_S,
        cooldown: float = COOLDOWN_S,
    ) -> None:
        self._fetch = fetch
        self._clock = clock
        self._timeout = timeout
        self._weather_ttl = weather_ttl
        self._geo_ttl = geo_ttl
        self._failure_ttl = failure_ttl
        self._locations: TtlCache[Location | None] = TtlCache(max_entries=4096)
        self._skies: TtlCache[SkyWeather | None] = TtlCache(max_entries=1024)
        self._geo = _Upstream(cooldown)
        self._forecast = _Upstream(cooldown)

    def for_ip(self, ip: str | None) -> SkyWeather | None:
        """`ip=None` (loopback, private networks) falls back to the server's own location."""
        location = self._locate(ip)
        if location is None:
            return None
        return self._sky(location)

    def _locate(self, ip: str | None) -> Location | None:
        key = ip or _SELF
        now = self._clock()
        hit, cached = self._locations.get(key, now)
        if hit:
            return cached
        if not self._geo.available(now):
            return None
        try:
            location = parse_geo(self._fetch(geo_url(ip), self._timeout))
        except (FetchError, GeoError) as exc:
            logger.warning("Geolocation failed for %s: %s", key, exc)
            if isinstance(exc, FetchError):
                self._geo.trip(self._clock())
            self._locations.put(key, None, self._failure_ttl, self._clock())
            return None
        self._locations.put(key, location, self._geo_ttl, self._clock())
        return location

    def _sky(self, location: Location) -> SkyWeather | None:
        key = (round(location.latitude, 1), round(location.longitude, 1))
        now = self._clock()
        hit, cached = self._skies.get(key, now)
        if hit:
            return cached
        if not self._forecast.available(now):
            return None
        try:
            conditions = parse_forecast(self._fetch(forecast_url(*key), self._timeout))
        except (FetchError, ForecastError) as exc:
            logger.warning("Forecast failed for %s: %s", key, exc)
            if isinstance(exc, FetchError):
                self._forecast.trip(self._clock())
            self._skies.put(key, None, self._failure_ttl, self._clock())
            return None
        sky = sky_from_conditions(conditions, location.latitude)
        self._skies.put(key, sky, self._weather_ttl, self._clock())
        return sky
