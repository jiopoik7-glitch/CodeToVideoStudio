# CODE-TO-VIDEO STUDIO — CANVAS BODY CONTRACT

This document defines the JavaScript body accepted by Code-to-Video Studio. Return only a JavaScript body; do not include HTML, React, JSX, imports, Node APIs, network requests, or external dependencies.

## Runtime function contract

The app compiles the body with these injected arguments:

```js
(ctx, W, H, S, t, D, p, frame, fps, P, ease, rand)
```

- `ctx`: CanvasRenderingContext2D from an OffscreenCanvas 2D context.
- `W`, `H`: final output dimensions in physical pixels; positive even integers.
- `S`: design scale, `min(W, H) / 1080`.
- `t`: logical frame time in seconds, `frame / fps`.
- `D`: project duration in seconds.
- `p`: normalized progress in `[0, 1]`, `frame / max(totalFrames - 1, 1)`.
- `frame`: zero-based frame index, from `0` to `totalFrames - 1`.
- `fps`: fixed frame rate for the job: 24, 30, or 60.
- `P`: validated object containing editable Props.
- `ease`: deterministic easing helpers: `linear`, `inQuad`, `outQuad`, `inOutCubic`, `outCubic`.
- `rand(index)`: seeded deterministic pseudo-random value. Same seed and index return the same value.

## Determinism rules

1. Draw from injected arguments and immutable constants only.
2. Do not use `Date`, `performance.now()`, `requestAnimationFrame()`, timers, or `Math.random()`.
3. Do not depend on render speed, frame arrival cadence, or previous frames.
4. Derive motion from `t`, `p`, or `frame`.
5. Clear or fully cover the canvas on every frame.
6. The same frame index, settings, Props, and seed should produce the same composition on the same runtime and assets.

## Canvas and layout rules

1. Use Canvas 2D APIs only; do not request WebGL or WebGPU.
2. Base all composition on `W`, `H`, and `S`; do not hard-code one output dimension.
3. Keep essential content at least 5% of the short edge from canvas boundaries.
4. Support `1:1`, `16:9`, `9:16`, and `4:5` ratios.
5. Use `ctx.save()` and `ctx.restore()` for transforms, clips, and compositing changes.
6. Keep loops bounded; avoid large per-pixel loops, huge path counts, and per-frame allocation of large images.
7. Prefer local/system sans-serif fonts; measure text width and wrap text.
8. Do not assume remote images or external fonts exist.

## Worker limitations

The rendering worker has no DOM and the app disables common network, storage, and timer APIs. The worker can be terminated by the host if a frame does not finish. This is a constrained execution environment, not a general-purpose secure JavaScript sandbox. Treat imported code as untrusted and do not include secrets.

## Metadata block

Place one JSON metadata block at the top of the source:

```js
/*<studio-meta>
{
  "schemaVersion": 1,
  "title": "Title",
  "defaultDurationSeconds": 5,
  "seed": 17,
  "props": [
    {"key":"title","label":"Title","type":"text","default":"HELLO"},
    {"key":"accent","label":"Accent","type":"color","default":"#66E3D1"},
    {"key":"scale","label":"Scale","type":"range","min":0.5,"max":1.5,"step":0.05,"default":1.0},
    {"key":"showSubtitle","label":"Show subtitle","type":"boolean","default":true}
  ]
}
</studio-meta>*/
```

Supported Prop types are `text`, `color`, `range`, and `boolean`. Keys must be unique. A project supports at most 32 Props. The entire source body is limited to 64 KiB.

## Quality checklist

- The body compiles without syntax or runtime errors.
- All animation values are derived from the injected frame parameters.
- The composition remains legible in all four supported aspect ratios.
- No network requests, external assets, unbounded work, or frame history are required.
- A frame can be rendered independently of previous frames.
