package app.codetovideo.studio.core

object StudioTemplates {
    const val CHARACTER_STORY_3D = """/*<studio-meta>
{
  "schemaVersion": 9,
  "title": "3D Character Story · Little Botanist",
  "defaultDurationSeconds": 15,
  "seed": 91,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"act1Text","label":"Cerita Bab 1","type":"text","default":"Halo! Yuk rawat satu tunas kecil hari ini."},
    {"key":"act2Text","label":"Cerita Bab 2","type":"text","default":"Beri air secukupnya & cahaya pagi yang hangat."},
    {"key":"act3Text","label":"Cerita Bab 3","type":"text","default":"Rawat dengan sabar, mekarnya bikin bahagia!"},
    {"key":"roseColor","label":"Warna Mawar","type":"color","default":"#E03A58"},
    {"key":"overallColor","label":"Warna Baju","type":"color","default":"#2B8A56"}
  ],
  "audio": {
    "ambience": "lofi_garden",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.01, "sfx": "swoosh_soft", "gain": 0.48},
      {"p": 0.06, "sfx": "kalimba_note", "gain": 0.54, "pitch": 1.0},
      {"p": 0.34, "sfx": "air_whoosh", "gain": 0.52},
      {"p": 0.44, "sfx": "water_drop", "gain": 0.56, "pitch": 1.0},
      {"p": 0.53, "sfx": "water_drop", "gain": 0.52, "pitch": 1.15},
      {"p": 0.68, "sfx": "whip", "gain": 0.52},
      {"p": 0.76, "sfx": "kalimba_note", "gain": 0.56, "pitch": 1.25},
      {"p": 0.84, "sfx": "crystal_bloom", "gain": 0.58}
    ]
  }
}
</studio-meta>*/

const roseCol = String(P.roseColor || "#E03A58");
const overallCol = String(P.overallColor || "#2B8A56");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const isWide = W > H * 1.15;

ui.drawMeshBg(ctx, W, H, "#F4F6EF", [
  { x: 0.82, y: 0.16, r: 0.78, col: "#FFE09E", a: 0.38 },
  { x: 0.18, y: 0.80, r: 0.72, col: "#AEE4C2", a: 0.30 }
], t);

const act = p < 0.34 ? 0 : (p < 0.68 ? 1 : 2);
const actP = act === 0 ? ui.seg(p, 0.0, 0.34) : (act === 1 ? ui.seg(p, 0.34, 0.68) : ui.seg(p, 0.68, 1.0));

const sc = g3d.scene({
  fov: 0.66,
  ambient: 0.52,
  keyColor: "#FFFDF7",
  fillColor: "#D6ECFF",
  fogColor: "#F4F6EF",
  fogNear: 12,
  fogFar: 26
});

const distK = isWide ? 1.0 : 1.24;
if (act === 0) {
  sc.orbit(-0.28 + actP * 0.38, 0.22, 6.2 * distK, [0, 0.68, 0]);
} else if (act === 1) {
  sc.orbit(0.32 + actP * 0.45, 0.30, 5.2 * distK, [0.22, 0.58, 0.1]);
} else {
  sc.orbit(-0.35 + actP * 1.15, 0.20 + Math.sin(actP * Math.PI) * 0.14, 5.8 * distK, [0.05, 0.75, 0]);
}

const island = sc.node({ pos: [0, 0, 0] });
island.lathe([
  [0.0, -1.15], [1.15, -0.78], [2.15, -0.22], [2.25, -0.04], [2.20, 0.0], [0.0, 0.0]
], [0, 0, 0], [0, 0, 0], { color: "#7C5E4A", color2: "#4DAA68", roughness: 0.72 }, 36);

for (let i = 0; i < 5; i++) {
  const sa = i * 1.25 + 0.6;
  const sr = 1.65 + (i % 2) * 0.22;
  island.ellipsoid([Math.cos(sa) * sr, 0.04, Math.sin(sa) * sr], [0.16, 0.09, 0.13], [0, sa, 0], {
    color: i % 2 === 0 ? "#B8B2A8" : "#969C92", roughness: 0.75
  }, 16);
}

const charPose = act === 0 ? "wave" : (act === 1 ? "idle" : "joy");
const botanist = g3d.stylizedCharacter(island, {
  pos: [-0.72, 0, 0.18],
  rot: [0, act === 0 ? 0.32 : 0.78, 0],
  scale: 0.96,
  pose: charPose,
  overallColor: overallCol,
  headYaw: act === 0 ? Math.sin(t * 2) * 0.15 : 0.12,
  headPitch: act === 1 ? 0.18 : -0.04,
  headRoll: Math.sin(t * 2.5) * 0.06
});

if (act === 1) {
  const tilt = Math.sin(actP * Math.PI) * 0.58;
  const canNode = botanist.torso.node({ pos: [0.46, 0.02, 0.34], rot: [0.45 + tilt, 0.2, -0.2] });
  canNode.cylinder([0, 0, 0], 0.16, 0.15, 0.28, [0, 0, 0], { color: "#3BA8D8", color2: "#7AD4F5", roughness: 0.25, metalness: 0.15 }, 24);
  canNode.cylinder([0, 0.12, 0.22], 0.028, 0.045, 0.32, [0.95, 0, 0], { color: "#3BA8D8", roughness: 0.25 }, 16);
  canNode.sphere([0, 0.22, 0.36], 0.055, { color: "#F5C85C", roughness: 0.3, metalness: 0.4 }, 16);
  for (let d = 0; d < 4; d++) {
    const du = (t * 1.8 + d * 0.25) % 1;
    island.ellipsoid([0.52 + (d - 1.5) * 0.06, ui.lerp(0.88, 0.44, du * du), 0.12], [0.026, 0.045, 0.026], [0, 0, 0], {
      color: "#5AC8FA", roughness: 0.1, alpha: 0.85
    }, 12);
  }
}

const potNode = island.node({ pos: [0.68, 0, -0.05] });
potNode.shadow([0, 0.005, 0], 0.54, 0.54, 0.32);
potNode.lathe([
  [0.0, 0.0], [0.34, 0.0], [0.44, 0.44], [0.50, 0.46],
  [0.50, 0.56], [0.42, 0.56], [0.40, 0.49], [0.0, 0.50]
], [0, 0, 0], [0, 0, 0], { color: "#8C3E26", color2: "#D46A44", roughness: 0.62 }, 32);
potNode.ellipsoid([0, 0.50, 0], [0.39, 0.05, 0.39], [0, 0, 0], { color: "#3B261D", roughness: 0.9 }, 20);

const growP = ui.lerp(0.28, 1.0, ease.apple(ui.seg(p, 0.36, 0.76)));
const bloomP = ease.apple(ui.seg(p, 0.62, 0.90));
const stemTopY = 0.50 + growP * 0.72;
potNode.tube([[0, 0.48, 0], [0.03, (0.48 + stemTopY) * 0.5, 0.02], [0, stemTopY, 0]], 0.036, 0.026, {
  color: "#1B6B3E", color2: "#34C759", roughness: 0.42, sss: 0.25
}, 14);

for (let i = 0; i < 2; i++) {
  const ly = 0.52 + growP * (0.28 + i * 0.18);
  potNode.leaf([0, ly, 0], [0.35, i * 2.8 + 0.5, 0], 0.44 * growP, 0.20 * growP, 0.08, {
    color: "#228B4E", color2: "#56D888", roughness: 0.32, sss: 0.32
  });
}

const golden = 2.399963229728653;
for (let i = 0; i < 24; i++) {
  const lay = i / 23;
  const pb = ease.snap(ui.seg(bloomP, (1 - lay) * 0.28, 0.72 + (1 - lay) * 0.28));
  const ang = i * golden;
  const rad = ui.lerp(0.02, 0.20, Math.pow(lay, 0.9)) * growP;
  const pW = ui.lerp(0.14, 0.36, lay) * growP;
  const pH = ui.lerp(0.22, 0.46, lay) * growP;
  const pitch = ui.lerp(0.12, 0.25 + 0.68 * lay, pb);
  potNode.petal([Math.sin(ang) * rad, stemTopY + (1 - lay) * 0.12 * growP, Math.cos(ang) * rad], [pitch, ang, 0], pW, pH, 0.06, 0.08 * pb, {
    color: lay < 0.4 ? "#6B1228" : roseCol,
    color2: lay < 0.4 ? roseCol : "#FF96AE",
    roughness: 0.38, sss: 0.45
  });
}

sc.render(ctx);

if (act === 2) {
  fx.particles.confetti(ctx, 22, [roseCol, "#FFD166", overallCol, "#5AC8FA"], ui.seg(actP, 0.18, 0.55));
}

const storyTexts = [
  String(P.act1Text || "Halo! Yuk rawat satu tunas kecil hari ini."),
  String(P.act2Text || "Beri air secukupnya & cahaya pagi yang hangat."),
  String(P.act3Text || "Rawat dengan sabar, mekarnya bikin bahagia!")
];
const tags = ["BAB 01 · SAPA", "BAB 02 · SIRAM", "BAB 03 · MEKAR"];
const cardH = (isWide ? 168 : 224) * S;
const cardY = pad + 18 * S;
const cIn = ease.snap(ui.seg(actP, 0.0, 0.16));

ctx.save();
ctx.globalAlpha = cIn;
ctx.translate(0, (1 - cIn) * -28 * S);
ui.drawLiquidGlass(ctx, pad, cardY, innerW, cardH, 28 * S, { light: true, sweep: (actP * 1.3) % 1 });
ui.drawPill(ctx, pad + 28 * S, cardY + 24 * S, tags[act], ui.rgba(overallCol, 0.14), overallCol, Math.max(11, Math.round(19 * S)));
fx.text.wordStagger(ctx, storyTexts[act], pad + 28 * S, cardY + 74 * S, innerW - 56 * S, Math.round((isWide ? 36 : 42) * S), "#142018", Math.round(act * (D / 3) * fps) + 2, "left");
ctx.restore();

ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, overallCol, "rgba(20,32,24,0.14)");
"""

