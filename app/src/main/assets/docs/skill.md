# CodeToVideoStudio v2.1.0 — Cinema Engine Pro Reference

Engine rendering video JavaScript 100% OFFLINE untuk Android (WebGL2 + Three.js + GLSL Optical Glass + Pro 2D Rig/World/Swarm + Studio Sound Engine v2.0 108 SFX & 15 Ambience Beds).

## 1. Struktur Wajib Skrip
- Awali skrip dengan blok `/*<studio-meta> ... </studio-meta>*/` (`schemaVersion: 21`).
- Variabel global deterministik: `ctx`, `W`, `H`, `S = Math.min(W, H) / 1080`, `t` (detik), `D` (durasi), `p` (`0..1`), `frame`, `fps`, `P` (props), `rand(i)`, `ease`, `spring`, `interpolate`, `bezier`.
- Font offline yang otomatis selesai dimuat sebelum Frame 0:
  - `'Plus Jakarta Sans'` (Bold Display Sans)
  - `'Playfair Display'` (Editorial Serif / Italic)
  - `'Inter'` (Clean UI Sans)
  - `'JetBrains Mono'` (HUD / Timecode Mono)

## 2. 3D Real-Time & Diorama (`studio3D` + `cam3D`)
Menggunakan **Three.js WebGL2 Offline** dengan `PCFSoftShadowMap`, PBR lighting, atmospheric sky dome, dan `FogExp2`:
- `const sc = studio3D.createScene({ fov: 42, skyTop: "#0E2240", skyHorizon: "#7EB6E8", fogDensity: 0.014, shadows: true })`
- `sc.addTerrain({ size: 26, color: "#3A6442", grid: true })`
- `sc.addVilla({ pos: [0,0,0], width: 5, height: 3, depth: 4, floors: 2, progress, delay, wallColor: "#F5F2EB", glowColor: "#FFB86C" })`
- `sc.addTree({ pos: [-4,0,2], scale: 1.1, leafColor: "#2E9E5B", progress, delay })`
- `sc.addPool({ pos: [4.2,0,1.2], width: 4.2, depth: 2.6, progress })`
- `sc.addExtrude([[x,y], ...], { depth: 0.6, color: "#5CC8FF", pos: [0,0,0] })`
- `sc.cam3D.splineDolly(p, [[x,y,z], ...], [tx,ty,tz])`
- `sc.cam3D.orbit(p, center, radius, height, startAz, endAz)`
- `sc.cam3D.focusOn(target, { distance: 8, azimuth: 0.5, elevation: 0.35, progress })`
- `sc.renderTo(ctx)` — komposit tajam ke layer 2D untuk HUD glassmorphism di atas 3D.

## 3. Optical Liquid Glass & Post-FX (`fx.glass`, `fx.shader`)
- `fx.glass.refract(ctx, x, y, w, h, radius, { ior: 1.48, chroma: 0.014, blur: 1.1, rimGlow: 0.9, tint: "rgba(220,238,255,0.12)", sweep })`
- `fx.glass.lens(ctx, cx, cy, r, opts)`
- `fx.glass.pill(ctx, x, y, w, h, label, opts)`
- `fx.shader.postFx(ctx, { bloom: 0.24, vignette: 0.28, grain: 0.025, ripple: 0, aberration: 0 })`

## 4. Pro 2D Character, Cutaway World, Swarm & Local Media
- `rig2D.drawHalftoneBg(ctx, W, H, { bg, dotColor, step })`
- `rig2D.drawCharacter(ctx, { x, y, scale, expression: "happy"|"excited"|"thinking"|"surprised"|"focus", talk: true, lookAt: [tx,ty], wave: true, squash, stretch, glasses })`
- `rig2D.drawSpeechBubble(ctx, x, y, text, { progress, tail })`
- `rig2D.drawChecklist(ctx, x, y, w, items, progress, { title, accent, glass })`
- `ui.drawMagnifier(ctx, cx, cy, r, { srcX, srcY, zoom: 2.2, ringColor, label })`
- `world2D.keyframeCamera(p, keys)` & `world2D.applyCamera(ctx, camState)`
- `world2D.drawOrganicTexture(ctx, x, y, w, h, "soil"|"rock"|"paper", color)`
- `world2D.drawTunnel(ctx, pts, width, { rimColor, fillColor })`
- `world2D.drawRoomLight(ctx, x, y, radius, color, intensity)`
- `fx.swarm.drawSwarm(ctx, paths, { count: 80, type: "ant"|"cell"|"leaf"|"spark", speed: 0.14, spread, size, carryFood, bidirectional })`
- `assets.drawImage(ctx, "nama_aset", x, y, w, h, { radius, fit: "cover"|"contain", shadow: true, popIn })`

