package app.codetovideo.studio.core

object StudioTemplates {
    const val PIXAR_GARDEN_3D = """/*<studio-meta>
{
  "schemaVersion": 11,
  "title": "3D Pixar Garden Story",
  "defaultDurationSeconds": 15,
  "seed": 101,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"roseColor","label":"Warna Mawar","type":"color","default":"#DF2045"},
    {"key":"overallColor","label":"Warna Baju","type":"color","default":"#1B8A4B"}
  ],
  "audio": {
    "ambience": "lofi_garden",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.01, "sfx": "swoosh_soft", "gain": 0.48},
      {"p": 0.05, "sfx": "kalimba_note", "gain": 0.54, "pitch": 1.0},
      {"p": 0.34, "sfx": "air_whoosh", "gain": 0.52},
      {"p": 0.42, "sfx": "water_drop", "gain": 0.56, "pitch": 1.0},
      {"p": 0.52, "sfx": "water_drop", "gain": 0.52, "pitch": 1.16},
      {"p": 0.67, "sfx": "glass_slide", "gain": 0.54},
      {"p": 0.74, "sfx": "kalimba_note", "gain": 0.56, "pitch": 1.25},
      {"p": 0.86, "sfx": "crystal_bloom", "gain": 0.60}
    ]
  }
}
</studio-meta>*/

const roseCol = String(P.roseColor || "#DF2045");
const overallCol = String(P.overallColor || "#1B8A4B");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const isWide = W > H * 1.15;

// 3-Act Storytelling Timing with Smooth Pose Morphing!
const act = p < 0.34 ? 0 : (p < 0.68 ? 1 : 2);
const b01 = ui.seg(p, 0.30, 0.38);
const b12 = ui.seg(p, 0.64, 0.72);
const poseFrom = p < 0.50 ? "wave" : "pour";
const poseTo = p < 0.50 ? "pour" : "joy";
const poseBlend = p < 0.50 ? b01 : b12;

const sc = g3d.scene({
  fov: 0.62,
  ambient: 0.28,
  keyDir: [0.62, 0.72, 0.42],
  keyColor: "#FFEBD0",
  fillColor: "#8CC4FF",
  shadowColor: "#2C425E",
  shadows: true,
  shadowExtent: 4.2
});
sc.sky("golden_hour");
sc.post({
  bloom: 0.34,
  bloomThreshold: 0.74,
  godRays: 0.24,
  dofFocus: isWide ? 5.6 : 6.6,
  dofAperture: 0.26,
  lut: "pixar_warm",
  vibrancy: 1.18,
  vignette: 0.22
});

// Warm Sunlight Point Fill + Magic Bloom Light near the Flower!
const bloomP = ease.apple(ui.seg(p, 0.60, 0.90));
sc.pointLight([0.72, 1.35, 0.25], "#FFE08A", 0.45 + bloomP * 1.35, 3.8);
sc.pointLight([-1.2, 1.8, 1.4], "#FFCFA0", 0.75, 5.2);

const distK = isWide ? 1.0 : 1.24;
sc.cameraRig(p, [
  { p: 0.00, az: -0.38, elev: 0.20, dist: 6.2 * distK, target: [-0.05, 0.68, 0.0] },
  { p: 0.30, az:  0.12, elev: 0.22, dist: 5.8 * distK, target: [ 0.02, 0.66, 0.0] },
  { p: 0.38, az:  0.34, elev: 0.27, dist: 5.0 * distK, target: [ 0.16, 0.62, 0.06] },
  { p: 0.64, az:  0.66, elev: 0.30, dist: 4.9 * distK, target: [ 0.18, 0.64, 0.06] },
  { p: 0.72, az: -0.22, elev: 0.21, dist: 5.6 * distK, target: [ 0.06, 0.76, 0.0] },
  { p: 1.00, az:  0.76, elev: 0.26, dist: 5.4 * distK, target: [ 0.06, 0.80, 0.0] }
]);

// Sculpted Garden Hill + Distant Trees + Soft 3D Clouds
const island = sc.node({ pos: [0, 0, 0] });
island.lathe([
  [0.0, -1.25], [1.25, -0.82], [2.45, -0.24], [2.58, -0.05], [2.52, 0.0], [0.0, 0.0]
], [0, 0, 0], [0, 0, 0], { color: "#6E4732", color2: "#288E46", material: "clay", roughness: 0.78 }, 36);
island.scatter("grass", { count: 28, radius: 2.25, minRadius: 1.05, scale: 0.95 });
island.scatter("wildflowers", { count: 14, radius: 2.20, minRadius: 1.15, scale: 0.9 });
island.scatter("pebbles", { count: 10, radius: 2.15, minRadius: 1.10 });
island.tree([-1.85, -0.02, -1.25], { scale: 0.95, leafColor: "#1E8449", leafColor2: "#62DA86" });
island.tree([ 1.95, -0.02, -1.45], { scale: 0.80, leafColor: "#248E4E", leafColor2: "#72E294" });
sc.cloud([-2.4 + Math.sin(t * 0.2) * 0.3, 3.6, -5.2], { scale: 1.25, color: "#FFE8CF" });
sc.cloud([ 2.6 + Math.cos(t * 0.18) * 0.25, 3.2, -6.0], { scale: 1.05, color: "#FFEBD6" });

// 2-Bone Expressive Botanist with Automatic headLookAt, Smooth Pose Blend & Lip-Sync!
const potPos = [0.70, 0.55, -0.04];
const lookTarget = act === 1 ? potPos : (act === 2 ? [0.70, 1.18, -0.04] : [0.2, 1.1, 3.5]);
const charYaw = lerpNum(0.32, 0.92, b01) - b12 * 0.46;
const hero = g3d.character(island, {
  pos: [-0.72, 0, 0.16],
  rot: [0, charYaw, 0],
  scale: 0.96,
  poseFrom: poseFrom,
  poseTo: poseTo,
  blend: poseBlend,
  headLookAt: lookTarget,
  expression: act === 2 ? "joy" : (act === 1 ? "focus" : "smile"),
  talk: (t > 0.4 && t < 4.4) || (t > 5.4 && t < 9.6) || (t > 10.6 && t < 14.2),
  overallColor: overallCol,
  apron: true,
  material: "clay"
});

// Watering Can gripped physically in Right Hand Socket during Act 2 + Parabolic 3D Water Stream!
if (p > 0.32 && p < 0.70) {
  const canA = ease.snap(ui.seg(p, 0.32, 0.38)) * (1 - ease.snap(ui.seg(p, 0.65, 0.70)));
  const canGrip = hero.rightHand.node({ pos: [0.02, -0.05, 0.18], rot: [0.95, 0.0, 0.0], scale: Math.max(0.01, canA) });
  canGrip.cylinder([0, 0, 0], 0.15, 0.14, 0.27, [0, 0, 0], { color: "#1C8CD8", color2: "#58C8FF", material: "brushed_metal", metalness: 0.35, roughness: 0.24 }, 24);
  canGrip.torus([0, 0.02, -0.14], 0.095, 0.020, [0, Math.PI * 0.5, 0], { color: "#1C8CD8", roughness: 0.28 }, 18, 8);
  canGrip.cylinder([0, 0.11, 0.21], 0.024, 0.042, 0.30, [0.95, 0, 0], { color: "#1C8CD8", roughness: 0.28 }, 14);
  canGrip.sphere([0, 0.21, 0.34], 0.052, { color: "#F5C242", material: "brushed_metal", metalness: 0.78 }, 14);
  if (p > 0.39 && p < 0.64) {
    sc.fx3d("water_stream", { from: [0.22, 0.92, 0.16], to: [0.68, 0.52, -0.04], count: 14, arc: 0.12 });
  }
}

// Terracotta Pot & Growing Sculpted 3D Rose
const potNode = island.node({ pos: [0.70, 0, -0.04] });
potNode.shadow([0, 0.005, 0], 0.56, 0.56, 0.38);
potNode.lathe([
  [0.0, 0.0], [0.34, 0.0], [0.44, 0.44], [0.50, 0.46],
  [0.50, 0.56], [0.42, 0.56], [0.40, 0.49], [0.0, 0.50]
], [0, 0, 0], [0, 0, 0], { color: "#9C3B1E", color2: "#DF6238", material: "terracotta" }, 34);
potNode.ellipsoid([0, 0.50, 0], [0.39, 0.048, 0.39], [0, 0, 0], { color: "#362016", material: "clay", roughness: 0.92 }, 20);

const growP = ui.lerp(0.32, 1.0, ease.apple(ui.seg(p, 0.36, 0.76)));
potNode.flower("rose", [0, 0.48, 0], { grow: growP, bloom: bloomP, color: roseCol, color2: "#FF88A4", stemHeight: 0.78 });

// 3D Atmospheric Fireflies, Floating Dust & Magic Growth Swirl
sc.fx3d("dust", { count: 18, radius: 2.8, color: "#FFE8B6" });
sc.fx3d("fireflies", { count: 14, radius: 2.4, center: [0.2, 1.0, 0], color: "#FFD86B" });
if (act === 2) sc.fx3d("magic_swirl", { center: [0.70, 0.55, -0.04], radius: 0.65, height: 1.25, color: "#FFD166" });

sc.render(ctx);

// 3D-Tracked Callout Pin locking directly onto the Blooming Rose in Act 3!
if (p > 0.72) {
  const roseScreen = sc.project([0.70, 1.32, -0.04]);
  ui.drawCallout(ctx, roseScreen, "Mekar Penuh!", "100% VITALITAS", {
    dx: -170, dy: -115, color: roseCol, light: true, prog: ui.seg(p, 0.72, 0.84)
  });
}

// Kinetic Reels-Style Subtitles synchronized to character lip-sync!
fx.captions(ctx, [
  { start: 0.3,  end: 4.8,  text: "Halo! Yuk rawat satu tunas mawar kecil hari ini." },
  { start: 5.2,  end: 10.0, text: "Siram lembut pagi hari biar akarnya makin kuat." },
  { start: 10.4, end: 14.8, text: "Rawat dengan sabar, mekarnya bikin hati bahagia!" }
], t, { y: H * 0.86, size: Math.round((isWide ? 34 : 38) * S), light: true, accent: overallCol });

ui.drawPill(ctx, pad, pad, String(P.brand || "Seflorner").toUpperCase() + " · 3D CINEMA", "rgba(255,255,255,0.72)", "#122018", Math.max(11, Math.round(19 * S)));
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, overallCol, "rgba(20,32,24,0.16)");
"""

