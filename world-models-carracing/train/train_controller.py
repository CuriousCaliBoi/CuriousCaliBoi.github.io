"""Train C, the 867-parameter linear controller, with CMA-ES in the real environment.

Each worker process owns one CarRacing instance plus CPU copies of V and M. A
candidate's fitness is its mean return over a few tracks that are shared by the
whole population in that generation. Rollouts that stop making progress end
early during training; evaluation rollouts always run the full episode.
"""

import argparse
import csv
import json
import multiprocessing as mp
from multiprocessing.pool import Pool
import os
import pickle
import time

import cma
import numpy as np
import onnxruntime
import torch

from common import (
    CONTROLLER_PARAM_COUNT,
    MAX_EPISODE_STEPS,
    RNN_SIZE,
    controller_action,
    make_env,
    preprocess_frame,
    split_controller_params,
)
from models import ConvVAE, MDNRNN

WORKER_STATE: dict = {}


class Encoder(torch.nn.Module):
    def __init__(self, vae: ConvVAE):
        super().__init__()
        self.vae = vae

    def forward(self, image: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        return self.vae.encode(image)


def export_encoder_onnx(vae_path: str, onnx_path: str) -> None:
    """The VAE encoder runs in every worker through onnxruntime, which is several times faster than torch on one CPU core."""
    vae = ConvVAE()
    vae.load_state_dict(torch.load(vae_path, map_location="cpu"))
    vae.eval()
    torch.onnx.export(
        Encoder(vae), (torch.zeros(1, 3, 64, 64),), onnx_path, input_names=["image"], output_names=["mu", "logvar"], opset_version=17, dynamo=False
    )


def init_worker(encoder_onnx_path: str, rnn_path: str) -> None:
    torch.set_num_threads(1)
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    rnn = MDNRNN()
    rnn.load_state_dict(torch.load(rnn_path, map_location="cpu"))
    WORKER_STATE["encoder"] = onnxruntime.InferenceSession(encoder_onnx_path, options, providers=["CPUExecutionProvider"])
    WORKER_STATE["rnn"] = rnn.eval()
    WORKER_STATE["env"] = make_env()


def rollout(task: tuple[np.ndarray, int, int]) -> tuple[float, int, int]:
    """Run one episode; returns (return, steps, tiles visited). patience <= 0 disables early stopping."""
    params, seed, patience = task
    encoder, rnn, env = WORKER_STATE["encoder"], WORKER_STATE["rnn"], WORKER_STATE["env"]
    weight, bias = split_controller_params(params)
    noise = np.random.default_rng(seed)
    obs, _ = env.reset(seed=seed)
    h = torch.zeros(1, 1, RNN_SIZE)
    c = torch.zeros(1, 1, RNN_SIZE)
    total_reward, tiles, last_progress_step, step = 0.0, 0, 0, 0
    with torch.inference_mode():
        for step in range(MAX_EPISODE_STEPS):
            image = (preprocess_frame(obs).transpose(2, 0, 1)[None].astype(np.float32) / 255.0)
            mu, logvar = encoder.run(None, {"image": image})
            z = (mu + np.exp(0.5 * logvar) * noise.standard_normal(mu.shape)).astype(np.float32)
            action = controller_action(z[0], h[0, 0].numpy(), weight, bias)
            _, (h, c) = rnn(torch.from_numpy(z).unsqueeze(1), torch.from_numpy(action).view(1, 1, -1), (h, c))
            obs, reward, terminated, truncated, _ = env.step(action)
            total_reward += reward
            visited = int(env.unwrapped.tile_visited_count)
            if visited > tiles:
                tiles, last_progress_step = visited, step
            elif patience > 0 and step - last_progress_step > patience:
                break
            if terminated or truncated:
                break
    return total_reward, step + 1, tiles


def evaluate(pool: Pool, params: np.ndarray, seeds: np.ndarray) -> tuple[float, float]:
    results = pool.map(rollout, [(params, int(seed), 0) for seed in seeds], chunksize=1)
    returns = np.array([result[0] for result in results])
    return float(returns.mean()), float(returns.std())


def save_controller(path: str, params: np.ndarray, info: dict) -> None:
    with open(path, "w") as handle:
        json.dump({"params": [float(value) for value in params], **info}, handle)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vae", required=True)
    parser.add_argument("--rnn", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--popsize", type=int, default=64)
    parser.add_argument("--sigma", type=float, default=0.1)
    parser.add_argument("--rollouts", type=int, default=4, help="tracks per candidate per generation")
    parser.add_argument("--patience", type=int, default=100, help="steps without a new tile before a training rollout ends")
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--eval-every", type=int, default=10)
    parser.add_argument("--eval-rollouts", type=int, default=32)
    parser.add_argument("--max-generations", type=int, default=400)
    parser.add_argument("--hours", type=float, default=4.0)
    parser.add_argument("--workers", type=int, default=max(1, os.cpu_count() - 1))
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    state_path = os.path.join(args.out_dir, "cma_state.pkl")
    best_path = os.path.join(args.out_dir, "controller_best.json")
    rng = np.random.default_rng(args.seed)
    eval_seeds = np.arange(1_000_000, 1_000_000 + args.eval_rollouts)
    best = {"eval_mean": float("-inf")}
    start_generation = 1
    if args.resume and os.path.exists(state_path):
        with open(state_path, "rb") as handle:
            saved = pickle.load(handle)
        es = saved["es"]
        rng = saved["rng"]
        best = saved["best"]
        start_generation = saved["generation"] + 1
        print(f"resumed at generation {start_generation}, best eval {best['eval_mean']:.1f}", flush=True)
    else:
        es = cma.CMAEvolutionStrategy(
            np.zeros(CONTROLLER_PARAM_COUNT), args.sigma, {"popsize": args.popsize, "seed": args.seed + 1}
        )

    started = time.time()
    encoder_onnx_path = os.path.join(args.out_dir, "encoder.onnx")
    export_encoder_onnx(args.vae, encoder_onnx_path)
    log_path = os.path.join(args.out_dir, "controller_log.csv")
    log_exists = os.path.exists(log_path) and args.resume
    with mp.get_context("spawn").Pool(args.workers, initializer=init_worker, initargs=(encoder_onnx_path, args.rnn)) as pool, open(
        log_path, "a" if log_exists else "w", newline=""
    ) as log_file:
        writer = csv.writer(log_file)
        if not log_exists:
            writer.writerow(
                ["generation", "seconds", "fitness_mean", "fitness_max", "fitness_min", "steps_mean", "eval_mean_of_mean", "eval_mean_of_best", "best_eval_mean"]
            )
        for generation in range(start_generation, args.max_generations + 1):
            solutions = es.ask()
            track_seeds = rng.integers(0, 2**31 - 1, size=args.rollouts)
            tasks = [(solution, int(seed), args.patience) for solution in solutions for seed in track_seeds]
            results = pool.map(rollout, tasks, chunksize=1)
            returns = np.array([result[0] for result in results]).reshape(len(solutions), args.rollouts)
            steps = np.array([result[1] for result in results])
            fitness = returns.mean(axis=1)
            decay = -args.weight_decay * np.mean(np.square(np.array(solutions)), axis=1)
            es.tell(solutions, list(-(fitness + decay)))

            eval_mean_of_mean, eval_mean_of_best = "", ""
            if generation % args.eval_every == 0 or generation == args.max_generations:
                candidates = {"mean": np.array(es.mean), "top": np.array(solutions[int(np.argmax(fitness))])}
                for name, candidate in candidates.items():
                    mean_return, std_return = evaluate(pool, candidate, eval_seeds)
                    if name == "mean":
                        eval_mean_of_mean = round(mean_return, 1)
                    else:
                        eval_mean_of_best = round(mean_return, 1)
                    if mean_return > best["eval_mean"]:
                        best = {"eval_mean": mean_return, "eval_std": std_return, "generation": generation, "candidate": name}
                        save_controller(best_path, candidate, best)
                save_controller(os.path.join(args.out_dir, "controller_latest.json"), np.array(es.mean), {"generation": generation})

            elapsed = time.time() - started
            writer.writerow(
                [generation, round(elapsed), round(fitness.mean(), 1), round(fitness.max(), 1), round(fitness.min(), 1), round(steps.mean(), 1), eval_mean_of_mean, eval_mean_of_best, round(best["eval_mean"], 1)]
            )
            log_file.flush()
            print(
                f"gen {generation} fitness mean {fitness.mean():.1f} max {fitness.max():.1f} min {fitness.min():.1f} "
                f"steps {steps.mean():.0f} | eval mean {eval_mean_of_mean} top {eval_mean_of_best} best {best['eval_mean']:.1f} | {elapsed:.0f}s",
                flush=True,
            )
            with open(state_path, "wb") as handle:
                pickle.dump({"es": es, "rng": rng, "best": best, "generation": generation}, handle)
            if elapsed > args.hours * 3600:
                print("time budget reached", flush=True)
                break
    summary = {
        "popsize": args.popsize,
        "sigma": args.sigma,
        "rollouts_per_candidate": args.rollouts,
        "patience": args.patience,
        "weight_decay": args.weight_decay,
        "eval_rollouts": args.eval_rollouts,
        "generations": generation,
        "hours": round((time.time() - started) / 3600, 2),
        "best": best,
    }
    with open(os.path.join(args.out_dir, "controller_summary.json"), "w") as handle:
        json.dump(summary, handle, indent=1)
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
