---
layout: post
title: "Intuitive Calculus Notation"
date: 2024-01-08
categories: math calculus
---

When we write \\[\frac{dy}{dx}\\], we can think of it as a fraction-like object that tells us how \\(y\\) changes with respect to \\(x\\). This intuition is surprisingly powerful!

Consider the chain rule: \\[\frac{dy}{dx} = \frac{dy}{du} \cdot \frac{du}{dx}\\]

Notice how the \\(du\\) terms "cancel out" just like they would in a fraction. While this isn't mathematically rigorous, it helps remember the rule.

Similarly, when we write \\[\int f(x)dx\\], we can think of \\(dx\\) as an infinitesimally small piece of \\(x\\) that we're summing over. This helps explain why:

\\[\int \frac{1}{x}dx = \ln|x| + C\\]

Because when we differentiate \\(\ln|x|\\), the chain rule gives us \\[\frac{1}{x} \cdot \frac{dx}{dx} = \frac{1}{x}\\]

Even the fundamental theorem of calculus makes intuitive sense when we think about \\(dx\\) as tiny pieces:

\\[\int_a^b f'(x)dx = f(b) - f(a)\\]

We're adding up all the tiny changes (\\(f'(x)dx\\)) to get the total change from \\(a\\) to \\(b\\).
