#!/bin/sh
set -eu

python -m portfolio_site.http --host 127.0.0.1 --port 8000 &
py_pid=$!

nginx -c /etc/nginx/nginx.conf &
nginx_pid=$!

stop() {
    kill "$py_pid" "$nginx_pid" 2>/dev/null || true
}

trap stop TERM INT

while kill -0 "$py_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
    sleep 1
done

stop
wait "$py_pid" 2>/dev/null || true
wait "$nginx_pid" 2>/dev/null || true
