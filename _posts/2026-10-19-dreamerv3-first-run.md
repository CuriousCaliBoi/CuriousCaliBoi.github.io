---
layout: post
interactive: true
title: "DreamerV3: a small world, a first run"
date: 2026-10-19
categories: [experiments]
tags: [world-models, reinforcement-learning, dreamerv3, dgx-spark]
excerpt: "An actual DreamerV3 training run on the Spark, a playable balancing experiment, and eight recorded evaluations against random actions."
---

[DreamerV3](https://danijar.com/project/dreamerv3/) learns a model of its environment and uses imagined experience to improve its decisions. The same general approach has been demonstrated on games and simulated control tasks, including collecting diamonds in Minecraft without human demonstrations. Those research results involve substantial training; installing the repository does not produce an agent that already knows those tasks.

This notebook starts smaller: move a cart left or right to keep a pole upright.

{% include experiment.html id="dreamerv3" %}

## What actually ran

The training uses [Danijar's implementation](https://github.com/danijar/dreamerv3/tree/e01491fad6434b2245a3b8ca201dd7faedcc458c), with its small `size1m` configuration, on the **CPU of the DGX Spark**. The optimized model has 637,381 parameters. The agent observes four numbers: cart position, cart velocity, pole angle, and angular velocity. This run does not learn from camera images.

The repository pins an older JAX and CUDA stack. The verified setup keeps JAX 0.4.33 and uses Python 3.12, NumPy 1.26, and float32 calculations on the CPU. This establishes a working learning loop; GPU training on the GB10 is not enabled or verified here. The local patch also handles Gym 0.26's reset and step results, preserves the difference between failure and reaching a time limit, and saves a final checkpoint.

| Measurement | Result |
| --- | --- |
| Environment steps, including resets | 10,008 |
| Training updates saved | 1,204 |
| Evaluation episodes per controller | 8 |
| DreamerV3 mean reward | 38.875 / 500 |
| Random actions mean reward | 20.875 / 500 |

Each controller starts from the same eight environment seeds. All eight episodes are included in the viewer. This small comparison is a setup check, not a statistical significance test or a claim that the task is solved. A saved model was reloaded to produce the evaluations.

## What runs in the browser

**You balance** runs the CartPole physics with keyboard or touch controls. Releasing both directions applies no force, an extra convenience for the playground; the trained agent only has left and right actions.

**Dreamer replay** shows recorded observations and actions from the saved model. Change the seed, slow down playback, scrub through individual steps, or compare random actions. These controls inspect fixed recordings. They do not run the neural network, change its decisions, or display its imagined states.

The [evidence file](/dreamerv3/run.json) includes trajectories, training samples, the source revision, and checkpoint and configuration fingerprints. The page remains usable when the Spark is offline.

## Reproduce the run

The [setup script](/dreamerv3/train/setup.sh), [locked dependencies](/dreamerv3/train/requirements-cpu.lock), [compatibility patch](/dreamerv3/train/compatibility.patch), and [replay exporter](/dreamerv3/train/export_run.py) are available together in the [training folder](https://github.com/CuriousCaliBoi/CuriousCaliBoi.github.io/tree/main/dreamerv3/train). With Git and `uv` installed, download that folder, run `bash setup.sh`, then use the command it prints. A completed run can continue by increasing `--run.steps` while keeping the same log directory.

Longer training, GPU compatibility, and live model inference would be separate next experiments. This first run establishes a working starting point and makes its current limits visible.
