(() => {
  'use strict';
  const canvas = document.getElementById('preview');
  const previewContext = canvas.getContext('2d', { alpha: false });
  const badge = document.getElementById('runtime-badge');
  const errorBox = document.getElementById('runtime-error');
  let worker = null;
  let previewWatchdog = null;
  let workerSupported = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' &&
    typeof ImageData !== 'undefined';

  function drawBitmap(image, width, height) {
    if (!image) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    previewContext.clearRect(0, 0, canvas.width, canvas.height);
    previewContext.drawImage(image, 0, 0);
    image.close?.();
  }

  function launchWorker() {
    if (!workerSupported) return;
    try {
      worker = new Worker(new URL('renderer-worker.js', window.location.href));
      worker.onmessage = (event) => {
        const data = event.data || {};
        if (data.type === 'previewFrame' && data.image) {
          if (previewWatchdog) clearTimeout(previewWatchdog);
          previewWatchdog = null;
          drawBitmap(data.image, data.width, data.height);
          errorBox.hidden = true;
        } else if (data.type === 'frameBuffer') {
          if (data.previewImage) {
            drawBitmap(data.previewImage, data.width, data.height);
          }
          if (!window.studioNative || !data.buffer) {
            showError('Native ArrayBuffer bridge is not available.');
            return;
          }
          window.studioNative.postMessage(JSON.stringify({ type: 'frame', frame: data.frame, token: data.token }));
          window.studioNative.postMessage(data.buffer);
        } else if (data.type === 'error') {
          showError(data.message || 'Canvas worker failed.');
          if (window.studioNative) {
            window.studioNative.postMessage(JSON.stringify({ type: 'error', frame: data.frame, token: data.token, message: String(data.message || 'Worker error').slice(0, 240) }));
          }
        } else if (data.type === 'ready') {
          badge.textContent = 'LIVE ENGINE READY';
        }
      };
      worker.onerror = (event) => showError(event.message || 'Worker error.');
    } catch (error) {
      workerSupported = false;
      showError(String(error));
    }
  }

  function showError(message) {
    errorBox.textContent = String(message).slice(0, 240);
    errorBox.hidden = false;
  }

  window.showHostError = showError;
  launchWorker();
  window.studioRuntimeStatus = () => ({
    workerSupported,
    exportSupported: workerSupported && !!window.studioNative
  });
  window.renderPreview = (payload) => {
    if (!worker) { showError('OffscreenCanvas Worker is not available on this WebView.'); return false; }
    if (previewWatchdog) clearTimeout(previewWatchdog);
    previewWatchdog = setTimeout(() => { showError('Preview frame timeout. Worker telah dihentikan.'); window.abortWorker(); }, 4500);
    worker.postMessage({ ...payload, mode: 'preview' });
    return true;
  };
  window.renderExportFrame = (payload) => {
    if (!worker || !window.studioNative) { showError('Worker or native ArrayBuffer bridge is unavailable.'); return; }
    worker.postMessage({ ...payload, mode: 'export' });
    return true;
  };
  window.abortWorker = () => {
    if (previewWatchdog) clearTimeout(previewWatchdog);
    previewWatchdog = null;
    try { worker?.terminate(); } catch (_) {}
    worker = null;
    launchWorker();
  };
  window.clearPreview = () => previewContext.clearRect(0, 0, canvas.width, canvas.height);
})();
