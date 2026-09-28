import argparse
import logging
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from portfolio_site.http.cache import ResumeCache
from portfolio_site.content.about import AboutCache
from portfolio_site.http.paths import about_path, projects_path, resume_path, site_root
from portfolio_site.http.reload import is_reload_child, run_reloader
from portfolio_site.projects.cache import ProjectsCache
from portfolio_site.http.render import render_page
from portfolio_site.http.view import build_page

logger = logging.getLogger(__name__)

_STATIC_PREFIXES = ("css/", "js/", "assets/")


def build_handler(
    root: Path,
    cache: ResumeCache,
    projects: ProjectsCache,
    about: AboutCache,
    *,
    dev: bool = False,
) -> type[BaseHTTPRequestHandler]:
    site = root.resolve()

    class Handler(BaseHTTPRequestHandler):
        server_version = "portfolio-site"

        def do_GET(self) -> None:  # noqa: N802
            path = unquote(urlparse(self.path).path)
            if path in ("", "/"):
                self._send_html()
                return
            static = _static_file(site, path)
            if static is None:
                self.send_error(404)
                return
            self._send_file(static)

        def log_message(self, fmt: str, *args) -> None:
            logger.info("%s - %s", self.address_string(), fmt % args)

        def _send_html(self) -> None:
            page = build_page(cache.load(), projects.load(), about.load())
            body = render_page(page).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)

        def _send_file(self, file_path: Path) -> None:
            content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            if content_type.startswith("text/"):
                content_type = f"{content_type}; charset=utf-8"
            data = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            if dev or file_path.suffix == ".pdf":
                self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)

    return Handler


def _static_file(root: Path, url_path: str) -> Path | None:
    relative = url_path.lstrip("/")
    if not relative.startswith(_STATIC_PREFIXES):
        return None
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description="Serve the portfolio site.")
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8080")))
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Restart automatically when site or source files change (local dev).",
    )
    args = parser.parse_args()

    if args.reload and not is_reload_child():
        run_reloader(args)
        return

    root = site_root()
    pdf = resume_path(root)
    cache = ResumeCache(pdf)
    projects_dir = projects_path(root)
    projects = ProjectsCache(projects_dir)
    about_file = about_path(root)
    about = AboutCache(about_file)
    dev = args.reload or is_reload_child()
    httpd = ThreadingHTTPServer(
        (args.host, args.port),
        build_handler(root, cache, projects, about, dev=dev),
    )
    logger.info("Serving %s on http://%s:%s", root, args.host, args.port)
    logger.info("Resume path: %s", pdf)
    logger.info("Projects path: %s", projects_dir)
    logger.info("About path: %s", about_file)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Stopping")
    finally:
        httpd.server_close()
