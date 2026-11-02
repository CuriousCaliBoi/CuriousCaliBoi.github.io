import json
import tempfile
import threading
import time
import unittest
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

import feed
import publish


def stamp(offset=0):
    return datetime.fromtimestamp(time.time() + offset, timezone.utc).isoformat()


def record():
    return {"commonName": "Anna's Hummingbird", "scientificName": "Calypte anna",
            "confidence": .86, "detectedAt": stamp(-60), "source": "private microphone",
            "clipName": "private-recording.m4a", "latitude": 12}


class FeedTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "state.json"
        self.server = feed.make_server(0, "test-only-token", self.path)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = "http://127.0.0.1:" + str(self.server.server_port)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.temp.cleanup()

    def post(self, data, token="test-only-token"):
        request = Request(self.url + "/birds-live/ingest", data=json.dumps(data).encode(),
                          headers={"Authorization": "Bearer " + token})
        try:
            with urlopen(request) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            with error:
                return error.code, json.load(error)

    def data(self):
        with urlopen(self.url + "/birds-live/state") as response:
            self.assertEqual(response.headers["Access-Control-Allow-Origin"], feed.ORIGIN)
            return json.load(response)

    def test_auth_whitelist_and_restart(self):
        update = {"observedAt": stamp(), "healthy": True, "detections": [record()]}
        self.assertEqual(self.post(update, "wrong")[0], 401)
        self.assertIsNone(self.data()["updatedAt"])
        self.assertEqual(self.post(update)[0], 200)
        saved = self.data()
        self.assertEqual(set(saved["detections"][0]), {"commonName", "scientificName", "confidence", "detectedAt"})
        self.assertNotIn("private", json.dumps(saved))
        self.assertEqual(feed.Feed(self.path).data()["detections"], saved["detections"])
        with urlopen(self.url + "/events", timeout=2) as stream:
            self.assertEqual(stream.readline(), b"event: snapshot\n")
            self.assertIn(b"Calypte anna", stream.readline())

    def test_invalid_and_out_of_order_updates_do_not_erase_state(self):
        update = {"observedAt": stamp(-2), "healthy": True, "detections": [record()]}
        self.assertEqual(self.post(update)[0], 200)
        for changed in [dict(update, observedAt=stamp(-180)), dict(update, observedAt=stamp(-4)),
                        dict(update, healthy="yes"), dict(update, detections=[dict(record(), confidence=float('nan'))])]:
            self.assertEqual(self.post(changed)[0], 400)
        self.assertEqual(len(self.data()["detections"]), 1)
        self.assertEqual(self.post({"observedAt": stamp(), "healthy": False, "detections": None})[0], 200)
        self.assertFalse(self.data()["healthy"])
        self.assertEqual(len(self.data()["detections"]), 1)

    def test_low_confidence_and_old_records_are_omitted(self):
        rows = [record(), dict(record(), confidence=.5), dict(record(), detectedAt=stamp(-8*86400))]
        self.assertEqual(self.post({"observedAt": stamp(), "healthy": True, "detections": rows})[0], 200)
        self.assertEqual(len(self.data()["detections"]), 1)

    def test_publisher_checks_audio_and_inference(self):
        row = {"commonName": "Anna's Hummingbird", "scientificName": "Calypte anna", "confidence": .86,
               "timestamp": stamp(-30), "modelType": "bird", "verified": "unverified"}
        replies = [{"sources": [{"state": "HEALTHY", "last_dispatch": stamp()}]},
                   {"models": [{"health": {"state": "ok", "lastSuccessAtUnix": time.time()}}]},
                   {"data": [row, dict(row, verified="false_positive"), dict(row, modelType="mammal")]}]
        with patch.object(publish, 'fetch', side_effect=replies):
            result = publish.snapshot()
        self.assertTrue(result["healthy"])
        self.assertEqual(len(result["detections"]), 1)
        replies[0] = {"sources": [{"state": "HEALTHY", "last_dispatch": stamp(-300)}]}
        with patch.object(publish, 'fetch', side_effect=replies):
            self.assertFalse(publish.snapshot()["healthy"])


if __name__ == "__main__":
    unittest.main()
