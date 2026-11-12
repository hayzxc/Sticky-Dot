import { CONFIG } from '../core/config';
import { StickyDotWidget } from './widget';
import { debounce } from './events';

function init(): void {
  // Defense in depth: Verify target origin
  if (window.location.origin !== CONFIG.TARGET_ORIGIN) {
    console.warn(
      `[StickyDot] Content script aktif tetapi diabaikan karena origin tidak cocok: ${window.location.origin} (Target: ${CONFIG.TARGET_ORIGIN})`
    );
    return;
  }

  // Prevent double mount
  if (document.getElementById(CONFIG.HOST_ELEMENT_ID)) {
    return;
  }

  const widget = new StickyDotWidget();
  widget.mount();
  console.log('[StickyDot] Widget berhasil dimuat di pojok kanan atas.');

  // Lightweight MutationObserver to re-attach if website script removes host
  const debouncedRemount = debounce(() => {
    if (!document.getElementById(CONFIG.HOST_ELEMENT_ID)) {
      widget.mount();
      console.log('[StickyDot] Widget dipasang kembali setelah dihapus oleh halaman.');
    }
  }, 200);

  const targetParent = document.body || document.documentElement;
  const observer = new MutationObserver(() => {
    debouncedRemount();
  });

  observer.observe(targetParent, {
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

