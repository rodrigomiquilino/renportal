const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function assertImage(file: File, maxBytes: number): void {
  if (!ALLOWED.has(file.type)) {
    throw new Error('Use uma imagem PNG, JPG ou WebP.');
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`A imagem passa de ${mb} MB.`);
  }
}

/** Reduz a imagem no canvas. O arquivo enviado já sai no tamanho certo. */
export async function fitImage(file: File, maxEdge: number, maxBytes: number): Promise<Blob> {
  assertImage(file, maxBytes);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Não foi possível preparar a imagem.');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = await blobOf(canvas, 'image/webp', 0.86);
  if (webp) return webp;
  const jpeg = await blobOf(canvas, 'image/jpeg', 0.88);
  if (!jpeg) throw new Error('Não foi possível preparar a imagem.');
  return jpeg;
}

function blobOf(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
