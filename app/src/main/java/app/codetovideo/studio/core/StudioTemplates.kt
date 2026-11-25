package app.codetovideo.studio.core

object StudioTemplates {
    const val DATA_STORY = """/*<studio-meta>
{
  "schemaVersion": 5,
  "title": "Swiss Data Editorial",
  "defaultDurationSeconds": 10,
  "seed": 44,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"metric","label":"Label Grafik","type":"text","default":"PERTUMBUHAN TANAMAN"},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#23A455"}
  ],
  "audio": {
    "ambience": "keynote_pulse",
    "ambienceVolume": 0.15,
    "cues": [
      {"p": 0.01, "sfx": "swoosh_soft", "gain": 0.46},
      {"p": 0.08, "sfx": "tactile_tick", "gain": 0.38, "pitch": 1.0},
      {"p": 0.18, "sfx": "glass_tap", "gain": 0.40, "pitch": 1.06},
      {"p": 0.46, "sfx": "glass_slide", "gain": 0.56},
      {"p": 0.51, "sfx": "tactile_tick", "gain": 0.38, "pitch": 1.08},
      {"p": 0.56, "sfx": "glass_tap", "gain": 0.40, "pitch": 1.15},
      {"p": 0.82, "sfx": "chime", "gain": 0.46}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#23A455");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const isWide = W > H * 1.15;

function drawSceneA(sp) {
  const cState = fx.cameraRig(sp, [
    { p: 0.0, x: 0, y: -22 * S, zoom: 1.09, rot: -0.008 },
    { p: 0.4, x: 0, y: 0, zoom: 1.0, rot: 0.0 },
    { p: 1.0, x: 12 * S, y: 18 * S, zoom: 1.045, rot: 0.006 }
  ], 4 * S);

  ui.drawMeshBg(ctx, W, H, "#070C10", [
    { x: 0.84, y: 0.16, r: 0.78, col: accent, a: 0.28 },
    { x: 0.14, y: 0.82, r: 0.72, col: "#4AA3FF", a: 0.22 }
  ], t);
  ctx.save();
  cam.apply(ctx, cState, 0.35);
  ui.drawGrid(ctx, W, H, 130 * S, "rgba(255,255,255,0.032)");
  ctx.restore();

  ctx.save();
  cam.apply(ctx, cState, 1.0);
  const topY = isWide ? H * 0.12 : H * 0.11;
  ui.drawPill(ctx, pad, topY, String(P.metric || "PERTUMBUHAN TANAMAN"), "rgba(255,255,255,0.10)", accent, Math.max(12, Math.round(21 * S)));

  // Continuous rolling counter — climbs cleanly across entire scene (zero dead hold!)
  const countVal = interpolate(sp, [0.02, 0.92], [14, 98.4], { easing: ease.apple });
  fx.text.counterRoll(ctx, countVal, pad, topY + 72 * S, Math.round((isWide ? 120 : 148) * S), "#FFFFFF", "%", "left");

  ctx.fillStyle = "rgba(210,226,218,0.75)";
  ctx.font = "500 " + Math.max(13, Math.round(26 * S)) + "px sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("Indeks vitalitas akar & tunas baru (30 hari)", pad, topY + (isWide ? 216 : 246) * S);

  // Seamless Liquid Glass Spline Card
  const cardY = isWide ? H * 0.48 : H * 0.40;
  const cardH = (isWide ? 330 : 450) * S;
  ui.drawLiquidGlass(ctx, pad, cardY, innerW, cardH, 30 * S, { light: false, sweep: sp * 1.3 });
  fx.chart.spline(ctx, [16, 24, 29, 44, 56, 62, 81, 98], pad + 38 * S, cardY + 62 * S, innerW - 76 * S, cardH - 120 * S, accent, ui.seg(sp, 0.06, 0.88));

  // Secondary bottom micro-cards (fills 9:16 cleanly)
  if (!isWide) {
    const miniY = cardY + cardH + 34 * S;
    const miniW = (innerW - 24 * S) * 0.5;
    const miniH = 158 * S;
    const stats = [
      { k: "KELEMBAPAN", v: Math.round(lerp(42, 74, ease.apple(sp))) + "%", c: "#6CC4FF" },
      { k: "CAHAYA OPTIMAL", v: Math.round(lerp(3, 6.8, ease.apple(sp)) * 10) / 10 + " jam", c: "#F5C45E" }
    ];
    for (let i = 0; i < 2; i++) {
      const stP = fx.stagger(frame, i + 4, 6);
      const mx = pad + i * (miniW + 24 * S);
      ctx.save();
      ctx.globalAlpha = ui.clamp(stP * 1.3, 0, 1);
      ctx.translate(0, (1 - stP) * 44 * S);
      ui.drawLiquidGlass(ctx, mx, miniY, miniW, miniH, 24 * S, { light: false });
      ctx.fillStyle = "rgba(200,216,210,0.68)";
      ctx.font = "700 " + Math.round(18 * S) + "px monospace, sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(stats[i].k, mx + 26 * S, miniY + 28 * S);
      ctx.fillStyle = stats[i].c;
      ctx.font = "800 " + Math.round(48 * S) + "px sans-serif";
      ctx.fillText(stats[i].v, mx + 26 * S, miniY + 68 * S);
      ctx.restore();
    }
  }
  ctx.restore();
  ui.drawVignette(ctx, W, H, 0.34, false);
}

function drawSceneB(sp) {
  const cState = fx.cameraRig(sp, [
    { p: 0.0, x: 0, y: 16 * S, zoom: 1.07, rot: 0.006 },
    { p: 0.5, x: 0, y: 0, zoom: 1.0, rot: 0.0 },
    { p: 1.0, x: 0, y: -12 * S, zoom: 1.03, rot: -0.004 }
  ], 3.5 * S);

  ui.drawMeshBg(ctx, W, H, "#F4F6F2", [
    { x: 0.82, y: 0.16, r: 0.72, col: accent, a: 0.22 },
    { x: 0.16, y: 0.86, r: 0.68, col: "#A9CBFF", a: 0.26 }
  ], t);
  ctx.save();
  cam.apply(ctx, cState, 0.35);
  ui.drawGrid(ctx, W, H, 130 * S, "rgba(14,20,29,0.04)");
  ctx.restore();

  ctx.save();
  cam.apply(ctx, cState, 1.0);
  const fS = Math.round((isWide ? 66 : 76) * S);
  const topY = isWide ? H * 0.11 : H * 0.13;
  const used = ui.drawRichText(ctx, [
    { text: "Hasil nyata dari perawatan" },
    { text: "konsisten.", italic: true, color: accent }
  ], pad, topY, innerW, fS, fS * 1.18, "#0E141D", ui.seg(sp, 0.02, 0.44), "left");

  const cardY = topY + used + 48 * S;
  const cardH = (isWide ? 340 : 460) * S;
  ui.drawLiquidGlass(ctx, pad, cardY, innerW, cardH, 30 * S, { light: true, sweep: sp * 1.2 });
  // High-contrast dark labels & value numbers on light glass card!
  fx.chart.bars(ctx, [
    { value: 0.42, label: "W1", color: "#8EA4BC" },
    { value: 0.66, label: "W2", color: "#58A6E8" },
    { value: 0.84, label: "W3", color: "#36C276" },
    { value: 0.98, label: "W4", color: accent }
  ], pad + 44 * S, cardY + 62 * S, innerW - 88 * S, cardH - 128 * S, Math.round(fps * 4.9), { light: true, showValues: true });

  // Editorial Brand Lockup with subtle ring accent
  const lockY = cardY + cardH + 64 * S;
  ui.drawRichText(ctx, [
    { text: String(P.brand || "Seflorner") },
    { text: ".", color: accent }
  ], W * 0.5, lockY, innerW, Math.round(70 * S), 80 * S, "#0E141D", ui.seg(sp, 0.36, 0.80), "center");

  ctx.save();
  ctx.globalAlpha = ease.apple(ui.seg(sp, 0.52, 0.86));
  ctx.fillStyle = "rgba(14,20,29,0.58)";
  ctx.font = "italic 500 " + Math.round(28 * S) + "px Georgia, serif";
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText("Tumbuh terukur, mekar maksimal.", W * 0.5, lockY + 86 * S);
  ctx.restore();
  ctx.restore();
}

const lerp = ui.lerp;
if (p < 0.45) drawSceneA(ui.seg(p, 0.0, 0.55));
else if (p < 0.55) fx.transition.glassSlide(ctx, ui.seg(p, 0.45, 0.55), () => drawSceneA(ui.seg(p, 0.0, 0.55)), () => drawSceneB(ui.seg(p, 0.45, 1.0)));
else drawSceneB(ui.seg(p, 0.45, 1.0));
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, accent, "rgba(120,140,160,0.22)");
"""

