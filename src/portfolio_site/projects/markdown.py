from __future__ import annotations

import html
import re

_IMAGE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_BOLD = re.compile(r"\*\*([^*]+)\*\*")


def extract_images(text: str) -> tuple[str, list[tuple[str, str]]]:
    images: list[tuple[str, str]] = []

    def keep(match: re.Match[str]) -> str:
        images.append((match.group(2).strip(), match.group(1).strip()))
        return ""

    stripped = _IMAGE.sub(keep, text).strip()
    return stripped, images


def render_markdown(text: str) -> str:
    if not text.strip():
        return ""
    chunks = re.split(r"\n\s*\n", text.strip())
    parts: list[str] = []
    for chunk in chunks:
        lines = chunk.splitlines()
        if all(line.lstrip().startswith("- ") for line in lines if line.strip()):
            items = []
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    continue
                item = stripped[2:].strip()
                items.append(f"<li>{_inline(item)}</li>")
            parts.append("<ul>" + "".join(items) + "</ul>")
            continue
        if len(lines) == 1 and lines[0].startswith("## "):
            parts.append(f"<h4>{_inline(lines[0][3:].strip())}</h4>")
            continue
        paragraph = "<br>".join(_inline(line) for line in lines if line.strip())
        if paragraph:
            parts.append(f"<p>{paragraph}</p>")
    return "".join(parts)


def _inline(text: str) -> str:
    text = _LINK.sub(lambda match: f"@@LINK|{match.group(1)}|{match.group(2)}@@", text)
    text = _BOLD.sub(lambda match: f"@@B|{match.group(1)}@@", text)
    text = html.escape(text, quote=True)
    text = re.sub(r"@@LINK\|([^|]+)\|([^@]+)@@", r'<a href="\2">\1</a>', text)
    text = re.sub(r"@@B\|([^@]+)@@", r"<strong>\1</strong>", text)
    return text
