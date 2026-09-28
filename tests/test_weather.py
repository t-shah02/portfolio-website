import threading
import unittest
from urllib.parse import parse_qs, urlparse

from portfolio_site.weather.client_ip import client_ip
from portfolio_site.weather.fetch import FetchError
from portfolio_site.weather.forecast import (
    Conditions,
    ForecastError,
    forecast_url,
    parse_forecast,
)
from portfolio_site.weather.geo import GeoError, geo_url, parse_geo
from portfolio_site.weather.service import WeatherService
from portfolio_site.weather.sky import (
    SkyWeather,
    precipitation_intensity,
    sky_from_conditions,
    wind_drift,
)
from portfolio_site.weather.ttl import TtlCache

GEO_CALGARY = {
    "city": "Calgary",
    "latitude": "51.0447",
    "longitude": "-114.0719",
    "timezone": "America/Edmonton",
}


def forecast_payload(**current: object) -> dict:
    base = {
        "time": "2026-09-27T22:30",
        "interval": 900,
        "temperature_2m": 6.4,
        "rain": 0.0,
        "showers": 0.0,
        "snowfall": 0.0,
        "cloud_cover": 0,
        "weather_code": 0,
        "wind_speed_10m": 0.0,
        "wind_direction_10m": 0,
    }
    base.update(current)
    return {"latitude": 51.05, "longitude": -114.07, "current": base}


def conditions(**overrides: object) -> Conditions:
    values: dict = {
        "weather_code": 0,
        "cloud_cover": 0.0,
        "rain_mm_h": 0.0,
        "snow_cm_h": 0.0,
        "wind_kmh": 0.0,
        "wind_from_deg": 0.0,
    }
    values.update(overrides)
    return Conditions(**values)


class ClientIpTest(unittest.TestCase):
    def test_uses_first_public_forwarded_address(self) -> None:
        headers = {"X-Forwarded-For": "10.0.0.4, 203.0.113.9, 9.9.9.9, 8.8.8.8"}
        self.assertEqual(client_ip(headers, "127.0.0.1"), "9.9.9.9", "documentation ranges are skipped")

    def test_leftmost_public_forwarded_address_wins(self) -> None:
        headers = {"X-Forwarded-For": "8.8.8.8, 1.1.1.1"}
        self.assertEqual(client_ip(headers, "127.0.0.1"), "8.8.8.8")

    def test_cloudflare_header_beats_forwarded_for(self) -> None:
        headers = {"CF-Connecting-IP": "9.9.9.9", "X-Forwarded-For": "8.8.8.8"}
        self.assertEqual(client_ip(headers, "127.0.0.1"), "9.9.9.9")

    def test_falls_back_to_real_ip_then_peer(self) -> None:
        self.assertEqual(client_ip({"X-Real-IP": "8.8.4.4"}, "127.0.0.1"), "8.8.4.4")
        self.assertEqual(client_ip({}, "8.8.4.4"), "8.8.4.4")

    def test_private_loopback_and_cgnat_are_not_visitors(self) -> None:
        headers = {"X-Forwarded-For": "192.168.1.2, 100.64.0.1, fe80::1, ::1"}
        self.assertIsNone(client_ip(headers, "127.0.0.1"))

    def test_garbage_is_skipped(self) -> None:
        headers = {"X-Forwarded-For": "unknown, <script>, 8.8.8.8:443, 1.1.1.1"}
        self.assertEqual(client_ip(headers, None), "1.1.1.1")

    def test_ipv4_mapped_ipv6_is_unwrapped(self) -> None:
        self.assertEqual(client_ip({}, "::ffff:8.8.8.8"), "8.8.8.8")

    def test_public_ipv6(self) -> None:
        self.assertEqual(client_ip({}, "2001:4860:4860::8888"), "2001:4860:4860::8888")


class GeoTest(unittest.TestCase):
    def test_url_for_ip_and_for_self(self) -> None:
        self.assertEqual(geo_url("8.8.8.8"), "https://get.geojs.io/v1/ip/geo/8.8.8.8.json")
        self.assertEqual(geo_url("2001:db8::1"), "https://get.geojs.io/v1/ip/geo/2001:db8::1.json")
        self.assertEqual(geo_url(None), "https://get.geojs.io/v1/ip/geo.json")

    def test_url_cannot_escape_the_path(self) -> None:
        self.assertNotIn("/../", geo_url("../../admin"))
        self.assertNotIn("?", geo_url("1.1.1.1?x=1"))

    def test_parses_string_coordinates(self) -> None:
        location = parse_geo(GEO_CALGARY)
        self.assertAlmostEqual(location.latitude, 51.0447)
        self.assertAlmostEqual(location.longitude, -114.0719)
        self.assertEqual(location.city, "Calgary")
        self.assertEqual(location.timezone, "America/Edmonton")

    def test_missing_city_is_fine(self) -> None:
        location = parse_geo({"latitude": "37.751", "longitude": "-97.822"})
        self.assertEqual(location.city, "")

    def test_rejects_bad_payloads(self) -> None:
        for payload in (
            None,
            [],
            {},
            {"latitude": "nil", "longitude": "1"},
            {"latitude": "91", "longitude": "0"},
            {"latitude": "0", "longitude": "-181"},
        ):
            with self.subTest(payload=payload), self.assertRaises(GeoError):
                parse_geo(payload)


