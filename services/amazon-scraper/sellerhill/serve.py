import os

from cheroot import wsgi

from sellerhill.app import create_app


def main():
    port = int(os.environ.get("SCRAPER_PORT", "8080"))
    server = wsgi.Server(("0.0.0.0", port), create_app(), server_name="sellerhill-scraper", numthreads=32)
    print(f"sellerhill scraper listening on :{port}")
    try:
        server.start()
    except KeyboardInterrupt:
        server.stop()


if __name__ == "__main__":
    main()
