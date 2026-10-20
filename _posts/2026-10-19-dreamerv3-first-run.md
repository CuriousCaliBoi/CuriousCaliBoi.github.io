---
layout: post
interactive: true
title: "DreamerV3: learning to survive in Crafter"
date: 2026-10-19
categories: [experiments]
tags: [world-models, reinforcement-learning, dreamerv3, crafter, dgx-spark]
excerpt: "A visual DreamerV3 agent in a small survival world: GPU training on the Spark, real recorded expeditions, and a look at what the model reconstructs."
---

[Crafter](https://github.com/danijar/crafter) is a small survival game with forests, water, monsters, resources, and tools. Its 17 actions and 22 achievements make a much richer environment than balancing a pole. An agent has to discover useful sequences: collect wood, build a table, make a tool, and reach new materials while keeping itself alive.

This notebook uses the actual [DreamerV3 implementation](https://github.com/danijar/dreamerv3/tree/e01491fad6434b2245a3b8ca201dd7faedcc458c). The agent observes a 64 × 64 image and learns an internal model of its world. Imagined experience inside that model helps train its policy—the part that chooses actions.

{% include experiment.html id="dreamerv3" %}

## What to explore

Play an expedition, slow it down, or step through its decisions. The inventory and achievements show what actually happened; an attempted crafting action does not mean a tool was successfully made. Click near the trail on the map to seek to that moment, or use the achievement list to jump to a discovery.

The three views show different things:

- **The world:** real simulator frames, rendered at higher resolution for the notebook.
- **Agent’s vision:** the actual 64 × 64 observation given to the model.
- **Reconstruction:** the current observation reconstructed from the model's internal state, using the same state that selected the action. This is a real neural-network output, not a predicted future frame.

The agent does not receive the full map or inventory panel as extra inputs. Those are there to help the viewer understand the recording. The map shows terrain at the episode's start; building and other changes remain visible in the game view.

## Running on the Spark

The visual model has 687,875 optimized parameters. It uses the GB10 GPU, JAX 0.6.2, and a separate Python 3.12 environment. A small compatibility option disables the compiler's Triton matrix-multiplication path, which failed for this workload. The earlier CPU CartPole environment remains available separately.

The run is intentionally small and early. The viewer reports the exact saved step count and training-update count, and includes every evaluation from world seeds 7, 23, and 42. Each seed also has a random-action comparison. Evaluation episodes stop at death or a 400-step cap. Rewards here are not the official Crafter benchmark score, and this does not establish that the game is mastered or that the agent consistently outperforms random actions.

The checkpoint is reloaded before export. Extra rendering preserves the game's random-number state so producing a higher-resolution picture does not alter the agent's environment. All recordings, inventory changes, actions, terrain, and checkpoint fingerprints are in the [run record](/dreamerv3/crafter/run.json).

## What runs on the website

The website replays fixed recordings; it does not run inference or train the agent. Playback, frame stepping, seed selection, map seeking, and the reconstruction view work when the Spark is offline. The [original CartPole playground](/dreamerv3/cartpole.html) is still available for hands-on keyboard and touch controls.

For local training, the [setup script](/dreamerv3/train/setup-crafter.sh), [locked GPU dependencies](/dreamerv3/train/requirements-crafter-gpu.lock), [compatibility patch](/dreamerv3/train/compatibility-crafter.patch), and [exporter](/dreamerv3/train/export_crafter.py) are in the [training folder](https://github.com/CuriousCaliBoi/CuriousCaliBoi.github.io/tree/main/dreamerv3/train). Run `bash setup-crafter.sh` there with Git and `uv` installed, then follow its printed command. To keep training, increase `--run.steps` while preserving the same model configuration and log directory.
