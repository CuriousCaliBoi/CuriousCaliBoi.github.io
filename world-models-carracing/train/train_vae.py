"""Train V, the ConvVAE, on recorded 64x64 frames.

Hyperparameters follow the paper code (z=32, Adam 1e-4, KL floor 0.5 nats per
latent); the number of gradient steps is a command-line budget.
"""

import argparse
import csv
import json
import os
import time

import numpy as np
import torch
from PIL import Image

from common import FRAME_SIZE
from models import ConvVAE, vae_loss


def load_frames(data_dir: str, holdout_episodes: int, device: torch.device) -> tuple[torch.Tensor, torch.Tensor]:
    """Stack every recorded frame on the device as uint8; the last episodes are held out for validation."""
    with open(os.path.join(data_dir, "manifest.json")) as handle:
        episodes = json.load(handle)["episodes_detail"]
    train_episodes = episodes[: len(episodes) - holdout_episodes]
    total = sum(episode["steps"] for episode in train_episodes)
    frames = torch.empty((total, FRAME_SIZE, FRAME_SIZE, 3), dtype=torch.uint8, device=device)
    offset = 0
    for episode in train_episodes:
        with np.load(os.path.join(data_dir, f"episode_{episode['episode']:05d}.npz")) as data:
            obs = torch.from_numpy(data["obs"])
        frames[offset : offset + obs.shape[0]] = obs.to(device)
        offset += obs.shape[0]
    validation = []
    for episode in episodes[len(episodes) - holdout_episodes :]:
        with np.load(os.path.join(data_dir, f"episode_{episode['episode']:05d}.npz")) as data:
            validation.append(torch.from_numpy(data["obs"][::10]))
    return frames, torch.cat(validation).to(device)


def to_input(frames_uint8: torch.Tensor) -> torch.Tensor:
    return frames_uint8.permute(0, 3, 1, 2).float().div_(255.0)


def evaluate(vae: ConvVAE, validation: torch.Tensor, batch_size: int) -> tuple[float, float]:
    vae.eval()
    recon_total, kl_total = 0.0, 0.0
    with torch.no_grad():
        for start in range(0, validation.shape[0], batch_size):
            x = to_input(validation[start : start + batch_size])
            reconstruction, mu, logvar = vae(x)
            _, recon_loss, kl_loss = vae_loss(x, reconstruction, mu, logvar)
            recon_total += recon_loss.item() * x.shape[0]
            kl_total += kl_loss.item() * x.shape[0]
    vae.train()
    return recon_total / validation.shape[0], kl_total / validation.shape[0]


def save_reconstruction_grid(vae: ConvVAE, validation: torch.Tensor, path: str, count: int = 16) -> None:
    vae.eval()
    with torch.no_grad():
        picks = torch.linspace(0, validation.shape[0] - 1, count).long()
        x = to_input(validation[picks])
        mu, _ = vae.encode(x)
        reconstruction = vae.decode(mu)
    real = (x.permute(0, 2, 3, 1) * 255).round().byte().cpu().numpy()
    fake = (reconstruction.permute(0, 2, 3, 1) * 255).round().byte().cpu().numpy()
    grid = np.concatenate([np.concatenate(list(real), axis=1), np.concatenate(list(fake), axis=1)], axis=0)
    Image.fromarray(grid).save(path)
    vae.train()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--steps", type=int, default=50000)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--kl-tolerance", type=float, default=0.5)
    parser.add_argument("--holdout-episodes", type=int, default=40)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    torch.backends.cudnn.benchmark = True
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    os.makedirs(args.out_dir, exist_ok=True)

    started = time.time()
    frames, validation = load_frames(args.data_dir, args.holdout_episodes, device)
    print(f"loaded {frames.shape[0]} training frames and {validation.shape[0]} validation frames in {time.time() - started:.0f}s", flush=True)

    vae = ConvVAE().to(device)
    optimizer = torch.optim.Adam(vae.parameters(), lr=args.learning_rate)
    log_path = os.path.join(args.out_dir, "vae_log.csv")
    with open(log_path, "w", newline="") as log_file:
        writer = csv.writer(log_file)
        writer.writerow(["step", "seconds", "train_recon", "train_kl", "val_recon", "val_kl"])
        running_recon, running_kl, running_count = 0.0, 0.0, 0
        for step in range(1, args.steps + 1):
            indices = torch.randint(0, frames.shape[0], (args.batch_size,), device=device)
            x = to_input(frames[indices])
            reconstruction, mu, logvar = vae(x)
            loss, recon_loss, kl_loss = vae_loss(x, reconstruction, mu, logvar, args.kl_tolerance)
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            optimizer.step()
            running_recon += recon_loss.item()
            running_kl += kl_loss.item()
            running_count += 1
            if step % 1000 == 0 or step == args.steps:
                val_recon, val_kl = evaluate(vae, validation, 500)
                row = [step, round(time.time() - started, 1), running_recon / running_count, running_kl / running_count, val_recon, val_kl]
                writer.writerow(row)
                log_file.flush()
                print(
                    f"step {step} train recon {row[2]:.1f} kl {row[3]:.2f} | val recon {val_recon:.1f} kl {val_kl:.2f} | {row[1]}s",
                    flush=True,
                )
                running_recon, running_kl, running_count = 0.0, 0.0, 0
                torch.save(vae.state_dict(), os.path.join(args.out_dir, "vae.pt"))

    save_reconstruction_grid(vae, validation, os.path.join(args.out_dir, "vae_reconstructions.png"))
    val_recon, val_kl = evaluate(vae, validation, 500)
    summary = {
        "steps": args.steps,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "kl_tolerance": args.kl_tolerance,
        "training_frames": int(frames.shape[0]),
        "validation_frames": int(validation.shape[0]),
        "val_recon_loss": val_recon,
        "val_kl_loss": val_kl,
        "seconds": time.time() - started,
    }
    with open(os.path.join(args.out_dir, "vae_summary.json"), "w") as handle:
        json.dump(summary, handle, indent=1)
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
