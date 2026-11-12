import { CONFIG } from '../core/config';
import { StickyDotWidget } from './widget';
import { debounce } from './events';

function init(): void {
  // Defense in depth: Verify target origin
  if (window.location.origin !== CONFIG.TARGET_ORIGIN) {
    return;
  }

  // Prevent double mount
  if (document.getElementById(CONFIG.HOST_ELEMENT_ID)) {
    return;
  }

  const widget = new StickyDotWidget();
  widget.mount();

  // Lightweight MutationObserver to re-attach if website script removes host
  const debouncedRemount = debounce(() => {
    if (!document.getElementById(CONFIG.HOST_ELEMENT_ID)) {
      widget.mount();
    }
  }, 200);

  const observer = new MutationObserver(() => {
    debouncedRemount();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: false,
  });
}

// Execute when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init(), { once: true });
} else {
  init();
}
