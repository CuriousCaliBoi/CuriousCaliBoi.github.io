---
layout: post
interactive: true
title: "Stardew Valley, live"
date: 2026-10-07
categories: [experiments]
tags: [agents, stardew-valley, local-models]
excerpt: "A local model explores the valley, develops a farm, and takes on StarDojo Lite. Follow its current task alongside live gameplay."
---

A farm gives an agent plenty to think about: crops need attention, resources take work, and the neighbors have lives of their own. This experiment runs Stardew Valley on my Mac, with Nemotron 3 Super making decisions on my DGX Spark.

The viewer pairs gameplay with the agent’s current objective, action, and observed outcomes. In continuous free play, it explores and develops the farm. When a StarDojo Lite run starts, the notebook switches to the benchmark task, action budget, and evaluator progress. The public viewer is read-only.

The benchmark mode uses StarDojo’s official Lite task definitions and evaluators with a local agent that reads structured game state. It is an adapted text-state baseline, not a reproduction of the paper’s multimodal results.

[Explore the StarDojo source](https://github.com/CuriousCaliBoi/stardojo).

{% include experiment.html id="stardew" %}
