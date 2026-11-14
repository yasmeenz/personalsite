"""Local dev server: static files with caching disabled, so edits always show up.
Usage: python serve.py [port]   (default 5510)"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5510
    handler = partial(NoCacheHandler, directory=str(Path(__file__).parent))
    print(f"Serving on http://localhost:{port}")
    ThreadingHTTPServer(("localhost", port), handler).serve_forever()
