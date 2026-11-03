(() => {
  'use strict';

  // Never resume an agent conversation if this origin was used by an older build.
  try {
    localStorage.removeItem('explorer.agent');
    localStorage.removeItem('explorer.agentKind');
  } catch (_error) {
    // Storage can be unavailable in hardened browsers; the gateway still blocks the API.
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(
      '#tabs button[data-tab="claude"], #a-agent, #a-past, #a-new, #tab-claude'
    ).forEach((element) => {
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    });

    const name = document.querySelector('#f-name');
    if (name) {
      name.readOnly = true;
      name.setAttribute('aria-readonly', 'true');
      name.title = 'Neuron naming is available only on the Spark itself.';
    }

    const focusTab = document.querySelector('#focus-tab');
    const list = document.querySelector('#list');
    if (focusTab && list) {
      const syncFocusHandle = () => {
        // The handle remains useful for a collapsed neuron panel, but never opens
        // the hidden agent panel when no neuron is selected.
        focusTab.hidden = !list.classList.contains('has-focus');
      };
      focusTab.addEventListener('click', (event) => {
        if (!list.classList.contains('has-focus')) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
      new MutationObserver(syncFocusHandle).observe(list, {
        attributes: true,
        attributeFilter: ['class']
      });
      syncFocusHandle();
    }

  }, { once: true });
})();