    const val ANIME_CEL_3D = """/*<studio-meta>
{
  "schemaVersion": 11,
  "title": "3D Anime Cel-Shaded Showcase",
  "defaultDurationSeconds": 10,
  "seed": 112,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"title","label":"Judul Anime","type":"text","default":"MUSIM SEMI"},
    {"key":"accent","label":"Warna Sakura","type":"color","default":"#FF6E9C"}
  ],
  "audio": {
    "ambience": "botanical_air",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.01, "sfx": "air_whoosh", "gain": 0.52},
      {"p": 0.12, "sfx": "kalimba_note", "gain": 0.52, "pitch": 1.05},
      {"p": 0.48, "sfx": "swoosh_soft", "gain": 0.50},
      {"p": 0.82, "sfx": "crystal_bloom", "gain": 0.56}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#FF6E9C");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const isWide = W > H * 1.15;

const sc = g3d.scene({
  fov: 0.64,
  ambient: 0.34,
  keyDir: [0.52, 0.82, 0.44],
  keyColor: "#FFFDF5",
  fillColor: "#B0DEFF",
  shadowColor: "#3D6A96",
  shadows: true,
  shadowExtent: 4.8
});
sc.sky("ghibli_sky");
sc.post({ bloom: 0.24, bloomThreshold: 0.82, godRays: 0.16, lut: "ghibli_daylight", vibrancy: 1.24, vignette: 0.12 });

const distK = isWide ? 1.0 : 1.25;
sc.cameraRig(p, [
  { p: 0.00, az: -0.45, elev: 0.14, dist: 6.4 * distK, target: [0, 0.95, 0] },
  { p: 0.50, az:  0.22, elev: 0.22, dist: 5.4 * distK, target: [0.1, 1.0, 0] },
  { p: 1.00, az:  0.88, elev: 0.18, dist: 5.9 * distK, target: [0, 0.95, 0] }
]);

// Rolling Anime Meadow Hill
sc.terrain({
  width: 11, depth: 11, segs: 26,
  heightFn: (x, z) => Math.cos(x * 0.45) * Math.cos(z * 0.45) * 0.42 - 0.38,
  mat: { color: "#2DA856", color2: "#6CE084", material: "toon", castShadow: false }
});

// Cel-Shaded Sakura Tree with Ink Outline!
const treeNode = sc.node({ pos: [0.95, -0.04, -0.65] });
treeNode.shadow([0, 0.04, 0], 1.15, 1.15, 0.28);
treeNode.tube([[0, 0, 0], [0.06, 0.9, 0.04], [-0.04, 1.85, 0]], 0.20, 0.10, { color: "#6E4432", material: "toon", outline: 0.024 }, 14);
const crown = treeNode.node({ pos: [-0.04, 1.95, 0], rot: [0, 0, Math.sin(t * 1.5) * 0.04] });
const sakMat = { color: "#FF8CB4", color2: "#FFD6E6", material: "toon", outline: 0.026, rim: 0.6 };
crown.ellipsoid([0, 0.15, 0], [0.95, 0.68, 0.88], [0, 0, 0], sakMat, 22);
crown.ellipsoid([0.65, -0.08, 0.25], [0.62, 0.48, 0.56], [0, 0, 0], sakMat, 18);
crown.ellipsoid([-0.68, -0.04, -0.20], [0.66, 0.50, 0.58], [0, 0, 0], sakMat, 18);
crown.ellipsoid([0.08, 0.58, -0.15], [0.55, 0.44, 0.52], [0, 0, 0], sakMat, 18);

// Fluffy Ghibli Clouds drifting across the 3D Sky
sc.cloud([-2.6 + p * 0.9, 3.8, -5.2], { scale: 1.4, mat: { color: "#E6F4FF", color2: "#FFFFFF", material: "toon", castShadow: false } });
sc.cloud([ 2.4 - p * 0.7, 3.3, -6.2], { scale: 1.15, mat: { color: "#E6F4FF", color2: "#FFFFFF", material: "toon", castShadow: false } });

// Anime Cel-Shaded Character with Ink Outlines waving under the Sakura Tree!
g3d.character(sc, {
  pos: [-0.62, 0.0, 0.35],
  rot: [0, 0.35, 0],
  scale: 1.0,
  poseFrom: "wave",
  poseTo: "joy",
  blend: ui.seg(p, 0.55, 0.72),
  expression: p > 0.55 ? "joy" : "wink",
  hairStyle: "bob",
  hairColor: "#242B3D",
  shirtColor: "#FFFFFF",
  overallColor: "#2B78E4",
  material: "toon",
  outline: 0.024,
  glasses: true
});

sc.scatter("wildflowers", { count: 18, radius: 2.9, minRadius: 1.05, scale: 1.0 });
sc.fx3d("petals", { count: 28, radius: 3.4, color: accent });
sc.render(ctx);

// Editorial Display Title + Brand Pill
const topY = pad + 18 * S;
ui.drawPill(ctx, pad, topY, "CEL-SHADED 3D · INK OUTLINE", "rgba(255,255,255,0.82)", "#182436", Math.max(11, Math.round(19 * S)));
ui.drawDisplayText(ctx, String(P.title || "MUSIM SEMI"), pad, topY + 62 * S, innerW, {
  size: Math.round((isWide ? 74 : 92) * S),
  color: "#FFFFFF",
  stroke: "#1B283C",
  strokeWidth: 7 * S,
  shadow: "rgba(27,40,60,0.28)"
});
fx.captions(ctx, [
  { start: 0.4, end: 4.8, text: "Gaya 3D Anime cel-shading langsung dari GPU HP." },
  { start: 5.2, end: 9.7, text: "Lengkap dengan ink outline, langit 3D & kelopak sakura!" }
], t, { y: H * 0.87, size: Math.round(36 * S), light: true, accent: accent });
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, accent, "rgba(255,255,255,0.35)");
"""