    const val BOTANICAL_3D = """/*<studio-meta>
{
  "schemaVersion": 5,
  "title": "3D Velvet Rose Cinema",
  "defaultDurationSeconds": 10,
  "seed": 77,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"subtitle","label":"Catatan Botani","type":"text","default":"36 KELOPAK SPIRAL · SUDUT EMAS 137.5°"},
    {"key":"roseColor","label":"Warna Mawar","type":"color","default":"#D62849"},
    {"key":"leafColor","label":"Warna Daun","type":"color","default":"#257E4E"}
  ],
  "audio": {
    "ambience": "botanical_air",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.01, "sfx": "swoosh_soft", "gain": 0.48},
      {"p": 0.28, "sfx": "bloom", "gain": 0.46},
      {"p": 0.65, "sfx": "glass_shimmer", "gain": 0.40, "pitch": 1.05},
      {"p": 0.86, "sfx": "chime", "gain": 0.44}
    ]
  }
}
</studio-meta>*/

const roseCol = String(P.roseColor || "#D62849");
const leafCol = String(P.leafColor || "#257E4E");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const isWide = W > H * 1.15;

ui.drawMeshBg(ctx, W, H, "#040A07", [
  { x: 0.50, y: 0.40, r: 0.72, col: roseCol, a: 0.22 },
  { x: 0.18, y: 0.84, r: 0.65, col: leafCol, a: 0.18 }
], t);

// Soft volumetric key light ray from top-right
ctx.save();
const ray = ctx.createLinearGradient(W * 0.88, 0, W * 0.28, H * 0.78);
ray.addColorStop(0, "rgba(255,244,215,0.075)");
ray.addColorStop(1, "rgba(0,0,0,0)");
ctx.fillStyle = ray;
ctx.beginPath();
ctx.moveTo(W * 0.56, 0); ctx.lineTo(W, 0); ctx.lineTo(W * 0.64, H * 0.85); ctx.lineTo(W * 0.14, H * 0.85);
ctx.closePath(); ctx.fill();
ctx.restore();

// Continuous cinematic 3D orbit + dolly-in bloom reveal
const az = -0.45 + ease.smooth(p) * Math.PI * 2.15;
const elev = 0.24 + Math.sin(p * Math.PI) * 0.42;
const dist = (isWide ? 4.4 : 5.6) - Math.sin(p * Math.PI) * 0.95;
const floatY = Math.sin(t * 1.4) * 0.07;
const eye = [dist * Math.cos(elev) * Math.sin(az), 0.35 + dist * Math.sin(elev), dist * Math.cos(elev) * Math.cos(az)];
const sc = d3.createScene(eye, [0, 0.35 + floatY * 0.4, 0], 0.70, W, H, isWide ? 0.46 : 0.42);

// Smooth sculpted stem (16 sides)
sc.addLathe([
  { r: 0.09, y: -1.45 },
  { r: 0.075, y: -0.65 },
  { r: 0.062, y: 0.05 }
], 14, "#174F31", leafCol, floatY, 16, 0.02);

// 5 Rounded sepals beneath bloom
const bloom = ease.apple(ui.seg(p, 0.04, 0.68));
for (let i = 0; i < 5; i++) {
  const a = (i * Math.PI * 2) / 5 + 0.3;
  sc.addOrganicPetal([0, floatY - 0.02, 0], a, 0.08, 0, 0.26, 0.58, ui.lerp(0.55, 1.32, bloom), 0.04, 0.05, "#164A2E", leafCol, 0.02);
}

// 34 Rounded 9-point Velvet Petals (ZERO jagged triangles!)
const golden = 2.399963229728653;
const totalP = 34;
for (let i = 0; i < totalP; i++) {
  const lay = i / (totalP - 1);
  const pb = ease.snap(ui.seg(bloom, (1 - lay) * 0.30, 0.70 + (1 - lay) * 0.30));
  const ang = i * golden;
  const rad = ui.lerp(0.05, 0.38, Math.pow(lay, 0.9));
  const by = ui.lerp(0.24, 0.02, lay);
  const pH = ui.lerp(0.36, 0.76, Math.pow(lay, 0.72));
  const pW = ui.lerp(0.24, 0.60, Math.pow(lay, 0.78));
  const pitch = ui.lerp(ui.lerp(0.10, 0.32, lay), ui.lerp(0.18, 0.88, Math.pow(lay, 1.12)), pb);
  const cup = ui.lerp(0.06, 0.15, lay);
  const curl = ui.lerp(0.02, 0.16, lay) * pb;
  const colBase = lay < 0.45 ? "#5A1022" : roseCol;
  const colTip = lay < 0.45 ? roseCol : "#FF8FA8";
  sc.addOrganicPetal([0, floatY, 0], ang, rad, by, pW, pH, pitch, cup, curl, colBase, colTip, -lay * 0.018);
}

// 4 Curved botanical leaves
for (let i = 0; i < 4; i++) {
  const a = i * 1.57 + 0.5;
  const ly = floatY - 0.35 - i * 0.22;
  sc.addOrganicPetal([0, ly, 0], a, 0.06, 0, 0.38, 0.92, 1.15 + Math.sin(t * 2 + i) * 0.04, 0.06, 0.08, "#164A2E", "#48B878", 0.01);
}

// Soft optical bokeh pollen orbs
for (let i = 0; i < 16; i++) {
  const oa = rand(300 + i) * Math.PI * 2 + t * 0.32;
  const rr = 1.3 + rand(320 + i) * 1.5;
  sc.orb([Math.cos(oa) * rr, floatY + (rand(340 + i) - 0.35) * 2.1, Math.sin(oa) * rr], 0.036, "#FFE299", 0.78);
}

sc.render(ctx, S);
fx.particles.petals(ctx, 10, roseCol, 0.22);
ui.drawVignette(ctx, W, H, 0.42, false);

// Top Telemetry
ctx.fillStyle = "rgba(180,232,198,0.85)";
ctx.font = "700 " + Math.max(11, Math.round(20 * S)) + "px monospace, sans-serif";
ctx.textAlign = "left"; ctx.textBaseline = "top";
ctx.fillText("SPECIMEN // ROSA VELVET 3D", pad, pad);
ctx.textAlign = "right";
ctx.fillStyle = "rgba(210,226,218,0.65)";
ctx.fillText("ORBIT " + Math.round(((az * 180) / Math.PI + 360) % 360) + "°", W - pad, pad);

// Seamless Liquid Glass Footer Card
const footH = 166 * S;
const footY = H - pad - footH - 22 * S;
ui.drawLiquidGlass(ctx, pad, footY, innerW, footH, 28 * S, { light: false, sweep: p * 1.4 });
fx.text.wordStagger(ctx, String(P.brand || "Seflorner") + " · Botanical Study", pad + 32 * S, footY + 34 * S, innerW - 64 * S, Math.round(44 * S), "#FFFFFF", 4, "left");
fx.text.typewriter(ctx, String(P.subtitle || "36 KELOPAK SPIRAL · SUDUT EMAS 137.5°"), pad + 32 * S, footY + 102 * S, Math.round(21 * S), "#9DE0B8", ui.seg(p, 0.12, 0.74), true);
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, roseCol, "rgba(255,255,255,0.14)");
"""

