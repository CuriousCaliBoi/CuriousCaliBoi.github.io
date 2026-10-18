"""Encode every recorded frame with the trained VAE into (mu, logvar) series for training M."""

import argparse
import json
import os

import numpy as np
import torch

from common import ACTION_SIZE, MAX_EPISODE_STEPS, Z_SIZE
from models import ConvVAE


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--vae", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    vae = ConvVAE().to(device)
    vae.load_state_dict(torch.load(args.vae, map_location=device))
    vae.eval()

    with open(os.path.join(args.data_dir, "manifest.json")) as handle:
        episodes = json.load(handle)["episodes_detail"]
    count = len(episodes)
    mu = np.zeros((count, MAX_EPISODE_STEPS, Z_SIZE), dtype=np.float16)
    logvar = np.zeros((count, MAX_EPISODE_STEPS, Z_SIZE), dtype=np.float16)
    action = np.zeros((count, MAX_EPISODE_STEPS, ACTION_SIZE), dtype=np.float16)
    reward = np.zeros((count, MAX_EPISODE_STEPS), dtype=np.float16)
    length = np.zeros(count, dtype=np.int32)
    policy = []
    with torch.no_grad():
        for index, episode in enumerate(episodes):
            with np.load(os.path.join(data_dir := args.data_dir, f"episode_{episode['episode']:05d}.npz")) as data:
                obs = torch.from_numpy(data["obs"]).to(device).permute(0, 3, 1, 2).float().div_(255.0)
                steps = obs.shape[0]
                episode_mu, episode_logvar = vae.encode(obs)
                mu[index, :steps] = episode_mu.cpu().numpy()
                logvar[index, :steps] = episode_logvar.cpu().numpy()
                action[index, :steps] = data["action"]
                reward[index, :steps] = data["reward"]
                length[index] = steps
                policy.append(str(data["policy"]))
            if (index + 1) % 200 == 0:
                print(f"encoded {index + 1}/{count} episodes", flush=True)
    np.savez_compressed(args.out, mu=mu, logvar=logvar, action=action, reward=reward, length=length, policy=np.array(policy))
    print(f"saved {args.out}: {count} episodes, {int(length.sum())} frames from {data_dir}")


if __name__ == "__main__":
    main()
