from dataclasses import dataclass

from portfolio_site.content.projects import Feature, ProjectLink, features, other_projects
from portfolio_site.content.site import (
    FALLBACK_EMAIL,
    FALLBACK_NAME,
    GITHUB_URL,
    INTRO,
    LINKEDIN_URL,
    RESUME_HREF,
)
from portfolio_site.http.cache import ResumeProblem
from portfolio_site.resume.models import Education, ResumeProfile, Role


@dataclass(frozen=True)
class Page:
    name: str
    email: str
    github_url: str
    linkedin_url: str
    resume_href: str
    intro: str
    role_line: str
    place_line: str
    dates_line: str
    features: tuple[Feature, ...]
    other_projects: tuple[ProjectLink, ...]
    languages: tuple[str, ...]
    roles: tuple[Role, ...]
    education: tuple[Education, ...]
    resume_error: str | None


def build_page(profile: ResumeProfile | ResumeProblem) -> Page:
    if isinstance(profile, ResumeProblem):
        return Page(
            name=FALLBACK_NAME,
            email=FALLBACK_EMAIL,
            github_url=GITHUB_URL,
            linkedin_url=LINKEDIN_URL,
            resume_href=RESUME_HREF,
            intro=INTRO,
            role_line="",
            place_line="",
            dates_line="",
            features=features(),
            other_projects=other_projects(),
            languages=(),
            roles=(),
            education=(),
            resume_error=profile.message,
        )

    latest = profile.roles[0] if profile.roles else None
    role_line = ""
    place_line = ""
    dates_line = ""
    if latest is not None:
        role_line = latest.title
        place_line = " · ".join(bit for bit in (latest.company, latest.location) if bit)
        dates_line = latest.dates

    return Page(
        name=profile.name or FALLBACK_NAME,
        email=profile.email or FALLBACK_EMAIL,
        github_url=GITHUB_URL,
        linkedin_url=LINKEDIN_URL,
        resume_href=RESUME_HREF,
        intro=INTRO,
        role_line=role_line,
        place_line=place_line,
        dates_line=dates_line,
        features=features(),
        other_projects=other_projects(),
        languages=profile.languages,
        roles=profile.roles,
        education=profile.education,
        resume_error=None,
    )
