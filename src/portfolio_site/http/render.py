from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from portfolio_site.http.view import Page


def template_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "templates"


@lru_cache(maxsize=1)
def _environment() -> Environment:
    return Environment(
        loader=FileSystemLoader(template_dir()),
        autoescape=select_autoescape(["html"]),
        auto_reload=True,
    )


def render_page(page: Page) -> str:
    return _environment().get_template("index.html").render(page=page)
