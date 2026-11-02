(() => {
  'use strict';
  const endpoint = 'https://spark-a4b4.tailef40b0.ts.net/birds-live';
  const $ = id => document.getElementById(id);
  const dayFormat = new Intl.DateTimeFormat('en-US', {timeZone:'UTC', weekday:'long', month:'long', day:'numeric', year:'numeric'});
  const shortFormat = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', month:'short', day:'numeric', year:'numeric'});
  const clock = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', hour:'numeric', minute:'2-digit'});
  const preciseClock = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', hour:'numeric', minute:'2-digit', second:'2-digit'});
  const number = value => Number(value).toLocaleString('en-US');
  const dayLabel = day => dayFormat.format(new Date(day + 'T12:00:00Z'));
  const dateLabel = stamp => shortFormat.format(new Date(stamp));
  const timeLabel = stamp => clock.format(new Date(stamp));
  const percent = value => `${Math.round(value * 100)}%`;
  const portraits = window.gardenPortraits || {};
  let minimum = .75;
  let summary = null;
  let view = 'live';
  let selectedDay = null;
  let loadedDay = null;
  let summaryTicket = 0;
  let dayTicket = 0;
  let detailTicket = 0;
  let recordTicket = 0;
  let recordCursor = null;
  let recordsLoaded = false;
  let recordLoading = false;
  let liveRefresh = null;
  let routePendingScroll = /^#(journal|collection)/.test(location.hash);

  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function stat(value, label) {
    const item = node('div');
    item.append(node('strong', '', value), node('span', '', label));
    return item;
  }
  function birdButton(bird) {
    const button = node('button', 'species-link', bird.commonName);
    button.addEventListener('click', () => openBird(bird));
    return button;
  }

  function portraitImage(bird, eager=false) {
    const art = portraits[bird.scientificName];
    const image = node('img', 'bird-watercolor');
    image.src = art.file;
    image.alt = `AI watercolor of ${bird.commonName}. ${art.plumage}.`;
    image.width = 512;
    image.height = 512;
    image.loading = eager ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.replaceWith(node('span', 'portrait-pending', 'Portrait unavailable')), {once:true});
    return image;
  }

  function showPortrait(bird) {
    const art = portraits[bird.scientificName];
    const figure = $('detail-portrait');
    figure.hidden = !art;
    figure.replaceChildren();
    $('portrait-description').textContent = art?.description || 'A new voice in the garden. Its watercolor is still to come.';
    $('portrait-links').replaceChildren();
    if (!art) return;
    figure.append(portraitImage(bird,true), node('figcaption', '', `AI interpretation · ${art.plumage}`));
    const guide = node('a', '', 'Meet the bird at Cornell ↗');
    guide.href = art.guide;
    guide.target = '_blank';
    guide.rel = 'noopener noreferrer';
    const download = node('a', '', 'Keep this watercolor ↓');
    download.href = art.file;
    download.download = art.file.split('/').pop();
    $('portrait-links').append(guide, download);
  }
  async function get(path, params={}) {
    const response = await fetch(`${endpoint}${path}?${new URLSearchParams({min:minimum, ...params})}`, {cache:'no-store', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Archive unavailable');
    return response.json();
  }
  function finishRouteScroll() {
    if (!routePendingScroll) return;
    routePendingScroll = false;
    requestAnimationFrame(() => $('garden-views').scrollIntoView({block:'start'}));
  }

  function route(scroll=true) {
    const [requested, day] = location.hash.slice(1).split('/');
    if (!['live', 'journal', 'collection', 'visitors', ''].includes(requested)) return;
    view = ['journal', 'collection'].includes(requested) ? requested : 'live';
    if (scroll) routePendingScroll = view !== 'live';
    document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== view; });
    document.querySelectorAll('[data-view]').forEach(link => {
      if (link.dataset.view === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    $('archive-filter').hidden = view === 'live';
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) selectedDay = day;
    if (summary) {
      if (view === 'journal') prepareDay();
      if (view === 'collection') drawCollection();
    }
    if (view !== 'live') refreshSummary();
    if (scroll && location.hash) $('garden-views').scrollIntoView({block:'start'});
  }

  async function refreshSummary() {
    const ticket = ++summaryTicket;
    try {
      const data = await get('/archive');
      if (ticket !== summaryTicket) return;
      summary = data;
      $('day-count').textContent = `${number(data.days.length)} ${data.days.length === 1 ? 'day' : 'days'}`;
      $('species-count').textContent = `${number(data.shownSpecies)} birds`;
      $('archive-coverage').textContent = `${number(data.totalDetections)} saved bird detections · ${number(data.days.length)} recorded ${data.days.length === 1 ? 'day' : 'days'}${data.lastFullSyncAt ? '' : ' · importing earlier visits'}`;
      if (view === 'journal') prepareDay();
      if (view === 'collection') drawCollection();
    } catch {
      if (ticket !== summaryTicket) return;
      $('archive-coverage').textContent = summary ? 'Showing saved notes. Reconnecting to the archive…' : 'The notebook is temporarily unavailable. We’ll try again automatically.';
    }
  }

  function prepareDay() {
    if (!selectedDay) selectedDay = summary.days[0]?.date;
    const options = summary.days.map(day => {
      const option = node('option', '', dayLabel(day.date));
      option.value = day.date;
      return option;
    });
    if (selectedDay && !summary.days.some(day => day.date === selectedDay)) {
      const option = node('option', '', dayLabel(selectedDay));
      option.value = selectedDay;
      options.push(option);
    }
    $('journal-day').replaceChildren(...options);
    $('journal-day').value = selectedDay || '';
    $('journal-day').disabled = !options.length;
    const index = summary.days.findIndex(day => day.date === selectedDay);
    $('previous-day').disabled = index < 0 || index >= summary.days.length - 1;
    $('next-day').disabled = index <= 0;
    const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Los_Angeles', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
    const yesterday = new Date(today + 'T12:00:00Z');
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    $('yesterday-link').href = '#journal/' + yesterday.toISOString().slice(0,10);
    if (!selectedDay) {
      $('journal-message').textContent = 'The first pages are still arriving from the station.';
      $('day-content').hidden = true;
      return;
    }
    if (loadedDay !== `${selectedDay}:${minimum}:${summary.revision}`) loadDay();
    else if (view === 'journal') finishRouteScroll();
  }

  async function loadDay() {
    const ticket = ++dayTicket;
    const requested = selectedDay;
    const key = `${requested}:${minimum}:${summary.revision}`;
    $('journal-message').textContent = 'Opening this day’s notes…';
    $('day-content').hidden = true;
    recordTicket++;
    recordsLoaded = false;
    recordLoading = false;
    recordCursor = null;
    $('record-list').replaceChildren();
    $('record-status').textContent = '';
    $('more-records').hidden = true;
    try {
      const day = await get('/archive/day', {date:requested});
      if (ticket !== dayTicket) return;
      loadedDay = key;
      $('journal-message').textContent = '';
      $('journal-title').textContent = dayLabel(day.date);
      $('day-content').hidden = false;
      const birds = day.species.slice().sort((a,b) => b.count - a.count || a.commonName.localeCompare(b.commonName));
      const first = day.species.slice().sort((a,b) => Date.parse(a.firstHeard) - Date.parse(b.firstHeard))[0];
      const last = day.species.slice().sort((a,b) => Date.parse(b.lastHeard) - Date.parse(a.lastHeard))[0];
      const newBirds = birds.filter(bird => bird.newSpecies).length;
      $('day-note').textContent = first ? `${first.commonName} was the first match at ${timeLabel(first.firstHeard)}. Of ${number(day.allCount)} saved detections, ${number(day.count)} ${minimum ? 'meet the 75% confidence filter' : 'are included here'}, spanning ${number(day.speciesCount)} species${newBirds ? ` and ${number(newBirds)} ${newBirds === 1 ? 'new entry' : 'new entries'} in the notebook` : ''}.` : 'No identifications match this confidence filter for the selected day.';
      $('day-stats').replaceChildren(stat(number(day.speciesCount), 'Species heard'), stat(number(day.count), 'Saved detections'), stat(first ? timeLabel(first.firstHeard) : '—', 'First call'), stat(last ? timeLabel(last.lastHeard) : '—', 'Last call'));
      $('day-filter-note').textContent = minimum ? `${number(day.count)} of ${number(day.allCount)} detections · 75% or higher` : `All ${number(day.allCount)} detections · tentative matches included`;
      drawHours(day.hours);
      const body = document.createDocumentFragment();
      birds.forEach(bird => {
        const row = node('tr');
        const cell = node('td');
        cell.append(birdButton(bird));
        if (bird.newSpecies) cell.append(node('span', 'first-day', 'First day'));
        cell.append(node('span', 'species-latin', bird.scientificName));
        row.append(cell, node('td', '', number(bird.count)), node('td', '', timeLabel(bird.firstHeard)), node('td', '', timeLabel(bird.lastHeard)), node('td', bird.bestConfidence < .75 ? 'tentative' : '', percent(bird.bestConfidence)));
        body.append(row);
      });
      $('day-birds').replaceChildren(body);
      if ($('detection-log').open) loadRecords(true);
      if (view === 'journal') finishRouteScroll();
    } catch {
      if (ticket !== dayTicket) return;
      $('journal-message').textContent = 'This page of the notebook couldn’t load. Choose the date again or wait for the connection to return.';
    }
  }

  function drawHours(hours) {
    const maximum = Math.max(1, ...hours);
    const peak = hours.indexOf(Math.max(...hours));
    const hourText = hour => hour === 0 ? 'midnight' : hour === 12 ? 'noon' : `${hour % 12} ${hour < 12 ? 'am' : 'pm'}`;
    const svg = $('hourly-chart');
    svg.replaceChildren();
    hours.forEach((count, hour) => {
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const height = count ? Math.max(2, count / maximum * 96) : 1;
      for (const [key,value] of Object.entries({x:hour*30+3, y:100-height, width:21, height, rx:2})) bar.setAttribute(key, value);
      if (count && count === maximum) bar.setAttribute('class', 'peak');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${hourText(hour)}: ${number(count)} detections`;
      bar.append(title);
      svg.append(bar);
    });
    const note = hours.some(Boolean) ? `Busiest hour: ${hourText(peak)} · ${number(hours[peak])} detections` : 'No detections in this view';
    $('activity-note').textContent = note;
    svg.setAttribute('aria-label', `Detections by Pacific clock hour. ${note}. Hourly counts: ${hours.map((count,hour) => `${hourText(hour)} ${count}`).join(', ')}`);
  }

  async function loadRecords(reset=false) {
    if (recordLoading || !selectedDay) return;
    const ticket = ++recordTicket;
    recordLoading = true;
    $('more-records').disabled = true;
    $('record-status').textContent = 'Loading detections…';
    try {
      const data = await get('/archive/records', {date:selectedDay, ...(reset || !recordCursor ? {} : {before:recordCursor})});
      if (ticket !== recordTicket) return;
      if (reset) $('record-list').replaceChildren();
      data.records.forEach(record => {
        const row = node('tr');
        const bird = node('td');
        bird.append(birdButton(record));
        row.append(node('td', '', preciseClock.format(new Date(record.detectedAt))), bird, node('td', record.confidence < .75 ? 'tentative' : '', percent(record.confidence)), node('td', '', record.verified === 'correct' ? 'Confirmed in BirdNET' : record.confidence < .75 ? 'Tentative' : 'Unreviewed'));
        $('record-list').append(row);
      });
      recordCursor = data.next;
      recordsLoaded = true;
      $('more-records').hidden = !recordCursor;
      $('record-status').textContent = `${number($('record-list').children.length)} of ${number(data.total)} detections shown · newest first`;
    } catch {
      if (ticket !== recordTicket) return;
      $('record-status').textContent = 'The log couldn’t load. Try again in a moment.';
      $('more-records').hidden = false;
    } finally {
      if (ticket === recordTicket) { recordLoading = false; $('more-records').disabled = false; }
    }
  }

  function drawCollection() {
    if (!summary) return;
    const search = $('bird-search').value.trim().toLocaleLowerCase();
    const birds = summary.species.filter(bird => `${bird.commonName} ${bird.scientificName}`.toLocaleLowerCase().includes(search));
    const sorts = {recent:(a,b) => Date.parse(b.lastHeard)-Date.parse(a.lastHeard), name:(a,b) => a.commonName.localeCompare(b.commonName), first:(a,b) => Date.parse(a.firstHeard)-Date.parse(b.firstHeard), count:(a,b) => b.count-a.count};
    birds.sort(sorts[$('bird-sort').value]);
    $('collection-note').textContent = `${number(birds.length)} of ${number(summary.shownSpecies)} species · ${number(summary.shownDetections)} ${minimum ? 'detections at 75% or higher' : 'detections, including tentative matches'}`;
    $('collection-message').textContent = birds.length ? '' : search ? 'No birds match that name. Try a common or scientific name.' : 'This collection will grow as the station identifies birds.';
    const cards = document.createDocumentFragment();
    birds.forEach(bird => {
      const card = node('button', 'collection-card');
      card.type = 'button';
      card.setAttribute('aria-label', `Explore ${bird.commonName}`);
      const art = portraits[bird.scientificName];
      const painting = node('span', 'entry-painting');
      painting.append(art ? portraitImage(bird) : node('span', 'portrait-pending', 'A new voice. A portrait to come.'));
      const mark = node('span', 'entry-mark');
      mark.append(node('span', '', art ? `NO. ${String(art.number).padStart(3,'0')}` : 'NEW ARRIVAL'), node('span', '', art ? 'AI watercolor' : 'Portrait to come'));
      const meta = node('span', 'entry-meta');
      const count = node('span');
      count.append(node('strong', '', number(bird.count)), document.createTextNode(bird.count === 1 ? 'detection' : 'detections'));
      const days = node('span');
      days.append(node('strong', '', number(bird.daysHeard)), document.createTextNode(bird.daysHeard === 1 ? 'day heard' : 'days heard'));
      meta.append(count, days);
      const first = node('span', 'entry-first');
      first.append(node('span', '', `First heard ${dateLabel(bird.firstHeard)}`), node('span', bird.bestConfidence < .75 ? 'tentative' : '', bird.bestConfidence < .75 ? 'Tentative ↗' : 'Explore ↗'));
      card.append(painting, mark, node('span', 'entry-name', bird.commonName), node('span', 'entry-latin', bird.scientificName), meta, first);
      card.addEventListener('click', () => openBird(bird));
      cards.append(card);
    });
    $('collection-grid').replaceChildren(cards);
    if (view === 'collection') finishRouteScroll();
  }

  async function openBird(bird) {
    const ticket = ++detailTicket;
    $('detail-name').textContent = bird.commonName;
    $('detail-latin').textContent = bird.scientificName;
    showPortrait(bird);
    $('detail-note').textContent = 'Opening this bird’s field notes…';
    $('detail-stats').replaceChildren();
    $('species-days').replaceChildren();
    if (!$('bird-detail').open) $('bird-detail').showModal();
    $('bird-detail').scrollTop = 0;
    try {
      const data = await get('/archive/species', {species:bird.scientificName});
      if (ticket !== detailTicket || !$('bird-detail').open) return;
      const entry = data.species;
      if (!entry) { $('detail-note').textContent = 'No records match the current confidence filter.'; return; }
      $('detail-note').textContent = `First heard ${dateLabel(entry.firstHeard)} at ${timeLabel(entry.firstHeard)}. Most recently heard ${dateLabel(entry.lastHeard)} at ${timeLabel(entry.lastHeard)}.${entry.bestConfidence < .75 ? ' This species has only tentative matches so far.' : ''}`;
      $('detail-stats').replaceChildren(stat(number(entry.count), 'Saved detections'), stat(number(entry.daysHeard), 'Days in the garden'), stat(percent(entry.bestConfidence), 'Highest confidence'), stat(number(entry.confirmedCount), 'Confirmed in BirdNET'));
      data.days.forEach(day => {
        const link = node('a', 'species-day');
        link.href = `#journal/${day.date}`;
        link.append(node('strong', '', dateLabel(day.firstHeard)), node('span', '', `${number(day.count)} ${day.count === 1 ? 'detection' : 'detections'} · ${percent(day.bestConfidence)} best match ↗`));
        link.addEventListener('click', () => { $('bird-detail').close(); if (location.hash === link.hash) route(); });
        $('species-days').append(link);
      });
    } catch {
      if (ticket === detailTicket) $('detail-note').textContent = 'These notes couldn’t load. Close this card and open it again to retry.';
    }
  }

  $('journal-day').addEventListener('change', () => { location.hash = `journal/${$('journal-day').value}`; });
  $('previous-day').addEventListener('click', () => { const index = summary.days.findIndex(day => day.date === selectedDay); location.hash = `journal/${summary.days[index+1].date}`; });
  $('next-day').addEventListener('click', () => { const index = summary.days.findIndex(day => day.date === selectedDay); location.hash = `journal/${summary.days[index-1].date}`; });
  $('include-tentative').addEventListener('change', () => {
    minimum = $('include-tentative').checked ? 0 : .75;
    loadedDay = null;
    dayTicket++;
    recordTicket++;
    $('bird-detail').close();
    $('archive-coverage').textContent = 'Updating the confidence filter…';
    refreshSummary();
  });
  $('bird-search').addEventListener('input', drawCollection);
  $('bird-sort').addEventListener('change', drawCollection);
  $('close-detail').addEventListener('click', () => $('bird-detail').close());
  $('bird-detail').addEventListener('close', () => { detailTicket++; });
  $('more-records').addEventListener('click', () => loadRecords(!recordsLoaded));
  $('detection-log').addEventListener('toggle', () => { if ($('detection-log').open && !recordsLoaded) loadRecords(true); });
  window.addEventListener('hashchange', () => route());
  document.addEventListener('bird-snapshot', event => {
    if (view !== 'live' && summary && event.detail.revision !== summary.revision && !liveRefresh && (view !== 'journal' || !$('detection-log').open) && !$('bird-detail').open) {
      liveRefresh = setTimeout(() => { liveRefresh = null; refreshSummary(); }, 1500);
    }
  });
  setInterval(() => { if (!document.hidden && (view !== 'journal' || !$('detection-log').open) && !$('bird-detail').open) refreshSummary(); }, 60000);
  route(false);
  refreshSummary();
  if (location.hash.startsWith('#journal') || location.hash.startsWith('#collection')) $('garden-views').scrollIntoView({block:'start'});
})();
