/**
 * @vitest-environment jsdom
 *
 * SAD-350 round 2 — the signal that separates "the dialog was dismissed" from "the dialog never
 * opened". A native chooser takes the app's focus, the same signal `pickFileFromDevice()` uses
 * for `<input type="file">` (src/views/grid/attachmentImport.ts). Only the Android policy reads
 * it; desktop and iOS keep today's behaviour.
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { beginExportSave, PICKER_SILENT_ABORT_MS, type ExportSaveRuntime } from '../../src/io/export/destination.js';

const artifactName = 'Budget.csv';
const csv = 'text/csv';

function abortError(): Error {
  const error = new Error('The user aborted a request.');
  error.name = 'AbortError';
  return error;
}

function androidRuntime(showSaveFilePicker: ExportSaveRuntime['showSaveFilePicker']): ExportSaveRuntime {
  return { isMobile: true, mobilePlatform: 'android', showSaveFilePicker };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Android picker presentation (SAD-350 round 2)', () => {
  it('treats an abort with no focus change as "no dialog", so the folder tier can run', async () => {
    const result = await beginExportSave(
      artifactName,
      csv,
      androidRuntime(vi.fn(async () => {
        throw abortError();
      })),
    );
    expect(result).toEqual({ kind: 'unavailable', reason: 'The system save dialog did not open on this device.' });
  });

  it('treats an abort after the app lost focus (a real dialog) as cancellation', async () => {
    const result = await beginExportSave(
      artifactName,
      csv,
      androidRuntime(
        vi.fn(async () => {
          // The native dialog takes the window's focus before the user dismisses it.
          window.dispatchEvent(new Event('blur'));
          throw abortError();
        }),
      ),
    );
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('accepts a hidden document as the same signal', async () => {
    const result = await beginExportSave(
      artifactName,
      csv,
      androidRuntime(
        vi.fn(async () => {
          vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
          document.dispatchEvent(new Event('visibilitychange'));
          throw abortError();
        }),
      ),
    );
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('never infers a silent abort when the dialog does open', async () => {
    const handle = { name: 'Budget.csv', createWritable: vi.fn() };
    const result = await beginExportSave(artifactName, csv, androidRuntime(vi.fn(async () => handle)));
    expect(result).toEqual({ kind: 'handle', handle });
  });

  it('publishes the threshold it uses', () => {
    expect(PICKER_SILENT_ABORT_MS).toBeGreaterThanOrEqual(500);
    expect(PICKER_SILENT_ABORT_MS).toBeLessThanOrEqual(2000);
  });

  it('does not treat a non-abort rejection as presentation information', async () => {
    const result = await beginExportSave(
      artifactName,
      csv,
      androidRuntime(vi.fn(async () => {
        throw new Error('picker is unavailable');
      })),
    );
    expect(result).toEqual({ kind: 'failed', error: 'picker is unavailable' });
  });
});
