IMAGE ?= tanish-portfolio
PORT ?= 8080
HOST ?= 127.0.0.1

.PHONY: run build run-build test test-py test-js

run:
	uv run --extra dev portfolio-site --host $(HOST) --port $(PORT) --reload

build:
	docker build -t $(IMAGE) .

run-build:
	docker run --rm -p $(PORT):8080 $(IMAGE)

test: test-py test-js

test-py:
	uv run python -m unittest discover -s tests -v

# The sky's clock depends on the browser's time zone, so run it under a few.
test-js:
	for tz in America/Edmonton Australia/Sydney Asia/Kolkata; do \
		TZ=$$tz node --test "tests/js/*.test.js" || exit 1; \
	done
