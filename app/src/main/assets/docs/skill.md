# RENDER VIDEO CODE v0.4 — iOS 26 LIQUID GLASS, MOTION DIRECTOR & 26 SFX CONTRACT

Return ONLY a pure JavaScript Canvas 2D body (no HTML, React, JSX, imports, Node APIs, or external network requests). Max source size: **256 KiB** (262,144 chars). Max duration: **60s**.

## 1. Runtime Function Signature (Injected Automatically)

```js
(ctx, W, H, S, t, D, p, frame, fps, P, ease, rand, spring, interpolate, bezier, cam, ui, fx, d3)
```

- `ctx`: OffscreenCanvas 2D context (fresh every frame). `W, H`: physical output pixels (`9:16`, `16:9`, `1:1`, `4:5`).
- `S`: `Math.min(W, H) / 1080`. `t`: seconds (`frame / fps`). `D`: duration (1–60s). `p`: `[0, 1]`.
- `frame`, `fps` (`24`/`30`/`60`), `P` (frozen Props), `rand(index)` (deterministic seeded `[0, 1)`).

## 2. Motion Physics, Transitions, Kinetic Text, Particles, Charts & 3D

- **Remotion-Style Physics**:
  - `spring({ frame, fps, from, to, config: { damping, stiffness, mass, overshootClamping } })`
  - `interpolate(input, inRange, outRange, { easing, extrapolateLeft, extrapolateRight })`
  - `bezier(x1, y1, x2, y2)` & `ease`: `linear`, `inQuad`, `outQuad`, `inOutQuad`, `inCubic`, `outCubic`, `inOutCubic`, `inExpo`, `outExpo`, `inOutExpo`, `outBack`, `apple`, `snap`, `whip`, `smooth`, `ios`, `liquid`.
- **2.5D Virtual Camera (`cam`)**: `cam.apply(ctx, { x, y, zoom, rot }, depth)` and `cam.shake(t, amp, freq)`.
- **8 Spatial Transitions (`fx.transition`)** — zero muddy fade-to-gray:
  - `whipPan(ctx, u, drawA, drawB, accentCol)` | `craneSweep(...)` | `irisPortal(ctx, u, drawA, drawB, cx, cy, ringCol)`
  - `glassSlide(ctx, u, drawA, drawB)` | `zoomThrough(...)` | `splitShutter(...)` | `liquidWipe(...)` | `cardFlip3D(...)`
- **6 Kinetic Typography Engines (`fx.text`)**:
  - `wordStagger(ctx, str, x, y, maxW, fontSize, col, startFrame, align)`
  - `charWave(ctx, str, x, y, fontSize, col, amp, speed, align)`
  - `counterRoll(ctx, val, x, y, fontSize, col, suffix, align)`
  - `highlightSweep(ctx, str, x, y, fontSize, bgCol, txtCol, prog, align)`
  - `typewriter(ctx, str, x, y, fontSize, col, prog, showCursor)`
  - `kineticMask(ctx, str, x, y, fontSize, col, prog, align)`
- **4 Deterministic Particle Systems (`fx.particles`)**:
  - `bokeh(ctx, count, colHex, alpha)` | `petals(ctx, count, colHex, alpha)` | `confetti(ctx, count, colors, prog)` | `sparkles(ctx, count, colHex, alpha)`
- **Data Viz (`fx.chart`)**: `spline(ctx, values, x, y, w, h, col, prog)` and `bars(ctx, [{ value, label, color }], x, y, w, h, startFrame)`.
- **iOS 26 Liquid Glass & UI (`ui`)**:
  - `ui.drawMeshBg(ctx, W, H, baseHex, orbs, t)`, `ui.drawLiquidGlass(ctx, x, y, w, h, r, { light, sweep, chromatic })`
  - `ui.drawWaterDrop(ctx, cx, cy, r, colHex)`, `ui.drawPill(...)`, `ui.drawRing(...)`, `ui.drawRichText(...)`, `ui.drawProgressBar(...)`, `ui.drawGlow(...)`, `ui.drawGrain(...)`.
- **3D Scene Engine (`d3`)**:
  - `const sc = d3.createScene(eye, target, fov, W, H, cyRatio)` -> `sc.poly(verts, colHex, { col2, twoSided, spec, alpha, zBias })`, `sc.line(a, b, colStr, wPx)`, `sc.orb(pt, rWorld, colHex, alpha)`, `sc.render(ctx, S)`.

## 3. Metadata, Props & 26 Studio SFX Audio Engine (`schemaVersion: 4`)

```js
/*<studio-meta>
{
  "schemaVersion": 4,
  "title": "iOS 26 Liquid Glass Hero",
  "defaultDurationSeconds": 10,
  "seed": 26,
  "props": [
    {"key":"title","label":"Headline","type":"text","default":"Design that breathes."},
    {"key":"accent","label":"Accent","type":"color","default":"#DCE8F5"}
  ],
  "audio": {
    "ambience": "apple_keynote_minimal",
    "ambienceVolume": 0.22,
    "cues": [
      {"p": 0.02, "sfx": "liquid_morph", "gain": 0.80},
      {"p": 0.18, "sfx": "water_drop", "gain": 0.78, "pitch": 1.05},
      {"p": 0.48, "sfx": "glass_slide", "gain": 0.88},
      {"p": 0.85, "sfx": "glass_shimmer", "gain": 0.90}
    ]
  }
}
</studio-meta>*/
```

- **6 Ambience Beds**: `none`, `apple_keynote_minimal`, `ios_glass_chimes`, `warm_pad`, `forest_air`, `minimal_pulse`, `dark_cinema`.
- **26 Studio SFX**:
  - *iOS 26 Liquid & Glass*: `water_drop`, `liquid_morph`, `glass_shimmer`, `glass_tap`, `glass_slide`, `camera_focus`, `shutter`
  - *Cinematic Transitions*: `whoosh`, `whip`, `swoosh_soft`, `swoosh_deep`, `riser`, `sub_drop`, `bass_hit`, `thud`, `page_flip`
  - *UI & Type*: `pop`, `bubble`, `click`, `tick`, `snap`, `type_key`
  - *Accents & Finale*: `chime`, `sparkle`, `bloom`, `ding`

## 4. Pacing Playbook & Anti-AI-Slop Rules (MANDATORY)

1. **Pacing Blueprint**: 5s = 2 beats (Hook -> Lockup); 10s = 3 beats (Hook -> Showcase -> Finale); 15s = 4–5 beats (Hook -> Proof/Data -> Visual Hero -> Summary -> Brand Lockup).
2. **Living Camera**: Never leave frames frozen. Always layer spring settle + slow dolly/orbit + 3-layer parallax (`0.35` bg, `1.0` stage, `1.35` foreground particles).
3. **Audio-Visual Lock**: Pair every `fx.transition` cut with `whip`/`glass_slide`/`liquid_morph`, every card pop with `glass_tap`/`water_drop`/`pop`, and every finale with `bloom`/`glass_shimmer`/`chime`.
4. **Zero Slop**: No rigid linear curves, no generic flat cards without depth, no empty vertical voids on `9:16`, and strictly zero `Math.random()` or `Date`.
