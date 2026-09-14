#!/usr/bin/env python3
"""ViewMD host mode: serves the static app plus a small JSON API for the
Markdown files under one root folder. Stdlib only, no authentication."""

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

APP_DIR = os.path.dirname(os.path.realpath(__file__))
MD_EXTENSIONS = (".md", ".markdown")
SKIPPED_DIRS = {"node_modules"}


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def is_markdown(name):
    return name.lower().endswith(MD_EXTENSIONS)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def is_inside(root, path):
    """True when path, with symlinks resolved, lies within root."""
    try:
        return os.path.commonpath([root, os.path.realpath(path)]) == root
    except ValueError:
        return False


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/"):
            self.handle_api(self.api_get)
        else:
            super().do_GET()

    def do_PUT(self):
        self.handle_api(self.api_put)

    def handle_api(self, method):
        url = urlparse(self.path)
        try:
            status, body = method(url.path, parse_qs(url.query).get("path", [""])[0])
        except ApiError as e:
            status, body = e.status, {"error": str(e)}
        self.send_json(status, body)

    def send_json(self, status, body):
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def resolve_md_path(self, rel):
        """Single source of truth for confining file access to the root."""
        path = os.path.realpath(os.path.join(self.server.root, rel))
        if not is_inside(self.server.root, path):
            raise ApiError(400, "Path is outside the root folder")
        if not is_markdown(path):
            raise ApiError(400, "Only .md and .markdown files are allowed")
        if not os.path.isfile(path):
            raise ApiError(404, "File not found")
        return path

    def read_file(self, path):
        with open(path, "rb") as f:
            data = f.read()
        try:
            return data.decode("utf-8"), sha256(data)
        except UnicodeDecodeError:
            raise ApiError(422, "File is not valid UTF-8")

    def api_get(self, route, rel):
        root = self.server.root
        if route == "/api/files":
            files = []
            for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
                dirnames[:] = [d for d in dirnames if not d.startswith(".") and d not in SKIPPED_DIRS]
                for name in filenames:
                    if is_markdown(name) and is_inside(root, os.path.join(dirpath, name)):
                        files.append(os.path.relpath(os.path.join(dirpath, name), root).replace(os.sep, "/"))
            return 200, {"root": os.path.basename(root), "files": sorted(files)}
        if route == "/api/file":
            content, file_hash = self.read_file(self.resolve_md_path(rel))
            return 200, {"path": rel, "content": content, "hash": file_hash}
        raise ApiError(404, "Unknown API endpoint")

    def api_put(self, route, rel):
        if route != "/api/file":
            raise ApiError(404, "Unknown API endpoint")
        path = self.resolve_md_path(rel)
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            content = body["content"]
            if not isinstance(content, str):
                raise TypeError
        except (ValueError, TypeError, KeyError):
            raise ApiError(400, "Expected JSON body {content, base_hash}")
        # Check and write under one lock; replace atomically so readers never see a partial file
        with self.server.write_lock:
            current_content, current_hash = self.read_file(path)
            if body.get("base_hash") != current_hash:
                return 409, {"hash": current_hash, "content": current_content}
            data = content.encode("utf-8")
            fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".viewmd-")
            try:
                with os.fdopen(fd, "wb") as f:
                    f.write(data)
                shutil.copymode(path, tmp_path)
                os.replace(tmp_path, path)
            except BaseException:
                os.unlink(tmp_path)
                raise
        return 200, {"hash": sha256(data)}


def make_server(root, bind="0.0.0.0", port=8000):
    server = ThreadingHTTPServer((bind, port), partial(Handler, directory=APP_DIR))
    server.root = root
    server.write_lock = threading.Lock()
    return server


def main():
    parser = argparse.ArgumentParser(description="Serve ViewMD with read/write access to Markdown files under --root.")
    parser.add_argument("--root", required=True, help="folder whose .md/.markdown files are exposed")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--bind", default="0.0.0.0")
    args = parser.parse_args()

    root = os.path.realpath(args.root)
    if not os.path.isdir(root):
        parser.error(f"--root is not a directory: {root}")

    server = make_server(root, args.bind, args.port)
    print(f"Serving ViewMD on http://{args.bind}:{args.port}/ with root {root}", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
