# Listening garden

The public page is `/birds/` on the existing GitHub Pages site. Its data travels
from BirdNET-Go on the Pi, through a small HTTPS feed on the Spark, to the browser.
The Mac is only used for installation. The Spark does not run bird inference.

## Runtime

- The Pi publisher reads BirdNET-Go's local API every 15 seconds. It checks both
  microphone dispatch and model inference before reporting healthy listening.
- Only detection IDs, species names, confidence, detection times, and review status
  leave the Pi. Audio clips, device details, and coordinates are not published.
- The live view uses the latest 100 detections, filtered to birds with at least
  75% confidence and at most seven days old. Records marked as false positives
  are excluded from every public view.
- A SQLite archive keeps bird detections without an age cutoff, including
  tentative identifications. Daily notes and the searchable all-time collection
  default to 75% confidence; visitors can include tentative matches.
- The publisher backfills all available Pi history at startup and once per 24
  hours. Every five minutes it also reconciles from the previous successful sync's
  calendar day minus one. Live heartbeats archive the latest records immediately.
  Retries are idempotent by BirdNET detection ID. Reviews are updated when their
  records are synchronized. Records pruned from the Pi remain in the archive.
- Day boundaries and hourly summaries use America/Los_Angeles, including DST.
  Counts represent detection records, not individual birds or distinct calls.
  Record pagination uses a time-and-ID cursor so newer arrivals do not shift pages.
- The Spark authenticates writes, validates input, saves snapshots atomically,
  and sends snapshots over server-sent events. Public routes are read-only.
- The browser also refreshes every 30 seconds as a fallback. A station heartbeat
  older than 90 seconds is offline. An empty detection list is not an error.
- The illustration is the previously generated H3 hummingbird portrait. It is
  labeled separately from the actual field notes.

## Spark installation

Sources: `feed.py` and `archive.py` to `~/.local/share/bird-feed/`.
Unit: `bird-feed.service` to `~/.config/systemd/user/`.
Secret: random token in `~/.config/bird-feed/token`, mode 0600, never in Git.
State: `~/.local/share/bird-feed/state.json`.
History: `~/.local/share/bird-feed/state.sqlite3` (SQLite WAL enabled).
Back up the SQLite database with SQLite's backup API, not by copying an active
database file without its WAL.

```sh
systemctl --user daemon-reload
systemctl --user enable --now bird-feed.service
tailscale funnel --bg --https=443 --set-path=/birds-live http://127.0.0.1:8795
```

The existing Funnel hostname is `spark-a4b4.tailef40b0.ts.net`. Existing public
routes and private ports must be preserved. Use `funnel`, not `serve`, when
adding this route, because `serve` changes port 443 to tailnet-only access.

## Pi installation

Source: `publish.py` to `/home/zko/.local/share/bird-publish/publish.py`.
Unit: `bird-publish.service` to `/etc/systemd/system/`.
Secret: the same token, transferred over SSH to
`/home/zko/.config/bird-publish/token`, mode 0600.

Create `/home/zko/.config/bird-publish/config.json` with:

```json
{
  "endpoint": "https://spark-a4b4.tailef40b0.ts.net/birds-live/ingest",
  "tokenFile": "/home/zko/.config/bird-publish/token"
}
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now bird-publish.service
sudo systemctl status bird-publish.service
```

The API schema is based on BirdNET-Go release `20261031`. Validate it on the
device after upgrading BirdNET-Go. The publisher retries failed requests and
the service starts again at boot. The Spark user's lingering service is enabled.

## Verification

```sh
python3 -m unittest discover -s _birdstation -v
node --check birds/garden.js
bundle exec jekyll build
```

Check `/birds-live/state` and `/birds-live/events` on the public hostname.
The archive routes are `/birds-live/archive`, `/archive/day?date=YYYY-MM-DD`,
`/archive/species?species=SCIENTIFIC_NAME`, and `/archive/records`. All routes are
under `/birds-live`. Each supports `min=0.75` (default) or `min=0` for tentative
matches; records also supports `date`, `species`, and the returned `before` cursor.
Writes to `/archive/ingest` and `/archive/complete` require the station token.
Test data belongs only in a local test server. Never send synthetic detections to
the public feed. Confirm live heartbeats and real detections from the Pi before
reporting that the full connection is operating.

To disable the publisher: `sudo systemctl disable --now bird-publish.service`.
To disable the feed: `systemctl --user disable --now bird-feed.service`.
