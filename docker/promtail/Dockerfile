# Bakes the static Promtail config into the image — see docker/loki/Dockerfile
# for why bind-mounting from the Coolify host checkout was fragile and is
# being replaced everywhere in the observability stack.
FROM grafana/promtail:3.6.11
COPY promtail-config.yml /etc/promtail/config.yml