    const val PLANT_VS_PEST_3D = """/*<studio-meta>
{
  "schemaVersion": 11,
  "title": "3D Plant vs Pest Story",
  "defaultDurationSeconds": 15,
  "seed": 124,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#23B85A"}
  ],
  "audio": {
    "ambience": "documentary_pulse",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.01, "sfx": "air_whoosh", "gain": 0.52},
      {"p": 0.14, "sfx": "taptic_thock", "gain": 0.50, "pitch": 1.0},
      {"p": 0.36, "sfx": "whip", "gain": 0.54},
      {"p": 0.44, "sfx": "water_drop", "gain": 0.56, "pitch": 1.06},
      {"p": 0.54, "sfx": "water_drop", "gain": 0.52, "pitch": 1.18},
      {"p": 0.68, "sfx": "glass_slide", "gain": 0.54},
      {"p": 0.84, "sfx": "crystal_bloom", "gain": 0.58}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#23B85A");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const isWide = W > H * 1.15;

const act = p < 0.35 ? 0 : (p < 0.68 ? 1 : 2);
const sc = g3d.scene({
  fov: 0.62,
  ambient: 0.30,
  keyDir: [0.55, 0.84, 0.46],
  keyColor: "#FFF5E4",
  fillColor: "#9ED0FF",
  shadowColor: "#263D30",
  shadows: true,
  shadowExtent: 4.0
});
sc.sky("soft_daylight");
sc.post({ bloom: 0.28, bloomThreshold: 0.78, dofFocus: isWide ? 5.2 : 6.4, dofAperture: 0.24, lut: "botanical_film", vibrancy: 1.22, vignette: 0.18 });
sc.pointLight([0, 1.6, 1.2], "#FFEAA8", 0.65, 4.5);

const distK = isWide ? 1.0 : 1.26;
sc.cameraRig(p, [
  { p: 0.00, az: -0.30, elev: 0.22, dist: 5.6 * distK, target: [ 0.05, 0.55, 0] },
  { p: 0.32, az:  0.20, elev: 0.24, dist: 5.0 * distK, target: [ 0.25, 0.50, 0] },
  { p: 0.40, az:  0.42, elev: 0.26, dist: 4.8 * distK, target: [ 0.10, 0.55, 0] },
  { p: 0.66, az: -0.15, elev: 0.24, dist: 5.2 * distK, target: [ 0.00, 0.58, 0] },
  { p: 1.00, az:  0.65, elev: 0.26, dist: 5.4 * distK, target: [-0.25, 0.62, 0] }
]);

// Garden Table Platform
const stage = sc.node({ pos: [0, 0, 0] });
stage.cylinder([0, -0.24, 0], 2.55, 2.65, 0.48, [0, 0, 0], { color: "#7C5234", color2: "#B68256", material: "wood" }, 40);
stage.scatter("pebbles", { count: 10, radius: 2.2, minRadius: 1.25 });

// Living Chili Plant Mascot on Left
g3d.creature(stage, "plant_buddy", {
  pos: [-0.62, 0, 0.08],
  rot: [0, 0.35, 0],
  scale: 1.12,
  flowerType: "chili_plant",
  hop: act === 2 ? 0.14 : 0.04
});

// Expressive Pest Caterpillar on Right — retreats in Act 2 & vanishes in Act 3!
const retreatU = ease.apple(ui.seg(p, 0.52, 0.74));
if (retreatU < 0.96) {
  const pestX = ui.lerp(0.68, 2.35, retreatU);
  g3d.creature(stage, "caterpillar", {
    pos: [pestX, 0, 0.12],
    rot: [0, act === 0 ? -0.95 : 1.15, 0],
    scale: (1 - retreatU * 0.4) * 0.95,
    expression: act >= 1 ? "scared" : "smile",
    speed: act >= 1 ? 11.0 : 4.5
  });
}

// Botanical Organic Spray Bottle enters in Act 2 and sprays parabolic mist!
if (p > 0.34 && p < 0.70) {
  const spIn = ease.outBack(ui.seg(p, 0.34, 0.42)) * (1 - ease.snap(ui.seg(p, 0.64, 0.70)));
  const lblTex = g3d.texture((c2, tw, th) => {
    c2.fillStyle = "#F6F8F4"; c2.fillRect(0, 0, tw, th);
    c2.fillStyle = "#1E8E4E"; c2.fillRect(0, 0, tw, th * 0.28);
    c2.fillStyle = "#FFFFFF"; c2.font = "800 54px sans-serif"; c2.textAlign = "center";
    c2.fillText("BIO SPRAY", tw * 0.5, th * 0.19);
    c2.fillStyle = "#14241A"; c2.font = "700 42px sans-serif";
    c2.fillText("100% ALAMI", tw * 0.5, th * 0.58);
  }, 256);
  stage.bottle3D([0.0, 0.55 + Math.sin(t * 5) * 0.04, 0.85], [0.1, 0.85, -0.35], {
    scale: 0.48 * Math.max(0.01, spIn), color: "#1B8E4E", color2: "#4CE088", label: lblTex
  });
  if (p > 0.42 && p < 0.62) {
    sc.fx3d("water_stream", { from: [0.18, 1.18, 0.62], to: [0.82, 0.32, 0.12], count: 16, arc: 0.10, color: "#80E8FF" });
  }
}

if (act === 2) sc.fx3d("magic_swirl", { center: [-0.62, 0.45, 0.08], radius: 0.72, height: 1.45, color: "#5CE1A8" });
sc.render(ctx);

// 3D-Tracked Fact Callouts anchored directly onto the 3D creatures!
if (p > 0.08 && p < 0.35) {
  const pestPt = sc.project([0.68, 0.48, 0.12]);
  ui.drawCallout(ctx, pestPt, "Hama Pengganggu", "PENYERANG DAUN MUDA", { dx: -165, dy: -130, color: "#E53935", light: true, prog: ui.seg(p, 0.08, 0.18) });
}
if (p > 0.72) {
  const plantPt = sc.project([-0.62, 1.18, 0.08]);
  ui.drawCallout(ctx, plantPt, "Cabai Sehat!", "BEBAS HAMA · SIAP PANEN", { dx: 135, dy: -115, color: accent, light: true, prog: ui.seg(p, 0.72, 0.84) });
}

fx.captions(ctx, [
  { start: 0.3,  end: 4.9,  text: "Awas! Hama ulat dan kutu daun suka menyerang pucuk cabai." },
  { start: 5.3,  end: 10.1, text: "Semprot larutan nabati organik secara rutin tiap sore." },
  { start: 10.5, end: 14.8, text: "Hama kabur, tanaman cabai kembali subur berbuah lebat!" }
], t, { y: H * 0.87, size: Math.round((isWide ? 34 : 38) * S), light: true, accent: accent });

ui.drawPill(ctx, pad, pad, String(P.brand || "Seflorner").toUpperCase() + " · PLANT HACKS 3D", "rgba(255,255,255,0.78)", "#122018", Math.max(11, Math.round(19 * S)));
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, accent, "rgba(20,32,24,0.16)");
"""

