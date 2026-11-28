package app.codetovideo.studio.core

/**
 * 4 Showcase Templates v2.1 Siap Render for Cinema Engine Pro:
 * 1. 2D Explainer & Produk (rig2D + magnifier + checklist + viral karaoke caption)
 * 2. 2D Cutaway & Swarm (world2D deep underground camera + Catmull-Rom ant colony)
 * 3. 3D Diorama Arsitektur (Three.js studio3D villa + pool + trees + cam3D spline + glass HUD)
 * 4. Liquid Glass Refraction (WebGL2 fx.glass refractive cards/lens + serif/sans kinetic type)
 */
object StudioTemplatesV21 {

    const val EXPLAINER_2D_PRODUCT = """/*<studio-meta>
{
  "schemaVersion": 21,
  "title": "2D Explainer & Produk Pro",
  "defaultDurationSeconds": 8,
  "seed": 42,
  "props": [
    {"key":"brand","label":"Nama Produk","type":"text","default":"AURA SMART CUP"},
    {"key":"headline","label":"Judul Promo","type":"text","default":"3 Alasan Wajib Punya"},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#FF3B5C"}
  ],
  "audio": {
    "ambience": "documentary_pulse",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.02, "sfx": "bubble_pop", "gain": 0.62, "pitch": 1.05},
      {"p": 0.14, "sfx": "soft_boing", "gain": 0.58, "pitch": 1.0},
      {"p": 0.34, "sfx": "checklist_ding", "gain": 0.60, "pitch": 1.0},
      {"p": 0.48, "sfx": "checklist_ding", "gain": 0.60, "pitch": 1.10},
      {"p": 0.62, "sfx": "checklist_ding", "gain": 0.62, "pitch": 1.22},
      {"p": 0.72, "sfx": "magnifier_whoosh", "gain": 0.64, "pitch": 1.0},
      {"p": 0.88, "sfx": "sparkle_chime", "gain": 0.65, "pitch": 1.0}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#FF3B5C");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;

rig2D.drawHalftoneBg(ctx, W, H, { bg: "#FFFBF2", dotColor: "rgba(255,59,92,0.12)", step: 34 * S, dotRadius: 4.5 * S });

// Header Pill + Kinetic Title
const headPop = fx.stagger(frame, 0, 3);
ctx.save();
ctx.globalAlpha = ui.clamp(headPop, 0, 1);
ctx.translate(0, (1 - headPop) * 24 * S);
ui.drawPill(ctx, pad, H * 0.08, String(P.brand || "AURA SMART CUP"), accent, "#FFFFFF", Math.round(22 * S));
ctx.fillStyle = "#0F172A";
ctx.font = "800 " + Math.round(64 * S) + "px 'Plus Jakarta Sans', sans-serif";
ctx.textAlign = "left";
ctx.textBaseline = "top";
ctx.fillText(String(P.headline || "3 Alasan Wajib Punya"), pad, H * 0.135, innerW);
ctx.restore();

// Expressive 2D Character with Squash & Stretch, Auto-Blink, Gaze LookAt & Lip-Sync
const charIn = spring({ frame: frame - 6, fps, config: { damping: 11, stiffness: 160 } });
const bounceSquash = 1 + Math.sin(t * 5.2) * 0.04;
const magX = W * 0.72, magY = H * 0.36;
rig2D.drawCharacter(ctx, {
  x: W * 0.28,
  y: H * 0.40 + (1 - charIn) * 140 * S,
  scale: 1.05 * Math.max(0.01, charIn),
  squash: bounceSquash,
  stretch: 1 / bounceSquash,
  shirtColor: "#2563EB",
  accentColor: accent,
  glasses: true,
  expression: p > 0.70 ? "excited" : (p > 0.30 ? "happy" : "thinking"),
  talk: t > 0.3 && t < 7.4,
  wave: p < 0.28,
  pointRight: p >= 0.28,
  lookAt: [magX, magY]
});

// Speech Bubble
rig2D.drawSpeechBubble(ctx, W * 0.65, H * 0.29, p < 0.45 ? "Suhu kopi pas 62°C seharian!" : "Cek detail sensornya!", {
  progress: ui.seg(p, 0.08, 0.20),
  maxW: innerW * 0.56,
  border: accent,
  tail: "bottom-left"
});

// Product Card (supports imported local asset 'produk' or draws vector smart cup)
const cardX = W * 0.54, cardY = H * 0.31, cardW = innerW * 0.44, cardH = 270 * S;
if (assets.has("produk")) {
  assets.drawImage(ctx, "produk", cardX, cardY, cardW, cardH, { radius: 28 * S, popIn: ui.seg(p, 0.12, 0.26) });
} else {
  const cp = ease.snap(ui.seg(p, 0.12, 0.26));
  ctx.save();
  ctx.globalAlpha = cp;
  ctx.fillStyle = "#1E293B";
  ui.rrect(ctx, cardX, cardY, cardW, cardH, 28 * S);
  ctx.fill();
  // Smart cup illustration inside product card
  const cx = cardX + cardW * 0.5, cy = cardY + cardH * 0.54;
  ctx.fillStyle = "#F8FAFC";
  ui.rrect(ctx, cx - 54 * S, cy - 72 * S, 108 * S, 146 * S, 24 * S);
  ctx.fill();
  ctx.fillStyle = accent;
  ui.rrect(ctx, cx - 34 * S, cy - 16 * S, 68 * S, 36 * S, 10 * S);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 " + Math.round(22 * S) + "px 'JetBrains Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("62°C", cx, cy + 2 * S);
  ctx.restore();
}

// Animated Checklist Card
const listP = ui.seg(p, 0.28, 0.72);
rig2D.drawChecklist(ctx, pad, H * 0.54, innerW, [
  "Sensor suhu presisi 0.1°C",
  "Baterai tahan 14 jam non-stop",
  "Anti-tumpah & desain titanium"
], listP, {
  title: "FITUR UNGGULAN",
  accent: "#10B981",
  light: true
});

// Magnifier Callout Zoom focusing on the temperature display!
const magIn = ease.snap(ui.seg(p, 0.68, 0.80));
if (magIn > 0.02) {
  ui.drawMagnifier(ctx, W * 0.72, H * 0.34, 118 * S * magIn, {
    srcX: cardX + cardW * 0.5,
    srcY: cardY + cardH * 0.54,
    zoom: 2.35,
    ringColor: accent,
    label: "OLED 62°C"
  });
}

// Viral Karaoke Subtitle (Preset: pill_highlight)
ui.captions(ctx, [
  { start: 0.2, end: 2.5, text: "Kenalin cara baru nikmatin kopi hangat!" },
  { start: 2.6, end: 5.3, text: "Tiga fitur pintar siap nemenin kerja kamu." },
  { start: 5.4, end: 7.8, text: "Lihat detail layar suhu super tajam ini!" }
], t, { preset: "pill_highlight", accent, yRatio: 0.87 });
"""

