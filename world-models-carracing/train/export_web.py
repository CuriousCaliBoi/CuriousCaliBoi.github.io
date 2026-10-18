"""Export the trained world model for the browser demo.

Writes the VAE decoder and one MDN-RNN step as ONNX graphs, the controller and
starting latents as JSON, a strip of real frames with their latents for the
reconstruction panel, and a meta.json with training facts. Every exported graph
is checked against PyTorch with onnxruntime before the files are kept.
"""

import argparse
import json
import os
import time

import numpy as np
import onnxruntime
import torch
from PIL import Image

from common import CONTROLLER_PARAM_COUNT, RNN_SIZE, Z_SIZE, split_controller_params
from models import ConvVAE, MDNRNN, MDNRNNCell


class Decoder(torch.nn.Module):
    def __init__(self, vae: ConvVAE):
        super().__init__()
        self.vae = vae

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        return self.vae.decode(z)


def export_onnx(module: torch.nn.Module, inputs: tuple, path: str, input_names: list[str], output_names: list[str]) -> None:
    torch.onnx.export(
        module,
        inputs,
        path,
        input_names=input_names,
        output_names=output_names,
        opset_version=17,
        dynamo=False,
    )


def verify(path: str, feeds: dict, expected: list[np.ndarray], tolerance: float = 1e-4) -> float:
    session = onnxruntime.InferenceSession(path, providers=["CPUExecutionProvider"])
    outputs = session.run(None, feeds)
    worst = max(float(np.max(np.abs(out - ref))) for out, ref in zip(outputs, expected))
    if worst > tolerance:
        raise RuntimeError(f"{path} disagrees with PyTorch: max abs diff {worst}")
    return worst