    const val APPLE_HARDWARE_3D = """/*<studio-meta>
{
  "schemaVersion": 11,
  "title": "3D Apple Hardware + Live Screen",
  "defaultDurationSeconds": 10,
  "seed": 135,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"STUDIO PRO"},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#4AA3FF"}
  ],
  "audio": {
    "ambience": "keynote_pulse",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.01, "sfx": "air_whoosh", "gain": 0.54},
      {"p": 0.16, "sfx": "taptic_thock", "gain": 0.50, "pitch": 1.0},
      {"p": 0.45, "sfx": "glass_tap", "gain": 0.48, "pitch": 1.10},
      {"p": 0.82, "sfx": "crystal_bloom", "gain": 0.58}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#4AA3FF");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const isWide = W > H * 1.15;

// Live Animated 2D UI Texture rendered dynamically onto the 3D iPhone Screen!
const liveScreen = g3d.texture((c2, tw, th) => {
  const g = c2.createLinearGradient(0, 0, tw, th);
  g.addColorStop(0, "#09101E"); g.addColorStop(1, "#122645");
  c2.fillStyle = g; c2.fillRect(0, 0, tw, th);
  // Dynamic Glowing Wave Ring inside screen
  const rg = c2.createRadialGradient(tw * 0.5, th * 0.42, 10, tw * 0.5, th * 0.42, tw * 0.42);
  rg.addColorStop(0, accent); rg.addColorStop(1, "rgba(0,0,0,0)");
  c2.globalAlpha = 0.42; c2.fillStyle = rg; c2.fillRect(0, 0, tw, th); c2.globalAlpha = 1;
  c2.strokeStyle = "#FFFFFF"; c2.lineWidth = 14; c2.lineCap = "round";
  c2.beginPath(); c2.arc(tw * 0.5, th * 0.42, tw * 0.24, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * ease.apple(p)); c2.stroke();
  c2.fillStyle = "#FFFFFF"; c2.font = "800 72px sans-serif"; c2.textAlign = "center"; c2.textBaseline = "middle";
  c2.fillText(Math.round(ease.apple(p) * 100) + "%", tw * 0.5, th * 0.42);
  c2.fillStyle = "rgba(220,235,255,0.85)"; c2.font = "700 32px monospace";
  c2.fillText("GPU RENDER 4K", tw * 0.5, th * 0.72);
  c2.fillStyle = "rgba(255,255,255,0.16)";
  c2.fillRect(tw * 0.14, th * 0.80, tw * 0.72, 16);
  c2.fillStyle = accent;
  c2.fillRect(tw * 0.14, th * 0.80, tw * 0.72 * p, 16);
}, 512);

const sc = g3d.scene({
  fov: 0.60,
  ambient: 0.30,
  keyDir: [0.65, 0.75, 0.55],
  keyColor: "#FFFFFF",
  fillColor: "#8CC4FF",
  shadows: true,
  shadowExtent: 4.5
});
sc.sky("studio_cyc");
sc.post({ bloom: 0.36, bloomThreshold: 0.72, lut: "apple_studio", vibrancy: 1.16, chromatic: 0.25, vignette: 0.28 });
sc.pointLight([1.8, 1.4, 2.0], accent, 1.4, 6.0);
sc.pointLight([-2.0, 0.8, 1.5], "#FFFFFF", 0.9, 5.5);

const distK = isWide ? 1.0 : 1.28;
sc.cameraRig(p, [
  { p: 0.00, az: -0.62, elev: 0.16, dist: 5.8 * distK, target: [0, 0.2, 0] },
  { p: 0.45, az:  0.38, elev: 0.12, dist: 4.8 * distK, target: [0, 0.2, 0] },
  { p: 0.78, az:  2.75, elev: 0.18, dist: 5.2 * distK, target: [0, 0.2, 0] },
  { p: 1.00, az:  0.15, elev: 0.10, dist: 5.0 * distK, target: [0, 0.2, 0] }
]);

// Floating Brushed Titanium iPhone 3D + Live Animated Screen + Holographic Orbit Ring
const floatY = Math.sin(t * 1.8) * 0.10;
const introS = spring({ frame, fps, config: { damping: 15, stiffness: 115 } });
sc.phone3D([0, 0.22 + floatY, 0], [0.06 * Math.sin(t), 0, 0.04 * Math.cos(t)], {
  scale: 0.95 * ui.clamp(introS, 0.1, 1.04),
  frameColor: "#9BA5B5",
  screen: liveScreen
});
sc.torus([0, 0.22 + floatY, 0], 1.78, 0.025, [0.58 + t * 0.3, t * 0.4, 0.2], {
  color: "#E8F0FA", material: "hologram", roughness: 0.10, rim: 0.9
}, 48, 14);
sc.text3D(String(P.brand || "STUDIO"), [0, -1.32, 0.2], [-0.15, 0, 0], {
  size: 0.36, color: "#E8F0FA", color2: accent, material: "brushed_metal"
});
sc.fx3d("dust", { count: 16, radius: 3.0, color: accent });
sc.render(ctx);

// 3D-Tracked Apple Keynote Hardware Callouts!
if (p > 0.14 && p < 0.60) {
  const topEdge = sc.project([0.55, 1.15 + floatY, 0.05]);
  ui.drawCallout(ctx, topEdge, "Brushed Titanium", "PBR METAL + HDRI", { dx: 120, dy: -100, color: accent, light: false, prog: ui.seg(p, 0.14, 0.26) });
}
if (p > 0.42 && p < 0.88) {
  const screenCtr = sc.project([-0.45, 0.15 + floatY, 0.08]);
  ui.drawCallout(ctx, screenCtr, "Live 2D→3D Screen", "60FPS CANVAS TEXTURE", { dx: -155, dy: 95, color: "#5CE1A8", light: false, prog: ui.seg(p, 0.42, 0.56) });
}

ui.drawPill(ctx, pad, pad, "APPLE KEYNOTE 3D ENGINE · V1.1", "rgba(255,255,255,0.12)", "#F5F8FC", Math.max(11, Math.round(19 * S)));
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, accent, "rgba(255,255,255,0.16)");
"""