class ForecastTest(unittest.TestCase):
    def test_url_requests_current_fields_rounded(self) -> None:
        query = parse_qs(urlparse(forecast_url(51.04472, -114.07191)).query)
        self.assertEqual(query["latitude"], ["51.04"])
        self.assertEqual(query["longitude"], ["-114.07"])
        fields = query["current"][0].split(",")
        for field in ("weather_code", "cloud_cover", "rain", "snowfall", "wind_speed_10m"):
            self.assertIn(field, fields)

    def test_scales_interval_sums_to_hourly_rates(self) -> None:
        parsed = parse_forecast(
            forecast_payload(rain=0.5, showers=0.25, snowfall=0.1, cloud_cover=80, weather_code=63)
        )
        self.assertEqual(parsed.weather_code, 63)
        self.assertAlmostEqual(parsed.rain_mm_h, 3.0)
        self.assertAlmostEqual(parsed.snow_cm_h, 0.4)
        self.assertEqual(parsed.cloud_cover, 80)
        self.assertEqual(parsed.temperature_c, 6.4)

    def test_hourly_interval(self) -> None:
        parsed = parse_forecast(forecast_payload(interval=3600, rain=2.0))
        self.assertAlmostEqual(parsed.rain_mm_h, 2.0)

    def test_nulls_and_negatives_become_zero(self) -> None:
        parsed = parse_forecast(
            forecast_payload(rain=None, showers=-1, snowfall="x", cloud_cover=None, temperature_2m=None)
        )
        self.assertEqual((parsed.rain_mm_h, parsed.snow_cm_h, parsed.cloud_cover), (0, 0, 0))
        self.assertIsNone(parsed.temperature_c)

    def test_negative_temperature_is_kept(self) -> None:
        self.assertEqual(parse_forecast(forecast_payload(temperature_2m=-12.5)).temperature_c, -12.5)

    def test_rejects_missing_current_or_code(self) -> None:
        for payload in (None, {}, {"current": []}, forecast_payload(weather_code=None), forecast_payload(weather_code=True)):
            with self.subTest(payload=payload), self.assertRaises(ForecastError):
                parse_forecast(payload)


