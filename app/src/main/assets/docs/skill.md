# CODE-TO-VIDEO STUDIO v0.2 — MOTION DIRECTOR & AUDIO CONTRACT

Return ONLY a pure JavaScript Canvas 2D body (no HTML, React, JSX, imports, Node APIs, or external network assets). Max source size: **256 KiB** (262,144 chars).

## 1. Runtime Function Signature (Injected Automatically)

```js
(ctx, W, H, S, t, D, p, frame, fps, P, ease, rand, spring, interpolate, bezier, cam, ui)
```

- `ctx`: OffscreenCanvas `CanvasRenderingContext2D` (reset every frame).
- `W`, `H`: Physical pixel output dimensions (support `9:16`, `16:9`, `1:1`, `4:5`).
- `S`: Scale factor `Math.min(W, H) / 1080`.
- `t`: Frame time in seconds (`frame / fps`). `D`: Total duration (1–60s).
- `p`: Normalized progress `[0, 1]`. `frame`: Zero-based frame index. `fps`: `24`, `30`, or `60`.
- `P`: Frozen object containing editable Props from `/*<studio-meta>*/`.
- `rand(index)`: Deterministic seeded pseudo-random `[0, 1)`. Never call `Math.random()`.

## 2. Built-in Remotion-Style Motion Engine

- **`spring({ frame, fps, from, to, config: { damping, stiffness, mass, overshootClamping } })`**
  Analytical damped harmonic spring (100% deterministic). Example: `spring({ frame: frame - 12, fps, config: { damping: 14, stiffness: 160 } })`.
- **`interpolate(input, inRange, outRange, { easing, extrapolateLeft, extrapolateRight })`**
  Piecewise linear mapping with auto-clamp. Example: `interpolate(p, [0.1, 0.3], [60 * S, 0], { easing: ease.apple })`.
- **`bezier(x1, y1, x2, y2)`**: Precision cubic-bezier curve solver.
- **`ease` presets**: `linear`, `inQuad`, `outQuad`, `inOutQuad`, `inCubic`, `outCubic`, `inOutCubic`, `inExpo`, `outExpo`, `inOutExpo`, `outBack`, `apple` (Keynote glide), `snap` (fast settle), `whip` (whip-pan), `smooth`.
- **`cam` (2.5D Virtual Camera)**:
  - `cam.apply(ctx, { x, y, zoom, rot }, depth)`: Applies centered camera transform with parallax `depth` (`0.35` background, `1.0` stage, `1.35` foreground).
  - `cam.shake(t, amp, freq)`: Subtle organic camera float `{ x, y, rot }`.
- **`ui` (Studio Drawing Toolkit)**:
  - `ui.clamp(v, lo, hi)`, `ui.lerp(a, b, u)`, `ui.seg(p, a, b)`
  - `ui.rgba(hex, alpha)`, `ui.mixColor(hex1, hex2, u)`
  - `ui.rrect(ctx, x, y, w, h, radius)`
  - `ui.wrapText(ctx, text, maxW)`
  - `ui.drawRichText(ctx, [{ text, italic, color }], x, y, maxW, fontSize, lineH, baseCol, revealProg, align)`
  - `ui.drawRing(ctx, cx, cy, r, frac, col, label, bgCol, txtCol, lw)`
  - `ui.drawGlow(ctx, x, y, r, hex, alpha)`
  - `ui.drawGrain(ctx, W, H, rand, count, alpha)`

## 3. Metadata, Props & Built-in Offline Audio / SFX Engine

Place one JSON metadata block at the top of `SOURCE.JS` (`schemaVersion: 2`, max 48 Props, max 128 Audio cues):

```js
/*<studio-meta>
{
  "schemaVersion": 2,
  "title": "Editorial Motion",
  "defaultDurationSeconds": 15,
  "seed": 21,
  "props": [
    {"key":"title","label":"Title","type":"text","default":"HELLO"},
    {"key":"accent","label":"Accent","type":"color","default":"#23C483"},
    {"key":"scale","label":"Scale","type":"range","min":0.7,"max":1.3,"step":0.05,"default":1.0},
    {"key":"dark","label":"Dark Mode","type":"boolean","default":true}
  ],
  "audio": {
    "ambience": "forest_air",
    "ambienceVolume": 0.22,
    "cues": [
      {"p": 0.01, "sfx": "whoosh", "gain": 0.8, "pitch": 1.0},
      {"at": 2.4, "sfx": "pop", "gain": 0.75, "pitch": 1.15},
      {"p": 0.50, "sfx": "whip", "gain": 0.85},
      {"p": 0.90, "sfx": "chime", "gain": 0.9}
    ]
  }
}
</studio-meta>*/
```

### Supported Ambience Beds (`audio.ambience`)
- `none` — silent bed (SFX cues only)
- `warm_pad` — lush warm Cmaj9 studio pad
- `forest_air` — organic gentle breeze + botanical harmonic shimmer
- `minimal_pulse` — subtle 108 BPM organic editorial pulse
- `dark_cinema` — deep atmospheric sub-drone

### Supported 16 Studio SFX (`cues[].sfx`)
- **Transitions**: `whoosh`, `whip`, `swoosh_soft`, `riser`, `sub_drop`
- **UI & Cards**: `pop`, `bubble`, `click`, `tick`, `snap`, `thud`, `shutter`
- **Accents & Finales**: `chime`, `sparkle`, `bloom`, `ding`
- Cue timing accepts either `"at"` (seconds) or `"p"` (normalized progress `0.0..1.0`), plus optional `"gain"` (`0.0..1.5`) and `"pitch"` (`0.4..2.5`).

## 4. Anti-AI-Slop & Motion Choreography Rules (MANDATORY)

1. **Living Camera**: Never leave the camera frozen. Combine spring settle, continuous slow drift/dolly, crane shifts, or 3D orbit.
2. **3-Layer Parallax Depth**: Always separate background ambient glow/grid (`depth: 0.35`), hero content (`depth: 1.0`), and subtle foreground particles/bokeh (`depth: 1.35`).
3. **Zero Fade-to-Gray**: Never drop global canvas alpha on solid backgrounds. Use physical spatial transitions (horizontal whip-pan with clip rect, crane sweep curtain, circular iris portal, or zoom-through).
4. **Editorial Typography**: Pair Bold Sans-Serif with Italic Serif accent words (`ui.drawRichText`), mask line reveals from below with descender headroom, and stagger cards by 3–6 frames using `spring()`.
5. **Sound-Synced Cuts**: Always pair scene transitions with `whip`/`whoosh`, card pops with `pop`/`click`, stat milestones with `tick`/`ding`, and brand lockups with `chime`/`bloom`.
6. **Responsive Safe Margins**: Keep essential elements at least 6% from edges and adapt cleanly between `9:16` vertical and `16:9` widescreen without awkward empty voids.
7. **Strict Determinism**: Never use `Date`, `performance.now()`, timers, `Math.random()`, or frame-to-frame mutable state. Every frame must render independently from `(t, p, frame, fps, P, rand)`.
