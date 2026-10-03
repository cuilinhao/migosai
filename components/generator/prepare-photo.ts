const MAX_EDGE = 2048;
const MIN_BYTES = 1024 * 1024;
const EXTENSIONS: Record<string, RegExp> = {
  "image/jpeg": /\.jpe?g$/i,
  "image/png": /\.png$/i,
  "image/webp": /\.webp$/i,
};

function outputName(file: File): string {
  if (EXTENSIONS[file.type].test(file.name)) return file.name;
  const stem = file.name.replace(/\.[^.]+$/, "");
  return `${stem}.${file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1]}`;
}

export async function preparePhoto(file: File): Promise<File> {
  if (file.size <= MIN_BYTES || !EXTENSIONS[file.type] ||
      typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const width = bitmap.width, height = bitmap.height;
    if (!width || !height) return file;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context || typeof canvas.toBlob !== "function") return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, file.type, file.type === "image/jpeg" ? 0.9 : undefined));
    if (!blob || blob.type !== file.type || blob.size >= file.size) return file;
    return new File([blob], outputName(file), { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