    const val CUTAWAY_2D_SWARM = """/*<studio-meta>
{
  "schemaVersion": 21,
  "title": "2D Cutaway & Koloni Swarm",
  "defaultDurationSeconds": 10,
  "seed": 77,
  "props": [
    {"key":"title","label":"Judul Edukasi","type":"text","default":"Kota Bawah Tanah Semut"},
    {"key":"colonyCount","label":"Jumlah Semut","type":"range","default":85,"min":20,"max":180,"step":5},
    {"key":"glowColor","label":"Cahaya Ruang","type":"color","default":"#FFCA6B"}
  ],
  "audio": {
    "ambience": "soil_nature",
    "ambienceVolume": 0.20,
    "cues": [
      {"p": 0.03, "sfx": "soft_wind_gust", "gain": 0.55, "pitch": 1.0},
      {"p": 0.22, "sfx": "soil_crunch", "gain": 0.58, "pitch": 0.95},
      {"p": 0.45, "sfx": "water_drop", "gain": 0.50, "pitch": 1.08},
      {"p": 0.68, "sfx": "soil_crunch", "gain": 0.54, "pitch": 1.05},
      {"p": 0.86, "sfx": "chime", "gain": 0.52, "pitch": 1.0}
    ]
  }
}
</studio-meta>*/

const count = Math.round(Number(P.colonyCount || 85));
const glowCol = String(P.glowColor || "#FFCA6B");
const pad = Math.min(W, H) * 0.065;

// Infinite 2D Camera diving smoothly from bright surface into underground chambers!
const camState = world2D.keyframeCamera(p, [
  { p: 0.00, x: 0, y: -380 * S, zoom: 0.95, rot: 0 },
  { p: 0.25, x: 0, y: -60 * S,  zoom: 1.05, rot: 0.01 },
  { p: 0.58, x: -90 * S, y: 340 * S, zoom: 1.24, rot: -0.012 },
  { p: 0.82, x: 110 * S, y: 660 * S, zoom: 1.30, rot: 0.01 },
  { p: 1.00, x: 0, y: 420 * S, zoom: 0.92, rot: 0 }
]);

// World-Space Deep Cutaway Scene
ctx.save();
world2D.applyCamera(ctx, camState);

// Sky above surface
const skyG = ctx.createLinearGradient(0, -1100 * S, 0, -120 * S);
skyG.addColorStop(0, "#38BDF8");
skyG.addColorStop(1, "#BAE6FD");
ctx.fillStyle = skyG;
ctx.fillRect(-1400 * S, -1100 * S, 2800 * S, 1020 * S);

// Sun glow
world2D.drawRoomLight(ctx, 260 * S, -560 * S, 280 * S, "#FEF08A", 0.72);

// Grass surface & layered organic underground textures (Topsoil -> Clay -> Deep Rock)
ctx.fillStyle = "#22C55E";
ctx.fillRect(-1400 * S, -140 * S, 2800 * S, 55 * S);
world2D.drawOrganicTexture(ctx, -1400 * S, -95 * S, 2800 * S, 420 * S, "soil", "#6E4730");
world2D.drawOrganicTexture(ctx, -1400 * S, 325 * S, 2800 * S, 440 * S, "soil", "#4B2E1E");
world2D.drawOrganicTexture(ctx, -1400 * S, 765 * S, 2800 * S, 580 * S, "rock", "#2E2522");

// Ant Hill Mound on surface
ctx.fillStyle = "#7C4D32";
ctx.beginPath();
ctx.moveTo(-210 * S, -95 * S);
ctx.quadraticCurveTo(0, -255 * S, 210 * S, -95 * S);
ctx.closePath();
ctx.fill();

// Spline Tunnel Network
const pathMain = [
  [0, -170 * S], [10 * S, 10 * S], [-160 * S, 190 * S], [-210 * S, 380 * S],
  [20 * S, 520 * S], [190 * S, 680 * S], [110 * S, 860 * S]
];
const pathBranch = [
  [10 * S, 10 * S], [190 * S, 160 * S], [240 * S, 350 * S], [20 * S, 520 * S]
];
const pathDeep = [
  [-210 * S, 380 * S], [-280 * S, 610 * S], [-80 * S, 780 * S], [110 * S, 860 * S]
];

world2D.drawTunnel(ctx, pathMain, 72 * S, { rimColor: "#1E110A", fillColor: "#3A2215" });
world2D.drawTunnel(ctx, pathBranch, 58 * S, { rimColor: "#1E110A", fillColor: "#3A2215" });
world2D.drawTunnel(ctx, pathDeep, 54 * S, { rimColor: "#1E110A", fillColor: "#331D12" });

// Underground Chambers with warm radial room lighting
const chambers = [
  { x: -210 * S, y: 380 * S, rx: 120 * S, ry: 74 * S, name: "GUDANG MAKANAN" },
  { x: 240 * S,  y: 350 * S, rx: 105 * S, ry: 68 * S, name: "RUANG LARVA" },
  { x: 110 * S,  y: 860 * S, rx: 145 * S, ry: 84 * S, name: "ISTANA RATU" }
];
for (const ch of chambers) {
  ctx.fillStyle = "#1E110A";
  ctx.beginPath(); ctx.ellipse(ch.x, ch.y, ch.rx + 14 * S, ch.ry + 14 * S, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3E2416";
  ctx.beginPath(); ctx.ellipse(ch.x, ch.y, ch.rx, ch.ry, 0, 0, Math.PI * 2); ctx.fill();
  world2D.drawRoomLight(ctx, ch.x, ch.y, ch.rx * 1.45, glowCol, 0.45);
  ctx.fillStyle = "rgba(255,244,214,0.88)";
  ctx.font = "700 " + Math.round(18 * S) + "px 'JetBrains Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(ch.name, ch.x, ch.y - ch.ry - 24 * S);
}

// Catmull-Rom Path-Following Swarm Simulation (Dozens to Hundreds of Ants!)
fx.swarm.drawSwarm(ctx, [pathMain, pathBranch, pathDeep], {
  count,
  type: "ant",
  color: "#140A06",
  speed: 0.13,
  spread: 16 * S,
  size: 11 * S,
  carryFood: true,
  bidirectional: true
});

ctx.restore();

// Fixed 2D HUD Header & Viral Universe Bold Subtitles
ui.drawLiquidGlass(ctx, pad, H * 0.055, W - pad * 2, 112 * S, 26 * S, { light: false });
ctx.fillStyle = "#FFFFFF";
ctx.font = "800 " + Math.round(34 * S) + "px 'Plus Jakarta Sans', sans-serif";
ctx.textAlign = "left"; ctx.textBaseline = "middle";
ctx.fillText(String(P.title || "Kota Bawah Tanah Semut"), pad + 26 * S, H * 0.055 + 42 * S, W - pad * 2 - 52 * S);
ctx.fillStyle = glowCol;
ctx.font = "600 " + Math.round(20 * S) + "px 'JetBrains Mono', monospace";
ctx.fillText("KEDALAMAN: " + Math.round(ui.lerp(0, 4.8, p) * 10) / 10 + " METER · " + count + " AGEN AKTIF", pad + 26 * S, H * 0.055 + 80 * S);

ui.captions(ctx, [
  { start: 0.3, end: 3.1, text: "Di balik gundukan kecil di permukaan tanah..." },
  { start: 3.3, end: 6.4, text: "Terdapat jaringan terowongan logistik super rapi!" },
  { start: 6.6, end: 9.7, text: "Ratusan semut bekerja tanpa henti menuju Istana Ratu." }
], t, { preset: "universe_bold", accent: "#FFE600", yRatio: 0.86 });
"""

