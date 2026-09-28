IMAGE ?= tanish-portfolio
PORT ?= 8080
HOST ?= 127.0.0.1

.PHONY: run build run-build test

run:
	uv run --extra dev portfolio-site --host $(HOST) --port $(PORT) --reload

build:
	docker build -t $(IMAGE) .

run-build:
	docker run --rm -p $(PORT):8080 $(IMAGE)

test:
	uv run python -m unittest discover -s tests -v