    const val CHROME_3D_GPU = """/*<studio-meta>
{
  "schemaVersion": 8,
  "title": "3D GPU Chrome Monolith",
  "defaultDurationSeconds": 10,
  "seed": 88,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Render Video Code"},
    {"key":"headline","label":"Judul","type":"text","default":"Real-time GPU"},
    {"key":"accentWord","label":"Kata Aksen","type":"text","default":"3D Engine."},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#4AA3FF"}
  ],
  "audio": {
    "ambience": "keynote_pulse",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.01, "sfx": "air_whoosh", "gain": 0.54},
      {"p": 0.12, "sfx": "taptic_thock", "gain": 0.52, "pitch": 1.0},
      {"p": 0.34, "sfx": "glass_tap", "gain": 0.46, "pitch": 1.08},
      {"p": 0.52, "sfx": "swoosh_soft", "gain": 0.52},
      {"p": 0.82, "sfx": "crystal_bloom", "gain": 0.58}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#4AA3FF");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const isWide = W > H * 1.15;

// 1. Studio Depth Backdrop (2D Layer behind GPU 3D)
ui.drawMeshBg(ctx, W, H, "#06090F", [
  { x: 0.78, y: 0.18, r: 0.80, col: accent, a: 0.28 },
  { x: 0.18, y: 0.78, r: 0.74, col: "#C8DCF2", a: 0.16 }
], t);
ui.drawGrid(ctx, W, H, 130 * S, "rgba(255,255,255,0.032)");

// 2. Real GPU WebGL 3D Scene (Hardware Z-Buffer + Smooth PBR HDRI Reflections)
const introSp = spring({ frame, fps, config: { damping: 16, stiffness: 110 } });
const az = -0.65 + ease.smooth(p) * Math.PI * 2.1;
const elev = 0.22 + Math.sin(p * Math.PI * 1.5) * 0.28;
const dist = (isWide ? 5.8 : 7.6) - Math.sin(p * Math.PI) * 1.25;
const floatY = Math.sin(t * 1.5) * 0.12;

const sc = g3d.scene({
  fov: 0.68,
  ambient: 0.38,
  keyColor: "#FFFDF8",
  fillColor: "#A6D0FF",
  fogColor: "#06090F",
  fogNear: 9.5,
  fogFar: 22.0
});
sc.orbit(az, elev, dist, [0, 0.25, 0]);

// Floating Titanium Core Slab (beveled feel via layered plates)
const slabSpin = t * 0.42;
const slabScale = ui.clamp(introSp, 0.05, 1.05);
sc.box([0, 0.25 + floatY, 0], [1.35 * slabScale, 2.05 * slabScale, 0.26 * slabScale], [0.12 * Math.sin(t), slabSpin, 0.08 * Math.cos(t)], {
  color: "#1B2330", color2: "#3A4960", roughness: 0.16, metalness: 0.92, rim: 0.85, rimColor: "#E8F3FF"
});
// Glowing Accent Core Bar embedded cleanly
sc.box([0, 0.25 + floatY, 0], [0.22 * slabScale, 1.32 * slabScale, 0.30 * slabScale], [0.12 * Math.sin(t), slabSpin, 0.08 * Math.cos(t)], {
  color: accent, color2: "#FFFFFF", roughness: 0.12, metalness: 0.45, emissive: accent, rim: 0.9
});

// 2 Counter-Rotating Chrome Gyro Rings
sc.torus([0, 0.25 + floatY, 0], 1.72 * slabScale, 0.055, [0.65 + t * 0.45, t * 0.35, 0.2], {
  color: "#E8EFF8", color2: "#9FB4CE", roughness: 0.09, metalness: 0.98, rim: 0.95
}, 48, 20);
sc.torus([0, 0.25 + floatY, 0], 2.15 * slabScale, 0.036, [-0.52 - t * 0.32, -t * 0.48, 0.45], {
  color: accent, color2: "#FFFFFF", roughness: 0.14, metalness: 0.88, rim: 0.85
}, 48, 18);

// 4 Orbiting Chrome & Glass Satellite Spheres
for (let i = 0; i < 4; i++) {
  const oa = i * Math.PI * 0.5 + t * 0.65;
  const rOrb = (i % 2 === 0 ? 1.72 : 2.15) * slabScale;
  const sx = Math.cos(oa) * rOrb;
  const sy = 0.25 + floatY + Math.sin(oa * 2 + i) * 0.55;
  const sz = Math.sin(oa) * rOrb;
  sc.sphere([sx, sy, sz], (i % 2 === 0 ? 0.18 : 0.13) * slabScale, {
    color: i % 2 === 0 ? "#F5F8FC" : accent,
    roughness: 0.08, metalness: i % 2 === 0 ? 0.98 : 0.5, rim: 0.95
  }, 24);
}

// Translucent Liquid Glass Shield Ring (alpha-sorted!)
sc.torus([0, 0.25 + floatY, 0], 1.25 * slabScale, 0.18, [Math.PI * 0.5 + Math.sin(t * 0.8) * 0.25, t * 0.3, 0], {
  color: "#D8ECFF", color2: "#FFFFFF", roughness: 0.10, metalness: 0.20, rim: 1.1, rimColor: "#FFFFFF", alpha: 0.36
}, 40, 20);

sc.render(ctx);

// 3. Foreground Depth Bokeh + Cinematic Vignette + Liquid Glass Editorial Overlay
fx.particles.bokeh(ctx, 12, accent, 0.14);
ui.drawVignette(ctx, W, H, 0.38, false);

// Top Telemetry Header
ctx.fillStyle = "rgba(218,234,250,0.88)";
ctx.font = "700 " + Math.max(11, Math.round(20 * S)) + "px monospace, sans-serif";
ctx.textAlign = "left"; ctx.textBaseline = "top";
ctx.fillText("WEBGL PBR // HARDWARE Z-BUFFER", pad, pad);
ctx.textAlign = "right"; ctx.fillStyle = "rgba(170,192,216,0.68)";
ctx.fillText("AZ " + Math.round(((az * 180) / Math.PI + 360) % 360) + "° · 60Hz", W - pad, pad);

// Floating Liquid Glass Editorial Footer
const footH = (isWide ? 172 : 228) * S;
const footY = H - pad - footH - 22 * S;
const fSp = fx.stagger(frame, 1, 5);
ctx.save();
ctx.globalAlpha = ui.clamp(fSp * 1.25, 0, 1);
ctx.translate(0, (1 - fSp) * 44 * S);
ui.drawLiquidGlass(ctx, pad, footY, innerW, footH, 28 * S, { light: false, sweep: (p * 1.45) % 1 });

const hSize = Math.round((isWide ? 48 : 56) * S);
ui.drawRichText(ctx, [
  { text: String(P.headline || "Real-time GPU") },
  { text: String(P.accentWord || "3D Engine."), italic: true, color: accent }
], pad + 32 * S, footY + 30 * S, innerW - 64 * S, hSize, hSize * 1.15, "#FFFFFF", ui.seg(p, 0.06, 0.42), "left");

ctx.fillStyle = "rgba(210,224,240,0.72)";
ctx.font = "600 " + Math.max(12, Math.round(22 * S)) + "px monospace, sans-serif";
ctx.textAlign = "left"; ctx.textBaseline = "bottom";
ctx.fillText(String(P.brand || "Render Video Code").toUpperCase() + " · V0.8", pad + 32 * S, footY + footH - 28 * S);
ctx.restore();

ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, accent, "rgba(255,255,255,0.14)");
"""

