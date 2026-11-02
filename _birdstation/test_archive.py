import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from archive import Archive
import publish


def record(identity=1, stamp="2026-11-01T08:58:50-08:00", confidence=.86, name="Calypte anna", verified="unverified"):
    return {"id": identity, "commonName": "Anna's Hummingbird", "scientificName": name,
            "confidence": confidence, "detectedAt": stamp, "verified": verified,
            "source": "private microphone", "clipName": "private audio"}


class ArchiveTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "history.sqlite3"
        self.archive = Archive(self.path)

    def tearDown(self):
        self.archive.close()
        self.temp.cleanup()

    def test_history_is_durable_idempotent_and_keeps_old_and_tentative_records(self):
        rows = [record(1, "2026-01-01T09:00:00-08:00"), record(2, confidence=.4)]
        self.assertEqual(self.archive.upsert(rows), 2)
        revision = self.archive.revision()
        self.assertEqual(self.archive.upsert(rows), 0)
        self.assertEqual(self.archive.revision(), revision)
        self.archive.close()
        self.archive = Archive(self.path)
        self.assertEqual(self.archive.summary(0)["totalDetections"], 2)
        self.assertEqual(self.archive.summary(.75)["shownDetections"], 1)
        self.assertEqual(self.archive.day("2026-01-01", .75)["count"], 1)
        self.assertNotIn("source", self.archive.records(0)["records"][0])

    def test_pacific_days_and_repeated_dst_hour(self):
        rows = [record(1, "2026-11-01T08:30:00+00:00"), record(2, "2026-11-01T09:30:00+00:00"),
                record(3, "2026-11-02T07:30:00+00:00"), record(4, "2026-11-02T08:30:00+00:00")]
        self.archive.upsert(rows)
        day = self.archive.day("2026-11-01", .75)
        self.assertEqual(day["count"], 3)
        self.assertEqual(day["hours"][1], 2)
        self.assertEqual(day["hours"][23], 1)
        self.assertTrue(day["species"][0]["newSpecies"])
        next_day = self.archive.day("2026-11-02", .75)
        self.assertEqual(next_day["count"], 1)
        self.assertFalse(next_day["species"][0]["newSpecies"])

    def test_review_corrections_remove_false_positives_from_every_view(self):
        self.archive.upsert([record(), record(2, name="Poecile rufescens", confidence=.4)])
        self.archive.upsert([record(verified="false_positive")])
        self.assertEqual(self.archive.summary(.75)["shownSpecies"], 0)
        self.assertEqual(self.archive.day("2026-11-01", .75)["count"], 0)
        self.assertEqual(self.archive.records(0)["total"], 1)
        self.assertIsNone(self.archive.species("Calypte anna", 0)["species"])
        self.archive.upsert([record(confidence=.99, verified="correct")])
        self.assertEqual(self.archive.species("Calypte anna", .75)["species"]["confirmedCount"], 1)

    def test_cursor_paging_preserves_records_when_new_rows_arrive(self):
        self.archive.upsert([record(i) for i in range(1, 76)])
        first = self.archive.records(.75)
        self.archive.upsert([record(76, "2026-11-02T08:00:00-08:00")])
        second = self.archive.records(.75, before=first["next"])
        ids = [r["id"] for r in first["records"] + second["records"]]
        self.assertEqual(len(ids), 75)
        self.assertEqual(len(set(ids)), 75)
        self.assertIsNone(second["next"])

    def test_invalid_batch_is_atomic_and_queries_are_bounded(self):
        with self.assertRaises(ValueError):
            self.archive.upsert([record(), record(2, confidence=float('nan'))])
        self.assertEqual(self.archive.summary(0)["totalDetections"], 0)
        with self.assertRaises(ValueError):
            self.archive.day("bad-date", .75)
        with self.assertRaises(ValueError):
            self.archive.summary(float('nan'))
        with self.assertRaises(ValueError):
            self.archive.records(.75, before="nan:1")
        self.assertEqual(self.archive.species("' OR 1=1 --", .75)["days"], [])

    def test_backfill_advances_by_source_rows_and_marks_only_success_complete(self):
        bird = dict(record(), timestamp=record()["detectedAt"], modelType="bird")
        other = dict(bird, id=2, modelType="mammal")
        pages = [{"total": 3, "data": [bird, other]}, {"total": 4, "data": [dict(bird, id=3)]}]
        sent = []
        with patch.object(publish, "fetch", side_effect=pages) as fetch:
            self.assertEqual(publish.sync_history(lambda path, data: sent.append((path, data))), 3)
        self.assertIn("offset=2", fetch.call_args_list[1].args[0])
        self.assertEqual([r["id"] for _, data in sent for r in data.get("records", [])], [1, 3])
        self.assertEqual(sent[-1][0], "/archive/complete")
        with patch.object(publish, "fetch", side_effect=[pages[0], OSError("offline")]):
            sent = []
            with self.assertRaises(OSError):
                publish.sync_history(lambda path, data: sent.append((path, data)))
        self.assertNotIn("/archive/complete", [path for path, _ in sent])


if __name__ == "__main__":
    unittest.main()
