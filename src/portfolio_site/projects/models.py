from dataclasses import dataclass


@dataclass(frozen=True)
class ProjectImage:
    src: str
    alt: str


@dataclass(frozen=True)
class ProjectDetails:
    panel_id: str
    title: str
    images: tuple[ProjectImage, ...]
    body_html: str


@dataclass(frozen=True)
class ProjectLink:
    name: str
    href: str
    summary: str
    stack: tuple[str, ...]
    details: ProjectDetails | None = None


@dataclass(frozen=True)
class Feature:
    kicker: str
    title: str
    summary: str
    links: tuple[ProjectLink, ...]
    details: ProjectDetails | None = None


@dataclass(frozen=True)
class ProjectsBundle:
    features: tuple[Feature, ...]
    other_projects: tuple[ProjectLink, ...]