    const val BOTANICAL_3D = """/*<studio-meta>
{
  "schemaVersion": 8,
  "title": "3D GPU Velvet Rose Cinema",
  "defaultDurationSeconds": 10,
  "seed": 77,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"subtitle","label":"Catatan Botani","type":"text","default":"36 KELOPAK PBR GPU · SUDUT EMAS 137.5°"},
    {"key":"roseColor","label":"Warna Mawar","type":"color","default":"#D62849"},
    {"key":"potColor","label":"Warna Pot","type":"color","default":"#C86440"},
    {"key":"leafColor","label":"Warna Daun","type":"color","default":"#257E4E"}
  ],
  "audio": {
    "ambience": "botanical_air",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.01, "sfx": "swoosh_soft", "gain": 0.50},
      {"p": 0.24, "sfx": "bloom", "gain": 0.52},
      {"p": 0.62, "sfx": "glass_shimmer", "gain": 0.42, "pitch": 1.04},
      {"p": 0.84, "sfx": "chime", "gain": 0.50}
    ]
  }
}
</studio-meta>*/

const roseCol = String(P.roseColor || "#D62849");
const potCol = String(P.potColor || "#C86440");
const leafCol = String(P.leafColor || "#257E4E");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const isWide = W > H * 1.15;

// 1. Deep Forest Studio Backdrop + Soft Volumetric Ray
ui.drawMeshBg(ctx, W, H, "#040A07", [
  { x: 0.50, y: 0.38, r: 0.74, col: roseCol, a: 0.24 },
  { x: 0.16, y: 0.82, r: 0.66, col: leafCol, a: 0.20 }
], t);

ctx.save();
const ray = ctx.createLinearGradient(W * 0.88, 0, W * 0.25, H * 0.80);
ray.addColorStop(0, "rgba(255,244,215,0.08)");
ray.addColorStop(1, "rgba(0,0,0,0)");
ctx.fillStyle = ray;
ctx.beginPath();
ctx.moveTo(W * 0.55, 0); ctx.lineTo(W, 0); ctx.lineTo(W * 0.64, H * 0.85); ctx.lineTo(W * 0.14, H * 0.85);
ctx.closePath(); ctx.fill();
ctx.restore();

// 2. Real GPU WebGL 3D Sculpted Rose + Smooth 36-Side Terracotta Pot!
const az = -0.50 + ease.smooth(p) * Math.PI * 2.1;
const elev = 0.18 + Math.sin(p * Math.PI) * 0.38;
const dist = (isWide ? 4.8 : 6.4) - Math.sin(p * Math.PI) * 1.15;
const floatY = Math.sin(t * 1.35) * 0.06;

const sc = g3d.scene({
  fov: 0.68,
  ambient: 0.36,
  keyColor: "#FFF8EE",
  fillColor: "#BFE8D0",
  fogColor: "#040A07",
  fogNear: 10,
  fogFar: 22
});
sc.orbit(az, elev, dist, [0, 0.32 + floatY * 0.3, 0]);

// Smooth 36-side Sculpted Terracotta Pot + Soil Mound (ZERO Z-fighting!)
const potProfile = [
  [0.0, -1.65], [0.58, -1.65], [0.76, -0.82], [0.88, -0.78],
  [0.89, -0.60], [0.74, -0.60], [0.71, -0.70], [0.0, -0.66]
];
sc.lathe(potProfile, [0, floatY, 0], [0, 0, 0], {
  color: "#6E331F", color2: potCol, roughness: 0.64, metalness: 0.04, rim: 0.35
}, 36);
sc.ellipsoid([0, floatY - 0.72, 0], [0.68, 0.14, 0.68], [0, 0, 0], { color: "#2D1D16", color2: "#4A3125", roughness: 0.92, metalness: 0.0, rim: 0.1 }, 20);

// Smooth Curved Botanical Stem (GPU Tube)
const stemPts = [];
for (let k = 0; k <= 10; k++) {
  const u = k / 10;
  stemPts.push([
    Math.sin(u * Math.PI * 0.85) * 0.09 + Math.sin(t * 1.6) * 0.03 * u * u,
    floatY - 0.68 + u * 1.38,
    Math.cos(u * Math.PI * 0.6) * 0.04 - 0.04
  ]);
}
sc.tube(stemPts, 0.062, 0.044, { color: "#144A2B", color2: leafCol, roughness: 0.42, sss: 0.25, rim: 0.35 }, 16);

const head = stemPts[stemPts.length - 1];
const bloom = ease.apple(ui.seg(p, 0.04, 0.70));

// 4 Smooth Curved 3D Leaves along the stem
for (let i = 0; i < 4; i++) {
  const pt = stemPts[3 + i * 2];
  const ang = i * 1.62 + 0.4;
  sc.leaf(pt, [0.35 + Math.sin(t * 2 + i) * 0.04, ang, 0], 0.78, 0.34, 0.14, {
    color: "#154D2E", color2: "#4CC482", roughness: 0.28, metalness: 0.05, sss: 0.32, rim: 0.45
  });
}

// 5 Green Sepals beneath rose head
for (let i = 0; i < 5; i++) {
  const a = (i * Math.PI * 2) / 5 + 0.3;
  sc.petal(head, [ui.lerp(0.6, 1.35, bloom), a, 0], 0.22, 0.52, 0.04, 0.05, {
    color: "#154A2C", color2: leafCol, roughness: 0.42, sss: 0.24
  });
}

// 36 Smooth GPU Velvet Petals (Golden Angle 137.5° + Subsurface Scattering!)
const golden = 2.399963229728653;
const totalP = 36;
for (let i = 0; i < totalP; i++) {
  const lay = i / (totalP - 1);
  const pb = ease.snap(ui.seg(bloom, (1 - lay) * 0.30, 0.70 + (1 - lay) * 0.30));
  const ang = i * golden;
  const rad = ui.lerp(0.04, 0.34, Math.pow(lay, 0.9));
  const by = ui.lerp(0.22, 0.0, lay);
  const pW = ui.lerp(0.24, 0.62, Math.pow(lay, 0.78));
  const pH = ui.lerp(0.36, 0.78, Math.pow(lay, 0.72));
  const pitch = ui.lerp(ui.lerp(0.10, 0.30, lay), ui.lerp(0.18, 0.92, Math.pow(lay, 1.12)), pb);
  const px = head[0] + Math.sin(ang) * rad;
  const pz = head[2] + Math.cos(ang) * rad;
  sc.petal([px, head[1] + by, pz], [pitch, ang, 0], pW, pH, ui.lerp(0.06, 0.15, lay), ui.lerp(0.02, 0.16, lay) * pb, {
    color: lay < 0.42 ? "#540E20" : roseCol,
    color2: lay < 0.42 ? roseCol : "#FF96AE",
    roughness: 0.38, metalness: 0.04, sss: 0.48, rim: 0.55, rimColor: "#FFD4DF"
  });
}

// Golden Orbit Ring & Glowing Pollen Spheres
sc.torus([0, floatY + 0.25, 0], 1.85, 0.015, [0.36, t * 0.3, -0.18], {
  color: "#F5D284", roughness: 0.15, metalness: 0.92, rim: 0.7, alpha: 0.65
}, 48, 12);

for (let i = 0; i < 12; i++) {
  const oa = rand(300 + i) * Math.PI * 2 + t * 0.35;
  const rr = 1.2 + rand(320 + i) * 1.4;
  sc.sphere([Math.cos(oa) * rr, floatY + (rand(340 + i) - 0.3) * 2.0, Math.sin(oa) * rr], 0.032, {
    color: "#FFE7A8", emissive: "#FFD166", roughness: 0.2, rim: 0.8
  }, 10);
}

sc.render(ctx);

// 3. Foreground Petals + Vignette + Editorial Overlay
fx.particles.petals(ctx, 10, roseCol, 0.22);
ui.drawVignette(ctx, W, H, 0.40, false);

ctx.fillStyle = "rgba(180,232,198,0.86)";
ctx.font = "700 " + Math.max(11, Math.round(20 * S)) + "px monospace, sans-serif";
ctx.textAlign = "left"; ctx.textBaseline = "top";
ctx.fillText("WEBGL PBR // ROSA VELVET 3D", pad, pad);
ctx.textAlign = "right"; ctx.fillStyle = "rgba(210,226,218,0.65)";
ctx.fillText("ORBIT " + Math.round(((az * 180) / Math.PI + 360) % 360) + "°", W - pad, pad);

const footH = 166 * S;
const footY = H - pad - footH - 22 * S;
ui.drawLiquidGlass(ctx, pad, footY, innerW, footH, 28 * S, { light: false, sweep: p * 1.4 });
fx.text.wordStagger(ctx, String(P.brand || "Seflorner") + " · Botanical 3D", pad + 32 * S, footY + 34 * S, innerW - 64 * S, Math.round(44 * S), "#FFFFFF", 4, "left");
fx.text.typewriter(ctx, String(P.subtitle || "36 KELOPAK PBR GPU · SUDUT EMAS 137.5°"), pad + 32 * S, footY + 102 * S, Math.round(21 * S), "#9DE0B8", ui.seg(p, 0.12, 0.74), true);
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, roseCol, "rgba(255,255,255,0.14)");
"""

