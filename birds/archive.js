(() => {
  'use strict';
  const endpoint = 'https://spark-a4b4.tailef40b0.ts.net/birds-live';
  const $ = id => document.getElementById(id);
  const dayFormat = new Intl.DateTimeFormat('en-US', {timeZone:'UTC', weekday:'long', month:'long', day:'numeric', year:'numeric'});
  const titleFormat = new Intl.DateTimeFormat('en-US', {timeZone:'UTC', month:'long', day:'numeric'});
  const shortFormat = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', month:'short', day:'numeric', year:'numeric'});
  const clock = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', hour:'numeric', minute:'2-digit'});
  const preciseClock = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', hour:'numeric', minute:'2-digit', second:'2-digit'});
  const number = value => Number(value).toLocaleString('en-US');
  const recordLabel = count => `${number(count)} ${count === 1 ? 'record' : 'records'}`;
  const dayLabel = day => dayFormat.format(new Date(day + 'T12:00:00Z'));
  const dateLabel = stamp => shortFormat.format(new Date(stamp));
  const timeLabel = stamp => clock.format(new Date(stamp));
  const percent = value => `${Math.round(value * 100)}%`;
  const hourLabel = hour => hour === 0 || hour === 24 ? '12 am' : `${hour % 12 || 12} ${hour < 12 ? 'am' : 'pm'}`;
  const hourRange = hour => `${hourLabel(hour)}–${hourLabel(hour+1)}`;
  const portraits = window.gardenPortraits || {};
  let minimum = .75;
  let summary = null;
  let view = 'collection';
  let selectedDay = null;
  let selectedHour = null;
  let dayData = null;
  let loadedDay = null;
  let pendingDay = null;
  let summaryTicket = 0;
  let dayTicket = 0;
  let detailTicket = 0;
  let recordTicket = 0;
  let recordCursor = null;
  let recordsLoaded = false;
  let recordLoading = false;
  let liveRefresh = null;

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
  function birdButton(bird, className='species-link') {
    const button = node('button', className, bird.commonName);
    button.type = 'button';
    button.addEventListener('click', () => openBird(bird));
    return button;
  }
  function portraitImage(bird, eager=false) {
    const art = portraits[bird.scientificName];
    const image = node('img', 'bird-portrait');
    image.src = art.file;
    image.alt = `Illustration of ${bird.commonName}.`;
    image.width = 512;
    image.height = 512;
    image.loading = eager ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.replaceWith(node('span', 'portrait-pending', 'Portrait to come')), {once:true});
    return image;
  }
  function showPortrait(bird) {
    const art = portraits[bird.scientificName];
    const figure = $('detail-portrait');
    figure.hidden = !art;
    figure.replaceChildren();
    $('detail-number').textContent = art ? `No. ${String(art.number).padStart(3,'0')}` : 'New to the collection';
    $('portrait-description').textContent = art?.description || '';
    $('portrait-links').replaceChildren();
    if (!art) return;
    figure.append(portraitImage(bird,true), node('figcaption', '', art.plumage));
    const guide = node('a', '', 'Identification guide ↗');
    guide.href = art.guide;
    guide.target = '_blank';
    guide.rel = 'noopener noreferrer';
    const download = node('a', '', 'Save portrait ↓');
    download.href = art.file;
    download.download = art.file.split('/').pop();
    $('portrait-links').append(guide, download);
  }
  async function get(path, params={}) {
    const response = await fetch(`${endpoint}${path}?${new URLSearchParams({min:minimum, ...params})}`, {cache:'no-store', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Archive unavailable');
    return response.json();
  }
  function route(scroll=true) {
    const [requested, day] = location.hash.slice(1).split('/');
    if (requested === 'main' || requested === 'about') return;
    view = requested === 'journal' ? 'journal' : 'collection';
    if ($('bird-detail').open) $('bird-detail').close();
    if (view === 'journal' && day && /^\d{4}-\d{2}-\d{2}$/.test(day) && selectedDay !== day) {
      selectedDay = day;
      selectedHour = null;
      dayData = null;
      loadedDay = null;
      pendingDay = null;
    }
    document.title = view === 'journal' ? 'Daily notes · Bird Pokédex' : 'Bird Pokédex · Zuko';
    document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== view; });
    document.querySelectorAll('[data-view]').forEach(link => {
      if (link.dataset.view === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (summary) {
      if (view === 'journal') prepareDay();
      else drawCollection();
    }
    refreshSummary();
    if (scroll) window.scrollTo({top:0, behavior:'instant'});
  }
  async function refreshSummary() {
    const ticket = ++summaryTicket;
    try {
      const data = await get('/archive');
      if (ticket !== summaryTicket) return;
      const changed = !summary || data.revision !== summary.revision || data.minimum !== summary.minimum;
      summary = data;
      $('archive-connection').textContent = '';
      if (view === 'journal') prepareDay();
      else if (changed) drawCollection();
    } catch {
      if (ticket !== summaryTicket) return;
      $('archive-connection').textContent = summary ? 'Showing saved records. Reconnecting…' : 'The collection is temporarily unavailable. We’ll try again automatically.';
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
      $('journal-message').textContent = 'Daily notes will appear when the first bird is heard.';
      $('day-content').hidden = true;
      return;
    }
    const key = `${selectedDay}:${minimum}:${summary.revision}`;
    if (loadedDay !== key && pendingDay !== key) loadDay(key);
  }
  async function loadDay(key) {
    const ticket = ++dayTicket;
    const requested = selectedDay;
    pendingDay = key;
    if (!dayData) {
      $('journal-message').textContent = 'Opening the day’s notes…';
      $('day-content').hidden = true;
    }
    recordTicket++;
    recordsLoaded = false;
    recordLoading = false;
    recordCursor = null;
    $('record-list').replaceChildren();
    $('record-status').textContent = '';
    $('more-records').hidden = true;
    try {
      const day = await get('/archive/day', {date:requested});
      if (ticket !== dayTicket || requested !== selectedDay) return;
      dayData = day;
      loadedDay = key;
      $('journal-message').textContent = '';
      $('journal-title').textContent = titleFormat.format(new Date(day.date + 'T12:00:00Z'));
      $('day-content').hidden = false;
      const first = day.species.slice().sort((a,b) => Date.parse(a.firstHeard)-Date.parse(b.firstHeard))[0];
      const last = day.species.slice().sort((a,b) => Date.parse(b.lastHeard)-Date.parse(a.lastHeard))[0];
      $('day-note').textContent = first ? `${number(day.speciesCount)} species, ${recordLabel(day.count)}. The first was ${first.commonName} at ${timeLabel(first.firstHeard)}; the last was ${last.commonName} at ${timeLabel(last.lastHeard)}.` : 'No birds match the confidence filter for this day.';
      $('day-filter-note').textContent = minimum ? `${number(day.count)} of ${number(day.allCount)} records · 75% or higher` : `All ${number(day.allCount)} records`;
      $('hour-filter').value = selectedHour === null ? '' : String(selectedHour);
      drawHours(day.hours);
      drawTimeline();
      if ($('detection-log').open) loadRecords(true);
    } catch {
      if (ticket !== dayTicket) return;
      $('journal-message').textContent = 'These notes couldn’t load. Choose the date again or wait for the connection to return.';
    } finally {
      if (ticket === dayTicket) pendingDay = null;
    }
  }
  function selectHour(hour) {
    selectedHour = hour;
    $('hour-filter').value = hour === null ? '' : String(hour);
    $('hourly-chart').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.hour) === hour)));
    drawTimeline();
  }
  function drawHours(hours) {
    const maximum = Math.max(1, ...hours);
    const peak = hours.indexOf(Math.max(...hours));
    const bars = hours.map((count, hour) => {
      const button = node('button', 'hour-button');
      button.type = 'button';
      button.dataset.hour = hour;
      button.setAttribute('aria-label', `${hourRange(hour)}: ${recordLabel(count)}`);
      button.setAttribute('aria-pressed', String(selectedHour === hour));
      button.title = button.getAttribute('aria-label');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 20 70');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      const rect = document.createElementNS(svg.namespaceURI, 'rect');
      const height = count ? Math.max(3, count / maximum * 64) : 1;
      for (const [key,value] of Object.entries({x:1, y:68-height, width:18, height, rx:2})) rect.setAttribute(key,value);
      svg.append(rect);
      button.append(svg);
      button.addEventListener('click', () => selectHour(selectedHour === hour ? null : hour));
      return button;
    });
    $('hourly-chart').replaceChildren(...bars);
    $('activity-note').textContent = hours.some(Boolean) ? `Busiest around ${hourLabel(peak)}. Choose an hour to explore.` : 'No records in this view.';
  }
  function drawTimeline() {
    if (!dayData) return;
    const birds = dayData.species.filter(bird => selectedHour === null || bird.hours[selectedHour] > 0);
    birds.sort((a,b) => selectedHour === null ? Date.parse(a.firstHeard)-Date.parse(b.firstHeard) : b.hours[selectedHour]-a.hours[selectedHour] || a.commonName.localeCompare(b.commonName));
    $('timeline-selection').textContent = selectedHour === null ? `${number(birds.length)} species across the day` : `${hourRange(selectedHour)} · ${number(birds.length)} species · ${recordLabel(dayData.hours[selectedHour])}`;
    const fragment = document.createDocumentFragment();
    birds.forEach(bird => {
      const row = node('div', 'timeline-row');
      const button = birdButton(bird, 'timeline-bird');
      button.replaceChildren();
      if (portraits[bird.scientificName]) {
        const image = portraitImage(bird);
        image.alt = '';
        button.append(image);
      } else button.append(node('span', 'timeline-placeholder'));
      const label = node('span', '', bird.commonName);
      if (bird.newSpecies) label.append(node('small', '', 'First day'));
      button.append(label);
      const track = node('div', 'timeline-track');
      track.setAttribute('role', 'img');
      track.setAttribute('aria-label', bird.hours.map((count,hour) => count ? `${hourLabel(hour)}: ${recordLabel(count)}` : '').filter(Boolean).join('; '));
      bird.hours.forEach((count,hour) => {
        const level = count === 0 ? 0 : count === 1 ? 1 : count < 5 ? 2 : count < 10 ? 3 : 4;
        const cell = node('span', `hour-cell level-${level}${selectedHour === hour ? ' selected' : selectedHour !== null ? ' outside-hour' : ''}`);
        cell.setAttribute('aria-hidden', 'true');
        cell.title = `${hourRange(hour)}: ${recordLabel(count)}`;
        track.append(cell);
      });
      row.append(button, track, node('span', 'timeline-count', number(selectedHour === null ? bird.count : bird.hours[selectedHour])));
      fragment.append(row);
    });
    if (!birds.length) fragment.append(node('p', 'message', selectedHour === null ? 'No records for this day.' : 'No records for this hour with the current filter.'));
    $('day-timeline').replaceChildren(fragment);
  }
  async function loadRecords(reset=false) {
    if (recordLoading || !selectedDay) return;
    const ticket = ++recordTicket;
    recordLoading = true;
    $('more-records').disabled = true;
    $('record-status').textContent = 'Loading records…';
    try {
      const data = await get('/archive/records', {date:selectedDay, ...(reset || !recordCursor ? {} : {before:recordCursor})});
      if (ticket !== recordTicket) return;
      if (reset) $('record-list').replaceChildren();
      data.records.forEach(record => {
        const row = node('tr');
        const bird = node('td');
        bird.append(birdButton(record));
        row.append(node('td', '', preciseClock.format(new Date(record.detectedAt))), bird, node('td', record.confidence < .75 ? 'tentative' : '', percent(record.confidence)), node('td', '', record.verified === 'correct' ? 'Confirmed' : record.confidence < .75 ? 'Tentative' : 'Unreviewed'));
        $('record-list').append(row);
      });
      recordCursor = data.next;
      recordsLoaded = true;
      $('more-records').hidden = !recordCursor;
      $('record-status').textContent = `${number($('record-list').children.length)} of ${number(data.total)} records · newest first`;
    } catch {
      if (ticket !== recordTicket) return;
      $('record-status').textContent = 'The record couldn’t load. Try again in a moment.';
      $('more-records').hidden = false;
    } finally {
      if (ticket === recordTicket) { recordLoading = false; $('more-records').disabled = false; }
    }
  }
  function drawCollection() {
    if (!summary) return;
    const search = $('bird-search').value.trim().toLocaleLowerCase();
    const birds = summary.species.filter(bird => `${bird.commonName} ${bird.scientificName}`.toLocaleLowerCase().includes(search));
    const sorts = {recent:(a,b) => Date.parse(b.lastHeard)-Date.parse(a.lastHeard), name:(a,b) => a.commonName.localeCompare(b.commonName), number:(a,b) => (portraits[a.scientificName]?.number ?? Infinity)-(portraits[b.scientificName]?.number ?? Infinity) || Date.parse(a.firstHeard)-Date.parse(b.firstHeard), count:(a,b) => b.count-a.count};
    birds.sort(sorts[$('bird-sort').value]);
    $('collection-note').textContent = search ? `${number(birds.length)} of ${number(summary.shownSpecies)} species` : `${number(summary.shownSpecies)} species collected`;
    $('collection-message').textContent = birds.length ? '' : search ? 'No birds match that name.' : 'The first bird will appear here when it’s heard.';
    const cards = birds.map(bird => {
      const card = birdButton(bird, 'collection-card');
      card.setAttribute('aria-label', `Explore ${bird.commonName}`);
      card.replaceChildren();
      const art = portraits[bird.scientificName];
      const painting = node('span', 'entry-painting');
      painting.append(art ? portraitImage(bird) : node('span', 'portrait-pending', 'Portrait to come'));
      const mark = node('span', 'entry-mark', art ? `NO. ${String(art.number).padStart(3,'0')}` : 'NEW ARRIVAL');
      const meta = node('span', 'entry-meta');
      meta.append(node('span', '', recordLabel(bird.count)), node('span', bird.bestConfidence < .75 ? 'tentative' : '', bird.bestConfidence < .75 ? 'Tentative match' : `${number(bird.daysHeard)} ${bird.daysHeard === 1 ? 'day' : 'days'} heard`));
      card.append(painting, mark, node('span', 'entry-name', bird.commonName), node('span', 'entry-latin', bird.scientificName), meta);
      return card;
    });
    $('collection-grid').replaceChildren(...cards);
  }
  async function openBird(bird) {
    const ticket = ++detailTicket;
    $('detail-name').textContent = bird.commonName;
    $('detail-latin').textContent = bird.scientificName;
    showPortrait(bird);
    $('detail-note').textContent = 'Opening this bird’s records…';
    $('detail-stats').replaceChildren();
    $('species-days').replaceChildren();
    if (!$('bird-detail').open) $('bird-detail').showModal();
    $('bird-detail').scrollTop = 0;
    try {
      const data = await get('/archive/species', {species:bird.scientificName});
      if (ticket !== detailTicket || !$('bird-detail').open) return;
      const entry = data.species;
      if (!entry) { $('detail-note').textContent = 'No records match the confidence filter.'; return; }
      $('detail-note').textContent = `First heard ${dateLabel(entry.firstHeard)} at ${timeLabel(entry.firstHeard)}. Last heard ${dateLabel(entry.lastHeard)} at ${timeLabel(entry.lastHeard)}.${entry.bestConfidence < .75 ? ' Only tentative matches so far.' : ''}`;
      $('detail-stats').replaceChildren(stat(number(entry.count), 'Records'), stat(number(entry.daysHeard), 'Days heard'), stat(percent(entry.bestConfidence), 'Best match'));
      data.days.forEach(day => {
        const link = node('a', 'species-day');
        link.href = `#journal/${day.date}`;
        link.append(node('strong', '', dateLabel(day.firstHeard)), node('span', '', `${recordLabel(day.count)} ↗`));
        link.addEventListener('click', () => { $('bird-detail').close(); if (location.hash === link.hash) route(); });
        $('species-days').append(link);
      });
    } catch {
      if (ticket === detailTicket) $('detail-note').textContent = 'These records couldn’t load. Close and reopen this bird to retry.';
    }
  }
  function changeConfidence(checked) {
    minimum = checked ? 0 : .75;
    $('include-tentative').checked = checked;
    $('day-tentative').checked = checked;
    loadedDay = null;
    pendingDay = null;
    dayData = null;
    dayTicket++;
    recordTicket++;
    $('bird-detail').close();
    refreshSummary();
  }
  function canRefresh() {
    return !document.hidden && !$('bird-detail').open && !(view === 'journal' && $('detection-log').open) && !document.activeElement?.closest('input,select,.collection-card,.hour-button,.timeline-bird');
  }
  for (let hour=0;hour<24;hour++) {
    const option = node('option', '', hourRange(hour));
    option.value = hour;
    $('hour-filter').append(option);
  }
  $('hour-filter').addEventListener('change', () => selectHour($('hour-filter').value === '' ? null : Number($('hour-filter').value)));
  $('journal-day').addEventListener('change', () => {
    const next = `#journal/${$('journal-day').value}`;
    if (location.hash === next) { loadedDay = null; prepareDay(); }
    else location.hash = next;
  });
  $('previous-day').addEventListener('click', () => { const index = summary.days.findIndex(day => day.date === selectedDay); location.hash = `journal/${summary.days[index+1].date}`; });
  $('next-day').addEventListener('click', () => { const index = summary.days.findIndex(day => day.date === selectedDay); location.hash = `journal/${summary.days[index-1].date}`; });
  $('include-tentative').addEventListener('change', () => changeConfidence($('include-tentative').checked));
  $('day-tentative').addEventListener('change', () => changeConfidence($('day-tentative').checked));
  $('bird-search').addEventListener('input', drawCollection);
  $('bird-sort').addEventListener('change', drawCollection);
  $('close-detail').addEventListener('click', () => $('bird-detail').close());
  $('bird-detail').addEventListener('close', () => { detailTicket++; });
  $('more-records').addEventListener('click', () => loadRecords(!recordsLoaded));
  $('detection-log').addEventListener('toggle', () => { if ($('detection-log').open && !recordsLoaded) loadRecords(true); });
  window.addEventListener('hashchange', () => route());
  document.addEventListener('bird-snapshot', event => {
    if (summary && event.detail.revision !== summary.revision && !liveRefresh && canRefresh()) {
      liveRefresh = setTimeout(() => { liveRefresh = null; if (canRefresh()) refreshSummary(); }, 1500);
    }
  });
  setInterval(() => { if (canRefresh()) refreshSummary(); }, 60000);
  route(false);
})();
