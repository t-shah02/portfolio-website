from dataclasses import dataclass

from portfolio_site.projects.cache import ProjectsProblem
from portfolio_site.projects.models import Feature, ProjectLink, ProjectsBundle
from portfolio_site.content.about import AboutContent, AboutProblem
from portfolio_site.http.cache import ResumeProblem
from portfolio_site.http.paths import site_root
from portfolio_site.resume.models import Education, ResumeProfile, Role
from portfolio_site.resume.org_logos import load_org_logos, logo_src


@dataclass(frozen=True)
class RoleRow:
    title: str
    company: str
    location: str
    dates: str
    bullets: tuple[str, ...]
    logo_src: str | None


@dataclass(frozen=True)
class EducationRow:
    school: str
    credential: str
    location: str
    dates: str
    logo_src: str | None


@dataclass(frozen=True)
class Page:
    name: str
    email: str
    github_url: str
    linkedin_url: str
    myanimelist_url: str
    steam_url: str
    resume_href: str
    intro_plain: str
    intro_html: str
    features: tuple[Feature, ...]
    other_projects: tuple[ProjectLink, ...]
    languages: tuple[str, ...]
    roles: tuple[RoleRow, ...]
    education: tuple[EducationRow, ...]
    resume_error: str | None
    projects_error: str | None
    about_error: str | None


def _projects(projects: ProjectsBundle | ProjectsProblem) -> tuple[tuple[Feature, ...], tuple[ProjectLink, ...], str | None]:
    if isinstance(projects, ProjectsProblem):
        return (), (), projects.message
    return projects.features, projects.other_projects, None


def _about_fields(about: AboutContent | AboutProblem) -> tuple[str, str, str, str, str, str, str, str, str, str | None]:
    if isinstance(about, AboutProblem):
        return "", "", "", "", "", "", "", "", "", about.message
    return (
        about.name,
        about.email,
        about.github_url,
        about.linkedin_url,
        about.myanimelist_url,
        about.steam_url,
        about.resume_href,
        about.plain,
        about.html,
        None,
    )


def _resume_fields(
    profile: ResumeProfile | ResumeProblem,
) -> tuple[tuple[str, ...], tuple[Role, ...], tuple[Education, ...], str | None]:
    if isinstance(profile, ResumeProblem):
        return (), (), (), profile.message
    return profile.languages, profile.roles, profile.education, None


def _role_rows(roles: tuple[Role, ...], logos: dict[str, str]) -> tuple[RoleRow, ...]:
    return tuple(
        RoleRow(
            title=role.title,
            company=role.company,
            location=role.location,
            dates=role.dates,
            bullets=role.bullets,
            logo_src=logo_src(logos, role.company),
        )
        for role in roles
    )


def _education_rows(education: tuple[Education, ...], logos: dict[str, str]) -> tuple[EducationRow, ...]:
    return tuple(
        EducationRow(
            school=item.school,
            credential=item.credential,
            location=item.location,
            dates=item.dates,
            logo_src=logo_src(logos, item.school),
        )
        for item in education
    )


def build_page(
    profile: ResumeProfile | ResumeProblem,
    projects: ProjectsBundle | ProjectsProblem,
    about: AboutContent | AboutProblem,
) -> Page:
    feature_rows, other_rows, projects_error = _projects(projects)
    (
        name,
        email,
        github_url,
        linkedin_url,
        myanimelist_url,
        steam_url,
        resume_href,
        intro_plain,
        intro_html,
        about_error,
    ) = _about_fields(about)
    languages, roles, education, resume_error = _resume_fields(profile)
    logos = load_org_logos(site_root())
    return Page(
        name=name,
        email=email,
        github_url=github_url,
        linkedin_url=linkedin_url,
        myanimelist_url=myanimelist_url,
        steam_url=steam_url,
        resume_href=resume_href,
        intro_plain=intro_plain,
        intro_html=intro_html,
        features=feature_rows,
        other_projects=other_rows,
        languages=languages,
        roles=_role_rows(roles, logos),
        education=_education_rows(education, logos),
        resume_error=resume_error,
        projects_error=projects_error,
        about_error=about_error,
    )
