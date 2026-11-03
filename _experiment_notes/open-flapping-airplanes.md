---
layout: post
title: "Training, serving, and Doom on one GPU"
date: 2026-11-03
permalink: /experiments/open-flapping-airplanes/
image: /experiments/open-flapping-airplanes/dashboard.jpg
image_alt: "The recorded Open Flapping Airplanes dashboard showing training loss, generated text, and Doom."
---

[Open Flapping Airplanes](https://github.com/Bobliuuu/open-flapping-airplanes) puts language-model training, text generation, and the Doom engine inside one persistent CUDA kernel. This experiment reproduced its `llm/ofa_fast` model-S run on a Brev A100 SXM4 40 GB.

**All 4,000 training steps completed with Doom running. Two limitations emerged:** training took 661.410 seconds versus the reported 190.7 seconds, and serving stopped early at 333,659 tokens. Final training loss was 2.149003.

This page is a saved experiment record. The images and measurements come from the actual GPU run; opening the page does not start cloud compute.

## What ran

The model has 162,417,408 parameters, 12 layers, a width of 768, and 12 attention heads. Each training step processes eight sequences of 512 tokens: 4,096 tokens per step, or 16,384,000 token positions across the full run. Training uses tokenized TinyStories and AdamW, starting from seeded initial weights.

The A100 has 108 streaming multiprocessors (SMs), the GPU units that execute groups of threads. The program partitions them by workload:

| Workload | SMs | Role |
| --- | ---: | --- |
| Training | 85 | Forward pass, backward pass, and weight updates |
| Serving | 17 | Autoregressive text generation from the changing model |
| Doom | 6 | Game simulation and rendering |

Instead of returning control to the CPU after each small operation, resident GPU blocks repeatedly take tasks from the program's scheduler. The source launches 216 persistent blocks, two per SM. This is spatial sharing within a long-running kernel, rather than three independent GPU applications.

The language model does **not** play Doom. A [scripted player in the upstream engine](https://github.com/Bobliuuu/open-flapping-airplanes/tree/9dd7dd0d3c1fc0245b43897eacd8d62aa096c4c1/doom-gpu) reads game state and produces player commands. Doom is a separate concurrent workload.

## Measured results

| Metric | This Brev run | Upstream report |
| --- | ---: | ---: |
| Completed training steps | 4,000 | 4,000 |
| CUDA event time | 661.410 s | 190.7 s |
| Steady training time | 165.35 ms/step | 47.67 ms/step |
| Training throughput | 24,772 tokens/s | About 85,900 tokens/s |
| Final training loss | 2.149003 | 2.1490 |
| Serving, averaged over training | 505 tokens/s; stopped early | 591 tokens/s |
| Doom | 35.0 frames/s | 35.0 frames/s |

The comparison is to the [upstream `ofa_fast` README at the tested commit](https://github.com/Bobliuuu/open-flapping-airplanes/blob/9dd7dd0d3c1fc0245b43897eacd8d62aa096c4c1/llm/ofa_fast/README.md), not to baselines rerun on this machine. Training took **3.47 times as long**. These are single-run measurements; there are no confidence intervals.

CUDA event time measures the kernel interval. It excludes instance provisioning, image building, data preparation, and compilation. Steady training time uses the program's device timestamps after its first four completed steps. Serving and Doom rates are the program's reported run aggregates.

![Training loss across all 4,000 steps, with individual losses and a 50-step moving average.]({{ '/experiments/open-flapping-airplanes/training-loss.svg' | relative_url }})

All 4,000 recorded losses were finite. Loss fell from 11.710649 to 2.149003, agreeing with the upstream final loss at its reported precision of 2.1490. The first 100 loss records match the separate smoke run byte for byte. This is evidence that the training path runs and is repeatable within this environment; training loss alone does not establish generalization or match every upstream numerical result.

[Download every training loss (CSV)]({{ '/experiments/open-flapping-airplanes/loss.csv' | relative_url }}) · [Measured summary (JSON)]({{ '/experiments/open-flapping-airplanes/summary.json' | relative_url }}) · [Kernel log]({{ '/experiments/open-flapping-airplanes/run.log' | relative_url }})

## The recorded dashboard

[![A captured dashboard with a falling training-loss curve, generated TinyStories text, and Doom running beside it.]({{ '/experiments/open-flapping-airplanes/dashboard.jpg' | relative_url }})]({{ '/experiments/open-flapping-airplanes/dashboard.jpg' | relative_url }})

This screenshot was captured during the run. Its instantaneous rates and loss can differ from the final aggregate measurements above. The website preserves the capture, not a live connection to the A100.

## What we learned

### A functional reproduction and a performance reproduction are separate results

Training, serving, and Doom initially made progress together. Serving ran at roughly 600 tokens/s before hitting the limit described below; Doom maintained 35 frames/s. Training was much slower than reported. A successful build and a convincing dashboard are therefore insufficient evidence for the original performance or sustained-serving claims. Keeping the complete loss history, observations, and timing output makes that distinction inspectable.

The repository describes one persistent kernel for the main workload. The executable also contains a setup kernel for decoding embeddings. This run did not measure launch counts with a profiler, so it does not claim that the entire process performs exactly one CUDA launch.

### A longer run exposed a scheduler overflow

The dashboard's token counter stopped at **333,659** around 555.5 seconds into the run, while training and Doom kept advancing. The final token file confirms that count. The [scheduler](https://github.com/Bobliuuu/open-flapping-airplanes/blob/9dd7dd0d3c1fc0245b43897eacd8d62aa096c4c1/llm/ofa_fast/ofa.cu#L222) computes its task budget as a 32-bit unsigned product. For serving, its configured limit is 4,194,304 iterations with 2,225 tasks per token:

```text
4,194,304 × 2,225 = 9,332,326,400 tasks
9,332,326,400 modulo 2^32 = 742,391,808 tasks
floor(742,391,808 / 2,225) = 333,659 complete tokens
```

The arithmetic predicts the observed cutoff exactly. At about 600 tokens/s, a 190-second run would finish well before reaching it; this slower run exposed it. Fixing the budget requires consistent counter widths or a validated limit that fits the existing counters, followed by a boundary test and another full run. The recorded experiment preserves the upstream code unchanged and does not claim that fix has been tested.

[Serving progress and validation record]({{ '/experiments/open-flapping-airplanes/validation.json' | relative_url }}) · [Recorded progress samples (CSV)]({{ '/experiments/open-flapping-airplanes/progress.csv' | relative_url }})

### Generated machine code is part of the experiment

The build used the upstream CUDA source unchanged, with `nvcc` 12.8.93 and LLVM 14. The resulting compiler report nevertheless differs from the upstream description. For `run_gemm`, this build reports **2,856 bytes of spill stores and 2,388 bytes of spill loads**; the README describes roughly 12 bytes of spills for the non-relocatable build. The main kernel uses 128 registers and a 2,864-byte stack frame.

Spilling moves register values through memory and can hurt a matrix-multiplication hot path. The discrepancy is a concrete lead, **not a demonstrated explanation for the entire slowdown**. The next useful experiment is to compare generated code and compiler flags against the upstream fast binary, then change one factor at a time. GPU clock and temperature samples were also recorded, but clocks and thermals were not controlled in this comparison.

[Compiler resource report]({{ '/experiments/open-flapping-airplanes/compiler-resources.txt' | relative_url }}) · [Observed GPU samples]({{ '/experiments/open-flapping-airplanes/gpu-samples.csv' | relative_url }})

### Reproducibility needs inputs and an environment record

The reproduction pins the source, Doom engine, TinyStories revision, and CUDA base-image digest. It records input SHA-256 hashes, compiler output, and installed package versions. A 100-step smoke run checked the execution path before the full run; both used the 4,000-step learning-rate schedule.

The dashboard can expose an incomplete UTF-8 sequence while a token is being written. The capture wrapper decodes those observations with replacement characters and tolerates transient HTTP failures. These changes affect observation capture, not the CUDA training code. The loss file comes directly from the program.

The container definition pins the main Python dependencies, but some operating-system and transitive packages still resolve at build time. The saved package inventory records what was actually installed; the recipe is not a promise of a bit-identical future container.

## Reproduce the run

[Download the reproduction scripts]({{ '/experiments/open-flapping-airplanes/reproduction.tar.gz' | relative_url }}). On an otherwise idle x86-64 A100 machine with Docker and NVIDIA Container Toolkit:

```sh
tar -xzf reproduction.tar.gz
cd brev-a100
bash launch.sh --steps 100
bash launch.sh --steps 4000
```

The first invocation builds the image and prepares data. Results are saved under `artifacts/results/`. The wrapper uses a 1,200-second execution timeout, exits when training finishes, and leaves the VM running. Cloud billing continues until the instance is stopped or deleted through the provider.

| Component | Recorded version |
| --- | --- |
| Source | [`9dd7dd0d3c1fc0245b43897eacd8d62aa096c4c1`](https://github.com/Bobliuuu/open-flapping-airplanes/tree/9dd7dd0d3c1fc0245b43897eacd8d62aa096c4c1) |
| GPU | NVIDIA A100-SXM4-40GB |
| Driver | 535.161.08 |
| CUDA compiler | 12.8.93 |
| LLVM | 14.0.0 |
| TinyStories revision | `f54c09fd23315a6f9c86f9dc80f725de7d8f9c64` |
| Doom engine | `e257a09527062bfb986b6e5e0780839b6cbd5b71` |

[Input fingerprints]({{ '/experiments/open-flapping-airplanes/data-manifest.json' | relative_url }}) · [Installed package inventory]({{ '/experiments/open-flapping-airplanes/environment-packages.txt' | relative_url }})

No Megatron, vLLM, or PyTorch training baseline was rerun, and no upstream speedup over those frameworks is claimed. PyTorch was used on the CPU only to generate initial weights. No held-out evaluation was run, and no final model checkpoint was exported. The website holds measurements, images, and a runnable recipe; it is not a resumable training checkpoint.

The original CUDA implementation is by the Open Flapping Airplanes contributors. Doom and doomgeneric retain their separate licenses. The downloadable recipe contains no Doom WAD, dataset, or model weights.
