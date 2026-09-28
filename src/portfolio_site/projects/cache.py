import threading
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from portfolio_site.projects.models import ProjectsBundle
from portfolio_site.projects.parse import ProjectsFormatError, load_projects_dir

Loader = Callable[[Path], ProjectsBundle]


@dataclass(frozen=True)
class ProjectsProblem:
    message: str


def _fingerprint(root: Path) -> tuple[tuple[str, int, int], ...]:
    if not root.is_dir():
        return ()
    parts: list[tuple[str, int, int]] = []
    for path in sorted(root.rglob("*.md")):
        stat = path.stat()
        parts.append((str(path.relative_to(root)), stat.st_mtime_ns, stat.st_size))
    return tuple(parts)


class ProjectsCache:
    """Reloads markdown when any file under the projects directory changes."""

    def __init__(self, path: Path, loader: Loader = load_projects_dir) -> None:
        self.path = path
        self._loader = loader
        self._lock = threading.Lock()
        self._fingerprint: tuple[tuple[str, int, int], ...] | None = None
        self._value: ProjectsBundle | ProjectsProblem | None = None

    def load(self) -> ProjectsBundle | ProjectsProblem:
        stamp = _fingerprint(self.path)
        with self._lock:
            if self._value is not None and self._fingerprint == stamp:
                return self._value
            value = self._read()
            self._fingerprint = stamp
            self._value = value
            return value

    def _read(self) -> ProjectsBundle | ProjectsProblem:
        try:
            return self._loader(self.path)
        except ProjectsFormatError as exc:
            return ProjectsProblem(str(exc))
