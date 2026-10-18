"""Record CarRacing rollouts for training V and M.

The paper recorded 10,000 rollouts from random policies. Here a share of the
episodes also uses a noisy scripted track follower so the models see real
driving at many speeds; the rest use random actions.
"""

import argparse
import json
import multiprocessing as mp
import os
import time

import numpy as np

from common import MAX_EPISODE_STEPS, RandomDriver, TrackFollower, make_env, preprocess_frame


def record_episode(task: tuple[int, int, str, float]) -> dict:
    episode_index, seed, out_dir, follower_fraction = task
    rng = np.random.default_rng(seed)
    env = make_env()
    obs, _ = env.reset(seed=seed)
    use_follower = rng.random() < follower_fraction
    driver = TrackFollower(rng, env) if use_follower else RandomDriver(rng)
    frames, actions, rewards = [], [], []
    for _ in range(MAX_EPISODE_STEPS):
        action = driver.act()
        frames.append(preprocess_frame(obs))
        actions.append(action)
        obs, reward, terminated, truncated, _ = env.step(action)
        rewards.append(reward)
        if terminated or truncated:
            break
    tiles_visited = int(env.unwrapped.tile_visited_count)
    env.close()
    policy = "follower" if use_follower else "random"
    np.savez(
        os.path.join(out_dir, f"episode_{episode_index:05d}.npz"),
        obs=np.stack(frames),
        action=np.stack(actions).astype(np.float32),
        reward=np.asarray(rewards, dtype=np.float32),
        seed=seed,
        policy=policy,
    )
    return {
        "episode": episode_index,
        "steps": len(frames),
        "return": float(np.sum(rewards)),
        "tiles": tiles_visited,
        "policy": policy,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--episodes", type=int, default=2000)
    parser.add_argument("--workers", type=int, default=max(1, os.cpu_count() - 1))
    parser.add_argument("--seed", type=int, default=20261018)
    parser.add_argument("--follower-fraction", type=float, default=0.6)
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    tasks = [(index, args.seed + index, args.out_dir, args.follower_fraction) for index in range(args.episodes)]
    started = time.time()
    results = []
    with mp.get_context("spawn").Pool(args.workers) as pool:
        for result in pool.imap_unordered(record_episode, tasks, chunksize=1):
            results.append(result)
            if len(results) % 50 == 0:
                elapsed = time.time() - started
                frames = sum(r["steps"] for r in results)
                print(f"{len(results)}/{args.episodes} episodes, {frames} frames, {elapsed:.0f}s", flush=True)
    results.sort(key=lambda r: r["episode"])
    summary = {
        "env": "CarRacing-v3",
        "episodes": len(results),
        "frames": int(sum(r["steps"] for r in results)),
        "follower_fraction": args.follower_fraction,
        "seed": args.seed,
        "seconds": time.time() - started,
        "mean_return_follower": float(np.mean([r["return"] for r in results if r["policy"] == "follower"] or [0])),
        "mean_return_random": float(np.mean([r["return"] for r in results if r["policy"] == "random"] or [0])),
        "episodes_detail": results,
    }
    with open(os.path.join(args.out_dir, "manifest.json"), "w") as handle:
        json.dump(summary, handle, indent=1)
    print(json.dumps({k: v for k, v in summary.items() if k != "episodes_detail"}, indent=1))


if __name__ == "__main__":
    main()
