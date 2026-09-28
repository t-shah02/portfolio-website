from __future__ import annotations

import logging
import os
import subprocess
import sys
from argparse import Namespace
from pathlib import Path

from portfolio_site.http.paths import site_root

logger = logging.getLogger(__name__)

_CHILD = "PORTFOLIO_SITE_CHILD"


def is_reload_child() -> bool:
    return os.environ.get(_CHILD) == "1"


def watch_roots() -> tuple[Path, ...]:
    roots = [site_root().resolve()]
    package = Path(__file__).resolve().parents[1]
    src_root = package.parent
    if src_root.name == "src":
        roots.append(src_root.resolve())
    repo = src_root.parent
    if (repo / "pyproject.toml").is_file():
        for name in ("site", "src"):
            candidate = (repo / name).resolve()
            if candidate.is_dir() and candidate not in roots:
                roots.append(candidate)
    return tuple(dict.fromkeys(roots))


def run_reloader(args: Namespace) -> None:
    try:
        from watchfiles import watch
    except ImportError as exc:
        raise SystemExit(
            "Dev reload requires watchfiles. Install with: uv sync --extra dev"
        ) from exc

    roots = watch_roots()
    command = [
        sys.executable,
        "-m",
        "portfolio_site.http",
        "--host",
        args.host,
        "--port",
        str(args.port),
    ]
    env = os.environ.copy()
    env[_CHILD] = "1"

    process: subprocess.Popen[bytes] | None = None
    logger.info("Watching %s", ", ".join(str(path) for path in roots))

    try:
        while True:
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()

            logger.info("Starting dev server on http://%s:%s", args.host, args.port)
            process = subprocess.Popen(command, env=env)
            try:
                process.wait(timeout=0.25)
            except subprocess.TimeoutExpired:
                pass
            else:
                raise SystemExit(process.returncode or 0)

            for _changes in watch(*roots, raise_interrupt=False):
                logger.info("Change detected, reloading…")
                break
    except KeyboardInterrupt:
        logger.info("Stopping")
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
