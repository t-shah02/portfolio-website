from __future__ import annotations

import re
import threading
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from portfolio_site.projects.frontmatter import split_front_matter
from portfolio_site.projects.markdown import render_markdown


class AboutFormatError(ValueError):
    pass


@dataclass(frozen=True)
class AboutContent:
    name: str
    email: str
    github_url: str
    linkedin_url: str
    myanimelist_url: str
    steam_url: str
    resume_href: str
    plain: str
    html: str


@dataclass(frozen=True)
class AboutProblem:
    message: str


Loader = Callable[[Path], AboutContent]


def load_about_file(path: Path) -> AboutContent:
    text = path.read_text(encoding="utf-8")
    fields, body = split_front_matter(text)
    name = _require(fields, "name", path)
    email = _require(fields, "email", path)
    github_url = _require(fields, "github", path)
    linkedin_url = _require(fields, "linkedin", path)
    resume_href = _require(fields, "resume", path)
    myanimelist_url = fields.get("myanimelist", "").strip()
    steam_url = fields.get("steam", "").strip()
    body = body.strip()
    if not body:
        raise AboutFormatError(f"About body is empty in {path}")
    return AboutContent(
        name=name,
        email=email,
        github_url=github_url,
        linkedin_url=linkedin_url,
        myanimelist_url=myanimelist_url,
        steam_url=steam_url,
        resume_href=resume_href,
        plain=_plain_for_meta(body),
        html=render_markdown(body),
    )


def _require(fields: dict[str, str], key: str, path: Path) -> str:
    value = fields.get(key, "").strip()
    if not value:
        raise AboutFormatError(f"Missing {key} in {path}")
    return value


def _plain_for_meta(text: str) -> str:
    without_bold = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    parts = [part.strip() for part in re.split(r"\n\s*\n", without_bold) if part.strip()]
    return " ".join(re.sub(r"\s+", " ", part) for part in parts)


class AboutCache:
    """Re-reads about markdown when its mtime or size changes."""

    def __init__(self, path: Path, loader: Loader = load_about_file) -> None:
        self.path = path
        self._loader = loader
        self._lock = threading.Lock()
        self._mtime_ns: int | None = None
        self._size: int | None = None
        self._value: AboutContent | AboutProblem | None = None

    def load(self) -> AboutContent | AboutProblem:
        if not self.path.is_file():
            return AboutProblem(f"No about file at {self.path}")
        stat = self.path.stat()
        with self._lock:
            if (
                self._value is not None
                and self._mtime_ns == stat.st_mtime_ns
                and self._size == stat.st_size
            ):
                return self._value
            value = self._read()
            self._mtime_ns = stat.st_mtime_ns
            self._size = stat.st_size
            self._value = value
            return value

    def _read(self) -> AboutContent | AboutProblem:
        try:
            return self._loader(self.path)
        except (OSError, AboutFormatError) as exc:
            return AboutProblem(str(exc))
