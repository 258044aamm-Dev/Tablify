/**
 * Blank a horizontal band of a PNG in place.
 *
 * SAD-86's Add Field parity board compares the plugin's card to the prototype's card pixel for
 * pixel. COD-76 replaced one row of that card by design — the native Field type `<select>` became
 * the plugin's own picker — so the band that holds it is painted out of both images before the
 * comparison, and the rest of the card keeps its sub-1 % gate.
 *
 * The same RGBA value goes into both images, so the band contributes nothing to the diff.
 */

import type { PNG } from 'pngjs';

const BLANK: readonly [number, number, number, number] = [128, 128, 128, 255];

export function maskRect(img: PNG, width: number, top: number, bottom: number): void {
  const from = Math.max(0, Math.min(img.height, Math.floor(top)));
  const to = Math.max(from, Math.min(img.height, Math.ceil(bottom)));
  for (let y = from; y < to; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * img.width + x) * 4;
      img.data[i] = BLANK[0];
      img.data[i + 1] = BLANK[1];
      img.data[i + 2] = BLANK[2];
      img.data[i + 3] = BLANK[3];
    }
  }
}
