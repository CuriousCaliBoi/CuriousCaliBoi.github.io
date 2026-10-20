"""Small, session-isolated browser bridge to the original Craftax-Classic game."""
import os
os.environ.setdefault("JAX_PLATFORMS", "cpu")
os.environ.setdefault("XLA_PYTHON_CLIENT_PREALLOCATE", "false")

import base64
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, fields
from datetime import datetime, timezone
from io import BytesIO
import secrets
import threading
import time

import jax
import numpy as np
from PIL import Image
from craftax.craftax_classic.constants import Action, Achievement
from craftax.craftax_classic.renderer import make_craftax_pixel_renderer
from craftax.craftax_env import make_craftax_env_from_name
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ConfigDict

MAX_SESSIONS = 8
MAX_STEPS = 5000
IDLE_SECONDS = 3600
LOCK = threading.RLock()
SESSIONS = {}
CREATIONS = {}
ENGINE = None


class Engine:
    def __init__(self):
        self.env = make_craftax_env_from_name("Craftax-Classic-Symbolic-v1", auto_reset=False)
        self.params = self.env.default_params.replace(max_timesteps=MAX_STEPS)
        self.reset = jax.jit(self.env.reset)
        self.step = jax.jit(self.env.step)
        self.render = jax.jit(make_craftax_pixel_renderer(16))

    def start(self, seed):
        key, reset_key = jax.random.split(jax.random.PRNGKey(seed))
        _, state = self.reset(reset_key, self.params)
        return key, state

    def advance(self, key, state, action):
        key, step_key = jax.random.split(key)
        _, state, reward, done, _ = self.step(step_key, state, np.int32(action), self.params)
        return key, state, float(reward), bool(done)


def snapshot(state):
    return {
        "step": int(state.timestep),
        "health": int(state.player_health), "food": int(state.player_food),
        "drink": int(state.player_drink), "energy": int(state.player_energy),
        "sleeping": bool(state.is_sleeping), "light": float(state.light_level),
        "inventory": {f.name: int(getattr(state.inventory, f.name)) for f in fields(state.inventory)},
        "achievements": [a.name.lower() for a in Achievement if bool(state.achievements[a.value])],
    }


def picture(state):
    pixels = np.asarray(ENGINE.render(state)).clip(0, 255).astype(np.uint8)
    output = BytesIO()
    Image.fromarray(pixels).save(output, format="PNG", compress_level=1)
    return base64.b64encode(output.getvalue()).decode("ascii")


@dataclass
class Session:
    seed: int
    key: object = None
    state: object = None
    done: bool = False
    reward: float = 0.0
    touched: float = field(default_factory=time.monotonic)
    last_action: float = 0.0
    history: list = field(default_factory=list)
    initial: dict = field(default_factory=dict)
    latest: dict = field(default_factory=dict)
    started_at: str = ""

    def reset(self, seed):
        self.seed = seed
        self.key, self.state = ENGINE.start(seed)
        self.done = False
        self.reward = 0.0
        self.history = []
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.touched = time.monotonic()
        self.latest = self.view()
        self.initial = self.latest.copy()
        return self.latest

    def view(self):
        return {**snapshot(self.state), "seed": self.seed, "done": self.done,
                "reward": self.reward, "image": picture(self.state), "max_steps": MAX_STEPS}


