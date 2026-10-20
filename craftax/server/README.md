# Craftax browser bridge

The public `/craftax/` page controls the original Craftax-Classic 1.6.1 engine on the owner's machine. It is human play, with no learned policy. The page's `live.json` selects the HTTPS API. The deployed API uses a private Tailscale Serve endpoint; it is not exposed through Funnel.

## Run

Use Python 3.12 and install `requirements.lock` into an isolated environment. Run:

```sh
JAX_PLATFORMS=cpu python -m uvicorn app:app --host 127.0.0.1 --port 8897 --no-access-log
```

The first start compiles reset, step, and rendering before accepting players. CPU execution leaves the GPU available for training. Configure `CRAFTAX_ORIGINS` as a comma-separated list of exact allowed frontend origins. The defaults support the production website and local preview at port 8895.

Use a persistent service and a private HTTPS reverse proxy. Keep the loopback binding. Do not change `live.json` to a publicly exposed backend without revisiting access controls and resource limits. The backend source is excluded from the Jekyll build.

## Session behavior

- The browser receives an unpredictable bearer token for its own session and keeps it in sessionStorage, never in a URL or the public configuration.
- Every player has a separate state and random-number stream. A repeated seed reproduces the initial world in this pinned version.
- At most eight sessions are retained. Idle sessions expire after an hour. Sessions and recordings live in memory and disappear on service restart.
- Each run stops at death or 5,000 steps. Reset replaces its recording. The UI asks before discarding a nonempty run.
- Actions are validated, paced, and serialized. `expected_step` rejects stale/duplicate submissions. Origins, request size, new-session frequency, and action frequency are bounded.
- The world only advances on input, with automatic no-op actions while sleeping. Pausing or leaving the tab stops automatic input; one already submitted action may finish.

## Recordings

The download includes the seed, environment version, initial frame, and each action's resulting frame, reward, terminal flag, visible player statistics, inventory, and achievements. Frames are lossless 144×144 PNG images encoded as base64, produced by Craftax's native 16-pixel tile renderer. Each action transitions from the preceding frame to its recorded resulting frame.

These are gameplay trajectories for later learning experiments, not full simulator checkpoints. They omit the hidden map and internal simulator state. The game uses the same native Craftax-Classic rules as Stable World Model's wrapper; the browser bridge avoids importing a training framework into the play service.

## Controls

WASD/arrows move. Space interacts with the tile in front. Q waits, Z sleeps, T places a table, F places a furnace, R places stone, and P plants. Keys 1–3 craft wood/stone/iron pickaxes; 4–6 craft matching swords. Escape pauses. All actions also have clickable/touch buttons.

## Credits

[Craftax](https://github.com/MichaelTMatthews/Craftax) by Michael Matthews and collaborators, based on [Crafter](https://github.com/danijar/crafter) by Danijar Hafner. The preview is a frame rendered by the original game, not a separately implemented imitation.
