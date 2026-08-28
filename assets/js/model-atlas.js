(function () {
  "use strict";

  const models = {
    evo2: {
      index: "01",
      title: "Evo 2 7B",
      family: "StripedHyena 2 genomic foundation model",
      selectorFamily: "StripedHyena 2",
      selectorScale: "7B total / dense",
      accent: "#17865b",
      facts: [
        ["Scale", "7B dense"],
        ["Context", "1M bases"],
        ["Signature", "Multi-hybrid Hyena"]
      ],
      repeat: ["32 LAYER HYBRID STACK", "short + medium + long range"],
      nodes: [
        {
          id: "dna",
          category: "INPUT",
          label: "DNA base tokens",
          caption: "A / C / G / T sequences",
          summary: "The model reads DNA as a sequence, much like a language model reads text—but its vocabulary is built around nucleotide bases.",
          technical: "Input bases are tokenized before they enter the learned embedding space; context can extend to 1 million bases."
        },
        {
          id: "embedding",
          category: "REPRESENTATION",
          label: "Token embedding",
          caption: "Bases become learned vectors",
          summary: "Each base becomes a vector whose learned coordinates can carry information about biological context.",
          technical: "A learned token embedding maps discrete genomic tokens into the model's hidden representation."
        },
        {
          id: "short-hyena",
          category: "SHORT RANGE",
          label: "Explicit Hyena",
          caption: "Local genomic motifs",
          repeat: true,
          summary: "This route specializes in nearby patterns, where short motifs and local base arrangements matter most.",
          technical: "A short explicit Hyena operator performs efficient local sequence mixing inside the repeated hybrid stack."
        },
        {
          id: "medium-hyena",
          category: "MEDIUM RANGE",
          label: "Regularized Hyena",
          caption: "Stable mid-range mixing",
          repeat: true,
          summary: "A second route carries information across a wider span while regularization keeps the learned filter well behaved.",
          technical: "The medium-range regularized Hyena operator complements the short explicit and long implicit operators."
        },
        {
          id: "long-hyena",
          category: "LONG RANGE",
          label: "Implicit Hyena",
          caption: "Long genomic dependencies",
          repeat: true,
          summary: "The long-range route can connect distant parts of a genome without building a full attention matrix.",
          technical: "An implicit long convolution parameterizes a long filter compactly, supporting million-base sequence contexts."
        },
        {
          id: "logits",
          category: "OUTPUT",
          label: "Nucleotide logits",
          caption: "Scores for the next base",
          summary: "The final representation becomes a score for each possible next nucleotide.",
          technical: "The output projection produces unnormalized next-token scores, or logits, over the nucleotide vocabulary."
        }
      ]
    },
    "gpt-oss": {
      index: "02",
      title: "gpt-oss 20B",
      family: "Open-weight sparse Transformer",
      selectorFamily: "Sparse Transformer",
      selectorScale: "21B total / 3.6B active",
      accent: "#0088a3",
      facts: [
        ["Scale", "20.91B / 3.61B active"],
        ["Context", "131,072 tokens"],
        ["Signature", "Local / global GQA + MoE"]
      ],
      repeat: ["24 TRANSFORMER LAYERS", "alternating local + global attention"],
      nodes: [
        {
          id: "tokens",
          category: "INPUT",
          label: "Text tokens",
          caption: "Prompt + generated sequence",
          summary: "The prompt is split into reusable text pieces before the model starts reasoning over it.",
          technical: "Token IDs enter a learned embedding space and can occupy a context window of up to 131,072 tokens."
        },
        {
          id: "position",
          category: "POSITION",
          label: "RoPE + YaRN",
          caption: "Long-context position signal",
          summary: "Position information helps the model know which words came before others, even in a long prompt.",
          technical: "Rotary Position Embedding (RoPE) with Yet another RoPE extensioN (YaRN) scales position handling to long contexts."
        },
        {
          id: "local-gqa",
          category: "LOCAL ATTENTION",
          label: "128-token banded GQA",
          caption: "Nearby context, lower cost",
          repeat: true,
          summary: "Local layers look closely at a moving neighborhood, saving work when distant tokens are not needed.",
          technical: "Grouped-Query Attention (GQA) uses 64 query heads and 8 shared key/value heads inside a 128-token attention band."
        },
        {
          id: "global-gqa",
          category: "GLOBAL ATTENTION",
          label: "Full dense GQA",
          caption: "Sequence-wide checkpoints",
          repeat: true,
          summary: "Alternating global layers let information cross the full prompt instead of remaining trapped in local neighborhoods.",
          technical: "Full dense Grouped-Query Attention (GQA) alternates with banded attention across the 24-layer stack."
        },
        {
          id: "experts",
          category: "SPARSE COMPUTE",
          label: "Routed SwiGLU experts",
          caption: "32 available / top 4 active",
          repeat: true,
          summary: "A router chooses a small set of specialist feed-forward networks for each token, increasing capacity without using every weight.",
          technical: "Each Mixture of Experts (MoE) block routes a token to 4 of 32 SwiGLU experts, yielding about 3.61B active parameters."
        },
        {
          id: "output",
          category: "OUTPUT",
          label: "Next-token logits",
          caption: "Scores over the vocabulary",
          summary: "The final state becomes a probability-ready set of scores for what token should come next.",
          technical: "A vocabulary projection produces next-token logits after the final normalization."
        }
      ]
    },
    deepseek: {
      index: "03",
      title: "DeepSeek V3",
      family: "Latent-attention Mixture-of-Experts Transformer",
      selectorFamily: "Latent-attention MoE",
      selectorScale: "671B total / ~37B active",
      accent: "#7057c7",
      facts: [
        ["Scale", "671B / 36.7B active"],
        ["Depth", "61 layers + sequential MTP"],
        ["Signature", "MLA + fine-grained experts"]
      ],
      repeat: ["61 TRANSFORMER LAYERS", "compressed attention + sparse experts"],
      nodes: [
        {
          id: "tokens",
          category: "INPUT",
          label: "Text tokens",
          caption: "Sequence embeddings",
          summary: "Text pieces enter a deep Transformer stack where information is repeatedly mixed and transformed.",
          technical: "Token embeddings supply the residual stream consumed by 61 Transformer layers."
        },
        {
          id: "latent",
          category: "ATTENTION",
          label: "Compressed KV latent",
          caption: "Small attention memory",
          repeat: true,
          summary: "Instead of keeping a large attention record for every token, the model compresses what future tokens need to remember.",
          technical: "Multi-head Latent Attention (MLA) compresses key/value (KV) states into a lower-dimensional latent representation."
        },
        {
          id: "mla",
          category: "ATTENTION",
          label: "Latent attention heads",
          caption: "Recover + compare context",
          repeat: true,
          summary: "Attention heads recover the information they need from the compact latent memory and compare it with the current token.",
          technical: "Multi-head Latent Attention (MLA) reduces key/value cache size while preserving multi-head attention behavior."
        },
        {
          id: "shared-expert",
          category: "ALWAYS ACTIVE",
          label: "Shared expert",
          caption: "Common transformation path",
          repeat: true,
          summary: "One expert handles knowledge that is broadly useful, so every token gets a common processing path.",
          technical: "One shared feed-forward expert is evaluated for every token alongside the routed expert paths."
        },
        {
          id: "routed-experts",
          category: "SPARSE COMPUTE",
          label: "8 routed experts",
          caption: "Selected from 256",
          repeat: true,
          summary: "A router sends each token through eight specialists selected from a much larger bank.",
          technical: "The fine-grained Mixture of Experts (MoE) router activates 8 of 256 routed experts per token, plus the shared expert."
        },
        {
          id: "output",
          category: "OUTPUT",
          label: "Next-token logits",
          caption: "Main generation path",
          summary: "The main output still selects one next token at a time during ordinary autoregressive generation.",
          technical: "The final hidden state is normalized and projected into vocabulary logits for autoregressive decoding."
        },
        {
          id: "mtp",
          category: "SEQUENTIAL EXTENSION",
          label: "Sequential MTP module",
          caption: "Separate released weights",
          summary: "Beyond the main next-token output, a sequential module learns to predict a farther-ahead token from the preceding prediction state.",
          technical: "The released Multi-Token Prediction (MTP) component is a separate ~14B module beyond the 671B main-model comparison and continues the prediction sequence."
        },
        {
          id: "mtp-output",
          category: "EXTENDED OUTPUT",
          label: "Farther-ahead logits",
          caption: "Additional training target",
          summary: "The sequential extension produces an additional farther-ahead prediction, enriching the training signal beyond the immediate next token.",
          technical: "The MTP module projects its sequential hidden state to logits for an additional future-token target."
        }
      ]
    },
    qwen: {
      index: "04",
      title: "Qwen3-Next 80B-A3B",
      family: "Hybrid-attention ultra-sparse Transformer",
      selectorFamily: "Hybrid-attention MoE",
      selectorScale: "80B total / ~3B active",
      accent: "#b56b00",
      facts: [
        ["Scale", "80B / ~3B active"],
        ["Depth", "48 layers in 3:1 groups"],
        ["Signature", "DeltaNet + full attention"]
      ],
      repeat: ["48 LAYERS / 12 GROUPS", "3 linear-attention + 1 full-attention"],
      nodes: [
        {
          id: "tokens",
          category: "INPUT",
          label: "Text tokens",
          caption: "Sequence embeddings",
          summary: "Tokens enter repeating four-layer groups that alternate an efficient recurrent memory with periodic full-context lookup.",
          technical: "The 48-layer stack is arranged as 12 groups with a 3:1 ratio of Gated DeltaNet to gated full attention."
        },
        {
          id: "norm",
          category: "STABILIZE",
          label: "Zero-centered RMSNorm",
          caption: "Normalize the residual stream",
          repeat: true,
          summary: "Normalization keeps the signal at a manageable scale before each mixing and expert operation.",
          technical: "Zero-centered Root Mean Square Layer Normalization (RMSNorm) uses a zero-initialized residual scale parameterization."
        },
        {
          id: "deltanet-1",
          category: "LINEAR ATTENTION / 1",
          label: "Gated DeltaNet",
          caption: "Update recurrent memory",
          repeat: true,
          summary: "The first efficient layer writes useful information into a compact running state instead of comparing every token pair.",
          technical: "Gated DeltaNet is a recurrent linear-attention mechanism whose state update cost scales linearly with sequence length."
        },
        {
          id: "experts-1",
          category: "SPARSE COMPUTE / 1",
          label: "10 routed + 1 shared",
          caption: "Same 512-expert bank",
          repeat: true,
          summary: "After sequence mixing, the token uses one always-on expert plus ten selected specialists from the shared expert bank.",
          technical: "This Mixture of Experts (MoE) block activates 10 of 512 routed experts plus 1 shared expert."
        },
        {
          id: "deltanet-2",
          category: "LINEAR ATTENTION / 2",
          label: "Gated DeltaNet",
          caption: "Refine recurrent memory",
          repeat: true,
          summary: "A second pass refines the running memory while keeping sequence processing efficient.",
          technical: "This is the second of three consecutive Gated DeltaNet layers in each four-layer group."
        },
        {
          id: "experts-2",
          category: "SPARSE COMPUTE / 2",
          label: "10 routed + 1 shared",
          caption: "Same 512-expert bank",
          repeat: true,
          summary: "The second recurrent mixer is followed by the same sparse bank, with routing chosen independently for the current token.",
          technical: "Every Qwen3-Next layer feeds its output through a Mixture of Experts block with 10 routed and 1 shared expert active."
        },
        {
          id: "deltanet-3",
          category: "LINEAR ATTENTION / 3",
          label: "Gated DeltaNet",
          caption: "Carry long sequence state",
          repeat: true,
          summary: "The third recurrent layer carries the compact sequence state forward before a full-attention checkpoint.",
          technical: "Three linear-attention layers precede each gated full-attention layer, forming the architecture's 3:1 pattern."
        },
        {
          id: "experts-3",
          category: "SPARSE COMPUTE / 3",
          label: "10 routed + 1 shared",
          caption: "Same 512-expert bank",
          repeat: true,
          summary: "The third recurrent layer also hands its result to the sparse expert bank before the full-attention checkpoint.",
          technical: "Sparse feed-forward routing follows the third Gated DeltaNet layer just as it follows the other mixers."
        },
        {
          id: "full-attention",
          category: "FULL ATTENTION / 1",
          label: "Gated full attention",
          caption: "Direct sequence-wide lookup",
          repeat: true,
          summary: "Periodic full attention gives every token a direct route to every earlier token, correcting the limits of compact memory.",
          technical: "One gated full-attention layer follows every three Gated DeltaNet layers in each repeated group."
        },
        {
          id: "experts-4",
          category: "SPARSE COMPUTE / 4",
          label: "10 routed + 1 shared",
          caption: "Same 512-expert bank",
          repeat: true,
          summary: "Full attention feeds the same sparse bank, completing one four-layer hybrid group before the pattern repeats.",
          technical: "Across all four layer types, the Mixture of Experts (MoE) block activates 10 of 512 routed experts plus 1 shared expert, for about 3B active parameters."
        },
        {
          id: "mtp",
          category: "PREDICTION DESIGN",
          label: "MTP objective",
          caption: "Runtime support varies",
          summary: "The model is designed to learn from predicting multiple future tokens; whether that path accelerates generation depends on the runtime.",
          technical: "Multi-Token Prediction (MTP) is native to training and inference design, but its inference path is not exposed by every runtime implementation."
        },
        {
          id: "output",
          category: "OUTPUT",
          label: "Next-token logits",
          caption: "Autoregressive output",
          summary: "The final representation becomes scores over the vocabulary for the next generated token.",
          technical: "The normalized output is projected into vocabulary logits for standard autoregressive decoding."
        }
      ]
    }
  };

  const atlas = document.querySelector("[data-model-atlas]");
  if (!atlas) return;

  const workbench = atlas.querySelector("[data-workbench]");
  const selectorHost = atlas.querySelector("[data-model-selector]");
  const diagram = atlas.querySelector("[data-diagram]");
  const modelTitle = atlas.querySelector("[data-model-title]");
  const family = atlas.querySelector("[data-family]");
  const facts = atlas.querySelector("[data-facts]");
  const detailTitle = atlas.querySelector("[data-detail-title]");
  const detailSummary = atlas.querySelector("[data-detail-summary]");
  const detailTechnical = atlas.querySelector("[data-detail-technical]");
  const detailLabel = atlas.querySelector("[data-detail-label]");
  const interactionHint = atlas.querySelector("[data-interaction-hint]");
  let selectors = [];

  function renderSelectors() {
    selectorHost.setAttribute("role", "group");
    selectorHost.setAttribute("aria-label", "Models to inspect");
    selectorHost.innerHTML = Object.keys(models).map(function (modelId) {
      const model = models[modelId];
      return [
        '<button class="model-selector__button" type="button" data-model="' + modelId + '" aria-pressed="false">',
        '<span class="model-selector__status" aria-hidden="true"></span>',
        '<span class="model-selector__index">' + model.index + "</span>",
        "<strong>" + model.title + "</strong>",
        "<span>" + model.selectorFamily + "</span>",
        '<span class="model-selector__scale">' + model.selectorScale + "</span>",
        "</button>"
      ].join("");
    }).join("");
    selectors = Array.from(selectorHost.querySelectorAll("[data-model]"));
  }

  function nodeMarkup(node, index) {
    const status = index === 0 ? "Inspecting" : "";
    const hidden = index === 0 ? "" : ' aria-hidden="true"';
    return [
      '<button class="architecture-node' + (index === 0 ? " is-active" : "") + '" type="button" aria-pressed="' + (index === 0 ? "true" : "false") + '" data-node="' + node.id + '">',
      '<span class="architecture-node__status"' + hidden + ">" + status + "</span>",
      '<span class="architecture-node__category">' + node.category + "</span>",
      "<strong>" + node.label + "</strong>",
      "<span>" + node.caption + "</span>",
      "</button>"
    ].join("");
  }

  function renderDiagram(model) {
    const parts = [];
    let repeatOpen = false;

    model.nodes.forEach(function (node, index) {
      if (node.repeat && !repeatOpen) {
        parts.push('<div class="architecture-repeat" data-repeat>');
        parts.push("<p><span>" + model.repeat[0] + "</span><strong>" + model.repeat[1] + "</strong></p>");
        parts.push('<div class="architecture-repeat__nodes">');
        repeatOpen = true;
      }

      if (!node.repeat && repeatOpen) {
        parts.push("</div></div>");
        parts.push('<span class="architecture-connector" aria-hidden="true"></span>');
        repeatOpen = false;
      } else if (index > 0 && (node.repeat || !repeatOpen)) {
        parts.push('<span class="architecture-connector" aria-hidden="true"></span>');
      }

      parts.push(nodeMarkup(node, index));
    });

    if (repeatOpen) parts.push("</div></div>");
    diagram.innerHTML = parts.join("");
    diagram.setAttribute("aria-label", "Simplified " + model.title + " architecture");
  }

  function renderFacts(model) {
    facts.innerHTML = model.facts.map(function (fact) {
      return "<div><dt>" + fact[0] + "</dt><dd>" + fact[1] + "</dd></div>";
    }).join("");
  }

  function showNode(model, nodeId) {
    const node = model.nodes.find(function (item) { return item.id === nodeId; });
    if (!node) return;

    diagram.querySelectorAll("[data-node]").forEach(function (button) {
      const active = button.dataset.node === nodeId;
      const status = button.querySelector(".architecture-node__status");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      status.textContent = active ? "Inspecting" : "";
      status.setAttribute("aria-hidden", String(!active));
    });

    detailTitle.textContent = node.label;
    detailSummary.textContent = node.summary;
    detailTechnical.textContent = node.technical;
  }

  function selectModel(modelId) {
    const model = models[modelId];
    if (!model) return;

    atlas.style.setProperty("--model-accent", model.accent);
    selectors.forEach(function (button) {
      const active = button.dataset.model === modelId;
      const status = button.querySelector(".model-selector__status");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      status.textContent = active ? "Selected" : "";
      status.setAttribute("aria-hidden", String(!active));
    });

    modelTitle.textContent = model.title;
    family.textContent = model.family;
    renderFacts(model);
    renderDiagram(model);
    showNode(model, model.nodes[0].id);
    atlas.dataset.activeModel = modelId;
  }

  selectorHost.addEventListener("click", function (event) {
    const button = event.target.closest("[data-model]");
    if (!button) return;
    selectModel(button.dataset.model);
  });

  diagram.addEventListener("click", function (event) {
    const button = event.target.closest("[data-node]");
    if (!button) return;
    showNode(models[atlas.dataset.activeModel], button.dataset.node);
  });

  diagram.addEventListener("focusin", function (event) {
    const button = event.target.closest("[data-node]");
    if (!button) return;
    showNode(models[atlas.dataset.activeModel], button.dataset.node);
  });

  const scaleRows = Array.from(atlas.querySelectorAll(".scale-row"));
  const totals = scaleRows.map(function (row) { return Number(row.dataset.total); });
  const activeValues = scaleRows.map(function (row) { return Number(row.dataset.active); });
  const maximum = Math.max.apply(null, totals);
  const minimum = Math.min.apply(null, activeValues);

  function logWidth(value) {
    const normalized = (Math.log10(value) - Math.log10(minimum)) / (Math.log10(maximum) - Math.log10(minimum));
    return (18 + normalized * 82).toFixed(2) + "%";
  }

  scaleRows.forEach(function (row) {
    row.querySelector(".scale-row__bar--total").style.setProperty("--bar-size", logWidth(Number(row.dataset.total)));
    row.querySelector(".scale-row__bar--active").style.setProperty("--bar-size", logWidth(Number(row.dataset.active)));
  });

  detailLabel.textContent = "SELECTED COMPONENT";
  interactionHint.hidden = false;
  renderSelectors();
  selectModel("evo2");
  atlas.classList.add("is-enhanced");
  workbench.classList.add("is-enhanced");
}());
