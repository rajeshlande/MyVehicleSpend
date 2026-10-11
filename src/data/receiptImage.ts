import { TARGET_BYTES } from '../core/receipts/rules';
import { DataError } from './errors';

const MAX_SIDE = 2000;
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];

/**
 * Compresses a photo in the browser to JPEG at or below TARGET_BYTES (1 MB), so the phone
 * never uploads the full camera file. Runs only in the browser (canvas); not used in unit tests.
 */
export async function compressImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new DataError("Couldn't process this photo. Try another.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let last: Blob | null = null;
  for (const q of QUALITY_STEPS) {
    last = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
    if (!last) break;
    if (last.size <= TARGET_BYTES) return last;
  }
  if (!last) throw new DataError("Couldn't process this photo. Try another.");
  throw new DataError('This photo is still too large after compression. Try a smaller photo.');
}
