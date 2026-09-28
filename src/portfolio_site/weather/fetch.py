import http.client
import json
import urllib.error
import urllib.request
from collections.abc import Callable

USER_AGENT = "portfolio-site/0.1 (+https://github.com/t-shah02/portfolio-website)"
MAX_BYTES = 64 * 1024

FetchJson = Callable[[str, float], object]


class FetchError(Exception):
    pass


def fetch_json(url: str, timeout: float) -> object:
    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read(MAX_BYTES))
    except (OSError, http.client.HTTPException, ValueError) as exc:
        raise FetchError(f"{url}: {exc}") from exc