class NewGame(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    seed: int | None = Field(default=None, ge=0, le=2147483647)


class Move(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    action: int = Field(ge=0, le=16)
    expected_step: int = Field(ge=0, le=MAX_STEPS)


@asynccontextmanager
async def lifespan(app):
    global ENGINE
    ENGINE = Engine()
    key, state = ENGINE.start(23)
    key, state, _, _ = ENGINE.advance(key, state, 0)
    picture(state)  # Compile before accepting players.
    yield
    SESSIONS.clear()


app = FastAPI(title="Craftax Play", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
ALLOWED_ORIGINS = os.environ.get("CRAFTAX_ORIGINS", "https://curiouscaliboi.github.io,http://127.0.0.1:8895").split(",")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS,
                   allow_methods=["GET", "POST", "DELETE"], allow_headers=["Authorization", "Content-Type"])


@app.middleware("http")
async def protect(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin not in ALLOWED_ORIGINS:
        return JSONResponse({"detail": "This origin is not allowed."}, status_code=403)
    if request.method == "POST":
        # Never accept an unbounded body, even without Content-Length.
        size = 0
        chunks = []
        async for chunk in request.stream():
            size += len(chunk)
            if size > 1024:
                return JSONResponse({"detail": "Request too large."}, status_code=413)
            chunks.append(chunk)
        request._body = b"".join(chunks)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def expire():
    now = time.monotonic()
    for token in list(SESSIONS):
        if now - SESSIONS[token].touched > IDLE_SECONDS:
            del SESSIONS[token]
    for host in list(CREATIONS):
        if now - CREATIONS[host][-1] > 60:
            del CREATIONS[host]


def owned(authorization):
    token = authorization.removeprefix("Bearer ") if authorization else ""
    expire()
    session = SESSIONS.get(token)
    if not session:
        raise HTTPException(401, "Your play session expired. Start a new world.")
    session.touched = time.monotonic()
    return session


@app.get("/api/health")
def health():
    return {"ready": ENGINE is not None, "game": "Craftax-Classic", "version": "1.6.1"}


@app.post("/api/session")
def create(body: NewGame, request: Request):
    with LOCK:
        expire()
        host = request.client.host
        now = time.monotonic()
        recent = [t for t in CREATIONS.get(host, []) if now - t < 60]
        if len(recent) >= 6:
            raise HTTPException(429, "Please wait a minute before opening more worlds.")
        if len(SESSIONS) >= MAX_SESSIONS:
            raise HTTPException(503, "All play slots are occupied. Please try again later.")
        CREATIONS[host] = recent + [now]
        session = Session(body.seed if body.seed is not None else secrets.randbelow(2147483648))
        session.reset(session.seed)
        token = secrets.token_urlsafe(32)
        SESSIONS[token] = session
        return {"token": token, **session.latest}


@app.get("/api/session")
def current(authorization: str | None = Header(default=None)):
    with LOCK:
        return owned(authorization).latest


@app.post("/api/step")
def step(body: Move, authorization: str | None = Header(default=None)):
    with LOCK:
        session = owned(authorization)
        if body.expected_step != int(session.state.timestep):
            raise HTTPException(409, "The world has advanced. Refreshing your view.")
        if session.done:
            return session.latest
        now = time.monotonic()
        if now - session.last_action < 0.04:
            raise HTTPException(429, "Actions are arriving too quickly.")
        session.last_action = now
        session.key, session.state, session.reward, session.done = ENGINE.advance(session.key, session.state, body.action)
        session.latest = session.view()
        session.history.append({"action": body.action, "action_name": Action(body.action).name.lower(),
                                **session.latest})
        return session.latest


@app.post("/api/reset")
def reset(body: NewGame, authorization: str | None = Header(default=None)):
    with LOCK:
        session = owned(authorization)
        if time.monotonic() - session.last_action < 0.3:
            raise HTTPException(429, "Please wait a moment before restarting.")
        session.last_action = time.monotonic()
        return session.reset(body.seed if body.seed is not None else secrets.randbelow(2147483648))


@app.delete("/api/session")
def close(authorization: str | None = Header(default=None)):
    with LOCK:
        owned(authorization)
        del SESSIONS[authorization.removeprefix("Bearer ")]
        return {"closed": True}


@app.get("/api/recording")
def recording(authorization: str | None = Header(default=None)):
    with LOCK:
        session = owned(authorization)
        return {"schema_version": 1, "environment": "Craftax-Classic", "craftax_version": "1.6.1",
                "seed": session.seed, "started_at": session.started_at, "max_steps": MAX_STEPS,
                "image_format": "base64 PNG, 144x144 RGB; local view plus inventory",
                "state_fields": "Visible player statistics and inventory, not the full simulator state",
                "initial": session.initial, "transitions": list(session.history)}
