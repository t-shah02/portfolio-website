from __future__ import annotations

import re
from pathlib import Path

from portfolio_site.projects.frontmatter import comma_list, split_front_matter
from portfolio_site.projects.markdown import extract_images, render_markdown
from portfolio_site.projects.models import (
    Feature,
    ProjectDetails,
    ProjectImage,
    ProjectLink,
    ProjectsBundle,
)


class ProjectsFormatError(ValueError):
    pass


_SECTION = re.compile(r"^###\s+(.+)\s*$", re.MULTILINE)
_META = re.compile(r"^(url|stack):\s*(.+)\s*$", re.MULTILINE)
_FEATURE_SEE_MORE = re.compile(r"^##\s+see more\s*$", re.MULTILINE | re.IGNORECASE)
_LINK_SEE_MORE = re.compile(r"^####\s+see more\s*$", re.MULTILINE | re.IGNORECASE)


def load_projects_dir(root: Path) -> ProjectsBundle:
    if not root.is_dir():
        return ProjectsBundle(features=(), other_projects=())
    features = [
        parse_feature_file(path)
        for path in sorted(_markdown_files(root / "features"), key=_sort_key)
    ]
    other = [
        parse_other_file(path)
        for path in sorted(_markdown_files(root / "other"), key=_sort_key)
    ]
    return ProjectsBundle(features=tuple(features), other_projects=tuple(other))


def parse_feature_file(path: Path) -> Feature:
    text = path.read_text(encoding="utf-8")
    fields, body = split_front_matter(text)
    kicker = _require(fields, "kicker", path)
    title = _require(fields, "title", path)
    body, feature_details = _extract_feature_see_more(body, title, path)
    summary, links = _parse_feature_body(body, path)
    if fields.get("summary"):
        summary = fields["summary"]
    if not summary:
        raise ProjectsFormatError(f"{path}: feature needs a summary in the body or front matter.")
    if not links:
        raise ProjectsFormatError(f"{path}: feature needs at least one ### repo section.")
    return Feature(
        kicker=kicker,
        title=title,
        summary=summary,
        links=tuple(links),
        details=feature_details,
    )


def parse_other_file(path: Path) -> ProjectLink:
    text = path.read_text(encoding="utf-8")
    fields, body = split_front_matter(text)
    name = _require(fields, "name", path)
    href = _require(fields, "href", path)
    stack = comma_list(fields.get("stack", ""))
    body, details = _split_link_see_more(body, name, path)
    summary = body.strip() or fields.get("summary", "").strip()
    if not summary:
        raise ProjectsFormatError(f"{path}: other project needs a summary in the body or front matter.")
    return ProjectLink(name=name, href=href, summary=summary, stack=stack, details=details)


def _markdown_files(directory: Path) -> list[Path]:
    if not directory.is_dir():
        return []
    return list(directory.glob("*.md"))


def _sort_key(path: Path) -> tuple[int, str]:
    return (_filename_order(path), path.name)


def _filename_order(path: Path) -> int:
    match = re.match(r"^(\d+)", path.stem)
    return int(match.group(1)) if match else 999


def _require(fields: dict[str, str], key: str, path: Path) -> str:
    value = fields.get(key, "").strip()
    if not value:
        raise ProjectsFormatError(f"{path}: missing {key} in front matter.")
    return value


def _extract_feature_see_more(
    body: str,
    title: str,
    path: Path,
) -> tuple[str, ProjectDetails | None]:
    match = _FEATURE_SEE_MORE.search(body)
    if not match:
        return body, None
    before = body[: match.start()].strip()
    after = body[match.end() :].lstrip("\n")
    next_heading = _SECTION.search(after)
    if next_heading:
        details_text = after[: next_heading.start()].strip()
        repos = after[next_heading.start() :].strip()
        rest = f"{before}\n\n{repos}".strip() if before else repos
    else:
        details_text = after.strip()
        rest = before
    if not details_text:
        return rest, None
    return rest, _parse_details(details_text, _slug(title), title, path)


def _parse_feature_body(body: str, path: Path) -> tuple[str, list[ProjectLink]]:
    matches = list(_SECTION.finditer(body))
    if not matches:
        return body.strip(), []

    intro = body[: matches[0].start()].strip()
    links: list[ProjectLink] = []
    for index, match in enumerate(matches):
        name = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        section = body[start:end].strip()
        links.append(_parse_link_section(name, section, path))
    return intro, links


def _parse_link_section(name: str, section: str, path: Path) -> ProjectLink:
    section, details = _split_link_see_more(section, name, path)
    href = ""
    stack: tuple[str, ...] = ()
    summary_lines: list[str] = []
    for line in section.splitlines():
        meta = _META.match(line.strip())
        if meta and not summary_lines:
            if meta.group(1) == "url":
                href = meta.group(2).strip()
            else:
                stack = comma_list(meta.group(2))
            continue
        summary_lines.append(line)
    summary = "\n".join(summary_lines).strip()
    if not href:
        raise ProjectsFormatError(f"{path}: section {name!r} needs a url: line.")
    if not summary:
        raise ProjectsFormatError(f"{path}: section {name!r} needs a summary.")
    return ProjectLink(name=name, href=href, summary=summary, stack=stack, details=details)


def _split_link_see_more(section: str, title: str, path: Path) -> tuple[str, ProjectDetails | None]:
    match = _LINK_SEE_MORE.search(section)
    if not match:
        return section, None
    summary_part = section[: match.start()].strip()
    details_text = section[match.end() :].strip()
    if not details_text:
        return summary_part, None
    return summary_part, _parse_details(details_text, _slug(title), title, path)


def _parse_details(text: str, panel_id: str, title: str, path: Path) -> ProjectDetails:
    prose, image_pairs = extract_images(text)
    images = tuple(ProjectImage(src=src, alt=alt or title) for src, alt in image_pairs)
    body_html = render_markdown(prose)
    if not images and not body_html:
        raise ProjectsFormatError(f"{path}: see more section for {title!r} is empty.")
    return ProjectDetails(panel_id=panel_id, title=title, images=images, body_html=body_html)


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "project"
