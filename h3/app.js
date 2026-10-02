(() => {
  'use strict';

  const LOCAL_API = 'http://127.0.0.1:8791';
  const POLL_DELAY = 2000;
  const REQUEST_TIMEOUT = 15000;
  const MAX_SEED = 2147483647;

  const elements = {
    form: document.querySelector('#generation-form'),
    prompt: document.querySelector('#prompt'),
    seed: document.querySelector('#seed'),
    randomize: document.querySelector('[data-randomize]'),
    clear: document.querySelector('[data-clear]'),
    submit: document.querySelector('[data-submit]'),
    submitLabel: document.querySelector('[data-submit-label]'),
    characterCount: document.querySelector('[data-character-count]'),
    connection: document.querySelector('[data-connection]'),
    connectionLabel: document.querySelector('[data-connection-label]'),
    apiLabel: document.querySelector('[data-api-label]'),
    footerState: document.querySelector('[data-footer-state]'),
    notice: document.querySelector('[data-service-notice]'),
    noticeTitle: document.querySelector('[data-notice-title]'),
    noticeDetail: document.querySelector('[data-notice-detail]'),
    reconnect: document.querySelector('[data-reconnect]'),
    status: document.querySelector('[data-job-status]'),
    queue: document.querySelector('[data-queue-position]'),
    progressLabel: document.querySelector('[data-progress-label]'),
    progressTrack: document.querySelector('[data-progress-track]'),
    progressBar: document.querySelector('[data-progress-bar]'),
    placeholder: document.querySelector('[data-result-placeholder]'),
    placeholderTitle: document.querySelector('[data-placeholder-title]'),
    placeholderDetail: document.querySelector('[data-placeholder-detail]'),
    video: document.querySelector('[data-result-video]'),
    caption: document.querySelector('[data-result-caption]'),
    download: document.querySelector('[data-download]')
  };

  const state = {
    apiBase: '',
    ready: false,
    active: false,
    jobId: null,
    statusUrl: null,
    pollTimer: null,
    pollVersion: 0,
    pollFailures: 0
  };

  class ApiError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  function reportToParent(statusState, message) {
    if (window.parent === window) return;
    window.parent.postMessage({
      type: 'zuko:experiment-status',
      state: statusState,
      message
    }, window.location.origin);
  }

  function randomSeed() {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] & MAX_SEED;
  }

  function normalizeApiBase(value) {
    const parsed = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported API protocol.');
    if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Invalid API address.');
    return parsed.href.replace(/\/+$/, '');
  }

  async function discoverApi() {
    const override = new URLSearchParams(window.location.search).get('api');
    if (override) return normalizeApiBase(override);

    try {
      const response = await fetch(`live.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const config = await response.json();
        if (config.api) return normalizeApiBase(config.api);
      }
    } catch (_error) {
      // A local API remains useful when the static config is unavailable.
    }

    return LOCAL_API;
  }

  function apiUrl(path) {
    return new URL(path, `${state.apiBase}/`).href;
  }

  function responseUrl(value) {
    return new URL(value, `${state.apiBase}/`).href;
  }

  async function requestJson(url, options = {}) {
    const { allowBusyResponse = false, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        cache: 'no-store',
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
          ...(fetchOptions.headers || {})
        },
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type') || '';
      let payload = {};
      if (contentType.includes('application/json')) {
        payload = await response.json();
      } else {
        const text = await response.text();
        if (text.trim()) payload = { message: text.trim().slice(0, 240) };
      }

      if (!response.ok && !(allowBusyResponse && payload.accepting_jobs === false)) {
        const detail = payload.detail;
        const message = payload.error
          || (typeof detail === 'string' ? detail : detail?.error || detail?.message)
          || payload.message
          || `The service returned ${response.status}.`;
        throw new ApiError(String(message), response.status);
      }

      return payload;
    } catch (error) {
      if (error.name === 'AbortError') throw new ApiError('The DGX did not answer in time.');
      if (error instanceof ApiError) throw error;
      throw new ApiError('The private DGX service could not be reached.');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function setConnection(kind, label) {
    elements.connection.dataset.connection = kind;
    elements.connectionLabel.textContent = label;
  }

  function showNotice(tone, title, detail, reconnect = false) {
    elements.notice.hidden = false;
    elements.notice.dataset.tone = tone;
    elements.noticeTitle.textContent = title;
    elements.noticeDetail.textContent = detail;
    elements.reconnect.hidden = !reconnect;
  }

  function hideNotice() {
    elements.notice.hidden = true;
    elements.reconnect.hidden = true;
  }

  function setProgress(value, indeterminate = false) {
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    elements.progressTrack.dataset.indeterminate = String(indeterminate);
    elements.progressTrack.setAttribute('aria-valuenow', String(Math.round(percent)));
    elements.progressTrack.setAttribute('aria-valuetext', indeterminate ? 'In progress' : `${Math.round(percent)} percent`);
    elements.progressBar.style.width = indeterminate ? '' : `${percent}%`;
    elements.progressLabel.textContent = indeterminate ? 'Working' : (percent > 0 ? `${Math.round(percent)}%` : '—');
  }

  function normalizedProgress(job) {
    const raw = typeof job.progress === 'object' ? job.progress?.percent : job.progress;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return value > 0 && value <= 1 ? value * 100 : value;
  }

  function setPlaceholder(title, detail) {
    elements.placeholder.hidden = false;
    elements.placeholderTitle.textContent = title;
    elements.placeholderDetail.textContent = detail;
  }

  function clearVideo() {
    elements.video.pause();
    elements.video.removeAttribute('src');
    elements.video.load();
    elements.video.hidden = true;
    elements.download.hidden = true;
    elements.download.removeAttribute('href');
  }

  function seedIsValid() {
    const value = Number(elements.seed.value);
    return Number.isInteger(value) && value >= 0 && value <= MAX_SEED;
  }

  function updateControls() {
    const canSubmit = state.ready && !state.active && elements.prompt.value.trim().length > 0 && seedIsValid();
    elements.submit.disabled = !canSubmit;
    elements.clear.disabled = state.active;
    elements.prompt.disabled = state.active;
    elements.seed.disabled = state.active;
    elements.randomize.disabled = state.active;
    elements.submitLabel.textContent = state.active ? 'Generating…' : 'Generate video';
  }

  function setRunSummary(status, queue = '—') {
    elements.status.textContent = status;
    elements.queue.textContent = queue;
  }

  function jobMessage(job, fallback) {
    return String(job.error || job.detail || job.message || job.blocker_reason || job.blocker || fallback);
  }

  function finishRun() {
    state.active = false;
    state.pollFailures = 0;
    window.clearTimeout(state.pollTimer);
    updateControls();
  }

  function renderVideo(job) {
    const rawUrl = job.video_url || job.output_url || job.result?.video_url || job.result?.url;
    if (!rawUrl) {
      finishRun();
      setRunSummary('Incomplete');
      setProgress(100);
      showNotice('error', 'The render finished without a video URL', 'The DGX reported success, but did not provide a file to play.');
      setPlaceholder('The render is missing its file.', 'Try the prompt again or check the DGX service logs.');
      elements.caption.textContent = `Job ${state.jobId} completed without an output file.`;
      reportToParent('wait', 'Render completed without a video');
      return;
    }

    const url = responseUrl(rawUrl);
    finishRun();
    state.ready = true;
    setConnection('ready', 'Spark ready');
    setRunSummary('Complete');
    setProgress(100);
    hideNotice();
    elements.placeholder.hidden = true;
    elements.video.src = url;
    elements.video.hidden = false;
    elements.video.load();
    elements.download.href = url;
    elements.download.hidden = false;
    elements.caption.textContent = `Job ${state.jobId} · seed ${elements.seed.value}`;
    elements.footerState.textContent = 'Video ready';
    reportToParent('live', 'Video ready');
  }

  function renderTerminalError(job, status) {
    finishRun();
    const blocked = status === 'blocked';
    const title = blocked ? 'The render was blocked' : 'The render did not finish';
    const detail = jobMessage(job, blocked ? 'The service cannot run this request right now.' : 'The DGX reported a generation error.');
    setRunSummary(blocked ? 'Blocked' : 'Failed');
    setProgress(0);
    showNotice('error', title, detail);
    setPlaceholder(title, 'Adjust the prompt or reconnect before trying again.');
    elements.caption.textContent = state.jobId ? `Job ${state.jobId}` : 'Generation failed.';
    elements.footerState.textContent = blocked ? 'Request blocked' : 'Generation failed';
    reportToParent('wait', blocked ? 'Generation blocked' : 'Generation failed');
  }

  function schedulePoll(delay = POLL_DELAY) {
    const version = state.pollVersion;
    window.clearTimeout(state.pollTimer);
    state.pollTimer = window.setTimeout(() => pollJob(version), delay);
  }

  function renderJob(job) {
    const status = String(job.status || job.state || 'queued').toLowerCase();
    if (job.status_url) state.statusUrl = responseUrl(job.status_url);

    if (status === 'succeeded' || status === 'completed' || status === 'complete') {
      renderVideo(job);
      return;
    }

    if (status === 'failed' || status === 'blocked' || status === 'cancelled' || status === 'canceled') {
      renderTerminalError(job, status === 'blocked' ? 'blocked' : 'failed');
      return;
    }

    const progress = normalizedProgress(job);
    if (status === 'running' || status === 'processing' || status === 'generating') {
      setRunSummary('Rendering');
      setProgress(progress === null ? 0 : progress, progress === null);
      showNotice('busy', 'Rendering on the Spark', 'The page will keep this job attached if the network briefly drops.');
      setPlaceholder('The scene is being rendered.', progress === null ? 'Waiting for the next update from the model.' : `${Math.round(progress)}% complete.`);
      elements.caption.textContent = `Job ${state.jobId} is running.`;
      elements.footerState.textContent = 'Rendering';
      reportToParent('wait', progress === null ? 'Rendering video' : `Rendering video · ${Math.round(progress)}%`);
    } else {
      const rawPosition = job.queue_position;
      const queue = rawPosition === null || rawPosition === undefined ? 'Waiting' : `#${rawPosition}`;
      setRunSummary('Queued', queue);
      setProgress(0, true);
      showNotice('busy', 'Queued on the Spark', rawPosition === null || rawPosition === undefined ? 'The render will start when the GPU is ready.' : `Queue position ${rawPosition}.`);
      setPlaceholder('Your prompt is in the queue.', 'The result will replace this panel when it is ready.');
      elements.caption.textContent = `Job ${state.jobId} is queued.`;
      elements.footerState.textContent = 'Queued';
      reportToParent('wait', rawPosition === null || rawPosition === undefined ? 'Video queued' : `Video queued · position ${rawPosition}`);
    }

    schedulePoll();
  }

  async function pollJob(version) {
    if (!state.active || version !== state.pollVersion) return;
    const url = state.statusUrl || apiUrl(`/api/jobs/${encodeURIComponent(state.jobId)}`);

    try {
      const job = await requestJson(url);
      if (!state.active || version !== state.pollVersion) return;
      state.pollFailures = 0;
      renderJob(job);
    } catch (error) {
      if (!state.active || version !== state.pollVersion) return;
      state.pollFailures += 1;
      setConnection('offline', 'Connection lost');
      showNotice('error', 'The job is still attached', `${error.message} Reconnect to resume updates.`, true);
      elements.footerState.textContent = 'Connection interrupted';
      reportToParent('wait', 'Connection interrupted · job preserved');
      if (state.pollFailures < 3) schedulePoll(4000);
    }
  }

  async function checkHealth() {
    setConnection('checking', 'Finding Spark');
    elements.footerState.textContent = 'Checking private service';
    showNotice('info', 'Looking for the DGX Spark', 'Checking the private service before accepting a prompt.');
    state.ready = false;
    updateControls();
    reportToParent('wait', 'Connecting to the DGX Spark');

    try {
      const health = await requestJson(apiUrl('/healthz'), { allowBusyResponse: true });
      const blocker = health.blocker_reason || health.blocker?.reason || health.blocker?.message || health.blocker || health.reason || health.message;

      if (health.accepting_jobs === false) {
        setConnection('busy', 'Spark busy');
        setRunSummary(state.active ? elements.status.textContent : 'Unavailable');
        showNotice('busy', 'The Spark is online but not accepting work', String(blocker || 'The model may still be loading. Check again in a moment.'), true);
        elements.footerState.textContent = 'Online · not accepting jobs';
        reportToParent('wait', 'Spark online · not accepting jobs');
        return false;
      }

      state.ready = true;
      setConnection('ready', 'Spark ready');
      elements.footerState.textContent = 'Connected through Tailscale';
      hideNotice();
      if (!state.active) setRunSummary('Ready');
      updateControls();
      reportToParent('live', state.active ? 'Reconnected to active render' : 'Ready to generate');
      if (state.active) schedulePoll(0);
      return true;
    } catch (error) {
      setConnection('offline', 'Spark offline');
      if (!state.active) setRunSummary('Offline');
      showNotice('error', 'The private service is out of reach', 'Connect this device to the Tailscale network, then reconnect.', true);
      elements.footerState.textContent = 'Private service unavailable';
      reportToParent('off', 'Spark unavailable · connect through Tailscale');
      updateControls();
      return false;
    }
  }

  async function submitJob(event) {
    event.preventDefault();
    if (state.active || !state.ready) return;

    const prompt = elements.prompt.value.trim();
    const seed = Number(elements.seed.value);
    if (!prompt || !seedIsValid()) return;

    state.active = true;
    state.jobId = null;
    state.statusUrl = null;
    state.pollFailures = 0;
    state.pollVersion += 1;
    clearVideo();
    setRunSummary('Submitting');
    setProgress(0, true);
    showNotice('busy', 'Sending the prompt', 'Creating a new render on the DGX Spark.');
    setPlaceholder('Sending your prompt to the Spark.', 'The queue position will appear here next.');
    elements.caption.textContent = 'Creating a new job…';
    elements.footerState.textContent = 'Submitting prompt';
    updateControls();
    reportToParent('wait', 'Submitting video prompt');

    try {
      const job = await requestJson(apiUrl('/api/jobs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, seed })
      });

      const id = job.id || job.job_id;
      if (!id) throw new ApiError('The DGX accepted the request without returning a job ID.');
      state.jobId = String(id);
      state.statusUrl = job.status_url ? responseUrl(job.status_url) : apiUrl(`/api/jobs/${encodeURIComponent(state.jobId)}`);
      renderJob(job);
    } catch (error) {
      finishRun();
      const isNetworkError = !error.status || error.status >= 500;
      if (isNetworkError) {
        state.ready = false;
        setConnection('offline', 'Spark offline');
      }
      setRunSummary('Error');
      setProgress(0);
      showNotice('error', 'The prompt could not be submitted', error.message, isNetworkError);
      setPlaceholder('No job was created.', 'Reconnect or revise the prompt, then try again.');
      elements.caption.textContent = 'Submission failed.';
      elements.footerState.textContent = 'Submission failed';
      reportToParent(isNetworkError ? 'off' : 'wait', 'Could not submit the video prompt');
      updateControls();
    }
  }

  function resetPage() {
    if (state.active) return;
    state.pollVersion += 1;
    window.clearTimeout(state.pollTimer);
    state.jobId = null;
    state.statusUrl = null;
    elements.prompt.value = '';
    elements.seed.value = String(randomSeed());
    elements.characterCount.textContent = '0 / 1200';
    clearVideo();
    setRunSummary(state.ready ? 'Ready' : 'Offline');
    setProgress(0);
    setPlaceholder('Your generated video will appear here.', 'The first render may take longer while the model warms up.');
    elements.caption.textContent = 'No render yet.';
    if (state.ready) hideNotice();
    updateControls();
    elements.prompt.focus();
  }

  async function initialize() {
    elements.seed.value = String(randomSeed());
    updateControls();

    try {
      state.apiBase = await discoverApi();
      const endpoint = new URL(state.apiBase);
      elements.apiLabel.textContent = endpoint.hostname === '127.0.0.1' || endpoint.hostname === 'localhost' ? 'Local DGX endpoint' : 'DGX Spark / private';
      await checkHealth();
    } catch (_error) {
      state.apiBase = LOCAL_API;
      elements.apiLabel.textContent = 'Local DGX endpoint';
      await checkHealth();
    }
  }

  elements.prompt.addEventListener('input', () => {
    elements.characterCount.textContent = `${elements.prompt.value.length} / 1200`;
    updateControls();
  });
  elements.seed.addEventListener('input', updateControls);
  elements.randomize.addEventListener('click', () => {
    elements.seed.value = String(randomSeed());
    updateControls();
  });
  elements.clear.addEventListener('click', resetPage);
  elements.reconnect.addEventListener('click', checkHealth);
  elements.form.addEventListener('submit', submitJob);
  elements.video.addEventListener('loadedmetadata', () => {
    elements.caption.textContent = `Job ${state.jobId} · ${Math.round(elements.video.duration || 0)}s · seed ${elements.seed.value}`;
  });
  elements.video.addEventListener('error', () => {
    showNotice('error', 'The video could not be played here', 'Use Download video to open the file directly from the Spark.');
  });
  window.addEventListener('beforeunload', () => window.clearTimeout(state.pollTimer));

  initialize();
})();
