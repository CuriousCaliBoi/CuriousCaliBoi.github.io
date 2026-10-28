# CS 312 Assignment 1 data contract

`results.json` is the single generated input for the dashboard. The exporter can
replace that file atomically; the HTML, CSS, and JavaScript do not need to be
regenerated.

```json
{
  "generated_at": "2026-10-28T18:00:00Z",
  "assignment": {
    "title": "Assignment 1: Basics — Empirical Machine Learning",
    "url": "https://deep-learning-alchemy.github.io/assets/assignments/a1_basics.pdf",
    "course": "CS 312",
    "problems": [
      {"id": "p1", "title": "Hyperparameters", "expected_runs": 50}
    ]
  },
  "status": "running",
  "expected_runs": 155,
  "runs": [
    {
      "id": "modal-call-or-wandb-id",
      "name": "model-d8-lr0.003-tok614.4M",
      "problem": "p1",
      "group": "learning-rate-sweep",
      "state": "completed",
      "url": "https://wandb.ai/example/project/runs/example",
      "gpu": "H100",
      "config": {
        "model": "d8",
        "learning_rate": 0.003,
        "batch_size": 64
      },
      "summary": {
        "final_train_loss": 2.9,
        "final_val_loss": 2.93,
        "elapsed_seconds": 720,
        "num_parameters": 35000000,
        "train_tokens": 614400000,
        "compute_flops": 1.12e17
      },
      "history": {
        "train_loss": [[0, 8.31], [100, 5.42]],
        "val_loss": [[0, 8.30], [100, 5.38]],
        "learning_rate": [[0, 0], [100, 0.003]]
      }
    }
  ]
}
```

Supported run states are `queued`, `running`, `completed`, and `failed`.
Missing fields are displayed as unavailable instead of preventing the rest of
the export from rendering. History series use compact `[step, value]` pairs.

The dashboard uses the common fields above for its terminal scatter, run
ledger, P1 sweep and heatmap, P2 scaling families, P3 grouped terminal-loss
records, and P4 paired loss-gap plot. P6 also accepts any history key beginning
with `logging/rms/`; those keys are offered directly in the RMS metric selector.
