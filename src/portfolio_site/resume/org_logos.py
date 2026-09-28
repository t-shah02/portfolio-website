from __future__ import annotations

import json
from pathlib import Path


def org_logos_path(site_root: Path) -> Path:
    return site_root / "assets" / "org-logos.json"


def load_org_logos(site_root: Path) -> dict[str, str]:
    path = org_logos_path(site_root)
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    base = site_root / "assets" / "images" / "orgs"
    resolved: dict[str, str] = {}
    for name, relative in data.items():
        if not isinstance(name, str) or not isinstance(relative, str):
            continue
        file_path = base / relative
        if file_path.is_file():
            href = "/assets/images/orgs/" + relative.replace("\\", "/")
            resolved[name.strip()] = href
    return resolved


def logo_src(mapping: dict[str, str], organization: str) -> str | None:
    return mapping.get(organization.strip())