    const val DATA_STORY = """/*<studio-meta>
{
  "schemaVersion": 8,
  "title": "Swiss Data Editorial",
  "defaultDurationSeconds": 10,
  "seed": 44,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"metric","label":"Label Grafik","type":"text","default":"PERTUMBUHAN TANAMAN"},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#23A455"}
  ],
  "audio": {
    "ambience": "documentary_pulse",
    "ambienceVolume": 0.15,
    "cues": [
      {"p": 0.01, "sfx": "swoosh_soft", "gain": 0.46},
      {"p": 0.08, "sfx": "taptic_thock", "gain": 0.50, "pitch": 1.0},
      {"p": 0.18, "sfx": "taptic_thock", "gain": 0.48, "pitch": 1.12},
      {"p": 0.45, "sfx": "air_whoosh", "gain": 0.58},
      {"p": 0.50, "sfx": "wood_tap", "gain": 0.46, "pitch": 1.04},
      {"p": 0.56, "sfx": "taptic_thock", "gain": 0.46, "pitch": 1.14},
      {"p": 0.82, "sfx": "crystal_bloom", "gain": 0.56}
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
  ctx.save(); cam.apply(ctx, cState, 0.35); ui.drawGrid(ctx, W, H, 130 * S, "rgba(255,255,255,0.032)"); ctx.restore();
  ctx.save(); cam.apply(ctx, cState, 1.0);
  const topY = isWide ? H * 0.12 : H * 0.11;
  ui.drawPill(ctx, pad, topY, String(P.metric || "PERTUMBUHAN TANAMAN"), "rgba(255,255,255,0.10)", accent, Math.max(12, Math.round(21 * S)));
  const countVal = interpolate(sp, [0.02, 0.92], [14, 98.4], { easing: ease.apple });
  fx.text.counterRoll(ctx, countVal, pad, topY + 72 * S, Math.round((isWide ? 120 : 148) * S), "#FFFFFF", "%", "left");
  ctx.fillStyle = "rgba(210,226,218,0.75)"; ctx.font = "500 " + Math.max(13, Math.round(26 * S)) + "px sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("Indeks vitalitas akar & tunas baru (30 hari)", pad, topY + (isWide ? 216 : 246) * S);
  const cardY = isWide ? H * 0.48 : H * 0.40, cardH = (isWide ? 330 : 450) * S;
  ui.drawLiquidGlass(ctx, pad, cardY, innerW, cardH, 30 * S, { light: false, sweep: sp * 1.3 });
  fx.chart.spline(ctx, [16, 24, 29, 44, 56, 62, 81, 98], pad + 38 * S, cardY + 62 * S, innerW - 76 * S, cardH - 120 * S, accent, ui.seg(sp, 0.06, 0.88));
  if (!isWide) {
    const miniY = cardY + cardH + 34 * S, miniW = (innerW - 24 * S) * 0.5, miniH = 158 * S;
    const stats = [
      { k: "KELEMBAPAN", v: Math.round(ui.lerp(42, 74, ease.apple(sp))) + "%", c: "#6CC4FF" },
      { k: "CAHAYA OPTIMAL", v: Math.round(ui.lerp(3, 6.8, ease.apple(sp)) * 10) / 10 + " jam", c: "#F5C45E" }
    ];
    for (let i = 0; i < 2; i++) {
      const stP = fx.stagger(frame, i + 4, 6), mx = pad + i * (miniW + 24 * S);
      ctx.save(); ctx.globalAlpha = ui.clamp(stP * 1.3, 0, 1); ctx.translate(0, (1 - stP) * 44 * S);
      ui.drawLiquidGlass(ctx, mx, miniY, miniW, miniH, 24 * S, { light: false });
      ctx.fillStyle = "rgba(200,216,210,0.68)"; ctx.font = "700 " + Math.round(18 * S) + "px monospace, sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(stats[i].k, mx + 26 * S, miniY + 28 * S);
      ctx.fillStyle = stats[i].c; ctx.font = "800 " + Math.round(48 * S) + "px sans-serif"; ctx.fillText(stats[i].v, mx + 26 * S, miniY + 68 * S);
      ctx.restore();
    }
  }
  ctx.restore(); ui.drawVignette(ctx, W, H, 0.34, false);
}

function drawSceneB(sp) {
  const cState = fx.cameraRig(sp, [
    { p: 0.0, x: 0, y: 16 * S, zoom: 1.07, rot: 0.006 },
    { p: 0.5, x: 0, y: 0, zoom: 1.0, rot: 0.0 },
    { p: 1.0, x: 0, y: -12 * S, zoom: 1.03, rot: -0.004 }
  ], 3.5 * S);
  ui.drawMeshBg(ctx, W, H, "#F4F6F2", [{ x: 0.82, y: 0.16, r: 0.72, col: accent, a: 0.22 }, { x: 0.16, y: 0.86, r: 0.68, col: "#A9CBFF", a: 0.26 }], t);
  ctx.save(); cam.apply(ctx, cState, 0.35); ui.drawGrid(ctx, W, H, 130 * S, "rgba(14,20,29,0.04)"); ctx.restore();
  ctx.save(); cam.apply(ctx, cState, 1.0);
  const fS = Math.round((isWide ? 66 : 76) * S), topY = isWide ? H * 0.11 : H * 0.13;
  const used = ui.drawRichText(ctx, [{ text: "Hasil nyata dari perawatan" }, { text: "konsisten.", italic: true, color: accent }], pad, topY, innerW, fS, fS * 1.18, "#0E141D", ui.seg(sp, 0.02, 0.44), "left");
  const cardY = topY + used + 48 * S, cardH = (isWide ? 340 : 460) * S;
  ui.drawLiquidGlass(ctx, pad, cardY, innerW, cardH, 30 * S, { light: true, sweep: sp * 1.2 });
  fx.chart.bars(ctx, [
    { value: 0.42, label: "W1", color: "#8EA4BC" }, { value: 0.66, label: "W2", color: "#58A6E8" },
    { value: 0.84, label: "W3", color: "#36C276" }, { value: 0.98, label: "W4", color: accent }
  ], pad + 44 * S, cardY + 62 * S, innerW - 88 * S, cardH - 128 * S, Math.round(fps * 4.9), { light: true, showValues: true });
  const lockY = cardY + cardH + 64 * S;
  ui.drawRichText(ctx, [{ text: String(P.brand || "Seflorner") }, { text: ".", color: accent }], W * 0.5, lockY, innerW, Math.round(70 * S), 80 * S, "#0E141D", ui.seg(sp, 0.36, 0.80), "center");
  ctx.save(); ctx.globalAlpha = ease.apple(ui.seg(sp, 0.52, 0.86)); ctx.fillStyle = "rgba(14,20,29,0.58)";
  ctx.font = "italic 500 " + Math.round(28 * S) + "px Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText("Tumbuh terukur, mekar maksimal.", W * 0.5, lockY + 86 * S); ctx.restore(); ctx.restore();
}

if (p < 0.45) drawSceneA(ui.seg(p, 0.0, 0.55));
else if (p < 0.55) fx.transition.glassSlide(ctx, ui.seg(p, 0.45, 0.55), () => drawSceneA(ui.seg(p, 0.0, 0.55)), () => drawSceneB(ui.seg(p, 0.45, 1.0)));
else drawSceneB(ui.seg(p, 0.45, 1.0));
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, accent, "rgba(120,140,160,0.22)");
"""

