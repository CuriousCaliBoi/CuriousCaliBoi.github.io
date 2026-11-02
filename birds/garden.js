(() => {
  'use strict';
  const endpoint = 'https://spark-a4b4.tailef40b0.ts.net/birds-live';
  const byId = id => document.getElementById(id);
  const dateFormat = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
  let snapshot = null;
  let receivedAt = 0;
  let serverClock = 0;
  let renderedRows = '';
  let stream = null;
  let fetching = false;

  function relative(value, now) {
    const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
    return dateFormat.format(new Date(value));
  }

  function accept(data) {
    if (!Array.isArray(data.detections) || !Number.isFinite(Date.parse(data.serverTime))) throw new Error('Invalid feed');
    if (snapshot?.updatedAt && data.updatedAt && Date.parse(data.updatedAt) < Date.parse(snapshot.updatedAt)) return;
    snapshot = data;
    receivedAt = Date.now();
    serverClock = Date.parse(data.serverTime);
    render();
  }

  function render() {
    if (!snapshot) return;
    const now = serverClock + (Date.now() - receivedAt);
    const lastUpdate = snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : 0;
    const fresh = lastUpdate > 0 && now - lastUpdate < 90000 && now - Date.parse(snapshot.observedAt) < 90000 && Date.now() - receivedAt < 90000;
    const live = fresh && snapshot.healthy;
    byId('status-dot').classList.toggle('live', live);
    byId('status').textContent = live ? 'Listening in Fremont' : fresh ? 'The microphone is taking a pause' : lastUpdate ? 'The listening post is offline' : 'Waiting for the listening post';
    byId('status-detail').textContent = live ? 'The garden’s field notes update on their own.' : fresh ? 'The Pi is connected; bird listening needs attention.' : lastUpdate ? 'Saved visits remain here. New notes will return when the station reconnects.' : 'New birds will appear when the station connects.';
    byId('station-time').textContent = lastUpdate ? `Station checked in ${relative(snapshot.updatedAt, now)} · Pacific time` : 'Fremont, California · Pacific time';
    const rows = snapshot.detections.filter(row => row.confidence >= .75 && Date.parse(row.detectedAt) <= now + 120000 && now - Date.parse(row.detectedAt) < 7 * 86400000);
    rows.sort((a,b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
    byId('last-heard').textContent = rows.length ? `Last heard: ${rows[0].commonName} · ${relative(rows[0].detectedAt, now)}` : 'Fresh notes arrive here automatically';
    byId('empty').hidden = rows.length > 0;
    byId('list-note').hidden = rows.length === 0;
    byId('empty-title').textContent = live ? 'Listening for a little life.' : 'Waiting for the first field notes.';
    byId('empty-copy').textContent = live ? 'No recent bird identifications yet. The microphone is listening.' : 'Birds heard by the garden microphone will appear here.';
    const signature = JSON.stringify(rows) + Math.floor(now / 60000);
    if (signature === renderedRows) return;
    renderedRows = signature;
    const groups = new Map();
    rows.forEach(row => {
      const key = row.scientificName;
      if (!groups.has(key)) groups.set(key, {...row, count:0});
      groups.get(key).count++;
    });
    const fragment = document.createDocumentFragment();
    groups.forEach(bird => {
      const card = document.createElement('article');
      card.className = 'bird-card';
      card.innerHTML = '<div class="bird-top"><svg viewBox="0 0 80 60" aria-hidden="true"><path d="M8 46c20 0 35-7 58-3M34 39c-13-4-13-18-4-24 6-4 14-1 17 4l9 3-9 4c-1 10-6 15-13 13l-8 6m5-10L15 25m19 14 2 6m7-10 2 9"/><circle cx="42" cy="20" r="1.5"/></svg><time class="when"></time></div><h3></h3><p class="latin"></p><div class="bird-bottom"><span></span><span></span></div>';
      card.querySelector('h3').textContent = bird.commonName;
      card.querySelector('.latin').textContent = bird.scientificName;
      const time = card.querySelector('time');
      time.dateTime = bird.detectedAt;
      time.textContent = relative(bird.detectedAt, now);
      time.title = dateFormat.format(new Date(bird.detectedAt)) + ' Pacific time';
      card.querySelector('.bird-bottom span').textContent = `${Math.round(bird.confidence * 100)}% confidence`;
      card.querySelector('.bird-bottom span:last-child').textContent = `${bird.count} recent ${bird.count === 1 ? 'call' : 'calls'}`;
      fragment.append(card);
    });
    byId('bird-list').replaceChildren(fragment);
  }

  async function refresh() {
    if (fetching || document.hidden) return;
    fetching = true;
    try {
      const response = await fetch(`${endpoint}/state`, {cache:'no-store', signal:AbortSignal.timeout(12000)});
      if (!response.ok) throw new Error('Feed unavailable');
      accept(await response.json());
    } catch {
      if (!snapshot) {
        byId('status').textContent = 'The garden connection is resting';
        byId('status-detail').textContent = 'We’ll reconnect automatically. The station’s status is currently unknown.';
      } else render();
    } finally { fetching = false; }
  }

  function connect() {
    stream?.close();
    if (document.hidden) return;
    stream = new EventSource(`${endpoint}/events`);
    stream.addEventListener('snapshot', event => {
      try { accept(JSON.parse(event.data)); } catch { refresh(); }
    });
    stream.onerror = () => { render(); };
    refresh();
  }

  const portrait = byId('portrait');
  const motion = byId('motion');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let wantsMotion = !reduced.matches;
  function updateMotion() {
    const playing = !portrait.paused;
    motion.textContent = playing ? 'Pause motion  Ⅱ' : 'Play motion  ▷';
    motion.setAttribute('aria-label', playing ? 'Pause garden animation' : 'Play garden animation');
  }
  async function play() {
    try { await portrait.play(); } catch { updateMotion(); }
  }
  motion.addEventListener('click', () => {
    wantsMotion = portrait.paused;
    if (wantsMotion) play(); else portrait.pause();
  });
  portrait.addEventListener('play', updateMotion);
  portrait.addEventListener('pause', updateMotion);
  reduced.addEventListener('change', () => {
    if (reduced.matches) { wantsMotion = false; portrait.pause(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stream?.close(); portrait.pause(); }
    else { connect(); if (wantsMotion) play(); }
  });
  if (wantsMotion) play();
  connect();
  setInterval(refresh, 30000);
  setInterval(render, 10000);
})();
