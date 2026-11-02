# Listening garden

The public page is `/birds/` on the existing GitHub Pages site. Its data travels
from BirdNET-Go on the Pi, through a small HTTPS feed on the Spark, to the browser.
The Mac is only used for installation. The Spark does not run bird inference.

## Runtime

- The Pi publisher reads BirdNET-Go's local API every 15 seconds. It checks both
  microphone dispatch and model inference before reporting healthy listening.
- Only species names, confidence, and detection times leave the Pi. Audio clips,
  device details, and coordinates are not published.
- The latest 100 detections are filtered to birds with at least 75% confidence,
  excluding records marked as false positives. The feed retains at most seven days.
- The Spark authenticates writes, validates input, saves snapshots atomically,
  and sends snapshots over server-sent events. Public routes are read-only.
- The browser also refreshes every 30 seconds as a fallback. A station heartbeat
  older than 90 seconds is offline. An empty detection list is not an error.
- The illustration is the previously generated H3 hummingbird portrait. It is
  labeled separately from the actual field notes.

## Spark installation

Source: `feed.py` to `~/.local/share/bird-feed/feed.py`.
Unit: `bird-feed.service` to `~/.config/systemd/user/`.
Secret: random token in `~/.config/bird-feed/token`, mode 0600, never in Git.
State: `~/.local/share/bird-feed/state.json`.

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
Test data belongs only in a local test server. Never send synthetic detections to
the public feed. Confirm live heartbeats and real detections from the Pi before
reporting that the full connection is operating.

To disable the publisher: `sudo systemctl disable --now bird-publish.service`.
To disable the feed: `systemctl --user disable --now bird-feed.service`.
