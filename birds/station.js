(() => {
  'use strict';
  const endpoint = 'https://spark-a4b4.tailef40b0.ts.net/birds-live';
  const byId = id => document.getElementById(id);
  let snapshot = null;
  let receivedAt = 0;
  let serverClock = 0;
  let stream = null;
  let fetching = false;

  function accept(data) {
    if (!Array.isArray(data.detections) || !Number.isFinite(Date.parse(data.serverTime))) throw new Error('Invalid feed');
    if (snapshot?.updatedAt && data.updatedAt && Date.parse(data.updatedAt) < Date.parse(snapshot.updatedAt)) return;
    snapshot = data;
    receivedAt = Date.now();
    serverClock = Date.parse(data.serverTime);
    render();
    document.dispatchEvent(new CustomEvent('bird-snapshot', {detail:{revision:data.archiveRevision}}));
  }

  function render() {
    if (!snapshot) return;
    const now = serverClock + (Date.now() - receivedAt);
    const lastUpdate = snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : 0;
    const fresh = lastUpdate > 0 && now - lastUpdate < 90000 && now - Date.parse(snapshot.observedAt) < 90000 && Date.now() - receivedAt < 90000;
    const live = fresh && snapshot.healthy;
    byId('status-dot').classList.toggle('live', live);
    byId('status').textContent = live ? 'Listening' : fresh ? 'Paused' : 'Offline';
    byId('status').title = live ? 'The microphone in Fremont is listening. Records update automatically.' : 'Saved records remain available. The station will reconnect automatically.';
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
        byId('status').textContent = 'Reconnecting';
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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stream?.close();
    else connect();
  });
  connect();
  setInterval(refresh, 30000);
  setInterval(render, 10000);
})();
