import json
import re
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

from portfolio_site.content.about import AboutProblem
from portfolio_site.http.cache import ResumeProblem
from portfolio_site.http.paths import site_root
from portfolio_site.http.server import PAGE_CACHE_CONTROL, build_handler
from portfolio_site.projects.cache import ProjectsProblem
from portfolio_site.weather.sky import SkyWeather

_SKY_DATA = re.compile(r'<script type="application/json" id="sky-data">(.*?)</script>', re.S)


class _Fixed:
    def __init__(self, value: object) -> None:
        self.value = value

    def load(self) -> object:
        return self.value


class FakeWeather:
    def __init__(self, sky: SkyWeather | None) -> None:
        self.sky = sky
        self.ips: list[str | None] = []

    def for_ip(self, ip: str | None) -> SkyWeather | None:
        self.ips.append(ip)
        return self.sky


class ServerTest(unittest.TestCase):
    def serve(self, weather: FakeWeather | None, *, dev: bool = False) -> str:
        handler = build_handler(
            site_root(),
            _Fixed(ResumeProblem("no resume")),  # type: ignore[arg-type]
            _Fixed(ProjectsProblem("no projects")),  # type: ignore[arg-type]
            _Fixed(AboutProblem("no about")),  # type: ignore[arg-type]
            weather=weather,  # type: ignore[arg-type]
            dev=dev,
        )
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join)
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_address[1]}"

    def get(self, url: str, headers: dict[str, str] | None = None):
        request = urllib.request.Request(url, headers=headers or {})
        response = urllib.request.urlopen(request, timeout=5)
        self.addCleanup(response.close)
        return response, response.read().decode("utf-8")

    def sky_payload(self, body: str) -> object:
        match = _SKY_DATA.search(body)
        self.assertIsNotNone(match, "page embeds sky data")
        assert match is not None
        return json.loads(match.group(1))

    def test_page_is_privately_cacheable_in_production(self) -> None:
        base = self.serve(FakeWeather(SkyWeather()))
        response, _ = self.get(base + "/")
        self.assertEqual(response.headers["Cache-Control"], PAGE_CACHE_CONTROL)
        self.assertIn("private", PAGE_CACHE_CONTROL)
        self.assertRegex(PAGE_CACHE_CONTROL, r"max-age=[1-9]\d*")

    def test_dev_pages_are_not_cached(self) -> None:
        base = self.serve(FakeWeather(SkyWeather()), dev=True)
        response, _ = self.get(base + "/")
        self.assertEqual(response.headers["Cache-Control"], "no-cache")

    def test_embeds_weather_for_the_forwarded_visitor(self) -> None:
        weather = FakeWeather(SkyWeather(cloud=0.8, rain=0.6, wind=-0.25, code=63, lat=51))
        base = self.serve(weather)
        _, body = self.get(base + "/", {"X-Forwarded-For": "8.8.8.8, 10.0.0.1"})
        self.assertEqual(weather.ips, ["8.8.8.8"])
        payload = self.sky_payload(body)
        self.assertEqual(payload["rain"], 0.6)
        self.assertEqual(payload["wind"], -0.25)
        self.assertEqual(payload["lat"], 51)

    def test_local_visitor_asks_for_server_location(self) -> None:
        weather = FakeWeather(None)
        base = self.serve(weather)
        _, body = self.get(base + "/")
        self.assertEqual(weather.ips, [None])
        self.assertIsNone(self.sky_payload(body))

    def test_page_renders_without_weather_service(self) -> None:
        base = self.serve(None)
        response, body = self.get(base + "/")
        self.assertEqual(response.status, 200)
        self.assertIsNone(self.sky_payload(body))

    def test_static_files_skip_weather(self) -> None:
        weather = FakeWeather(SkyWeather())
        base = self.serve(weather)
        response, _ = self.get(base + "/js/sky/main.js")
        self.assertEqual(response.status, 200)
        self.assertIn("javascript", response.headers["Content-Type"])
        self.assertEqual(weather.ips, [])

    def test_boot_script_loads_sky_module(self) -> None:
        base = self.serve(FakeWeather(None))
        _, body = self.get(base + "/")
        self.assertIn("/js/sky/main.js", body)


if __name__ == "__main__":
    unittest.main()
