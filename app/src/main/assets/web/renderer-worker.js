'use strict';

// The worker has no DOM or native bridge. Keep all untrusted source execution here
// so the host can terminate a non-yielding while(true) loop.
["fetch","XMLHttpRequest","WebSocket","importScripts","indexedDB","caches","BroadcastChannel","Worker","WebAssembly","setTimeout","setInterval","requestAnimationFrame"].forEach((k)=>{try{Object.defineProperty(self,k,{value:undefined,writable:false,configurable:true});}catch(_){try{self[k]=undefined;}catch(__){}}});
Math.random = () => { throw new Error('Math.random() is disabled; use rand(index).'); };

let canvas = null;
let ctx = null;
let currentWidth = 0;
let currentHeight = 0;

const ease = Object.freeze({
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutCubic: (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  outCubic: (x) => 1 - Math.pow(1 - x, 3)
});

function seededRandom(seed, index) {
  let value = (seed ^ Math.imul(index + 1, 0x45d9f3b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 4294967296;
}

function ensureCanvas(width, height) {
  if (!canvas || width !== currentWidth || height !== currentHeight) {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('OffscreenCanvas 2D context is not supported.');
    currentWidth = width;
    currentHeight = height;
  }
}

function render(message) {
  const W = message.W | 0;
  const H = message.H | 0;
  const frame = message.frame | 0;
  const fps = message.fps | 0;
  const D = Number(message.D);
  const totalFrames = message.totalFrames | 0;
  if (W < 2 || H < 2 || W > 3840 || H > 3840 || W * H * 4 > 35_000_000) throw new Error('Output dimensions exceed the runtime safety limit.');
  if (![24, 30, 60].includes(fps) || totalFrames < 1 || totalFrames > 1800 || frame < 0 || frame >= totalFrames) throw new Error('Invalid frame settings.');
  if (typeof message.sourceBody !== 'string' || message.sourceBody.length > 65536) throw new Error('Source body must be 64 KiB or smaller.');

  ensureCanvas(W, H);
  // Reset the complete Canvas 2D state stack, clipping region, current path,
  // transform, and bitmap at every frame. This prevents a body that forgets
  // restore() from contaminating the next independently rendered frame.
  canvas.width = W;
  canvas.height = H;
  ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas 2D context could not be restored.');
  ctx.clearRect(0, 0, W, H);

  const S = Math.min(W, H) / 1080;
  const t = frame / fps;
  const p = frame / Math.max(totalFrames - 1, 1);
  const P = Object.freeze(message.props || {});
  const rand = (index) => seededRandom(message.seed | 0, index | 0);

  // Shadow APIs commonly used for network, persistence, timers and DOM access.
  // The dedicated worker remains terminable by the trusted page/native host.
  const body = new Function(
    'ctx', 'W', 'H', 'S', 't', 'D', 'p', 'frame', 'fps', 'P', 'ease', 'rand',
    'globalThis', 'self', 'fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts',
    'indexedDB', 'caches', 'BroadcastChannel', 'Worker', 'WebAssembly', 'setTimeout',
    'setInterval', 'requestAnimationFrame', 'document', 'window',
    '"use strict";\n' + message.sourceBody
  );
  body(ctx, W, H, S, t, D, p, frame, fps, P, ease, rand,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);

  if (message.mode === 'preview') {
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage({ type: 'previewFrame', frame, width: W, height: H, image: bitmap }, [bitmap]);
  } else {
    const pixels = ctx.getImageData(0, 0, W, H).data;
    // ImageData uses a tight RGBA_8888 array for this canvas size.
    const buffer = pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + pixels.byteLength);
    self.postMessage({ type: 'frameBuffer', frame, token: message.token, buffer }, [buffer]);
  }
}

self.onmessage = (event) => {
  const message = event.data || {};
  try {
    render(message);
  } catch (error) {
    self.postMessage({ type: 'error', frame: message.frame, token: message.token, message: String(error?.message || error).slice(0, 240) });
  }
};

self.postMessage({ type: 'ready' });
