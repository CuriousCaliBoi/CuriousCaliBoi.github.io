"""Tailnet-only safety gateway for the local Neuron Explorer.

The upstream server intentionally trusts localhost because it also exposes an
agent that can use a shell and local files.  This gateway is the only service
that should be published through Tailscale Serve.  It exposes the ordinary
explorer UI, allows only the UI's read/inference API, and never forwards the
agent or neuron-naming endpoints.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import re
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator
from urllib.parse import urlsplit

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles


ROOT = Path(__file__).resolve().parent
UPSTREAM = os.environ.get("NEURON_EXPLORER_UPSTREAM", "http://127.0.0.1:8796").rstrip("/")
STATIC_DIR = Path(
    os.environ.get(
        "NEURON_EXPLORER_STATIC_DIR",
        str(ROOT / "upstream" / "explorer" / "static"),
    )
).resolve()
ALLOWED_USERS = {
    value.strip().lower()
    for value in os.environ.get("NEURON_GATEWAY_ALLOWED_USERS", "").split(",")
    if value.strip()
}
MAX_BODY_BYTES = int(os.environ.get("NEURON_GATEWAY_MAX_BODY_BYTES", str(128 * 1024)))
MAX_TEXT_CHARS = int(os.environ.get("NEURON_GATEWAY_MAX_TEXT_CHARS", "6000"))
MAX_NEW_TOKENS = int(os.environ.get("NEURON_GATEWAY_MAX_NEW_TOKENS", "256"))
RATE_WINDOW_SECONDS = 60.0
RATE_LIMIT = int(os.environ.get("NEURON_GATEWAY_RATE_LIMIT", "240"))
GPU_RATE_LIMIT = int(os.environ.get("NEURON_GATEWAY_GPU_RATE_LIMIT", "30"))
GPU_WAIT_SECONDS = float(os.environ.get("NEURON_GATEWAY_GPU_WAIT_SECONDS", "15"))
FRONTEND_ORIGIN = "https://curiouscaliboi.github.io"


GET_ROUTES = {
    "/api/index",
    "/api/units",
    "/api/unit",
    "/api/embeddings",
    "/api/rollout",
    "/api/connections",
    "/api/hover",
    "/api/lens",
    "/api/lens/rjpp",
    "/api/search",
    "/api/fires",
    "/api/infer/view",
    "/api/infer/heads",
    "/api/head/row",
    "/api/neuron/heads",
    "/api/head/profile",
    "/api/head",
    "/api/infer/paths",
    "/api/layout",
    "/api/web",
    "/api/web/summary",
    "/api/exemplars",
    "/api/status",
}

POST_ROUTES = {
    "/api/reads",
    "/api/steer",
    "/api/infer",
    "/api/head/pattern",
}

# These routes run the model, use shared inference state, or may lazily build a
# model-derived cache.  Holding one lock prevents overlapping GPU work.
GPU_ROUTES = {
    "/api/reads",
    "/api/steer",
    "/api/fires",
    "/api/infer",
    "/api/infer/view",
    "/api/infer/heads",
    "/api/head/row",
    "/api/head/pattern",
    "/api/head/profile",
    "/api/exemplars",
    "/api/lens/rjpp",
}

PASS_RESPONSE_HEADERS = {
    "cache-control",
    "content-disposition",
    "content-encoding",
    "content-language",
    "content-length",
    "content-type",
    "etag",
    "last-modified",
    "x-active",
    "x-web-total",
}

TEXT_QUERY_KEYS = {"text"}
SHORT_QUERY_KEYS = {"q", "kind", "sign", "src"}
INT_MAXIMA = {
    "limit": 400,
    "top": 400,
    "k": 32,
    "lens": 16,
    "first": 32,
    "cap": 20_000,
    "hops": 8,
    "before": 64,
    "after": 64,
}

_client: httpx.AsyncClient | None = None
_gpu_lock = asyncio.Lock()
_rate_lock = asyncio.Lock()
_rate_events: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def _validate_upstream() -> None:
    parsed = urlsplit(UPSTREAM)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise RuntimeError("NEURON_EXPLORER_UPSTREAM must be a loopback HTTP URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise RuntimeError("NEURON_EXPLORER_UPSTREAM must not contain credentials, a query, or a fragment")


_validate_upstream()


def _importmap_csp_hash() -> str:
    """Allow only upstream's inline import map, without allowing inline scripts generally."""
    index_path = STATIC_DIR / "index.html"
    if not index_path.is_file():
        return "'none'"
    match = re.search(
        r'<script type="importmap">(.*?)</script>',
        index_path.read_text(encoding="utf-8"),
        re.DOTALL,
    )
    if match is None:
        return "'none'"
    digest = base64.b64encode(hashlib.sha256(match.group(1).encode("utf-8")).digest()).decode("ascii")
    return f"'sha256-{digest}'"


