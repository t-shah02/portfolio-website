import re
from pathlib import Path

from portfolio_site.resume.dates import is_date_range, span
from portfolio_site.resume.extract import ResumeReadError, extract_text
from portfolio_site.resume.models import Education, ResumeProfile, Role

_SECTIONS = {
    "technical skills": "skills",
    "work experience": "work",
    "education": "education",
}
_BULLET = re.compile(r"^(?:[•●▪]|\-|\*)\s+")
_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")
_COLUMNS = re.compile(r"\s{2,}")


class ResumeFormatError(Exception):
    """The PDF text does not match the expected section headings."""


def parse_resume_file(path: Path) -> ResumeProfile:
    if not path.is_file():
        raise ResumeReadError(f"No resume file at {path}")
    return parse_resume_text(extract_text(path))


def parse_resume_text(text: str) -> ResumeProfile:
    name: str | None = None
    email: str | None = None
    languages: list[str] = []
    role_rows: list[dict] = []
    education_lines: list[str] = []
    section = "header"
    expect_company = False

    for raw in text.replace("\f", "\n").splitlines():
        line = raw.strip()
        if not line:
            continue
        heading = _SECTIONS.get(line.lower())
        if heading is not None:
            section = heading
            expect_company = False
            continue

        if section == "header":
            if name is None:
                name = line
            elif email is None:
                found = _EMAIL.search(line)
                if found:
                    email = found.group(0)
            continue

        if section == "skills":
            if line.lower().startswith("languages:"):
                languages = _split_languages(line)
            continue

        if section == "work":
            expect_company = _read_work_line(line, role_rows, expect_company)
            continue

        if section == "education":
            education_lines.append(line)

    if not role_rows:
        raise ResumeFormatError(
            "The parser found no Work Experience section. Keep the headings "
            "Technical Skills, Work Experience, and Education in the resume."
        )

    roles = tuple(_finish_role(row) for row in _sorted_roles(role_rows))
    return ResumeProfile(
        name=name or "Tanish Shah",
        email=email,
        languages=tuple(languages),
        roles=roles,
        education=tuple(_pair_education(education_lines)),
    )


def _split_languages(line: str) -> list[str]:
    raw = line.split(":", 1)[1]
    return [part.strip() for part in raw.split(",") if part.strip()]


def _read_work_line(line: str, role_rows: list[dict], expect_company: bool) -> bool:
    if _BULLET.match(line):
        text = _BULLET.sub("", line).strip()
        if role_rows:
            role_rows[-1]["bullets"].append(text)
        return False

    left, right = _split_columns(line)
    if is_date_range(right):
        role_rows.append(
            {
                "title": left,
                "dates": right,
                "company": "",
                "location": "",
                "bullets": [],
            }
        )
        return True

    if expect_company and role_rows:
        role_rows[-1]["company"] = left
        role_rows[-1]["location"] = right
        return False

    if role_rows and role_rows[-1]["bullets"]:
        previous = role_rows[-1]["bullets"][-1]
        role_rows[-1]["bullets"][-1] = f"{previous} {line}"
    return expect_company


def _split_columns(line: str) -> tuple[str, str]:
    parts = [part.strip() for part in _COLUMNS.split(line.strip()) if part.strip()]
    if len(parts) < 2:
        return (parts[0] if parts else ""), ""
    return " ".join(parts[:-1]), parts[-1]


def _sorted_roles(role_rows: list[dict]) -> list[dict]:
    def sort_key(row: dict) -> tuple:
        start, end = span(row["dates"])
        return (end, start)

    return sorted(role_rows, key=sort_key, reverse=True)


def _finish_role(row: dict) -> Role:
    bullets = tuple(_collapse(bullet) for bullet in row["bullets"] if bullet.strip())
    return Role(
        title=_collapse(row["title"]),
        company=_collapse(row["company"]),
        location=_collapse(row["location"]),
        dates=_collapse(row["dates"]),
        bullets=bullets,
    )


def _pair_education(lines: list[str]) -> list[Education]:
    entries: list[Education] = []
    index = 0
    while index < len(lines):
        school, location = _split_columns(lines[index])
        credential, dates = "", ""
        if index + 1 < len(lines):
            credential, dates = _split_columns(lines[index + 1])
            index += 2
        else:
            index += 1
        entries.append(
            Education(
                school=_collapse(school),
                credential=_collapse(credential),
                location=_collapse(location),
                dates=_collapse(dates),
            )
        )
    return entries


def _collapse(value: str) -> str:
    return " ".join(value.split())