    const val DIORAMA_3D_ARCHITECTURE = """/*<studio-meta>
{
  "schemaVersion": 21,
  "title": "3D Diorama Arsitektur Vila",
  "defaultDurationSeconds": 9,
  "seed": 2026,
  "props": [
    {"key":"projectName","label":"Nama Vila","type":"text","default":"VILLA SOLIS BALI"},
    {"key":"priceTag","label":"Info Harga/Luas","type":"text","default":"320 m² · Private Pool · Smart Home"},
    {"key":"wallColor","label":"Warna Dinding","type":"color","default":"#F6F1E7"}
  ],
  "audio": {
    "ambience": "keynote_pulse",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.02, "sfx": "silk_swoosh", "gain": 0.56, "pitch": 1.0},
      {"p": 0.14, "sfx": "wood_tap", "gain": 0.52, "pitch": 1.0},
      {"p": 0.28, "sfx": "water_drop", "gain": 0.54, "pitch": 1.1},
      {"p": 0.44, "sfx": "glass_clink", "gain": 0.50, "pitch": 1.0},
      {"p": 0.78, "sfx": "crystal_bloom", "gain": 0.62, "pitch": 1.0}
    ]
  }
}
</studio-meta>*/

const pad = Math.min(W, H) * 0.065;
const innerW = W - pad * 2;

// Real-Time Three.js WebGL2 Diorama with PCFSoftShadowMap, PBR & Exponential Fog
const sc = studio3D.createScene({
  fov: 40,
  skyTop: "#0F2544",
  skyHorizon: "#89C2F0",
  fogColor: "#89C2F0",
  fogDensity: 0.015,
  sunColor: "#FFEBD2",
  sunIntensity: 1.65,
  sunPos: [14, 20, 12],
  shadows: true
});

// Modular Kavling Terrain Grid
sc.addTerrain({ size: 22, color: "#436B47", grid: true, gridCenter: "#A7E3B5", gridColor: "#2C4930" });

// Modular 2-Floor Modern Villa popping in smoothly with damped spring physics!
sc.addVilla({
  pos: [-1.4, 0, -0.8],
  width: 5.4,
  height: 3.1,
  depth: 4.2,
  floors: 2,
  wallColor: String(P.wallColor || "#F6F1E7"),
  roofColor: "#1F2633",
  glowColor: "#FFC57A",
  glowIntensity: 0.65,
  progress: ui.seg(p, 0.04, 0.50),
  delay: 0.02
});

// Rippling Reflective Swimming Pool
sc.addPool({
  pos: [4.2, 0, 1.4],
  width: 4.4,
  depth: 2.8,
  waterColor: "#1EC8F0",
  progress: ui.seg(p, 0.14, 0.56)
});

// Stylized Low-Poly Trees with gentle wind sway
const treeSpots = [
  [-5.6, 0, -3.4, 1.15, "#248F52", 0.08],
  [-6.2, 0,  2.2, 0.95, "#2FA863", 0.14],
  [ 6.4, 0, -3.8, 1.22, "#1F7D47", 0.18],
  [ 1.8, 0, -5.2, 1.05, "#33B36A", 0.22],
  [ 7.0, 0,  3.6, 0.88, "#289958", 0.26]
];
for (const tr of treeSpots) {
  sc.addTree({ pos: [tr[0], tr[1], tr[2]], scale: tr[3], leafColor: tr[4], progress: ui.seg(p, tr[5], tr[5] + 0.35) });
}

// Warm Architectural Garden Lantern Orbs
sc.addGlowOrb([1.5, 0.9, 2.4], 0.18, "#FFD280", 1.2);
sc.addGlowOrb([-4.4, 0.9, 2.2], 0.18, "#FFD280", 1.2);

// Cinematic 3D Spline Dolly Camera (anti-stiff Catmull-Rom path)
sc.cam3D.splineDolly(p, [
  [-11.5, 8.5, 14.5],
  [  2.0, 6.8, 15.2],
  [ 12.8, 5.6, 10.2],
  [  8.2, 9.2, 12.6]
], [0.6, 1.4, 0.0]);

// Composite sharp WebGL2 3D Diorama onto 2D Canvas
sc.renderTo(ctx);

// Hybrid 2D Liquid Glass HUD Card rendered crisp over WebGL2 3D!
const hudIn = fx.stagger(frame, 1, 6);
ctx.save();
ctx.globalAlpha = ui.clamp(hudIn, 0, 1);
ctx.translate(0, (1 - hudIn) * 32 * S);
fx.glass.refract(ctx, pad, H * 0.74, innerW, 210 * S, 34 * S, {
  ior: 1.44,
  chroma: 0.011,
  blur: 1.0,
  rimGlow: 0.9,
  tint: "rgba(18,28,45,0.28)",
  sweep: (p * 1.3) % 1
});
ctx.fillStyle = "#7AC8FF";
ctx.font = "700 " + Math.round(20 * S) + "px 'JetBrains Mono', monospace";
ctx.textAlign = "left"; ctx.textBaseline = "top";
ctx.fillText("3D ARCHITECTURAL SHOWCASE · THREE.JS WEBGL2", pad + 30 * S, H * 0.74 + 28 * S, innerW - 60 * S);

ctx.fillStyle = "#FFFFFF";
ctx.font = "800 " + Math.round(48 * S) + "px 'Plus Jakarta Sans', sans-serif";
ctx.fillText(String(P.projectName || "VILLA SOLIS BALI"), pad + 30 * S, H * 0.74 + 62 * S, innerW - 60 * S);

ctx.fillStyle = "rgba(232,242,255,0.88)";
ctx.font = "500 " + Math.round(25 * S) + "px 'Inter', sans-serif";
ctx.fillText(String(P.priceTag || "320 m² · Private Pool · Smart Home"), pad + 30 * S, H * 0.74 + 132 * S, innerW - 60 * S);
ctx.restore();

ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, "#FFFFFF", "rgba(255,255,255,0.18)");
"""

