# Bakes the static Loki config into the image instead of bind-mounting it from
# the Coolify host's git checkout directory. The bind-mount source repeatedly
# ended up as a stale directory on the host (Docker auto-creates a directory
# when a bind-mount source doesn't exist yet, and that directory survives a
# `git reset --hard` that never runs `git clean -fd`), which broke every
# redeploy with "not a directory" mount errors. Config is static and versioned
# in git anyway, so baking it in removes the dependency on host state entirely
# — same pattern already used for nginx.conf (Dockerfile.web) and
# api-entrypoint.sh (Dockerfile.api).
FROM grafana/loki:3.7.6
COPY loki-config.yml /etc/loki/local-config.yaml
