const select = (selector) => document.querySelector(selector);
const selectAll = (selector) => Array.from(document.querySelectorAll(selector));
const SVG_NS = 'http://www.w3.org/2000/svg';

const elements = {
  app: select('[data-app]'),
  loading: select('[data-loading]'),
  error: select('[data-error]'),
  errorMessage: select('[data-error-message]'),
  title: select('[data-title]'),
  question: select('[data-question]'),
  runLabel: select('[data-run-label]'),
  picker: select('[data-run-picker]'),
  pickerWrap: select('[data-run-picker-wrap]'),
  status: select('[data-status]'),
  theater: select('[data-theater]'),
  worldStage: select('[data-world-stage]'),
  pixelFrame: select('[data-pixel-frame]'),
  ambientFrame: select('[data-ambient-frame]'),
  heroFrame: select('[data-hero-frame]'),
  playButtons: selectAll('[data-play]'),
  previousStep: select('[data-previous-step]'),
  nextStep: select('[data-next-step]'),
  speed: select('[data-playback-speed]'),
  fullscreen: select('[data-stage-fullscreen]'),
  slider: select('[data-step-slider]'),
  rewardEvents: select('[data-reward-events]'),
  frameReadout: select('[data-frame-readout]'),
  currentStep: select('[data-current-step]'),
  currentAction: select('[data-current-action]'),
  currentReward: select('[data-current-reward]'),
  cumulativeReturn: select('[data-cumulative-return]'),
  stepEvent: select('[data-step-event]'),
  stageEvent: select('[data-stage-event]'),
  lensHeading: select('[data-lens-heading]'),
  lensExplanation: select('[data-lens-explanation]'),
  lensModel: select('[data-lens-model]'),
  lensBaseline: select('[data-lens-baseline]'),
  lensBaselineLabel: select('[data-lens-baseline-label]'),
  lensModelBar: select('[data-lens-model-bar]'),
  lensBaselineBar: select('[data-lens-baseline-bar]'),
  lensVerdict: select('[data-lens-verdict]'),
  lensButtons: selectAll('[data-lens-button]'),
  changeBalance: select('.change-balance'),
  trainingChart: select('[data-training-chart]'),
  horizonChart: select('[data-horizon-chart]'),
  lossEnd: select('[data-loss-end]'),
  trainingCaption: select('[data-training-caption]'),
  horizonEnd: select('[data-horizon-end]'),
  scorecard: select('[data-scorecard]'),
  publicState: select('[data-public-state]'),
  privateState: select('[data-private-state]'),
  stateNote: select('[data-state-note]'),
  finding: select('[data-finding]'),
  summary: select('[data-summary]'),
  experimentId: select('[data-experiment-id]'),
  labCommit: select('[data-lab-commit]'),
  swmLink: select('[data-swm-link]'),
  swmCommit: select('[data-swm-commit]'),
  datasetHash: select('[data-dataset-hash]'),
  checkpointHash: select('[data-checkpoint-hash]'),
  recordLink: select('[data-record-link]'),
  traceLink: select('[data-trace-link]'),
  historyLink: select('[data-history-link]'),
  previousRecord: select('[data-previous-record]'),
  nextHypothesis: select('[data-next-hypothesis]'),
  limitations: select('[data-limitations]')
};

const state = {
  index: null,
  entries: [],
  record: null,
  recordUrl: null,
  trace: null,
  frameIndex: null,
  spriteUrl: null,
  currentStep: 0,
  timer: null,
  playing: false,
  speed: 1,
  modelMetrics: null
};

const embedded = window.parent !== window || new URL(location.href).searchParams.get('embed') === '1';
document.body.classList.toggle('is-embedded', embedded);

