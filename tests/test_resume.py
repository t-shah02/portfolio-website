import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from portfolio_site.content.about import AboutCache, AboutFormatError, AboutProblem, load_about_file
from portfolio_site.http.cache import ResumeCache, ResumeProblem
from portfolio_site.http.render import render_page
from portfolio_site.http.view import build_page
from portfolio_site.projects.parse import load_projects_dir
from portfolio_site.resume.parse import parse_resume_file, parse_resume_text

SAMPLE = """
Tanish Shah
587-574-2002 | connecttanish@gmail.com | linkedin.com/in/tanishshah | github.com/t-shah02

Technical Skills
 Languages: Python, Go

Work Experience
 Older Role                                          Jan 2020 – Mar 2020
 Somewhere                                           Remote
    • Did a thing
 Newer Role                                          Apr 2024 – Present
 Other Co                                            Calgary, AB
    • Did another
      thing that wraps

Education
 Simon Fraser University                             Burnaby, BC
 Bachelor of Science in Data Science                 May 2025
"""

ROOT = Path(__file__).resolve().parents[1]
RESUME = ROOT / "site" / "assets" / "pdfs" / "Tanish_Shah_Resume.pdf"
PROJECTS = ROOT / "site" / "assets" / "projects"
ABOUT = ROOT / "site" / "assets" / "about.md"


def build_test_page():
    return build_page(
        parse_resume_file(RESUME),
        load_projects_dir(PROJECTS),
        load_about_file(ABOUT),
    )


class ParseSampleTest(unittest.TestCase):
    def test_orders_roles_and_joins_wrapped_bullets(self) -> None:
        profile = parse_resume_text(SAMPLE)
        self.assertEqual(profile.name, "Tanish Shah")
        self.assertEqual(profile.email, "connecttanish@gmail.com")
        self.assertEqual(profile.languages, ("Python", "Go"))
        self.assertEqual([role.company for role in profile.roles], ["Other Co", "Somewhere"])
        self.assertEqual(profile.roles[0].bullets, ("Did another thing that wraps",))
        self.assertEqual(profile.education[0].school, "Simon Fraser University")
        self.assertEqual(profile.education[0].dates, "May 2025")


class ParsePdfTest(unittest.TestCase):
    def test_current_resume(self) -> None:
        profile = parse_resume_file(RESUME)
        self.assertEqual(
            [role.company for role in profile.roles],
            [
                "Neo Financial",
                "Operto Guest Technologies",
                "Boardspace",
                "Health Canada",
            ],
        )
        self.assertEqual(
            profile.languages,
            ("Python", "TypeScript", "JavaScript", "SQL", "C#", "PHP"),
        )
        self.assertTrue(profile.roles[0].bullets)
        self.assertIn("10TB", profile.roles[0].bullets[0])
        self.assertEqual(profile.education[0].school, "Simon Fraser University")
        self.assertEqual(profile.education[0].credential, "Bachelor of Science in Data Science")


class PageTest(unittest.TestCase):
    def test_hides_phone_and_uses_published_linkedin(self) -> None:
        page = build_test_page()
        html = render_page(page)
        self.assertNotIn("587-574-2002", html)
        self.assertIn("https://www.linkedin.com/in/tanishnshah/", html)
        self.assertIn("myanimelist.net/profile/IndoorOtaku", html)
        self.assertIn("steamcommunity.com/id/indoorotaku", html)
        self.assertIn("Cursor, Claude, and OpenCode", html)
        self.assertNotIn('class="now"', html)
        self.assertNotIn("linkedin.com/in/tanishshah", html)
        self.assertIn("dexbooru-web", html)
        self.assertIn("dexbooru-notifications", html)
        self.assertIn("dexbooru-infrastructure", html)
        self.assertIn("amazon-reviews-nlp-sentiment-analysis", html)
        self.assertIn("Quotify AI", html)
        self.assertIn("Operto Guest Technologies", html)
        self.assertIn("Boardspace", html)
        self.assertIn("See more", html)
        self.assertIn("project-dexbooru", html)
        self.assertIn("/assets/images/projects/dexbooru/screens/posts.webp", html)
        self.assertIn("/assets/images/profile/tanish-tokyo.jpg", html)
        self.assertIn("/assets/images/orgs/work/neo-financial.webp", html)
        self.assertIn("/assets/images/orgs/education/simon-fraser-university.webp", html)


class AboutCacheTest(unittest.TestCase):
    def test_reloads_when_the_file_changes(self) -> None:
        calls = {"n": 0}

        def loader(path: Path):
            calls["n"] += 1
            return load_about_file(path)

        with tempfile.TemporaryDirectory() as directory:
            md = Path(directory) / "about.md"
            md.write_text(
                "---\nname: Test\nemail: t@example.com\n"
                "github: https://github.com/t\nlinkedin: https://linkedin.com/in/t\n"
                "resume: /resume.pdf\n---\n\nFirst paragraph.",
                encoding="utf-8",
            )
            cache = AboutCache(md, loader)
            first = cache.load()
            second = cache.load()
            self.assertIs(first, second)
            self.assertEqual(calls["n"], 1)
            md.write_text(
                "---\nname: Test\nemail: t@example.com\n"
                "github: https://github.com/t\nlinkedin: https://linkedin.com/in/t\n"
                "resume: /resume.pdf\n---\n\nUpdated copy about Calgary.",
                encoding="utf-8",
            )
            timestamp = datetime.now().timestamp() + 5
            os_utime(md, timestamp)
            third = cache.load()
            self.assertIsNot(third, first)
            self.assertEqual(calls["n"], 2)
            self.assertIn("Calgary", third.plain)

    def test_missing_file_is_a_problem(self) -> None:
        missing = Path("/tmp/does-not-exist-portfolio-about.md")
        result = AboutCache(missing, load_about_file).load()
        self.assertIsInstance(result, AboutProblem)

    def test_missing_frontmatter_field_raises(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            md = Path(directory) / "about.md"
            md.write_text("No frontmatter here.", encoding="utf-8")
            with self.assertRaises(AboutFormatError):
                load_about_file(md)


class CacheTest(unittest.TestCase):
    def test_reloads_when_the_file_changes(self) -> None:
        calls = {"n": 0}

        def loader(path: Path):
            calls["n"] += 1
            return parse_resume_text(SAMPLE)

        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / "resume.pdf"
            pdf.write_text("one", encoding="utf-8")
            cache = ResumeCache(pdf, loader)
            first = cache.load()
            second = cache.load()
            self.assertIs(first, second)
            self.assertEqual(calls["n"], 1)
            pdf.write_text("two", encoding="utf-8")
            timestamp = datetime.now().timestamp() + 5
            os_utime(pdf, timestamp)
            third = cache.load()
            self.assertIsNot(third, first)
            self.assertEqual(calls["n"], 2)

    def test_missing_file_is_a_problem(self) -> None:
        missing = Path("/tmp/does-not-exist-portfolio-resume.pdf")
        result = ResumeCache(missing, lambda path: parse_resume_text(SAMPLE)).load()
        self.assertIsInstance(result, ResumeProblem)


def os_utime(path: Path, timestamp: float) -> None:
    import os

    os.utime(path, (timestamp, timestamp))


if __name__ == "__main__":
    unittest.main()
