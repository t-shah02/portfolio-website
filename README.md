# portfolio-website

Café-style portfolio for Tanish Shah. Dexbooru, the Amazon reviews study, and a few other public projects are written into the page. Work experience, languages, and education are read from the resume PDF on each change to that file.

## Replace the resume

Put the new file at `site/assets/resume/Tanish_Shah_Resume.pdf`. The next page load picks it up. No code change and no restart. Images go in `site/assets/images/` and are served from `/assets/images/`.

The parser expects the headings `Technical Skills`, `Work Experience`, and `Education`, with each role’s dates in a right-hand column. The phone number in the header is never shown. GitHub and LinkedIn stay the published profile links.

## Run locally

Poppler’s `pdftotext` is required (`poppler-utils` on Debian, `poppler` on Arch).

```bash
python -m venv .venv
.venv/bin/pip install -e .
.venv/bin/portfolio-site
```

Open http://127.0.0.1:8080

## Docker

The image runs nginx on port 8080 and the Python renderer behind it. nginx serves `/assets/` and `/css/`. The renderer reads the PDF.

```bash
docker build -t tanish-portfolio .
docker run --rm -p 8080:8080 tanish-portfolio
```

Mount the assets directory when you want a replaced PDF to show up without rebuilding:

```bash
docker run --rm -p 8080:8080 \
  -v "$PWD/site/assets:/srv/site/assets:ro" \
  tanish-portfolio
```
