---
layout: post
title: "Lecture 3: one push, explained"
subtitle: "A real PushT simulator on the DGX Spark makes environments, actions, and rollouts visible."
date: 2026-10-19
categories: [world-models]
tags: [world-models, simulation, cis6280, dgx-spark]
interactive: true
image: /experiments/lecture-03-pusht/preview.png
image_alt: "A blue pusher below a gray T-block and a green goal in PushT."
---

[Lecture 3 of CIS 6280](https://jiataogu.me/cis6280-world-models/lectures/lecture-03-environments-simulators-rollouts.pdf) asks where the next observation comes from. This companion demo makes that question concrete: choose an action, advance a small physics world, and inspect the result.

[Open the recorded explorer]({{ '/experiments/lecture-03-pusht/' | relative_url }}). It runs in the browser using frames and transitions recorded from the real Stable World Model PushT environment on my DGX Spark.

{% include experiment.html id="lecture-03-pusht" %}

## Follow one action

The blue circle is the pusher. The gray T is a movable rigid body. The green T marks the goal and does not collide with anything.

An action has two numbers. For example, `[0, -0.5]` puts the pusher's target 50 units above its current position. A feedback controller moves the pusher toward that target while the physics engine handles collisions. Each action advances 0.1 simulated seconds through ten smaller updates.

The simulator then returns the observation, reward, and two ending flags. `terminated` means the goal was reached. The demo's `truncated` flag means its 500-action limit was reached. Repeating this loop produces a **rollout**: a recorded sequence of experience.

## Same action, different contact

Compare the two recordings. Both use upward actions. The off-center pusher starts 14 units to the right of the centered one, making the T turn. The centered push reaches the goal after seven actions; the off-center run misses it.

Pause or scrub the recording and inspect the T's position, orientation, velocity, and spin. Those numbers describe motion that a single picture cannot fully reveal. In this checkout, the environment returns numeric observation arrays, and a separate `render()` call supplies the picture. The inspector exposes additional mechanical state, including the T's velocity and spin.

## What kind of world model is this?

This is a **physics-based world model**: programmed mechanics predict the next state. The actions come from a fixed script or a human. There is no trained neural model or learned policy in this demo.

A learned world model would use collected transitions to learn a predictor of what happens next. These recorded experiments are the starting point: first understand how the environment produces experience, then try learning its dynamics.

The reward here is negative state distance, not a percentage of shape overlap. Higher is better, but success uses a separate check involving the pusher, the T's position, and its orientation. That is why the successful recording can still have a negative reward.

## Run it on the Spark

[Open the live DGX controls](https://spark-a4b4.tailef40b0.ts.net:8444/) from a device on my private Tailscale network. Reset a scene, click a target or choose an action, and export the resulting transitions. Each browser session has its own environment. The public replay remains available when the Spark is offline.

The implementation uses [Stable World Model at commit `10c26db`](https://github.com/galilai-group/stable-worldmodel/tree/10c26dbd5677083fa31dba69eb738b973845e9a4). A small local adapter keeps the rendered goal aligned with the scoring goal and adds the episode limit. PushT physics runs on the CPU; the GPU is available for subsequent learned-model work.
