'use strict';

const $ = (id) => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';
const COLORS = ['#b9f27c', '#7ad9c0', '#f0be69', '#82aef4', '#e08bd7', '#ef8878', '#a6d4f2', '#d8d086'];
const LABELS = {
  index: 'run order', learning_rate: 'learning rate', batch_size: 'batch size',
  warmup_percent: 'warmup', weight_decay: 'weight decay', depth: 'model depth',
  train_tokens: 'training tokens', compute_flops: 'compute proxy',
  final_val_loss: 'final validation loss', final_train_loss: 'final training loss',
  elapsed_seconds: 'elapsed seconds', num_parameters: 'parameters'
};

let record = {assignment: {}, status: 'unavailable', expected_runs: 155, runs: []};
let visibleRuns = [];

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const text = (value, fallback = '—') => value === null || value === undefined || value === '' ? fallback : String(value);
const stateOf = (run) => String(run.state || run.status || 'unknown').toLowerCase();
const complete = (run) => ['completed', 'complete', 'finished', 'success'].includes(stateOf(run));
const stateClass = (run) => complete(run) ? 'completed' : stateOf(run);
const stateLabel = (run) => complete(run) ? 'completed' : stateOf(run);
const problemOf = (run) => text(run.problem, 'unassigned');
const groupOf = (run) => text(run.group, 'ungrouped');
const modelOf = (run) => text(run.config?.model || run.config?.model_name || run.summary?.model, 'd8');
const historyOf = (run, key) => {
  const rows = run.history?.[key];
  return Array.isArray(rows) ? rows.map(pair => Array.isArray(pair) ? [finite(pair[0]), finite(pair[1])] : [null, null]).filter(pair => pair[0] !== null && pair[1] !== null) : [];
};

function problemMetadata() {
  const supplied = Array.isArray(record.assignment?.problems) ? record.assignment.problems : [];
  if (supplied.length) return supplied;
  return [...new Set(record.runs.map(problemOf))].sort().map(id => ({id, title: id, expected_runs: 0}));
}

function formatNumber(value, digits = 4) {
  const n = finite(value);
  if (n === null) return '—';
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return n.toLocaleString(undefined, {maximumFractionDigits: 1});
  if (Math.abs(n) > 0 && Math.abs(n) < 1e-3) return n.toExponential(2);
  return n.toLocaleString(undefined, {maximumFractionDigits: digits});
}

