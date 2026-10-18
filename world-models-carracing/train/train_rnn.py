"""Train M, the MDN-RNN, on the VAE latent series.

As in the paper code: 256 LSTM units, 5 mixtures, sequences of 999 transitions
with teacher forcing, batch 100, Adam 1e-3 with gradients clipped to [-1, 1].
A fresh z is sampled from each frame's posterior every time a batch is drawn.
"""

import argparse
import csv
import json
import os
import time

import numpy as np
import torch

from models import MDNRNN, mdn_loss


def sample_batch(
    mu: torch.Tensor, logvar: torch.Tensor, action: torch.Tensor, length: torch.Tensor, indices: torch.Tensor
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
    batch_mu = mu[indices]
    z = batch_mu + torch.exp(0.5 * logvar[indices]) * torch.randn_like(batch_mu)
    steps = torch.arange(z.shape[1] - 1, device=z.device)
    mask = (steps[None, :] < (length[indices] - 1)[:, None]).float()
    return z[:, :-1], action[indices][:, :-1], z[:, 1:], mask


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--series", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--steps", type=int, default=4000)
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--grad-clip", type=float, default=1.0)
    parser.add_argument("--holdout-episodes", type=int, default=40)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    os.makedirs(args.out_dir, exist_ok=True)

    series = np.load(args.series)
    mu = torch.from_numpy(series["mu"].astype(np.float32)).to(device)
    logvar = torch.from_numpy(series["logvar"].astype(np.float32)).to(device)
    action = torch.from_numpy(series["action"].astype(np.float32)).to(device)
    length = torch.from_numpy(series["length"].astype(np.int64)).to(device)
    train_count = mu.shape[0] - args.holdout_episodes
    validation_indices = torch.arange(train_count, mu.shape[0], device=device)
    print(f"{train_count} training episodes, {args.holdout_episodes} validation episodes", flush=True)

    rnn = MDNRNN().to(device)
    optimizer = torch.optim.Adam(rnn.parameters(), lr=args.learning_rate)
    best_validation = float("inf")
    started = time.time()
    with open(os.path.join(args.out_dir, "rnn_log.csv"), "w", newline="") as log_file:
        writer = csv.writer(log_file)
        writer.writerow(["step", "seconds", "train_nll", "val_nll"])
        running, running_count = 0.0, 0
        for step in range(1, args.steps + 1):
            indices = torch.randint(0, train_count, (args.batch_size,), device=device)
            z_in, a_in, z_target, mask = sample_batch(mu, logvar, action, length, indices)
            (logmix, mean, logstd), _ = rnn(z_in, a_in)
            loss = mdn_loss(logmix, mean, logstd, z_target, mask)
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_value_(rnn.parameters(), args.grad_clip)
            optimizer.step()
            running += loss.item()
            running_count += 1
            if step % 100 == 0 or step == args.steps:
                rnn.eval()
                with torch.no_grad():
                    generator_state = torch.random.get_rng_state()
                    torch.manual_seed(12345)  # same posterior samples for every validation pass
                    z_in, a_in, z_target, mask = sample_batch(mu, logvar, action, length, validation_indices)
                    torch.random.set_rng_state(generator_state)
                    (logmix, mean, logstd), _ = rnn(z_in, a_in)
                    validation_nll = mdn_loss(logmix, mean, logstd, z_target, mask).item()
                rnn.train()
                row = [step, round(time.time() - started, 1), running / running_count, validation_nll]
                writer.writerow(row)
                log_file.flush()
                print(f"step {step} train nll {row[2]:.4f} val nll {validation_nll:.4f} | {row[1]}s", flush=True)
                running, running_count = 0.0, 0
                if validation_nll < best_validation:
                    best_validation = validation_nll
                    torch.save(rnn.state_dict(), os.path.join(args.out_dir, "rnn.pt"))
    torch.save(rnn.state_dict(), os.path.join(args.out_dir, "rnn_last.pt"))
    summary = {
        "steps": args.steps,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "grad_clip": args.grad_clip,
        "training_episodes": train_count,
        "validation_episodes": args.holdout_episodes,
        "best_val_nll": best_validation,
        "seconds": time.time() - started,
    }
    with open(os.path.join(args.out_dir, "rnn_summary.json"), "w") as handle:
        json.dump(summary, handle, indent=1)
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
