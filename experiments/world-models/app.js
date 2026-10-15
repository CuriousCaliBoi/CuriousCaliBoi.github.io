const select = (selector) => document.querySelector(selector);

const elements = {
  app: select('[data-app]'),
  error: select('[data-error]'),
  errorMessage: select('[data-error-message]'),
  title: select('[data-title]'),
  question: select('[data-question]'),
  picker: select('[data-run-picker]'),
  status: select('[data-status]'),
  replayImage: select('[data-replay-image]'),
  replayPlaceholder: select('[data-replay-placeholder]'),
  replayButton: select('[data-replay-button]'),
  traceLink: select('[data-trace-link]'),
  steps: select('[data-steps]'),
  runReturn: select('[data-return]'),
  ending: select('[data-ending]'),
  achievements: select('[data-achievements]'),
  stateNote: select('[data-state-note]'),
  publicState: select('[data-public-state]'),
  privateState: select('[data-private-state]'),
  finding: select('[data-finding]'),
  summary: select('[data-summary]'),
  metrics: select('[data-metrics]'),
  traceSummary: select('[data-trace-summary]'),
  actionTrack: select('[data-action-track]'),
  experimentId: select('[data-experiment-id]'),
  labCommit: select('[data-lab-commit]'),
  swmLink: select('[data-swm-link]'),
  swmCommit: select('[data-swm-commit]'),
  datasetHash: select('[data-dataset-hash]'),
  checkpointHash: select('[data-checkpoint-hash]'),
  recordLink: select('[data-record-link]'),
  nextHypothesis: select('[data-next-hypothesis]'),
  limitations: select('[data-limitations]')
};

const state = { index: null, record: null, recordUrl: null, replayUrl: null };

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

function artifact(record, id) {
  const match = record.artifacts.find((item) => item.id === id && item.included);
  if (!match) throw new Error(`The public record is missing artifact ${id}.`);
  return match;
}

