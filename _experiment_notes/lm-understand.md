---
layout: post
title: "Neural network weights: experiment records"
date: 2026-11-03
permalink: /experiments/lm-understand/
categories: [experiments]
excerpt: "Recorded results, prompts, Codex trajectories, evaluation files and reproduction source for eight neural-network weight experiments."
---

Collected records for a replication of RikiyaT's *Sparks of Weight Space Programming: LLMs can understand and write neural network weights*. This page compiles the existing materials without adding further analysis.

The result and completion snapshot is dated **3 November 2026, 15:50 UTC**. The complete Experiment 1–6 trajectory package was assembled later that day. Experiments 7 and 8 remain incomplete in this snapshot. This is a static archive, not a live progress feed.

## Records and downloads

- [Read the original and fresh trajectories](trajectories/index.html): 21 original and 21 fresh conversations, with 485 recorded main turns.
- [Download all Experiment 1–6 trajectories](downloads/trajectories-1-through-6-public.zip): full recorded prompts, replies, CLI reasoning summaries, permitted harness calls, feedback, errors and settings.
- [Download the evaluation records and saved game policies](downloads/evaluation-records-public.zip).
- [Download the existing Experiment 7–8 conversation records](downloads/experiments-7-8-recorded-conversations-public.zip), including incomplete and prepared cases.
- [Read the complete file reference](records/file-reference.txt) for all 8,097 files in the pinned original release.
- [Download the reconstruction source snapshot](downloads/reproduction-source-public.zip) and [read its reproduction guide](records/reproduction-guide.txt).
- [Recorded results](records/recorded-results.txt), [completion snapshot](records/status-snapshot.json), [scope](records/scope-snapshot.txt), and [Experiment 1–6 comparison data](records/results-1-through-6.json).

The public copies replace private machine paths and host identifiers with placeholders. Numerical results and weights are retained. Each download includes a publication manifest with hashes for the public copies. Embedded original hashes continue to identify the local source artifacts. The source bundle is a dated snapshot; its historical run-state wording does not supersede the completion snapshot above.

## Tool settings

Built-in Codex tools were disabled in the experimental sessions. The existing event audit records **zero built-in tool calls across all 244 fresh turns in Experiments 1–6**.

| Experiments | Permitted experiment-time execution |
|---|---|
| 1, 2, 4, 5 | None |
| 3 | Separate Python harness for weight analysis; no forward passes. 50 fresh Python executions. |
| 6 | Separate Python and feedback harness. 88 fresh Python executions, 81 games calls and 4 positions calls. |

The external harness capabilities in Experiments 3 and 6 are part of the published protocol. Recorded reasoning entries are the summaries emitted by the CLI. [Full tool-use audit](trajectories/tool-audit.json).

## Experiment 1: identify the game

Four trained game policies were shown as weights. The original and fresh responses each identified **4/4 game categories**. Both use the published scoring alias that accepts Frogger for Freeway.

## Experiment 2: identify the diffusion shapes

Three diffusion models were trained on filled circles, squares and triangles. Each model has 23,824 weights. The reader received the architecture and weights, with no tools or forward passes.

The original and fresh responses each identified **3/3 shape categories**. Both described all three as hollow outlines; the generated shapes are filled.

## Experiment 3: read the language-model blocks

| Recorded measure | Original | Fresh |
|---|---:|---:|
| Training corpus identified | 6/6 | 3/6 |
| Unshuffled token order identified | 6/6 | 6/6 |
| Exact copy-head set identified | 6/6 | 5/6 |

The fresh corpus identifications were English 2/2, Python 1/2 and romaji 0/2. Copy-head sets use the released induction threshold greater than 0.2.

## Experiment 4: repair the car policy

| Policy | Successful test episodes |
|---|---:|
| Authors' archived repair | 1,024/1,024 |
| Released repair evaluated again | 1,024/1,024 |
| Fresh repair | 0/1,024 |

The released repair averaged 73 steps. Every fresh repair test episode ended in a red collision, with mean length 33.15625 steps. The rounded unedited policy timed out.

## Experiment 5: write MinAtar policies

Mean score ± standard error over 1,000 episodes per policy. “Released rerun” evaluates the authors' saved weights; “fresh” evaluates the newly written policy.

| Game | Authors' archived mean | Released rerun | Fresh |
|---|---:|---:|---:|
| Breakout | 517.411 | 496.270 ± 7.817 | 380.585 ± 6.176 |
| Seaquest | 53.110 | 51.533 ± 1.348 | 35.245 ± 0.842 |
| Asterix | 53.178 | 52.202 ± 0.992 | 64.378 ± 0.942 |

The unavailable original PPO baseline checkpoints are not reproduced. The planned replacement PPO training campaign was cancelled before launch.

## Experiment 6: write Go policies

Mean win rate against the released same-size PPO opponents, seeds 0 and 2, over 4,000 games per policy:

