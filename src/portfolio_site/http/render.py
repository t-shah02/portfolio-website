from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from portfolio_site.http.view import Page


def template_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "templates"


def render_page(page: Page, *, origin: str = "") -> str:
    env = Environment(
        loader=FileSystemLoader(template_dir()),
        autoescape=select_autoescape(["html"]),
        auto_reload=True,
    )
    return env.get_template("index.html").render(page=page, origin=origin.rstrip("/"))