    const val CUTE_STORY = """/*<studio-meta>
{
  "schemaVersion": 8,
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
    "ambience": "lofi_garden",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.02, "sfx": "kalimba_note", "gain": 0.56, "pitch": 1.0},
      {"p": 0.24, "sfx": "water_drop", "gain": 0.58, "pitch": 1.0},
      {"p": 0.36, "sfx": "water_drop", "gain": 0.54, "pitch": 1.15},
      {"p": 0.46, "sfx": "swoosh_soft", "gain": 0.58},
      {"p": 0.64, "sfx": "kalimba_note", "gain": 0.56, "pitch": 1.22},
      {"p": 0.78, "sfx": "crystal_bloom", "gain": 0.58}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#2B9B5E");
const flowerCol = String(P.flower || "#FF6B7A");
const ink = "#1E2D24", pad = Math.min(W, H) * 0.068, innerW = W - pad * 2;

function drawCuteFace(x, y, r, happy) {
  ctx.save(); ctx.translate(x, y); const blink = (t % 3.2) > 3.04;
  ctx.fillStyle = "rgba(255,120,140,0.42)"; ctx.beginPath();
  ctx.ellipse(-r * 0.48, r * 0.16, r * 0.18, r * 0.11, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.48, r * 0.16, r * 0.18, r * 0.11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = Math.max(2, r * 0.10); ctx.lineCap = "round";
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    if (blink || happy) { ctx.arc(s * r * 0.34, 0, r * 0.14, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else { ctx.arc(s * r * 0.34, -r * 0.04, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
  });
  ctx.beginPath(); ctx.arc(0, r * 0.10, r * 0.20, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.restore();
}

function drawPlantHero(growP, bloomP, showDrops) {
  const cx = W * 0.5, potY = H * 0.77, potW = 280 * S, potH = 210 * S, soilY = potY - potH + 14 * S;
  ctx.fillStyle = "#E8C6A2"; ctx.fillRect(0, potY - 10 * S, W, H - potY + 20 * S);
  ctx.strokeStyle = ink; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.moveTo(0, potY - 10 * S); ctx.lineTo(W, potY - 10 * S); ctx.stroke();
  if (growP > 0.02) {
    const sh = 350 * S * growP, sway = Math.sin(t * 2.5) * 16 * S * growP, tipX = cx + sway, tipY = soilY - sh;
    ctx.strokeStyle = ink; ctx.lineWidth = 15 * S; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, soilY); ctx.quadraticCurveTo(cx - sway * 0.4, soilY - sh * 0.5, tipX, tipY); ctx.stroke();
    ctx.strokeStyle = accent; ctx.lineWidth = 10 * S;
    ctx.beginPath(); ctx.moveTo(cx, soilY); ctx.quadraticCurveTo(cx - sway * 0.4, soilY - sh * 0.5, tipX, tipY); ctx.stroke();
    [-1, 1].forEach((side, idx) => {
      const lu = 0.42 + idx * 0.20, lx = ui.lerp(cx, tipX, lu), ly = ui.lerp(soilY, tipY, lu), ls = ease.outBack(ui.seg(growP, 0.25 + idx * 0.15, 0.85));
      if (ls > 0.02) {
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(side > 0 ? -0.65 : -2.48);
        ctx.fillStyle = idx === 0 ? accent : "#52C488"; ctx.strokeStyle = ink; ctx.lineWidth = 2.8 * S;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(50 * S * ls, -34 * S * ls, 102 * S * ls, 0);
        ctx.quadraticCurveTo(50 * S * ls, 34 * S * ls, 0, 0); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    });
    if (bloomP > 0.02) {
      ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(Math.sin(t * 2.2) * 0.07);
      const bp = ease.outBack(bloomP); ctx.strokeStyle = ink; ctx.lineWidth = 3 * S;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8 + t * 0.3; ctx.fillStyle = i % 2 === 0 ? flowerCol : "#FFA0AC";
        ctx.beginPath(); ctx.arc(Math.cos(a) * 48 * S * bp, Math.sin(a) * 48 * S * bp, 31 * S * bp, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = "#FFD166"; ctx.beginPath(); ctx.arc(0, 0, 42 * S * bp, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      drawCuteFace(0, 2 * S, 34 * S * bp, true); ctx.restore();
    }
  }
  if (showDrops) {
    for (let i = 0; i < 3; i++) {
      const du = (t * 0.95 + i * 0.33) % 1;
      ctx.save(); ctx.globalAlpha = Math.sin(du * Math.PI);
      ui.drawWaterDrop(ctx, cx + (i - 1) * 58 * S, ui.lerp(H * 0.34, soilY - 12 * S, ease.inQuad(du)), 22 * S, "#5AC8FA"); ctx.restore();
    }
  }
  ctx.save(); ctx.translate(cx, potY); ctx.fillStyle = "#D66B43"; ctx.strokeStyle = ink; ctx.lineWidth = 3.4 * S;
  ctx.beginPath(); ctx.moveTo(-potW * 0.42, -potH + 22 * S); ctx.lineTo(potW * 0.42, -potH + 22 * S);
  ctx.lineTo(potW * 0.32, 0); ctx.lineTo(-potW * 0.32, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ui.rrect(ctx, -potW * 0.5, -potH, potW, 34 * S, 14 * S); ctx.fill(); ctx.stroke();
  drawCuteFace(0, -potH * 0.36, 44 * S, bloomP > 0.3); ctx.restore();
}

function drawPart1(sp) {
  const cState = fx.cameraRig(sp, [{ p: 0, x: 0, y: -14 * S, zoom: 1.07, rot: 0 }, { p: 1, x: 0, y: 12 * S, zoom: 1.0, rot: 0 }], 3 * S);
  ui.drawMeshBg(ctx, W, H, "#FFF7EA", [{ x: 0.84, y: 0.14, r: 0.70, col: "#FFD166", a: 0.38 }, { x: 0.16, y: 0.80, r: 0.65, col: accent, a: 0.22 }], t);
  ctx.save(); cam.apply(ctx, cState, 1.0);
  drawPlantHero(ease.apple(ui.seg(sp, 0.25, 0.95)) * 0.38, 0, true);
  ui.drawLiquidGlass(ctx, pad, pad + 34 * S, innerW, 215 * S, 28 * S, { light: true, sweep: sp });
  fx.text.wordStagger(ctx, String(P.line1 || "Mulai dari satu pot mungil di rumah."), pad + 32 * S, pad + 72 * S, innerW - 64 * S, Math.round(48 * S), ink, 2, "left");
  ctx.restore();
}

function drawPart2(sp) {
  const cState = fx.cameraRig(sp, [{ p: 0, x: 0, y: 12 * S, zoom: 1.06, rot: 0 }, { p: 1, x: 0, y: -8 * S, zoom: 1.0, rot: 0 }], 3 * S);
  ui.drawMeshBg(ctx, W, H, "#EEFBF2", [{ x: 0.50, y: 0.44, r: 0.78, col: accent, a: 0.26 }, { x: 0.82, y: 0.18, r: 0.56, col: flowerCol, a: 0.22 }], t);
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
