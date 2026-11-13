import { CONFIG } from '../core/config';
import { StickyDotWidget } from './widget';
import { debounce } from './events';
import { isOriginAllowed, loadSettings, subscribeSettings } from '../core/settings';
import type { WidgetSettings } from '../core/types';

let widget: StickyDotWidget | null = null;
let initialized = false;
let latestSettings: WidgetSettings | null = null;
let observer: MutationObserver | null = null;
let debouncedRemount: ReturnType<typeof debounce> | null = null;

function mountWidget(): void {
  if (!widget) {
    widget = new StickyDotWidget();
  }

  void widget.mount().catch((error) => {
    console.error('[StickyDot] Gagal memasang widget:', error);
  });
}

function installObserver(): void {
  if (observer) return;

  debouncedRemount = debounce(() => {
    if (!widget) return;
    if (!document.getElementById(CONFIG.HOST_ELEMENT_ID)) {
      void widget.mount();
    }
  }, 200);

  const targetParent = document.documentElement;
  observer = new MutationObserver(() => {
    debouncedRemount?.();
  });

  observer.observe(targetParent, {
    childList: true,
    subtree: false,
  });
}

function uninstallObserver(): void {
  observer?.disconnect();
  observer = null;
  debouncedRemount?.cancel();
  debouncedRemount = null;
}

function syncWidget(settings: WidgetSettings): void {
  const allowed = isOriginAllowed(window.location.origin, settings);

  if (allowed) {
    if (!document.getElementById(CONFIG.HOST_ELEMENT_ID)) {
      mountWidget();
    }
    installObserver();
    return;
  }

  if (widget) {
    widget.unmount();
    widget = null;
  }
  uninstallObserver();
}

async function init(): Promise<void> {
  if (initialized) return;
  initialized = true;

  subscribeSettings((nextSettings) => {
    latestSettings = nextSettings;
    syncWidget(nextSettings);
  });

  const settings = await loadSettings();
  syncWidget(latestSettings ?? settings);
}

// Execute when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  }, { once: true });
} else {
  void init();
}