function artifactUrl(item) {
  return new URL(item.path, state.recordUrl).href;
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

function formatMetric(value, unit) {
  if (unit === 'accuracy') return `${(value * 100).toFixed(2)}%`;
  return value.toFixed(5);
}

function metricCard(metric) {
  const card = document.createElement('article');
  card.className = `metric-card winner-${metric.winner}`;

  const header = document.createElement('div');
  header.className = 'metric-card-heading';
  const title = document.createElement('h3');
  title.textContent = metric.label;
  const unit = document.createElement('span');
  unit.textContent = metric.unit;
  header.append(title, unit);

  const maximum = Math.max(metric.model, metric.baseline) || 1;
  const rows = document.createElement('div');
  rows.className = 'metric-rows';
  [
    ['Model', metric.model, 'model'],
    [metric.baseline_label, metric.baseline, 'baseline']
  ].forEach(([label, value, kind]) => {
    const row = document.createElement('div');
    row.className = 'metric-row';
    const rowLabel = document.createElement('span');
    rowLabel.textContent = label;
    const number = document.createElement('strong');
    number.textContent = formatMetric(value, metric.unit);
    const track = document.createElement('div');
    track.className = 'metric-track';
    const bar = document.createElement('span');
    bar.className = `metric-bar ${kind}`;
    bar.style.width = `${Math.max(2, (value / maximum) * 100)}%`;
    track.append(bar);
    row.append(rowLabel, number, track);
    rows.append(row);
  });

  const verdict = document.createElement('p');
  verdict.className = 'metric-verdict';
  const winner = metric.winner === 'tie' ? 'Tie' : `${metric.winner === 'model' ? 'Model' : 'Baseline'} wins`;
  verdict.textContent = metric.note ? `${winner}. ${metric.note}` : winner;
  card.append(header, rows, verdict);
  return card;
}

async function renderTrace(record) {
  const traceItem = artifact(record, record.replay.trace_artifact);
  const trace = await loadJson(artifactUrl(traceItem));
  elements.actionTrack.replaceChildren();
  const totalReward = trace.rewards.reduce((sum, reward) => sum + reward, 0);
  const rewardEvents = trace.rewards.filter((reward) => Math.abs(reward) > 1e-8).length;
  trace.actions.forEach((action, index) => {
    const step = document.createElement('span');
    const reward = trace.rewards[index];
    step.className = Math.abs(reward) > 1e-8 ? 'action-step rewarded' : 'action-step';
    if (reward > 0.5) step.classList.add('high-reward');
    step.title = `Step ${index + 1}: action ${action}, reward ${reward.toFixed(2)}`;
    elements.actionTrack.append(step);
  });
  elements.actionTrack.setAttribute(
    'aria-label',
    `${trace.actions.length} actions, ${rewardEvents} non-zero rewards, total return ${totalReward.toFixed(2)}.`
  );
  elements.traceSummary.textContent = `${rewardEvents} reward events / return ${totalReward.toFixed(2)}`;
}

async function render(entry) {
  state.recordUrl = new URL(entry.record, location.href);
  const record = await loadJson(state.recordUrl);
  state.record = record;
  const replayItem = artifact(record, record.replay.media_artifact);
  const traceItem = artifact(record, record.replay.trace_artifact);
  state.replayUrl = artifactUrl(replayItem);

  document.title = `${record.title} — World Models Lab`;
  elements.title.textContent = record.title;
  elements.question.textContent = record.question;
  elements.status.textContent = record.status;
  elements.steps.textContent = record.replay.steps;
  elements.runReturn.textContent = record.replay.return.toFixed(2);
  elements.ending.textContent = record.replay.termination;
  elements.achievements.textContent = record.replay.achievements.join(', ');
  elements.stateNote.textContent = record.saved_state.note;
  fillList(elements.publicState, record.saved_state.published);
  fillList(elements.privateState, record.saved_state.private);
  elements.finding.textContent = record.result.finding;
  elements.summary.textContent = record.summary;
  elements.metrics.replaceChildren(...record.headline_metrics.map(metricCard));
  elements.experimentId.textContent = record.id;
  elements.labCommit.textContent = shortHash(record.source.commit);
  const swm = record.source.dependencies.find((item) => item.name === 'stable-worldmodel');
  elements.swmCommit.textContent = shortHash(swm.commit);
  elements.swmLink.href = `${swm.repository}/commit/${swm.commit}`;
  elements.datasetHash.textContent = shortHash(record.dataset.sha256);
  elements.checkpointHash.textContent = shortHash(record.model.checkpoint_sha256);
  elements.recordLink.href = state.recordUrl.href;
  elements.nextHypothesis.textContent = record.result.next_hypothesis;
  fillList(elements.limitations, record.result.limitations);
  elements.traceLink.href = artifactUrl(traceItem);
  elements.replayImage.hidden = true;
  elements.replayImage.removeAttribute('src');
  elements.replayImage.alt = record.replay.alt;
  elements.replayPlaceholder.hidden = false;
  elements.replayButton.textContent = 'Play replay';

  await renderTrace(record);
  elements.app.hidden = false;
  postStatus('live', `Replay ready · ${record.title}`);
}

elements.replayButton.addEventListener('click', () => {
  elements.replayImage.src = `${state.replayUrl}?replay=${Date.now()}`;
  elements.replayImage.hidden = false;
  elements.replayPlaceholder.hidden = true;
  elements.replayButton.textContent = 'Replay from start';
});

elements.picker.addEventListener('change', async () => {
  const entry = state.index.experiments.find((item) => item.id === elements.picker.value);
  if (!entry) return;
  const url = new URL(location.href);
  url.searchParams.set('run', entry.id);
  history.replaceState(null, '', url);
  await render(entry);
});

async function start() {
  try {
    state.index = await loadJson(new URL('runs/index.json', location.href));
    elements.picker.replaceChildren();
    state.index.experiments.forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = `${entry.date} · ${entry.title}`;
      elements.picker.append(option);
    });
    const requested = new URL(location.href).searchParams.get('run');
    const entry = state.index.experiments.find((item) => item.id === requested)
      || state.index.experiments.find((item) => item.id === state.index.latest)
      || state.index.experiments[0];
    if (!entry) throw new Error('No published experiment records were found.');
    elements.picker.value = entry.id;
    await render(entry);
  } catch (error) {
    elements.app.hidden = true;
    elements.error.hidden = false;
    elements.errorMessage.textContent = error instanceof Error ? error.message : 'Unknown loading error.';
    postStatus('off', 'The saved experiment could not be loaded.');
  }
}

start();
