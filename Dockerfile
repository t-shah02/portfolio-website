FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    SITE_ROOT=/srv/site \
    RESUME_PATH=/srv/site/assets/resume/Tanish_Shah_Resume.pdf

RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils nginx \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

WORKDIR /srv

COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir .

COPY site ./site
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/')"

ENTRYPOINT ["docker-entrypoint.sh"]
