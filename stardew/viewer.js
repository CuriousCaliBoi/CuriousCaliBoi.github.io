(() => {
  'use strict';
  const publicHost = 'https://spark-a4b4.tailef40b0.ts.net';
  const base = location.hostname === 'curiouscaliboi.github.io' ? publicHost + '/stardojo-live' :
    (location.pathname.startsWith('/stardojo-live') ? '/stardojo-live' : '');
  const el = id => document.getElementById(id);
  const text = (id, value) => { el(id).textContent = value; };
  let paused = false, frameURL = null, received = 0, agentStatus = null;
  const video = el('video');
  let hls = null, videoSession = null, videoStarted = 0, retryVideoAt = 0;
  let playing = false, lastVideoTime = -1;
  let frameSample = null;
  video.muted = true;
  if (video.requestVideoFrameCallback) {
    const sampleFrames = (now, metadata) => {
      if (!frameSample) frameSample = {at:now, frames:metadata.presentedFrames};
      if (now - frameSample.at >= 2000) {
        video.dataset.renderFps = ((metadata.presentedFrames - frameSample.frames) * 1000 / (now - frameSample.at)).toFixed(1);
        frameSample = {at:now, frames:metadata.presentedFrames};
      }
      video.requestVideoFrameCallback(sampleFrames);
    };
    video.requestVideoFrameCallback(sampleFrames);
  }
  const title = value => String(value || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  const number = value => typeof value === 'number' ? Math.round(value).toLocaleString() : '—';
  const phases = {planning:'Planning', acting:'Acting', evaluating:'Checking result', loading:'Loading task', starting:'Starting', success:'Task complete', complete:'Run complete', complete_with_errors:'Finished with errors', retrying:'Retrying task', episode_interrupted:'Task interrupted', budget_exhausted:'Budget reached', interrupted:'Stopped', infrastructure_error:'Needs attention', stopped:'Stopped', failed:'Needs attention'};
  const hints = {planning:'The game pauses while the model chooses what to do next.', acting:'The controller is carrying out the selected action in the game.', evaluating:'The benchmark evaluator is checking the observed result.', loading:'Preparing the official task and its starting save.', starting:'Preparing the game and local model.', success:'The evaluator confirmed this task succeeded.', complete:'All selected episodes have finished.', complete_with_errors:'The run finished with interrupted tasks. A complete benchmark score is unavailable.', retrying:'A connection failed. Restarting this task once from its original save; the interrupted attempt remains unscored.', episode_interrupted:'This task was interrupted by a runner error and remains unscored. Continuing to the next task.', budget_exhausted:'This task reached its action limit without confirmed success.', interrupted:'The run was stopped. Completed episode results are retained.', infrastructure_error:'The runner needs attention before it can continue. Interrupted attempts remain unscored.'};

  function notify(state, message) {
    el('connection').dataset.state = state;
    text('connection-text', message);
    if (window.parent !== window) {
      window.parent.postMessage({type:'zuko:experiment-status', state, message}, location.origin);
    }
  }
  function freshness() {
    const fresh = Date.now() - received < 6000;
    el('screen-stale').hidden = (!frameURL && !playing) || (fresh && !paused);
    if (paused) {
      text('screen-stale', 'Feed paused · the agent keeps playing');
      notify('wait', 'Feed paused');
    } else if (fresh) {
      notify('live', 'Live gameplay');
    } else {
      text('screen-stale', 'Feed interrupted · last received frame');
      notify('off', 'Waiting for game');
      text('notice-title', 'The farm is offline.');
      text('notice-copy', 'This page reconnects automatically when the game returns.');
    }
  }
  async function request(route) {
    const response = await fetch(base + route, {cache:'no-store', signal:AbortSignal.timeout(6000)});
    if (!response.ok) throw new Error('Feed unavailable');
    return response;
  }
  function stopVideo() {
    if (hls) hls.destroy();
    hls = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.hidden = true;
    playing = false;
    videoSession = null;
    lastVideoTime = -1;
    text('stream-format', 'Image fallback');
  }
  function failedVideo() {
    stopVideo();
    retryVideoAt = Date.now() + 5000;
  }
  function startVideo(info) {
    if (paused || document.hidden || !info?.live || info.session === videoSession || Date.now() < retryVideoAt) return;
    if (!window.Hls?.isSupported() && !video.canPlayType('application/vnd.apple.mpegurl')) return;
    stopVideo();
    videoSession = info.session;
    videoStarted = Date.now();
    const url = base + '/video/live.m3u8';
    if (window.Hls?.isSupported()) {
      hls = new Hls({enableWorker:false, lowLatencyMode:true, liveSyncDurationCount:2,
        liveMaxLatencyDurationCount:5, maxLiveSyncPlaybackRate:1.1, backBufferLength:5, maxBufferLength:8});
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(failedVideo); });
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) failedVideo(); });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      video.src = url;
      video.play().catch(failedVideo);
    }
  }
  video.addEventListener('playing', () => {
    frameSample = null;
    playing = true;
    video.hidden = false;
    el('game').hidden = true;
    el('screen-notice').hidden = true;
    text('stream-format', '60 fps video');
  });
  video.addEventListener('error', failedVideo);
  async function frames() {
    const started = performance.now();
    if (!paused && !document.hidden && playing) {
      if (video.currentTime !== lastVideoTime) {
        received = Date.now();
        lastVideoTime = video.currentTime;
      } else if (Date.now() - received > 6000) {
        failedVideo();
      }
    }
    if (videoSession && !playing && Date.now() - videoStarted > 12000) failedVideo();
    if (!paused && !document.hidden && !playing) {
      try {
        const response = await request('/frame.jpg');
        const next = URL.createObjectURL(await response.blob());
        const previous = frameURL;
        frameURL = next;
        el('game').src = next;
        el('game').hidden = playing;
        el('screen-notice').hidden = true;
        if (previous) URL.revokeObjectURL(previous);
        received = Date.now();
      } catch (_) {
        // A stalled connection must not leave a cached image labeled live.
      }
    }
    freshness();
    setTimeout(frames, Math.max(40, 250 - (performance.now() - started)));
  }
  function stat(value, label) {
    const cell = document.createElement('div');
    const count = document.createElement('strong');
    const caption = document.createElement('span');
    count.textContent = number(value); caption.textContent = label;
    cell.append(count, caption);
    return cell;
  }
  function render(data) {
    startVideo(data.video);
    if (!data.mode) return;
    if (playing && data.video?.width && data.video?.height) {
      el('screen').style.aspectRatio = data.video.width + ' / ' + data.video.height;
    }
    const benchmark = data.mode === 'benchmark';
    text('model', data.model || 'Nemotron 3 Super');
    const phase = data.running ? data.phase : (['complete','complete_with_errors','interrupted','infrastructure_error','failed'].includes(data.phase) ? data.phase : 'stopped');
    text('mode', benchmark ? 'STARDOJO LITE' : 'CONTINUOUS FREE PLAY');
    text('phase', phases[phase] || title(phase));
    text('goal', title(data.goal) || (benchmark ? 'Preparing the next benchmark task.' : 'Explore, develop the farm, and meet villagers.'));
    const unresolved = benchmark && data.unresolved ? ' ' + number(data.unresolved) + ' task(s) remain unscored after runner errors.' : '';
    text('context', (hints[phase] || (data.running ? 'Making steady progress through farm work, exploration, and social interaction.' : 'The agent is stopped. Its last recorded objective is shown above.')) + unresolved);
    text('action', !data.running ? 'Agent is not running' : (data.action ? title(data.action) : (phase === 'planning' ? 'Choosing the next action…' : 'Waiting for the next action')));
    el('benchmark').hidden = !benchmark;
    if (benchmark) {
      text('task-index', [data.task_id, title(data.difficulty), data.repeat ? 'Pass ' + data.repeat : ''].filter(Boolean).join(' · '));
      text('task-steps', 'Step ' + (data.step || 0) + ' / ' + (data.budget || '—'));
      const target = Number(data.target) || 1;
      el('task-progress').max = target;
      el('task-progress').value = Math.max(0, Number(data.quantity) || 0);
      text('task-quantity', number(data.quantity) + ' / ' + number(data.target) + ' task progress');
      el('agent-stats').replaceChildren(stat(data.completed, 'Episodes scored'), stat(data.total, 'Scheduled'), stat(data.successes, 'Succeeded'));
    } else {
      el('agent-stats').replaceChildren(stat(data.metrics?.skills_completed, 'Skills completed'), stat(data.locations, 'Places explored'), stat(data.people, 'Villagers spotted'));
    }
    const world = data.world || {};
    text('location', world.location || 'Waiting for the game');
    text('energy', number(world.energy)); text('health', number(world.health));
    text('gold', number(world.gold)); text('year', number(world.year));
    if (Number.isFinite(world.time)) {
      const hours = Math.floor(world.time / 100), minutes = String(world.time % 100).padStart(2, '0');
      text('game-clock', title(world.season) + ' ' + world.day + ' · ' + (hours % 12 || 12) + ':' + minutes + (hours >= 12 && hours < 24 ? ' pm' : ' am'));
    }
    const rows = (data.recent || []).slice().reverse().map(row => {
      const outcome = row.success === null ? 'Interrupted · unscored' : (row.success ? 'Completed' : 'Not completed');
      const item = document.createElement('li');
      const icon = document.createElement('span');
      icon.className = 'outcome' + (row.success ? '' : ' failed');
      icon.textContent = row.success ? '✓' : '↻';
      icon.setAttribute('aria-label', outcome);
      const detail = document.createElement('div');
      const label = document.createElement('div'); label.className = 'activity-label'; label.textContent = title(row.label);
      const where = document.createElement('div'); where.className = 'activity-detail';
      where.textContent = [outcome, title(row.detail)].filter(Boolean).join(' · ');
      detail.append(label, where); item.append(icon, detail); return item;
    });
    if (rows.length) el('activity').replaceChildren(...rows);
  }
  async function status() {
    if (!paused && !document.hidden) {
      try {
        const response = await request('/api/status');
        agentStatus = await response.json();
        render(agentStatus);
      } catch (_) {
        text('phase', 'Status unavailable');
        text('context', 'Waiting for the runner. Any objective shown is the last received status.');
        text('action', 'Waiting for current agent status');
      }
    }
    setTimeout(status, 1500);
  }
  el('pause').addEventListener('click', () => {
    paused = !paused;
    if (paused) { video.pause(); if (hls) hls.stopLoad(); }
    else { stopVideo(); if (agentStatus) startVideo(agentStatus.video); }
    text('pause', paused ? 'Resume feed' : 'Pause feed');
    freshness();
  });
  el('fullscreen').addEventListener('click', async () => {
    if (el('screen').requestFullscreen) {
      try { await el('screen').requestFullscreen(); } catch (_) { /* Embedded hosts can restrict fullscreen. */ }
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !paused) stopVideo(); });
  window.addEventListener('pagehide', () => { stopVideo(); if (frameURL) URL.revokeObjectURL(frameURL); });
  frames(); status();
})();
