import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

API = "http://127.0.0.1:8080"


def fetch(path):
    with urlopen(API + path, timeout=10) as response:
        return json.load(response)


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
            "healthy": healthy_audio and healthy_model, "detections": detections}


def main():
    config = json.loads(Path(os.environ["BIRD_PUBLISH_CONFIG"]).read_text())
    if not config["endpoint"].startswith("https://"):
        raise ValueError("The public feed requires HTTPS")
    token = Path(config["tokenFile"]).read_text().strip()
    previous = None
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
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
            request = Request(config["endpoint"], data=json.dumps(data).encode(),
                              headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
            with urlopen(request, timeout=15) as response:
                if not json.load(response).get("accepted"):
                    raise ValueError("Update rejected")
        except (OSError, URLError, ValueError) as error:
            logging.warning("Feed update failed (%s); retrying", type(error).__name__)
        time.sleep(max(1, 15 - (time.monotonic() - started)))


if __name__ == "__main__":
    main()
