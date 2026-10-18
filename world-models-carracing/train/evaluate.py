"""Score the trained agent on unseen tracks and record a comparison video.

The video shows, side by side, what the agent sees (the 64x64 frame), the VAE's
reconstruction of it, and a closed-loop dream that starts from the same first
frame and is driven by the same controller inside M.
"""

import argparse
import json
import math
import os
import time

import imageio.v2 as imageio
import numpy as np
import torch
from PIL import Image, ImageDraw

from common import MAX_EPISODE_STEPS, RNN_SIZE, controller_action, make_env, preprocess_frame, split_controller_params
from models import ConvVAE, MDNRNN, sample_mixture
from train_controller import export_encoder_onnx, init_worker, rollout


def frame_to_tensor(frame: np.ndarray) -> torch.Tensor:
    return torch.from_numpy(frame).permute(2, 0, 1).unsqueeze(0).float().div_(255.0)


def tensor_to_frame(image: torch.Tensor) -> np.ndarray:
    return (image[0].permute(1, 2, 0).clamp(0, 1) * 255).round().byte().numpy()


def record_video(vae: ConvVAE, rnn: MDNRNN, params: np.ndarray, seed: int, out_dir: str, temperature: float, scale: int = 4) -> dict:
    weight, bias = split_controller_params(params)
    env = make_env()
    obs, _ = env.reset(seed=seed)
    torch.manual_seed(seed)
    h = torch.zeros(1, 1, RNN_SIZE)
    c = torch.zeros(1, 1, RNN_SIZE)
    dream_h, dream_c = torch.zeros(1, 1, RNN_SIZE), torch.zeros(1, 1, RNN_SIZE)
    dream_z = None
    total_reward = 0.0
    panels = []
    with torch.no_grad():
        for step in range(MAX_EPISODE_STEPS):
            frame = preprocess_frame(obs)
            mu, logvar = vae.encode(frame_to_tensor(frame))
            z = mu + torch.exp(0.5 * logvar) * torch.randn_like(mu)
            if dream_z is None:
                dream_z = z.clone()
            reconstruction = tensor_to_frame(vae.decode(mu))
            dream_frame = tensor_to_frame(vae.decode(dream_z))
            action = controller_action(z[0].numpy(), h[0, 0].numpy(), weight, bias)
            dream_action = controller_action(dream_z[0].numpy(), dream_h[0, 0].numpy(), weight, bias)
            _, (h, c) = rnn(z.unsqueeze(1), torch.from_numpy(action).view(1, 1, -1), (h, c))
            (logmix, mean, logstd), (dream_h, dream_c) = rnn(
                dream_z.unsqueeze(1), torch.from_numpy(dream_action).view(1, 1, -1), (dream_h, dream_c)
            )
            dream_z = sample_mixture(logmix[:, 0], mean[:, 0], logstd[:, 0], temperature)
            obs, reward, terminated, truncated, _ = env.step(action)
            total_reward += reward
            panels.append((frame, reconstruction, dream_frame, total_reward, step))
            if terminated or truncated:
                break
    env.close()

    width = 64 * scale
    video_path = os.path.join(out_dir, f"agent_seed{seed}.mp4")
    writer = imageio.get_writer(video_path, fps=50, codec="libx264", quality=7, macro_block_size=8, ffmpeg_params=["-pix_fmt", "yuv420p"])
    for index, (frame, reconstruction, dream_frame, running_reward, step) in enumerate(panels):
        canvas = Image.new("RGB", (3 * width + 2 * 8, width + 28), (16, 18, 22))
        for column, (image, label) in enumerate(((frame, "real (what V sees)"), (reconstruction, "V reconstruction"), (dream_frame, f"dream in M, tau={temperature:g}"))):
            canvas.paste(Image.fromarray(image).resize((width, width), Image.NEAREST), (column * (width + 8), 28))
            ImageDraw.Draw(canvas).text((column * (width + 8) + 6, 8), label, fill=(230, 230, 230))
        ImageDraw.Draw(canvas).text((3 * width + 16 - 150, 8), f"step {step:4d}  return {running_reward:7.1f}", fill=(230, 230, 230))
        writer.append_data(np.asarray(canvas))
        if index == 0:
            canvas.save(os.path.join(out_dir, f"agent_seed{seed}_poster.png"))
    writer.close()
    return {"seed": seed, "return": total_reward, "steps": len(panels), "video": os.path.basename(video_path)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vae", required=True)
    parser.add_argument("--rnn", required=True)
    parser.add_argument("--controller", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--episodes", type=int, default=100)
    parser.add_argument("--workers", type=int, default=max(1, os.cpu_count() - 1))
    parser.add_argument("--video-seeds", type=int, nargs="*", default=[2_000_000])
    parser.add_argument("--temperature", type=float, default=1.0)
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    with open(args.controller) as handle:
        params = np.asarray(json.load(handle)["params"], dtype=np.float64)

    import multiprocessing as mp

    started = time.time()
    seeds = np.arange(2_000_000, 2_000_000 + args.episodes)
    encoder_onnx_path = os.path.join(args.out_dir, "encoder.onnx")
    export_encoder_onnx(args.vae, encoder_onnx_path)
    with mp.get_context("spawn").Pool(args.workers, initializer=init_worker, initargs=(encoder_onnx_path, args.rnn)) as pool:
        results = pool.map(rollout, [(params, int(seed), 0) for seed in seeds], chunksize=1)
    returns = np.array([result[0] for result in results])
    summary = {
        "episodes": args.episodes,
        "mean_return": float(returns.mean()),
        "std_return": float(returns.std()),
        "min_return": float(returns.min()),
        "max_return": float(returns.max()),
        "mean_steps": float(np.mean([result[1] for result in results])),
        "mean_tiles": float(np.mean([result[2] for result in results])),
        "returns": [float(value) for value in returns],
        "seconds": time.time() - started,
    }
    print(f"{args.episodes} episodes: mean {summary['mean_return']:.1f} +- {summary['std_return']:.1f} (min {summary['min_return']:.1f}, max {summary['max_return']:.1f})", flush=True)

    vae = ConvVAE()
    vae.load_state_dict(torch.load(args.vae, map_location="cpu"))
    vae.eval()
    rnn = MDNRNN()
    rnn.load_state_dict(torch.load(args.rnn, map_location="cpu"))
    rnn.eval()
    summary["videos"] = [record_video(vae, rnn, params, seed, args.out_dir, args.temperature) for seed in args.video_seeds]
    with open(os.path.join(args.out_dir, "eval_summary.json"), "w") as handle:
        json.dump(summary, handle, indent=1)
    print(json.dumps({key: value for key, value in summary.items() if key != "returns"}, indent=1))


if __name__ == "__main__":
    main()