class SkyFormulaTest(unittest.TestCase):
    def test_clear_sky_is_all_zero(self) -> None:
        sky = sky_from_conditions(conditions())
        self.assertEqual((sky.cloud, sky.rain, sky.snow, sky.fog, sky.thunder, sky.wind), (0, 0, 0, 0, 0, 0))

    def test_precipitation_curve_is_monotonic_and_saturates(self) -> None:
        rates = [0, 0.1, 0.5, 1, 2.5, 5, 10, 25, 100]
        values = [precipitation_intensity(rate, 10) for rate in rates]
        self.assertEqual(values, sorted(values))
        self.assertEqual(values[0], 0)
        self.assertEqual(values[-3:], [1, 1, 1])
        self.assertGreater(precipitation_intensity(0.1, 10), 0.03, "drizzle should still be visible")

    def test_cloud_cover_maps_linearly(self) -> None:
        self.assertEqual(sky_from_conditions(conditions(cloud_cover=37)).cloud, 0.37)

    def test_weather_code_sets_minimum_look(self) -> None:
        sky = sky_from_conditions(conditions(weather_code=65))
        self.assertEqual(sky.rain, 0.9)
        self.assertEqual(sky.cloud, 0.95)

    def test_measured_rate_can_exceed_code_floor(self) -> None:
        sky = sky_from_conditions(conditions(weather_code=61, rain_mm_h=20))
        self.assertEqual(sky.rain, 1.0)

    def test_snow_codes(self) -> None:
        sky = sky_from_conditions(conditions(weather_code=75, snow_cm_h=0.5))
        self.assertEqual(sky.snow, 0.9)
        self.assertEqual(sky.rain, 0)

    def test_heavy_snow_rate_saturates(self) -> None:
        self.assertEqual(sky_from_conditions(conditions(weather_code=71, snow_cm_h=5)).snow, 1.0)

    def test_fog_and_thunder(self) -> None:
        self.assertEqual(sky_from_conditions(conditions(weather_code=48)).fog, 0.8)
        storm = sky_from_conditions(conditions(weather_code=99))
        self.assertEqual((storm.thunder, storm.rain, storm.cloud), (1.0, 1.0, 1.0))

    def test_precipitation_implies_clouds(self) -> None:
        sky = sky_from_conditions(conditions(weather_code=0, cloud_cover=5, rain_mm_h=1))
        self.assertGreaterEqual(sky.cloud, 0.6)
        self.assertGreater(sky.rain, 0)

    def test_unknown_code_falls_back_to_measurements(self) -> None:
        sky = sky_from_conditions(conditions(weather_code=42, cloud_cover=50))
        self.assertEqual(sky.cloud, 0.5)
        self.assertEqual(sky.code, 42)

    def test_all_outputs_stay_in_range(self) -> None:
        for code in (0, 1, 2, 3, 45, 48, 51, 55, 57, 61, 65, 67, 71, 75, 77, 80, 82, 85, 86, 95, 96, 99, 1234):
            sky = sky_from_conditions(
                conditions(weather_code=code, cloud_cover=250, rain_mm_h=999, snow_cm_h=999, wind_kmh=500, wind_from_deg=270)
            )
            for name in ("cloud", "rain", "snow", "fog", "thunder"):
                self.assertTrue(0 <= getattr(sky, name) <= 1, (code, name))
            self.assertTrue(-1 <= sky.wind <= 1)

    def test_wind_direction(self) -> None:
        self.assertAlmostEqual(wind_drift(50, 270), 1.0)
        self.assertAlmostEqual(wind_drift(50, 90), -1.0)
        self.assertAlmostEqual(wind_drift(25, 270), 0.5)
        self.assertAlmostEqual(wind_drift(100, 0), 0.0)
        self.assertAlmostEqual(wind_drift(0, 270), 0.0)

    def test_no_negative_zero_in_json(self) -> None:
        sky = sky_from_conditions(conditions(wind_kmh=0.001, wind_from_deg=90))
        self.assertEqual(str(sky.wind), "0.0")

    def test_latitude_is_coarsened(self) -> None:
        self.assertEqual(sky_from_conditions(conditions(), 51.0447).lat, 51)
        self.assertIsNone(sky_from_conditions(conditions()).lat)

    def test_json_shape(self) -> None:
        self.assertEqual(
            set(SkyWeather().as_json()),
            {"cloud", "rain", "snow", "fog", "thunder", "wind", "code", "lat"},
        )


