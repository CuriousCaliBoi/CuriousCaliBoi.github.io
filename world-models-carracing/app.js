/* World Models CarRacing dream: V decoder + M step + C controller running in the browser with onnxruntime-web. */
(() => {
  'use strict';

  const ORT_DIST = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/';
  const Z_SIZE = 32;
  const RNN_SIZE = 256;
  const MIXTURES = 5;
  const ACTIONS = 3;
  const FRAME = 64;
  const PAPER_SCORE = '906 ± 21';

  const $ = (selector, root = document) => root.querySelector(selector);
  const el = {
    status: $('[data-status]'),
    statusText: $('[data-status-text]'),
    screen: $('[data-screen]'),
    dream: $('[data-dream]'),
    driverBadge: $('[data-driver-badge]'),
    stepBadge: $('[data-step-badge]'),
    screenMessage: $('[data-screen-message]'),
    temperature: $('[data-temperature]'),
    temperatureValue: $('[data-temperature-value]'),
    fps: $('[data-fps]'),
    fpsValue: $('[data-fps-value]'),
    pause: $('[data-pause]'),
    smooth: $('[data-smooth]'),
    bars: { steer: $('[data-bar="steer"]'), gas: $('[data-bar="gas"]'), brake: $('[data-bar="brake"]') },
    memory: $('[data-memory]'),
    facts: $('[data-facts]'),
    samples: $('[data-samples]'),
    real: $('[data-real]'),
    decoded: $('[data-decoded]'),
    sliders: $('[data-sliders]'),
    latentReset: $('[data-latent-reset]'),
    latentRandom: $('[data-latent-random]'),
  };

  const state = {
    decoder: null,
    cell: null,
    controller: null,
    initial: null,
    samples: null,
    z: new Float32Array(Z_SIZE),
    h: new Float32Array(RNN_SIZE),
    c: new Float32Array(RNN_SIZE),
    step: 0,
    driver: 'agent',
    temperature: 1,
    fps: 30,
    running: true,
    busy: false,
    lastFrameTime: 0,
    keys: { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false },
    steer: 0,
    latentBase: new Float32Array(Z_SIZE),
    latentZ: new Float32Array(Z_SIZE),
    latentPending: false,
    sampleImage: null,
    queue: Promise.resolve(),
  };

  /* ---------- status ---------- */
  function setStatus(kind, text) {
    el.status.className = 'status is-' + kind;
    el.statusText.textContent = text;
    if (window.parent !== window) {
      // The page is static, so a model failure is reported as "wait": the parent keeps the frame (and its video) visible.
      const parentState = kind === 'off' ? 'wait' : kind;
      try {
        window.parent.postMessage({ type: 'zuko:experiment-status', state: parentState, message: text }, location.origin);
      } catch (error) {
        /* embedded on another origin: nothing to report to */
      }
    }
  }

  /* ---------- math ---------- */
  function gaussian() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function sampleLatent(mu, logvar) {
    const z = new Float32Array(Z_SIZE);
    for (let i = 0; i < Z_SIZE; i++) z[i] = mu[i] + Math.exp(0.5 * logvar[i]) * gaussian();
    return z;
  }

  function controllerAction(z, h) {
    const { weight, bias } = state.controller;
    const raw = [bias[0], bias[1], bias[2]];
    for (let i = 0; i < Z_SIZE; i++) {
      const w = weight[i];
      raw[0] += w[0] * z[i];
      raw[1] += w[1] * z[i];
      raw[2] += w[2] * z[i];
    }
    for (let i = 0; i < RNN_SIZE; i++) {
      const w = weight[Z_SIZE + i];
      const value = h[i];
      raw[0] += w[0] * value;
      raw[1] += w[1] * value;
      raw[2] += w[2] * value;
    }
    const action = new Float32Array(ACTIONS);
    action[0] = Math.tanh(raw[0]);
    action[1] = (Math.tanh(raw[1]) + 1) / 2;
    action[2] = Math.min(1, Math.max(0, Math.tanh(raw[2])));
    return action;
  }

  function humanAction() {
    const target = (state.keys.ArrowRight ? 1 : 0) - (state.keys.ArrowLeft ? 1 : 0);
    state.steer += (target - state.steer) * 0.35;
    const action = new Float32Array(ACTIONS);
    action[0] = Math.abs(state.steer) < 0.01 ? 0 : state.steer;
    action[1] = state.keys.ArrowUp ? 1 : 0;
    action[2] = state.keys.ArrowDown ? 0.8 : 0;
    return action;
  }

  /* Paper's temperature sampling: softened mixture weights and sqrt(tau)-scaled Gaussian noise. */
  function sampleMixture(logmix, mean, logstd, tau) {
    const z = new Float32Array(Z_SIZE);
    const noiseScale = Math.sqrt(tau);
    const weights = new Float64Array(MIXTURES);
    for (let i = 0; i < Z_SIZE; i++) {
      const base = i * MIXTURES;
      let max = -Infinity;
      for (let k = 0; k < MIXTURES; k++) max = Math.max(max, logmix[base + k] / tau);
      let sum = 0;
      for (let k = 0; k < MIXTURES; k++) {
        weights[k] = Math.exp(logmix[base + k] / tau - max);
        sum += weights[k];
      }
      let r = Math.random() * sum;
      let k = 0;
      for (; k < MIXTURES - 1; k++) {
        r -= weights[k];
        if (r <= 0) break;
      }
      z[i] = mean[base + k] + Math.exp(logstd[base + k]) * gaussian() * noiseScale;
    }
    return z;
  }

  /* ---------- onnx runtime (one session call at a time) ---------- */
  function enqueue(work) {
    const result = state.queue.then(work);
    state.queue = result.catch(() => {});
    return result;
  }

  function tensor(data, dims) {
    return new ort.Tensor('float32', data, dims);
  }

  function decode(z) {
    return enqueue(async () => {
      const output = await state.decoder.run({ z: tensor(z, [1, Z_SIZE]) });
      return Float32Array.from(output.image.data);
    });
  }

  function rnnStep(z, action, h, c) {
    return enqueue(async () => {
      const output = await state.cell.run({
        z: tensor(z, [1, Z_SIZE]),
        action: tensor(action, [1, ACTIONS]),
        h: tensor(h, [1, RNN_SIZE]),
        c: tensor(c, [1, RNN_SIZE]),
      });
      return {
        logmix: Float32Array.from(output.logmix.data),
        mean: Float32Array.from(output.mean.data),
        logstd: Float32Array.from(output.logstd.data),
        h: Float32Array.from(output.h_next.data),
        c: Float32Array.from(output.c_next.data),
      };
    });
  }

  /* ---------- drawing ---------- */
  const pixelCount = FRAME * FRAME;
  function paint(canvas, chw) {
    const context = canvas.getContext('2d');
    const image = context.createImageData(FRAME, FRAME);
    const pixels = image.data;
    for (let i = 0; i < pixelCount; i++) {
      pixels[i * 4] = Math.max(0, Math.min(255, Math.round(chw[i] * 255)));
      pixels[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(chw[pixelCount + i] * 255)));
      pixels[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(chw[2 * pixelCount + i] * 255)));
      pixels[i * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }

  function paintMemory(h) {
    const context = el.memory.getContext('2d');
    const image = context.createImageData(16, 16);
    for (let i = 0; i < RNN_SIZE; i++) {
      const value = Math.max(-1, Math.min(1, h[i]));
      const magnitude = Math.round(Math.abs(value) * 255);
      image.data[i * 4] = value > 0 ? 242 : 40;
      image.data[i * 4 + 1] = value > 0 ? 181 : 120;
      image.data[i * 4 + 2] = value > 0 ? 68 : 255;
      image.data[i * 4 + 3] = 40 + Math.round(magnitude * 0.84);
    }
    context.putImageData(image, 0, 0);
  }

  function showAction(action) {
    el.bars.steer.style.width = Math.abs(action[0]) * 50 + '%';
    el.bars.steer.style.transform = action[0] < 0 ? 'translateX(-100%)' : 'none';
    el.bars.gas.style.width = action[1] * 100 + '%';
    el.bars.brake.style.width = action[2] * 100 + '%';
  }

  function showStep() {
    el.stepBadge.textContent = 'step ' + state.step + ' · τ ' + state.temperature.toFixed(2);
  }

  /* ---------- the dream loop ---------- */
  async function restart(kind) {
    const pool = state.initial[kind];
    const index = Math.floor(Math.random() * pool.mu.length);
    state.z = sampleLatent(pool.mu[index], pool.logvar[index]);
    state.h = new Float32Array(RNN_SIZE);
    state.c = new Float32Array(RNN_SIZE);
    state.step = 0;
    paint(el.dream, await decode(state.z));
    paintMemory(state.h);
    showStep();
  }

  async function dreamStep() {
    if (state.busy || !state.cell) return;
    state.busy = true;
    try {
      const action = state.driver === 'agent' ? controllerAction(state.z, state.h) : humanAction();
      const next = await rnnStep(state.z, action, state.h, state.c);
      state.h = next.h;
      state.c = next.c;
      state.z = sampleMixture(next.logmix, next.mean, next.logstd, state.temperature);
      paint(el.dream, await decode(state.z));
      state.step += 1;
      showAction(action);
      paintMemory(state.h);
      showStep();
    } finally {
      state.busy = false;
    }
  }

  function loop(timestamp) {
    requestAnimationFrame(loop);
    if (!state.running || !state.cell || document.hidden) return;
    if (timestamp - state.lastFrameTime < 1000 / state.fps) return;
    state.lastFrameTime = timestamp;
    dreamStep();
  }

  function setDriver(driver) {
    state.driver = driver;
    document.querySelectorAll('input[name="driver"]').forEach((input) => {
      input.checked = input.value === driver;
    });
    el.driverBadge.textContent = driver === 'agent' ? 'Agent is driving' : 'You are driving';
  }

  function setKey(key, down) {
    if (!(key in state.keys)) return false;
    state.keys[key] = down;
    if (down && state.driver !== 'human') setDriver('human');
    document.querySelectorAll('.touchpad button').forEach((button) => {
      if (button.dataset.key === key) button.classList.toggle('is-down', down);
    });
    return true;
  }

  /* ---------- latent explorer ---------- */
  function buildSliders() {
    for (let i = 0; i < Z_SIZE; i++) {
      const label = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = 'z' + i;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '-3';
      input.max = '3';
      input.step = '0.05';
      input.value = '0';
      input.dataset.index = String(i);
      input.setAttribute('aria-label', 'latent dimension ' + i);
      input.addEventListener('input', () => {
        state.latentZ[i] = parseFloat(input.value);
        scheduleLatentDecode();
      });
      label.append(name, input);
      el.sliders.append(label);
    }
  }

  function syncSliders() {
    el.sliders.querySelectorAll('input').forEach((input) => {
      input.value = state.latentZ[Number(input.dataset.index)].toFixed(2);
    });
  }

  function scheduleLatentDecode() {
    if (state.latentPending || !state.decoder) return;
    state.latentPending = true;
    requestAnimationFrame(async () => {
      state.latentPending = false;
      paint(el.decoded, await decode(Float32Array.from(state.latentZ)));
    });
  }

  function renderSamples(samples) {
    el.samples.innerHTML = '';
    for (let i = 0; i < samples.count; i++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.style.backgroundPosition = -i * FRAME + 'px 0';
      button.setAttribute('aria-label', 'real frame ' + (i + 1));
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => selectSample(i));
      el.samples.append(button);
    }
  }

  function loadSampleImage() {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('samples.png failed to load'));
      image.src = 'model/samples.png';
    });
  }

  async function selectSample(index) {
    el.samples.querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    if (state.sampleImage) {
      el.real.getContext('2d').drawImage(state.sampleImage, index * FRAME, 0, FRAME, FRAME, 0, 0, FRAME, FRAME);
    }
    state.latentBase = Float32Array.from(state.samples.mu[index]);
    state.latentZ = Float32Array.from(state.latentBase);
    syncSliders();
    paint(el.decoded, await decode(Float32Array.from(state.latentZ)));
  }

  /* ---------- facts ---------- */
  function formatNumber(value) {
    return Number(value).toLocaleString('en-US');
  }

  function fillMeta(meta) {
    document.querySelectorAll('[data-meta]').forEach((node) => {
      const value = meta[node.dataset.meta];
      node.textContent = value === undefined ? '?' : formatNumber(value);
    });
    const rows = [];
    const evaluation = meta.eval_summary;
    if (evaluation) {
      rows.push(['Score on ' + evaluation.episodes + ' unseen tracks', evaluation.mean_return.toFixed(0) + ' ± ' + evaluation.std_return.toFixed(0) + ' (min ' + evaluation.min_return.toFixed(0) + ', max ' + evaluation.max_return.toFixed(0) + ')']);
    } else if (meta.controller && meta.controller.eval_mean !== null) {
      rows.push(['Score, ' + (meta.controller_summary ? meta.controller_summary.eval_rollouts : 32) + ' tracks', meta.controller.eval_mean.toFixed(0) + ' ± ' + meta.controller.eval_std.toFixed(0)]);
    }
    rows.push(['Paper, CarRacing-v0, 100 trials', PAPER_SCORE]);
    if (meta.data) rows.push(['Recorded rollouts', formatNumber(meta.data.episodes) + ' episodes · ' + formatNumber(meta.data.frames) + ' frames · ' + Math.round(meta.data.follower_fraction * 100) + '% scripted driver, rest random']);
    if (meta.vae_summary) rows.push(['V training', formatNumber(meta.vae_summary.steps) + ' steps · batch ' + meta.vae_summary.batch_size + ' · ' + (meta.vae_summary.seconds / 60).toFixed(0) + ' min · val recon ' + meta.vae_summary.val_recon_loss.toFixed(1)]);
    if (meta.rnn_summary) rows.push(['M training', formatNumber(meta.rnn_summary.steps) + ' steps · batch ' + meta.rnn_summary.batch_size + ' · ' + (meta.rnn_summary.seconds / 60).toFixed(0) + ' min · val NLL ' + meta.rnn_summary.best_val_nll.toFixed(3)]);
    if (meta.controller_summary) rows.push(['C training', 'CMA-ES · population ' + meta.controller_summary.popsize + ' · ' + meta.controller_summary.generations + ' generations · ' + meta.controller_summary.hours + ' h · best from generation ' + meta.controller.generation]);
    rows.push(['Hardware', 'NVIDIA DGX Spark (GB10): one GPU for V and M, 19 CPU workers for C']);
    if (meta.files) rows.push(['Shipped to the browser', 'decoder ' + (meta.files['decoder.onnx'] / 1e6).toFixed(1) + ' MB · rnn step ' + (meta.files['rnn_cell.onnx'] / 1e6).toFixed(1) + ' MB · controller ' + (meta.files['controller.json'] / 1e3).toFixed(0) + ' kB']);
    rows.push(['Exported', meta.exported_at]);
    el.facts.innerHTML = '';
    for (const [label, value] of rows) {
      const row = document.createElement('tr');
      const cellLabel = document.createElement('td');
      const cellValue = document.createElement('td');
      cellLabel.textContent = label;
      cellValue.textContent = value;
      row.append(cellLabel, cellValue);
      el.facts.append(row);
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(url + ' returned ' + response.status);
    return response.json();
  }

  /* ---------- wiring ---------- */
  function wire() {
    document.querySelectorAll('input[name="driver"]').forEach((input) => {
      input.addEventListener('change', () => setDriver(input.value));
    });
    el.temperature.addEventListener('input', () => {
      state.temperature = parseFloat(el.temperature.value);
      el.temperatureValue.textContent = state.temperature.toFixed(2);
      showStep();
    });
    el.fps.addEventListener('input', () => {
      state.fps = parseInt(el.fps.value, 10);
      el.fpsValue.textContent = state.fps + ' fps';
    });
    el.pause.addEventListener('click', () => {
      state.running = !state.running;
      el.pause.textContent = state.running ? 'Pause' : 'Play';
      el.pause.setAttribute('aria-pressed', String(!state.running));
    });
    el.smooth.addEventListener('change', () => el.screen.classList.toggle('pixelated', !el.smooth.checked));
    document.querySelectorAll('[data-restart]').forEach((button) => {
      button.addEventListener('click', () => restart(button.dataset.restart));
    });
    el.screen.addEventListener('keydown', (event) => {
      if (setKey(event.key, true)) event.preventDefault();
    });
    el.screen.addEventListener('keyup', (event) => {
      if (setKey(event.key, false)) event.preventDefault();
    });
    el.screen.addEventListener('blur', () => Object.keys(state.keys).forEach((key) => setKey(key, false)));
    document.querySelectorAll('.touchpad button').forEach((button) => {
      const press = (event) => {
        event.preventDefault();
        setKey(button.dataset.key, true);
      };
      const release = (event) => {
        event.preventDefault();
        setKey(button.dataset.key, false);
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
    });
    el.latentReset.addEventListener('click', () => {
      state.latentZ = Float32Array.from(state.latentBase);
      syncSliders();
      scheduleLatentDecode();
    });
    el.latentRandom.addEventListener('click', () => {
      for (let i = 0; i < Z_SIZE; i++) state.latentZ[i] = gaussian();
      syncSliders();
      scheduleLatentDecode();
    });
  }

  async function init() {
    buildSliders();
    wire();
    requestAnimationFrame(loop);
    try {
      if (!window.ort) throw new Error('onnxruntime-web did not load');
      ort.env.wasm.wasmPaths = ORT_DIST;
      ort.env.wasm.numThreads = 1;
      setStatus('wait', 'Loading models…');
      const [meta, controller, initial, samples] = await Promise.all([
        fetchJson('model/meta.json'),
        fetchJson('model/controller.json'),
        fetchJson('model/initial_z.json'),
        fetchJson('model/samples.json'),
      ]);
      state.controller = controller;
      state.initial = initial;
      state.samples = samples;
      fillMeta(meta);
      renderSamples(samples);
      const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
      const [decoder, cell, sampleImage] = await Promise.all([
        ort.InferenceSession.create('model/decoder.onnx', options),
        ort.InferenceSession.create('model/rnn_cell.onnx', options),
        loadSampleImage(),
      ]);
      state.decoder = decoder;
      state.cell = cell;
      state.sampleImage = sampleImage;
      await restart('midway');
      await selectSample(Math.min(3, samples.count - 1));
      setStatus('live', 'Dreaming in your browser');
    } catch (error) {
      console.error(error);
      setStatus('off', 'Model failed to load');
      el.screenMessage.hidden = false;
      el.screenMessage.textContent = 'The in-browser model could not be loaded (' + error.message + '). The video below still shows the trained agent.';
    }
  }

  init();
})();
