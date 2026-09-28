import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from portfolio_site.projects.cache import ProjectsCache, ProjectsProblem
from portfolio_site.projects.parse import ProjectsFormatError, load_projects_dir, parse_feature_file

PROJECTS = (
    Path(__file__).resolve().parents[1]
    / "site"
    / "assets"
    / "projects"
)


class LoadProjectsTest(unittest.TestCase):
    def test_loads_feature_and_other_markdown(self) -> None:
        bundle = load_projects_dir(PROJECTS)
        self.assertEqual([feature.title for feature in bundle.features], ["Dexbooru", "Amazon reviews sentiment"])
        dexbooru = bundle.features[0]
        self.assertEqual(dexbooru.links[0].name, "dexbooru-web")
        self.assertIsNotNone(dexbooru.details)
        assert dexbooru.details is not None
        self.assertEqual(len(dexbooru.details.images), 3)
        self.assertEqual(dexbooru.details.images[2].src, "/assets/images/projects/dexbooru/screens/post-detail.webp")
        self.assertIn("dexbooru.neetbyte.fun", dexbooru.details.body_html)
        self.assertEqual(bundle.other_projects[0].name, "Quotify AI")
        self.assertIn("Stable Diffusion", bundle.other_projects[0].stack)

    def test_missing_directory_is_empty(self) -> None:
        bundle = load_projects_dir(Path("/tmp/no-such-projects-dir"))
        self.assertEqual(bundle.features, ())
        self.assertEqual(bundle.other_projects, ())


class ProjectsCacheTest(unittest.TestCase):
    def test_reloads_when_a_markdown_file_changes(self) -> None:
        calls = {"n": 0}

        def loader(path: Path):
            calls["n"] += 1
            return load_projects_dir(path)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "other").mkdir()
            md = root / "other" / "01-sample.md"
            md.write_text(
                "---\nname: One\nhref: https://example.com\nstack: Go\n---\n\nFirst summary.\n",
                encoding="utf-8",
            )
            cache = ProjectsCache(root, loader)
            first = cache.load()
            second = cache.load()
            self.assertIs(first, second)
            self.assertEqual(calls["n"], 1)
            md.write_text(
                "---\nname: Two\nhref: https://example.com\nstack: Go\n---\n\nSecond summary.\n",
                encoding="utf-8",
            )
            _touch(md)
            third = cache.load()
            self.assertIsNot(third, first)
            self.assertEqual(calls["n"], 2)
            assert not isinstance(third, ProjectsProblem)
            self.assertEqual(third.other_projects[0].name, "Two")

    def test_parse_error_becomes_a_problem(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "other").mkdir()
            (root / "other" / "broken.md").write_text("---\nname: X\n---\n", encoding="utf-8")
            result = ProjectsCache(root).load()
            self.assertIsInstance(result, ProjectsProblem)


class ProjectsFormatTest(unittest.TestCase):
    def test_feature_without_url_raises(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.md"
            path.write_text(
                "---\nkicker: K\ntitle: T\n---\n\nSummary.\n\n### repo\n\nNo url line.\n",
                encoding="utf-8",
            )
            with self.assertRaises(ProjectsFormatError):
                parse_feature_file(path)


def _touch(path: Path) -> None:
    import os

    timestamp = datetime.now().timestamp() + 5
    os.utime(path, (timestamp, timestamp))


if __name__ == "__main__":
    unittest.main()