IMPORTMAP_CSP_HASH = _importmap_csp_hash()


def _upstream_host() -> str:
    parsed = urlsplit(UPSTREAM)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    return f"localhost:{port}"


def _security_headers(response):
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        f"script-src 'self' https://cdn.jsdelivr.net {IMPORTMAP_CSP_HASH}; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "media-src 'none'; object-src 'none'; base-uri 'none'; "
        "form-action 'self'; frame-ancestors https://curiouscaliboi.github.io"
    )
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Permissions-Policy"] = (
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()"
    )
    return response


def _identity(request: Request) -> str | None:
    login = request.headers.get("tailscale-user-login", "").strip().lower()
    return login if login and login in ALLOWED_USERS else None


def _browser_headers(request: Request, response):
    _security_headers(response)
    if request.url.path.startswith("/api/") and request.headers.get("origin") == FRONTEND_ORIGIN:
        response.headers["Access-Control-Allow-Origin"] = FRONTEND_ORIGIN
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Expose-Headers"] = "X-Active, X-Web-Total"
    return response


def _preflight(request: Request):
    if request.headers.get("origin") != FRONTEND_ORIGIN:
        raise HTTPException(status_code=403, detail="Request origin is not allowed.")
    method = request.headers.get("access-control-request-method", "")
    allowed_routes = GET_ROUTES if method == "GET" else POST_ROUTES if method == "POST" else set()
    if request.url.path not in allowed_routes:
        raise HTTPException(status_code=404, detail="API route is not available.")
    headers = {part.strip().lower() for part in request.headers.get("access-control-request-headers", "").split(",") if part.strip()}
    if headers - {"content-type"}:
        raise HTTPException(status_code=403, detail="Request headers are not allowed.")
    response = Response(status_code=204, headers={
        "Access-Control-Allow-Methods": method,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
    })
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


async def _check_rate(user: str, bucket: str, maximum: int) -> None:
    now = time.monotonic()
    key = (user, bucket)
    async with _rate_lock:
        events = _rate_events[key]
        cutoff = now - RATE_WINDOW_SECONDS
        while events and events[0] < cutoff:
            events.popleft()
        if len(events) >= maximum:
            raise HTTPException(status_code=429, detail="Too many requests; wait a moment and try again.")
        events.append(now)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    global _client
    if not STATIC_DIR.is_dir() or not (STATIC_DIR / "index.html").is_file():
        raise RuntimeError(f"Neuron Explorer static directory is missing: {STATIC_DIR}")
    _client = httpx.AsyncClient(
        timeout=httpx.Timeout(connect=5.0, read=None, write=15.0, pool=5.0),
        follow_redirects=False,
        limits=httpx.Limits(max_connections=8, max_keepalive_connections=4),
    )
    try:
        yield
    finally:
        await _client.aclose()
        _client = None


app = FastAPI(
    title="Neuron Explorer private gateway",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.middleware("http")
async def secure_request(request: Request, call_next):  # type: ignore[no-untyped-def]
    if request.url.path != "/healthz":
        if len(ALLOWED_USERS) != 1:
            return _browser_headers(request,
                JSONResponse({"detail": "Gateway requires exactly one allowed Tailscale identity."}, status_code=503)
            )
        if _identity(request) is None:
            return _browser_headers(request,
                JSONResponse({"detail": "This private explorer requires an allowed Tailscale identity."}, status_code=401)
            )
    try:
        if request.method == "OPTIONS" and request.url.path.startswith("/api/"):
            response = _preflight(request)
        else:
            response = await call_next(request)
    except HTTPException as exc:
        response = JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)
    return _browser_headers(request, response)


@app.get("/healthz")
async def healthz(request: Request):
    address = request.client.host if request.client else "unknown"
    await _check_rate(address, "health", 60)
    if _client is None:
        return JSONResponse({"status": "starting"}, status_code=503)
    try:
        response = await _client.get(
            f"{UPSTREAM}/api/status",
            headers={"Host": _upstream_host(), "Accept": "application/json"},
        )
        payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        ready = response.status_code == 200 and payload.get("status") == "ready"
        return JSONResponse(
            {
                "status": "ok" if ready else "degraded",
                "upstream": payload.get("status", "unavailable"),
                "identity_allowlist_configured": len(ALLOWED_USERS) == 1,
            },
            status_code=200 if ready else 503,
        )
    except (httpx.HTTPError, ValueError):
        return JSONResponse(
            {
                "status": "degraded",
                "upstream": "unreachable",
                "identity_allowlist_configured": len(ALLOWED_USERS) == 1,
            },
            status_code=503,
        )