    const val LIQUID_GLASS_SHADER = """/*<studio-meta>
{
  "schemaVersion": 11,
  "title": "3D Liquid Glass Raymarch Shader",
  "defaultDurationSeconds": 10,
  "seed": 144,
  "props": [
    {"key":"title","label":"Judul","type":"text","default":"LIQUID GLASS"},
    {"key":"subtitle","label":"Subjudul","type":"text","default":"REAL-TIME GPU RAYMARCHING"},
    {"key":"accent","label":"Warna Bias","type":"color","default":"#4AA3FF"}
  ],
  "audio": {
    "ambience": "ios_glass_chimes",
    "ambienceVolume": 0.18,
    "cues": [
      {"p": 0.01, "sfx": "liquid_morph", "gain": 0.54},
      {"p": 0.30, "sfx": "glass_tap", "gain": 0.46, "pitch": 1.05},
      {"p": 0.60, "sfx": "glass_shimmer", "gain": 0.48},
      {"p": 0.85, "sfx": "crystal_bloom", "gain": 0.56}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#4AA3FF");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;

const glsl = [
  "uniform vec3 uAccent;",
  "float mapScene(vec3 p) {",
  "  vec3 q = p;",
  "  q.xz *= rot2(uTime * 0.45);",
  "  q.xy *= rot2(uTime * 0.28);",
  "  float d1 = sdSphere(q - vec3(sin(uTime*1.2)*0.48, cos(uTime*0.9)*0.32, 0.0), 0.58);",
  "  float d2 = sdSphere(q + vec3(cos(uTime*1.1)*0.52, sin(uTime*1.3)*0.38, sin(uTime)*0.25), 0.48);",
  "  float d3 = sdTorus(q.xzy, vec2(0.88, 0.16));",
  "  return smin(smin(d1, d2, 0.45), d3, 0.35);",
  "}",
  "vec3 calcNorm(vec3 p) {",
  "  vec2 e = vec2(0.0025, 0.0);",
  "  return normalize(vec3(",
  "    mapScene(p+e.xyy)-mapScene(p-e.xyy),",
  "    mapScene(p+e.yxy)-mapScene(p-e.yxy),",
  "    mapScene(p+e.yyx)-mapScene(p-e.yyx)",
  "  ));",
  "}",
  "vec4 renderShader(vec2 uv) {",
  "  vec3 ro = vec3(0.0, 0.0, 3.1);",
  "  vec3 rd = normalize(vec3(uv, -1.45));",
  "  vec3 bg = mix(vec3(0.03, 0.05, 0.09), uAccent * 0.28, smoothstep(-0.6, 0.8, uv.y));",
  "  bg += uAccent * 0.18 * exp(-length(uv - vec2(0.32, 0.25)) * 2.8);",
  "  float dist = 0.0; bool hit = false;",
  "  for (int i = 0; i < 64; i++) {",
  "    vec3 p = ro + rd * dist;",
  "    float d = mapScene(p);",
  "    if (d < 0.002) { hit = true; break; }",
  "    if (dist > 7.0) break;",
  "    dist += d;",
  "  }",
  "  if (!hit) return vec4(bg, 1.0);",
  "  vec3 p = ro + rd * dist;",
  "  vec3 N = calcNorm(p);",
  "  vec3 V = -rd;",
  "  vec3 L = normalize(vec3(0.6, 0.8, 0.7));",
  "  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);",
  "  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 48.0);",
  "  vec3 irid = cosPalette(fres * 0.85 + uTime * 0.15, vec3(0.55), vec3(0.45), vec3(1.0), vec3(0.0, 0.22, 0.45));",
  "  vec3 col = mix(bg * 1.4, irid, 0.45 + 0.5 * fres) + vec3(1.0) * spec * 1.35 + uAccent * fres * 0.65;",
  "  col = col / (1.0 + col * 0.35);",
  "  return vec4(clamp(col, 0.0, 1.0), 1.0);",
  "}"
].join("\n");

g3d.shader(ctx, glsl, { uAccent: accent });
ui.drawVignette(ctx, W, H, 0.32, false);

// Floating Liquid Glass Editorial Overlay
const footH = 196 * S, footY = H - pad - footH - 24 * S;
ui.drawLiquidGlass(ctx, pad, footY, innerW, footH, 28 * S, { light: false, sweep: (p * 1.5) % 1 });
ui.drawDisplayText(ctx, String(P.title || "LIQUID GLASS"), pad + 32 * S, footY + 34 * S, innerW - 64 * S, {
  size: Math.round(62 * S), gradient: ["#FFFFFF", accent]
});
fx.text.typewriter(ctx, String(P.subtitle || "REAL-TIME GPU RAYMARCHING"), pad + 32 * S, footY + 124 * S, Math.round(22 * S), "#CBE4FF", ui.seg(p, 0.10, 0.65), true);
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, accent, "rgba(255,255,255,0.18)");
"""

    // Backward-compatible aliases so any older references still compile cleanly
    const val CHARACTER_STORY_3D = PIXAR_GARDEN_3D
    const val CHROME_3D_GPU = APPLE_HARDWARE_3D
    const val BOTANICAL_3D = ANIME_CEL_3D
    const val DATA_STORY = PLANT_VS_PEST_3D
    const val CUTE_STORY = LIQUID_GLASS_SHADER
}
