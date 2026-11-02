import hmac
import json
import math
import os
import sqlite3
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from archive import Archive, clean_records

ORIGIN = "https://curiouscaliboi.github.io"
MAX_BODY = 160_000


def instant(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timezone required")
    return parsed.timestamp()


def clean_snapshot(raw, now):
    observed = raw["observedAt"]
    if abs(instant(observed) - now) > 120:
        raise ValueError("Station clock is out of date")
    if not isinstance(raw["healthy"], bool):
        raise ValueError("Invalid station health")
    rows = raw["detections"]
    if not isinstance(rows, list) or len(rows) > 500:
        raise ValueError("Too many detections")
    clean = {}
    for row in rows:
        stamp = row["detectedAt"]
        when = instant(stamp)
        confidence = row["confidence"]
        if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
            raise ValueError("Invalid confidence")
        if not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise ValueError("Invalid confidence")
        names = (row["commonName"], row["scientificName"])
        if not all(isinstance(name, str) and 0 < len(name) <= 120 for name in names):
            raise ValueError("Invalid species name")
        if when > now + 120:
            raise ValueError("Detection is in the future")
        if when < now - 7 * 86400 or confidence < 0.75:
            continue
        key = names[1] + ":" + stamp
        clean[key] = {"commonName": names[0], "scientificName": names[1],
                      "confidence": confidence, "detectedAt": stamp}
    return {"observedAt": observed, "healthy": raw["healthy"],
            "updatedAt": datetime.fromtimestamp(now, timezone.utc).isoformat(),
            "detections": sorted(clean.values(), key=lambda row: instant(row["detectedAt"]), reverse=True)}


class Feed:
    def __init__(self, path):
        self.path = Path(path)
        self.changed = threading.Condition()
        self.revision = 0
        self.archive = Archive(self.path.with_suffix(".sqlite3"))
        self.snapshot = {"updatedAt": None, "observedAt": None, "healthy": False, "detections": []}
        if self.path.exists():
            self.snapshot = json.loads(self.path.read_text())

    def update(self, raw):
        with self.changed:
            if raw.get("detections") is None and raw.get("healthy") is False:
                raw = dict(raw, detections=self.snapshot["detections"])
            snapshot = clean_snapshot(raw, time.time())
            records = raw.get("records", [])
            clean_records(records)
            if self.snapshot["observedAt"] and instant(snapshot["observedAt"]) <= instant(self.snapshot["observedAt"]):
                raise ValueError("Older snapshot")
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temp = self.path.with_suffix(".tmp")
            temp.write_text(json.dumps(snapshot))
            temp.replace(self.path)
            self.archive.upsert(records)
            self.snapshot = snapshot
            self.revision += 1
            self.changed.notify_all()

    def data(self):
        with self.changed:
            return dict(self.snapshot, serverTime=datetime.now(timezone.utc).isoformat(),
                        archiveRevision=self.archive.revision())


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(20)

    def log_message(self, *args):
        pass

    def path_name(self):
        path = urlsplit(self.path).path
        return path.removeprefix("/birds-live")

    def respond_headers(self, code, content_type, length=None):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("X-Content-Type-Options", "nosniff")
        if length is not None:
            self.send_header("Content-Length", str(length))
        self.end_headers()

    def reply(self, code, value):
        data = json.dumps(value).encode()
        self.respond_headers(code, "application/json; charset=utf-8", len(data))
        self.wfile.write(data)

    def do_GET(self):
        path = self.path_name()
        if path == "/archive" or path.startswith("/archive/"):
            params = parse_qs(urlsplit(self.path).query)
            try:
                minimum = float(params.get("min", ["0.75"])[0])
                archive = self.server.feed.archive
                if path == "/archive":
                    result = archive.summary(minimum)
                elif path == "/archive/day":
                    result = archive.day(params["date"][0], minimum)
                elif path == "/archive/species":
                    result = archive.species(params["species"][0], minimum)
                elif path == "/archive/records":
                    result = archive.records(minimum, params.get("date", [None])[0],
                                             params.get("species", [None])[0], params.get("before", [None])[0])
                else:
                    self.reply(404, {"error": "Not found"})
                    return
            except (KeyError, ValueError, TypeError, OverflowError):
                self.reply(400, {"error": "Invalid archive query"})
                return
            self.reply(200, result)
        elif path == "/state":
            self.reply(200, self.server.feed.data())
        elif path == "/events":
            if not self.server.slots.acquire(blocking=False):
                self.reply(503, {"error": "Stream busy; use state"})
                return
            try:
                self.respond_headers(200, "text/event-stream")
                started = time.monotonic()
                while time.monotonic() - started < 300:
                    with self.server.feed.changed:
                        revision = self.server.feed.revision
                        data = json.dumps(self.server.feed.data())
                    self.wfile.write(("event: snapshot\ndata: " + data + "\n\n").encode())
                    self.wfile.flush()
                    with self.server.feed.changed:
                        self.server.feed.changed.wait_for(lambda: self.server.feed.revision != revision, timeout=15)
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                pass
            finally:
                self.server.slots.release()
        else:
            self.reply(404, {"error": "Not found"})

    def do_POST(self):
        path = self.path_name()
        if path not in ("/ingest", "/archive/ingest", "/archive/complete"):
            self.reply(404, {"error": "Not found"})
            return
        supplied = self.headers.get("Authorization", "")
        if not hmac.compare_digest(supplied.encode(), ("Bearer " + self.server.token).encode()):
            self.reply(401, {"error": "Unauthorized"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= MAX_BODY:
                self.reply(413, {"error": "Invalid payload size"})
                return
            raw = json.loads(self.rfile.read(size))
            if path == "/archive/ingest":
                self.server.feed.archive.upsert(raw["records"])
            elif path == "/archive/complete":
                self.server.feed.archive.complete()
            else:
                self.server.feed.update(raw)
        except (KeyError, ValueError, TypeError, AttributeError):
            self.reply(400, {"error": "Invalid station update"})
            return
        except (OSError, sqlite3.Error):
            self.reply(503, {"error": "Could not save update"})
            return
        self.reply(200, {"accepted": True})


def make_server(port, token, state_path):
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    server.feed = Feed(state_path)
    server.token = token
    server.slots = threading.BoundedSemaphore(40)
    return server


if __name__ == "__main__":
    token = Path(os.environ["BIRD_TOKEN_FILE"]).read_text().strip()
    if len(token) < 32:
        raise ValueError("A strong station token is required")
    make_server(int(os.environ.get("BIRD_PORT", "8795")), token,
                os.environ["BIRD_STATE_FILE"]).serve_forever()