function formatRuntime(value) {
  const seconds = finite(value);
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

function setStatus() {
  const counts = {completed: 0, running: 0, queued: 0, failed: 0};
  record.runs.forEach(run => {
    const state = stateClass(run);
    if (state in counts) counts[state] += 1;
  });
  const expected = finite(record.expected_runs) ?? 155;
  const cards = [
    ['Planned', expected, 'core experiment matrix'],
    ['Recorded', record.runs.length, 'rows in this export'],
    ['Complete', counts.completed, 'finished runs'],
    ['Active', counts.running + counts.queued, `${counts.running} running · ${counts.queued} queued`],
    ['Failed', counts.failed, 'recorded failures']
  ];
  const grid = $('status-grid');
  grid.replaceChildren(...cards.map(([label, value, note]) => {
    const article = document.createElement('article');
    const span = document.createElement('span'); span.textContent = label;
    const strong = document.createElement('strong'); strong.textContent = formatNumber(value, 0);
    const small = document.createElement('small'); small.textContent = note;
    article.append(span, strong, small); return article;
  }));

  const phases = problemMetadata();
  $('phase-list').replaceChildren(...phases.map(phase => {
    const runs = record.runs.filter(run => problemOf(run) === phase.id);
    const done = runs.filter(complete).length;
    const expectedRuns = finite(phase.expected_runs) ?? runs.length;
    const article = document.createElement('article'); article.className = 'phase';
    const row = document.createElement('div');
    const name = document.createElement('span'); name.textContent = `${phase.id} · ${phase.title || phase.id}`;
    const count = document.createElement('strong'); count.textContent = `${done}/${expectedRuns}`;
    row.append(name, count);
    const progress = document.createElement('div'); progress.className = 'progress';
    const bar = document.createElement('i'); bar.style.width = `${expectedRuns ? Math.min(100, done / expectedRuns * 100) : 0}%`;
    progress.append(bar); article.append(row, progress); return article;
  }));

  const generated = record.generated_at ? new Date(record.generated_at) : null;
  $('generated-at').textContent = generated && !Number.isNaN(generated.valueOf()) ? `Exported ${generated.toLocaleString()}` : 'No run export yet';
  $('dataset-state').textContent = record.status ? `Dataset state: ${record.status}` : `${record.runs.length} run records loaded`;
  $('status-dot').className = `status-dot ${record.status === 'complete' ? 'live' : record.status === 'failed' ? 'error' : ''}`;
}

function populateFilters() {
  const problem = $('problem-filter');
  problem.replaceChildren(new Option('All problems', 'all'), ...problemMetadata().map(item => new Option(`${item.id} · ${item.title || item.id}`, item.id)));
  const groups = [...new Set(record.runs.map(groupOf))].sort();
  $('group-filter').replaceChildren(new Option('All groups', 'all'), ...groups.map(group => new Option(group, group)));
}

function filtered() {
  const p = $('problem-filter').value;
  const g = $('group-filter').value;
  const s = $('status-filter').value;
  return record.runs.filter(run => (p === 'all' || problemOf(run) === p) && (g === 'all' || groupOf(run) === g) && (s === 'all' || stateClass(run) === s));
}

function valueFor(run, key, index) {
  if (key === 'index') return index + 1;
  if (key === 'depth') {
    const explicit = finite(run.config?.depth ?? run.summary?.depth);
    if (explicit !== null) return explicit;
    const match = modelOf(run).match(/d(\d+)/i);
    return match ? Number(match[1]) : null;
  }
  if (key === 'train_tokens') return finite(run.summary?.train_tokens) ?? (finite(run.config?.num_train_sequences) !== null ? finite(run.config.num_train_sequences) * 1024 : null);
  if (key === 'compute_flops') return finite(run.summary?.compute_flops ?? run.summary?.flops);
  if (key in (run.config || {})) return finite(run.config[key]);
  return finite(run.summary?.[key]);
}

function colorFor(run) {
  const groups = [...new Set(record.runs.map(groupOf))].sort();
  return COLORS[Math.max(0, groups.indexOf(groupOf(run))) % COLORS.length];
}

function svgElement(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function extent(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return [0, 1];
  let lo = Math.min(...clean), hi = Math.max(...clean);
  if (lo === hi) { const pad = Math.abs(lo || 1) * .08; lo -= pad; hi += pad; }
  return [lo, hi];
}

function niceTicks(lo, hi, count = 5) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  const raw = Math.abs(hi - lo) / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const fraction = raw / power;
  const step = (fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10) * power;
  const first = Math.ceil(lo / step) * step;
  const ticks = [];
  for (let value = first; value <= hi + step * .01; value += step) ticks.push(Number(value.toPrecision(12)));
  return ticks;
}

function makePlotShell(xDomain, yDomain, xLabel, yLabel) {
  const width = 720, height = 360, margin = {top: 18, right: 18, bottom: 48, left: 63};
  const innerW = width - margin.left - margin.right, innerH = height - margin.top - margin.bottom;
  const svg = svgElement('svg', {viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none', 'aria-hidden': 'true'});
  const x = value => margin.left + (value - xDomain[0]) / (xDomain[1] - xDomain[0]) * innerW;
  const y = value => margin.top + innerH - (value - yDomain[0]) / (yDomain[1] - yDomain[0]) * innerH;
  niceTicks(...yDomain).forEach(value => {
    svg.append(svgElement('line', {x1: margin.left, x2: width - margin.right, y1: y(value), y2: y(value), class: 'grid'}));
    const label = svgElement('text', {x: margin.left - 9, y: y(value) + 3, class: 'tick', 'text-anchor': 'end'}); label.textContent = formatNumber(value, 3); svg.append(label);
  });
  niceTicks(...xDomain).forEach(value => {
    svg.append(svgElement('line', {x1: x(value), x2: x(value), y1: margin.top, y2: height - margin.bottom, class: 'grid'}));
    const label = svgElement('text', {x: x(value), y: height - margin.bottom + 18, class: 'tick', 'text-anchor': 'middle'}); label.textContent = formatNumber(value, 3); svg.append(label);
  });
  svg.append(svgElement('line', {x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom, class: 'axis'}));
  svg.append(svgElement('line', {x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom, class: 'axis'}));
  const xText = svgElement('text', {x: margin.left + innerW / 2, y: height - 7, class: 'axis-label', 'text-anchor': 'middle'}); xText.textContent = xLabel; svg.append(xText);
  const yText = svgElement('text', {x: 13, y: margin.top + innerH / 2, class: 'axis-label', transform: `rotate(-90 13 ${margin.top + innerH / 2})`, 'text-anchor': 'middle'}); yText.textContent = yLabel; svg.append(yText);
  return {svg, x, y};
}

function emptyChart(container, message) {
  const div = document.createElement('div'); div.className = 'empty-chart'; div.textContent = message; container.replaceChildren(div);
}

function showTooltip(event, run, extra = '') {
  const tip = $('tooltip');
  tip.textContent = `${text(run.name || run.id, 'unnamed run')} · ${problemOf(run)} / ${groupOf(run)}${extra ? ` · ${extra}` : ''}`;
  tip.style.left = `${Math.min(window.innerWidth - 335, event.clientX)}px`;
  tip.style.top = `${Math.min(window.innerHeight - 90, event.clientY)}px`;
  tip.classList.add('visible');
}
function hideTooltip() { $('tooltip').classList.remove('visible'); }

function drawScatter() {
  const container = $('scatter-chart');
  const xKey = $('x-axis').value, yKey = $('y-axis').value;
  const points = visibleRuns.map((run, index) => ({run, x: valueFor(run, xKey, index), y: valueFor(run, yKey, index)})).filter(point => point.x !== null && point.y !== null);
  $('scatter-title').textContent = `${LABELS[yKey]} by ${LABELS[xKey]}`.replace(/^./, value => value.toUpperCase());
  if (!points.length) { emptyChart(container, 'No numeric terminal measurements match these filters.'); return; }
  let xDomain = extent(points.map(point => point.x)); let yDomain = extent(points.map(point => point.y));
  const xPad = (xDomain[1] - xDomain[0]) * .04, yPad = (yDomain[1] - yDomain[0]) * .08;
  xDomain = [xDomain[0] - xPad, xDomain[1] + xPad]; yDomain = [yDomain[0] - yPad, yDomain[1] + yPad];
  const {svg, x, y} = makePlotShell(xDomain, yDomain, LABELS[xKey], LABELS[yKey]);
  points.forEach(point => {
    const circle = svgElement('circle', {cx: x(point.x), cy: y(point.y), r: 4.7, fill: colorFor(point.run), class: 'point', tabindex: '0'});
    const detail = `${LABELS[xKey]} ${formatNumber(point.x)} · ${LABELS[yKey]} ${formatNumber(point.y)}`;
    circle.addEventListener('pointermove', event => showTooltip(event, point.run, detail));
    circle.addEventListener('pointerleave', hideTooltip);
    circle.addEventListener('focus', event => showTooltip({clientX: event.target.getBoundingClientRect().x, clientY: event.target.getBoundingClientRect().y}, point.run, detail));
    circle.addEventListener('blur', hideTooltip);
    svg.append(circle);
  });
  container.replaceChildren(svg);
}

function drawCurves() {
  const container = $('curve-chart');
  const candidates = visibleRuns.filter(run => historyOf(run, 'train_loss').length || historyOf(run, 'val_loss').length).slice(0, 24);
  const series = [];
  candidates.forEach(run => {
    const color = colorFor(run);
    const train = historyOf(run, 'train_loss'); if (train.length) series.push({run, key: 'train', values: train, color, opacity: .5});
    const val = historyOf(run, 'val_loss'); if (val.length) series.push({run, key: 'validation', values: val, color, opacity: 1});
  });
  if (!series.length) { emptyChart(container, 'No training or validation histories match these filters.'); return; }
  const xDomain = extent(series.flatMap(item => item.values.map(pair => pair[0])));
  let yDomain = extent(series.flatMap(item => item.values.map(pair => pair[1])));
  const yPad = (yDomain[1] - yDomain[0]) * .05; yDomain = [yDomain[0] - yPad, yDomain[1] + yPad];
  const {svg, x, y} = makePlotShell(xDomain, yDomain, 'optimizer step', 'cross-entropy loss');
  series.forEach(item => {
    const d = item.values.map(([step, value], index) => `${index ? 'L' : 'M'}${x(step).toFixed(2)},${y(value).toFixed(2)}`).join(' ');
    const path = svgElement('path', {d, class: 'curve', stroke: item.color, opacity: item.opacity, 'stroke-dasharray': item.key === 'train' ? '3 3' : 'none'});
    path.addEventListener('pointermove', event => showTooltip(event, item.run, `${item.key} history`)); path.addEventListener('pointerleave', hideTooltip);
    svg.append(path);
  });
  container.replaceChildren(svg);
}

function problemRuns(problem) {
  return record.runs.filter(run => problemOf(run) === problem);
}

function terminalValidation(run) {
  return finite(run.summary?.final_val_loss);
}

function paddedDomain(values, fraction = .06) {
  const domain = extent(values);
  const pad = (domain[1] - domain[0]) * fraction;
  return [domain[0] - pad, domain[1] + pad];
}

function seriesColor(index) {
  return COLORS[index % COLORS.length];
}

function drawSeriesLegend(id, entries) {
  const container = $(id);
  if (!container) return;
  container.replaceChildren(...entries.map(([label, color]) => {
    const item = document.createElement('span');
    const swatch = document.createElement('i'); swatch.style.setProperty('--series-color', color);
    const name = document.createTextNode(label);
    item.append(swatch, name);
    return item;
  }));
}

function drawP1() {
  const container = $('p1-chart');
  const xKey = $('p1-parameter').value;
  const selectedGroup = $('p1-group').value;
  const points = problemRuns('p1').filter(complete)
    .filter(run => selectedGroup === 'all' || groupOf(run) === selectedGroup)
    .map(run => ({run, x: valueFor(run, xKey, 0), y: terminalValidation(run)}))
    .filter(point => point.x !== null && point.y !== null);
  if (!points.length) {
    emptyChart(container, 'No completed P1 measurements match this parameter and group.');
    return;
  }

  const groups = [...new Set(points.map(point => groupOf(point.run)))].sort();
  const xDomain = paddedDomain(points.map(point => point.x), .04);
  const yDomain = paddedDomain(points.map(point => point.y), .08);
  const {svg, x, y} = makePlotShell(xDomain, yDomain, LABELS[xKey], 'final validation loss');
  groups.forEach((group, groupIndex) => {
    const color = seriesColor(groupIndex);
    const values = points.filter(point => groupOf(point.run) === group).sort((a, b) => a.x - b.x);
    if (values.length > 1) {
      const d = values.map((point, index) => `${index ? 'L' : 'M'}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`).join(' ');
      svg.append(svgElement('path', {d, class: 'curve', stroke: color, opacity: .42}));
    }
    values.forEach(point => {
      const circle = svgElement('circle', {cx: x(point.x), cy: y(point.y), r: 4.8, fill: color, class: 'point'});
      circle.addEventListener('pointermove', event => showTooltip(event, point.run, `${LABELS[xKey]} ${formatNumber(point.x)} · final validation ${formatNumber(point.y)}`));
      circle.addEventListener('pointerleave', hideTooltip);
      svg.append(circle);
    });
  });
  container.replaceChildren(svg);
}

function heatColor(value, minimum, maximum) {
  const fraction = maximum === minimum ? .5 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
  return `hsl(${94 - fraction * 58} 58% ${22 + fraction * 35}%)`;
}

function drawP1Heatmap() {
  const container = $('p1-heatmap');
  const runs = problemRuns('p1').filter(run => complete(run) && groupOf(run) === 'paired');
  const records = runs.map(run => ({
    run,
    lr: finite(run.config?.learning_rate),
    batch: finite(run.config?.batch_size),
    loss: terminalValidation(run)
  })).filter(item => item.lr !== null && item.batch !== null && item.loss !== null);
  if (!records.length) {
    emptyChart(container, 'No completed paired learning-rate and batch-size runs are available.');
    return;
  }

  const learningRates = [...new Set(records.map(item => item.lr))].sort((a, b) => a - b);
  const batches = [...new Set(records.map(item => item.batch))].sort((a, b) => a - b);
  const losses = records.map(item => item.loss);
  const minimum = Math.min(...losses), maximum = Math.max(...losses);
  const width = 720, height = 360, margin = {top: 20, right: 22, bottom: 55, left: 72};
  const innerW = width - margin.left - margin.right, innerH = height - margin.top - margin.bottom;
  const cellW = innerW / learningRates.length, cellH = innerH / batches.length;
  const svg = svgElement('svg', {viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none', 'aria-hidden': 'true'});

  learningRates.forEach((value, index) => {
    const label = svgElement('text', {x: margin.left + (index + .5) * cellW, y: height - margin.bottom + 19, class: 'tick', 'text-anchor': 'middle'});
    label.textContent = formatNumber(value, 5); svg.append(label);
  });
  batches.forEach((value, index) => {
    const label = svgElement('text', {x: margin.left - 10, y: margin.top + (batches.length - index - .5) * cellH + 3, class: 'tick', 'text-anchor': 'end'});
    label.textContent = formatNumber(value, 0); svg.append(label);
  });
  records.forEach(item => {
    const column = learningRates.indexOf(item.lr);
    const row = batches.length - 1 - batches.indexOf(item.batch);
    const rect = svgElement('rect', {
      x: margin.left + column * cellW,
      y: margin.top + row * cellH,
      width: cellW,
      height: cellH,
      fill: heatColor(item.loss, minimum, maximum),
      class: 'heat-cell'
    });
    rect.addEventListener('pointermove', event => showTooltip(event, item.run, `learning rate ${formatNumber(item.lr, 5)} · batch ${item.batch} · final validation ${formatNumber(item.loss)}`));
    rect.addEventListener('pointerleave', hideTooltip);
    const label = svgElement('text', {
      x: margin.left + (column + .5) * cellW,
      y: margin.top + (row + .5) * cellH + 3,
      class: 'heat-label',
      'text-anchor': 'middle'
    });
    label.textContent = formatNumber(item.loss, 4);
    svg.append(rect, label);
  });
  const xLabel = svgElement('text', {x: margin.left + innerW / 2, y: height - 7, class: 'axis-label', 'text-anchor': 'middle'}); xLabel.textContent = 'learning rate';
  const yLabel = svgElement('text', {x: 14, y: margin.top + innerH / 2, class: 'axis-label', transform: `rotate(-90 14 ${margin.top + innerH / 2})`, 'text-anchor': 'middle'}); yLabel.textContent = 'batch size';
  const range = svgElement('text', {x: width - margin.right, y: 11, class: 'tick', 'text-anchor': 'end'}); range.textContent = `${formatNumber(minimum)} — ${formatNumber(maximum)}`;
  svg.append(xLabel, yLabel, range);
  container.replaceChildren(svg);
}

function p2Recipe(run) {
  const name = String(run.name || '');
  const depthRecipe = name.match(/-p2-(required|slope|break)-(.+)-d\d+$/);
  if (depthRecipe) return `${depthRecipe[1]} · ${depthRecipe[2]}`;
  if (/-p2-slope-data-\d+$/.test(name)) return 'slope · data horizon';
  return groupOf(run);
}

function drawP2() {
  const container = $('p2-chart');
  const axis = $('p2-axis').value;
  const useLog = axis !== 'depth';
  const records = problemRuns('p2').filter(complete).map(run => {
    const rawX = valueFor(run, axis, 0);
    return {
      run,
      recipe: p2Recipe(run),
      rawX,
      x: useLog && rawX > 0 ? Math.log10(rawX) : rawX,
      y: terminalValidation(run)
    };
  }).filter(item => item.x !== null && item.y !== null && Number.isFinite(item.x));
  if (!records.length) {
    emptyChart(container, 'No completed P2 scaling measurements are available for this axis.');
    drawSeriesLegend('p2-legend', []);
    return;
  }

  const recipes = [...new Set(records.map(item => item.recipe))].sort();
  const xDomain = paddedDomain(records.map(item => item.x), .04);
  const yDomain = paddedDomain(records.map(item => item.y), .08);
  const xLabel = useLog ? `log10 ${LABELS[axis]}` : LABELS[axis];
  const {svg, x, y} = makePlotShell(xDomain, yDomain, xLabel, 'final validation loss');
  recipes.forEach((recipe, index) => {
    const color = seriesColor(index);
    const values = records.filter(item => item.recipe === recipe).sort((a, b) => a.x - b.x);
    if (values.length > 1) {
      const d = values.map((item, pointIndex) => `${pointIndex ? 'L' : 'M'}${x(item.x).toFixed(2)},${y(item.y).toFixed(2)}`).join(' ');
      svg.append(svgElement('path', {d, class: 'curve', stroke: color, opacity: .72}));
    }
    values.forEach(item => {
      const circle = svgElement('circle', {cx: x(item.x), cy: y(item.y), r: 4.5, fill: color, class: 'point'});
      circle.addEventListener('pointermove', event => showTooltip(event, item.run, `${LABELS[axis]} ${formatNumber(item.rawX)} · final validation ${formatNumber(item.y)}`));
      circle.addEventListener('pointerleave', hideTooltip);
      svg.append(circle);
    });
  });
  container.replaceChildren(svg);
  drawSeriesLegend('p2-legend', recipes.map((recipe, index) => [recipe, seriesColor(index)]));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function drawP3() {
  const container = $('p3-chart');
  const records = problemRuns('p3').filter(complete).map(run => ({run, group: groupOf(run), loss: terminalValidation(run)})).filter(item => item.loss !== null);
  if (!records.length) {
    emptyChart(container, 'No completed P3 terminal validation losses are available.');
    return;
  }
  const groups = [...new Set(records.map(item => item.group))].sort();
  const yDomain = paddedDomain(records.map(item => item.loss), .09);
  const width = 720, height = 360, margin = {top: 20, right: 20, bottom: 68, left: 63};
  const innerW = width - margin.left - margin.right, innerH = height - margin.top - margin.bottom;
  const x = index => margin.left + (index + .5) / groups.length * innerW;
  const y = value => margin.top + innerH - (value - yDomain[0]) / (yDomain[1] - yDomain[0]) * innerH;
  const svg = svgElement('svg', {viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none', 'aria-hidden': 'true'});
  niceTicks(...yDomain).forEach(value => {
    svg.append(svgElement('line', {x1: margin.left, x2: width - margin.right, y1: y(value), y2: y(value), class: 'grid'}));
    const label = svgElement('text', {x: margin.left - 9, y: y(value) + 3, class: 'tick', 'text-anchor': 'end'}); label.textContent = formatNumber(value, 4); svg.append(label);
  });
  groups.forEach((group, groupIndex) => {
    const values = records.filter(item => item.group === group);
    const color = seriesColor(groupIndex);
    const center = x(groupIndex);
    svg.append(svgElement('line', {x1: center - 20, x2: center + 20, y1: y(median(values.map(item => item.loss))), y2: y(median(values.map(item => item.loss))), stroke: color, 'stroke-width': 2.5}));
    values.forEach((item, itemIndex) => {
      const jitter = ((itemIndex % 9) - 4) * 4.2;
      const circle = svgElement('circle', {cx: center + jitter, cy: y(item.loss), r: 4.2, fill: color, class: 'point'});
      circle.addEventListener('pointermove', event => showTooltip(event, item.run, `${text(item.run.gpu, 'GPU')} · final validation ${formatNumber(item.loss)}`));
      circle.addEventListener('pointerleave', hideTooltip);
      svg.append(circle);
    });
    const label = svgElement('text', {x: center, y: height - margin.bottom + 22, class: 'tick', 'text-anchor': 'middle'}); label.textContent = group; svg.append(label);
  });
  svg.append(svgElement('line', {x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom, class: 'axis'}));
  svg.append(svgElement('line', {x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom, class: 'axis'}));
  const xLabel = svgElement('text', {x: margin.left + innerW / 2, y: height - 7, class: 'axis-label', 'text-anchor': 'middle'}); xLabel.textContent = 'variation group';
  const yLabel = svgElement('text', {x: 13, y: margin.top + innerH / 2, class: 'axis-label', transform: `rotate(-90 13 ${margin.top + innerH / 2})`, 'text-anchor': 'middle'}); yLabel.textContent = 'final validation loss';
  svg.append(xLabel, yLabel);
  container.replaceChildren(svg);
}

function drawP4() {
  const container = $('p4-chart');
  const runs = problemRuns('p4');
  const baseline = runs.find(run => String(run.name).includes('p4-single-point-baseline'));
  const selected = runs.find(run => String(run.id) === $('p4-run').value);
  const baselineHistory = baseline ? historyOf(baseline, 'train_loss') : [];
  const selectedHistory = selected ? historyOf(selected, 'train_loss') : [];
  if (!baseline || !selected || !baselineHistory.length || !selectedHistory.length) {
    emptyChart(container, 'A deterministic baseline and a perturbed P4 history are required for this paired plot.');
    return;
  }
  const baselineByStep = new Map(baselineHistory);
  const differences = selectedHistory
    .filter(([step]) => baselineByStep.has(step))
    .map(([step, value]) => [step, Math.abs(value - baselineByStep.get(step))]);
  if (!differences.length) {
    emptyChart(container, 'The selected run and baseline do not yet share recorded optimizer steps.');
    return;
  }
  const xDomain = paddedDomain(differences.map(pair => pair[0]), .01);
  const maximum = Math.max(...differences.map(pair => pair[1]));
  const yDomain = [0, maximum > 0 ? maximum * 1.08 : 1e-8];
  const {svg, x, y} = makePlotShell(xDomain, yDomain, 'optimizer step', 'absolute train-loss gap');
  const d = differences.map(([step, value], index) => `${index ? 'L' : 'M'}${x(step).toFixed(2)},${y(value).toFixed(2)}`).join(' ');
  const path = svgElement('path', {d, class: 'curve', stroke: COLORS[0], opacity: .9});
  path.addEventListener('pointermove', event => showTooltip(event, selected, 'absolute training-loss gap from deterministic baseline'));
  path.addEventListener('pointerleave', hideTooltip);
  svg.append(path);
  const perturbStep = finite(selected.config?.perturb_batch_step) ?? 0;
  if (perturbStep >= xDomain[0] && perturbStep <= xDomain[1]) {
    svg.append(svgElement('line', {x1: x(perturbStep), x2: x(perturbStep), y1: y(yDomain[0]), y2: y(yDomain[1]), stroke: COLORS[2], 'stroke-width': 1.2, 'stroke-dasharray': '4 4'}));
    const marker = svgElement('text', {x: x(perturbStep) + 5, y: 28, class: 'tick'}); marker.textContent = `edit step ${perturbStep}`; svg.append(marker);
  }
  container.replaceChildren(svg);
}

function drawP6() {
  const container = $('p6-chart');
  const metric = $('p6-metric').value;
  if (!metric) {
    emptyChart(container, 'No exported P6 RMS metric is available.');
    drawSeriesLegend('p6-legend', []);
    return;
  }
  const series = problemRuns('p6').map(run => ({
    run,
    values: historyOf(run, metric).filter(([, value]) => value > 0)
  })).filter(item => item.values.length);
  if (!series.length) {
    emptyChart(container, 'The selected RMS metric has no recorded P6 values.');
    drawSeriesLegend('p6-legend', []);
    return;
  }
  const transformed = series.map(item => ({...item, values: item.values.map(([step, value]) => [step, Math.log10(value), value])}));
  const xDomain = paddedDomain(transformed.flatMap(item => item.values.map(point => point[0])), .01);
  const yDomain = paddedDomain(transformed.flatMap(item => item.values.map(point => point[1])), .06);
  const {svg, x, y} = makePlotShell(xDomain, yDomain, 'optimizer step', 'log10 RMS');
  transformed.forEach((item, index) => {
    const color = seriesColor(index);
    const d = item.values.map(([step, value], pointIndex) => `${pointIndex ? 'L' : 'M'}${x(step).toFixed(2)},${y(value).toFixed(2)}`).join(' ');
    const path = svgElement('path', {d, class: 'curve', stroke: color, opacity: .82});
    path.addEventListener('pointermove', event => showTooltip(event, item.run, metric.replace('logging/rms/', 'RMS · ')));
    path.addEventListener('pointerleave', hideTooltip);
    svg.append(path);
  });
  container.replaceChildren(svg);
  drawSeriesLegend('p6-legend', transformed.map((item, index) => [String(item.run.name).split('-p6-').pop() || item.run.name, seriesColor(index)]));
}

function populateProblemControls() {
  const p1Groups = [...new Set(problemRuns('p1').map(groupOf))].sort();
  const groupSelect = $('p1-group');
  const previousGroup = groupSelect.value;
  groupSelect.replaceChildren(new Option('All P1 groups', 'all'), ...p1Groups.map(group => new Option(group, group)));
  groupSelect.value = p1Groups.includes(previousGroup) ? previousGroup : 'all';

  const p4Runs = problemRuns('p4').filter(run => !String(run.name).includes('p4-single-point-baseline'));
  const p4Select = $('p4-run');
  const previousP4 = p4Select.value;
  p4Select.replaceChildren(...(p4Runs.length ? p4Runs.map(run => {
    const shortName = String(run.name).split('-p4-').pop() || run.name;
    return new Option(`${groupOf(run)} · ${shortName}`, run.id);
  }) : [new Option('Awaiting P4 runs', '')]));
  p4Select.value = p4Runs.some(run => String(run.id) === previousP4) ? previousP4 : String(p4Runs[0]?.id || '');

  const metrics = [...new Set(problemRuns('p6').flatMap(run => Object.keys(run.history || {}).filter(key => key.startsWith('logging/rms/'))))];
  const priority = ['logging/rms/global/activation', 'logging/rms/global/gradient', 'logging/rms/global/parameter'];
  metrics.sort((a, b) => {
    const aPriority = priority.indexOf(a), bPriority = priority.indexOf(b);
    if (aPriority >= 0 || bPriority >= 0) return (aPriority >= 0 ? aPriority : priority.length) - (bPriority >= 0 ? bPriority : priority.length);
    return a.localeCompare(b);
  });
  const metricSelect = $('p6-metric');
  const previousMetric = metricSelect.value;
  metricSelect.replaceChildren(...(metrics.length ? metrics.map(metric => new Option(metric.replace('logging/rms/', ''), metric)) : [new Option('Awaiting RMS metrics', '')]));
  metricSelect.value = metrics.includes(previousMetric) ? previousMetric : (metrics[0] || '');
}

function drawProblemViews() {
  drawP1();
  drawP1Heatmap();
  drawP2();
  drawP3();
  drawP4();
  drawP6();
}

function configSummary(config = {}) {
  config = config && typeof config === 'object' ? config : {};
  const preferred = ['learning_rate', 'batch_size', 'warmup_percent', 'weight_decay', 'lr_schedule', 'dropout', 'beta1', 'beta2', 'model_seed', 'data_seed', 'deterministic', 'num_train_sequences'];
  const keys = [...preferred.filter(key => key in config), ...Object.keys(config).filter(key => !preferred.includes(key))].slice(0, 8);
  return keys.map(key => [key, config[key]]);
}

function renderTable() {
  const tbody = $('run-table');
  if (!visibleRuns.length) {
    const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = 9; cell.className = 'empty-cell'; cell.textContent = 'No run records match these filters.'; row.append(cell); tbody.replaceChildren(row); return;
  }
  tbody.replaceChildren(...visibleRuns.map(run => {
    const row = document.createElement('tr');
    const name = document.createElement('td'); name.textContent = text(run.name || run.id, 'unnamed run');
    const problem = document.createElement('td'); problem.textContent = `${problemOf(run)} / ${groupOf(run)}`;
    const status = document.createElement('td'); const badge = document.createElement('span'); badge.className = `state ${stateClass(run)}`; badge.textContent = stateLabel(run); status.append(badge);
    const model = document.createElement('td'); model.textContent = modelOf(run);
    const config = document.createElement('td'); configSummary(run.config).forEach(([key, value]) => { const code = document.createElement('code'); code.textContent = `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`; config.append(code); });
    const train = document.createElement('td'); train.textContent = formatNumber(run.summary?.final_train_loss);
    const val = document.createElement('td'); val.textContent = formatNumber(run.summary?.final_val_loss);
    const runtime = document.createElement('td'); runtime.textContent = formatRuntime(run.summary?.elapsed_seconds);
    const linkCell = document.createElement('td'); if (run.url) { const link = document.createElement('a'); link.href = run.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open ↗'; linkCell.append(link); } else linkCell.textContent = '—';
    row.append(name, problem, status, model, config, train, val, runtime, linkCell); return row;
  }));
}

function updateView() {
  visibleRuns = filtered();
  $('filtered-count').textContent = `${visibleRuns.length} run${visibleRuns.length === 1 ? '' : 's'} in view`;
  drawScatter(); drawCurves(); renderTable();
}

function csvValue(value) { const raw = value === null || value === undefined ? '' : String(value); return `"${raw.replaceAll('"', '""')}"`; }
function exportCsv() {
  const header = ['id', 'name', 'problem', 'group', 'state', 'gpu', 'model', 'final_train_loss', 'final_val_loss', 'elapsed_seconds', 'url', 'config_json'];
  const rows = visibleRuns.map(run => [run.id, run.name, problemOf(run), groupOf(run), stateLabel(run), run.gpu, modelOf(run), run.summary?.final_train_loss, run.summary?.final_val_loss, run.summary?.elapsed_seconds, run.url, JSON.stringify(run.config || {})]);
  const blob = new Blob([[header, ...rows].map(row => row.map(csvValue).join(',')).join('\n')], {type: 'text/csv'});
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'cs312-a1-visible-runs.csv'; link.click(); URL.revokeObjectURL(url);
}

async function load() {
  try {
    const response = await fetch('results.json', {cache: 'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const next = await response.json();
    record = {...record, ...next, assignment: next.assignment || {}, runs: Array.isArray(next.runs) ? next.runs.filter(run => run && typeof run === 'object') : []};
    populateFilters(); populateProblemControls(); setStatus(); updateView(); drawProblemViews();
  } catch (error) {
    record.status = 'failed'; setStatus();
    $('dataset-state').textContent = `Run export unavailable: ${error.message}`;
    $('status-dot').className = 'status-dot error';
    emptyChart($('scatter-chart'), 'The run export could not be loaded.');
    emptyChart($('curve-chart'), 'The run export could not be loaded.');
    ['p1-chart', 'p1-heatmap', 'p2-chart', 'p3-chart', 'p4-chart', 'p6-chart'].forEach(id => emptyChart($(id), 'The run export could not be loaded.'));
    drawSeriesLegend('p2-legend', []); drawSeriesLegend('p6-legend', []);
    renderTable();
  }
}

$('filters').addEventListener('change', updateView);
$('problem-views').addEventListener('change', drawProblemViews);
$('export-csv').addEventListener('click', exportCsv);
load();
