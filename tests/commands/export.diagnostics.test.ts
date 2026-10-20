/**
 * @vitest-environment jsdom
 *
 * SAD-350 §3.0: the read-only device probe. Each test simulates one platform's capability
 * surface and checks that the report names the capabilities and the delivery method the
 * export flow would actually take there.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { Platform } from 'obsidian';
import { exportDiagnosticsReport } from '../../src/commands/export.js';

beforeEach(() => {
  Reflect.deleteProperty(window, 'showSaveFilePicker');
});

afterEach(() => {
  Platform.isMobile = false;
  Platform.isIosApp = false;
  Platform.isAndroidApp = false;
  Reflect.deleteProperty(window, 'showSaveFilePicker');
  Reflect.deleteProperty(window, 'Capacitor');
  Reflect.deleteProperty(window.navigator, 'canShare');
  Reflect.deleteProperty(window.navigator, 'share');
});

describe('export destination diagnostics (SAD-350)', () => {
  it('desktop with a save picker reports the picker method', () => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: vi.fn(), configurable: true });
    const report = exportDiagnosticsReport();
    expect(report).toContain('platform: desktop');
    expect(report).toContain('showSaveFilePicker: function');
    expect(report).toContain('chosen delivery method: picker');
  });

  it('an iOS-like surface reports file sharing and the share method', () => {
    Platform.isMobile = true;
    Platform.isIosApp = true;
    Object.defineProperty(window.navigator, 'canShare', {
      value: (data: { files?: File[] }) => Array.isArray(data.files) && data.files.length > 0,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'share', { value: vi.fn(), configurable: true });

    const report = exportDiagnosticsReport();
    expect(report).toContain('platform: ios');
    expect(report).toContain('canShare({files}): true');
    expect(report).toContain('chosen delivery method: share');
  });

  it('an Android-like surface reports the Capacitor bridge and the folder fallback', () => {
    Platform.isMobile = true;
    Platform.isAndroidApp = true;
    Object.defineProperty(window, 'Capacitor', {
      value: {
        getPlatform: () => 'android',
        Plugins: { Filesystem: { writeFile: vi.fn(), stat: vi.fn() }, App: {} },
      },
      configurable: true,
    });

    const report = exportDiagnosticsReport();
    expect(report).toContain('platform: android');
    expect(report).toContain('navigator.share: undefined');
    expect(report).toContain('window.Capacitor: present (android)');
    expect(report).toContain('Capacitor plugins: App, Filesystem');
    expect(report).toContain('Filesystem.writeFile: function / Filesystem.stat: function');
    expect(report).toContain('chosen delivery method: folder');
  });

  it('a bare mobile WebView reports that no delivery method exists', () => {
    Platform.isMobile = true;
    const report = exportDiagnosticsReport();
    expect(report).toContain('window.Capacitor: absent');
    expect(report).toContain('chosen delivery method: none');
  });
});
