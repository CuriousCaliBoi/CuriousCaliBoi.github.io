document.addEventListener('DOMContentLoaded', () => {
  const photos = Array.from(document.querySelectorAll('[data-photo-viewer]'));
  const dialog = document.querySelector('[data-photo-dialog]');
  if (!dialog || !photos.length) return;
  const full = dialog.querySelector('[data-photo-full]');
  const stage = dialog.querySelector('[data-photo-stage]');
  const status = dialog.querySelector('[data-photo-status]');
  let index = 0;
  let opener;
  let touchStart;
  const show = next => {
    index = (next + photos.length) % photos.length;
    const photo = photos[index];
    const thumbnail = photo.querySelector('img');
    status.textContent = 'Loading photograph…';
    full.src = photo.href;
    full.alt = thumbnail.alt;
    dialog.querySelector('[data-photo-count]').textContent = `${index + 1} / ${photos.length}`;
  };
  full.addEventListener('load', () => { status.textContent = ''; });
  full.addEventListener('error', () => { status.textContent = 'This photograph could not load. Try the next one or reopen it.'; });
  photos.forEach((photo, i) => photo.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener = photo;
    show(i);
    dialog.showModal();
    document.body.classList.add('photo-viewer-open');
  }));
  dialog.querySelector('[data-photo-prev]').addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-photo-next]').addEventListener('click', () => show(index + 1));
  dialog.querySelector('[data-photo-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  stage.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener('touchend', event => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) show(index + (dx < 0 ? 1 : -1));
  }, { passive: true });
  stage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
  dialog.addEventListener('close', () => {
    touchStart = null;
    document.body.classList.remove('photo-viewer-open');
    opener?.focus({ preventScroll: true });
  });
});
