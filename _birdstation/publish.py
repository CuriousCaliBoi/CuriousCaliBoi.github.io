import json
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

API = "http://127.0.0.1:8080"


def fetch(path):
    with urlopen(API + path, timeout=10) as response:
        return json.load(response)


def archive_record(row):
    return {"id": row["id"], "commonName": row["commonName"], "scientificName": row["scientificName"],
            "confidence": row["confidence"], "detectedAt": row["timestamp"],
            "verified": row.get("verified") or "unverified"}


def sync_history(upload, since=None):
    offset = 0
    target = None
    while target is None or offset < target:
        params = {"numResults": 500, "sortBy": "date_asc", "offset": offset}
        if since:
            params["start_date"] = (since.astimezone(ZoneInfo("America/Los_Angeles")) - timedelta(days=1)).date().isoformat()
        page = fetch("/api/v2/detections?" + urlencode(params))
        if target is None:
            target = page["total"]
        rows = page["data"]
        if not rows:
            if offset < target:
                raise ValueError("Incomplete history page")
            break
        records = [archive_record(row) for row in rows if row.get("modelType", "bird") == "bird"]
        upload("/archive/ingest", {"records": records})
        offset += len(rows)
    if since is None:
        upload("/archive/complete", {})
    return offset


def history_worker(upload):
    last_success = None
    full_at = 0
    while True:
        started = datetime.now(timezone.utc)
        full = last_success is None or time.monotonic() - full_at > 86400
        try:
            count = sync_history(upload, None if full else last_success)
            last_success = started
            if full:
                full_at = time.monotonic()
            logging.info("History synchronized: %s source records", count)
            time.sleep(300)
        except (OSError, ValueError, KeyError, TypeError) as error:
            logging.warning("History sync failed (%s); retrying", type(error).__name__)
            time.sleep(60)


def snapshot():
    health = fetch("/api/v2/health/audio")
    inference = fetch("/api/v2/system/inference")
    rows = fetch("/api/v2/detections?numResults=100&sortBy=date_desc")
    now = time.time()
    sources = health["sources"]
    healthy_audio = any(source["state"] == "HEALTHY" and
                        now - datetime.fromisoformat(source["last_dispatch"].replace("Z", "+00:00")).timestamp() < 45
                        for source in sources)
    healthy_model = any(model.get("health", {}).get("state") == "ok" and
                        now - model["health"].get("lastSuccessAtUnix", 0) < 45
                        for model in inference["models"])
    detections = []
    for row in rows["data"]:
        if row.get("verified") == "false_positive" or row.get("modelType", "bird") != "bird":
            continue
        if row["confidence"] < 0.75:
            continue
        detections.append({"commonName": row["commonName"], "scientificName": row["scientificName"],
                           "confidence": row["confidence"], "detectedAt": row["timestamp"]})
    return {"observedAt": datetime.now(timezone.utc).isoformat(),
            "healthy": healthy_audio and healthy_model, "detections": detections,
            "records": [archive_record(row) for row in rows["data"] if row.get("modelType", "bird") == "bird"]}


def main():
    config = json.loads(Path(os.environ["BIRD_PUBLISH_CONFIG"]).read_text())
    if not config["endpoint"].startswith("https://"):
        raise ValueError("The public feed requires HTTPS")
    token = Path(config["tokenFile"]).read_text().strip()
    base = config["endpoint"].removesuffix("/ingest")

    def upload(path, data):
        request = Request(base + path, data=json.dumps(data).encode(),
                          headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
        with urlopen(request, timeout=20) as response:
            if not json.load(response).get("accepted"):
                raise ValueError("Update rejected")

    previous = None
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    threading.Thread(target=history_worker, args=(upload,), daemon=True).start()
    while True:
        started = time.monotonic()
        try:
            data = snapshot()
            previous = data["detections"]
        except (OSError, ValueError, KeyError, TypeError) as error:
            logging.warning("BirdNET unavailable (%s)", type(error).__name__)
            data = {"observedAt": datetime.now(timezone.utc).isoformat(),
                    "healthy": False, "detections": previous}
        try:
            upload("/ingest", data)
        except (OSError, URLError, ValueError) as error:
            logging.warning("Feed update failed (%s); retrying", type(error).__name__)
        time.sleep(max(1, 15 - (time.monotonic() - started)))


if __name__ == "__main__":
    main()
