# Neuron Explorer gateway

The static frontend lives at `/neurons/`. This directory is excluded from
Jekyll publication and contains the private Spark gateway, not the model
server. The existing upstream Neuron Explorer installation stays unchanged.

The gateway permits `https://curiouscaliboi.github.io` to use its allowlisted
API routes. Preflight and actual requests both require the one configured
Tailscale identity. Other browser origins, agent routes, file uploads, and
neuron naming remain blocked. Existing request limits and serialization of
model calls apply to requests from the website too. CORS does not make the
gateway public: it remains behind Tailscale Serve on port 8448.

For a new installation, place `gateway.py` and `neurons/safe-mode.{js,css}`
in the gateway directory. Run it using the upstream Python environment,
which supplies FastAPI, HTTPX, and Uvicorn, with these environment variables:

```
NEURON_EXPLORER_UPSTREAM=http://127.0.0.1:8796
NEURON_EXPLORER_STATIC_DIR=/path/to/neuron-explorer/explorer/static
NEURON_GATEWAY_ALLOWED_USERS=your-tailscale-login@example.com
NEURON_GATEWAY_HOST=127.0.0.1
NEURON_GATEWAY_PORT=8794
```

Expose only the gateway using private Tailscale Serve, with its injected
identity headers. Never expose the upstream localhost server. Updating this
gateway requires restarting only `neuron-explorer-gateway.service`, not the
model service. Preserve a copy of the installed gateway for rollback.

Run tests from this directory using the upstream Python environment:

```
python -m unittest -v
```

Tests use a mock upstream and cover the allowed website, identity checks,
cross-origin preflight, private-network headers, binary-response metadata,
blocked routes, unsupported headers/methods, and request size limits. Live
browser verification also checks the map, a neuron, both activation poles,
and a short inference request.
