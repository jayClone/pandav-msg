import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { encodeBase64 } from 'tweetnacl-util';

// @ffmpeg/util's own toBlobURL does `fetch(url).then(r => r.arrayBuffer())`
// with no check on `response.ok` — fetch() only rejects on a network
// failure, not an HTTP error status, so a 401/404/500 for either core file
// would silently turn into a blob URL containing an error page's bytes,
// which ffmpeg.load() then hangs trying to parse as JS/WASM instead of
// failing clearly. This wraps the same fetch with an explicit status check.
async function fetchAsBlobURL(url, mimeType) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (HTTP ${response.status})`);
  }
  const buf = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buf], { type: mimeType }));
}

// Client-side video transcode/compress via ffmpeg.wasm, run before anything
// gets encrypted or sent — same reasoning as imageCompression.js, but video
// needs real re-encoding (not just a canvas resize) to land anywhere near a
// size that fits an encrypted message: MongoDB caps a document at 16MB, and
// the encrypted+base64'd blob has to fit inside that (see Message.js).
//
// The ~32MB ffmpeg-core WASM binary is self-hosted from public/ffmpeg
// (copied from @ffmpeg/core's dist/esm — the worker is a module Worker and
// loads the core via `import()`, which needs the ESM build's `export
// default`; the UMD build has no such export and fails with "failed to
// import ffmpeg-core.js") rather than loaded from a CDN, so it works under
// the app's strict same-origin CSP (script-src 'self') without having to
// trust a third-party host.
//
// This runs single-threaded in the browser (no SharedArrayBuffer/COOP-COEP
// requirement), which is meaningfully slower than native ffmpeg — a real
// 10-30s clip can take anywhere from several seconds to a couple minutes
// depending on the device. `onStatus` exists so callers can show real
// progress instead of a plain spinner that looks frozen.

const MAX_DURATION_SEC = 30;
const MAX_INPUT_BYTES = 200 * 1024 * 1024; // a huge input would just hang the tab at this encoding speed
const TARGET_MAX_BYTES = 6 * 1024 * 1024; // leaves headroom under Mongo's 16MB document cap after base64 (~4/3x) + the rest of the message
const LOAD_TIMEOUT_MS = 180_000; // the ~32MB core file is a one-time load per session, but can be genuinely slow on a throttled connection or a dev machine with AV scanning intercepting large local file transfers
const TRANSCODE_TIMEOUT_MS = 3 * 60_000;

let ffmpegInstance = null;
let loadPromise = null;

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ffmpeg.wasm's worker serializes failures as a plain string (`e.toString()`
// in worker.js) rather than rejecting with an Error, so `err.message` on a
// caught ffmpeg rejection is `undefined` — the actual reason gets silently
// dropped. Normalize every rejection to a real Error so callers always get
// a usable message.
function toError(value) {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Video processing failed');
}

async function getFFmpeg(onStatus) {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  onStatus?.('Loading video engine…');

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = '/ffmpeg';
    await withTimeout(
      (async () => {
        const [coreURL, wasmURL] = await Promise.all([
          fetchAsBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          fetchAsBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        ]);
        return ffmpeg.load({ coreURL, wasmURL }).catch((err) => { throw toError(err); });
      })(),
      LOAD_TIMEOUT_MS,
      'Video engine took too long to load — check your connection and try again'
    );
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await loadPromise;
  } catch (error) {
    loadPromise = null;
    throw error;
  }
}

/**
 * Transcode `file` down to a small H.264/AAC MP4 — 480p, capped duration,
 * bitrate tuned for a predictable small size — and return the raw bytes +
 * a data: URL, mirroring compressImageFile's return shape.
 * @param {File} file
 * @param {{onStatus?: (text: string) => void}} [options] - onStatus fires with a short human-readable phase/progress string
 * @returns {Promise<{bytes: Uint8Array, mimeType: string, dataUrl: string}>}
 */
export async function compressVideoFile(file, { onStatus } = {}) {
  if (!file || !file.type?.startsWith('video/')) {
    throw new Error('Selected file is not a video');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`Video is too large (${(file.size / 1024 / 1024).toFixed(0)}MB) — try a shorter or smaller clip`);
  }

  const ffmpeg = await getFFmpeg(onStatus);

  const inputName = 'input' + (file.name.match(/\.\w+$/)?.[0] || '.mp4');
  const outputName = 'output.mp4';

  const handleProgress = ({ progress }) => {
    if (Number.isFinite(progress)) {
      onStatus?.(`Compressing video… ${Math.min(99, Math.round(progress * 100))}%`);
    }
  };
  ffmpeg.on('progress', handleProgress);

  // ffmpeg's own stderr-style log lines are the only place the *real* reason
  // a transcode failed shows up (bad codec, unsupported input, etc.) — the
  // rejection itself is just a generic string. Keep the last few lines so a
  // failure can surface something more useful than "Video processing failed".
  const recentLogs = [];
  const handleLog = ({ message }) => {
    if (message) {
      recentLogs.push(message);
      if (recentLogs.length > 20) recentLogs.shift();
    }
  };
  ffmpeg.on('log', handleLog);

  onStatus?.('Preparing video…');
  await ffmpeg.writeFile(inputName, await fetchFile(file)).catch((err) => { throw toError(err); });

  try {
    onStatus?.('Compressing video…');
    // ultrafast: prioritizes encode speed over compression efficiency —
    // running single-threaded in-browser, a slower preset that shaves a
    // bit off the output size isn't worth multiplying the wait. Downscale
    // to 480p + cap duration + moderate CRF/bitrate keep the size in check
    // instead.
    try {
      await withTimeout(
        ffmpeg.exec([
          '-i', inputName,
          '-t', String(MAX_DURATION_SEC),
          '-vf', 'scale=-2:480',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-c:a', 'aac',
          '-b:a', '96k',
          '-movflags', '+faststart',
          outputName,
        ]),
        TRANSCODE_TIMEOUT_MS,
        'Video compression is taking too long — try a shorter or smaller clip'
      );
    } catch (err) {
      const base = toError(err).message;
      const detail = recentLogs.slice(-5).join(' | ');
      throw new Error(detail ? `${base} (${detail})` : base);
    }

    onStatus?.('Finishing up…');
    const data = await ffmpeg.readFile(outputName).catch((err) => { throw toError(err); });
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    if (bytes.length > TARGET_MAX_BYTES) {
      throw new Error(`Compressed video is still too large (${(bytes.length / 1024 / 1024).toFixed(1)}MB) — try a shorter clip`);
    }

    const mimeType = 'video/mp4';
    const dataUrl = `data:${mimeType};base64,${encodeBase64(bytes)}`;

    return { bytes, mimeType, dataUrl };
  } finally {
    ffmpeg.off('progress', handleProgress);
    ffmpeg.off('log', handleLog);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
