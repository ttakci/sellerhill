# Bakes the static Grafana provisioning (datasource + dashboard definitions)
# into the image — see docker/loki/Dockerfile for why bind-mounting from the
# Coolify host checkout was fragile and is being replaced everywhere in the
# observability stack. `grafana_data` (the actual DB/session state) stays a
# named volume in compose — only the read-only provisioning config moves here.
FROM grafana/grafana:13.1.3
COPY provisioning /etc/grafana/provisioning
