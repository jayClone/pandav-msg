// Client-side image resize/compress via canvas, run before anything gets
// encrypted or uploaded. Keeps chat images and avatars a manageable size —
// matters a lot for chat images specifically, since the encrypted blob
// travels through the Socket.IO connection (see socket.server.js's
// maxHttpBufferSize) and, for private chats, sits in one MongoDB document.

const readFileAsImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read the selected file as an image'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });

const dataUrlToBytes = (dataUrl) => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Resize `file` so neither dimension exceeds `maxDimension`, re-encode as
 * JPEG at `quality`, and return the raw bytes + a data: URL (handy for an
 * upload preview before anything's encrypted).
 * @param {File} file
 * @param {{maxDimension?: number, quality?: number}} [options]
 * @returns {Promise<{bytes: Uint8Array, mimeType: string, dataUrl: string, width: number, height: number}>}
 */
export async function compressImageFile(file, { maxDimension = 1280, quality = 0.7 } = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Selected file is not an image');
  }

  const img = await readFileAsImage(file);

  let { width, height } = img;
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  // Always re-encode as JPEG: strips EXIF/metadata and gives predictable,
  // tunable compression regardless of the source format (including from
  // formats — PNG screenshots, HEIC-via-browser-decode, etc. — that would
  // otherwise stay large).
  const mimeType = 'image/jpeg';
  const dataUrl = canvas.toDataURL(mimeType, quality);

  return { bytes: dataUrlToBytes(dataUrl), mimeType, dataUrl, width, height };
}
