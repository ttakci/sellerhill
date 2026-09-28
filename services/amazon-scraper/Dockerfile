FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt
# .dockerignore keeps the local virtualenv, caches, tests and fixtures out.
COPY . /app
# Run unprivileged. The service writes nothing to disk (AMAZON_DEBUG_DIR is
# unset in every deployment), so the root-owned /app stays read-only to it.
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin scraper
USER scraper
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2).status == 200 else 1)"
CMD ["python", "-m", "sellerhill.serve"]
