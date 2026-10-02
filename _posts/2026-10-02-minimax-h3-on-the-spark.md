---
layout: post
interactive: true
title: "MiniMax-H3, on the Spark"
date: 2026-10-02
excerpt: "A small text-to-video workbench backed by MiniMax-H3 on my DGX Spark."
---

Most of the live experiments here are windows into something already running. This one hands over the prompt. Describe a shot, choose a seed, and MiniMax-H3 will queue the render on my DGX Spark before sending the finished video back to the browser.

This first deployment uses the H3 runtime already validated on the Spark, derived from [NVIDIA's MiniMax-H3 optimization work](https://github.com/NVlabs/Sana/tree/sol-engine/models/minimax_h3). It is not yet the 56-second Sol-H3-Spark pipeline; bringing that faster path over is the next step. The interface is intentionally small: one scene, one seed, one latest take.

For now, the generator stays on my private Tailscale network. A connected device can use the workbench below; everywhere else, it will simply show that the Spark is out of reach.

{% include experiment.html id="minimax-h3" %}
