---
layout: post
interactive: true
title: "World Models, from the 2018 paper to your browser"
date: 2026-10-18
categories: [experiments]
tags: [world-models, reinforcement-learning, dgx-spark, browser]
image: /images/world-models-carracing/preview.png
image_alt: "Three rows of CarRacing frames: what the agent sees, what the VAE reconstructs, and what the MDN-RNN dreams given the same actions"
excerpt: "The original World Models recipe, a VAE, an MDN-RNN, and a tiny controller found by CMA-ES, trained on CarRacing on my DGX Spark and exported so the dream runs in your browser."
---

In 2018 David Ha and Jürgen Schmidhuber published [World Models](https://worldmodels.github.io/): an agent that compresses what it sees, learns to predict what happens next, and can even train inside its own prediction. The paper's web page let you drive around inside the model's dream, and that demo is a big part of why I care about world models at all. I wanted the original example, not a descendant, trained end to end on my own hardware and running somewhere anyone can poke at it.

{% include experiment.html id="world-models-carracing" %}

## The recipe

Three parts, trained one after another:

- **V**, a convolutional variational autoencoder, turns each 64×64 frame of CarRacing into a 32-dimensional latent $z$.
- **M**, an LSTM with 256 units and a mixture-density output, predicts the next latent from the current one and the action, $p(z_{t+1} \mid z_t, a_t, h_t)$, as a mixture of five Gaussians per dimension. A temperature $\tau$ scales how boldly it samples from that mixture.
- **C**, a single linear layer from $[z_t, h_t]$ to the three car controls, 867 parameters in all, found by CMA-ES rather than by gradient descent.

Only V's decoder, one step of M, and C are needed to dream. In the page above they run as two small ONNX graphs and a 20 kB JSON file through onnxruntime-web; nothing talks to a server. The agent reads an action off the current latent and memory, M predicts the next latent, the decoder paints it, and the loop repeats at whatever frame rate you choose. Arrow keys take the wheel away from the agent.

## Training it on the Spark

Everything ran on one DGX Spark: the GPU for V and M, nineteen CPU workers for the controller search.

| Stage | This run | Paper |
| --- | --- | --- |
| Rollouts recorded | 2,000 episodes, 1,920,131 frames | 10,000 episodes |
| V | 50k steps of batch 128 in 6 min, validation reconstruction error 10.7 per frame | 10 epochs over 10M frames |
| M | 4,000 steps of batch 100 in 6 min, validation NLL 0.941 per latent | 4,000 steps |
| C | CMA-ES, population 64, 4 tracks per candidate, 102 generations in 2.5 h | population 64, 16 tracks per candidate |
| Score on 100 unseen tracks | **891 ± 73** | 906 ± 21 |

Scores are the mean total reward over 100 random tracks, where roughly 900 means a clean lap at speed.

The data is where I strayed furthest from the paper. The original recorded 10,000 rollouts from random policies. Random actions in CarRacing mostly produce a car wobbling around the start line, so V and M would barely see the thing the agent later has to do: drive fast around curves. I recorded 2,000 rollouts and had 60% of them driven by a noisy scripted follower that reads the simulator's track geometry, at speeds from a crawl to a slide, with random bursts of bad steering so leaving and rejoining the road is in the data too. The scripted driver is never used by the agent; it only decides what the models get to watch.

The controller search ends training rollouts early when the car has not reached a new track tile in 100 steps, which makes the first generations, where almost every candidate sits in the grass, cheap. The reported scores come from full 1,000-step episodes on tracks the search never saw.

## What the dream gets right and wrong

Start the dream mid-lap and let the agent drive: M produces curves of sensible radius, C steers into them the way it does in the real game, and the road usually stays coherent for hundreds of steps. The frames are softer than the real ones, since everything has to pass through 32 numbers, and the grass tiles blur into green patches. The interesting part is where it breaks. Every so often a curve resolves into a fork or a bend that was never in the data, which is exactly the kind of hallucination the paper discusses. Drive straight off the road and the dream has no landmarks left: it will happily show you grass until a road materialises from the mixture noise, which can take a while.

Temperature changes the character of all of this. Below about 0.5 the road hardens and the dream gets repetitive, because the sampler keeps picking the dominant mixture component. Above 1.5 bends appear and vanish between frames. The paper found that a slightly hotter dream than reality made a better training ground for its Doom agent; here you can feel why, since the hot dream exaggerates the situations the controller has to recover from. Restart at the grid and you also get the 50-frame zoom-in from the start of every CarRacing episode, dreamed from scratch, because it was in every rollout the models ever saw.

## Differences from the paper

- Gymnasium's `CarRacing-v3` instead of the 2018 `CarRacing-v0`; same task and scoring.
- 2,000 recorded rollouts with the scripted driver described above instead of 10,000 random ones.
- V trained for about three passes over the data instead of ten; M kept the paper's budget; C had a fixed time budget with 4 tracks per candidate instead of 16.
- The paper code's frame preprocessing accidentally inverted colours; mine does not.

## Code

Everything from the recorder to the ONNX exporter is in [world-models-carracing/train](https://github.com/CuriousCaliBoi/CuriousCaliBoi.github.io/tree/main/world-models-carracing/train) in this site's repository, about 900 lines of PyTorch. The demo is a single page of vanilla JavaScript; the models it loads are static files, so this page keeps working when the Spark is off.
