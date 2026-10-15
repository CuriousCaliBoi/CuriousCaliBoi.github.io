---
layout: post
interactive: true
title: "World Models from Scratch: the first useful failure"
date: 2026-10-15
subtitle: "My first Craftax model learned the rare changes—and still lost to predicting that nothing changes."
categories: [AI, Learning in Public]
tags: [world-models, craftax, dgx-spark]
---

I want to learn world models in public: pencil and paper first, then small experiments whose failures are preserved instead of polished away. The longer-term question is whether an agent can learn how a world changes and improve its decisions by practicing inside that learned world.

## Milestone 01: open world, tiny model

The first executable rung uses Stable World Model and Craftax Classic on my DGX Spark. A random agent produced the replay below. A deliberately small neural network then tried to predict the next 1,345-number symbolic state, reward, and death from the current state and action.

{% include experiment.html id="world-models" %}

## The first useful failure

Only 0.554% of held-out state features changed on a typical transition. The model reduced error on those rare changes by 42%, but it introduced errors into many features that should have stayed fixed. Its total one-step error was therefore 6.5 times worse than simply copying the current state.

The reward and death scores carried the same warning. “Always predict zero reward” beat the learned reward head. The death head reported 98.61% accuracy, but “always predict alive” earned exactly the same score, and the model found none of the deaths.

That gives me the next pencil-and-paper question:

> If almost everything stays unchanged, how do I teach a model the rare changes without letting it damage the stable parts?

## Reflection to write before Milestone 02

<!-- Add the learner's own explanation here before publishing:
- What did “copy the current state” mean as a baseline?
- What did the model genuinely learn?
- Why was overall accuracy still worse?
- What should an exact copy-plus-change model predict? -->