| Feedback passes | Authors' archived result against these opponents | Released rerun | Fresh |
|---|---:|---:|---:|
| 0 | 39.400% | 40.275% | 19.500% |
| 10 | Not reported | 49.825% | 69.375% |
| 25 | Not reported | 47.950% | 69.750% |
| 50 | 76.350% | 77.225% | 85.125% |

The original headline results used different, smaller opponents whose checkpoints were unavailable: 54.525%, 66.400%, 69.125% and 82.400% for 0, 10, 25 and 50 passes. Those scores are not directly comparable with the table above. The reconstructed evaluation recorded 48,000 games across all four budgets, two policies and three opponents, including random.

## Saved evaluation figure

![Previously compiled car, MinAtar and Go evaluations](figures/audited-evaluations.png)

This existing figure compares released-policy reruns with fresh policies in the reconstructed evaluations. [PDF](figures/audited-evaluations.pdf) · [Figure data](records/evaluations-data.json).

## Experiment 7: identify sycophancy

The snapshot records six reconstructed Gemma fine-tunes and **10 of 15 completed reader trials**. The original fine-tuned checkpoints were unavailable.

| Fine-tune pair | Honest model: wrong-answer preference | Sycophantic model: wrong-answer preference |
|---|---:|---:|
| 100 | 2.08% | 100% |
| 101 | 0% | 100% |
| 102 | 3.42% | 100% |

These are teacher-forced candidate-answer probability comparisons, not free-generation accuracy. Six of the seven completed weights-only readers returned 50/50 ties; the remaining reader chose incorrectly at 52% confidence. All three attention-assisted readers identified the correct model, assigning it probabilities 97%, 90% and 80%. Remaining readers were waiting on account allowance in this snapshot. No selection-dependent causal patching result is reported.

## Experiment 8: edit language models for math

No fresh final edited-model outcome is available in the snapshot. The Qwen 10-pass editor stopped after a provider rejection; Qwen 25-pass and Gemma 5-pass editors stopped after their first practice passes on an account usage limit. Prepared prompts and partial conversations are retained in the supplemental download and are not labelled as completed experiments.

The previously recorded, audited Qwen practice baseline was 33/256 correct. The initial Gemma base MATH500 shard was 1/32 under lenient grading and 0/32 under strict grading. These are a practice baseline and a small benchmark shard, respectively, not final full-benchmark scores. Standalone benchmark jobs were running at the saved status time.

## Original files and weights

The original release is pinned to commit `4d09ba6d6a7e891dd8063974dfe81b3d78e3494f`. The links below retain the original NPZ files, prompts, evaluation records and licenses. Large native language-model checkpoints and gated datasets are not mirrored here.

| Experiment | Pinned release |
|---|---|
| 1 | [Files, prompts and available weights](https://github.com/RikiyaT/lm_understand-logs/tree/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp1_which_game) |
| 2 | [Files, prompts and available weights](https://github.com/RikiyaT/lm_understand-logs/tree/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp2_diffusion) |
| 3 | [Files, prompts and available weights](https://github.com/RikiyaT/lm_understand-logs/tree/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp3_language) |
| 4 | [Files, prompts and available weights](https://github.com/RikiyaT/lm_understand-logs/tree/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp4_fix_car) |
| 5 | [Files, prompts and available weights](https://github.com/RikiyaT/lm_understand-logs/tree/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp5_write_from_scratch) |
| 6 | [Files, prompts and available weights](https://github.com/RikiyaT/lm_understand-logs/tree/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp6_go_from_scratch) |
| 7 | [Files, prompts and available weights](https://github.com/RikiyaT/lm_understand-logs/tree/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp7_sycophancy) |
| 8 | [Files, prompts and available weights](https://github.com/RikiyaT/lm_understand-logs/tree/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f/exp8_math) |

## Recorded scope and provenance

These are individual fresh trials using the released prompts and numerical artifacts where available. Missing evaluators were reconstructed, with new random streams and documented runtime differences. Experiment 6 substitutes released opponents and retains the prompt diffs. The historical model alias does not pin an identical backend snapshot. Original archived scores, rerun released policies and fresh outputs are labelled separately.

The reconstruction source snapshot is commit `66f3553f358dfeace0421ff851d2eb3ad5edf765`. It excludes model weights, datasets and authentication. The recorded source-package and trajectory checks are included as historical records; publishing the files did not rerun the experiments.

Original work and artifacts: [RikiyaT/lm_understand-logs](https://github.com/RikiyaT/lm_understand-logs/tree/4d09ba6d6a7e891dd8063974dfe81b3d78e3494f). Original logs, data and networks are CC BY 4.0; original scripts are MIT; the included MinAtar source retains GPL-3.0. [Original license](LICENSE-original.txt) · [MinAtar license](LICENSE-MinAtar.txt) · [Public export notes](PUBLICATION.txt) · [Download checksums](download-manifest.json).
