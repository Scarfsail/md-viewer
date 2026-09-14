import hashlib
import json
import os
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

import server


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        base = os.path.realpath(self.tmp.name)
        self.root = os.path.join(base, "root")
        self.outside = os.path.join(base, "outside.md")

        self.write("a.md", b"# A\n")
        self.write("docs/b.markdown", b"# B\n")
        self.write("docs/deep/C.MD", b"# C\n")
        self.write("notes.txt", b"not markdown")
        self.write(".git/HEAD.md", b"hidden")
        self.write("node_modules/pkg/README.md", b"dependency")
        with open(self.outside, "wb") as f:
            f.write(b"secret")
        os.symlink(self.outside, os.path.join(self.root, "link.md"))

        server.Handler.log_message = lambda *args: None
        self.httpd = server.make_server(self.root, "127.0.0.1", 0)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.addCleanup(self.httpd.server_close)
        self.addCleanup(self.httpd.shutdown)
        self.base_url = f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def write(self, rel, data):
        path = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)

    def read(self, rel):
        with open(os.path.join(self.root, rel), "rb") as f:
            return f.read()

    def request(self, method, url, body=None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        try:
            with urlopen(Request(self.base_url + url, data=data, method=method)) as res:
                return res.status, res.headers, res.read()
        except HTTPError as e:
            with e:
                return e.code, e.headers, e.read()

    def api(self, method, url, body=None):
        status, headers, raw = self.request(method, url, body)
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertEqual(headers["Cache-Control"], "no-store")
        return status, json.loads(raw)

    def file_url(self, rel):
        return "/api/file?path=" + quote(rel, safe="")

    def test_listing(self):
        status, body = self.api("GET", "/api/files")
        self.assertEqual(status, 200)
        self.assertEqual(body["root"], "root")
        self.assertEqual(body["files"], ["a.md", "docs/b.markdown", "docs/deep/C.MD"])

    def test_get_returns_content_and_hash(self):
        status, body = self.api("GET", self.file_url("docs/b.markdown"))
        self.assertEqual(status, 200)
        mtime = body.pop("mtime")
        self.assertEqual(mtime, os.stat(os.path.join(self.root, "docs/b.markdown")).st_mtime)
        self.assertEqual(body, {
            "path": "docs/b.markdown",
            "content": "# B\n",
            "hash": hashlib.sha256(b"# B\n").hexdigest(),
        })

    def test_meta_returns_mtime(self):
        status, body = self.api("GET", "/api/file-meta?path=" + quote("docs/b.markdown", safe=""))
        self.assertEqual(status, 200)
        self.assertEqual(body, {
            "path": "docs/b.markdown",
            "mtime": os.stat(os.path.join(self.root, "docs/b.markdown")).st_mtime,
        })

    def test_meta_missing_file_returns_404(self):
        status, body = self.api("GET", "/api/file-meta?path=missing.md")
        self.assertEqual(status, 404)
        self.assertIn("error", body)

    def test_non_utf8_returns_422(self):
        self.write("latin1.md", b"caf\xe9")
        status, body = self.api("GET", self.file_url("latin1.md"))
        self.assertEqual(status, 422)
        self.assertIn("error", body)

    def test_crlf_round_trips(self):
        original = b"line one\r\nline two\r\n"
        self.write("crlf.md", original)
        _, body = self.api("GET", self.file_url("crlf.md"))
        self.assertEqual(body["content"], "line one\r\nline two\r\n")
        status, put = self.api("PUT", self.file_url("crlf.md"), {"content": body["content"], "base_hash": body["hash"]})
        self.assertEqual(status, 200)
        self.assertEqual(put["hash"], body["hash"])
        self.assertEqual(self.read("crlf.md"), original)

    def test_put_with_correct_hash_writes(self):
        _, body = self.api("GET", self.file_url("a.md"))
        status, put = self.api("PUT", self.file_url("a.md"), {"content": "# Edited ✓\n", "base_hash": body["hash"]})
        self.assertEqual(status, 200)
        self.assertEqual(self.read("a.md"), "# Edited ✓\n".encode("utf-8"))
        self.assertEqual(put["hash"], hashlib.sha256(self.read("a.md")).hexdigest())
        self.assertEqual([n for n in os.listdir(self.root) if n.startswith(".viewmd-")], [])

    def test_put_with_stale_hash_conflicts(self):
        _, body = self.api("GET", self.file_url("a.md"))
        self.write("a.md", b"# Agent change\n")
        status, conflict = self.api("PUT", self.file_url("a.md"), {"content": "# Mine\n", "base_hash": body["hash"]})
        self.assertEqual(status, 409)
        mtime = conflict.pop("mtime")
        self.assertEqual(mtime, os.stat(os.path.join(self.root, "a.md")).st_mtime)
        self.assertEqual(conflict, {
            "hash": hashlib.sha256(b"# Agent change\n").hexdigest(),
            "content": "# Agent change\n",
        })
        self.assertEqual(self.read("a.md"), b"# Agent change\n")

        # Resending with the hash from the 409 is the overwrite path.
        status, _ = self.api("PUT", self.file_url("a.md"), {"content": "# Mine\n", "base_hash": conflict["hash"]})
        self.assertEqual(status, 200)
        self.assertEqual(self.read("a.md"), b"# Mine\n")

    def test_rejected_paths(self):
        cases = {
            "../outside.md": 400,
            self.outside: 400,
            "link.md": 400,
            "notes.txt": 400,
            "missing.md": 404,
        }
        for rel, expected in cases.items():
            for method in ("GET", "PUT"):
                with self.subTest(path=rel, method=method):
                    payload = {"content": "pwned", "base_hash": ""} if method == "PUT" else None
                    status, body = self.api(method, self.file_url(rel), payload)
                    self.assertEqual(status, expected)
                    self.assertIn("error", body)
        with open(self.outside, "rb") as f:
            self.assertEqual(f.read(), b"secret")
        self.assertEqual(self.read("notes.txt"), b"not markdown")

    def test_static_serves_app_not_root(self):
        self.write("index.html", b"from root")
        status, _, raw = self.request("GET", "/index.html")
        self.assertEqual(status, 200)
        with open(os.path.join(server.APP_DIR, "index.html"), "rb") as f:
            self.assertEqual(raw, f.read())


if __name__ == "__main__":
    unittest.main()
