"""Shared pieces for the CarRacing World Models example.

Frame preprocessing follows the paper code (crop the 96x96 observation to its
top 84 rows, resize to 64x64), and the scripted drivers are only used to record
training rollouts.
"""

import math
import os

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")

import gymnasium as gym
import numpy as np
from PIL import Image

ENV_ID = "CarRacing-v3"
FRAME_SIZE = 64  # the VAE sees 64x64 RGB frames
CROP_ROWS = 84  # drop the indicator bar at the bottom of the observation
Z_SIZE = 32
ACTION_SIZE = 3
RNN_SIZE = 256
NUM_MIXTURES = 5
MAX_EPISODE_STEPS = 1000
CONTROLLER_INPUT_SIZE = Z_SIZE + RNN_SIZE  # the paper's "z and h" controller input
CONTROLLER_PARAM_COUNT = CONTROLLER_INPUT_SIZE * ACTION_SIZE + ACTION_SIZE  # 867


def make_env() -> gym.Env:
    """The standard continuous CarRacing task; observations are 96x96x3 pixels."""
    return gym.make(ENV_ID)


def preprocess_frame(frame: np.ndarray) -> np.ndarray:
    """96x96x3 observation -> 64x64x3 uint8."""
    image = Image.fromarray(frame[:CROP_ROWS])
    return np.asarray(image.resize((FRAME_SIZE, FRAME_SIZE), Image.BILINEAR), dtype=np.uint8)


def split_controller_params(params: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Parameter vector -> (weight [288, 3], bias [3]), the layout used by the paper code."""
    params = np.asarray(params, dtype=np.float64)
    bias = params[:ACTION_SIZE]
    weight = params[ACTION_SIZE:].reshape(CONTROLLER_INPUT_SIZE, ACTION_SIZE)
    return weight, bias


def controller_action(z: np.ndarray, h: np.ndarray, weight: np.ndarray, bias: np.ndarray) -> np.ndarray:
    """Linear controller on [z, h] with the paper's output squashing: tanh steer, gas in [0,1], brake in [0,1]."""
    raw = np.concatenate([z, h]) @ weight + bias
    action = np.tanh(raw)
    action[1] = (action[1] + 1.0) / 2.0
    action[2] = np.clip(action[2], 0.0, 1.0)
    return action.astype(np.float32)


class RandomDriver:
    """Random actions for data collection: a slow random walk, or uniform noise, picked per episode."""

    def __init__(self, rng: np.random.Generator):
        self.rng = rng
        self.uniform = rng.random() < 0.4
        self.gas_bias = rng.uniform(0.1, 0.7)
        self.action = np.array([0.0, self.gas_bias, 0.0], dtype=np.float32)

    def act(self) -> np.ndarray:
        rng = self.rng
        if self.uniform:
            brake = rng.uniform(0.0, 1.0) if rng.random() < 0.1 else 0.0
            return np.array([rng.uniform(-1.0, 1.0), rng.uniform(0.0, 1.0), brake], dtype=np.float32)
        steer = np.clip(0.95 * self.action[0] + rng.normal(0.0, 0.15), -1.0, 1.0)
        gas = np.clip(0.9 * self.action[1] + 0.1 * self.gas_bias + rng.normal(0.0, 0.1), 0.0, 1.0)
        brake = rng.uniform(0.0, 0.8) if rng.random() < 0.05 else 0.0
        self.action = np.array([steer, gas, brake], dtype=np.float32)
        return self.action


class TrackFollower:
    """Noisy pure-pursuit driver that reads the simulator's track geometry.

    Only used to record rollouts: it gives the VAE and MDN-RNN plenty of on-track
    driving at many speeds, which random actions rarely produce.
    """

    def __init__(self, rng: np.random.Generator, env: gym.Env):
        self.rng = rng
        unwrapped = env.unwrapped
        self.hull = unwrapped.car.hull
        self.track_xy = np.array([[point[2], point[3]] for point in unwrapped.track], dtype=np.float64)
        self.lookahead_points = int(rng.integers(3, 9))
        self.target_speed = float(rng.uniform(20.0, 65.0))
        self.steer_gain = float(rng.uniform(0.6, 1.6))
        self.noise_scale = float(rng.uniform(0.0, 0.35))
        self.steer_noise = 0.0
        self.disturbance_steps_left = 0
        self.disturbance_action = np.zeros(ACTION_SIZE, dtype=np.float32)

    def act(self) -> np.ndarray:
        rng = self.rng
        # Occasional bursts of random control so the data also covers leaving and rejoining the road.
        if self.disturbance_steps_left > 0:
            self.disturbance_steps_left -= 1
            return self.disturbance_action
        if rng.random() < 0.004:
            self.disturbance_steps_left = int(rng.integers(5, 25))
            self.disturbance_action = np.array([rng.uniform(-1.0, 1.0), rng.uniform(0.0, 1.0), 0.0], dtype=np.float32)
            return self.disturbance_action

        position = np.array([self.hull.position[0], self.hull.position[1]])
        forward_vector = self.hull.GetWorldVector((0.0, 1.0))
        forward = np.array([forward_vector[0], forward_vector[1]])
        nearest = int(np.argmin(np.sum((self.track_xy - position) ** 2, axis=1)))
        target = self.track_xy[(nearest + self.lookahead_points) % len(self.track_xy)]
        to_target = target - position
        # Positive heading error means the target is to the car's left; steering -1 is full left.
        heading_error = math.atan2(
            forward[0] * to_target[1] - forward[1] * to_target[0],
            forward[0] * to_target[0] + forward[1] * to_target[1],
        )
        self.steer_noise = 0.9 * self.steer_noise + rng.normal(0.0, 0.3 * self.noise_scale)
        steer = float(np.clip(-self.steer_gain * heading_error + self.steer_noise, -1.0, 1.0))
        velocity = self.hull.linearVelocity
        speed = math.hypot(velocity[0], velocity[1])
        gas = float(np.clip(0.05 * (self.target_speed - speed) + rng.normal(0.0, 0.05), 0.0, 1.0))
        brake = float(np.clip(0.03 * (speed - self.target_speed - 8.0), 0.0, 0.8))
        return np.array([steer, gas, brake], dtype=np.float32)
