# World Models on CarRacing: training code

A compact PyTorch re-implementation of the CarRacing experiment from
[World Models](https://worldmodels.github.io/) (Ha & Schmidhuber, 2018), plus
the exporter that turns the trained models into the static browser demo in the
parent directory. Trained on an NVIDIA DGX Spark (GB10); everything except the
controller search runs on one GPU in minutes.

## Pipeline

| Step | Script | What it does |
| --- | --- | --- |
| 1 | `collect.py` | Records rollouts of Gymnasium `CarRacing-v3` as 64×64 frames (top 84 rows of the 96×96 observation, resized), actions, and rewards. |
| 2 | `train_vae.py` | V: ConvVAE with a 32-dim latent, sum-of-squares reconstruction + KL with the paper's free-bits floor. |
| 3 | `encode_series.py` | Encodes every frame to (mu, logvar) for the sequence model. |
| 4 | `train_rnn.py` | M: 256-unit LSTM with a mixture-density head (5 Gaussians per latent dimension), teacher forcing on 999-step sequences. |
| 5 | `train_controller.py` | C: 867-parameter linear controller on [z, h], searched with CMA-ES (population 64) in the real environment across 19 worker processes. |
| 6 | `evaluate.py` | Scores the agent on 100 unseen tracks and records a video: real frame, VAE reconstruction, and a dream driven by the same controller. |
| 7 | `export_web.py` | Exports the decoder and one RNN step to ONNX, the controller and starting latents to JSON, verifies them with onnxruntime, and writes `meta.json`. |

`common.py` holds the environment wrapper, frame preprocessing, controller
layout, and the scripted drivers used only during data collection. `models.py`
holds V and M and the explicit LSTM cell used for export.

## Reproduce

```bash
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install torch --index-url https://download.pytorch.org/whl/cu130   # pick the index for your CUDA
uv pip install "gymnasium[box2d]" numpy cma onnx onnxruntime pillow imageio imageio-ffmpeg tqdm

W=/path/to/workdir
python collect.py --out-dir $W/rollouts --episodes 2000
python train_vae.py --data-dir $W/rollouts --out-dir $W/vae --steps 50000
python encode_series.py --data-dir $W/rollouts --vae $W/vae/vae.pt --out $W/series.npz
python train_rnn.py --series $W/series.npz --out-dir $W/rnn --steps 4000
python train_controller.py --vae $W/vae/vae.pt --rnn $W/rnn/rnn.pt --out-dir $W/controller --hours 2.5
python evaluate.py --vae $W/vae/vae.pt --rnn $W/rnn/rnn.pt --controller $W/controller/controller_best.json --out-dir $W/eval
python export_web.py --vae $W/vae/vae.pt --rnn $W/rnn/rnn.pt --controller $W/controller/controller_best.json \
  --series $W/series.npz --data-dir $W/rollouts --out-dir ../model \
  --summaries $W/vae/vae_summary.json $W/rnn/rnn_summary.json $W/controller/controller_summary.json $W/eval/eval_summary.json
```

Box2D needs `swig` and a C++ compiler at install time. The environment renders
headlessly through pygame's dummy video driver, which `common.py` sets.

## Where this differs from the paper

- **Data.** The paper recorded 10,000 random-policy rollouts. This run records
  2,000 rollouts, and 60% of them use a noisy scripted track follower that reads
  the simulator's track geometry, so V and M see real driving at many speeds.
  The scripted driver is never used by the agent.
- **Budget.** V trains for 50k steps of batch 128 (about 3 epochs over 1.9M
  frames) instead of 10 epochs over 10M frames; M keeps the paper's 4,000
  steps. CMA-ES runs for a fixed time budget with 4 tracks per candidate per
  generation instead of 16, with a 32-track evaluation every 10 generations.
  The paper trained for far longer on a 64-core machine.
- **Early stopping during search.** Training rollouts end when the car has
  not reached a new track tile for 100 steps. Evaluation rollouts never stop
  early.
- **Environment.** Gymnasium `CarRacing-v3` rather than the 2018 `CarRacing-v0`;
  the task and scoring are the same, the frame preprocessing drops the paper
  code's accidental colour inversion.

The results of this particular run are on the demo page and in
`../model/meta.json`.
