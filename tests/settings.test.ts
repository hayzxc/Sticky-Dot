import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  normalizeOrigin,
  sanitizeSettings,
  isOriginAllowed,
  loadSettings,
  saveSettings,
  subscribeSettings,
} from '../src/core/settings';
import { CONFIG } from '../src/core/config';
import type { WidgetSettings } from '../src/core/types';

type SettingsListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void;

describe('Site Settings', () => {
  let mockStorage: Record<string, unknown>;
  let changeListeners: SettingsListener[];
  let removeListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockStorage = {};
    changeListeners = [];
    removeListener = vi.fn();

    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn().mockImplementation((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
          set: vi.fn().mockImplementation((items: Record<string, unknown>) => {
            Object.assign(mockStorage, items);
            return Promise.resolve();
          }),
        } as unknown as chrome.storage.LocalStorageArea,
        onChanged: {
          addListener: vi.fn().mockImplementation((listener: SettingsListener) => {
            changeListeners.push(listener);
          }),
          removeListener,
        } as unknown as chrome.events.Event<SettingsListener>,
      } as unknown as typeof chrome.storage,
    } as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeOrigin', () => {
    it('accepts bare domains and assumes https', () => {
      expect(normalizeOrigin('example.com')).toBe('https://example.com');
      expect(normalizeOrigin('  mail.google.com  ')).toBe('https://mail.google.com');
    });

    it('reduces full URLs to their origin', () => {
      expect(normalizeOrigin('https://example.com/path/to/page?q=1#top')).toBe('https://example.com');
      expect(normalizeOrigin('http://example.com:8080/login')).toBe('http://example.com:8080');
    });

    it('keeps explicit http/https only', () => {
      expect(normalizeOrigin('ftp://example.com')).toBeNull();
      expect(normalizeOrigin('file:///C:/notes.txt')).toBeNull();
      expect(normalizeOrigin('javascript:alert(1)')).toBeNull();
    });

    it('rejects empty input, credentials, and malformed URLs', () => {
      expect(normalizeOrigin('')).toBeNull();
      expect(normalizeOrigin('   ')).toBeNull();
      expect(normalizeOrigin('https://')).toBeNull();
      expect(normalizeOrigin('https://user:pass@example.com')).toBeNull();
      expect(normalizeOrigin('not a url')).toBeNull();
    });

    it('normalizes host casing', () => {
      expect(normalizeOrigin('HTTPS://EXAMPLE.COM/Path')).toBe('https://example.com');
    });
  });

  describe('sanitizeSettings', () => {
    it('returns defaults for invalid input', () => {
      expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
      expect(sanitizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
      expect(sanitizeSettings({ allowedOrigins: 'nope' })).toEqual(DEFAULT_SETTINGS);
    });

    it('normalizes, dedupes, and drops the primary site and invalid entries', () => {
      const result = sanitizeSettings({
        allowedOrigins: [
          'Example.com/path',
          'https://example.com',
          CONFIG.TARGET_ORIGIN,
          'ftp://nope.test',
          '',
          42,
        ],
        allSites: 'yes',
      });

      expect(result).toEqual({
        allowedOrigins: ['https://example.com'],
        allSites: false,
      });
    });

    it('only treats literal true as allSites', () => {
      expect(sanitizeSettings({ allSites: true }).allSites).toBe(true);
      expect(sanitizeSettings({ allSites: 1 }).allSites).toBe(false);
      expect(sanitizeSettings({ allSites: 'true' }).allSites).toBe(false);
    });

    it('caps the number of allowed sites', () => {
      const origins = Array.from(
        { length: CONFIG.MAX_ALLOWED_SITES + 10 },
        (_, index) => `https://site-${index}.example.com`
      );

      const result = sanitizeSettings({ allowedOrigins: origins });
      expect(result.allowedOrigins).toHaveLength(CONFIG.MAX_ALLOWED_SITES);
    });
  });

  describe('isOriginAllowed', () => {
    const settings: WidgetSettings = {
      allowedOrigins: ['https://example.com'],
      allSites: false,
    };

    it('always allows the primary site', () => {
      expect(isOriginAllowed(CONFIG.TARGET_ORIGIN, DEFAULT_SETTINGS)).toBe(true);
    });

    it('allows origins from the allowlist', () => {
      expect(isOriginAllowed('https://example.com', settings)).toBe(true);
      expect(isOriginAllowed('https://sub.example.com', settings)).toBe(false);
    });

    it('rejects unknown origins by default', () => {
      expect(isOriginAllowed('https://other.test', settings)).toBe(false);
    });

    it('allows every origin when allSites is enabled', () => {
      expect(isOriginAllowed('https://other.test', { ...settings, allSites: true })).toBe(true);
    });
  });

  describe('persistence', () => {
    it('returns defaults when chrome.storage is unavailable', async () => {
      delete (globalThis as { chrome?: unknown }).chrome;

      await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
      await expect(saveSettings(DEFAULT_SETTINGS)).resolves.toBe(false);
    });

    it('loads and sanitizes stored settings', async () => {
      mockStorage[CONFIG.SETTINGS_KEY] = {
        allowedOrigins: ['Example.com/path', CONFIG.TARGET_ORIGIN],
        allSites: false,
      };

      await expect(loadSettings()).resolves.toEqual({
        allowedOrigins: ['https://example.com'],
        allSites: false,
      });
    });

    it('saves sanitized settings under the dedicated key', async () => {
      const success = await saveSettings({
        allowedOrigins: ['example.com/path', 'example.com'],
        allSites: true,
      });

      expect(success).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [CONFIG.SETTINGS_KEY]: {
          allowedOrigins: ['https://example.com'],
          allSites: true,
        },
      });
      expect(mockStorage[CONFIG.STORAGE_KEY]).toBeUndefined();
    });

    it('notifies subscribers only for settings changes and supports unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeSettings(listener);

      expect(changeListeners).toHaveLength(1);
      const handler = changeListeners[0];

      handler(
        {
          [CONFIG.SETTINGS_KEY]: {
            oldValue: undefined,
            newValue: { allowedOrigins: ['example.com'], allSites: false },
          },
        },
        'local'
      );
      expect(listener).toHaveBeenCalledWith({
        allowedOrigins: ['https://example.com'],
        allSites: false,
      });

      handler(
        {
          [CONFIG.STORAGE_KEY]: {
            oldValue: undefined,
            newValue: { notes: [], ui: {} },
          },
        },
        'local'
      );
      expect(listener).toHaveBeenCalledTimes(1);

      handler(
        {
          [CONFIG.SETTINGS_KEY]: {
            oldValue: undefined,
            newValue: { allowedOrigins: [], allSites: true },
          },
        },
        'sync'
      );
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      expect(removeListener).toHaveBeenCalledWith(handler);
    });
  });
});
