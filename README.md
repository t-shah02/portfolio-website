# portfolio-website

Café-style portfolio for Tanish Shah. Projects live as markdown under `site/assets/projects/`. Work experience, languages, and education are read from the resume PDF. The renderer reloads those assets when their files change, with no restart.

## Replace the resume

Put the new file at `site/assets/pdfs/Tanish_Shah_Resume.pdf`. The next page load picks it up. No code change and no restart.

Static images live under `site/assets/images/`:

- `profile/` — portrait and about photos
- `decor/tea/` — decorative illustrations
- `projects/<name>/screens/` — project modal screenshots

## Edit projects

Markdown files under `site/assets/projects/` drive the Projects section.

**Featured groups** (`features/*.md`) use front matter for the kicker and title, a short intro before the first heading, then one `### repo-name` section per repository:

```markdown
---
kicker: Image board
title: Dexbooru
order: 1
---

One paragraph about the group.

### dexbooru-web

url: https://github.com/org/repo
stack: TypeScript, SvelteKit

A sentence about this repo.
```

**Other public work** (`other/*.md`) is one project per file:

```markdown
---
name: Quotify AI
href: https://github.com/t-shah02/quotify-ai
order: 1
stack: Python, LangChain, OpenAI
---

Summary paragraph.
```

Optional **See more** modals use a `## see more` section (featured groups) or `#### see more` (a repo under a group, or an other-project file). Put screenshots first as markdown images, then prose:

```markdown
## see more

![Caption text](/assets/images/projects/example/screens/screen.webp)

**Live site:** [example.com](https://example.com)

A longer write-up with paragraphs, [links](https://example.com), and lists:

- First point
- Second point
```

Use a numeric prefix in the filename (`01-`, `02-`, …) or an `order:` field to control sort order. Set `PROJECTS_DIR` to point at a different directory in Docker or locally.

The parser expects the headings `Technical Skills`, `Work Experience`, and `Education`, with each role’s dates in a right-hand column. The phone number in the header is never shown. GitHub and LinkedIn stay the published profile links.

## Run locally

Install [uv](https://docs.astral.sh/uv/). Poppler’s `pdftotext` is required (`poppler-utils` on Debian, `poppler` on Arch).

```bash
make run
```

That runs the dev server with `--reload` (watches `site/` and `src/` and restarts on change). Static assets and markdown or resume updates also show up on refresh; CSS and JS are sent with `no-cache` in dev. Open http://127.0.0.1:8080

Other targets:

```bash
make test        # unit tests
make build       # docker image tanish-portfolio
make run-build   # container on port 8080
```

Override `PORT`, `HOST`, or `IMAGE` on the command line if needed, e.g. `make run PORT=8090`.

## Docker

The image runs nginx on port 8080 and the Python renderer behind it. nginx serves `/assets/`, `/css/`, and `/js/`. The renderer reads the PDF. Dependencies are installed with uv during the build.

```bash
make build
make run-build
```

Mount the assets directory when you want a replaced PDF or edited project markdown to show up without rebuilding:

```bash
docker run --rm -p 8080:8080 \
  -v "$PWD/site/assets:/srv/site/assets:ro" \
  tanish-portfolio
```
