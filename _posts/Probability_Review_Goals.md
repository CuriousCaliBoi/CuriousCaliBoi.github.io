1. Probability Basics

Core Concepts
	•	Random variables (discrete and continuous)
	•	Probability density functions (PDF) and cumulative distribution functions (CDF)
	•	Expectation, variance, higher moments (skewness, kurtosis)
	•	Joint, marginal, and conditional distributions

Why it’s important
	•	In interpretability, we’re often concerned with how changes in inputs (random variables) affect the output of a model. For instance, “feature importance” can be viewed through how output distributions shift when we vary a given input.
	•	Many interpretability methods rely on approximating expectations (e.g., Shapley values compute changes in expected output).

2. Multivariate Distributions

Core Concepts
	•	Multivariate normal distribution (the “Gaussian workhorse”)
	•	Covariance matrices (understanding correlation structure)
	•	Elliptical distributions (Student’s t, etc.)
	•	Transformations of random variables and Jacobians

Why it’s important
	•	High-dimensional data is the norm in ML; understanding how features jointly vary is crucial for advanced techniques like feature attribution.
	•	Many interpretability algorithms (like SHAP) rely on sampling procedures that need to approximate the joint distribution of inputs.

3. Fundamental Theorems and Convergence

Core Concepts
	•	Law of Large Numbers (LLN)
	•	Central Limit Theorem (CLT)
	•	Delta method
	•	Convergence in distribution vs. convergence in probability

Why it’s important
	•	Interpretability methods often rely on sampling or repeated estimations. For example, kernel SHAP uses repeated sampling of feature subsets and uses the CLT to justify accuracy of estimates.
	•	Understanding how sample estimates converge is key to evaluating whether an interpretability method is stable or if more samples are required.

4. Parametric and Nonparametric Models of Distribution

Core Concepts
	•	Common parametric families (Normal, Exponential, Gamma, Beta, Poisson, Binomial, etc.)
	•	Estimating parameters (maximum likelihood estimation, Bayesian estimation)
	•	Nonparametric density estimation (kernel density estimation)

Why it’s important
	•	For local or global surrogate models (a popular interpretability technique), you might fit simple parametric or nonparametric distributions to features.
	•	Nonparametric approaches let you approximate complex, unknown distributions which is often useful in high-dimensional interpretability tasks.

5. Linear Algebra & Matrix Decompositions

Core Concepts
	•	Vectors, matrices, norms, eigenvalues, eigenvectors
	•	Singular Value Decomposition (SVD), PCA as an application
	•	Orthogonal / orthonormal transformations
	•	Covariance matrices and their eigen-decompositions

Why it’s important
	•	Many interpretability methods, particularly those dealing with feature embeddings or dimensionality reduction (e.g., PCA, t-SNE, UMAP), rely heavily on matrix operations.
	•	Understanding how transformations preserve or distort distances can help explain how models interpret data.

6. Bayesian Thinking

Core Concepts
	•	Bayesian interpretation of parameters and models
	•	Posterior distributions, prior distributions, and likelihood functions
	•	Markov Chain Monte Carlo (MCMC) sampling
	•	Variational inference

Why it’s important
	•	Bayesian methods can provide uncertainty estimates for model outputs and parameters—important for interpretability, because explaining a result often involves quantifying how uncertain the model is about its prediction or explanation.
	•	Techniques like Bayesian Deep Learning produce predictive distributions that can be used to see how certain the model is in specific feature subspaces.

7. Information Theory

Core Concepts
	•	Entropy, Kullback–Leibler (KL) divergence, mutual information
	•	Connections between information content and uncertainty
	•	Bits as a measure of “feature importance”

Why it’s important
	•	Some interpretability approaches frame the problem in terms of information gain or mutual information between features and predictions.
	•	Understanding how to measure and compare distributions (KL divergence, Jensen–Shannon, etc.) can help interpret model shifts when features or layers are varied.

8. Model Interpretability Techniques and How They Use Probability

While not strictly “fundamentals of random variables,” these methods highlight why advanced probability skills matter:
	1.	Feature Attribution Methods
	•	SHAP: Based on Shapley values from cooperative game theory; requires modeling the conditional expectation ￼.
	•	LIME: Approximates local decision boundaries by sampling in a neighborhood around a point; sampling distribution matters a lot for stable explanations.
	2.	Surrogate Models
	•	Train a simpler, interpretable model (like a decision tree) on data labeled by a more complex black-box model; understanding distribution shifts or weighting strategies is crucial.
	3.	Counterfactual Explanations
	•	Often require specifying a “feasibility” or “proximity” measure in the data space, which is intimately tied to the underlying feature distribution.
	4.	Sensitivity Analysis / Partial Dependence
	•	Partial dependence plots rely on marginalizing out all other features: ￼.
	•	Understanding the joint distribution of ￼ is crucial for a correct interpretation.

9. Putting It All Together

To be truly effective (“deadly”) in interpretability research, aim to:
	1.	Master Probability and Statistics
	•	You’ll repeatedly encounter expectations, variances, and joint/conditional probability decompositions in interpretability methods.
	2.	Understand How Distributions Underpin Model Behavior
	•	Realize that model predictions can be seen as transformations of random variables. Interpretability methods often revolve around “if I change feature ￼, how does the distribution of the output change?”
	3.	Stay Grounded in Linear Algebra
	•	Much of ML (and interpretability) is linear algebra under the hood. Especially relevant for dimensionality reduction and analyzing multi-feature interactions.
	4.	Learn to Reason About Uncertainty
	•	Whether Bayesian or frequentist, interpretability statements often come with uncertainty intervals or assumptions about data distribution.
	5.	Connect Probability to Interpretability Frameworks
	•	Shapley values, LIME, Integrated Gradients, Surrogate models, Counterfactuals, etc.—all require rigorous understanding of how you’re sampling from or manipulating the input space.
	6.	Don’t Ignore Algorithmic Complexity
	•	Probability can get expensive in high dimensions (the “curse of dimensionality”). Efficient approximations matter.


