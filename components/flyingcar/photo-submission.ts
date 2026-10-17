import { preparePhoto } from '@/components/generator/prepare-photo';
import { validateFlyingCarPhotoDimensions, type ImageDimensions } from '@/lib/flyingcar-photo';

const unreadablePhoto = 'Could not read this photo. Choose a valid JPEG, PNG or WebP photo and try again.';

async function readPhotoDimensions(file: File): Promise<ImageDimensions> {
  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height };
    } catch {
      // The Image decoder also supports browsers or formats without bitmap decoding.
    } finally {
      bitmap?.close();
    }
  }
  if (typeof Image === 'undefined') throw new Error(unreadablePhoto);
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<ImageDimensions>((resolve, reject) => {
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error(unreadablePhoto));
      image.src = url;
    });
  } finally {
    image.onload = null; image.onerror = null;
    image.src = '';
    URL.revokeObjectURL(url);
  }
}

export async function prepareFlyingCarPhoto(file: File, ensureCurrent: () => void): Promise<File> {
  ensureCurrent();
  const prepared = await preparePhoto(file);
  ensureCurrent();
  // Validate the actual upload: compression may fix a large source or make its short edge too small.
  const { width, height } = await readPhotoDimensions(prepared);
  ensureCurrent();
  if (!validateFlyingCarPhotoDimensions(width, height)) {
    throw new Error(`Your prepared photo is ${width} × ${height} pixels. Choose a photo with both sides between 301 and 5999 pixels and a width-to-height ratio greater than 0.4 and less than 2.5.`);
  }
  return prepared;
}
