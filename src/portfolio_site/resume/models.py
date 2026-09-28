from dataclasses import dataclass


@dataclass(frozen=True)
class Role:
    title: str
    company: str
    location: str
    dates: str
    bullets: tuple[str, ...]


@dataclass(frozen=True)
class Education:
    school: str
    credential: str
    location: str
    dates: str


@dataclass(frozen=True)
class ResumeProfile:
    name: str
    email: str | None
    languages: tuple[str, ...]
    roles: tuple[Role, ...]
    education: tuple[Education, ...]
