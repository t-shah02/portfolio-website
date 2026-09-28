from __future__ import annotations

import re
from typing import Any


def split_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    block = text[3:end]
    body = text[end + 4 :].lstrip("\n")
    return _parse_block(block), body


def _parse_block(block: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    key: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        nonlocal key, buffer
        if key is None:
            return
        fields[key] = "\n".join(buffer).strip()
        key = None
        buffer = []

    for line in block.splitlines():
        if not line.strip():
            if key is not None:
                buffer.append("")
            continue
        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if match:
            flush()
            key = match.group(1)
            rest = match.group(2)
            if rest == "|":
                buffer = []
            elif rest:
                buffer = [rest]
            else:
                buffer = []
            continue
        if key is not None and (line.startswith("  ") or line.startswith("\t")):
            buffer.append(line.strip())
            continue
        if key is not None:
            buffer.append(line.strip())

    flush()
    return fields


def comma_list(raw: str) -> tuple[str, ...]:
    if not raw.strip():
        return ()
    return tuple(part.strip() for part in raw.split(",") if part.strip())
