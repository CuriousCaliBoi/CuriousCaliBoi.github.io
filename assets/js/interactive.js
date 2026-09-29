document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-interactive-only]').forEach(element => { element.hidden = false; });
  document.querySelectorAll('[data-experiment]').forEach(panel => {
    const stage = panel.querySelector('[data-experiment-stage]');
    const frame = stage.querySelector('iframe');
    const connect = panel.querySelector('[data-experiment-connect]');
    const stop = panel.querySelector('[data-experiment-stop]');
    const fullscreen = panel.querySelector('[data-experiment-fullscreen]');
    const status = panel.querySelector('[data-experiment-status]');
    const notice = panel.querySelector('[data-experiment-notice]');
    let connected = false;
    let reported = false;
    connect.hidden = false;
    connect.addEventListener('click', () => {
      connected = true;
      reported = false;
      notice.hidden = true;
      status.textContent = 'Opening viewer…';
      stage.hidden = false;
      stop.hidden = false;
      fullscreen.hidden = !document.fullscreenEnabled;
      connect.textContent = 'Reconnect';
      frame.src = panel.dataset.experimentSrc;
    });
    stop.addEventListener('click', () => {
      connected = false;
      frame.removeAttribute('src');
      stage.hidden = true;
      stop.hidden = true;
      fullscreen.hidden = true;
      connect.textContent = 'Connect to viewer';
      notice.hidden = true;
      status.textContent = 'Disconnected';
      connect.focus();
    });
    frame.addEventListener('load', () => {
      if (connected && !reported) status.textContent = 'Viewer loaded';
    });
    frame.addEventListener('error', () => {
      if (connected) status.textContent = 'Could not load the viewer. Try reconnecting.';
    });
    window.addEventListener('message', event => {
      if (!connected || event.origin !== location.origin || event.source !== frame.contentWindow) return;
      if (event.data?.type !== 'zuko:experiment-status' || typeof event.data.message !== 'string') return;
      reported = true;
      status.textContent = event.data.message;
      if (['off', 'wait', 'live'].includes(event.data.state)) {
        notice.hidden = event.data.state !== 'off';
        stage.hidden = event.data.state === 'off';
        fullscreen.hidden = stage.hidden || !document.fullscreenEnabled;
      }
    });
    fullscreen.addEventListener('click', async () => {
      try { await stage.requestFullscreen(); }
      catch { status.textContent = 'Use Open viewer for a larger view.'; }
    });
  });

  document.querySelectorAll('[data-color-study]').forEach(study => {
    const selector = study.querySelector('[data-color-photo]');
    const image = study.querySelector('[data-color-image]');
    const surface = study.querySelector('[data-color-surface]');
    const cursor = study.querySelector('[data-color-cursor]');
    const palette = study.querySelector('[data-color-palette]');
    const hint = study.querySelector('[data-color-hint]');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let ready = false;
    let position = { x: 0.5, y: 0.5 };
    const move = (x, y) => {
      position = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
      cursor.style.left = `${position.x * 100}%`;
      cursor.style.top = `${position.y * 100}%`;
    };
    const pick = () => {
      if (!ready) return;
      const x = Math.min(canvas.width - 1, Math.floor(position.x * canvas.width));
      const y = Math.min(canvas.height - 1, Math.floor(position.y * canvas.height));
      const rgb = context.getImageData(x, y, 1, 1).data;
      const hex = '#' + Array.from(rgb).slice(0, 3).map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
      if (palette.children.length === 5) palette.firstElementChild.remove();
      const swatch = document.createElement('li');
      const chip = document.createElement('span');
      chip.className = 'color-chip';
      chip.style.backgroundColor = hex;
      chip.setAttribute('aria-hidden', 'true');
      const label = document.createElement('code');
      label.textContent = hex;
      swatch.append(chip, label);
      palette.append(swatch);
      hint.textContent = `Picked ${hex}. ${palette.children.length} of 5 colors collected.`;
    };
    const load = () => {
      if (!image.naturalWidth) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);
      ready = true;
      move(0.5, 0.5);
      hint.textContent = 'Choose up to five colors from the photograph.';
    };
    image.addEventListener('load', load);
    image.addEventListener('error', () => { ready = false; hint.textContent = 'The photo could not be loaded. Choose another photograph.'; });
    if (image.complete) load();
    selector.addEventListener('change', () => {
      ready = false;
      const option = selector.selectedOptions[0];
      image.alt = option.dataset.alt;
      image.src = option.value;
      study.querySelector('[data-color-credit]').textContent = option.dataset.credit;
      study.querySelector('[data-color-source]').href = option.dataset.source;
      study.querySelector('[data-color-license]').href = option.dataset.license;
      study.querySelector('[data-color-license]').textContent = option.dataset.licenseName;
      hint.textContent = 'Loading photograph…';
    });
    surface.addEventListener('click', event => {
      const bounds = surface.getBoundingClientRect();
      move((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
      pick();
    });
    surface.addEventListener('keydown', event => {
      const steps = { ArrowLeft: [-0.025, 0], ArrowRight: [0.025, 0], ArrowUp: [0, -0.025], ArrowDown: [0, 0.025] };
      if (steps[event.key]) {
        event.preventDefault();
        move(position.x + steps[event.key][0], position.y + steps[event.key][1]);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        pick();
      }
    });
    study.querySelector('[data-color-clear]').addEventListener('click', () => {
      palette.replaceChildren();
      hint.textContent = 'Palette cleared. Pick a color to start again.';
    });
  });
});
