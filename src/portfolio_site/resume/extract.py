import subprocess
from pathlib import Path


class ResumeReadError(Exception):
    """The PDF could not be turned into text."""


def extract_text(path: Path) -> str:
    try:
        completed = subprocess.run(
            ["pdftotext", "-layout", str(path), "-"],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise ResumeReadError("pdftotext is not installed (poppler-utils).") from exc
    if completed.returncode != 0:
        detail = completed.stderr.strip() or f"exit {completed.returncode}"
        raise ResumeReadError(f"Could not read the resume PDF: {detail}")
    return completed.stdout
