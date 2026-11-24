# RENDER VIDEO CODE v0.3 — iOS LIQUID GLASS, 3D & 20 SFX MOTION CONTRACT

Return ONLY a pure JavaScript Canvas 2D body (no HTML, React, JSX, imports, Node APIs, or external assets). Max source size: **256 KiB** (262,144 chars).

## 1. Runtime Function Signature (Injected Automatically)

```js
(ctx, W, H, S, t, D, p, frame, fps, P, ease, rand, spring, interpolate, bezier, cam, ui, fx, d3)
```

- `ctx`: OffscreenCanvas `CanvasRenderingContext2D` (clean reset per frame).
- `W`, `H`: Physical output dimensions (`9:16`, `16:9`, `1:1`, `4:5`). `S`: `Math.min(W, H) / 1080`.
- `t`: Frame time in seconds. `D`: Total duration (1–60s). `p`: Normalized progress `[0, 1]`.
- `frame`, `fps` (`24`/`30`/`60`), `P` (frozen Props), `rand(index)` (seeded deterministic `[0, 1)`).

## 2. Built-in Motion Engine (Remotion + Apple Keynote + Liquid Glass)

- **`spring({ frame, fps, from, to, config: { damping, stiffness, mass, overshootClamping } })`**
- **`interpolate(input, inRange, outRange, { easing, extrapolateLeft, extrapolateRight })`**
- **`bezier(x1, y1, x2, y2)`** & **`ease`**: `linear`, `inQuad`, `outQuad`, `inOutQuad`, `inCubic`, `outCubic`, `inOutCubic`, `inExpo`, `outExpo`, `inOutExpo`, `outBack`, `apple`, `snap`, `whip`, `smooth`, `ios`.
- **`cam`**: `cam.apply(ctx, { x, y, zoom, rot }, depth)` (parallax `0.35` bg / `1.0` stage / `1.35` fg) and `cam.shake(t, amp, freq)`.
- **`fx`**: `fx.stagger(frame, index, delayFrames, config)` and `fx.scene(p, start, end)` -> `{ p, in, out, active }`.
- **`ui`**:
  - `ui.drawMeshBg(ctx, W, H, baseHex, [{ x, y, r, col, a }], t)` — fluid Apple mesh gradient background.
  - `ui.drawGlassCard(ctx, x, y, w, h, r, { light })` — iOS Liquid Glass card with specular sheen & chrome rim.
  - `ui.drawPill(ctx, x, y, label, bgCol, txtCol, fontSize)` — frosted glass pill badge.
  - `ui.drawProgressBar(ctx, x, y, w, h, frac, col, trackCol)`
  - `ui.drawRichText(ctx, [{ text, italic, color }], x, y, maxW, fontSize, lineH, baseCol, revealProg, align)`
  - `ui.drawRing(ctx, cx, cy, r, frac, col, label, bgCol, txtCol, lw)`
  - `ui.drawGlow(ctx, x, y, r, hex, alpha)`, `ui.drawGrain(ctx, W, H, rand, count, alpha)`
  - `ui.rrect(ctx, x, y, w, h, r)`, `ui.wrapText(ctx, text, maxW)`, `ui.rgba(hex, a)`, `ui.mixColor(h1, h2, u)`, `ui.clamp`, `ui.lerp`, `ui.seg`.
- **`d3` (Micro 3D Engine)**: `d3.camera(eye, target, fovRad, W, H, cyRatio)`, `d3.rotX/Y/Z`, `d3.norm`, `d3.dot`, `d3.cross`, `d3.sub`.

## 3. Metadata, Props & 20 Studio SFX Audio Engine

```js
/*<studio-meta>
{
  "schemaVersion": 3,
  "title": "Liquid Glass Showcase",
  "defaultDurationSeconds": 10,
  "seed": 26,
  "props": [
    {"key":"title","label":"Headline","type":"text","default":"Design that moves."},
    {"key":"accent","label":"Accent","type":"color","default":"#E6ECF2"}
  ],
  "audio": {
    "ambience": "ios_glass_chimes",
    "ambienceVolume": 0.22,
    "cues": [
      {"p": 0.02, "sfx": "glass_slide", "gain": 0.8},
      {"p": 0.20, "sfx": "glass_tap", "gain": 0.75, "pitch": 1.05},
      {"p": 0.50, "sfx": "whip", "gain": 0.85},
      {"p": 0.84, "sfx": "bloom", "gain": 0.88}
    ]
  }
}
</studio-meta>*/
```

- **5 Ambience Beds**: `none`, `ios_glass_chimes`, `warm_pad`, `forest_air`, `minimal_pulse`, `dark_cinema`.
- **20 Studio SFX**:
  - *Glass & Camera*: `glass_tap`, `glass_slide`, `camera_focus`, `shutter`
  - *Transitions & Impact*: `whoosh`, `whip`, `swoosh_soft`, `riser`, `sub_drop`, `bass_hit`, `thud`
  - *UI & Pop*: `pop`, `bubble`, `click`, `tick`, `snap`
  - *Accents & Finale*: `chime`, `sparkle`, `bloom`, `ding`

## 4. Anti-AI-Slop Director Rules (MANDATORY)

1. **Zero Static Frames**: Keep subtle continuous camera motion (spring settle + dolly/orbit + parallax drift).
2. **Physical Spatial Cuts**: Never fade solid backgrounds to muddy gray. Use whip-pan clip rects, crane sweeps, or circular iris portals paired with `whip` / `glass_slide` SFX.
3. **3-Layer Depth**: Background fluid mesh (`0.35`), hero glass/3D stage (`1.0`), foreground bokeh/petals (`1.35`).
4. **Editorial Hierarchy**: Pair crisp bold sans with italic serif highlights (`ui.drawRichText`), staggered card springs (`fx.stagger`), and minimum 6% safe margins across `9:16` and `16:9`.
5. **Strict Determinism**: Never use `Date`, timers, `Math.random()`, or mutable state across frames.
