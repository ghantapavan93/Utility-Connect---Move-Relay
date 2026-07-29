# The scheduler's whole job: one authenticated POST, every five minutes.
#
# Alpine and curl rather than a Node runtime, because a Node cron on Render
# would install this repository's full dependency tree - Three.js, Playwright's
# peer graph, PGlite's WASM build - on every run, to send one HTTP request. The
# image below is a few megabytes and starts instantly.
FROM alpine:3.20

RUN apk add --no-cache curl

# `-f` makes a non-2xx response a non-zero exit, so Render marks the run failed
# and shows it in the dashboard. Without it curl prints the error body and exits
# 0, and a cron that has been 401ing for a week looks like a cron that has been
# working for a week.
#
# `-sS` is quiet on success but still prints errors. `--max-time` bounds a hung
# request so a stuck run cannot overlap the next schedule.
CMD ["sh", "-c", "curl -fsS --max-time 60 -X POST -H \"Authorization: Bearer ${CRON_SECRET}\" \"${MOVE_RELAY_URL}/api/v1/ops/drain\""]