class TtlCacheTest(unittest.TestCase):
    def test_expiry(self) -> None:
        cache: TtlCache[str] = TtlCache()
        cache.put("a", "x", ttl=10, now=0)
        self.assertEqual(cache.get("a", now=9.9), (True, "x"))
        self.assertEqual(cache.get("a", now=10), (False, None))
        self.assertEqual(len(cache), 0)

    def test_caches_none_values(self) -> None:
        cache: TtlCache[None] = TtlCache()
        cache.put("a", None, ttl=5, now=0)
        self.assertEqual(cache.get("a", now=1), (True, None))

    def test_evicts_oldest_when_full(self) -> None:
        cache: TtlCache[int] = TtlCache(max_entries=2)
        cache.put("a", 1, 100, 0)
        cache.put("b", 2, 100, 0)
        cache.put("c", 3, 100, 0)
        self.assertEqual(cache.get("a", 1), (False, None))
        self.assertEqual(cache.get("c", 1), (True, 3))
        self.assertEqual(len(cache), 2)

    def test_concurrent_writers(self) -> None:
        cache: TtlCache[int] = TtlCache(max_entries=50)

        def write(offset: int) -> None:
            for i in range(500):
                cache.put((offset, i), i, 100, 0)

        threads = [threading.Thread(target=write, args=(n,)) for n in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(len(cache), 50)


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class FakeUpstream:
    """Routes GeoJS and Open-Meteo URLs to canned responses and records calls."""

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.geo: object = GEO_CALGARY
        self.forecast: object = forecast_payload(weather_code=61, cloud_cover=90)
        self.fail_geo = False
        self.fail_forecast = False

    def __call__(self, url: str, timeout: float) -> object:
        self.calls.append(url)
        if "geojs" in url:
            if self.fail_geo:
                raise FetchError("geo down")
            return self.geo
        if self.fail_forecast:
            raise FetchError("forecast down")
        return self.forecast

    def count(self, host: str) -> int:
        return sum(host in url for url in self.calls)


class WeatherServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.upstream = FakeUpstream()
        self.clock = FakeClock()
        self.service = WeatherService(
            self.upstream, clock=self.clock, weather_ttl=600, geo_ttl=3600, failure_ttl=120, cooldown=60
        )

    def test_happy_path(self) -> None:
        sky = self.service.for_ip("8.8.8.8")
        assert sky is not None
        self.assertEqual(sky.rain, 0.35)
        self.assertEqual(sky.cloud, 0.9)
        self.assertEqual(sky.lat, 51)
        self.assertIn("geo/8.8.8.8.json", self.upstream.calls[0])
        self.assertIn("latitude=51.0", self.upstream.calls[1])

    def test_repeat_visits_hit_the_cache(self) -> None:
        for _ in range(5):
            self.service.for_ip("8.8.8.8")
        self.assertEqual(len(self.upstream.calls), 2)

    def test_neighbours_share_weather(self) -> None:
        self.service.for_ip("8.8.8.8")
        self.upstream.geo = {**GEO_CALGARY, "latitude": "51.0301", "longitude": "-114.0888"}
        self.service.for_ip("8.8.4.4")
        self.assertEqual(self.upstream.count("geojs"), 2)
        self.assertEqual(self.upstream.count("open-meteo"), 1)

    def test_weather_refreshes_after_ttl(self) -> None:
        self.service.for_ip("8.8.8.8")
        self.clock.now += 601
        self.upstream.forecast = forecast_payload(weather_code=75)
        sky = self.service.for_ip("8.8.8.8")
        assert sky is not None
        self.assertEqual(sky.snow, 0.9)
        self.assertEqual(self.upstream.count("geojs"), 1, "location outlives weather")
        self.assertEqual(self.upstream.count("open-meteo"), 2)

    def test_private_visitor_uses_server_location(self) -> None:
        self.assertIsNotNone(self.service.for_ip(None))
        self.assertEqual(self.upstream.calls[0], "https://get.geojs.io/v1/ip/geo.json")

    def test_geo_outage_trips_breaker(self) -> None:
        self.upstream.fail_geo = True
        self.assertIsNone(self.service.for_ip("8.8.8.8"))
        self.assertIsNone(self.service.for_ip("1.1.1.1"))
        self.assertEqual(self.upstream.count("geojs"), 1, "second visitor skipped the dead upstream")
        self.upstream.fail_geo = False
        self.clock.now += 61
        self.assertIsNotNone(self.service.for_ip("1.1.1.1"))

    def test_failed_lookup_is_negatively_cached(self) -> None:
        self.upstream.fail_geo = True
        self.service.for_ip("8.8.8.8")
        self.upstream.fail_geo = False
        self.clock.now += 61
        self.assertIsNone(self.service.for_ip("8.8.8.8"), "still inside failure TTL")
        self.clock.now += 60
        self.assertIsNotNone(self.service.for_ip("8.8.8.8"))

    def test_bad_geo_payload_does_not_trip_breaker(self) -> None:
        self.upstream.geo = {"latitude": "nil"}
        self.assertIsNone(self.service.for_ip("8.8.8.8"))
        self.upstream.geo = GEO_CALGARY
        self.assertIsNotNone(self.service.for_ip("1.1.1.1"))

    def test_forecast_outage_trips_breaker(self) -> None:
        self.upstream.fail_forecast = True
        self.assertIsNone(self.service.for_ip("8.8.8.8"))
        self.upstream.geo = {**GEO_CALGARY, "latitude": "40.0"}
        self.assertIsNone(self.service.for_ip("1.1.1.1"))
        self.assertEqual(self.upstream.count("open-meteo"), 1)

    def test_bad_forecast_payload_returns_none(self) -> None:
        self.upstream.forecast = {"error": True, "reason": "nope"}
        self.assertIsNone(self.service.for_ip("8.8.8.8"))

    def test_unexpected_fetch_exceptions_are_not_swallowed_silently(self) -> None:
        def boom(url: str, timeout: float) -> object:
            raise RuntimeError("bug")

        with self.assertRaises(RuntimeError):
            WeatherService(boom).for_ip("8.8.8.8")

    def test_passes_timeout(self) -> None:
        seen: list[float] = []

        def fetch(url: str, timeout: float) -> object:
            seen.append(timeout)
            return GEO_CALGARY if "geojs" in url else forecast_payload()

        WeatherService(fetch, timeout=0.75).for_ip("8.8.8.8")
        self.assertEqual(seen, [0.75, 0.75])


if __name__ == "__main__":
    unittest.main()
