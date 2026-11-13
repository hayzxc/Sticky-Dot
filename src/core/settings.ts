import { CONFIG } from './config';
import type { WidgetSettings, SettingsListener } from './types';

export const DEFAULT_SETTINGS: WidgetSettings = {
  allowedOrigins: [],
  allSites: false,
};

const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

/**
 * Menormalkan input URL/domain menjadi origin (mis. "contoh.com/x" -> "https://contoh.com").
 * Hanya http/https yang diterima.
 */
export function normalizeOrigin(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidate = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Validasi settings dari storage: origin unik, bukan situs utama, dibatasi MAX_ALLOWED_SITES.
 */
export function sanitizeSettings(raw: unknown): WidgetSettings {
  if (!raw || typeof raw !== 'object') {
    return { allowedOrigins: [], allSites: false };
  }

  const obj = raw as Record<string, unknown>;
  const rawList = Array.isArray(obj.allowedOrigins) ? obj.allowedOrigins : [];
  const allowedOrigins: string[] = [];

  for (const item of rawList) {
    if (typeof item !== 'string') continue;
    const origin = normalizeOrigin(item);
    if (!origin || origin === CONFIG.TARGET_ORIGIN || allowedOrigins.includes(origin)) {
      continue;
    }
    allowedOrigins.push(origin);
    if (allowedOrigins.length >= CONFIG.MAX_ALLOWED_SITES) break;
  }

  return {
    allowedOrigins,
    allSites: obj.allSites === true,
  };
}

/**
 * Situs utama selalu diizinkan; sisanya mengikuti allowlist / mode semua website.
 */
export function isOriginAllowed(origin: string, settings: WidgetSettings): boolean {
  return (
    settings.allSites ||
    origin === CONFIG.TARGET_ORIGIN ||
    settings.allowedOrigins.includes(origin)
  );
}

export async function loadSettings(): Promise<WidgetSettings> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return { ...DEFAULT_SETTINGS, allowedOrigins: [] };
  }

  try {
    const result = await chrome.storage.local.get(CONFIG.SETTINGS_KEY);
    return sanitizeSettings(result[CONFIG.SETTINGS_KEY]);
  } catch (error) {
    console.error('[StickyDot] Error loading settings:', error);
    return { ...DEFAULT_SETTINGS, allowedOrigins: [] };
  }
}

export async function saveSettings(settings: WidgetSettings): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return false;
  }

  try {
    await chrome.storage.local.set({
      [CONFIG.SETTINGS_KEY]: sanitizeSettings(settings),
    });
    return true;
  } catch (error) {
    console.error('[StickyDot] Error saving settings:', error);
    return false;
  }
}

export function subscribeSettings(listener: SettingsListener): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return () => {};
  }

  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local' && changes[CONFIG.SETTINGS_KEY]) {
      listener(sanitizeSettings(changes[CONFIG.SETTINGS_KEY].newValue));
    }
  };

  chrome.storage.onChanged.addListener(handler);

  return () => {
    chrome.storage.onChanged.removeListener(handler);
  };
}
