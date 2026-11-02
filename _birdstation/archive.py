import math
import sqlite3
import threading
import time
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")


def clean_records(records):
    if not isinstance(records, list) or len(records) > 500:
        raise ValueError("Invalid archive batch")
    clean = []
    for row in records:
        identity = row["id"]
        confidence = row["confidence"]
        if type(identity) is not int or not 0 < identity < 2**63:
            raise ValueError("Invalid detection ID")
        if type(confidence) not in (int, float) or not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise ValueError("Invalid confidence")
        names = (row["commonName"], row["scientificName"])
        if not all(isinstance(name, str) and 0 < len(name) <= 120 for name in names):
            raise ValueError("Invalid species")
        verified = row["verified"]
        if verified not in ("unverified", "correct", "false_positive"):
            raise ValueError("Invalid verification status")
        moment = datetime.fromisoformat(row["detectedAt"].replace("Z", "+00:00"))
        if moment.tzinfo is None or moment.timestamp() > time.time() + 120:
            raise ValueError("Invalid detection time")
        local = moment.astimezone(PACIFIC)
        clean.append((identity, *names, confidence, moment.astimezone(timezone.utc).isoformat(),
                      moment.timestamp(), local.date().isoformat(), local.hour, verified))
    return clean


class Archive:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS detections (
                id INTEGER PRIMARY KEY, commonName TEXT NOT NULL, scientificName TEXT NOT NULL,
                confidence REAL NOT NULL, detectedAt TEXT NOT NULL, occurred REAL NOT NULL,
                day TEXT NOT NULL, hour INTEGER NOT NULL, verified TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS by_day ON detections(day, confidence);
            CREATE INDEX IF NOT EXISTS by_species ON detections(scientificName, occurred);
            CREATE INDEX IF NOT EXISTS by_time ON detections(occurred DESC, id DESC);
            CREATE TABLE IF NOT EXISTS metadata (
                singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL,
                updatedAt TEXT, lastFullSyncAt TEXT
            );
            INSERT OR IGNORE INTO metadata(singleton, revision) VALUES(1, 0);
        """)

    def close(self):
        self.db.close()

    def upsert(self, records):
        rows = clean_records(records)
        with self.lock, self.db:
            before = self.db.total_changes
            self.db.executemany("""
                INSERT INTO detections VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    commonName=excluded.commonName, scientificName=excluded.scientificName,
                    confidence=excluded.confidence, detectedAt=excluded.detectedAt,
                    occurred=excluded.occurred, day=excluded.day, hour=excluded.hour, verified=excluded.verified
                WHERE (commonName,scientificName,confidence,detectedAt,verified) !=
                    (excluded.commonName,excluded.scientificName,excluded.confidence,excluded.detectedAt,excluded.verified)
            """, rows)
            changed = self.db.total_changes - before
            if changed:
                self.db.execute("UPDATE metadata SET revision=revision+1, updatedAt=? WHERE singleton=1",
                                (datetime.now(timezone.utc).isoformat(),))
            return changed

    def complete(self):
        with self.lock, self.db:
            self.db.execute("UPDATE metadata SET lastFullSyncAt=? WHERE singleton=1",
                            (datetime.now(timezone.utc).isoformat(),))

    def revision(self):
        with self.lock:
            return self.db.execute("SELECT revision FROM metadata").fetchone()[0]

    def where(self, minimum, day=None, species=None):
        if not math.isfinite(minimum) or not 0 <= minimum <= 1:
            raise ValueError("Invalid confidence filter")
        clause = "confidence>=? AND verified!='false_positive'"
        args = [minimum]
        if day is not None:
            if date.fromisoformat(day).isoformat() != day:
                raise ValueError("Invalid date")
            clause += " AND day=?"
            args.append(day)
        if species is not None:
            if not 0 < len(species) <= 120:
                raise ValueError("Invalid species")
            clause += " AND scientificName=?"
            args.append(species)
        return clause, args

    def groups(self, clause, args):
        return [dict(row) for row in self.db.execute(f"""
            SELECT scientificName, MAX(commonName) commonName, COUNT(*) count,
                   MIN(detectedAt) firstHeard, MAX(detectedAt) lastHeard,
                   COUNT(DISTINCT day) daysHeard, MAX(confidence) bestConfidence,
                   SUM(verified='correct') confirmedCount
            FROM detections WHERE {clause} GROUP BY scientificName ORDER BY MIN(occurred), scientificName
        """, args)]

    def summary(self, minimum):
        clause, args = self.where(minimum)
        with self.lock:
            meta = dict(self.db.execute("SELECT revision,updatedAt,lastFullSyncAt FROM metadata").fetchone())
            all_stats = self.db.execute("""SELECT COUNT(*) totalDetections, COUNT(DISTINCT scientificName) totalSpecies
                FROM detections WHERE verified!='false_positive'""").fetchone()
            species = self.groups(clause, args)
            days = [dict(row) for row in self.db.execute("""
                SELECT day date, COUNT(*) allCount, SUM(confidence>=?) count,
                       COUNT(DISTINCT CASE WHEN confidence>=? THEN scientificName END) speciesCount
                FROM detections WHERE verified!='false_positive' GROUP BY day ORDER BY day DESC
            """, (minimum, minimum))]
            return dict(meta, **dict(all_stats), minimum=minimum, days=days, species=species,
                        shownDetections=sum(row["count"] for row in days), shownSpecies=len(species))

    def day(self, day, minimum):
        clause, args = self.where(minimum, day=day)
        with self.lock:
            birds = self.groups(clause, args)
            hours = [0] * 24
            by_species = {bird["scientificName"]: [0] * 24 for bird in birds}
            for row in self.db.execute(f"""SELECT scientificName,hour,COUNT(*) count
                    FROM detections WHERE {clause} GROUP BY scientificName,hour""", args):
                hours[row["hour"]] += row["count"]
                by_species[row["scientificName"]][row["hour"]] = row["count"]
            all_count = self.db.execute("SELECT COUNT(*) FROM detections WHERE day=? AND verified!='false_positive'", (day,)).fetchone()[0]
            first_days = {row["scientificName"]: row["firstDay"] for row in self.db.execute(
                "SELECT scientificName,MIN(day) firstDay FROM detections WHERE confidence>=? AND verified!='false_positive' GROUP BY scientificName", (minimum,))}
            for bird in birds:
                bird["newSpecies"] = first_days[bird["scientificName"]] == day
                bird["hours"] = by_species[bird["scientificName"]]
            return {"date": day, "count": sum(hours), "allCount": all_count,
                    "speciesCount": len(birds), "hours": hours, "species": birds}

    def species(self, name, minimum):
        clause, args = self.where(minimum, species=name)
        with self.lock:
            groups = self.groups(clause, args)
            days = [dict(row) for row in self.db.execute(f"""
                SELECT day date, COUNT(*) count, MAX(confidence) bestConfidence,
                       MIN(detectedAt) firstHeard, MAX(detectedAt) lastHeard
                FROM detections WHERE {clause} GROUP BY day ORDER BY day DESC
            """, args)]
            return {"species": groups[0] if groups else None, "days": days}

    def records(self, minimum, day=None, species=None, before=None):
        clause, args = self.where(minimum, day=day, species=species)
        with self.lock:
            total = self.db.execute(f"SELECT COUNT(*) FROM detections WHERE {clause}", args).fetchone()[0]
            if before:
                when, identity = before.split(":", 1)
                when, identity = float(when), int(identity)
                if not math.isfinite(when) or not 0 < identity < 2**63:
                    raise ValueError("Invalid record cursor")
                clause += " AND (occurred<? OR (occurred=? AND id<?))"
                args.extend((when, when, identity))
            rows = self.db.execute(f"SELECT * FROM detections WHERE {clause} ORDER BY occurred DESC,id DESC LIMIT 51", args).fetchall()
            more = len(rows) > 50
            rows = rows[:50]
            fields = ("id", "commonName", "scientificName", "confidence", "detectedAt", "verified")
            return {"total": total, "records": [{key: row[key] for key in fields} for row in rows],
                    "next": f'{rows[-1]["occurred"]}:{rows[-1]["id"]}' if more else None}
