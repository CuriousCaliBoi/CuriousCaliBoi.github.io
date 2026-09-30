---
layout: post
interactive: true
title: "JAZ traces, live"
date: 2026-09-30
excerpt: "A private, live view of the Python trajectory behind each JAZ agent run on my DGX Spark."
---

JAZ agents work through tasks by writing Python, running it in a persistent REPL, and using the result to decide what to do next. This viewer makes that trajectory easy to follow: every generated cell sits beside its result, with retries, nested agents, token counts, and the final return value in the same timeline.

New ATIF traces recorded on the Spark appear in the list automatically. The files can contain prompts, code, and outputs, so the live feed stays on my private Tailscale network instead of being copied to the public site.

{% include experiment.html id="jaz-traces" %}
