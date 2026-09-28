import os
from pathlib import Path


def site_root() -> Path:
    configured = os.environ.get("SITE_ROOT")
    if configured:
        return Path(configured)
    candidate = Path(__file__).resolve().parents[3]
    if (candidate / "pyproject.toml").is_file() and (candidate / "site").is_dir():
        return candidate / "site"
    raise RuntimeError("Set SITE_ROOT to the directory that contains css/ and assets/.")


def resume_path(root: Path | None = None) -> Path:
    configured = os.environ.get("RESUME_PATH")
    if configured:
        return Path(configured)
    return (root if root is not None else site_root()) / "assets" / "pdfs" / "Tanish_Shah_Resume.pdf"


def projects_path(root: Path | None = None) -> Path:
    configured = os.environ.get("PROJECTS_DIR")
    if configured:
        return Path(configured)
    return (root if root is not None else site_root()) / "assets" / "projects"


def about_path(root: Path | None = None) -> Path:
    configured = os.environ.get("ABOUT_PATH")
    if configured:
        return Path(configured)
    return (root if root is not None else site_root()) / "assets" / "about.md"
