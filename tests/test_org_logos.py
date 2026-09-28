import tempfile
import unittest
from pathlib import Path

from portfolio_site.resume.org_logos import load_org_logos, logo_src

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


class OrgLogosTest(unittest.TestCase):
    def test_loads_mapped_files_from_site(self) -> None:
        mapping = load_org_logos(SITE)
        self.assertIn("Neo Financial", mapping)
        self.assertTrue(mapping["Neo Financial"].endswith("neo-financial.webp"))

    def test_ignores_missing_image_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets" / "images" / "orgs" / "work").mkdir(parents=True)
            (root / "assets" / "images" / "orgs" / "work" / "present.webp").write_bytes(b"x")
            (root / "assets" / "org-logos.json").write_text(
                '{"Here": "work/present.webp", "Gone": "work/missing.webp"}',
                encoding="utf-8",
            )
            mapping = load_org_logos(root)
            self.assertEqual(mapping, {"Here": "/assets/images/orgs/work/present.webp"})
            self.assertIsNone(logo_src(mapping, "Gone"))


if __name__ == "__main__":
    unittest.main()
