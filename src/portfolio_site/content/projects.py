from dataclasses import dataclass


@dataclass(frozen=True)
class ProjectLink:
    name: str
    href: str
    summary: str
    stack: tuple[str, ...]


@dataclass(frozen=True)
class Feature:
    kicker: str
    title: str
    summary: str
    links: tuple[ProjectLink, ...]


def features() -> tuple[Feature, ...]:
    return (
        Feature(
            kicker="Image board",
            title="Dexbooru",
            summary=(
                "A taggable image board for anime, manga, and Japanese pop culture. "
                "The web app, notification service, and AWS infrastructure are the "
                "parts I want to show. A Python service beside them handles similarity search."
            ),
            links=(
                ProjectLink(
                    name="dexbooru-web",
                    href="https://github.com/Dexbooru/dexbooru-web",
                    summary=(
                        "The board itself. People upload images, tag them, comment, "
                        "add friends, and keep collections."
                    ),
                    stack=(
                        "TypeScript",
                        "SvelteKit",
                        "Prisma",
                        "PostgreSQL",
                        "Redis",
                        "S3",
                        "CloudFront",
                    ),
                ),
                ProjectLink(
                    name="dexbooru-notifications",
                    href="https://github.com/Dexbooru/dexbooru-notifications",
                    summary=(
                        "Consumes RabbitMQ events, stores invites and comments in MongoDB, "
                        "and pushes them to browsers over WebSockets."
                    ),
                    stack=("TypeScript", "Bun", "RabbitMQ", "MongoDB"),
                ),
                ProjectLink(
                    name="dexbooru-infrastructure",
                    href="https://github.com/Dexbooru/dexbooru-infrastructure",
                    summary=(
                        "Terraform for media storage, the CDN, a classification queue, "
                        "and a Lambda that labels post images. Container images sit in ECR."
                    ),
                    stack=("Terraform", "AWS", "S3", "CloudFront", "SQS", "Lambda"),
                ),
            ),
        ),
        Feature(
            kicker="Data science",
            title="Amazon reviews sentiment",
            summary=(
                "A study of sentiment across Amazon product reviews. Pandas and PySpark "
                "clean the corpus, notebooks explore it, and VADER with spaCy prepare "
                "text for models that predict sentiment, star ratings, and categories."
            ),
            links=(
                ProjectLink(
                    name="amazon-reviews-nlp-sentiment-analysis",
                    href="https://github.com/t-shah02/amazon-reviews-nlp-sentiment-analysis",
                    summary=(
                        "ETL, exploratory notebooks, and naive Bayes models. "
                        "Preprocessed data and saved models are published on archive.org."
                    ),
                    stack=("Python", "PySpark", "Pandas", "spaCy", "Jupyter"),
                ),
            ),
        ),
    )


def other_projects() -> tuple[ProjectLink, ...]:
    return (
        ProjectLink(
            name="Quotify AI",
            href="https://github.com/t-shah02/quotify-ai",
            summary=(
                "Picks categories from a set of about 30,000 quotes, retrieves neighbors "
                "from a vector store, and asks a language model for a new quote. "
                "Stable Diffusion draws the image. It posts to Instagram."
            ),
            stack=("Python", "LangChain", "Chroma", "OpenAI"),
        ),
        ProjectLink(
            name="moewalls-cli",
            href="https://github.com/t-shah02/moewalls-cli",
            summary=(
                "A terminal UI for searching live wallpapers, downloading one, "
                "and setting it in KDE."
            ),
            stack=("TypeScript", "Bun"),
        ),
        ProjectLink(
            name="go_scrape",
            href="https://github.com/t-shah02/go_scrape",
            summary=(
                "A concurrent scraper for one domain. It walks pages with Colly "
                "and writes JSON of the text it found."
            ),
            stack=("Go", "Colly"),
        ),
        ProjectLink(
            name="Virtuagnosis",
            href="https://github.com/t-shah02/virtuagnosis",
            summary="Hawkhacks 2022. A real-time disease prediction web app.",
            stack=("Svelte",),
        ),
    )