def _safe_index() -> str:
    html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    additions = (
        '<link rel="stylesheet" href="/safe-mode.css?v=2">\n'
        '<script src="/safe-mode.js?v=2"></script>\n'
    )
    if "</head>" not in html:
        raise RuntimeError("Upstream explorer index has no closing head tag")
    html = html.replace("</head>", additions + "</head>", 1)
    return html.replace("<title>Neuron Explorer</title>", "<title>Neuron Explorer · Private Spark</title>", 1)


@app.get("/", response_class=HTMLResponse)
@app.get("/index.html", response_class=HTMLResponse)
async def index():
    return HTMLResponse(_safe_index(), headers={"Cache-Control": "private, no-store"})


@app.get("/safe-mode.css")
async def safe_mode_css():
    return FileResponse(ROOT / "safe-mode.css", media_type="text/css", headers={"Cache-Control": "private, max-age=300"})


@app.get("/safe-mode.js")
async def safe_mode_js():
    return FileResponse(ROOT / "safe-mode.js", media_type="text/javascript", headers={"Cache-Control": "private, max-age=300"})


def _bounded_int(value: str, *, minimum: int, maximum: int, name: str) -> str:
    try:
        number = int(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid {name} value.") from exc
    return str(max(minimum, min(maximum, number)))


def _sanitized_query(request: Request, route: str) -> list[tuple[str, str]]:
    if len(request.url.query) > 16_384:
        raise HTTPException(status_code=414, detail="Query is too long.")
    out: list[tuple[str, str]] = []
    for key, raw in request.query_params.multi_items():
        if len(key) > 64:
            raise HTTPException(status_code=422, detail="Invalid query parameter.")
        value = raw
        if key in TEXT_QUERY_KEYS:
            limit = min(MAX_TEXT_CHARS, 1500) if route == "/api/fires" else MAX_TEXT_CHARS
            value = value[:limit]
        elif key in SHORT_QUERY_KEYS:
            value = value[:256]
        elif key in INT_MAXIMA:
            value = _bounded_int(value, minimum=0, maximum=INT_MAXIMA[key], name=key)
        elif key == "layer":
            value = _bounded_int(value, minimum=0, maximum=31, name=key)
        elif key == "n":
            value = _bounded_int(value, minimum=0, maximum=9215, name=key)
        elif key == "head":
            value = _bounded_int(value, minimum=0, maximum=63, name=key)
        elif key == "pos":
            value = _bounded_int(value, minimum=-1, maximum=1023, name=key)
        elif len(value) > 1024:
            value = value[:1024]
        out.append((key, value))
    return out


def _as_int(value, name: str, minimum: int, maximum: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid {name} value.") from exc
    if number < minimum or number > maximum:
        raise HTTPException(status_code=422, detail=f"{name} is outside the supported range.")
    return number


def _text(value, *, limit: int = MAX_TEXT_CHARS) -> str:
    if not isinstance(value, str):
        raise HTTPException(status_code=422, detail="Text fields must be strings.")
    return value[:limit]


def _sanitize_json(route: str, body: bytes) -> bytes:
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Request body is too large.")
    try:
        incoming = json.loads(body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON.") from exc
    if not isinstance(incoming, dict):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object.")

    if route == "/api/infer":
        clean = {"text": _text(incoming.get("text", "")), "chat": bool(incoming.get("chat", False))}
    elif route == "/api/reads":
        clean = {
            "layer": _as_int(incoming.get("layer"), "layer", 0, 31),
            "n": _as_int(incoming.get("n"), "n", 0, 9215),
            "text": _text(incoming.get("text", ""), limit=min(MAX_TEXT_CHARS, 2000)),
            "chat": bool(incoming.get("chat", True)),
        }
    elif route == "/api/head/pattern":
        clean = {
            "layer": _as_int(incoming.get("layer"), "layer", 0, 31),
            "head": _as_int(incoming.get("head"), "head", 0, 63),
            "text": _text(incoming.get("text", "")),
            "chat": bool(incoming.get("chat", False)),
        }
    elif route == "/api/steer":
        history = incoming.get("history", [])
        if not isinstance(history, list):
            raise HTTPException(status_code=422, detail="History must be a list.")
        safe_history = []
        for turn in history[-12:]:
            if not isinstance(turn, dict) or not isinstance(turn.get("replies"), list):
                raise HTTPException(status_code=422, detail="Invalid chat history.")
            replies = [_text(reply, limit=4000) for reply in turn["replies"][:3]]
            if len(replies) != 3:
                raise HTTPException(status_code=422, detail="Each chat turn needs three replies.")
            safe_history.append({"user": _text(turn.get("user", ""), limit=4000), "replies": replies})
        try:
            dose = float(incoming.get("dose", 0.8))
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=422, detail="Invalid steering dose.") from exc
        clean = {
            "layer": _as_int(incoming.get("layer"), "layer", 0, 31),
            "n": _as_int(incoming.get("n"), "n", 0, 9215),
            "prompt": _text(incoming.get("prompt", ""), limit=4000),
            "history": safe_history,
            "dose": max(-10.0, min(10.0, dose)),
            "mode": "mul" if incoming.get("mode") == "mul" else "add",
            "max_new": min(
                MAX_NEW_TOKENS,
                _as_int(incoming.get("max_new", MAX_NEW_TOKENS), "max_new", 1, 4096),
            ),
        }
    else:
        raise HTTPException(status_code=404, detail="API route is not available.")
    return json.dumps(clean, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


async def _read_limited_body(request: Request) -> bytes:
    """Stop reading as soon as a chunk would cross the configured body limit."""
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > MAX_BODY_BYTES:
            raise HTTPException(status_code=413, detail="Request body is too large.")
        chunks.append(chunk)
    return b"".join(chunks)


async def _acquire_gpu() -> bool:
    try:
        await asyncio.wait_for(_gpu_lock.acquire(), timeout=GPU_WAIT_SECONDS)
        return True
    except TimeoutError:
        return False


@app.api_route("/api/{api_path:path}", methods=["GET", "POST"])
async def api_proxy(api_path: str, request: Request):
    route = f"/api/{api_path}"
    if route.startswith("/api/agent/") or route == "/api/name":
        raise HTTPException(status_code=404, detail="API route is not available.")
    if request.method == "GET" and route not in GET_ROUTES:
        raise HTTPException(status_code=404, detail="API route is not available.")
    if request.method == "POST" and route not in POST_ROUTES:
        raise HTTPException(status_code=404, detail="API route is not available.")

    origin = request.headers.get("origin")
    trusted_frontend = origin == FRONTEND_ORIGIN
    fetch_site = request.headers.get("sec-fetch-site")
    if fetch_site and fetch_site != "same-origin" and not trusted_frontend:
        raise HTTPException(status_code=403, detail="Cross-site API requests are not allowed.")
    if origin and not trusted_frontend:
        parsed_origin = urlsplit(origin)
        if parsed_origin.scheme not in {"http", "https"} or parsed_origin.netloc.lower() != request.headers.get("host", "").lower():
            raise HTTPException(status_code=403, detail="Request origin does not match this gateway.")

    user = _identity(request)
    if user is None:  # The middleware normally catches this; keep the proxy fail-closed on direct tests.
        raise HTTPException(status_code=401, detail="Tailscale identity is required.")
    await _check_rate(user, "all", RATE_LIMIT)
    is_gpu = route in GPU_ROUTES
    if is_gpu:
        await _check_rate(user, "gpu", GPU_RATE_LIMIT)

    query = _sanitized_query(request, route)
    body = b""
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_BODY_BYTES:
                    raise HTTPException(status_code=413, detail="Request body is too large.")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid Content-Length header.") from exc
        body = _sanitize_json(route, await _read_limited_body(request))

    gpu_held = False
    if is_gpu:
        gpu_held = await _acquire_gpu()
        if not gpu_held:
            raise HTTPException(status_code=429, detail="The model is busy; try again shortly.")

    if _client is None:
        if gpu_held:
            _gpu_lock.release()
        raise HTTPException(status_code=503, detail="Gateway is starting.")

    headers = {"Host": _upstream_host(), "Accept": request.headers.get("accept", "*/*")}
    if request.method == "POST":
        headers["Content-Type"] = "application/json"

    try:
        upstream_request = _client.build_request(
            request.method,
            f"{UPSTREAM}{route}",
            params=query,
            content=body,
            headers=headers,
        )
        upstream = await _client.send(upstream_request, stream=True)
    except httpx.HTTPError as exc:
        if gpu_held:
            _gpu_lock.release()
        raise HTTPException(status_code=502, detail="Neuron Explorer backend is unavailable.") from exc

    response_headers = {
        key: value for key, value in upstream.headers.items() if key.lower() in PASS_RESPONSE_HEADERS
    }
    response_headers["Cache-Control"] = "private, no-store"
    if upstream.headers.get("content-type", "").startswith("text/event-stream"):
        response_headers["X-Accel-Buffering"] = "no"

    async def stream_body():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()
            if gpu_held and _gpu_lock.locked():
                _gpu_lock.release()

    return StreamingResponse(
        stream_body(),
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=None,
    )


# StaticFiles is last so explicit safety and API routes always win.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=False), name="explorer-static")


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.environ.get("NEURON_GATEWAY_HOST", "127.0.0.1"),
        port=int(os.environ.get("NEURON_GATEWAY_PORT", "8794")),
        proxy_headers=False,
        server_header=False,
        access_log=False,
    )