function postStatus(status, message) {
  if (window.parent !== window) {
    window.parent.postMessage(
      { type: 'zuko:experiment-status', state: status, message },
      location.origin
    );
  }
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status}).`);
  return response.json();
}

function artifact(record, id, required = true) {
  const match = record.artifacts.find((item) => item.id === id && item.included);
  if (!match && required) throw new Error(`The public record is missing artifact ${id}.`);
  return match || null;
}

function artifactUrl(item) {
  return new URL(item.path, state.recordUrl).href;
}

function fillAll(selector, value) {
  selectAll(selector).forEach((element) => { element.textContent = value; });
}

function fillList(element, values) {
  element.replaceChildren();
  values.forEach((value) => {
    const item = document.createElement('li');
    item.textContent = value;
    element.append(item);
  });
}

function shortHash(value) {
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function titleCase(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function achievementLabel(value) {
  const labels = { collect_wood: 'Collected wood', wake_up: 'Woke up' };
  return labels[value] || titleCase(value);
}

function formatMetric(value, unit) {
  if (unit === 'accuracy') return `${(value * 100).toFixed(2)}%`;
  return value.toFixed(5);
}

function formatSigned(value) {
  if (Math.abs(value) < 1e-8) return '0.00';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function setSpriteFrame(element, index) {
  if (!state.frameIndex || !state.spriteUrl) {
    element.style.backgroundImage = state.spriteUrl ? `url("${state.spriteUrl}")` : '';
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    return;
  }

  const { columns, rows } = state.frameIndex.sprite;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = columns > 1 ? (column / (columns - 1)) * 100 : 0;
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  element.style.backgroundImage = `url("${state.spriteUrl}")`;
  element.style.backgroundSize = `${columns * 100}% ${rows * 100}%`;
  element.style.backgroundPosition = `${x}% ${y}%`;
}

function frameForStep(step) {
  if (!state.frameIndex) return { index: 0, step: 0 };
  let selected = state.frameIndex.frames[0];
  for (const frame of state.frameIndex.frames) {
    if (frame.step > step) break;
    selected = frame;
  }
  return selected;
}

function eventForStep(step, reward) {
  if (step === 0) return 'Initial observation saved.';
  const atEnd = step === state.record.replay.steps;
  if (atEnd && reward < 0) return `Penalty ${formatSigned(reward)} · episode ended in ${state.record.replay.termination}.`;
  if (atEnd) return `Episode ended in ${state.record.replay.termination}.`;
  if (reward > 0) return `Reward event ${formatSigned(reward)}.`;
  if (reward < 0) return `Penalty event ${formatSigned(reward)}.`;
  return 'No reward recorded at this step.';
}

function updatePlaybackButtons() {
  elements.theater.classList.toggle('is-playing', state.playing);
  elements.playButtons.forEach((button) => {
    if (button.classList.contains('stage-play')) {
      button.querySelector('span').textContent = state.playing ? 'Ⅱ' : '▶';
      button.querySelector('small').textContent = state.playing ? 'Pause' : (state.currentStep ? 'Continue the run' : 'Play the run');
      button.setAttribute('aria-label', state.playing ? 'Pause the recorded rollout' : 'Play the recorded rollout');
    } else {
      button.textContent = state.playing ? 'Pause' : (state.currentStep ? 'Continue' : 'Play');
    }
  });
}

function setStep(value) {
  const maximum = state.record.replay.steps;
  const step = Math.max(0, Math.min(maximum, Number(value)));
  state.currentStep = step;
  const frame = frameForStep(step);
  [elements.pixelFrame, elements.ambientFrame].forEach((element) => setSpriteFrame(element, frame.index));

  const reward = step === 0 ? 0 : state.trace.rewards[step - 1];
  const cumulative = state.trace.rewards.slice(0, step).reduce((sum, item) => sum + item, 0);
  const action = step === 0 ? 'Before the first action' : `Action ${state.trace.actions[step - 1]}`;
  const event = eventForStep(step, reward);
  const paddedStep = String(step).padStart(2, '0');

  elements.slider.value = step;
  elements.slider.style.setProperty('--progress', `${(step / maximum) * 100}%`);
  elements.slider.setAttribute('aria-valuetext', `Step ${step} of ${maximum}. ${action}. Reward ${formatSigned(reward)}.`);
  elements.currentStep.textContent = paddedStep;
  elements.currentAction.textContent = action;
  elements.currentReward.textContent = formatSigned(reward);
  elements.cumulativeReturn.textContent = cumulative.toFixed(2);
  elements.stepEvent.textContent = event;
  elements.stageEvent.textContent = event;
  elements.frameReadout.textContent = `${paddedStep} / ${maximum}`;
  elements.pixelFrame.setAttribute('aria-label', `Recorded Craftax observation at step ${step} of ${maximum}.`);
  updatePlaybackButtons();
}

function stopPlayback() {
  if (state.timer) window.clearTimeout(state.timer);
  state.timer = null;
  state.playing = false;
  updatePlaybackButtons();
}

function playbackTick() {
  if (!state.playing) return;
  if (state.currentStep >= state.record.replay.steps) {
    stopPlayback();
    return;
  }
  setStep(state.currentStep + 1);
  const duration = state.record.replay.frame_duration_ms || 100;
  state.timer = window.setTimeout(playbackTick, duration / state.speed);
}

function togglePlayback() {
  if (!state.frameIndex) return;
  if (state.playing) {
    stopPlayback();
    return;
  }
  if (state.currentStep >= state.record.replay.steps) setStep(0);
  state.playing = true;
  updatePlaybackButtons();
  state.timer = window.setTimeout(playbackTick, 120);
}

function renderRewardEvents() {
  elements.rewardEvents.replaceChildren();
  state.trace.rewards.forEach((reward, index) => {
    if (Math.abs(reward) < 1e-8) return;
    const step = index + 1;
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.style.setProperty('--position', `${(step / state.record.replay.steps) * 100}%`);
    marker.className = reward < 0 ? 'negative' : 'positive';
    marker.setAttribute('aria-label', `Inspect reward event at step ${step}: ${formatSigned(reward)}`);
    marker.title = `Step ${step}: ${formatSigned(reward)}`;
    marker.addEventListener('click', () => {
      stopPlayback();
      setStep(step);
    });
    elements.rewardEvents.append(marker);
  });
}

function renderLens(kind) {
  const metricId = kind === 'changed' ? 'changed-feature-mae' : 'state-one-step-mse';
  const metric = state.record.headline_metrics.find((item) => item.id === metricId);
  const maximum = Math.max(metric.model, metric.baseline) || 1;
  const modelWidth = Math.max(2, (metric.model / maximum) * 100);
  const baselineWidth = Math.max(2, (metric.baseline / maximum) * 100);
  const ratio = metric.model / metric.baseline;
  const reduction = (1 - ratio) * 100;

  elements.lensButtons.forEach((button) => {
    const active = button.dataset.lensButton === kind;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  elements.lensModel.textContent = formatMetric(metric.model, metric.unit);
  elements.lensBaseline.textContent = formatMetric(metric.baseline, metric.unit);
  elements.lensBaselineLabel.textContent = metric.baseline_label;
  elements.lensModelBar.style.setProperty('--width', `${modelWidth}%`);
  elements.lensBaselineBar.style.setProperty('--width', `${baselineWidth}%`);

  if (kind === 'changed') {
    elements.lensHeading.textContent = 'Inside the rare changes, learning won.';
    elements.lensExplanation.textContent = 'When we ignore everything that stayed fixed, the learned model made the better guess.';
    elements.lensVerdict.textContent = `The model cut changed-feature error by ${reduction.toFixed(0)}%.`;
  } else {
    elements.lensHeading.textContent = 'Across the whole state, copying won.';
    elements.lensExplanation.textContent = 'The model disturbed too many values that should have stayed exactly where they were.';
    elements.lensVerdict.textContent = `The model made ${ratio.toFixed(1)}× more whole-state error.`;
  }
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function renderLineChart(container, series, label) {
  const width = 640;
  const height = 270;
  const padding = { top: 18, right: 20, bottom: 35, left: 53 };
  const points = series.flatMap((item) => item.values);
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = 0;
  const yMax = Math.max(...yValues) * 1.08;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (value) => padding.left + ((value - xMin) / Math.max(1, xMax - xMin)) * plotWidth;
  const y = (value) => padding.top + (1 - ((value - yMin) / Math.max(.000001, yMax - yMin))) * plotHeight;

  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label });
  [0, .5, 1].forEach((fraction) => {
    const value = yMin + (yMax - yMin) * fraction;
    svg.append(svgElement('line', {
      x1: padding.left,
      x2: width - padding.right,
      y1: y(value),
      y2: y(value),
      class: 'chart-gridline'
    }));
    const text = svgElement('text', { x: padding.left - 9, y: y(value) + 3, 'text-anchor': 'end', class: 'chart-axis-label' });
    text.textContent = value.toFixed(3);
    svg.append(text);
  });

  [xMin, Math.round((xMin + xMax) / 2), xMax].forEach((value) => {
    const text = svgElement('text', { x: x(value), y: height - 10, 'text-anchor': 'middle', class: 'chart-axis-label' });
    text.textContent = value;
    svg.append(text);
  });

  series.forEach((item) => {
    const pathData = item.values.map((point, index) => `${index ? 'L' : 'M'} ${x(point.x).toFixed(2)} ${y(point.y).toFixed(2)}`).join(' ');
    svg.append(svgElement('path', { d: pathData, class: `chart-path ${item.className}` }));
    item.values.forEach((point) => {
      svg.append(svgElement('circle', { cx: x(point.x), cy: y(point.y), r: 3.5, class: `chart-dot ${item.className}` }));
    });
  });

  container.replaceChildren(svg);
}

function renderCharts(history, metrics) {
  const losses = history.epochs.map((epoch) => ({ x: epoch.epoch, y: epoch.train_loss }));
  const finalLoss = losses.at(-1).y;
  const minimum = losses.reduce((best, point) => point.y < best.y ? point : best, losses[0]);
  elements.lossEnd.textContent = finalLoss.toFixed(3);
  elements.trainingCaption.textContent = `Loss fell from ${losses[0].y.toFixed(3)} to ${finalLoss.toFixed(3)}; the lowest value was ${minimum.y.toFixed(3)} at pass ${minimum.x}.`;
  renderLineChart(elements.trainingChart, [{ values: losses, className: 'model' }], `Training loss over ${losses.length} passes, falling from ${losses[0].y.toFixed(3)} to ${finalLoss.toFixed(3)}.`);

  const model = Object.entries(metrics.open_loop.model_mse).map(([key, value]) => ({ x: Number(key.split('_')[1]), y: value }));
  const baseline = Object.entries(metrics.open_loop.copy_baseline_mse).map(([key, value]) => ({ x: Number(key.split('_')[1]), y: value }));
  elements.horizonEnd.textContent = model.at(-1).y.toFixed(3);
  renderLineChart(
    elements.horizonChart,
    [
      { values: model, className: 'model' },
      { values: baseline, className: 'baseline' }
    ],
    `Forecast error from one to eight imagined steps. Model error rises to ${model.at(-1).y.toFixed(3)} while the copy-state baseline rises to ${baseline.at(-1).y.toFixed(3)}.`
  );
}

function renderScorecard(record) {
  const rows = record.headline_metrics.map((metric) => {
    const row = document.createElement('article');
    row.className = `score-row winner-${metric.winner}`;

    const name = document.createElement('div');
    name.className = 'score-name';
    const heading = document.createElement('h3');
    heading.textContent = metric.label;
    const note = document.createElement('p');
    note.textContent = `${metric.unit === 'accuracy' ? 'Higher' : 'Lower'} is better${metric.note ? ` · ${metric.note}` : ''}`;
    name.append(heading, note);

    const model = document.createElement('div');
    model.className = 'score-value';
    const modelLabel = document.createElement('span');
    modelLabel.textContent = 'Learned model';
    const modelValue = document.createElement('strong');
    modelValue.textContent = formatMetric(metric.model, metric.unit);
    model.append(modelLabel, modelValue);

    const baseline = document.createElement('div');
    baseline.className = 'score-value';
    const baselineLabel = document.createElement('span');
    baselineLabel.textContent = metric.baseline_label;
    const baselineValue = document.createElement('strong');
    baselineValue.textContent = formatMetric(metric.baseline, metric.unit);
    baseline.append(baselineLabel, baselineValue);

    const verdict = document.createElement('p');
    verdict.className = 'score-verdict';
    verdict.textContent = metric.winner === 'tie' ? 'Tie' : `${metric.winner === 'model' ? 'Model' : 'Baseline'} wins`;
    row.append(name, model, baseline, verdict);
    return row;
  });
  elements.scorecard.replaceChildren(...rows);
}

async function loadReplay(record) {
  const traceItem = artifact(record, record.replay.trace_artifact);
  const replayItem = artifact(record, record.replay.media_artifact);
  const frameItem = record.replay.frame_index_artifact
    ? artifact(record, record.replay.frame_index_artifact)
    : null;

  state.trace = await loadJson(artifactUrl(traceItem));
  if (frameItem) {
    const frameUrl = artifactUrl(frameItem);
    state.frameIndex = await loadJson(frameUrl);
    state.spriteUrl = new URL(state.frameIndex.sprite.path, frameUrl).href;
  } else {
    state.frameIndex = null;
    state.spriteUrl = artifactUrl(replayItem);
  }

  elements.slider.max = record.replay.steps;
  elements.slider.disabled = !state.frameIndex;
  elements.previousStep.disabled = !state.frameIndex;
  elements.nextStep.disabled = !state.frameIndex;
  elements.speed.disabled = !state.frameIndex;
  elements.playButtons.forEach((button) => { button.disabled = !state.frameIndex; });
  fillAll('[data-step-total]', record.replay.steps);
  renderRewardEvents();
  setSpriteFrame(elements.heroFrame, 0);
  setStep(0);
}

async function render(entry) {
  stopPlayback();
  state.recordUrl = new URL(entry.record, location.href);
  const record = await loadJson(state.recordUrl);
  state.record = record;

  const historyItem = artifact(record, 'training-history');
  const metricsItem = artifact(record, 'model-metrics');
  const [history, modelMetrics] = await Promise.all([
    loadJson(artifactUrl(historyItem)),
    loadJson(artifactUrl(metricsItem)),
    loadReplay(record)
  ]);
  state.modelMetrics = modelMetrics;

  document.title = `${record.title} — World Models Lab`;
  elements.title.textContent = `${record.title} · revision ${record.revision}`;
  elements.question.textContent = record.question;
  elements.runLabel.textContent = `Field log M01 · r${record.revision}`;
  elements.status.textContent = record.status;
  fillAll('[data-steps]', record.replay.steps);
  fillAll('[data-return]', record.replay.return.toFixed(2));
  fillAll('[data-ending]', titleCase(record.replay.termination));
  fillAll('[data-ending-copy]', titleCase(record.replay.termination));
  fillAll('[data-achievement-count]', record.replay.achievements.length);
  fillAll('[data-achievements]', record.replay.achievements.map(achievementLabel).join(' · '));
  fillAll('[data-replay-seed]', record.seeds.replay);
  fillAll('[data-train-transitions]', record.dataset.training_transitions.toLocaleString());
  fillAll('[data-validation-transitions]', record.dataset.validation_transitions.toLocaleString());
  fillAll('[data-action-count]', record.environment.actions);
  fillAll('[data-observation-dimension]', record.environment.observation_dimension.toLocaleString());
  fillAll('[data-hidden-dimension]', record.model.hidden_dimension);

  const changed = modelMetrics.changed_feature_fraction;
  fillAll('[data-changed-percent]', `${(changed * 100).toFixed(3)}%`);
  fillAll('[data-still-percent]', `${((1 - changed) * 100).toFixed(3)}%`);
  elements.changeBalance.setAttribute(
    'aria-label',
    `${((1 - changed) * 100).toFixed(3)} percent of held-out state features stayed still; ${(changed * 100).toFixed(3)} percent changed.`
  );
  elements.stateNote.textContent = record.saved_state.note;
  fillList(elements.publicState, record.saved_state.published);
  fillList(elements.privateState, record.saved_state.private);
  elements.finding.textContent = record.result.finding;
  elements.summary.textContent = record.summary;
  elements.nextHypothesis.textContent = record.result.next_hypothesis;
  elements.heroFrame.setAttribute('aria-label', record.replay.alt);
  fillList(elements.limitations, record.result.limitations);

  renderLens('all');
  renderCharts(history, modelMetrics);
  renderScorecard(record);

  elements.experimentId.textContent = record.id;
  elements.labCommit.textContent = shortHash(record.source.commit);
  const swm = record.source.dependencies.find((item) => item.name === 'stable-worldmodel');
  elements.swmCommit.textContent = shortHash(swm.commit);
  elements.swmLink.href = `${swm.repository}/commit/${swm.commit}`;
  elements.datasetHash.textContent = shortHash(record.dataset.sha256);
  elements.checkpointHash.textContent = shortHash(record.model.checkpoint_sha256);
  elements.recordLink.href = state.recordUrl.href;
  elements.traceLink.href = artifactUrl(artifact(record, record.replay.trace_artifact));
  elements.historyLink.href = artifactUrl(historyItem);
  if (record.replay.supersedes) {
    elements.previousRecord.href = new URL(`runs/${encodeURIComponent(record.replay.supersedes)}/experiment.json`, location.href).href;
    elements.previousRecord.hidden = false;
  } else {
    elements.previousRecord.hidden = true;
  }

  elements.app.hidden = false;
  elements.loading.hidden = true;
  document.body.classList.remove('is-loading');
  postStatus('live', `Replay ready · ${record.title}`);
}

elements.playButtons.forEach((button) => button.addEventListener('click', togglePlayback));
elements.previousStep.addEventListener('click', () => {
  stopPlayback();
  setStep(state.currentStep - 1);
});
elements.nextStep.addEventListener('click', () => {
  stopPlayback();
  setStep(state.currentStep + 1);
});
elements.slider.addEventListener('input', () => {
  stopPlayback();
  setStep(elements.slider.value);
});
elements.speed.addEventListener('change', () => {
  state.speed = Number(elements.speed.value);
});
elements.worldStage.addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    event.preventDefault();
    togglePlayback();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    stopPlayback();
    setStep(state.currentStep - 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    stopPlayback();
    setStep(state.currentStep + 1);
  }
});
elements.fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await elements.theater.requestFullscreen();
  } catch {
    elements.stageEvent.textContent = 'Fullscreen is unavailable here. Open the viewer in its own tab.';
  }
});
elements.lensButtons.forEach((button) => {
  button.addEventListener('click', () => renderLens(button.dataset.lensButton));
});

elements.picker.addEventListener('change', async () => {
  const entry = state.index.experiments.find((item) => item.id === elements.picker.value);
  if (!entry) return;
  const url = new URL(location.href);
  url.searchParams.set('run', entry.id);
  history.replaceState(null, '', url);
  await render(entry);
});

function populatePicker(selectedEntry) {
  const superseded = new Set(state.index.experiments.map((entry) => entry.supersedes).filter(Boolean));
  state.entries = state.index.experiments.filter((entry) => !superseded.has(entry.id));
  if (!state.entries.some((entry) => entry.id === selectedEntry.id)) state.entries.push(selectedEntry);
  elements.picker.replaceChildren();
  state.entries.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = `${entry.date} · ${entry.title} · r${entry.revision || 1}`;
    elements.picker.append(option);
  });
  elements.picker.value = selectedEntry.id;
  elements.pickerWrap.hidden = state.entries.length < 2;
}

function observeChapters() {
  if (embedded || !('IntersectionObserver' in window)) return;
  const links = selectAll('.chapter-nav a');
  const sections = links.map((link) => select(link.getAttribute('href'))).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    links.forEach((link) => {
      if (link.getAttribute('href') === `#${visible.target.id}`) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-30% 0px -55%', threshold: [0, .2, .5] });
  sections.forEach((section) => observer.observe(section));
}

async function start() {
  try {
    state.index = await loadJson(new URL('runs/index.json', location.href));
    const requested = new URL(location.href).searchParams.get('run');
    const entry = state.index.experiments.find((item) => item.id === requested)
      || state.index.experiments.find((item) => item.id === state.index.latest)
      || state.index.experiments[0];
    if (!entry) throw new Error('No published experiment records were found.');
    populatePicker(entry);
    await render(entry);
    observeChapters();
  } catch (error) {
    stopPlayback();
    elements.app.hidden = true;
    elements.loading.hidden = true;
    elements.error.hidden = false;
    elements.errorMessage.textContent = error instanceof Error ? error.message : 'Unknown loading error.';
    document.body.classList.remove('is-loading');
    postStatus('off', 'The saved experiment could not be loaded.');
  }
}

start();