    const val LIQUID_GLASS_REFRACTION = """/*<studio-meta>
{
  "schemaVersion": 21,
  "title": "Liquid Glass Refraction Pro",
  "defaultDurationSeconds": 7,
  "seed": 99,
  "props": [
    {"key":"word1","label":"Baris Serif","type":"text","default":"Pure"},
    {"key":"word2","label":"Baris Bold","type":"text","default":"OPTICAL"},
    {"key":"word3","label":"Baris Ketiga","type":"text","default":"Clarity."},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#60A5FA"}
  ],
  "audio": {
    "ambience": "ios_glass_chimes",
    "ambienceVolume": 0.18,
    "cues": [
      {"p": 0.03, "sfx": "glass_slide", "gain": 0.54, "pitch": 1.0},
      {"p": 0.22, "sfx": "glass_clink", "gain": 0.56, "pitch": 1.05},
      {"p": 0.48, "sfx": "cinema_boom", "gain": 0.62, "pitch": 1.0},
      {"p": 0.64, "sfx": "crystal_tap", "gain": 0.54, "pitch": 1.12},
      {"p": 0.84, "sfx": "sparkle_chime", "gain": 0.58, "pitch": 1.0}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#60A5FA");
const pad = Math.min(W, H) * 0.065;
const innerW = W - pad * 2;

// Rich Luminous Backdrop with moving light orbs to showcase optical refraction
ui.drawMeshBg(ctx, W, H, "#060911", [
  { x: 0.20 + Math.sin(t * 0.7) * 0.12, y: 0.22, r: 0.72, col: accent, a: 0.42 },
  { x: 0.80 - Math.cos(t * 0.6) * 0.12, y: 0.76, r: 0.74, col: "#C084FC", a: 0.34 },
  { x: 0.50, y: 0.50, r: 0.56, col: "#34D399", a: 0.20 }
], t);
ui.drawGrid(ctx, W, H, 96 * S, "rgba(255,255,255,0.05)");

// Giant Kinetic Typography behind the refracting glass (Playfair Display Italic + Plus Jakarta Sans ExtraBold)
ctx.save();
ctx.textAlign = "center";
ctx.textBaseline = "middle";
const slide1 = ease.apple(ui.seg(p, 0.02, 0.28));
const slide2 = ease.apple(ui.seg(p, 0.10, 0.36));
const slide3 = ease.apple(ui.seg(p, 0.18, 0.44));

ctx.globalAlpha = slide1;
ctx.fillStyle = "rgba(255,255,255,0.92)";
ctx.font = "italic 700 " + Math.round(138 * S) + "px 'Playfair Display', serif";
ctx.fillText(String(P.word1 || "Pure"), W * 0.5, H * 0.29 + (1 - slide1) * 40 * S, innerW);

ctx.globalAlpha = slide2;
ctx.fillStyle = "#FFFFFF";
ctx.font = "800 " + Math.round(152 * S) + "px 'Plus Jakarta Sans', sans-serif";
ctx.fillText(String(P.word2 || "OPTICAL"), W * 0.5, H * 0.46 + (1 - slide2) * 45 * S, innerW);

ctx.globalAlpha = slide3;
ctx.fillStyle = accent;
ctx.font = "italic 700 " + Math.round(136 * S) + "px 'Playfair Display', serif";
ctx.fillText(String(P.word3 || "Clarity."), W * 0.5, H * 0.62 + (1 - slide3) * 40 * S, innerW);
ctx.restore();

// Sweeping WebGL2 Optical Refraction Glass Orb bending the giant typography behind it!
const orbX = W * (0.24 + 0.52 * ease.apple(Math.sin(p * Math.PI)));
const orbY = H * (0.34 + 0.26 * Math.sin(p * Math.PI * 2 - 0.5));
fx.glass.lens(ctx, orbX, orbY, 165 * S, {
  ior: 1.62,
  chroma: 0.022,
  blur: 0.7,
  rimGlow: 1.0,
  tint: "rgba(220,240,255,0.10)",
  sweep: (p * 1.8) % 1
});

// Bottom Refracting Frosted Liquid Glass Pill CTA
const pillW = innerW * 0.78;
const pillH = 104 * S;
fx.glass.pill(ctx, (W - pillW) * 0.5, H * 0.76, pillW, pillH, "LIQUID GLASS GLSL · 60 FPS", {
  ior: 1.48,
  chroma: 0.015,
  blur: 1.25,
  rimGlow: 0.92,
  tint: "rgba(255,255,255,0.14)",
  sweep: (p * 1.4 + 0.35) % 1,
  fontSize: 27 * S
});

// Editorial Glass Caption
ui.captions(ctx, [
  { start: 0.4, end: 3.4, text: "Refraksi optik kaca WebGL2 real-time." },
  { start: 3.6, end: 6.7, text: "Chromatic aberration & tipografi editorial offline." }
], t, { preset: "editorial_glass", accent, yRatio: 0.89 });

// Post-FX Bloom, Film Grain & Optical Vignette
fx.shader.postFx(ctx, { bloom: 0.26, vignette: 0.26, grain: 0.024, aberration: 0.002 });
"""
}