def rounded(array: np.ndarray, decimals: int = 4) -> list:
    return np.round(np.asarray(array, dtype=np.float64), decimals).tolist()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vae", required=True)
    parser.add_argument("--rnn", required=True)
    parser.add_argument("--controller", required=True, help="controller_best.json from train_controller.py")
    parser.add_argument("--series", required=True)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--summaries", nargs="*", default=[], help="json files merged into meta.json under their stem")
    parser.add_argument("--start-states", type=int, default=256)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    torch.manual_seed(args.seed)
    rng = np.random.default_rng(args.seed)
    vae = ConvVAE()
    vae.load_state_dict(torch.load(args.vae, map_location="cpu"))
    vae.eval()
    rnn = MDNRNN()
    rnn.load_state_dict(torch.load(args.rnn, map_location="cpu"))
    rnn.eval()

    # V decoder.
    decoder = Decoder(vae)
    z = torch.randn(1, Z_SIZE)
    decoder_path = os.path.join(args.out_dir, "decoder.onnx")
    export_onnx(decoder, (z,), decoder_path, ["z"], ["image"])
    with torch.no_grad():
        decoder_diff = verify(decoder_path, {"z": z.numpy()}, [decoder(z).numpy()])

    # M as a single step so the browser can run it closed-loop.
    cell = MDNRNNCell(rnn)
    action = torch.rand(1, 3)
    h = torch.randn(1, RNN_SIZE) * 0.5
    c = torch.randn(1, RNN_SIZE) * 0.5
    cell_path = os.path.join(args.out_dir, "rnn_cell.onnx")
    export_onnx(cell, (z, action, h, c), cell_path, ["z", "action", "h", "c"], ["logmix", "mean", "logstd", "h_next", "c_next"])
    with torch.no_grad():
        cell_outputs = [tensor.numpy() for tensor in cell(z, action, h, c)]
        # The explicit cell must also match the cuDNN-style nn.LSTM used in training.
        _, (h_ref, c_ref) = rnn(z.unsqueeze(1), action.unsqueeze(1), (h.unsqueeze(0), c.unsqueeze(0)))
        lstm_diff = max(float((h_ref[0] - cell_outputs[3]).abs().max()), float((c_ref[0] - cell_outputs[4]).abs().max()))
        if lstm_diff > 1e-5:
            raise RuntimeError(f"explicit LSTM cell disagrees with nn.LSTM: {lstm_diff}")
        cell_diff = verify(cell_path, {"z": z.numpy(), "action": action.numpy(), "h": h.numpy(), "c": c.numpy()}, cell_outputs)

    # C.
    with open(args.controller) as handle:
        controller = json.load(handle)
    params = np.asarray(controller["params"], dtype=np.float64)
    if params.shape[0] != CONTROLLER_PARAM_COUNT:
        raise ValueError(f"controller has {params.shape[0]} params, expected {CONTROLLER_PARAM_COUNT}")
    weight, bias = split_controller_params(params)
    with open(os.path.join(args.out_dir, "controller.json"), "w") as handle:
        json.dump(
            {
                "input": "concat(z[32], h[256])",
                "weight": weight.tolist(),
                "bias": bias.tolist(),
                "eval_mean": controller.get("eval_mean"),
                "eval_std": controller.get("eval_std"),
                "generation": controller.get("generation"),
            },
            handle,
        )

    # Starting latents: episode starts (the zoom-in) and on-track moments from follower episodes.
    series = np.load(args.series)
    mu, logvar, length, policy = series["mu"], series["logvar"], series["length"], series["policy"]
    start_episodes = rng.choice(len(length), size=min(args.start_states, len(length)), replace=False)
    follower_episodes = np.flatnonzero(policy == "follower")
    midway_episodes = rng.choice(follower_episodes, size=min(args.start_states, len(follower_episodes)), replace=True)
    midway_steps = [int(rng.integers(100, max(101, int(length[episode])))) for episode in midway_episodes]
    with open(os.path.join(args.out_dir, "initial_z.json"), "w") as handle:
        json.dump(
            {
                "start": {"mu": rounded(mu[start_episodes, 0]), "logvar": rounded(logvar[start_episodes, 0])},
                "midway": {
                    "mu": rounded([mu[episode, step] for episode, step in zip(midway_episodes, midway_steps)]),
                    "logvar": rounded([logvar[episode, step] for episode, step in zip(midway_episodes, midway_steps)]),
                },
            },
            handle,
        )

    # Real frames with their latents for the reconstruction panel (taken from the held-out episodes).
    with open(os.path.join(args.data_dir, "manifest.json")) as handle:
        manifest = json.load(handle)
    episodes = manifest["episodes_detail"]
    holdout = episodes[-40:]
    picks = []
    for offset, step in enumerate([0, 30, 60, 120, 250, 400, 600, 800, 950, 500, 200, 700]):
        episode = holdout[(offset * 7) % len(holdout)]
        picks.append((episode["episode"], min(step, episode["steps"] - 1)))
    frames, latents = [], []
    with torch.no_grad():
        for episode_index, step in picks:
            with np.load(os.path.join(args.data_dir, f"episode_{episode_index:05d}.npz")) as data:
                frame = data["obs"][step]
            frames.append(frame)
            x = torch.from_numpy(frame).permute(2, 0, 1).unsqueeze(0).float().div_(255.0)
            frame_mu, _ = vae.encode(x)
            latents.append(frame_mu[0].numpy())
    Image.fromarray(np.concatenate(frames, axis=1)).save(os.path.join(args.out_dir, "samples.png"))
    with open(os.path.join(args.out_dir, "samples.json"), "w") as handle:
        json.dump({"frame_size": 64, "count": len(frames), "mu": rounded(np.stack(latents))}, handle)

    meta = {
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "z_size": Z_SIZE,
        "rnn_size": RNN_SIZE,
        "num_mixtures": rnn.num_mixtures,
        "controller_params": CONTROLLER_PARAM_COUNT,
        "vae_params": sum(p.numel() for p in vae.parameters()),
        "decoder_params": sum(p.numel() for p in vae.decoder_fc.parameters()) + sum(p.numel() for p in vae.decoder.parameters()),
        "rnn_params": sum(p.numel() for p in rnn.parameters()),
        "onnx_max_abs_diff": {"decoder": decoder_diff, "rnn_cell": cell_diff},
        "files": {name: os.path.getsize(os.path.join(args.out_dir, name)) for name in sorted(os.listdir(args.out_dir)) if name != "meta.json"},
        "controller": {key: controller.get(key) for key in ("eval_mean", "eval_std", "generation", "candidate")},
        "data": {key: manifest[key] for key in ("env", "episodes", "frames", "follower_fraction", "seconds")},
    }
    for path in args.summaries:
        with open(path) as handle:
            meta[os.path.splitext(os.path.basename(path))[0]] = json.load(handle)
    with open(os.path.join(args.out_dir, "meta.json"), "w") as handle:
        json.dump(meta, handle, indent=1)
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
