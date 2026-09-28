import threading
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from portfolio_site.resume.extract import ResumeReadError
from portfolio_site.resume.models import ResumeProfile
from portfolio_site.resume.parse import ResumeFormatError, parse_resume_file

Loader = Callable[[Path], ResumeProfile]


@dataclass(frozen=True)
class ResumeProblem:
    message: str


class ResumeCache:
    """Re-reads the PDF only when its mtime or size changes."""

    def __init__(self, path: Path, loader: Loader = parse_resume_file) -> None:
        self.path = path
        self._loader = loader
        self._lock = threading.Lock()
        self._mtime_ns: int | None = None
        self._size: int | None = None
        self._value: ResumeProfile | ResumeProblem | None = None

    def load(self) -> ResumeProfile | ResumeProblem:
        if not self.path.is_file():
            return ResumeProblem(f"No resume file at {self.path}")
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

    def _read(self) -> ResumeProfile | ResumeProblem:
        try:
            return self._loader(self.path)
        except (ResumeReadError, ResumeFormatError) as exc:
            return ResumeProblem(str(exc))