## 5. Viral Karaoke Subtitles (`ui.captions`)
Mendukung 3 preset viral siap pakai:
- `pill_highlight` — kata aktif membal dengan kotak pill merah/aksen
- `universe_bold` — teks tebal putih-kuning dengan stroke & drop shadow tajam
- `editorial_glass` — tipografi serif elegan di atas kapsul kaca buram

Contoh:
```javascript
ui.captions(ctx, [
  { start: 0.2, end: 2.8, text: "Render video sinematik langsung dari HP!" }
], t, { preset: "pill_highlight", accent: "#FF3B5C", yRatio: 0.84 });
```

## 6. Studio Sound Engine v2.0 (108 SFX + 15 Ambience Beds)
Auto-Ducking aktif otomatis saat Voiceover masuk maupun saat SFX Cinema Impact (`cinema_boom`, `sub_drop`, `impact_thud`, `trailer_hit`, `stamp_hit`, `braam_low`) berbunyi.
- **Explainer & Pop**: `bubble_pop`, `soft_boing`, `checklist_ding`, `magnifier_whoosh`, `paper_flip`, `sparkle_chime`, `pop`, `bubble`, `boing_high`, `boing_low`, `comic_zip`, `bulb_idea`, `pencil_sketch`, `marker_swipe`, `badge_unlock`, `step_complete`, `counter_tick`, `chart_rise`, `card_flip`, `card_deal`, `sticky_note`, `stamp_hit`, `chalk_write`, `bell_soft`, `marimba_up`, `marimba_down`
- **Liquid Glass & UI**: `glass_clink`, `crystal_tap`, `mech_key_click`, `haptic_tick`, `glass_slide`, `taptic_thock`, `tactile_tick`, `glass_tap`, `click`, `type_key`, `snap`, `glass_shimmer`, `crystal_bloom`, `prism_ping`, `ice_chime`, `lens_focus`, `shutter`, `camera_focus`, `dial_notch`, `toggle_on`, `toggle_off`, `drawer_open`, `drawer_close`, `frosted_brush`
- **Cinema & Transition**: `sub_drop`, `silk_swoosh`, `whip_pan`, `tension_riser`, `impact_thud`, `tape_stop`, `glitch_burst`, `cinema_boom`, `air_whoosh`, `whoosh`, `whip`, `swoosh_soft`, `swoosh_deep`, `liquid_morph`, `bass_hit`, `thud`, `riser`, `braam_low`, `reverse_cymbal`, `trailer_hit`, `metal_slam`, `power_down`, `power_up`, `warp_sweep`
- **Foley & Alam**: `water_drop`, `soil_crunch`, `soft_wind_gust`, `wood_tap`, `paper_slide`, `page_flip`, `leaf_rustle`, `stone_clack`, `footstep_gravel`, `footstep_wood`, `rain_plip`, `stream_splash`, `ceramic_clink`, `fabric_brush`, `zipper_fast`, `coin_spin`, `match_strike`, `fire_crackle`, `heartbeat_sub`, `clock_tick`
- **Akustik**: `felt_pluck`, `kalimba_note`, `chime`, `ding`, `bloom`, `sparkle`, `harp_gliss`, `piano_warm`, `piano_high`, `cello_swell`, `guitar_harmonic`, `celesta_twinkle`, `bell_crystal`, `chord_resolve`
- **Ambience Beds**: `keynote_pulse`, `documentary_pulse`, `botanical_air`, `lofi_garden`, `ios_glass_chimes`, `warm_pad`, `dark_cinema`, `warm_editorial_hum`, `room_tone`, `soft_wind`, `soil_nature`, `night_rain`, `deep_space`, `tech_minimal`, `acoustic_studio`

## 7. Kompatibilitas v1.1 Penuh
Semua API v1.1 (`g3d`, `d3`, `ui.drawMeshBg`, `ui.drawLiquidGlass`, `cam.apply`, `fx.particles`, `fx.chart`) tetap didukung 100%.
