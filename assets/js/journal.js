document.addEventListener('DOMContentLoaded', () => {
  const prose = document.querySelector('.post-content');
  const toc = document.querySelector('[data-toc]');
  if (prose && toc) {
    const headings = Array.from(prose.querySelectorAll('h2, h3'));
    if (headings.length > 1) {
      const list = toc.querySelector('[data-toc-list]');
      const links = headings.map((heading, index) => {
        const label = heading.textContent.trim();
        if (!heading.id) {
          let id = `section-${index + 1}`;
          while (document.getElementById(id)) id += '-section';
          heading.id = id;
        }
        const item = document.createElement('li');
        if (heading.tagName === 'H3') item.className = 'toc-subheading';
        const link = document.createElement('a');
        link.href = `#${encodeURIComponent(heading.id)}`;
        link.textContent = label;
        item.append(link);
        list.append(item);
        const anchor = document.createElement('a');
        anchor.className = 'heading-anchor';
        anchor.href = link.getAttribute('href');
        anchor.textContent = '#';
        anchor.setAttribute('aria-label', `Link to ${label}`);
        heading.append(anchor);
        return link;
      });
      toc.hidden = false;
      const disclosure = toc.querySelector('details');
      const mobile = window.matchMedia('(max-width: 760px)');
      const syncDisclosure = () => { disclosure.open = !mobile.matches; };
      syncDisclosure();
      mobile.addEventListener('change', syncDisclosure);
      let scheduled = false;
      const updateActive = () => {
        let active = 0;
        headings.forEach((heading, index) => {
          if (heading.getBoundingClientRect().top <= 140) active = index;
        });
        links.forEach((link, index) => {
          if (index === active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
        scheduled = false;
      };
      window.addEventListener('scroll', () => {
        if (!scheduled) { scheduled = true; requestAnimationFrame(updateActive); }
      }, { passive: true });
      updateActive();
    }
  }
  document.querySelectorAll('.prose table').forEach(table => {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Scrollable table');
    table.before(wrapper);
    wrapper.append(table);
  });
  document.querySelectorAll('.prose img[title]').forEach(img => {
    if (img.closest('figure')) return;
    const parent = img.parentElement;
    if (parent.tagName !== 'P' || parent.childElementCount !== 1 || parent.textContent.trim()) return;
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption');
    caption.textContent = img.title;
    parent.replaceWith(figure);
    figure.append(img, caption);
  });
  if (typeof renderMathInElement === 'function') {
    document.querySelectorAll('.prose, .model-atlas').forEach(element => {
      renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '[%', right: '%]', display: true },
          { left: '\\(', right: '\\)', display: false },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    });
  }
});
