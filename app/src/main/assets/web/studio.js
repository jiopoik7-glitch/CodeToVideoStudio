(() => {
  'use strict';

  const canvas = document.getElementById('preview');
  const previewContext = canvas ? canvas.getContext('2d', { alpha: false }) : null;
  const engine = window.StudioEngine || null;

  let engineReady = false;
  let fontsLoaded = false;
  let threeLoaded = typeof window.THREE !== 'undefined';
  let softwareGpu = false;

  let latestPreview = null;
  let isRenderingPreview = false;
  let activePreviewWatchdog = null;
  let initPromise = null;

  function postNative(obj) {
    if (!window.studioNative) return;
    try {
      window.studioNative.postMessage(JSON.stringify(obj));
    } catch (_) {}
  }

  function nextFrame() {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  function startInit() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!engine) {
        postNative({
          type: 'userError',
          message: 'StudioEngine gagal dimuat dari bundle aset lokal.'
        });
        return;
      }

      postNative({ type: 'initProgress', stage: 'Menyiapkan Engine 3D…' });

      // 25s non-fatal cold-start safety watchdog: never kills GPU contexts or shows red error box.
      const initWatchdog = setTimeout(() => {
        if (!engineReady) {
          postNative({ type: 'initProgress', stage: 'Menyelesaikan inisialisasi GPU…' });
        }
      }, 25000);

      try {
        const status = await engine.init((stage) => {
          postNative({ type: 'initProgress', stage: String(stage || 'Menyiapkan Engine…') });
        });
        fontsLoaded = !!(status && status.fontsLoaded);
        threeLoaded = !!(status && status.threeLoaded);
        softwareGpu = !!(status && status.softwareGpu);
      } catch (_) {
        // Non-fatal: fonts or warmup may degrade silently while engine remains usable
        const st = engine.getStatus ? engine.getStatus() : {};
        fontsLoaded = !!st.fontsLoaded;
        threeLoaded = !!st.threeLoaded || typeof window.THREE !== 'undefined';
        softwareGpu = !!st.softwareGpu;
      } finally {
        clearTimeout(initWatchdog);
        engineReady = true;
      }

      postNative({
        type: 'ready',
        fontsLoaded,
        threeLoaded,
        softwareGpu
      });

      if (latestPreview && !isRenderingPreview) {
        drainPreviewQueue();
      }
    })();
    return initPromise;
  }

  async function drainPreviewQueue() {
    if (isRenderingPreview || !engineReady || !engine || !canvas) return;
    isRenderingPreview = true;
    try {
      while (latestPreview) {
        const job = latestPreview;
        latestPreview = null;

        const needsWarmup = typeof engine.needsWarmup === 'function' && engine.needsWarmup(job.sourceBody);
        if (needsWarmup) {
          postNative({ type: 'initProgress', stage: 'Menyiapkan Scene 3D…' });
          // Yield 2 animation frames so Compose paints the frosted shimmer badge before synchronous GLSL compile
          await nextFrame();
          await nextFrame();
        } else {
          // Single micro-yield keeps UI scrolling & scrubber drags silky smooth
          await nextFrame();
        }

        // If another frame arrived while we yielded, skip straight to the latest requested frame
        if (latestPreview) continue;

        // 15s soft per-frame preview watchdog — NEVER destroys GPU singletons or flashes red error card
        if (activePreviewWatchdog) clearTimeout(activePreviewWatchdog);
        activePreviewWatchdog = setTimeout(() => {
          postNative({ type: 'initProgress', stage: 'Mengoptimalkan shader 3D…' });
        }, 15000);

        try {
          const res = await engine.renderPreviewToCanvas(canvas, job);
          if (activePreviewWatchdog) {
            clearTimeout(activePreviewWatchdog);
            activePreviewWatchdog = null;
          }
          if (res) {
            fontsLoaded = !!res.fontsLoaded;
            threeLoaded = !!res.threeLoaded;
            softwareGpu = !!res.softwareGpu;
            postNative({
              type: 'previewOk',
              frame: job.frame,
              width: res.width || canvas.width,
              height: res.height || canvas.height,
              renderMs: res.renderMs || 0,
              fontsLoaded,
              threeLoaded,
              softwareGpu
            });
          }
        } catch (err) {
          if (activePreviewWatchdog) {
            clearTimeout(activePreviewWatchdog);
            activePreviewWatchdog = null;
          }
          const loc = engine.extractLineColumn ? engine.extractLineColumn(err) : { line: null, column: null };
          postNative({
            type: 'userError',
            frame: job.frame,
            line: loc.line || null,
            column: loc.column || null,
            message: String((err && err.message) || err || 'Kesalahan saat merender preview').slice(0, 320)
          });
        }
      }
    } finally {
      if (activePreviewWatchdog) {
        clearTimeout(activePreviewWatchdog);
        activePreviewWatchdog = null;
      }
      isRenderingPreview = false;
    }
  }

  window.studioRuntimeStatus = () => ({
    workerSupported: true,
    exportSupported: !!engine && !!window.studioNative,
    engineReady,
    fontsLoaded,
    threeLoaded,
    softwareGpu
  });

  window.renderPreview = (payload) => {
    if (!engine || !canvas) return false;
    latestPreview = { ...payload, mode: 'preview' };
    if (engineReady && !isRenderingPreview) {
      drainPreviewQueue();
    }
    return true;
  };

  window.renderExportFrame = (payload) => {
    if (!engine || !window.studioNative) {
      postNative({
        type: 'userError',
        frame: payload && payload.frame,
        token: payload && payload.token,
        message: 'StudioEngine atau native ArrayBuffer bridge tidak tersedia.'
      });
      return false;
    }
    (async () => {
      try {
        if (!engineReady) await startInit();
        await nextFrame();
        const res = await engine.renderExportFrame({ ...payload, mode: 'export' });
        if (!res || !res.buffer) {
          throw new Error('Frame buffer ekspor kosong.');
        }
        window.studioNative.postMessage(JSON.stringify({
          type: 'frame',
          frame: payload.frame,
          token: payload.token,
          renderMs: res.renderMs || 0
        }));
        window.studioNative.postMessage(res.buffer);
      } catch (err) {
        const loc = engine.extractLineColumn ? engine.extractLineColumn(err) : { line: null, column: null };
        postNative({
          type: 'userError',
          frame: payload && payload.frame,
          token: payload && payload.token,
          line: loc.line || null,
          column: loc.column || null,
          message: String((err && err.message) || err || 'Ekspor frame gagal').slice(0, 320)
        });
      }
    })();
    return true;
  };

  window.cancelStudioRender = () => {
    latestPreview = null;
    if (activePreviewWatchdog) {
      clearTimeout(activePreviewWatchdog);
      activePreviewWatchdog = null;
    }
    if (engine && typeof engine.cancel === 'function') {
      engine.cancel();
    }
  };
  window.abortWorker = window.cancelStudioRender;

  window.clearPreview = () => {
    if (previewContext && canvas) {
      previewContext.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  startInit();
})();
