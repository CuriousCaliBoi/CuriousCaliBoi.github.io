document.addEventListener('DOMContentLoaded', () => {
  const photos = Array.from(document.querySelectorAll('[data-photo-viewer]'));
  const dialog = document.querySelector('[data-photo-dialog]');
  if (!dialog) return;
  const full = dialog.querySelector('[data-photo-full]');
  const caption = dialog.querySelector('[data-photo-caption]');
  let index = 0;
  let opener;
  const show = next => {
    index = (next + photos.length) % photos.length;
    const photo = photos[index];
    full.src = photo.href;
    full.alt = photo.querySelector('img').alt;
    caption.replaceChildren(...Array.from(photo.closest('figure').querySelector('figcaption').childNodes).map(node => node.cloneNode(true)));
    dialog.querySelector('[data-photo-count]').textContent = `${index + 1} / ${photos.length}`;
  };
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
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('photo-viewer-open');
    opener?.focus();
  });
});