    const val CUTE_STORY = """/*<studio-meta>
{
  "schemaVersion": 5,
  "title": "Illustrated Botanical Story",
  "defaultDurationSeconds": 10,
  "seed": 55,
  "props": [
    {"key":"line1","label":"Cerita Bab 1","type":"text","default":"Mulai dari satu pot mungil di rumah."},
    {"key":"line2","label":"Cerita Bab 2","type":"text","default":"Siram sabar setiap pagi sampai mekar!"},
    {"key":"accent","label":"Warna Daun","type":"color","default":"#2B9B5E"},
    {"key":"flower","label":"Warna Bunga","type":"color","default":"#FF6B7A"}
  ],
  "audio": {
    "ambience": "warm_pad",
    "ambienceVolume": 0.15,
    "cues": [
      {"p": 0.02, "sfx": "felt_pluck", "gain": 0.78, "pitch": 1.0},
      {"p": 0.22, "sfx": "water_drop", "gain": 0.78, "pitch": 1.02},
      {"p": 0.34, "sfx": "water_drop", "gain": 0.72, "pitch": 1.18},
      {"p": 0.48, "sfx": "air_whoosh", "gain": 0.80},
      {"p": 0.66, "sfx": "felt_pluck", "gain": 0.78, "pitch": 1.25},
      {"p": 0.80, "sfx": "crystal_bloom", "gain": 0.88}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#2B9B5E");
const flowerCol = String(P.flower || "#FF6B7A");
const ink = "#1E2D24";
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;

function drawCuteFace(x, y, r, happy) {
  ctx.save(); ctx.translate(x, y);
  const blink = (t % 3.2) > 3.04;
  ctx.fillStyle = "rgba(255,120,140,0.42)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.48, r * 0.16, r * 0.18, r * 0.11, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.48, r * 0.16, r * 0.18, r * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = Math.max(2, r * 0.10); ctx.lineCap = "round";
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    if (blink || happy) { ctx.arc(s * r * 0.34, 0, r * 0.14, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else { ctx.arc(s * r * 0.34, -r * 0.04, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
  });
  ctx.beginPath(); ctx.arc(0, r * 0.10, r * 0.20, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.restore();
}

function drawPlantHero(growP, bloomP, showDrops) {
  const cx = W * 0.5;
  const potY = H * 0.77;
  const potW = 280 * S, potH = 210 * S;
  const soilY = potY - potH + 14 * S;

  // Ground shadow & wooden ledge
  ctx.fillStyle = "#E8C6A2";
  ctx.fillRect(0, potY - 10 * S, W, H - potY + 20 * S);
  ctx.strokeStyle = ink; ctx.lineWidth = 3 * S;
  ctx.beginPath(); ctx.moveTo(0, potY - 10 * S); ctx.lineTo(W, potY - 10 * S); ctx.stroke();

  // Growing curved stem + 2 fluttering leaves
  if (growP > 0.02) {
    const sh = 350 * S * growP;
    const sway = Math.sin(t * 2.5) * 16 * S * growP;
    const tipX = cx + sway, tipY = soilY - sh;
    ctx.strokeStyle = ink; ctx.lineWidth = 15 * S; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, soilY); ctx.quadraticCurveTo(cx - sway * 0.4, soilY - sh * 0.5, tipX, tipY); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 10 * S;
    ctx.beginPath(); ctx.moveTo(cx, soilY); ctx.quadraticCurveTo(cx - sway * 0.4, soilY - sh * 0.5, tipX, tipY); ctx.stroke();

    // 2 cute leaves
    [-1, 1].forEach((side, idx) => {
      const lu = 0.42 + idx * 0.20;
      const lx = ui.lerp(cx, tipX, lu), ly = ui.lerp(soilY, tipY, lu);
      const ls = ease.outBack(ui.seg(growP, 0.25 + idx * 0.15, 0.85));
      if (ls > 0.02) {
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(side > 0 ? -0.65 : -2.48);
        ctx.fillStyle = idx === 0 ? accent : "#52C488"; ctx.strokeStyle = ink; ctx.lineWidth = 2.8 * S;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(50 * S * ls, -34 * S * ls, 102 * S * ls, 0);
        ctx.quadraticCurveTo(50 * S * ls, 34 * S * ls, 0, 0); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    });

    // Blooming happy flower
    if (bloomP > 0.02) {
      ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(Math.sin(t * 2.2) * 0.07);
      const bp = ease.outBack(bloomP);
      ctx.strokeStyle = ink; ctx.lineWidth = 3 * S;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8 + t * 0.3;
        ctx.fillStyle = i % 2 === 0 ? flowerCol : "#FFA0AC";
        ctx.beginPath(); ctx.arc(Math.cos(a) * 48 * S * bp, Math.sin(a) * 48 * S * bp, 31 * S * bp, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = "#FFD166";
      ctx.beginPath(); ctx.arc(0, 0, 42 * S * bp, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      drawCuteFace(0, 2 * S, 34 * S * bp, true);
      ctx.restore();
    }
  }

  // Animated water droplets in Scene 1
  if (showDrops) {
    for (let i = 0; i < 3; i++) {
      const du = (t * 0.95 + i * 0.33) % 1;
      const dx = cx + (i - 1) * 58 * S;
      const dy = ui.lerp(H * 0.34, soilY - 12 * S, ease.inQuad(du));
      ctx.save(); ctx.globalAlpha = Math.sin(du * Math.PI);
      ui.drawWaterDrop(ctx, dx, dy, 22 * S, "#5AC8FA");
      ctx.restore();
    }
  }

  // Cute Terracotta Pot
  ctx.save(); ctx.translate(cx, potY);
  ctx.fillStyle = "#D66B43"; ctx.strokeStyle = ink; ctx.lineWidth = 3.4 * S;
  ctx.beginPath();
  ctx.moveTo(-potW * 0.42, -potH + 22 * S); ctx.lineTo(potW * 0.42, -potH + 22 * S);
  ctx.lineTo(potW * 0.32, 0); ctx.lineTo(-potW * 0.32, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ui.rrect(ctx, -potW * 0.5, -potH, potW, 34 * S, 14 * S); ctx.fill(); ctx.stroke();
  drawCuteFace(0, -potH * 0.36, 44 * S, bloomP > 0.3);
  ctx.restore();
}

function drawPart1(sp) {
  const cState = fx.cameraRig(sp, [{ p: 0, x: 0, y: -14 * S, zoom: 1.07, rot: 0 }, { p: 1, x: 0, y: 12 * S, zoom: 1.0, rot: 0 }], 3 * S);
  ui.drawMeshBg(ctx, W, H, "#FFF7EA", [
    { x: 0.84, y: 0.14, r: 0.70, col: "#FFD166", a: 0.38 },
    { x: 0.16, y: 0.80, r: 0.65, col: accent, a: 0.22 }
  ], t);
  ctx.save(); cam.apply(ctx, cState, 1.0);
  drawPlantHero(ease.apple(ui.seg(sp, 0.25, 0.95)) * 0.38, 0, true);
  ui.drawLiquidGlass(ctx, pad, pad + 34 * S, innerW, 215 * S, 28 * S, { light: true, sweep: sp });
  fx.text.wordStagger(ctx, String(P.line1 || "Mulai dari satu pot mungil di rumah."), pad + 32 * S, pad + 72 * S, innerW - 64 * S, Math.round(48 * S), ink, 2, "left");
  ctx.restore();
}

function drawPart2(sp) {
  const cState = fx.cameraRig(sp, [{ p: 0, x: 0, y: 12 * S, zoom: 1.06, rot: 0 }, { p: 1, x: 0, y: -8 * S, zoom: 1.0, rot: 0 }], 3 * S);
  ui.drawMeshBg(ctx, W, H, "#EEFBF2", [
    { x: 0.50, y: 0.44, r: 0.78, col: accent, a: 0.26 },
    { x: 0.82, y: 0.18, r: 0.56, col: flowerCol, a: 0.22 }
  ], t);
  ctx.save(); cam.apply(ctx, cState, 1.0);
  drawPlantHero(ui.lerp(0.38, 1.0, ease.apple(ui.seg(sp, 0.0, 0.55))), ui.seg(sp, 0.24, 0.76), false);
  ui.drawLiquidGlass(ctx, pad, pad + 34 * S, innerW, 215 * S, 28 * S, { light: true, sweep: sp });
  fx.text.wordStagger(ctx, String(P.line2 || "Siram sabar setiap pagi sampai mekar!"), pad + 32 * S, pad + 72 * S, innerW - 64 * S, Math.round(48 * S), ink, Math.round(fps * 4.8), "left");
  fx.particles.confetti(ctx, 24, [flowerCol, "#FFD166", accent, "#56CFE1"], ui.seg(sp, 0.32, 0.62));
  ctx.restore();
}

if (p < 0.45) drawPart1(ui.seg(p, 0.0, 0.55));
else if (p < 0.55) fx.transition.liquidWipe(ctx, ui.seg(p, 0.45, 0.55), () => drawPart1(ui.seg(p, 0.0, 0.55)), () => drawPart2(ui.seg(p, 0.45, 1.0)));
else drawPart2(ui.seg(p, 0.45, 1.0));
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, accent, "rgba(29,44,34,0.14)");
"""
}
