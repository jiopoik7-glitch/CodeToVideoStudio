'use strict';

["fetch","XMLHttpRequest","WebSocket","importScripts","indexedDB","caches","BroadcastChannel","Worker","WebAssembly","setTimeout","setInterval","requestAnimationFrame"].forEach((k)=>{
  try { Object.defineProperty(self, k, { value: undefined, writable: false, configurable: true }); }
  catch (_) { try { self[k] = undefined; } catch (__) {} }
});
Math.random = () => { throw new Error("Math.random() is disabled; use rand(index)."); };

let canvas = null;
let ctx = null;
let currentWidth = 0;
let currentHeight = 0;

const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerpNum = (a, b, u) => a + (b - a) * u;

function bezier(x1, y1, x2, y2) {
  return (x) => {
    const tc = clampNum(x, 0, 1);
    if (tc <= 0) return 0;
    if (tc >= 1) return 1;
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    let u = tc;
    for (let i = 0; i < 6; i++) {
      const sx = ((ax * u + bx) * u + cx) * u - tc;
      const dx = (3 * ax * u + 2 * bx) * u + cx;
      if (Math.abs(sx) < 1e-5 || Math.abs(dx) < 1e-6) break;
      u = clampNum(u - sx / dx, 0, 1);
    }
    return ((ay * u + by) * u + cy) * u;
  };
}

const ease = Object.freeze({
  linear: (x) => clampNum(x, 0, 1),
  inQuad: (x) => { const u = clampNum(x, 0, 1); return u * u; },
  outQuad: (x) => { const u = clampNum(x, 0, 1); return 1 - (1 - u) * (1 - u); },
  inOutQuad: (x) => { const u = clampNum(x, 0, 1); return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; },
  inCubic: (x) => { const u = clampNum(x, 0, 1); return u * u * u; },
  outCubic: (x) => { const u = clampNum(x, 0, 1); return 1 - Math.pow(1 - u, 3); },
  inOutCubic: (x) => { const u = clampNum(x, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; },
  inExpo: (x) => { const u = clampNum(x, 0, 1); return u === 0 ? 0 : Math.pow(2, 10 * u - 10); },
  outExpo: (x) => { const u = clampNum(x, 0, 1); return u === 1 ? 1 : 1 - Math.pow(2, -10 * u); },
  inOutExpo: (x) => {
    const u = clampNum(x, 0, 1);
    if (u === 0 || u === 1) return u;
    return u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2;
  },
  outBack: (x) => { const u = clampNum(x, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  apple: bezier(0.22, 1.0, 0.36, 1.0),
  snap: bezier(0.16, 1.0, 0.30, 1.0),
  whip: bezier(0.76, 0.0, 0.24, 1.0),
  smooth: bezier(0.45, 0.0, 0.55, 1.0),
  ios: bezier(0.25, 0.9, 0.3, 1.0),
  liquid: bezier(0.32, 0.96, 0.22, 1.0)
});

function spring(arg0, arg1, arg2) {
  let f = 0, fpsVal = 30, from = 0, to = 1, cfg = {};
  if (arg0 && typeof arg0 === "object") {
    f = Number(arg0.frame || 0);
    fpsVal = Number(arg0.fps || 30);
    from = arg0.from !== undefined ? Number(arg0.from) : 0;
    to = arg0.to !== undefined ? Number(arg0.to) : 1;
    cfg = arg0.config || {};
  } else {
    f = Number(arg0 || 0);
    fpsVal = Number(arg1 || 30);
    cfg = arg2 || {};
  }
  const tSec = f / Math.max(1, fpsVal);
  if (tSec <= 0) return from;
  const damping = Math.max(0.1, Number(cfg.damping !== undefined ? cfg.damping : 14));
  const stiffness = Math.max(1, Number(cfg.stiffness !== undefined ? cfg.stiffness : 140));
  const mass = Math.max(0.05, Number(cfg.mass !== undefined ? cfg.mass : 1));
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  let val;
  if (zeta < 0.999) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    val = 1 - Math.exp(-zeta * w0 * tSec) * (Math.cos(wd * tSec) + ((zeta * w0) / wd) * Math.sin(wd * tSec));
  } else if (zeta <= 1.001) {
    val = 1 - Math.exp(-w0 * tSec) * (1 + w0 * tSec);
  } else {
    const r = w0 * Math.sqrt(zeta * zeta - 1);
    val = 1 - Math.exp(-zeta * w0 * tSec) * (Math.cosh(r * tSec) + ((zeta * w0) / r) * Math.sinh(r * tSec));
  }
  if (cfg.overshootClamping) val = clampNum(val, 0, 1);
  if (Math.abs(1 - val) < 0.0005 && tSec > 0.25) val = 1;
  return from + (to - from) * val;
}

function interpolate(input, inputRange, outputRange, opts) {
  if (!Array.isArray(inputRange) || !Array.isArray(outputRange) || inputRange.length < 2 || inputRange.length !== outputRange.length) return input;
  const o = opts || {};
  const exL = o.extrapolateLeft || "clamp";
  const exR = o.extrapolateRight || "clamp";
  const fn = typeof o.easing === "function" ? o.easing : null;
  let idx = 0;
  for (let i = 1; i < inputRange.length - 1; i++) {
    if (input >= inputRange[i]) idx = i;
  }
  const inMin = inputRange[idx], inMax = inputRange[idx + 1];
  const outMin = outputRange[idx], outMax = outputRange[idx + 1];
  let u = (input - inMin) / (inMax - inMin || 1);
  if (u < 0 && exL === "clamp") u = 0;
  if (u > 1 && exR === "clamp") u = 1;
  if (fn && u >= 0 && u <= 1) u = fn(u);
  return outMin + (outMax - outMin) * u;
}

function parseHexRGB(hex, fb) {
  if (Array.isArray(hex)) return hex;
  const clean = String(hex || "").trim().replace(/^#/, "");
  const full = clean.length === 3 ? clean[0]+clean[0]+clean[1]+clean[1]+clean[2]+clean[2] : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fb || [235, 240, 246];
  return [parseInt(full.slice(0,2),16), parseInt(full.slice(2,4),16), parseInt(full.slice(4,6),16)];
}

function hexToVec3(hex, fb) {
  const c = parseHexRGB(hex, fb || [230, 236, 244]);
  return [c[0] / 255, c[1] / 255, c[2] / 255];
}

function rgbStr(c, a) {
  const r = clampNum(Math.round(c[0]), 0, 255);
  const g = clampNum(Math.round(c[1]), 0, 255);
  const b = clampNum(Math.round(c[2]), 0, 255);
  return a === undefined ? ("rgb(" + r + "," + g + "," + b + ")") : ("rgba(" + r + "," + g + "," + b + "," + clampNum(a, 0, 1) + ")");
}

function seededRandom(seed, index) {
  let value = (seed ^ Math.imul(index + 1, 0x45d9f3b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 4294967296;
}

function makeCameraApi(W, H) {
  return Object.freeze({
    apply(c, state, depth) {
      const d = depth === undefined ? 1.0 : depth;
      const cx = W * 0.5, cy = H * 0.5;
      const z = 1 + ((state.zoom !== undefined ? state.zoom : 1) - 1) * d;
      c.translate(cx, cy);
      if (state.rot) c.rotate(state.rot * d);
      c.scale(z, z);
      c.translate(-cx - (state.x || 0) * d, -cy - (state.y || 0) * d);
    },
    shake(tSec, amp, freq) {
      const a = amp || 8, f = freq || 1.6;
      return {
        x: Math.sin(tSec * f * 2.1) * a + Math.cos(tSec * f * 3.7) * a * 0.45,
        y: Math.cos(tSec * f * 1.9) * a + Math.sin(tSec * f * 3.1) * a * 0.45,
        rot: Math.sin(tSec * f * 1.3) * (a * 0.0008)
      };
    }
  });
}

// Column-Major 4x4 & 3x3 Matrix Math
function m4Identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

function m4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    const b0 = b[c*4], b1 = b[c*4+1], b2 = b[c*4+2], b3 = b[c*4+3];
    out[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2  + a[12]*b3;
    out[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2  + a[13]*b3;
    out[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
    out[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
  }
  return out;
}

function m4Persp(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov * 0.5), nf = 1.0 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

function m4Ortho(l, r, b, t, n, f) {
  const rl = 1 / (r - l), tb = 1 / (t - b), fn = 1 / (f - n);
  return new Float32Array([
    2 * rl, 0, 0, 0,
    0, 2 * tb, 0, 0,
    0, 0, -2 * fn, 0,
    -(r + l) * rl, -(t + b) * tb, -(f + n) * fn, 1
  ]);
}

function m4LookAt(eye, target, up) {
  const upV = up || [0, 1, 0];
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let zm = Math.hypot(zx, zy, zz) || 1; zx /= zm; zy /= zm; zz /= zm;
  let xx = upV[1] * zz - upV[2] * zy, xy = upV[2] * zx - upV[0] * zz, xz = upV[0] * zy - upV[1] * zx;
  let xm = Math.hypot(xx, xy, xz) || 1; xx /= xm; xy /= xm; xz /= xm;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1
  ]);
}

function m4Transform(pos, rot, scale) {
  const px = pos ? pos[0] : 0, py = pos ? pos[1] : 0, pz = pos ? pos[2] : 0;
  const rx = rot ? rot[0] : 0, ry = rot ? rot[1] : 0, rz = rot ? rot[2] : 0;
  const sx = Array.isArray(scale) ? scale[0] : (scale !== undefined ? scale : 1);
  const sy = Array.isArray(scale) ? scale[1] : (scale !== undefined ? scale : 1);
  const sz = Array.isArray(scale) ? scale[2] : (scale !== undefined ? scale : 1);
  const cx = Math.cos(rx), sxr = Math.sin(rx);
  const cy = Math.cos(ry), syr = Math.sin(ry);
  const cz = Math.cos(rz), szr = Math.sin(rz);
  const r00 = cy * cz + syr * sxr * szr;
  const r10 = cx * szr;
  const r20 = -syr * cz + cy * sxr * szr;
  const r01 = -cy * szr + syr * sxr * cz;
  const r11 = cx * cz;
  const r21 = syr * szr + cy * sxr * cz;
  const r02 = syr * cx;
  const r12 = -sxr;
  const r22 = cy * cx;
  return new Float32Array([
    r00 * sx, r10 * sx, r20 * sx, 0,
    r01 * sy, r11 * sy, r21 * sy, 0,
    r02 * sz, r12 * sz, r22 * sz, 0,
    px, py, pz, 1
  ]);
}

function m3NormalFromM4(m) {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];
  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;
  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (Math.abs(det) < 1e-8) return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  det = 1.0 / det;
  return new Float32Array([
    b01 * det, b11 * det, b21 * det,
    (-a22 * a01 + a02 * a21) * det, (a22 * a00 - a02 * a20) * det, (-a21 * a00 + a01 * a20) * det,
    (a12 * a01 - a02 * a11) * det, (-a12 * a00 + a02 * a10) * det, (a11 * a00 - a01 * a10) * det
  ]);
}
// =======================================================
// GPU WEBGL 4-PASS PIPELINE (SHADOWS + 12 PBR SHADERS + BLOOM + DOF + GOD RAYS + 6 LUTS)
// =======================================================
let glCanvas = null, gl = null, glW = 0, glH = 0, glShadowResCur = 0;
let glPbrProg = null, glShadowProg = null, glDepthProg = null;
let glBloomExtProg = null, glBloomBlurProg = null, glPostProg = null;
let glShadowFbo = null, glShadowTex = null, glShadowRb = null;
let glSceneFbo = null, glSceneTex = null, glSceneRb = null;
let glDepthFbo = null, glDepthTex = null, glDepthRb = null;
let glBloomFboA = null, glBloomTexA = null, glBloomFboB = null, glBloomTexB = null;
let glBufPos = null, glBufNorm = null, glBufUv = null, glBufIdx = null, glQuadBuf = null;
let glWhiteTex = null, glDynamicTex = null;
const glShaderCache = new Map();

const MAT_TYPE_MAP = {
  standard: 0, pbr: 0, toon: 1, cel: 1, clay: 2, skin: 3, fabric: 4, cloth: 4,
  foliage: 5, leaf: 5, terracotta: 6, wood: 7, water: 8, glass: 9,
  brushed_metal: 10, metal: 10, hologram: 11, marble: 12
};

const LUT_MAP = {
  none: 0, neutral: 0, pixar_warm: 1, ghibli_daylight: 2, apple_studio: 3,
  botanical_film: 4, kodak_portra: 5, cyber_nocturne: 6
};

const SHADOW_VS = `
attribute vec3 aPos;
uniform mat4 uLightVP;
uniform mat4 uModel;
varying float vDepth;
void main() {
  vec4 lp = uLightVP * uModel * vec4(aPos, 1.0);
  vDepth = lp.z / lp.w * 0.5 + 0.5;
  gl_Position = lp;
}`;

const SHADOW_FS = `
precision highp float;
varying float vDepth;
vec4 packDepth(float d) {
  vec4 enc = vec4(1.0, 255.0, 65025.0, 16581375.0) * clamp(d, 0.0, 1.0);
  enc = fract(enc);
  enc -= enc.yzww * vec4(1.0/255.0, 1.0/255.0, 1.0/255.0, 0.0);
  return enc;
}
void main() { gl_FragColor = packDepth(vDepth); }`;

const DEPTH_VS = `
attribute vec3 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec3 uEye;
varying float vLinDist;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vLinDist = length(uEye - wp.xyz) / 36.0;
  gl_Position = uProj * uView * wp;
}`;

const DEPTH_FS = `
precision highp float;
varying float vLinDist;
void main() {
  float d = clamp(vLinDist, 0.0, 1.0);
  gl_FragColor = vec4(d, d, d, 1.0);
}`;

const PBR_VS = `
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec2 aUv;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormMat;
uniform mat4 uLightVP;
uniform float uOutlineWidth;
varying vec3 vWorldPos;
varying vec3 vNorm;
varying vec2 vUv;
varying vec4 vLightPos;
void main() {
  vec3 pLocal = aPos + aNorm * uOutlineWidth;
  vec4 wp = uModel * vec4(pLocal, 1.0);
  vWorldPos = wp.xyz;
  vNorm = normalize(uNormMat * aNorm);
  vUv = aUv;
  vLightPos = uLightVP * wp;
  gl_Position = uProj * uView * wp;
}`;

const PBR_FS = `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vNorm;
varying vec2 vUv;
varying vec4 vLightPos;
uniform sampler2D uShadowMap;
uniform sampler2D uAlbedoTex;
uniform float uHasTex;
uniform float uShadowEnabled;
uniform float uShadowTexel;
uniform vec3 uShadowColor;
uniform vec3 uEye;
uniform vec3 uKeyDir;
uniform vec3 uFillDir;
uniform vec3 uRimDir;
uniform vec3 uKeyCol;
uniform vec3 uFillCol;
uniform vec3 uPtPos[4];
uniform vec3 uPtCol[4];
uniform vec2 uPtParam[4];
uniform vec3 uSpotPos;
uniform vec3 uSpotDir;
uniform vec3 uSpotCol;
uniform vec3 uSpotParam;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec3 uEmissive;
uniform vec3 uRimColor;
uniform float uRoughness;
uniform float uMetalness;
uniform float uRimPow;
uniform float uSss;
uniform float uAlpha;
uniform float uAmb;
uniform float uUnlit;
uniform float uFeatherShadow;
uniform float uDetail;
uniform float uMatType;
uniform float uTime;
uniform float uSkyMode;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyGround;
uniform vec3 uSunCol;
uniform vec3 uFogColor;
uniform vec2 uFogRange;

float unpackDepth(vec4 rgba) {
  return dot(rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0));
}

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x),
        mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
        mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z
  );
}

// 9-Tap Soft PCF Shadow Sampling
float calcShadow(vec3 N, vec3 L) {
  if (uShadowEnabled < 0.5) return 1.0;
  vec3 proj = vLightPos.xyz / vLightPos.w * 0.5 + 0.5;
  if (proj.x < 0.01 || proj.x > 0.99 || proj.y < 0.01 || proj.y > 0.99 || proj.z > 1.0) return 1.0;
  float bias = max(0.0020 * (1.0 - dot(N, L)), 0.0007);
  float cur = proj.z - bias;
  float vis = 0.0;
  float t = uShadowTexel * 1.45;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 off = vec2(float(x), float(y)) * t;
      vis += (cur <= unpackDepth(texture2D(uShadowMap, proj.xy + off))) ? 1.0 : 0.0;
    }
  }
  return vis / 9.0;
}

void main() {
  // 3D SKY DOME SHADER MODE
  if (uSkyMode > 0.5) {
    vec3 dir = normalize(vWorldPos - uEye);
    float y = dir.y;
    vec3 sky = y >= 0.0
      ? mix(uSkyHorizon, uSkyZenith, pow(clamp(y, 0.0, 1.0), 0.58))
      : mix(uSkyHorizon, uSkyGround, pow(clamp(-y, 0.0, 1.0), 0.55));
    vec3 sunDir = normalize(uKeyDir);
    float sunDot = max(dot(dir, sunDir), 0.0);
    sky += uSunCol * pow(sunDot, 22.0) * 0.55;
    sky += uSunCol * smoothstep(0.994, 0.9988, sunDot) * 1.45;
    // Starry night procedural stars when uSkyMode > 1.5
    if (uSkyMode > 1.5 && y > 0.02) {
      float st = hash3(floor(dir * 260.0));
      float starMask = smoothstep(0.9955, 0.9998, st) * smoothstep(0.02, 0.25, y);
      float twinkle = 0.65 + 0.35 * sin(uTime * 3.0 + st * 90.0);
      sky += vec3(0.95, 0.97, 1.0) * starMask * twinkle * 1.35;
    }
    gl_FragColor = vec4(clamp(sky, 0.0, 1.0), 1.0);
    return;
  }

  vec3 srgbBase = mix(uColor, uColor2, clamp(vUv.y, 0.0, 1.0));
  float alphaOut = clamp(uAlpha, 0.0, 1.0);
  if (uHasTex > 0.5) {
    vec4 tx = texture2D(uAlbedoTex, vec2(vUv.x, 1.0 - vUv.y));
    srgbBase = mix(srgbBase, tx.rgb, tx.a);
    alphaOut *= max(tx.a, 0.02);
  }

  if (uFeatherShadow > 0.5) {
    float rDist = length(vUv * 2.0 - 1.0);
    float falloff = smoothstep(1.0, 0.05, rDist);
    falloff = falloff * falloff;
    float aS = clamp(alphaOut * falloff, 0.0, 1.0);
    gl_FragColor = vec4(srgbBase * aS, aS);
    return;
  }

  if (uUnlit > 0.5) {
    gl_FragColor = vec4(srgbBase * alphaOut, alphaOut);
    return;
  }

  vec3 baseCol = pow(max(srgbBase, vec3(0.0)), vec3(2.2));
  vec3 N = normalize(vNorm);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uEye - vWorldPos);
  vec3 L1 = normalize(uKeyDir);
  vec3 L2 = normalize(uFillDir);
  vec3 L3 = normalize(uRimDir);

  float rough = clamp(uRoughness, 0.05, 0.98);
  float metal = clamp(uMetalness, 0.0, 1.0);
  float sssAmt = uSss;
  int mt = int(uMatType + 0.5);

  // 12 PROCEDURAL PBR MATERIALS + MICRO-BUMP PERTURBATION
  vec3 wp = vWorldPos;
  if (mt == 2) { // clay
    float c1 = noise3(wp * 14.0), c2 = noise3(wp * 36.0);
    baseCol *= (0.94 + (c1 * 0.6 + c2 * 0.4) * 0.14);
    N = normalize(N + vec3(c1 - 0.5, c2 - 0.5, c1 - c2) * 0.09);
    rough = max(rough, 0.66);
  } else if (mt == 3) { // skin
    float p = noise3(wp * 42.0);
    baseCol *= (0.97 + p * 0.06);
    sssAmt = max(sssAmt, 0.36);
    rough = clamp(rough, 0.40, 0.62);
  } else if (mt == 4) { // fabric
    float weave = sin(wp.x * 165.0) * sin(wp.y * 165.0 + wp.z * 165.0);
    baseCol *= (0.94 + weave * 0.07);
    N = normalize(N + vec3(weave * 0.06, 0.0, weave * 0.06));
    rough = max(rough, 0.78);
  } else if (mt == 5) { // foliage
    float vein = abs(sin((vUv.x - 0.5) * 32.0 + vUv.y * 10.0));
    baseCol *= (0.90 + vein * 0.16);
    sssAmt = max(sssAmt, 0.42);
  } else if (mt == 6) { // terracotta
    float gr = noise3(wp * 26.0) * 0.6 + noise3(wp * 64.0) * 0.4;
    baseCol *= (0.86 + gr * 0.24);
    N = normalize(N + vec3(gr - 0.5) * 0.12);
    rough = max(rough, 0.68);
  } else if (mt == 7) { // wood
    float wDist = length(wp.xz * vec2(1.0, 1.2)) * 18.0 + noise3(wp * 4.5) * 3.5;
    float rings = 0.5 + 0.5 * sin(wDist + wp.y * 2.5);
    baseCol = mix(baseCol * 0.68, baseCol * 1.15, rings);
    rough = clamp(rough, 0.42, 0.72);
  } else if (mt == 8) { // water
    float w1 = sin(wp.x * 12.0 + uTime * 3.2) * cos(wp.z * 11.0 - uTime * 2.6);
    float w2 = noise3(wp * 9.0 + vec3(uTime * 1.2, 0.0, uTime * 0.9));
    N = normalize(N + vec3(w1 * 0.08 + (w2 - 0.5) * 0.08, 0.0, (w2 - 0.5) * 0.08));
    rough = 0.08;
    metal = 0.12;
  } else if (mt == 9) { // glass
    rough = 0.06;
    metal = 0.15;
    float frG = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    alphaOut = clamp(mix(alphaOut, 0.92, frG * 0.72), 0.12, 1.0);
  } else if (mt == 10) { // brushed_metal
    float brush = noise3(vec3(wp.x * 4.0, wp.y * 95.0, wp.z * 4.0));
    baseCol *= (0.90 + brush * 0.20);
    rough = clamp(rough, 0.10, 0.28);
    metal = max(metal, 0.88);
  } else if (mt == 11) { // hologram
    float ndvH = max(dot(N, V), 0.0);
    vec3 irid = 0.55 + 0.45 * cos(6.28318 * (ndvH * 1.4 + uTime * 0.22 + vec3(0.0, 0.33, 0.67)));
    baseCol = mix(baseCol, pow(irid, vec3(2.2)), 0.65);
    rough = 0.12;
    metal = 0.65;
  } else if (mt == 12) { // marble
    float mWave = sin(wp.x * 6.0 + wp.y * 4.0 + noise3(wp * 5.0) * 5.5);
    float veinM = smoothstep(0.75, 0.98, abs(mWave));
    baseCol = mix(baseCol, baseCol * 0.42, veinM * 0.55);
    rough = 0.16;
  } else if (uDetail > 0.001) {
    float det = (noise3(wp * 14.0) * 0.65 + noise3(wp * 34.0) * 0.35) - 0.5;
    baseCol *= (1.0 + det * uDetail);
  }

  float shadowVis = calcShadow(N, L1);
  vec3 shadowTint = mix(pow(max(uShadowColor, vec3(0.18)), vec3(1.8)) * 0.72 + vec3(0.18), vec3(1.0), shadowVis);
  float ndl1 = max(dot(N, L1), 0.0);
  float ndl2 = max(dot(N, L2), 0.0);
  float ndv = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - ndv, 3.6);

  vec3 keyLin = pow(max(uKeyCol, vec3(0.0)), vec3(2.2));
  vec3 fillLin = pow(max(uFillCol, vec3(0.0)), vec3(2.2));

  // Dynamic 4 Point Lights + 1 Spot Light Accumulation
  vec3 dynDiff = vec3(0.0);
  vec3 dynSpec = vec3(0.0);
  float shininess = exp2(9.2 * (1.0 - rough) + 1.4);
  for (int i = 0; i < 4; i++) {
    float pInt = uPtParam[i].x;
    if (pInt > 0.001) {
      vec3 toL = uPtPos[i] - wp;
      float d = length(toL);
      float rad = max(uPtParam[i].y, 0.1);
      float att = pow(clamp(1.0 - d / rad, 0.0, 1.0), 2.0) * pInt;
      vec3 pL = toL / max(d, 0.001);
      float pNdl = max(dot(N, pL), 0.0);
      vec3 pCol = pow(max(uPtCol[i], vec3(0.0)), vec3(2.2));
      dynDiff += pCol * pNdl * att;
      vec3 pH = normalize(pL + V);
      dynSpec += pCol * pow(max(dot(N, pH), 0.0), shininess * 0.7) * att * 0.45;
    }
  }
  if (uSpotParam.x > 0.001) {
    vec3 toS = uSpotPos - wp;
    float dS = length(toS);
    vec3 sL = toS / max(dS, 0.001);
    float spotCos = dot(-sL, normalize(uSpotDir));
    float cone = smoothstep(uSpotParam.y, uSpotParam.y + 0.14, spotCos);
    float attS = pow(clamp(1.0 - dS / max(uSpotParam.z, 0.1), 0.0, 1.0), 1.8) * uSpotParam.x * cone;
    vec3 sCol = pow(max(uSpotCol, vec3(0.0)), vec3(2.2));
    dynDiff += sCol * max(dot(N, sL), 0.0) * attS;
    dynSpec += sCol * pow(max(dot(N, normalize(sL + V)), 0.0), shininess) * attS * 0.5;
  }

  vec3 col;
  if (mt == 1) {
    // 3-BAND STUDIO GHIBLI / SPIDER-VERSE TOON CEL SHADER
    float litVal = ndl1 * (0.35 + 0.65 * shadowVis);
    float band = litVal > 0.58 ? 1.0 : (litVal > 0.18 ? 0.66 : 0.36);
    vec3 toonShade = mix(pow(max(uShadowColor, vec3(0.22)), vec3(1.8)) * 0.95 + vec3(0.16), keyLin * 1.08, band);
    float toonSpec = smoothstep(0.86, 0.91, dot(N, normalize(L1 + V))) * shadowVis * (1.0 - rough) * 0.48;
    float toonRim = smoothstep(0.58, 0.72, 1.0 - ndv) * max(dot(N, L1) + 0.4, 0.0) * uRimPow * 0.55;
    col = baseCol * (toonShade + dynDiff * 0.7 + fillLin * ndl2 * 0.22 + vec3(uAmb * 0.45)) + vec3(toonSpec) + pow(max(uRimColor, vec3(0.0)), vec3(2.2)) * toonRim;
  } else {
    float wrap = max(0.0, (dot(N, L1) + 0.38) / 1.38);
    float sssTerm = (pow(max(0.0, dot(-L1, V)), 2.2) * 0.72 + wrap * 0.35) * sssAmt;
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(dot(N, H1), 0.0), shininess) * (0.14 + 0.86 * (1.0 - rough));

    // Procedural Studio HDRI Reflection
    vec3 R = reflect(-V, N);
    float skyT = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 envCol = skyT < 0.5
      ? mix(vec3(0.04, 0.05, 0.07), vec3(0.32, 0.38, 0.48), pow(skyT * 2.0, 1.5))
      : mix(vec3(0.32, 0.38, 0.48), vec3(0.76, 0.85, 0.98), pow((skyT - 0.5) * 2.0, 1.0));
    envCol += vec3(0.88, 0.90, 0.96) * smoothstep(0.76, 0.96, dot(R, normalize(vec3(0.45, 0.78, 0.42)))) * (1.0 - rough * 0.8);

    vec3 F0 = mix(vec3(0.035), baseCol, metal);
    vec3 F = F0 + (vec3(1.0) - F0) * fresnel;
    vec3 hemi = mix(vec3(0.38, 0.34, 0.28), vec3(0.84, 0.92, 1.0), N.y * 0.5 + 0.5) * max(uAmb, 0.34);

    vec3 diff = baseCol * (1.0 - metal * 0.86) * (hemi + keyLin * ndl1 * shadowTint * 1.18 + fillLin * ndl2 * 0.40 + dynDiff);
    vec3 specCol = mix(vec3(1.0), baseCol, metal) * (spec1 * keyLin * shadowVis * (0.12 + 0.88 * metal + (1.0 - rough) * 0.25) + dynSpec);
    float envW = (0.02 + 0.98 * metal + (mt == 9 ? 0.65 : 0.0)) * (0.18 + 0.82 * (1.0 - rough));
    vec3 envRefl = envCol * F * envW;
    vec3 rimGlow = pow(max(uRimColor, vec3(0.0)), vec3(2.2)) * (fresnel * 0.42 + max(dot(N, L3), 0.0) * 0.22) * uRimPow * (0.25 + 0.75 * shadowVis);
    vec3 sssCol = baseCol * vec3(1.28, 0.88, 0.90) * sssTerm * (0.45 + 0.55 * shadowVis);
    col = diff + specCol + envRefl + rimGlow + sssCol;
  }

  col += pow(max(uEmissive, vec3(0.0)), vec3(2.2)) * 1.45;
  col = col / (1.0 + col * 0.36);
  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

  if (uFogRange.y > uFogRange.x) {
    float dist = length(uEye - wp);
    float fogF = smoothstep(uFogRange.x, uFogRange.y, dist);
    col = mix(col, uFogColor, fogF * 0.85);
  }
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col * alphaOut, alphaOut);
}`;

const QUAD_VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const BLOOM_EXT_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uThreshold;
void main() {
  vec4 c = texture2D(uTex, vUv);
  float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float knee = smoothstep(uThreshold - 0.14, uThreshold + 0.18, luma);
  gl_FragColor = vec4(c.rgb * knee, 1.0);
}`;

const BLOOM_BLUR_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uSpread;
void main() {
  vec2 d = uTexel * uSpread;
  vec3 sum = texture2D(uTex, vUv).rgb * 0.20;
  sum += texture2D(uTex, vUv + vec2(-d.x, -d.y)).rgb * 0.20;
  sum += texture2D(uTex, vUv + vec2( d.x, -d.y)).rgb * 0.20;
  sum += texture2D(uTex, vUv + vec2(-d.x,  d.y)).rgb * 0.20;
  sum += texture2D(uTex, vUv + vec2( d.x,  d.y)).rgb * 0.20;
  gl_FragColor = vec4(sum, 1.0);
}`;

const POST_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSceneTex;
uniform sampler2D uBloomTex;
uniform sampler2D uDepthTex;
uniform vec2 uRes;
uniform float uBloomStrength;
uniform float uDofFocus;
uniform float uDofAperture;
uniform float uGodRayStrength;
uniform vec2 uSunScreen;
uniform vec3 uSunColor;
uniform float uLutId;
uniform float uVibrancy;
uniform float uChromatic;
uniform float uVignette;
uniform float uHasSky;

vec3 applyCinemaLut(vec3 c, int id) {
  if (id == 1) { // pixar_warm
    c = pow(c, vec3(0.97, 0.99, 1.03));
    c *= vec3(1.04, 1.01, 0.96);
  } else if (id == 2) { // ghibli_daylight
    c = mix(c, pow(c, vec3(0.94, 0.96, 0.98)), 0.5);
    c *= vec3(1.02, 1.04, 1.01);
  } else if (id == 3) { // apple_studio
    c = smoothstep(vec3(0.015), vec3(0.985), c);
    c *= vec3(0.99, 1.00, 1.02);
  } else if (id == 4) { // botanical_film
    c.g = pow(c.g, 0.95);
    c *= vec3(0.99, 1.03, 0.96);
  } else if (id == 5) { // kodak_portra
    vec3 lift = vec3(0.018, 0.012, 0.008);
    c = lift + c * vec3(1.03, 1.00, 0.94);
  } else if (id == 6) { // cyber_nocturne
    c = smoothstep(vec3(0.02), vec3(0.97), c);
    c *= vec3(0.95, 1.01, 1.08);
  }
  return clamp(c, 0.0, 1.0);
}

void main() {
  vec2 texel = 1.0 / max(uRes, vec2(1.0));
  vec4 center = texture2D(uSceneTex, vUv);

  // Subtle Chromatic Aberration at lens edges
  vec4 sceneSample = center;
  if (uChromatic > 0.001) {
    vec2 dirC = (vUv - 0.5) * uChromatic * 0.007;
    float rCh = texture2D(uSceneTex, vUv + dirC).r;
    float bCh = texture2D(uSceneTex, vUv - dirC).b;
    sceneSample.r = rCh;
    sceneSample.b = bCh;
  }

  // Smooth Cinema Depth-of-Field (8-tap bokeh disc weighted by linear depth CoC)
  if (uDofAperture > 0.005) {
    float depth = texture2D(uDepthTex, vUv).r;
    float coc = clamp(abs(depth - uDofFocus) * uDofAperture * 9.5, 0.0, 7.5);
    if (coc > 0.35) {
      vec4 acc = sceneSample;
      float rad = coc;
      acc += texture2D(uSceneTex, vUv + vec2( rad, 0.0) * texel);
      acc += texture2D(uSceneTex, vUv + vec2(-rad, 0.0) * texel);
      acc += texture2D(uSceneTex, vUv + vec2(0.0,  rad) * texel);
      acc += texture2D(uSceneTex, vUv + vec2(0.0, -rad) * texel);
      float d7 = rad * 0.707;
      acc += texture2D(uSceneTex, vUv + vec2( d7,  d7) * texel);
      acc += texture2D(uSceneTex, vUv + vec2(-d7,  d7) * texel);
      acc += texture2D(uSceneTex, vUv + vec2( d7, -d7) * texel);
      acc += texture2D(uSceneTex, vUv + vec2(-d7, -d7) * texel);
      sceneSample = acc / 9.0;
    }
  }

  float a = clamp(sceneSample.a, 0.0, 1.0);
  vec3 col = a > 0.002 ? (sceneSample.rgb / a) : vec3(0.0);

  // Vibrancy + Cinema LUT Grade
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uVibrancy);
  col = applyCinemaLut(col, int(uLutId + 0.5));

  // Add Dual-Filter Kawase Bloom
  vec3 bloom = texture2D(uBloomTex, vUv).rgb * uBloomStrength;

  // Add Volumetric Screen-Space God Rays (Sun Shafts!)
  vec3 godRay = vec3(0.0);
  if (uGodRayStrength > 0.005) {
    vec2 delta = (vUv - uSunScreen) * (1.0 / 18.0) * 0.72;
    vec2 uvR = vUv;
    float decay = 1.0;
    float raySum = 0.0;
    for (int i = 0; i < 16; i++) {
      uvR -= delta;
      vec3 s = texture2D(uBloomTex, clamp(uvR, 0.0, 1.0)).rgb;
      raySum += dot(s, vec3(0.333)) * decay;
      decay *= 0.90;
    }
    float sunDistMask = clamp(1.25 - length(vUv - uSunScreen), 0.0, 1.0);
    godRay = uSunColor * (raySum / 14.0) * uGodRayStrength * sunDistMask;
  }

  // Optional Optical Lens Vignette
  if (uVignette > 0.005 && uHasSky > 0.5) {
    float vig = 1.0 - smoothstep(0.45, 1.05, length((vUv - 0.5) * vec2(1.15, 1.05))) * uVignette;
    col *= vig;
  }

  vec3 outPremul = col * a + bloom + godRay;
  float haloA = max(max(bloom.r, bloom.g), bloom.b) * 0.85 + max(max(godRay.r, godRay.g), godRay.b) * 0.55;
  float outA = clamp(a + haloA, 0.0, 1.0);
  gl_FragColor = vec4(clamp(outPremul, 0.0, 1.0), outA);
}`;

const SHADER_FS_HEADER = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uProgress;
mat2 rot2(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
float sdSphere(vec3 p, float r){ return length(p) - r; }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdRoundBox(vec3 p, vec3 b, float r){ return sdBox(p, b) - r; }
float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdCylinder(vec3 p, float r, float h){ vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0-h); }
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(6.28318*(c*t + d)); }
`;

function compileGlShader(glCtx, type, src) {
  const sh = glCtx.createShader(type);
  glCtx.shaderSource(sh, src);
  glCtx.compileShader(sh);
  if (!glCtx.getShaderParameter(sh, glCtx.COMPILE_STATUS)) {
    const err = glCtx.getShaderInfoLog(sh) || "Shader compile error";
    glCtx.deleteShader(sh);
    throw new Error("GLSL: " + err.slice(0, 180));
  }
  return sh;
}

function linkGlProgram(glCtx, vsSrc, fsSrc) {
  const vs = compileGlShader(glCtx, glCtx.VERTEX_SHADER, vsSrc);
  const fs = compileGlShader(glCtx, glCtx.FRAGMENT_SHADER, fsSrc);
  const prog = glCtx.createProgram();
  glCtx.attachShader(prog, vs);
  glCtx.attachShader(prog, fs);
  glCtx.linkProgram(prog);
  glCtx.deleteShader(vs);
  glCtx.deleteShader(fs);
  if (!glCtx.getProgramParameter(prog, glCtx.LINK_STATUS)) {
    const err = glCtx.getProgramInfoLog(prog) || "Link error";
    glCtx.deleteProgram(prog);
    throw new Error("GLSL Link: " + err.slice(0, 160));
  }
  return prog;
}

function makeFboBundle(g, w, h, withDepth, linearFilter) {
  const tex = g.createTexture();
  g.bindTexture(g.TEXTURE_2D, tex);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
  const filt = linearFilter ? g.LINEAR : g.NEAREST;
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, filt);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, filt);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  const fbo = g.createFramebuffer();
  g.bindFramebuffer(g.FRAMEBUFFER, fbo);
  g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
  let rb = null;
  if (withDepth) {
    rb = g.createRenderbuffer();
    g.bindRenderbuffer(g.RENDERBUFFER, rb);
    g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT16, w, h);
    g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, rb);
  }
  g.bindFramebuffer(g.FRAMEBUFFER, null);
  return { fbo, tex, rb };
}

function resizeFboTargets(g, W, H, shadowRes) {
  const del = (f, t, r) => { if (f) g.deleteFramebuffer(f); if (t) g.deleteTexture(t); if (r) g.deleteRenderbuffer(r); };
  if (glShadowResCur !== shadowRes) {
    del(glShadowFbo, glShadowTex, glShadowRb);
    const sh = makeFboBundle(g, shadowRes, shadowRes, true, false);
    glShadowFbo = sh.fbo; glShadowTex = sh.tex; glShadowRb = sh.rb;
    glShadowResCur = shadowRes;
  }
  if (glW !== W || glH !== H || !glSceneFbo) {
    glCanvas.width = W; glCanvas.height = H;
    del(glSceneFbo, glSceneTex, glSceneRb);
    del(glDepthFbo, glDepthTex, glDepthRb);
    del(glBloomFboA, glBloomTexA, null);
    del(glBloomFboB, glBloomTexB, null);
    const sc = makeFboBundle(g, W, H, true, true);
    glSceneFbo = sc.fbo; glSceneTex = sc.tex; glSceneRb = sc.rb;
    const hw = Math.max(2, W >> 1), hh = Math.max(2, H >> 1);
    const dp = makeFboBundle(g, hw, hh, true, true);
    glDepthFbo = dp.fbo; glDepthTex = dp.tex; glDepthRb = dp.rb;
    const bA = makeFboBundle(g, hw, hh, false, true);
    glBloomFboA = bA.fbo; glBloomTexA = bA.tex;
    const qw = Math.max(2, W >> 2), qh = Math.max(2, H >> 2);
    const bB = makeFboBundle(g, qw, qh, false, true);
    glBloomFboB = bB.fbo; glBloomTexB = bB.tex;
    glW = W; glH = H;
  }
}

function ensureGl(W, H, shadowRes) {
  const sRes = shadowRes || 1024;
  if (!glCanvas) {
    glCanvas = new OffscreenCanvas(W, H);
    const opts = { alpha: true, antialias: true, depth: true, premultipliedAlpha: true, preserveDrawingBuffer: true };
    gl = glCanvas.getContext("webgl2", opts) || glCanvas.getContext("webgl", opts);
    if (!gl) return null;
    glBufPos = gl.createBuffer();
    glBufNorm = gl.createBuffer();
    glBufUv = gl.createBuffer();
    glBufIdx = gl.createBuffer();
    glQuadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, glQuadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    glPbrProg = linkGlProgram(gl, PBR_VS, PBR_FS);
    glShadowProg = linkGlProgram(gl, SHADOW_VS, SHADOW_FS);
    glDepthProg = linkGlProgram(gl, DEPTH_VS, DEPTH_FS);
    glBloomExtProg = linkGlProgram(gl, QUAD_VS, BLOOM_EXT_FS);
    glBloomBlurProg = linkGlProgram(gl, QUAD_VS, BLOOM_BLUR_FS);
    glPostProg = linkGlProgram(gl, QUAD_VS, POST_FS);

    glWhiteTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glWhiteTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    glDynamicTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glDynamicTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  resizeFboTargets(gl, W, H, sRes);
  return gl;
}

// Helper: Draw Full-Screen Quad for Post-FX
function drawGlQuad(g, prog) {
  const loc = g.getAttribLocation(prog, "aPos");
  g.bindBuffer(g.ARRAY_BUFFER, glQuadBuf);
  g.enableVertexAttribArray(loc);
  g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
}
// =======================================================
// GEOMETRY PRIMITIVES, VERTEX DEFORMERS, 3D TEXT & WORLD GENERATORS
// =======================================================
function recalcSmoothNormals(geo) {
  const p = geo.pos, idx = geo.idx, n = new Float32Array(p.length);
  for (let i = 0; i < idx.length; i += 3) {
    const i0 = idx[i] * 3, i1 = idx[i + 1] * 3, i2 = idx[i + 2] * 3;
    const ax = p[i1] - p[i0], ay = p[i1 + 1] - p[i0 + 1], az = p[i1 + 2] - p[i0 + 2];
    const bx = p[i2] - p[i0], by = p[i2 + 1] - p[i0 + 1], bz = p[i2 + 2] - p[i0 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    n[i0] += nx; n[i0 + 1] += ny; n[i0 + 2] += nz;
    n[i1] += nx; n[i1 + 1] += ny; n[i1 + 2] += nz;
    n[i2] += nx; n[i2 + 1] += ny; n[i2 + 2] += nz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const m = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= m; n[i + 1] /= m; n[i + 2] /= m;
  }
  geo.norm = Array.from(n);
  return geo;
}

// Vertex Deform Modifiers: bend, twist, taper, wave, bulge, noiseDeform
function applyDeform(geo, def) {
  if (!def || typeof def !== "object") return geo;
  const p = geo.pos.slice();
  const bend = def.bend || 0, twist = def.twist || 0, taper = def.taper || 0, bulge = def.bulge || 0;
  const wv = def.wave, ns = def.noiseDeform || def.noise;
  for (let i = 0; i < p.length; i += 3) {
    let x = p[i], y = p[i + 1], z = p[i + 2];
    if (taper) { const k = Math.max(0.08, 1 + y * taper); x *= k; z *= k; }
    if (bulge) { const b = 1 + Math.cos(clampNum(y * 2.2, -1.57, 1.57)) * bulge; x *= b; z *= b; }
    if (twist) { const a = y * twist, c = Math.cos(a), s = Math.sin(a), nx = x * c - z * s, nz = x * s + z * c; x = nx; z = nz; }
    if (bend) { const a = y * bend, c = Math.cos(a), s = Math.sin(a), ny = y * c - x * s, nx = y * s + x * c; x = nx; y = ny; }
    if (wv) {
      const amp = wv.amp || 0.08, freq = wv.freq || 4.0, ph = wv.phase || 0;
      x += Math.sin(y * freq + ph) * amp;
      z += Math.cos(y * freq * 0.8 + ph) * amp * 0.7;
    }
    if (ns) {
      const amp = ns.amp || 0.06, freq = ns.freq || 3.5;
      const d = Math.sin(x * freq + y * freq * 1.3) * Math.cos(z * freq * 1.1) * amp;
      x += d; y += d * 0.7; z += d;
    }
    p[i] = x; p[i + 1] = y; p[i + 2] = z;
  }
  return recalcSmoothNormals({ pos: p, norm: geo.norm, uv: geo.uv, idx: geo.idx });
}

function buildEllipsoidGeo(rx, ry, rz, segs) {
  const s = clampNum(segs || 28, 8, 52), rings = Math.max(6, Math.round(s * 0.72));
  const pos = [], norm = [], uv = [], idx = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings, phi = v * Math.PI, sp = Math.sin(phi), cp = Math.cos(phi);
    for (let x = 0; x <= s; x++) {
      const u = x / s, th = u * Math.PI * 2, ux = sp * Math.cos(th), uy = cp, uz = sp * Math.sin(th);
      pos.push(ux * rx, uy * ry, uz * rz);
      let nx = ux / (rx || 1), ny = uy / (ry || 1), nz = uz / (rz || 1);
      const nm = Math.hypot(nx, ny, nz) || 1;
      norm.push(nx / nm, ny / nm, nz / nm); uv.push(u, 1 - v);
    }
  }
  const st = s + 1;
  for (let y = 0; y < rings; y++) for (let x = 0; x < s; x++) { const a = y * st + x, b = a + st; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  return { pos, norm, uv, idx };
}

function buildBoxGeo(w, h, d) {
  const hx = w * 0.5, hy = h * 0.5, hz = d * 0.5;
  const faces = [
    [[0, 0, 1], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]],
    [[0, 0, -1], [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]],
    [[0, 1, 0], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]],
    [[0, -1, 0], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]],
    [[1, 0, 0], [hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]],
    [[-1, 0, 0], [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]
  ];
  const pos = [], norm = [], uv = [], idx = [];
  for (let f = 0; f < 6; f++) {
    const fc = faces[f], n = fc[0], base = f * 4;
    for (let k = 1; k <= 4; k++) { pos.push(fc[k][0], fc[k][1], fc[k][2]); norm.push(n[0], n[1], n[2]); }
    uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos, norm, uv, idx };
}

function buildShadowDiscGeo(rx, rz, segs) {
  const s = clampNum(segs || 32, 12, 48);
  const pos = [0, 0, 0], norm = [0, 1, 0], uv = [0.5, 0.5], idx = [];
  for (let i = 0; i <= s; i++) {
    const a = (i / s) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    pos.push(ca * rx, 0, sa * rz);
    norm.push(0, 1, 0);
    uv.push(0.5 + ca * 0.5, 0.5 + sa * 0.5);
  }
  for (let i = 1; i <= s; i++) idx.push(0, i + 1, i);
  return { pos, norm, uv, idx };
}

function buildQuadPlaneGeo(w, h) {
  const hx = w * 0.5, hy = h * 0.5;
  return {
    pos: [-hx, -hy, 0, hx, -hy, 0, hx, hy, 0, -hx, hy, 0],
    norm: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv: [0, 0, 1, 0, 1, 1, 0, 1],
    idx: [0, 1, 2, 0, 2, 3]
  };
}

function buildRoundBoxGeo(w, h, d, rad, segs) {
  const s = clampNum(segs || 16, 8, 28), rings = Math.max(8, Math.round(s * 0.8));
  const r = Math.min(rad || 0.12, w * 0.45, h * 0.45, d * 0.45);
  const bx = Math.max(0.001, w * 0.5 - r), by = Math.max(0.001, h * 0.5 - r), bz = Math.max(0.001, d * 0.5 - r);
  const pos = [], norm = [], uv = [], idx = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings, phi = v * Math.PI, sp = Math.sin(phi), cp = Math.cos(phi);
    for (let x = 0; x <= s; x++) {
      const u = x / s, th = u * Math.PI * 2, nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
      pos.push((nx >= 0 ? 1 : -1) * bx + nx * r, (ny >= 0 ? 1 : -1) * by + ny * r, (nz >= 0 ? 1 : -1) * bz + nz * r);
      norm.push(nx, ny, nz); uv.push(u, 1 - v);
    }
  }
  const st = s + 1;
  for (let y = 0; y < rings; y++) for (let x = 0; x < s; x++) { const a = y * st + x, b = a + st; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  return { pos, norm, uv, idx };
}

function buildLatheGeo(profile, segs) {
  const s = clampNum(segs || 32, 8, 64), m = profile.length;
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j < m; j++) {
    const pPrev = profile[Math.max(0, j - 1)], pCur = profile[j], pNext = profile[Math.min(m - 1, j + 1)];
    const dr = pNext[0] - pPrev[0], dy = pNext[1] - pPrev[1];
    let nr = dy, ny = -dr; const nm = Math.hypot(nr, ny) || 1; nr /= nm; ny /= nm;
    const v = j / Math.max(1, m - 1);
    for (let i = 0; i <= s; i++) {
      const u = i / s, a = u * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(ca * pCur[0], pCur[1], sa * pCur[0]); norm.push(ca * nr, ny, sa * nr); uv.push(1 - u, v);
    }
  }
  const st = s + 1;
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < s; i++) { const a = j * st + i, b = a + st; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  return { pos, norm, uv, idx };
}

function buildCapsuleGeo(r, len, segs) {
  const s = clampNum(segs || 20, 8, 36), halfCyl = Math.max(0.001, (len || 0.6) * 0.5), prof = [];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI * 0.5 + (i / 6) * Math.PI * 0.5; prof.push([Math.cos(a) * r, -halfCyl + Math.sin(a) * r]); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 0.5; prof.push([Math.cos(a) * r, halfCyl + Math.sin(a) * r]); }
  return buildLatheGeo(prof, s);
}

function buildTorusGeo(R, r, segsU, segsV) {
  const su = clampNum(segsU || 40, 12, 64), sv = clampNum(segsV || 20, 8, 36);
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j <= sv; j++) {
    const v = j / sv, phi = v * Math.PI * 2, cp = Math.cos(phi), sp = Math.sin(phi);
    for (let i = 0; i <= su; i++) {
      const u = i / su, th = u * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th), rr = R + r * cp;
      pos.push(rr * ct, r * sp, rr * st); norm.push(cp * ct, sp, cp * st); uv.push(u, v);
    }
  }
  const st = su + 1;
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) { const a = j * st + i, b = a + st; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  return { pos, norm, uv, idx };
}

function buildPetalGeo(w, h, cup, curl) {
  const nu = 6, nv = 8, grid = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, halfW = w * 0.5 * Math.max(0.08, Math.sin(Math.pow(v, 0.72) * Math.PI) * (0.85 + 0.25 * Math.sin(v * Math.PI)));
    const y = v * h, curlZ = Math.pow(v, 2.6) * (curl || 0.16), row = [];
    for (let i = 0; i <= nu; i++) { const u = i / nu, su = (u - 0.5) * 2; row.push([su * halfW, y, -(1 - su * su) * (cup || 0.12) * Math.sin(v * Math.PI) + curlZ]); }
    grid.push(row);
  }
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p0 = grid[j][i], pL = grid[j][Math.max(0, i - 1)], pR = grid[j][Math.min(nu, i + 1)];
    const pD = grid[Math.max(0, j - 1)][i], pU = grid[Math.min(nv, j + 1)][i];
    const tx = pR[0] - pL[0], ty = pR[1] - pL[1], tz = pR[2] - pL[2], bx = pU[0] - pD[0], by = pU[1] - pD[1], bz = pU[2] - pD[2];
    let nx = ty * bz - tz * by, ny = tz * bx - tx * bz, nz = tx * by - ty * bx; const nm = Math.hypot(nx, ny, nz) || 1;
    pos.push(p0[0], p0[1], p0[2]); norm.push(nx / nm, ny / nm, nz / nm); uv.push(i / nu, j / nv);
  }
  const st = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * st + i, b = a + st; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  return { pos, norm, uv, idx };
}

function buildLeafGeo(len, wid, bend) {
  const nu = 6, nv = 8, grid = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, halfW = wid * 0.5 * Math.sin(Math.pow(v, 0.78) * Math.PI), z = v * len;
    const archY = Math.sin(v * Math.PI) * (bend || 0.14) - v * v * (bend || 0.14) * 1.1, row = [];
    for (let i = 0; i <= nu; i++) { const u = i / nu, su = (u - 0.5) * 2; row.push([su * halfW, archY + Math.abs(su) * 0.06 * wid * Math.sin(v * Math.PI), z]); }
    grid.push(row);
  }
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p0 = grid[j][i], pL = grid[j][Math.max(0, i - 1)], pR = grid[j][Math.min(nu, i + 1)];
    const pD = grid[Math.max(0, j - 1)][i], pU = grid[Math.min(nv, j + 1)][i];
    const tx = pR[0] - pL[0], ty = pR[1] - pL[1], tz = pR[2] - pL[2], bx = pU[0] - pD[0], by = pU[1] - pD[1], bz = pU[2] - pD[2];
    let nx = ty * bz - tz * by, ny = tz * bx - tx * bz, nz = tx * by - ty * bx; const nm = Math.hypot(nx, ny, nz) || 1;
    pos.push(p0[0], p0[1], p0[2]); norm.push(nx / nm, ny / nm, nz / nm); uv.push(i / nu, j / nv);
  }
  const st = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * st + i, b = a + st; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  return { pos, norm, uv, idx };
}

function buildTubeGeo(pathPts, rStart, rEnd, segs) {
  const s = clampNum(segs || 16, 6, 36), m = pathPts.length;
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j < m; j++) {
    const v = j / Math.max(1, m - 1), r = lerpNum(rStart, rEnd !== undefined ? rEnd : rStart, v);
    const pCur = pathPts[j], pPrev = pathPts[Math.max(0, j - 1)], pNext = pathPts[Math.min(m - 1, j + 1)];
    let tx = pNext[0] - pPrev[0], ty = pNext[1] - pPrev[1], tz = pNext[2] - pPrev[2];
    const tm = Math.hypot(tx, ty, tz) || 1; tx /= tm; ty /= tm; tz /= tm;
    const up = Math.abs(ty) > 0.92 ? [1, 0, 0] : [0, 1, 0];
    let rx = up[1] * tz - up[2] * ty, ry = up[2] * tx - up[0] * tz, rz = up[0] * ty - up[1] * tx;
    const rm = Math.hypot(rx, ry, rz) || 1; rx /= rm; ry /= rm; rz /= rm;
    const bx = ty * rz - tz * ry, by = tz * rx - tx * rz, bz = tx * ry - ty * rx;
    for (let i = 0; i <= s; i++) {
      const u = i / s, a = u * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const nx = rx * ca + bx * sa, ny = ry * ca + by * sa, nz = rz * ca + bz * sa;
      pos.push(pCur[0] + nx * r, pCur[1] + ny * r, pCur[2] + nz * r); norm.push(nx, ny, nz); uv.push(u, v);
    }
  }
  const st = s + 1;
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < s; i++) { const a = j * st + i, b = a + st; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  return { pos, norm, uv, idx };
}

function buildTerrainGeo(w, d, segs, heightFn) {
  const s = clampNum(segs || 28, 8, 48), pos = [], uv = [], idx = [];
  for (let j = 0; j <= s; j++) {
    const v = j / s, z = (v - 0.5) * d;
    for (let i = 0; i <= s; i++) {
      const u = i / s, x = (u - 0.5) * w;
      const y = heightFn ? heightFn(x, z) : (Math.sin(x * 0.7) * Math.cos(z * 0.65) * 0.25);
      pos.push(x, y, z); uv.push(u, v);
    }
  }
  const st = s + 1;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const a = j * st + i, b = a + st; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  return recalcSmoothNormals({ pos, norm: new Array(pos.length).fill(0), uv, idx });
}

// Compact Vector Stroke Font for True Beveled 3D Extruded Text (A-Z, 0-9, punctuation)
const GLYPHS_3D = {
  A:[[[0,0],[0.5,1],[1,0]],[[0.2,0.38],[0.8,0.38]]],
  B:[[[0,0],[0,1],[0.7,1],[0.9,0.78],[0.7,0.52],[0,0.52]],[[0.7,0.52],[0.95,0.28],[0.7,0],[0,0]]],
  C:[[[0.95,0.82],[0.65,1],[0.25,1],[0,0.72],[0,0.28],[0.25,0],[0.65,0],[0.95,0.18]]],
  D:[[[0,0],[0,1],[0.62,1],[0.95,0.72],[0.95,0.28],[0.62,0],[0,0]]],
  E:[[[0.9,1],[0,1],[0,0],[0.9,0]],[[0,0.52],[0.72,0.52]]],
  F:[[[0.9,1],[0,1],[0,0]],[[0,0.52],[0.72,0.52]]],
  G:[[[0.92,0.82],[0.62,1],[0.25,1],[0,0.72],[0,0.28],[0.25,0],[0.72,0],[0.95,0.25],[0.95,0.48],[0.52,0.48]]],
  H:[[[0,0],[0,1]],[[0.9,0],[0.9,1]],[[0,0.52],[0.9,0.52]]],
  I:[[[0.45,0],[0.45,1]],[[0.18,1],[0.72,1]],[[0.18,0],[0.72,0]]],
  J:[[[0.82,1],[0.82,0.25],[0.58,0],[0.22,0],[0,0.22]]],
  K:[[[0,0],[0,1]],[[0.9,1],[0.08,0.5],[0.92,0]]],
  L:[[[0,1],[0,0],[0.88,0]]],
  M:[[[0,0],[0,1],[0.5,0.42],[1,1],[1,0]]],
  N:[[[0,0],[0,1],[0.9,0],[0.9,1]]],
  O:[[[0.25,0],[0.75,0],[1,0.28],[1,0.72],[0.75,1],[0.25,1],[0,0.72],[0,0.28],[0.25,0]]],
  P:[[[0,0],[0,1],[0.7,1],[0.95,0.78],[0.7,0.5],[0,0.5]]],
  Q:[[[0.25,0],[0.75,0],[1,0.28],[1,0.72],[0.75,1],[0.25,1],[0,0.72],[0,0.28],[0.25,0]],[[0.62,0.32],[1.05,-0.06]]],
  R:[[[0,0],[0,1],[0.7,1],[0.95,0.78],[0.7,0.5],[0,0.5]],[[0.55,0.5],[0.95,0]]],
  S:[[[0.92,0.82],[0.68,1],[0.22,1],[0.02,0.78],[0.22,0.54],[0.72,0.46],[0.95,0.24],[0.72,0],[0.22,0],[0,0.18]]],
  T:[[[0,1],[1,1]],[[0.5,1],[0.5,0]]],
  U:[[[0,1],[0,0.25],[0.25,0],[0.7,0],[0.95,0.25],[0.95,1]]],
  V:[[[0,1],[0.5,0],[1,1]]],
  W:[[[0,1],[0.22,0],[0.5,0.58],[0.78,0],[1,1]]],
  X:[[[0,1],[0.95,0]],[[0.95,1],[0,0]]],
  Y:[[[0,1],[0.48,0.5],[0.96,1]],[[0.48,0.5],[0.48,0]]],
  Z:[[[0,1],[0.95,1],[0,0],[0.95,0]]],
  "0":[[[0.25,0],[0.7,0],[0.92,0.25],[0.92,0.75],[0.7,1],[0.25,1],[0,0.75],[0,0.25],[0.25,0]]],
  "1":[[[0.22,0.78],[0.52,1],[0.52,0]],[[0.22,0],[0.82,0]]],
  "2":[[[0.05,0.78],[0.3,1],[0.75,1],[0.95,0.75],[0.05,0],[0.95,0]]],
  "3":[[[0.05,0.84],[0.32,1],[0.75,1],[0.95,0.76],[0.7,0.52],[0.35,0.52]],[[0.7,0.52],[0.95,0.26],[0.72,0],[0.28,0],[0.05,0.16]]],
  "4":[[[0.72,0],[0.72,1],[0,0.34],[0.96,0.34]]],
  "5":[[[0.9,1],[0.08,1],[0.08,0.56],[0.72,0.56],[0.95,0.32],[0.72,0],[0.2,0],[0.04,0.16]]],
  "6":[[[0.85,0.88],[0.55,1],[0.22,1],[0,0.72],[0,0.25],[0.25,0],[0.72,0],[0.92,0.25],[0.72,0.5],[0.04,0.5]]],
  "7":[[[0,1],[0.95,1],[0.35,0]]],
  "8":[[[0.25,0.5],[0.05,0.74],[0.28,1],[0.72,1],[0.92,0.74],[0.72,0.5],[0.25,0.5],[0,0.26],[0.25,0],[0.72,0],[0.95,0.26],[0.72,0.5]]],
  "9":[[[0.12,0.12],[0.4,0],[0.74,0],[0.94,0.28],[0.94,0.75],[0.72,1],[0.26,1],[0.04,0.75],[0.26,0.5],[0.9,0.5]]],
  "!":[[[0.45,1],[0.45,0.30]],[[0.45,0.08],[0.45,0.0]]],
  ".":[[[0.35,0.08],[0.35,0.0]]],
  "-":[[[0.15,0.5],[0.8,0.5]]],
  "+":[[[0.15,0.5],[0.85,0.5]],[[0.5,0.15],[0.5,0.85]]],
  "/":[[[0.1,0],[0.85,1]]],
  ":":[[[0.35,0.72],[0.35,0.64]],[[0.35,0.22],[0.35,0.14]]]
};

const SKY_PRESETS = {
  golden_hour:   { mode: 1, zenith: "#29528A", horizon: "#FFB878", ground: "#4A3428", sun: "#FFE3A6" },
  ghibli_sky:    { mode: 1, zenith: "#1D78D8", horizon: "#B5E6FF", ground: "#468C5A", sun: "#FFF9DC" },
  soft_daylight: { mode: 1, zenith: "#5D9CE6", horizon: "#EBF4FC", ground: "#9BB59E", sun: "#FFFDF2" },
  studio_cyc:    { mode: 1, zenith: "#101622", horizon: "#243044", ground: "#0B0F18", sun: "#C4DCFF" },
  emerald_mist:  { mode: 1, zenith: "#062118", horizon: "#1A5C44", ground: "#04120C", sun: "#9EF5CA" },
  starry_night:  { mode: 2, zenith: "#040814", horizon: "#142442", ground: "#050912", sun: "#D2E6FF" }
};

// Attaches World, Botanical, Hardware & Text3D helpers onto any g3d node!
function attachWorldHelpers(nodeApi, tSec, randFn) {
  nodeApi.text3D = (str, pos, rot, opts) => {
    const o = opts || {}, txt = String(str || "3D").toUpperCase();
    const h = o.size || 0.65, thick = o.thickness || (h * 0.13), gap = h * 0.84;
    const totalW = Math.max(0, (txt.length - 1) * gap + h * 0.72);
    const startX = o.align === "left" ? 0 : (o.align === "right" ? -totalW : -totalW * 0.5);
    const mat = o.mat || { color: o.color || "#F5F8FC", color2: o.color2 || "#A8C6E8", material: o.material || "brushed_metal", roughness: 0.18, metalness: 0.82, rim: 0.7 };
    const root = nodeApi.node({ pos: pos || [0, 0, 0], rot: rot || [0, 0, 0] });
    for (let ci = 0; ci < txt.length; ci++) {
      const strokes = GLYPHS_3D[txt[ci]];
      if (!strokes) continue;
      const ox = startX + ci * gap;
      for (let si = 0; si < strokes.length; si++) {
        const pts = strokes[si].map((pt) => [ox + pt[0] * h * 0.68, pt[1] * h - h * 0.5, 0]);
        if (pts.length === 2 && pts[0][0] === pts[1][0] && Math.abs(pts[0][1] - pts[1][1]) < 0.08) {
          root.sphere(pts[0], thick * 0.65, mat, 14);
        } else {
          root.tube(pts, thick * 0.52, thick * 0.52, mat, 10);
          root.sphere(pts[0], thick * 0.52, mat, 10);
          root.sphere(pts[pts.length - 1], thick * 0.52, mat, 10);
        }
      }
    }
    return root;
  };

  nodeApi.terrain = (opts) => {
    const o = opts || {};
    const geo = buildTerrainGeo(o.width || 9, o.depth || 9, o.segs || 28, o.heightFn);
    const mat = o.mat || { color: o.color || "#2B8A44", color2: o.color2 || "#56BC68", material: o.material || "clay", roughness: 0.78, castShadow: false };
    return nodeApi.mesh(geo, o.pos || [0, 0, 0], o.rot || [0, 0, 0], 1, mat);
  };

  nodeApi.cloud = (pos, opts) => {
    const o = opts || {}, sc = o.scale || 1;
    const mat = o.mat || { color: o.color || "#E6F0FA", color2: "#FFFFFF", material: o.material || "clay", roughness: 0.85, castShadow: false, rim: 0.3 };
    const cNode = nodeApi.node({ pos: pos || [0, 3.2, -3], scale: sc });
    cNode.ellipsoid([0, 0, 0], [0.75, 0.42, 0.48], [0, 0, 0], mat, 20);
    cNode.ellipsoid([-0.55, -0.06, 0.05], [0.48, 0.32, 0.38], [0, 0, 0], mat, 16);
    cNode.ellipsoid([0.56, -0.08, -0.04], [0.52, 0.30, 0.36], [0, 0, 0], mat, 16);
    cNode.ellipsoid([0.16, 0.24, -0.06], [0.42, 0.28, 0.34], [0, 0, 0], mat, 16);
    return cNode;
  };

  nodeApi.tree = (pos, opts) => {
    const o = opts || {}, sc = o.scale || 1, sway = Math.sin(tSec * 1.6 + (pos ? pos[0] : 0)) * 0.04;
    const tNode = nodeApi.node({ pos: pos || [0, 0, 0], scale: sc });
    const trunkMat = { color: o.trunkColor || "#6B442A", color2: "#8E5E3E", material: "wood", roughness: 0.75 };
    const leafMat = { color: o.leafColor || "#1E8449", color2: o.leafColor2 || "#52C978", material: o.material || "foliage", roughness: 0.55, sss: 0.35 };
    tNode.shadow([0, 0.01, 0], 0.95, 0.95, 0.32);
    tNode.tube([[0, 0, 0], [0.05, 0.65, 0.02], [sway, 1.35, 0]], 0.16, 0.09, trunkMat, 14);
    tNode.tube([[0.03, 0.85, 0], [0.38, 1.22, 0.14]], 0.07, 0.035, trunkMat, 10);
    tNode.tube([[0.02, 0.92, 0], [-0.36, 1.28, -0.10]], 0.065, 0.035, trunkMat, 10);
    const crown = tNode.node({ pos: [sway, 1.48, 0], rot: [0, 0, -sway * 0.8] });
    crown.ellipsoid([0, 0.15, 0], [0.76, 0.58, 0.72], [0, 0, 0], leafMat, 22);
    crown.ellipsoid([0.52, -0.06, 0.22], [0.50, 0.40, 0.46], [0, 0, 0], leafMat, 18);
    crown.ellipsoid([-0.50, -0.02, -0.18], [0.54, 0.42, 0.48], [0, 0, 0], leafMat, 18);
    crown.ellipsoid([0.08, 0.48, -0.14], [0.46, 0.36, 0.44], [0, 0, 0], leafMat, 18);
    return tNode;
  };

  nodeApi.flower = (type, pos, opts) => {
    const o = opts || {}, bloom = o.bloom !== undefined ? o.bloom : 1.0, grow = o.grow !== undefined ? o.grow : 1.0;
    const fNode = nodeApi.node({ pos: pos || [0, 0, 0], scale: o.scale || 1 });
    const stemH = (o.stemHeight || 0.78) * grow;
    const sway = Math.sin(tSec * 2.1 + (pos ? pos[0] : 0)) * 0.04 * grow;
    fNode.tube([[0, 0, 0], [sway * 0.5, stemH * 0.5, 0.02], [sway, stemH, 0]], 0.034, 0.024, { color: "#156E36", color2: "#2CB85C", material: "foliage", roughness: 0.42 }, 12);
    for (let i = 0; i < 2; i++) {
      fNode.leaf([sway * 0.4, stemH * (0.36 + i * 0.22), 0], [0.35, i * 2.8 + 0.5, 0], 0.42 * grow, 0.19 * grow, 0.08, { color: "#1B8242", color2: "#4CD47A", material: "foliage" });
    }
    const head = fNode.node({ pos: [sway, stemH, 0] });
    const col = o.color || (type === "sunflower" ? "#F5B82E" : (type === "sakura" ? "#FF9BB8" : (type === "chili_plant" ? "#E52424" : "#D92344")));
    const col2 = o.color2 || (type === "sunflower" ? "#FFE47A" : "#FF96AE");

    if (type === "chili_plant") {
      // Sculpted Branching Chili Plant with Glossy Red Chilies!
      for (let i = 0; i < 4; i++) {
        const a = i * 1.57 + 0.4;
        const br = head.node({ pos: [0, -0.08 + i * 0.04, 0], rot: [0.45, a, 0] });
        br.leaf([0, 0, 0], [0.25, 0, 0], 0.38 * grow, 0.17 * grow, 0.06, { color: "#1D8644", color2: "#50D67E", material: "foliage" });
        const chiliPts = [[0, -0.02, 0.14], [0, -0.14, 0.17], [0.02, -0.26, 0.14], [0.04, -0.34, 0.09]];
        br.tube(chiliPts, 0.048 * bloom, 0.010 * bloom, { color: "#B81212", color2: col, roughness: 0.18, sss: 0.35 }, 12);
      }
    } else if (type === "sunflower") {
      head.ellipsoid([0, 0, 0], [0.18 * bloom, 0.08 * bloom, 0.18 * bloom], [0.5, 0, 0], { color: "#3A2212", color2: "#5C3A20", material: "clay" }, 20);
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI * 2) / 16;
        head.petal([Math.sin(a) * 0.14 * bloom, 0, Math.cos(a) * 0.14 * bloom], [1.18, a, 0], 0.12 * bloom, 0.32 * bloom, 0.03, 0.04, { color: col, color2: col2, sss: 0.42 });
      }
    } else if (type === "tulip") {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        head.petal([Math.sin(a) * 0.07, 0, Math.cos(a) * 0.07], [0.22 + (1 - bloom) * 0.1 + bloom * 0.22, a, 0], 0.24 * grow, 0.44 * grow, 0.12, -0.04, { color: col, color2: col2, sss: 0.48 });
      }
    } else {
      // Sculpted Rose or Sakura
      const count = type === "sakura" ? 5 : 24, golden = type === "sakura" ? (Math.PI * 2 / 5) : 2.399963229728653;
      if (type === "sakura") head.sphere([0, 0.04, 0], 0.06 * bloom, { color: "#FFD166", emissive: "#FFB703" }, 12);
      for (let i = 0; i < count; i++) {
        const lay = count > 1 ? i / (count - 1) : 0.5;
        const pb = ease.snap(clampNum((bloom - (1 - lay) * 0.25) / 0.75, 0, 1));
        const a = i * golden, rad = (type === "sakura" ? 0.05 : lerpNum(0.02, 0.20, Math.pow(lay, 0.9))) * grow;
        const pW = (type === "sakura" ? 0.24 : lerpNum(0.14, 0.36, lay)) * grow;
        const pH = (type === "sakura" ? 0.32 : lerpNum(0.22, 0.46, lay)) * grow;
        const pitch = type === "sakura" ? lerpNum(0.3, 1.15, pb) : lerpNum(0.08, 0.14 + 0.56 * Math.pow(lay, 1.25), pb);
        head.petal([Math.sin(a) * rad, (1 - lay) * 0.10 * grow, Math.cos(a) * rad], [pitch, a, 0], pW, pH, 0.06, 0.08 * pb, {
          color: (type === "rose" && lay < 0.4) ? "#6B0D22" : col, color2: col2, roughness: 0.36, sss: 0.48
        });
      }
    }
    return fNode;
  };

  nodeApi.phone3D = (pos, rot, opts) => {
    const o = opts || {}, ph = nodeApi.node({ pos: pos || [0, 0.8, 0], rot: rot || [0, 0, 0], scale: o.scale || 1 });
    ph.roundBox([0, 0, 0], [1.18, 2.38, 0.13], 0.14, [0, 0, 0], { color: o.frameColor || "#8B95A5", color2: "#E4EAF2", material: "brushed_metal", roughness: 0.16, metalness: 0.94, rim: 0.85 }, 20);
    ph.roundBox([0, 0, 0.052], [1.08, 2.26, 0.035], 0.10, [0, 0, 0], { color: "#07090E", roughness: 0.10, metalness: 0.1 }, 16);
    // Live Dynamic 2D Canvas Screen Plane!
    ph.mesh(buildQuadPlaneGeo(1.02, 2.18), [0, 0, 0.072], [0, 0, 0], 1, {
      color: "#FFFFFF", map: o.screen || null, unlit: o.screen ? true : false, roughness: 0.08, emissive: o.screen ? "#111824" : "#0A1424"
    });
    // Back Camera Island
    ph.roundBox([-0.26, 0.76, -0.085], [0.46, 0.46, 0.06], 0.09, [0, 0, 0], { color: "#252C38", material: "glass", roughness: 0.14 }, 14);
    [[-0.36, 0.86], [-0.36, 0.66], [-0.16, 0.76]].forEach((lp) => {
      ph.cylinder([lp[0], lp[1], -0.11], 0.075, 0.075, 0.05, [Math.PI * 0.5, 0, 0], { color: "#141820", material: "brushed_metal" }, 18);
    });
    return ph;
  };

  nodeApi.bottle3D = (pos, rot, opts) => {
    const o = opts || {}, bt = nodeApi.node({ pos: pos || [0, 0, 0], rot: rot || [0, 0, 0], scale: o.scale || 1 });
    bt.shadow([0, 0.005, 0], 0.48, 0.48, 0.34);
    const prof = [[0, 0], [0.36, 0], [0.40, 0.08], [0.40, 1.05], [0.32, 1.24], [0.16, 1.38], [0.16, 1.56], [0, 1.56]];
    bt.lathe(prof, [0, 0, 0], [0, 0, 0], { color: o.color || "#1B6E3E", color2: o.color2 || "#3AD078", material: o.material || "glass", roughness: 0.16, alpha: o.alpha !== undefined ? o.alpha : 0.92 }, 36);
    bt.cylinder([0, 1.66, 0], 0.175, 0.17, 0.22, [0, 0, 0], { color: o.capColor || "#F2F5F8", roughness: 0.32 }, 24);
    if (o.label) {
      // Curved front label band with dynamic 2D canvas texture!
      const lProf = [[0.408, 0.24], [0.408, 0.94]];
      bt.lathe(lProf, [0, 0, 0], [0, 0, 0], { color: "#FFFFFF", map: o.label, roughness: 0.35 }, 36);
    }
    return bt;
  };

  nodeApi.scatter = (type, opts) => {
    const o = opts || {}, count = clampNum(o.count || 28, 4, 140), rad = o.radius || 2.1, minR = o.minRadius || 0.4;
    const hFn = o.heightFn || (() => 0);
    const seedOff = o.seedOffset || 1200;
    for (let i = 0; i < count; i++) {
      const a = randFn(seedOff + i * 3) * Math.PI * 2;
      const r = lerpNum(minR, rad, Math.sqrt(randFn(seedOff + i * 3 + 1)));
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = hFn(x, z);
      const sc = lerpNum(0.65, 1.25, randFn(seedOff + i * 3 + 2)) * (o.scale || 1);
      if (type === "pebbles") {
        nodeApi.ellipsoid([x, y + 0.03 * sc, z], [0.10 * sc, 0.055 * sc, 0.08 * sc], [0, a, 0], { color: i % 2 === 0 ? "#8E8A82" : "#A6A298", material: "clay" }, 12);
      } else if (type === "wildflowers") {
        nodeApi.cylinder([x, y + 0.07 * sc, z], 0.012 * sc, 0.01 * sc, 0.14 * sc, [0, 0, 0], { color: "#28924C" }, 8);
        nodeApi.sphere([x, y + 0.15 * sc, z], 0.042 * sc, { color: i % 3 === 0 ? "#FFD166" : (i % 3 === 1 ? "#FF8FA3" : "#FFFFFF"), emissive: i % 3 === 0 ? "#A87400" : "#000000" }, 10);
      } else {
        nodeApi.grassTuft([x, y, z], sc * 0.85, i % 2 === 0 ? (o.color || "#258C44") : "#34A858");
      }
    }
    return nodeApi;
  };
}
// =======================================================
// CORE G3D SCENE COMPOSITOR (4-PASS GPU), TEXTURES, PROJECTION & 3D PARTICLES
// =======================================================
function makeG3dApi(W, H, tSec, pVal, randFn, isExportMode) {
  const g3dObj = {
    get supported() { return !!ensureGl(W, H, isExportMode ? 2048 : 1024); },

    // Creates a dynamic 2D OffscreenCanvas texture to wrap onto any 3D mesh/phone/bottle!
    texture(drawFn, size) {
      const tw = clampNum(size || 512, 128, 1024);
      const th = tw;
      const oc = new OffscreenCanvas(tw, th);
      const c2 = oc.getContext("2d");
      if (c2 && typeof drawFn === "function") drawFn(c2, tw, th);
      return { __canvas2d: oc, width: tw, height: th };
    },

    scene(opts) {
      const o = opts || {};
      let eye = o.eye || [0, 1.5, 6];
      let target = o.target || [0, 0, 0];
      let up = o.up || [0, 1, 0];
      let fov = o.fov || 0.68;
      let skyCfg = null;

      const lights = {
        key: o.keyDir || [0.55, 0.82, 0.48],
        fill: o.fillDir || [-0.72, 0.25, -0.35],
        rim: o.rimDir || [-0.25, 0.55, -0.82],
        keyCol: hexToVec3(o.keyColor || "#FFF3DF"),
        fillCol: hexToVec3(o.fillColor || "#A8D0FF"),
        amb: o.ambient !== undefined ? o.ambient : 0.28,
        shadows: o.shadows !== false,
        shadowExtent: o.shadowExtent || 4.2,
        shadowColor: hexToVec3(o.shadowColor || "#354866"),
        fogCol: hexToVec3(o.fogColor || "#06090F"),
        fogNear: o.fogNear || 0,
        fogFar: o.fogFar || 0,
        points: [],
        spot: null
      };

      const postCfg = {
        bloom: o.bloom !== undefined ? o.bloom : 0.28,
        bloomThreshold: o.bloomThreshold !== undefined ? o.bloomThreshold : 0.78,
        dofFocus: o.dofFocus !== undefined ? o.dofFocus : 6.0,
        dofAperture: o.dofAperture !== undefined ? o.dofAperture : 0.0,
        godRays: o.godRays !== undefined ? o.godRays : 0.0,
        lut: o.lut || "none",
        vibrancy: o.vibrancy !== undefined ? o.vibrancy : 1.18,
        chromatic: o.chromatic !== undefined ? o.chromatic : 0.0,
        vignette: o.vignette !== undefined ? o.vignette : 0.22
      };

      const items = [];

      const createNode = (parentWorldM, nodeOpts) => {
        const no = nodeOpts || {};
        const localM = m4Transform(no.pos, no.rot, no.scale);
        const worldM = m4Multiply(parentWorldM, localM);
        const pushMesh = (geo, pos, rot, scale, mat) => {
          const m = mat || {};
          const finalGeo = m.deform ? applyDeform(geo, m.deform) : geo;
          const itemM = m4Multiply(worldM, m4Transform(pos, rot, scale));
          items.push({ geo: finalGeo, modelM: itemM, mat: m });
        };
        const nodeApi = {
          worldMatrix: worldM,
          node(childOpts) { return createNode(worldM, childOpts); },
          sphere(pos, r, mat, segs) { pushMesh(buildEllipsoidGeo(r || 1, r || 1, r || 1, segs), pos, [0, 0, 0], 1, mat); return nodeApi; },
          ellipsoid(pos, radii, rot, mat, segs) {
            const rr = Array.isArray(radii) ? radii : [radii || 1, radii || 1, radii || 1];
            pushMesh(buildEllipsoidGeo(rr[0], rr[1], rr[2], segs), pos, rot, 1, mat); return nodeApi;
          },
          box(pos, size, rot, mat) {
            const sz = Array.isArray(size) ? size : [size || 1, size || 1, size || 1];
            pushMesh(buildBoxGeo(sz[0], sz[1], sz[2]), pos, rot, 1, mat); return nodeApi;
          },
          roundBox(pos, size, rad, rot, mat, segs) {
            const sz = Array.isArray(size) ? size : [size || 1, size || 1, size || 1];
            pushMesh(buildRoundBoxGeo(sz[0], sz[1], sz[2], rad, segs), pos, rot, 1, mat); return nodeApi;
          },
          capsule(pos, r, len, rot, mat, segs) { pushMesh(buildCapsuleGeo(r || 0.14, len || 0.6, segs), pos, rot, 1, mat); return nodeApi; },
          cylinder(pos, rBot, rTop, h, rot, mat, segs) {
            const hh = (h || 1) * 0.5;
            pushMesh(buildLatheGeo([[0, -hh], [rBot, -hh], [rBot, -hh], [rTop, hh], [rTop, hh], [0, hh]], segs || 32), pos, rot, 1, mat); return nodeApi;
          },
          cone(pos, r, h, rot, mat, segs) {
            const hh = (h || 1) * 0.5;
            pushMesh(buildLatheGeo([[0, -hh], [r || 0.6, -hh], [r || 0.6, -hh], [0.001, hh]], segs || 28), pos, rot, 1, mat); return nodeApi;
          },
          torus(pos, R, r, rot, mat, segsU, segsV) { pushMesh(buildTorusGeo(R || 1, r || 0.22, segsU, segsV), pos, rot, 1, mat); return nodeApi; },
          plane(pos, w, h, rot, mat) { pushMesh(buildBoxGeo(w || 2, 0.02, h || 2), pos, rot, 1, mat); return nodeApi; },
          shadow(pos, rx, rz, alpha) {
            pushMesh(buildShadowDiscGeo(rx || 0.65, rz || 0.65, 32), pos, [0, 0, 0], 1, {
              color: "#09100C", featherShadow: true, castShadow: false, alpha: alpha !== undefined ? alpha : 0.34
            });
            return nodeApi;
          },
          lathe(profile, pos, rot, mat, segs) { pushMesh(buildLatheGeo(profile, segs || 36), pos, rot, 1, mat); return nodeApi; },
          petal(pos, rot, w, h, cup, curl, mat) { pushMesh(buildPetalGeo(w || 0.5, h || 0.75, cup, curl), pos, rot, 1, mat); return nodeApi; },
          leaf(pos, rot, len, wid, bend, mat) { pushMesh(buildLeafGeo(len || 0.9, wid || 0.36, bend), pos, rot, 1, mat); return nodeApi; },
          tube(pathPts, rStart, rEnd, mat, segs) { pushMesh(buildTubeGeo(pathPts, rStart || 0.08, rEnd, segs || 16), [0, 0, 0], [0, 0, 0], 1, mat); return nodeApi; },
          grassTuft(pos, scale, colorHex) {
            const sc = scale || 1, col = colorHex || "#2E9E52";
            const blades = [0.0, 2.1, 4.2];
            for (let i = 0; i < 3; i++) {
              pushMesh(buildLeafGeo(0.28 * sc, 0.065 * sc, 0.06 * sc), pos, [-0.85, blades[i], 0], 1, {
                color: col, color2: "#6CE08A", material: "foliage", roughness: 0.38, sss: 0.35
              });
            }
            return nodeApi;
          },
          mesh(geo, pos, rot, scale, mat) { pushMesh(geo, pos, rot, scale, mat); return nodeApi; }
        };
        attachWorldHelpers(nodeApi, tSec, randFn);
        if (typeof attachProNodeProps === "function") attachProNodeProps(nodeApi, g3dObj, tSec);
        return nodeApi;
      };

      const rootNode = createNode(m4Identity(), {});

      // REAL 3D VOLUMETRIC PARTICLE SYSTEMS (Z-Buffered, DoF-Aware & Orbit-True!)
      const fx3dFn = (type, opts) => {
        const o = opts || {};
        if (type === "water_stream") {
          const from = o.from || [0, 1.0, 0], to = o.to || [0.6, 0.4, 0];
          const count = clampNum(o.count || 14, 4, 32), col = o.color || "#4CC8FF";
          for (let i = 0; i < count; i++) {
            const u = (tSec * (o.speed || 2.2) + i / count) % 1;
            const spread = (randFn(2100 + i) - 0.5) * (o.spread || 0.08) * u;
            const px = lerpNum(from[0], to[0], u) + spread;
            const pz = lerpNum(from[2], to[2], u) + (randFn(2140 + i) - 0.5) * 0.06 * u;
            const arcY = lerpNum(from[1], to[1], u * u) + Math.sin(u * Math.PI) * (o.arc || 0.14);
            rootNode.ellipsoid([px, arcY, pz], [0.022, 0.044, 0.022], [0.25, 0, 0], {
              color: col, material: "water", alpha: 0.86, castShadow: false
            }, 10);
          }
          // Ground splash ripples at impact target
          for (let r = 0; r < 2; r++) {
            const ru = (tSec * 2.4 + r * 0.5) % 1;
            rootNode.torus([to[0], to[1] + 0.015, to[2]], 0.04 + ru * 0.16, 0.008 * (1 - ru), [Math.PI * 0.5, 0, 0], {
              color: "#A8E6FF", unlit: true, alpha: (1 - ru) * 0.65, castShadow: false
            }, 20, 8);
          }
        } else if (type === "fireflies") {
          const count = clampNum(o.count || 18, 4, 45), rad = o.radius || 2.8, col = o.color || "#FFE066";
          const ctr = o.center || [0, 1.1, 0];
          for (let i = 0; i < count; i++) {
            const a = randFn(2200 + i) * Math.PI * 2 + tSec * (0.25 + (i % 3) * 0.12);
            const rr = lerpNum(0.4, rad, randFn(2250 + i));
            const fy = ctr[1] + (randFn(2300 + i) - 0.35) * (o.height || 1.8) + Math.sin(tSec * 1.8 + i) * 0.18;
            const pulse = 0.55 + 0.45 * Math.sin(tSec * 3.5 + i * 2.1);
            rootNode.sphere([ctr[0] + Math.cos(a) * rr, fy, ctr[2] + Math.sin(a) * rr], (0.028 + pulse * 0.018) * (o.scale || 1), {
              color: "#FFF8D0", emissive: col, unlit: false, castShadow: false
            }, 8);
          }
        } else if (type === "petals") {
          const count = clampNum(o.count || 18, 4, 40), rad = o.radius || 3.2, col = o.color || "#FF8FB1";
          for (let i = 0; i < count; i++) {
            const u = (tSec * (0.14 + (i % 3) * 0.04) + randFn(2400 + i)) % 1;
            const px = (randFn(2450 + i) - 0.5) * rad * 2 + Math.sin(tSec * 1.4 + i) * 0.45;
            const pz = (randFn(2500 + i) - 0.5) * rad * 2 + Math.cos(tSec * 1.1 + i) * 0.35;
            const py = lerpNum(3.4, -0.2, u);
            rootNode.petal([px, py, pz], [tSec * 1.6 + i, tSec * 1.2 + i * 0.7, tSec * 0.9], 0.14, 0.18, 0.03, 0.04, {
              color: col, color2: "#FFD4E2", sss: 0.5, castShadow: false
            });
          }
        } else if (type === "rain") {
          const count = clampNum(o.count || 32, 8, 60), rad = o.radius || 3.5;
          for (let i = 0; i < count; i++) {
            const u = (tSec * 1.9 + randFn(2600 + i)) % 1;
            const rx = (randFn(2660 + i) - 0.5) * rad * 2;
            const rz = (randFn(2720 + i) - 0.5) * rad * 2;
            const ry = lerpNum(3.8, 0.0, u);
            rootNode.capsule([rx, ry, rz], 0.008, 0.24, [0.06, 0, -0.05], {
              color: "#C8EAFF", unlit: true, alpha: 0.48, castShadow: false
            }, 6);
          }
        } else if (type === "dust") {
          const count = clampNum(o.count || 22, 6, 48), rad = o.radius || 3.0, col = o.color || "#FFF4D6";
          for (let i = 0; i < count; i++) {
            const dx = (randFn(2800 + i) - 0.5) * rad * 2 + Math.sin(tSec * 0.6 + i) * 0.25;
            const dy = randFn(2860 + i) * 2.8 + Math.cos(tSec * 0.5 + i) * 0.18;
            const dz = (randFn(2920 + i) - 0.5) * rad * 2;
            rootNode.sphere([dx, dy, dz], 0.018, { color: col, emissive: col, alpha: 0.55, castShadow: false }, 6);
          }
        } else if (type === "magic_swirl") {
          const ctr = o.center || [0, 0.5, 0], count = clampNum(o.count || 20, 6, 40), col = o.color || "#66F0B2";
          for (let i = 0; i < count; i++) {
            const u = (tSec * 0.55 + i / count) % 1;
            const a = u * Math.PI * 5 + i * 0.6;
            const r = lerpNum(o.radius || 0.75, 0.14, u);
            const y = ctr[1] + u * (o.height || 1.6);
            rootNode.sphere([ctr[0] + Math.cos(a) * r, y, ctr[2] + Math.sin(a) * r], 0.036 * Math.sin(u * Math.PI), {
              color: "#FFFFFF", emissive: col, castShadow: false
            }, 8);
          }
        }
        return sceneApi;
      };

      const sceneApi = Object.assign({}, rootNode, {
        texture: g3dObj.texture,
        fx3d: fx3dFn,
        sky(presetOrCfg) {
          if (!presetOrCfg) { skyCfg = null; return sceneApi; }
          if (typeof presetOrCfg === "string") {
            skyCfg = SKY_PRESETS[presetOrCfg] || SKY_PRESETS.golden_hour;
          } else {
            skyCfg = {
              mode: presetOrCfg.stars ? 2 : 1,
              zenith: presetOrCfg.zenith || "#29528A",
              horizon: presetOrCfg.horizon || "#FFB878",
              ground: presetOrCfg.ground || "#3B2F28",
              sun: presetOrCfg.sun || "#FFE3A6"
            };
          }
          return sceneApi;
        },
        post(cfg) {
          if (!cfg) return sceneApi;
          Object.keys(cfg).forEach((k) => { if (k in postCfg) postCfg[k] = cfg[k]; });
          return sceneApi;
        },
        pointLight(pos, color, intensity, radius) {
          if (lights.points.length < 4) {
            lights.points.push({
              pos: pos || [0, 1, 0],
              col: hexToVec3(color || "#FFE099"),
              intensity: intensity !== undefined ? intensity : 1.5,
              radius: radius !== undefined ? radius : 4.5
            });
          }
          return sceneApi;
        },
        spotLight(pos, dir, color, intensity, angleRad, radius) {
          const d = dir || [0, -1, 0];
          const dm = Math.hypot(d[0], d[1], d[2]) || 1;
          lights.spot = {
            pos: pos || [0, 4, 0],
            dir: [d[0] / dm, d[1] / dm, d[2] / dm],
            col: hexToVec3(color || "#FFF6E0"),
            intensity: intensity !== undefined ? intensity : 2.0,
            cosCone: Math.cos(angleRad || 0.45),
            radius: radius !== undefined ? radius : 9.0
          };
          return sceneApi;
        },
        camera(newEye, newTarget, newFov, newUp) {
          if (newEye) eye = newEye; if (newTarget) target = newTarget; if (newFov) fov = newFov; if (newUp) up = newUp;
          return sceneApi;
        },
        orbit(az, elev, dist, tgt, newFov) {
          const tt = tgt || target; target = tt;
          eye = [tt[0] + dist * Math.cos(elev) * Math.sin(az), tt[1] + dist * Math.sin(elev), tt[2] + dist * Math.cos(elev) * Math.cos(az)];
          if (newFov) fov = newFov;
          return sceneApi;
        },
        cameraRig(pProg, keys) {
          if (!Array.isArray(keys) || !keys.length) return sceneApi;
          let k0 = keys[0], k1 = keys[keys.length - 1];
          for (let i = 0; i < keys.length - 1; i++) {
            if (pProg >= keys[i].p && pProg <= keys[i + 1].p) { k0 = keys[i]; k1 = keys[i + 1]; break; }
          }
          const u = k1.p > k0.p ? ease.apple(clampNum((pProg - k0.p) / (k1.p - k0.p), 0, 1)) : 0;
          const az = lerpNum(k0.az || 0, k1.az || 0, u) + Math.sin(tSec * 0.9) * 0.022;
          const el = lerpNum(k0.elev !== undefined ? k0.elev : 0.24, k1.elev !== undefined ? k1.elev : 0.24, u) + Math.cos(tSec * 0.8) * 0.014;
          const dst = lerpNum(k0.dist || 6, k1.dist || 6, u);
          const t0 = k0.target || [0, 0.5, 0], t1 = k1.target || [0, 0.5, 0];
          const tgt = [lerpNum(t0[0], t1[0], u), lerpNum(t0[1], t1[1], u), lerpNum(t0[2], t1[2], u)];
          const fv = lerpNum(k0.fov || fov, k1.fov || fov, u);
          return sceneApi.orbit(az, el, dst, tgt, fv);
        },
        lights(cfg) {
          if (!cfg) return sceneApi;
          if (cfg.key) lights.key = cfg.key; if (cfg.fill) lights.fill = cfg.fill; if (cfg.rim) lights.rim = cfg.rim;
          if (cfg.keyColor) lights.keyCol = hexToVec3(cfg.keyColor); if (cfg.fillColor) lights.fillCol = hexToVec3(cfg.fillColor);
          if (cfg.ambient !== undefined) lights.amb = cfg.ambient;
          if (cfg.shadows !== undefined) lights.shadows = !!cfg.shadows;
          if (cfg.shadowExtent !== undefined) lights.shadowExtent = cfg.shadowExtent;
          if (cfg.shadowColor) lights.shadowColor = hexToVec3(cfg.shadowColor);
          if (cfg.vibrancy !== undefined) postCfg.vibrancy = cfg.vibrancy;
          if (cfg.fogColor) lights.fogCol = hexToVec3(cfg.fogColor);
          if (cfg.fogNear !== undefined) lights.fogNear = cfg.fogNear; if (cfg.fogFar !== undefined) lights.fogFar = cfg.fogFar;
          return sceneApi;
        },
        // 3D-to-2D Screen Space Projection for Keynote Callouts & Floating Speech Bubbles!
        project(worldPt) {
          const projM = m4Persp(fov, W / Math.max(1, H), 0.1, 120.0);
          const viewM = m4LookAt(eye, target, up);
          const vp = m4Multiply(projM, viewM);
          const x = worldPt[0], y = worldPt[1], z = worldPt[2];
          const cx = vp[0]*x + vp[4]*y + vp[8]*z  + vp[12];
          const cy = vp[1]*x + vp[5]*y + vp[9]*z  + vp[13];
          const cw = vp[3]*x + vp[7]*y + vp[11]*z + vp[15];
          if (cw <= 0.05) return { x: -999, y: -999, visible: false, depth: cw };
          const ndcX = cx / cw, ndcY = cy / cw;
          return {
            x: (ndcX * 0.5 + 0.5) * W,
            y: (0.5 - ndcY * 0.5) * H,
            visible: ndcX >= -1.2 && ndcX <= 1.2 && ndcY >= -1.2 && ndcY <= 1.2,
            depth: Math.hypot(eye[0] - x, eye[1] - y, eye[2] - z)
          };
        },
        render(targetCtx) {
          if (postCfg._autoFocusPt) { const fp = postCfg._autoFocusPt; postCfg.dofFocus = Math.hypot(eye[0]-fp[0], eye[1]-fp[1], eye[2]-fp[2]); }
          const shadowRes = isExportMode ? 2048 : 1024;
          const g = ensureGl(W, H, shadowRes);
          if (!g) return false;

          const projM = m4Persp(fov, W / Math.max(1, H), 0.1, 120.0);
          const viewM = m4LookAt(eye, target, up);

          const km = Math.hypot(lights.key[0], lights.key[1], lights.key[2]) || 1;
          const kx = lights.key[0] / km, ky = lights.key[1] / km, kz = lights.key[2] / km;
          const lightEye = [kx * 10.5, ky * 10.5 + 0.4, kz * 10.5];
          const lightView = m4LookAt(lightEye, [0, 0.4, 0], [0, 1, 0]);
          const ext = lights.shadowExtent;
          const lightProj = m4Ortho(-ext, ext, -ext, ext, 1.0, 24.0);
          const lightVP = m4Multiply(lightProj, lightView);

          const opaque = [], trans = [];
          for (let i = 0; i < items.length; i++) {
            const a = items[i].mat.alpha !== undefined ? items[i].mat.alpha : 1.0;
            if (a < 0.99 || items[i].mat.featherShadow) trans.push(items[i]); else opaque.push(items[i]);
          }

          // PASS 1: 1024/2048px Soft Shadow Map
          if (lights.shadows && glShadowFbo && glShadowProg) {
            g.bindFramebuffer(g.FRAMEBUFFER, glShadowFbo);
            g.viewport(0, 0, shadowRes, shadowRes);
            g.disable(g.BLEND); g.enable(g.DEPTH_TEST); g.depthMask(true); g.disable(g.CULL_FACE);
            g.clearColor(1, 1, 1, 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
            g.useProgram(glShadowProg);
            g.uniformMatrix4fv(g.getUniformLocation(glShadowProg, "uLightVP"), false, lightVP);
            const sPosLoc = g.getAttribLocation(glShadowProg, "aPos");
            const sModLoc = g.getUniformLocation(glShadowProg, "uModel");
            g.enableVertexAttribArray(sPosLoc);
            for (let i = 0; i < opaque.length; i++) {
              const it = opaque[i];
              if (it.mat.castShadow === false) continue;
              g.uniformMatrix4fv(sModLoc, false, it.modelM);
              g.bindBuffer(g.ARRAY_BUFFER, glBufPos);
              g.bufferData(g.ARRAY_BUFFER, new Float32Array(it.geo.pos), g.STREAM_DRAW);
              g.vertexAttribPointer(sPosLoc, 3, g.FLOAT, false, 0, 0);
              g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, glBufIdx);
              g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(it.geo.idx), g.STREAM_DRAW);
              g.drawElements(g.TRIANGLES, it.geo.idx.length, g.UNSIGNED_SHORT, 0);
            }
          }

          // PASS 2: Linear Depth Map (only when Depth-of-Field aperture > 0)
          const hw = Math.max(2, W >> 1), hh = Math.max(2, H >> 1);
          if (postCfg.dofAperture > 0.005 && glDepthFbo) {
            g.bindFramebuffer(g.FRAMEBUFFER, glDepthFbo);
            g.viewport(0, 0, hw, hh);
            g.disable(g.BLEND); g.enable(g.DEPTH_TEST); g.depthMask(true); g.disable(g.CULL_FACE);
            g.clearColor(1, 1, 1, 1); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
            g.useProgram(glDepthProg);
            g.uniformMatrix4fv(g.getUniformLocation(glDepthProg, "uProj"), false, projM);
            g.uniformMatrix4fv(g.getUniformLocation(glDepthProg, "uView"), false, viewM);
            g.uniform3fv(g.getUniformLocation(glDepthProg, "uEye"), new Float32Array(eye));
            const dPosLoc = g.getAttribLocation(glDepthProg, "aPos");
            const dModLoc = g.getUniformLocation(glDepthProg, "uModel");
            g.enableVertexAttribArray(dPosLoc);
            for (let i = 0; i < opaque.length; i++) {
              const it = opaque[i];
              g.uniformMatrix4fv(dModLoc, false, it.modelM);
              g.bindBuffer(g.ARRAY_BUFFER, glBufPos);
              g.bufferData(g.ARRAY_BUFFER, new Float32Array(it.geo.pos), g.STREAM_DRAW);
              g.vertexAttribPointer(dPosLoc, 3, g.FLOAT, false, 0, 0);
              g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, glBufIdx);
              g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(it.geo.idx), g.STREAM_DRAW);
              g.drawElements(g.TRIANGLES, it.geo.idx.length, g.UNSIGNED_SHORT, 0);
            }
          }

          // PASS 3: Main Scene FBO (3D Sky Dome + 12 PBR Materials + Ink Outlines + 4 Point Lights + Spot)
          g.bindFramebuffer(g.FRAMEBUFFER, glSceneFbo);
          g.viewport(0, 0, W, H);
          g.depthMask(true); g.enable(g.DEPTH_TEST); g.depthFunc(g.LEQUAL); g.disable(g.CULL_FACE);
          g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);

          g.useProgram(glPbrProg);
          const uLoc = (n) => g.getUniformLocation(glPbrProg, n);

          g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, glShadowTex);
          g.uniform1i(uLoc("uShadowMap"), 0);
          g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, glWhiteTex);
          g.uniform1i(uLoc("uAlbedoTex"), 1);

          g.uniform1f(uLoc("uShadowEnabled"), lights.shadows ? 1.0 : 0.0);
          g.uniform1f(uLoc("uShadowTexel"), 1.0 / shadowRes);
          g.uniform3fv(uLoc("uShadowColor"), new Float32Array(lights.shadowColor));
          g.uniformMatrix4fv(uLoc("uLightVP"), false, lightVP);
          g.uniformMatrix4fv(uLoc("uProj"), false, projM);
          g.uniformMatrix4fv(uLoc("uView"), false, viewM);
          g.uniform3fv(uLoc("uEye"), new Float32Array(eye));
          g.uniform3fv(uLoc("uKeyDir"), new Float32Array(lights.key));
          g.uniform3fv(uLoc("uFillDir"), new Float32Array(lights.fill));
          g.uniform3fv(uLoc("uRimDir"), new Float32Array(lights.rim));
          g.uniform3fv(uLoc("uKeyCol"), new Float32Array(lights.keyCol));
          g.uniform3fv(uLoc("uFillCol"), new Float32Array(lights.fillCol));
          g.uniform1f(uLoc("uAmb"), lights.amb);
          g.uniform1f(uLoc("uTime"), tSec);
          g.uniform3fv(uLoc("uFogColor"), new Float32Array(lights.fogCol));
          g.uniform2f(uLoc("uFogRange"), lights.fogNear, lights.fogFar);

          // Bind 4 Point Lights & 1 Spot Light
          const ptPosArr = new Float32Array(12), ptColArr = new Float32Array(12), ptParArr = new Float32Array(8);
          for (let i = 0; i < 4; i++) {
            const pl = lights.points[i];
            if (pl) {
              ptPosArr[i*3] = pl.pos[0]; ptPosArr[i*3+1] = pl.pos[1]; ptPosArr[i*3+2] = pl.pos[2];
              ptColArr[i*3] = pl.col[0]; ptColArr[i*3+1] = pl.col[1]; ptColArr[i*3+2] = pl.col[2];
              ptParArr[i*2] = pl.intensity; ptParArr[i*2+1] = pl.radius;
            }
          }
          g.uniform3fv(uLoc("uPtPos[0]"), ptPosArr);
          g.uniform3fv(uLoc("uPtCol[0]"), ptColArr);
          g.uniform2fv(uLoc("uPtParam[0]"), ptParArr);

          if (lights.spot) {
            g.uniform3fv(uLoc("uSpotPos"), new Float32Array(lights.spot.pos));
            g.uniform3fv(uLoc("uSpotDir"), new Float32Array(lights.spot.dir));
            g.uniform3fv(uLoc("uSpotCol"), new Float32Array(lights.spot.col));
            g.uniform3f(uLoc("uSpotParam"), lights.spot.intensity, lights.spot.cosCone, lights.spot.radius);
          } else {
            g.uniform3f(uLoc("uSpotParam"), 0, 0, 1);
          }

          const aPos = g.getAttribLocation(glPbrProg, "aPos");
          const aNorm = g.getAttribLocation(glPbrProg, "aNorm");
          const aUv = g.getAttribLocation(glPbrProg, "aUv");
          g.enableVertexAttribArray(aPos); g.enableVertexAttribArray(aNorm); g.enableVertexAttribArray(aUv);

          // Optional 3D Sky Dome Sphere centered on camera eye
          if (skyCfg) {
            const skyGeo = buildEllipsoidGeo(55, 55, 55, 24);
            const skyM = m4Transform(eye, [0, 0, 0], 1);
            g.disable(g.DEPTH_TEST); g.depthMask(false); g.disable(g.BLEND);
            g.uniform1f(uLoc("uSkyMode"), skyCfg.mode || 1.0);
            g.uniform3fv(uLoc("uSkyZenith"), new Float32Array(hexToVec3(skyCfg.zenith)));
            g.uniform3fv(uLoc("uSkyHorizon"), new Float32Array(hexToVec3(skyCfg.horizon)));
            g.uniform3fv(uLoc("uSkyGround"), new Float32Array(hexToVec3(skyCfg.ground)));
            g.uniform3fv(uLoc("uSunCol"), new Float32Array(hexToVec3(skyCfg.sun)));
            g.uniform1f(uLoc("uOutlineWidth"), 0.0);
            g.uniformMatrix4fv(uLoc("uModel"), false, skyM);
            g.uniformMatrix3fv(uLoc("uNormMat"), false, m3NormalFromM4(skyM));
            g.bindBuffer(g.ARRAY_BUFFER, glBufPos); g.bufferData(g.ARRAY_BUFFER, new Float32Array(skyGeo.pos), g.STREAM_DRAW); g.vertexAttribPointer(aPos, 3, g.FLOAT, false, 0, 0);
            g.bindBuffer(g.ARRAY_BUFFER, glBufNorm); g.bufferData(g.ARRAY_BUFFER, new Float32Array(skyGeo.norm), g.STREAM_DRAW); g.vertexAttribPointer(aNorm, 3, g.FLOAT, false, 0, 0);
            g.bindBuffer(g.ARRAY_BUFFER, glBufUv); g.bufferData(g.ARRAY_BUFFER, new Float32Array(skyGeo.uv), g.STREAM_DRAW); g.vertexAttribPointer(aUv, 2, g.FLOAT, false, 0, 0);
            g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, glBufIdx); g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(skyGeo.idx), g.STREAM_DRAW);
            g.drawElements(g.TRIANGLES, skyGeo.idx.length, g.UNSIGNED_SHORT, 0);
            g.enable(g.DEPTH_TEST); g.depthMask(true);
          }
          g.uniform1f(uLoc("uSkyMode"), 0.0);

          if (trans.length > 1) {
            trans.sort((a, b) => {
              const da = Math.hypot(a.modelM[12] - eye[0], a.modelM[13] - eye[1], a.modelM[14] - eye[2]);
              const db = Math.hypot(b.modelM[12] - eye[0], b.modelM[13] - eye[1], b.modelM[14] - eye[2]);
              return db - da;
            });
          }

          const drawList = (list, isTrans) => {
            if (isTrans) { g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA); g.depthMask(false); }
            else { g.disable(g.BLEND); g.depthMask(true); }
            for (let i = 0; i < list.length; i++) {
              const it = list[i], m = it.mat, geo = it.geo;
              const normM = m3NormalFromM4(it.modelM);
              g.uniformMatrix4fv(uLoc("uModel"), false, it.modelM);
              g.uniformMatrix3fv(uLoc("uNormMat"), false, normM);

              g.bindBuffer(g.ARRAY_BUFFER, glBufPos); g.bufferData(g.ARRAY_BUFFER, new Float32Array(geo.pos), g.STREAM_DRAW); g.vertexAttribPointer(aPos, 3, g.FLOAT, false, 0, 0);
              g.bindBuffer(g.ARRAY_BUFFER, glBufNorm); g.bufferData(g.ARRAY_BUFFER, new Float32Array(geo.norm), g.STREAM_DRAW); g.vertexAttribPointer(aNorm, 3, g.FLOAT, false, 0, 0);
              g.bindBuffer(g.ARRAY_BUFFER, glBufUv); g.bufferData(g.ARRAY_BUFFER, new Float32Array(geo.uv), g.STREAM_DRAW); g.vertexAttribPointer(aUv, 2, g.FLOAT, false, 0, 0);
              g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, glBufIdx); g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.idx), g.STREAM_DRAW);

              // Optional Inverted-Hull Toon Ink Outline Pass!
              if (m.outline && m.outline > 0 && !isTrans) {
                g.enable(g.CULL_FACE); g.cullFace(g.FRONT);
                g.uniform1f(uLoc("uOutlineWidth"), m.outline);
                g.uniform1f(uLoc("uUnlit"), 1.0);
                g.uniform1f(uLoc("uHasTex"), 0.0);
                g.uniform1f(uLoc("uFeatherShadow"), 0.0);
                const oc = hexToVec3(m.outlineColor || "#181C24");
                g.uniform3fv(uLoc("uColor"), new Float32Array(oc));
                g.uniform3fv(uLoc("uColor2"), new Float32Array(oc));
                g.uniform1f(uLoc("uAlpha"), 1.0);
                g.drawElements(g.TRIANGLES, geo.idx.length, g.UNSIGNED_SHORT, 0);
                g.disable(g.CULL_FACE);
              }
              g.uniform1f(uLoc("uOutlineWidth"), 0.0);

              // Dynamic 2D->3D Canvas Texture Upload
              if (m.map && m.map.__canvas2d) {
                g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, glDynamicTex);
                g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, m.map.__canvas2d);
                g.uniform1f(uLoc("uHasTex"), 1.0);
              } else {
                g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, glWhiteTex);
                g.uniform1f(uLoc("uHasTex"), 0.0);
              }

              const c1 = hexToVec3(m.color || "#E6ECF5");
              const c2 = m.color2 ? hexToVec3(m.color2) : c1;
              g.uniform3fv(uLoc("uColor"), new Float32Array(c1));
              g.uniform3fv(uLoc("uColor2"), new Float32Array(c2));
              g.uniform3fv(uLoc("uEmissive"), new Float32Array(m.emissive ? hexToVec3(m.emissive) : [0, 0, 0]));
              g.uniform3fv(uLoc("uRimColor"), new Float32Array(hexToVec3(m.rimColor || "#FFFFFF")));
              g.uniform1f(uLoc("uRoughness"), m.roughness !== undefined ? m.roughness : 0.45);
              g.uniform1f(uLoc("uMetalness"), m.metalness !== undefined ? m.metalness : 0.0);
              g.uniform1f(uLoc("uRimPow"), m.rim !== undefined ? m.rim : 0.30);
              g.uniform1f(uLoc("uSss"), m.sss !== undefined ? m.sss : 0.0);
              g.uniform1f(uLoc("uAlpha"), m.alpha !== undefined ? m.alpha : 1.0);
              g.uniform1f(uLoc("uUnlit"), m.unlit ? 1.0 : 0.0);
              g.uniform1f(uLoc("uFeatherShadow"), m.featherShadow ? 1.0 : 0.0);
              g.uniform1f(uLoc("uDetail"), m.detail !== undefined ? m.detail : 0.0);
              const mtKey = String(m.material || "standard").toLowerCase();
              g.uniform1f(uLoc("uMatType"), MAT_TYPE_MAP[mtKey] !== undefined ? MAT_TYPE_MAP[mtKey] : 0);

              g.drawElements(m.wireframe ? g.LINES : g.TRIANGLES, geo.idx.length, g.UNSIGNED_SHORT, 0);
            }
          };

          drawList(opaque, false);
          if (trans.length) drawList(trans, true);
          g.depthMask(true);

          // PASS 4A: Dual-Filter Kawase Bloom Extraction & Blur
          const qw = Math.max(2, W >> 2), qh = Math.max(2, H >> 2);
          g.disable(g.DEPTH_TEST); g.disable(g.BLEND); g.disable(g.CULL_FACE);
          if (postCfg.bloom > 0.005 || postCfg.godRays > 0.005) {
            g.bindFramebuffer(g.FRAMEBUFFER, glBloomFboA);
            g.viewport(0, 0, hw, hh);
            g.useProgram(glBloomExtProg);
            g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, glSceneTex);
            g.uniform1i(g.getUniformLocation(glBloomExtProg, "uTex"), 0);
            g.uniform1f(g.getUniformLocation(glBloomExtProg, "uThreshold"), postCfg.bloomThreshold);
            drawGlQuad(g, glBloomExtProg);

            // Downsample blur A -> B
            g.bindFramebuffer(g.FRAMEBUFFER, glBloomFboB);
            g.viewport(0, 0, qw, qh);
            g.useProgram(glBloomBlurProg);
            g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, glBloomTexA);
            g.uniform1i(g.getUniformLocation(glBloomBlurProg, "uTex"), 0);
            g.uniform2f(g.getUniformLocation(glBloomBlurProg, "uTexel"), 1 / hw, 1 / hh);
            g.uniform1f(g.getUniformLocation(glBloomBlurProg, "uSpread"), 2.2);
            drawGlQuad(g, glBloomBlurProg);

            // Upsample blur B -> A
            g.bindFramebuffer(g.FRAMEBUFFER, glBloomFboA);
            g.viewport(0, 0, hw, hh);
            g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, glBloomTexB);
            g.uniform2f(g.getUniformLocation(glBloomBlurProg, "uTexel"), 1 / qw, 1 / qh);
            g.uniform1f(g.getUniformLocation(glBloomBlurProg, "uSpread"), 2.8);
            drawGlQuad(g, glBloomBlurProg);
          }

          // PASS 4B: Final Cinema Post-FX Composite (Bloom + DoF + God Rays + 6 Cinema LUTs)
          g.bindFramebuffer(g.FRAMEBUFFER, null);
          g.viewport(0, 0, W, H);
          g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
          g.useProgram(glPostProg);
          const pLoc = (n) => g.getUniformLocation(glPostProg, n);
          g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, glSceneTex); g.uniform1i(pLoc("uSceneTex"), 0);
          g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, glBloomTexA); g.uniform1i(pLoc("uBloomTex"), 1);
          g.activeTexture(g.TEXTURE2); g.bindTexture(g.TEXTURE_2D, glDepthTex); g.uniform1i(pLoc("uDepthTex"), 2);

          // Project Directional Sun position into Screen UV for Volumetric God Rays
          const sunWorld = [eye[0] + kx * 40, eye[1] + ky * 40, eye[2] + kz * 40];
          const sunProj = sceneApi.project(sunWorld);
          const sunU = sunProj.visible ? clampNum(sunProj.x / W, -0.3, 1.3) : 0.75;
          const sunV = sunProj.visible ? clampNum(1.0 - sunProj.y / H, -0.3, 1.3) : 0.85;

          g.uniform2f(pLoc("uRes"), W, H);
          g.uniform1f(pLoc("uBloomStrength"), postCfg.bloom);
          g.uniform1f(pLoc("uDofFocus"), clampNum(postCfg.dofFocus / 36.0, 0.02, 1.0));
          g.uniform1f(pLoc("uDofAperture"), postCfg.dofAperture);
          g.uniform1f(pLoc("uGodRayStrength"), postCfg.godRays);
          g.uniform2f(pLoc("uSunScreen"), sunU, sunV);
          g.uniform3fv(pLoc("uSunColor"), new Float32Array(skyCfg ? hexToVec3(skyCfg.sun) : lights.keyCol));
          const lutId = LUT_MAP[String(postCfg.lut || "none").toLowerCase()] || 0;
          g.uniform1f(pLoc("uLutId"), lutId);
          g.uniform1f(pLoc("uVibrancy"), postCfg.vibrancy);
          g.uniform1f(pLoc("uChromatic"), postCfg.chromatic);
          g.uniform1f(pLoc("uVignette"), postCfg.vignette);
          g.uniform1f(pLoc("uHasSky"), skyCfg ? 1.0 : 0.0);
          drawGlQuad(g, glPostProg);

          g.flush();
          if (targetCtx) targetCtx.drawImage(glCanvas, 0, 0, W, H);
          return true;
        }
      });
      if (typeof attachProSceneCamera === "function") attachProSceneCamera(sceneApi, () => eye, () => target, () => fov, (e, tg, fv) => { if (e) eye = e; if (tg) target = tg; if (fv) fov = fv; }, postCfg, tSec);
      return sceneApi;
    },

    shader(targetCtx, fragCode, uniforms) {
      const g = ensureGl(W, H, 1024);
      if (!g) return false;
      const fsSrc = SHADER_FS_HEADER + "\n" + String(fragCode || "") +
        "\nvoid main(){ vec2 uv=(vUv-0.5)*vec2(uRes.x/max(1.0,uRes.y),1.0); vec4 c=renderShader(uv); gl_FragColor=vec4(c.rgb*c.a, c.a); }";
      let prog = glShaderCache.get(fsSrc);
      if (!prog) {
        if (glShaderCache.size >= 8) {
          const firstKey = glShaderCache.keys().next().value;
          g.deleteProgram(glShaderCache.get(firstKey));
          glShaderCache.delete(firstKey);
        }
        prog = linkGlProgram(g, QUAD_VS, fsSrc);
        glShaderCache.set(fsSrc, prog);
      }
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.viewport(0, 0, W, H);
      g.disable(g.DEPTH_TEST); g.disable(g.BLEND); g.disable(g.CULL_FACE);
      g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
      g.useProgram(prog);
      const uResLoc = g.getUniformLocation(prog, "uRes"); if (uResLoc) g.uniform2f(uResLoc, W, H);
      const uTimeLoc = g.getUniformLocation(prog, "uTime"); if (uTimeLoc) g.uniform1f(uTimeLoc, tSec);
      const uProgLoc = g.getUniformLocation(prog, "uProgress"); if (uProgLoc) g.uniform1f(uProgLoc, pVal);
      if (uniforms && typeof uniforms === "object") {
        Object.keys(uniforms).forEach((k) => {
          const loc = g.getUniformLocation(prog, k); if (!loc) return;
          const v = uniforms[k];
          if (typeof v === "number") g.uniform1f(loc, v);
          else if (typeof v === "string" && v.startsWith("#")) { const c = hexToVec3(v); g.uniform3f(loc, c[0], c[1], c[2]); }
          else if (Array.isArray(v) && v.length === 2) g.uniform2f(loc, v[0], v[1]);
          else if (Array.isArray(v) && v.length === 3) g.uniform3f(loc, v[0], v[1], v[2]);
          else if (Array.isArray(v) && v.length === 4) g.uniform4f(loc, v[0], v[1], v[2], v[3]);
        });
      }
      drawGlQuad(g, prog);
      g.flush();
      if (targetCtx) targetCtx.drawImage(glCanvas, 0, 0, W, H);
      return true;
    }
  };
  attachActorBuilders(g3dObj, tSec);
  return Object.freeze(g3dObj);
}
// =======================================================
// EXPRESSIVE 2-BONE ARTICULATED 3D CHARACTERS (v3) & CREATURE MASCOTS
// =======================================================
function evalCharacterPose(name, tSec) {
  const cycW = tSec * 7.2, cycR = tSec * 10.5, jCyc = tSec * 5.6;
  switch (name) {
    case "walk": {
      const s = Math.sin(cycW);
      return {
        bounceY: Math.abs(s) * 0.085, squashY: 1 + Math.cos(cycW * 2) * 0.035, leanX: 0.10, twistY: s * 0.14,
        lHipX: s * 0.52, lKneeX: Math.max(0, -s) * 0.65, rHipX: -s * 0.52, rKneeX: Math.max(0, s) * 0.65,
        lShX: -s * 0.48, lShZ: -0.22, lElbX: -0.35 - Math.max(0, s) * 0.35,
        rShX: s * 0.48, rShZ: 0.22, rElbX: -0.35 - Math.max(0, -s) * 0.35
      };
    }
    case "run": {
      const s = Math.sin(cycR);
      return {
        bounceY: Math.abs(s) * 0.14, squashY: 1 + Math.cos(cycR * 2) * 0.05, leanX: 0.22, twistY: s * 0.20,
        lHipX: s * 0.80, lKneeX: Math.max(0, -s) * 1.15, rHipX: -s * 0.80, rKneeX: Math.max(0, s) * 1.15,
        lShX: -s * 0.85, lShZ: -0.26, lElbX: -1.10,
        rShX: s * 0.85, rShZ: 0.26, rElbX: -1.10
      };
    }
    case "wave": {
      const wv = Math.sin(tSec * 8.4);
      return {
        bounceY: Math.sin(tSec * 4.0) * 0.035, squashY: 1 + Math.sin(tSec * 4.0) * 0.025, leanX: 0.03, twistY: -0.10,
        lHipX: 0, lKneeX: 0.04, rHipX: 0, rKneeX: 0.04,
        lShX: 0.08, lShZ: -0.28, lElbX: -0.22,
        rShX: -0.32, rShZ: 2.05 + wv * 0.22, rElbX: -0.45 - wv * 0.32
      };
    }
    case "pour": {
      const nod = Math.sin(tSec * 3.4) * 0.14;
      return {
        bounceY: Math.sin(tSec * 3.0) * 0.025, squashY: 1.0, leanX: 0.12, twistY: -0.18,
        lHipX: -0.06, lKneeX: 0.12, rHipX: 0.06, rKneeX: 0.12,
        lShX: 0.18, lShZ: -0.36, lElbX: -0.40,
        rShX: -0.78 - nod, rShZ: 0.18, rElbX: -0.52 - nod * 0.5
      };
    }
    case "spray": {
      const sq = Math.pow(0.5 + 0.5 * Math.sin(tSec * 7.0), 3);
      return {
        bounceY: Math.sin(tSec * 3.5) * 0.02, squashY: 1.0, leanX: 0.08, twistY: -0.22,
        lHipX: 0, lKneeX: 0.08, rHipX: 0, rKneeX: 0.08,
        lShX: 0.12, lShZ: -0.30, lElbX: -0.35,
        rShX: -1.18 - sq * 0.08, rShZ: 0.12, rElbX: -0.32
      };
    }
    case "point": {
      return {
        bounceY: Math.sin(tSec * 3.2) * 0.025, squashY: 1.0, leanX: 0.04, twistY: -0.16,
        lHipX: 0, lKneeX: 0.05, rHipX: 0, rKneeX: 0.05,
        lShX: 0.14, lShZ: -0.28, lElbX: -0.38,
        rShX: -1.32, rShZ: 0.32, rElbX: -0.12
      };
    }
    case "present": {
      const sw = Math.sin(tSec * 3.0) * 0.08;
      return {
        bounceY: Math.sin(tSec * 3.0) * 0.03, squashY: 1.02, leanX: 0.02, twistY: 0.08,
        lHipX: 0, lKneeX: 0.04, rHipX: 0, rKneeX: 0.04,
        lShX: -0.55 + sw, lShZ: -0.58, lElbX: -0.55,
        rShX: -0.68 - sw, rShZ: 0.78, rElbX: -0.45
      };
    }
    case "think": {
      return {
        bounceY: Math.sin(tSec * 2.4) * 0.02, squashY: 1.0, leanX: 0.06, twistY: 0.08,
        lHipX: 0, lKneeX: 0.06, rHipX: 0, rKneeX: 0.06,
        lShX: 0.12, lShZ: -0.22, lElbX: -0.45,
        rShX: -0.95, rShZ: -0.18, rElbX: -1.45
      };
    }
    case "sad": {
      return {
        bounceY: Math.sin(tSec * 2.0) * 0.015 - 0.03, squashY: 0.96, leanX: 0.18, twistY: 0,
        lHipX: 0.08, lKneeX: 0.14, rHipX: 0.08, rKneeX: 0.14,
        lShX: 0.25, lShZ: -0.14, lElbX: -0.25,
        rShX: 0.25, rShZ: 0.14, rElbX: -0.25
      };
    }
    case "jump":
    case "joy": {
      const j = Math.abs(Math.sin(jCyc));
      return {
        bounceY: j * 0.28, squashY: j > 0.16 ? (1 + j * 0.07) : 0.92, leanX: -0.06 * j, twistY: Math.sin(jCyc) * 0.08,
        lHipX: -0.24 * j, lKneeX: 0.45 * j, rHipX: 0.20 * j, rKneeX: 0.45 * j,
        lShX: -0.20, lShZ: -2.15 - j * 0.32, lElbX: -0.35,
        rShX: -0.20, rShZ: 2.15 + j * 0.32, rElbX: -0.35
      };
    }
    default: // idle
      return {
        bounceY: Math.sin(tSec * 3.2) * 0.03, squashY: 1 + Math.sin(tSec * 3.2) * 0.022, leanX: 0.04, twistY: Math.sin(tSec * 1.4) * 0.04,
        lHipX: 0, lKneeX: 0.04, rHipX: 0, rKneeX: 0.04,
        lShX: 0.10, lShZ: -0.24, lElbX: -0.28,
        rShX: 0.10, rShZ: 0.24, rElbX: -0.28
      };
  }
}

function blendPoses(a, b, u) {
  const k = ease.apple(clampNum(u, 0, 1)), out = {};
  Object.keys(a).forEach((key) => { out[key] = lerpNum(a[key], b[key], k); });
  return out;
}

// Analytical 2-Bone Arm IK in Character Local Space
function solveArmIK(shoulderLocal, targetLocal, upperLen, foreLen, sideSign) {
  const dx = targetLocal[0] - shoulderLocal[0];
  const dy = targetLocal[1] - shoulderLocal[1];
  const dz = targetLocal[2] - shoulderLocal[2];
  const dist = clampNum(Math.hypot(dx, dy, dz), 0.08, upperLen + foreLen - 0.01);
  const cosBend = clampNum((upperLen*upperLen + foreLen*foreLen - dist*dist) / (2 * upperLen * foreLen), -1, 1);
  const elbowBend = -(Math.PI - Math.acos(cosBend));
  const horiz = Math.hypot(dx, dz) || 0.0001;
  const pitchToTgt = -Math.atan2(dz, -dy);
  const shZ = clampNum(Math.atan2(dx, Math.max(0.15, -dy + 0.35)) * 0.85, -2.4, 2.4);
  const cosA = clampNum((upperLen*upperLen + dist*dist - foreLen*foreLen) / (2 * upperLen * dist), -1, 1);
  const lift = Math.acos(cosA);
  return { shX: clampNum(pitchToTgt - lift * 0.75, -2.4, 1.4), shZ: shZ || (sideSign * 0.22), elbX: clampNum(elbowBend, -2.1, -0.08) };
}

function attachActorBuilders(g3dObj, tSec) {
  // 1) EXPRESSIVE 2-BONE ARTICULATED 3D CHARACTER (v3)
  const buildChar = (parentNode, cfg) => {
    const c = cfg || {};
    const skin = c.skinColor || "#F2B892";
    const shirt = c.shirtColor || "#FFFFFF";
    const overalls = c.overallColor || "#1E8E4E";
    const hair = c.hairColor || "#38241C";
    const hatCol = c.hatColor || "#E4AE48";
    const bootCol = c.bootColor || "#5A3826";
    const eyeCol = c.eyeColor || "#1E354D";
    const matStyle = c.material || "clay"; // "clay" | "toon" | "standard"
    const outlineW = c.outline !== undefined ? c.outline : (matStyle === "toon" ? 0.022 : 0);
    const outCol = c.outlineColor || "#1B2028";
    const mkMat = (col, extra) => Object.assign({ color: col, material: matStyle, outline: outlineW, outlineColor: outCol }, extra || {});

    // Smooth Pose Morphing (pose / poseFrom -> poseTo with blend [0..1])
    const pA = evalCharacterPose(c.poseFrom || c.pose || "idle", tSec);
    const poseData = (c.poseTo && c.blend !== undefined) ? blendPoses(pA, evalCharacterPose(c.poseTo, tSec), c.blend) : pA;

    const pos = c.pos || [0, 0, 0], rot = c.rot || [0, 0, 0], scale = c.scale !== undefined ? c.scale : 1;
    const bodyYaw = rot[1] || 0;

    // Automatic headLookAt toward any 3D world point!
    let headYaw = c.headYaw || 0, headPitch = c.headPitch || 0, headRoll = c.headRoll || 0;
    if (Array.isArray(c.headLookAt)) {
      const hx = pos[0], hy = pos[1] + 1.22 * scale, hz = pos[2];
      const lx = c.headLookAt[0] - hx, ly = c.headLookAt[1] - hy, lz = c.headLookAt[2] - hz;
      const worldYaw = Math.atan2(lx, lz);
      let relYaw = worldYaw - bodyYaw;
      while (relYaw > Math.PI) relYaw -= Math.PI * 2;
      while (relYaw < -Math.PI) relYaw += Math.PI * 2;
      headYaw = clampNum(relYaw, -0.85, 0.85);
      headPitch = clampNum(-Math.atan2(ly, Math.hypot(lx, lz) || 0.01), -0.45, 0.45);
    }

    // Optional Analytical 2-Bone Arm IK for rightHandTarget / leftHandTarget
    const toLocal = (wPt) => {
      const dx = (wPt[0] - pos[0]) / scale, dy = (wPt[1] - pos[1]) / scale, dz = (wPt[2] - pos[2]) / scale;
      const cy = Math.cos(-bodyYaw), sy = Math.sin(-bodyYaw);
      return [dx * cy + dz * sy, dy - (0.68 + poseData.bounceY), -dx * sy + dz * cy];
    };
    if (Array.isArray(c.rightHandTarget)) {
      const ik = solveArmIK([0.31, 0.18, 0], toLocal(c.rightHandTarget), 0.21, 0.20, 1);
      poseData.rShX = ik.shX; poseData.rShZ = ik.shZ; poseData.rElbX = ik.elbX;
    }
    if (Array.isArray(c.leftHandTarget)) {
      const ik = solveArmIK([-0.31, 0.18, 0], toLocal(c.leftHandTarget), 0.21, 0.20, -1);
      poseData.lShX = ik.shX; poseData.lShZ = ik.shZ; poseData.lElbX = ik.elbX;
    }

    const expr = c.expression || ((c.pose === "joy" || c.pose === "jump") ? "joy" : (c.pose === "sad" ? "sad" : "smile"));
    const blink = c.blink !== undefined ? c.blink : ((tSec % 3.4) > 3.24 ? 1 : 0);
    const talkOpen = c.talk ? (0.35 + 0.65 * Math.abs(Math.sin(tSec * 14.5) * Math.cos(tSec * 6.2))) * (c.talkAmp || 1.0) : 0;

    // Secondary delayed bounce for hair/hat/backpack!
    const secLag = Math.sin((tSec - 0.09) * 3.8) * 0.04;

    const root = parentNode.node({ pos, rot, scale });
    if (c.shadow !== false) {
      root.shadow([0, 0.005, 0], 0.56 * (1 - poseData.bounceY * 0.45), 0.48 * (1 - poseData.bounceY * 0.45), 0.36);
    }

    const hips = root.node({ pos: [0, 0.45 + poseData.bounceY, 0], scale: [1 / Math.sqrt(poseData.squashY), poseData.squashY, 1 / Math.sqrt(poseData.squashY)] });

    // 2-BONE LEGS (Thigh -> Knee -> Calf -> Boot)
    [-1, 1].forEach((side) => {
      const hipX = side < 0 ? poseData.lHipX : poseData.rHipX;
      const kneeX = side < 0 ? poseData.lKneeX : poseData.rKneeX;
      const hipJ = hips.node({ pos: [side * 0.155, 0.0, 0], rot: [hipX, 0, 0] });
      hipJ.capsule([0, -0.10, 0], 0.095, 0.14, [0, 0, 0], mkMat(overalls, { material: matStyle === "toon" ? "toon" : "fabric", roughness: 0.72 }), 16);
      const kneeJ = hipJ.node({ pos: [0, -0.20, 0], rot: [kneeX, 0, 0] });
      kneeJ.capsule([0, -0.09, 0], 0.084, 0.13, [0, 0, 0], mkMat(overalls, { material: matStyle === "toon" ? "toon" : "fabric", roughness: 0.72 }), 16);
      kneeJ.ellipsoid([0, -0.20, 0.055], [0.115, 0.078, 0.165], [0, 0, 0], mkMat(bootCol, { roughness: 0.48 }), 16);
    });

    // TORSO + OVERALLS / APRON + BACKPACK
    const torso = hips.node({ pos: [0, 0.24, 0], rot: [poseData.leanX, poseData.twistY, 0] });
    torso.roundBox([0, 0.02, 0], [0.52, 0.52, 0.38], 0.18, [0, 0, 0], mkMat(shirt, { material: matStyle === "toon" ? "toon" : "fabric", roughness: 0.70 }));
    torso.roundBox([0, -0.05, 0.01], [0.54, 0.38, 0.40], 0.16, [0, 0, 0], mkMat(overalls, { material: matStyle === "toon" ? "toon" : "fabric", roughness: 0.72 }));
    [-1, 1].forEach((s) => {
      torso.box([s * 0.14, 0.18, 0.18], [0.06, 0.18, 0.04], [0, 0, 0], mkMat(overalls, { roughness: 0.65 }));
      torso.sphere([s * 0.14, 0.11, 0.208], 0.028, { color: "#F5C242", material: "brushed_metal", metalness: 0.88, roughness: 0.20 }, 12);
    });
    if (c.apron) {
      torso.roundBox([0, -0.07, 0.192], [0.36, 0.26, 0.04], 0.025, [0, 0, 0], mkMat(c.apronColor || "#E4AE48", { material: "fabric" }), 12);
    }
    if (c.backpack !== false) {
      torso.roundBox([0, 0.04 + secLag * 0.3, -0.24], [0.36, 0.38, 0.16], 0.07, [secLag * 0.5, 0, 0], mkMat("#C6643A", { roughness: 0.62 }));
    }

    // 2-BONE ARMS (Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand Socket!)
    let leftHand = null, rightHand = null;
    [-1, 1].forEach((side) => {
      const shX = side < 0 ? poseData.lShX : poseData.rShX;
      const shZ = side < 0 ? poseData.lShZ : poseData.rShZ;
      const elbX = side < 0 ? poseData.lElbX : poseData.rElbX;
      const shoulder = torso.node({ pos: [side * 0.31, 0.18, 0], rot: [shX, 0, shZ] });
      shoulder.capsule([0, -0.10, 0], 0.078, 0.14, [0, 0, 0], mkMat(shirt, { material: matStyle === "toon" ? "toon" : "fabric" }), 14);
      const elbow = shoulder.node({ pos: [0, -0.21, 0], rot: [elbX, 0, 0] });
      elbow.capsule([0, -0.095, 0], 0.068, 0.14, [0, 0, 0], mkMat(skin, { material: matStyle === "toon" ? "toon" : "skin", sss: 0.32 }), 14);
      const handNode = elbow.node({ pos: [0, -0.20, 0] });
      handNode.sphere([0, 0, 0], 0.082, mkMat(skin, { material: matStyle === "toon" ? "toon" : "skin", sss: 0.34 }), 14);
      if (side < 0) leftHand = handNode; else rightHand = handNode;
    });

    // HEAD, EYES, EXPRESSIVE BROWS, LIP-SYNC MOUTH & HAIR/HAT STYLES
    const head = torso.node({ pos: [0, 0.54, 0.02], rot: [headPitch + secLag * 0.4, headYaw, headRoll] });
    head.ellipsoid([0, 0.02, 0], [0.36, 0.34, 0.34], [0, 0, 0], mkMat(skin, { material: matStyle === "toon" ? "toon" : "skin", sss: 0.36 }), 32);
    [-1, 1].forEach((s) => head.sphere([s * 0.35, 0.0, -0.02], 0.076, mkMat(skin, { material: matStyle === "toon" ? "toon" : "skin", sss: 0.42 }), 14));

    // Nose & Cheeks
    head.ellipsoid([0, -0.02, 0.34], [0.054, 0.044, 0.050], [0, 0, 0], mkMat("#E29572", { material: matStyle === "toon" ? "toon" : "skin", sss: 0.4 }), 14);
    [-1, 1].forEach((s) => head.ellipsoid([s * 0.20, -0.07, 0.28], [0.072, 0.044, 0.032], [0, s * 0.45, 0], { color: "#FF6E86", material: "skin", sss: 0.38 }, 12));

    // Mouth with Auto Lip-Sync or Expression
    if (talkOpen > 0.08) {
      head.ellipsoid([0, -0.122, 0.308], [0.068, 0.016 + talkOpen * 0.028, 0.028], [0.12, 0, 0], { color: "#C24052", roughness: 0.38 }, 14);
    } else if (expr === "joy") {
      head.ellipsoid([0, -0.13, 0.30], [0.074, 0.052, 0.042], [0.15, 0, 0], { color: "#B83244", roughness: 0.38 }, 14);
    } else if (expr === "wow") {
      head.ellipsoid([0, -0.13, 0.31], [0.042, 0.050, 0.038], [0, 0, 0], { color: "#B83244", roughness: 0.38 }, 14);
    } else if (expr === "sad") {
      head.torus([0, -0.16, 0.30], 0.054, 0.016, [-0.2, 0, 0], { color: "#9E3442", roughness: 0.42 }, 18, 8);
    } else {
      head.torus([0, -0.11, 0.30], 0.058, 0.017, [0.25, 0, Math.PI], { color: "#9E3442", roughness: 0.42 }, 20, 10);
    }

    // Glossy Eyes & Expressive Eyebrows
    const browLift = expr === "joy" ? 0.024 : (expr === "focus" ? -0.012 : (expr === "sad" ? 0.012 : 0.008));
    const browTilt = expr === "focus" ? -0.22 : (expr === "sad" ? -0.26 : 0.14);
    [-1, 1].forEach((s) => {
      const isWink = (expr === "wink" && s > 0);
      const eyeOpenY = isWink ? 0.10 : lerpNum(1.0, 0.08, clampNum(blink, 0, 1));
      const ex = s * 0.128, ey = 0.038, ez = 0.282;
      head.ellipsoid([ex, ey, ez], [0.074, 0.084 * eyeOpenY, 0.044], [0, s * 0.22, 0], { color: "#FFFFFF", roughness: 0.08 }, 18);
      if (eyeOpenY > 0.25) {
        head.ellipsoid([ex + s * 0.008, ey, ez + 0.027], [0.048, 0.058 * eyeOpenY, 0.028], [0, s * 0.22, 0], { color: eyeCol, roughness: 0.06 }, 16);
        head.sphere([ex + s * 0.022, ey + 0.022, ez + 0.046], 0.017, { color: "#FFFFFF", unlit: true }, 8);
      }
      head.capsule([ex, ey + 0.108 + browLift, ez + 0.01], 0.016, 0.076, [0, s * 0.22, Math.PI * 0.5 + s * browTilt], mkMat(hair, { roughness: 0.72 }), 10);
    });

    // Optional Stylish Glasses
    if (c.glasses) {
      const gMat = { color: c.glassesColor || "#222832", material: "brushed_metal", metalness: 0.85, roughness: 0.18 };
      [-1, 1].forEach((s) => head.torus([s * 0.138, 0.045, 0.345], 0.095, 0.012, [0, s * 0.18, 0], gMat, 22, 8));
      head.box([0, 0.05, 0.36], [0.08, 0.018, 0.016], [0, 0, 0], gMat);
    }

    // Hair & Headgear Styles ("hat" | "sprout" | "bob" | "spiky" | "bun" | "curly")
    const hairStyle = c.hairStyle || (c.hat === false ? "sprout" : "hat");
    head.ellipsoid([0, 0.13, -0.04], [0.37, 0.26, 0.36], [-0.15, 0, 0], mkMat(hair, { roughness: 0.78 }), 24);
    head.ellipsoid([-0.14, 0.21, 0.24], [0.16, 0.09, 0.12], [0.22, -0.25, 0.22], mkMat(hair, { roughness: 0.78 }), 16);
    head.ellipsoid([ 0.12, 0.22, 0.24], [0.17, 0.09, 0.12], [0.22,  0.22, -0.20], mkMat(hair, { roughness: 0.78 }), 16);
    head.ellipsoid([ 0.00, 0.24, 0.27], [0.14, 0.08, 0.10], [0.28,  0.00,  0.00], mkMat(hair, { roughness: 0.78 }), 14);
    if (hairStyle === "bun") {
      head.sphere([0, 0.38, -0.14], 0.16, mkMat(hair, { roughness: 0.78 }), 18);
    } else if (hairStyle === "spiky") {
      for (let k = -2; k <= 2; k++) head.cone([k * 0.10, 0.36, 0.08 - Math.abs(k) * 0.05], 0.085, 0.22, [-0.2, 0, -k * 0.22], mkMat(hair), 12);
    } else if (hairStyle === "curly") {
      for (let k = 0; k < 7; k++) {
        const a = (k / 6) * Math.PI - Math.PI * 0.5;
        head.sphere([Math.sin(a) * 0.34, 0.24 + Math.cos(a * 2) * 0.06, Math.cos(a) * 0.26 - 0.08], 0.13, mkMat(hair), 14);
      }
    } else if (hairStyle === "sprout") {
      const spNode = head.node({ pos: [0, 0.36, 0], rot: [secLag, 0, secLag * 1.4] });
      spNode.cylinder([0, 0.08, 0], 0.02, 0.015, 0.18, [0, 0, 0], { color: "#229652", material: "foliage" }, 10);
      spNode.leaf([0, 0.16, 0], [0.3, 0.4, 0], 0.25, 0.12, 0.05, { color: "#28B862", color2: "#6CE896", material: "foliage" });
      spNode.leaf([0, 0.16, 0], [0.3, -2.6, 0], 0.23, 0.11, 0.05, { color: "#34C76E", color2: "#7EF0A4", material: "foliage" });
    } else if (hairStyle === "hat") {
      const hatNode = head.node({ pos: [0, 0.26, -0.02], rot: [-0.12 + secLag * 0.6, 0, 0] });
      hatNode.cylinder([0, 0, 0], 0.56, 0.52, 0.036, [0, 0, 0], mkMat(hatCol, { material: matStyle === "toon" ? "toon" : "fabric" }), 32);
      hatNode.ellipsoid([0, 0.06, 0], [0.33, 0.18, 0.33], [0, 0, 0], mkMat(hatCol, { material: matStyle === "toon" ? "toon" : "fabric" }), 26);
      hatNode.torus([0, 0.032, 0], 0.328, 0.024, [0, 0, 0], mkMat(overalls), 32, 10);
    }

    return { root, hips, torso, head, leftHand, rightHand };
  };

  g3dObj.character = buildChar;
  g3dObj.stylizedCharacter = buildChar;

  // 2) NON-HUMAN 3D CREATURES & MASCOTS (plant_buddy, aphid, caterpillar, mini_robot, chibi_mascot)
  g3dObj.creature = (parentNode, type, cfg) => {
    const c = cfg || {};
    const bounce = Math.abs(Math.sin(tSec * (c.speed || 4.5))) * (c.hop !== undefined ? c.hop : 0.08);
    const root = parentNode.node({ pos: c.pos || [0, 0, 0], rot: c.rot || [0, 0, 0], scale: c.scale || 1 });
    if (c.shadow !== false) root.shadow([0, 0.005, 0], 0.45, 0.45, 0.34);

    if (type === "aphid" || type === "caterpillar") {
      // Expressive Garden Pest (Aphid or Multi-Segment Crawling Caterpillar!)
      const col = c.color || (type === "aphid" ? "#84D938" : "#68C446");
      const segs = type === "caterpillar" ? 5 : 2;
      const body = root.node({ pos: [0, 0.22 + bounce * 0.4, 0] });
      for (let i = 0; i < segs; i++) {
        const wv = Math.sin(tSec * 6.5 - i * 0.85) * 0.05;
        const r = i === 0 ? 0.24 : lerpNum(0.22, 0.14, i / segs);
        body.ellipsoid([wv * 0.6, Math.max(0, wv), -i * 0.24], [r, r * 0.92, r * 1.05], [0, 0, 0], {
          color: col, color2: "#B8F268", material: c.material || "clay", sss: 0.42
        }, 20);
      }
      // Big expressive eyes & antennae on head segment
      const scared = c.expression === "scared" || c.expression === "wow";
      [-1, 1].forEach((s) => {
        body.sphere([s * 0.11, 0.08, 0.20], scared ? 0.075 : 0.062, { color: "#FFFFFF", roughness: 0.08 }, 14);
        body.sphere([s * 0.11, 0.08, 0.25], scared ? 0.028 : 0.036, { color: "#141A20", roughness: 0.06 }, 12);
        body.sphere([s * 0.125, 0.10, 0.275], 0.012, { color: "#FFFFFF", unlit: true }, 6);
        body.tube([[s * 0.07, 0.19, 0.10], [s * 0.15, 0.34, 0.18 + Math.sin(tSec * 5 + s) * 0.04]], 0.016, 0.010, { color: "#3A6E24" }, 8);
        body.sphere([s * 0.15, 0.35, 0.18 + Math.sin(tSec * 5 + s) * 0.04], 0.026, { color: "#FFD166" }, 8);
      });
      if (scared) body.ellipsoid([0, -0.06, 0.23], [0.05, 0.065, 0.03], [0, 0, 0], { color: "#9C2634" }, 12);
      else body.torus([0, -0.05, 0.22], 0.055, 0.015, [0.2, 0, Math.PI], { color: "#3A6E24" }, 16, 8);
      return { root, body };
    }

    if (type === "mini_robot") {
      const body = root.node({ pos: [0, 0.56 + Math.sin(tSec * 3.0) * 0.07, 0] });
      body.roundBox([0, 0, 0], [0.62, 0.56, 0.52], 0.20, [0, 0, 0], { color: c.color || "#DCE6F2", color2: "#FFFFFF", material: "brushed_metal", roughness: 0.18, metalness: 0.72 }, 20);
      body.roundBox([0, 0.04, 0.23], [0.48, 0.28, 0.08], 0.08, [0, 0, 0], { color: "#0B111C", material: "glass", roughness: 0.08 }, 16);
      const glow = c.eyeColor || "#4CC8FF";
      [-1, 1].forEach((s) => {
        body.ellipsoid([s * 0.12, 0.05, 0.275], [0.055, 0.068, 0.015], [0, 0, 0], { color: glow, emissive: glow, unlit: true }, 12);
        const arm = body.node({ pos: [s * 0.42, -0.02, 0], rot: [Math.sin(tSec * 4 + s) * 0.35, 0, s * 0.25] });
        arm.capsule([0, -0.10, 0], 0.065, 0.16, [0, 0, 0], { color: "#9EB0C8", material: "brushed_metal" }, 12);
      });
      body.cylinder([0, 0.36, 0], 0.016, 0.012, 0.22, [0, 0, 0], { color: "#9EB0C8", material: "brushed_metal" }, 10);
      body.sphere([0, 0.48, 0], 0.048, { color: glow, emissive: glow }, 12);
      return { root, body };
    }

    // Default: "plant_buddy" or "chibi_mascot" — Living Cute Potted Plant Mascot!
    const body = root.node({ pos: [0, bounce, 0] });
    body.lathe([[0, 0], [0.28, 0], [0.36, 0.38], [0.42, 0.40], [0.42, 0.48], [0.35, 0.48], [0, 0.44]], [0, 0, 0], [0, 0, 0], {
      color: c.potColor || "#A84224", color2: "#DC6A40", material: "terracotta"
    }, 32);
    [-1, 1].forEach((s) => {
      body.sphere([s * 0.12, 0.25, 0.33], 0.052, { color: "#FFFFFF", roughness: 0.08 }, 12);
      body.sphere([s * 0.12, 0.25, 0.37], 0.030, { color: "#1A2228", roughness: 0.06 }, 12);
      body.sphere([s * 0.132, 0.265, 0.392], 0.010, { color: "#FFFFFF", unlit: true }, 6);
      body.leaf([s * 0.34, 0.30, 0.05], [0.2, s * 1.4, Math.sin(tSec * 6 + s) * 0.35], 0.34, 0.15, 0.06, { color: "#229652", color2: "#5AE086", material: "foliage" });
    });
    body.torus([0, 0.16, 0.34], 0.048, 0.014, [0.2, 0, Math.PI], { color: "#521C10" }, 16, 8);
    body.flower(c.flowerType || "chili_plant", [0, 0.42, 0], { grow: 0.85, bloom: 1.0, scale: 0.85 });
    return { root, body };
  };
}
// =======================================================
// CINEMA PRO MODULE: TIMELINE SEQUENCER, AUTO-FOCUS DOF, 3D PROPS & 2D PRO SUITE
// =======================================================
function attachProSceneCamera(sceneApi, getEye, getTarget, getFov, setCam, postCfg, tSec) {
  // Automatically locks Depth-of-Field focus distance onto any 3D world point (order-independent!)
  sceneApi.autoFocus = (worldPt, aperture) => {
    if (Array.isArray(worldPt) && worldPt.length >= 3) {
      postCfg._autoFocusPt = [worldPt[0], worldPt[1], worldPt[2]];
      const e = getEye();
      postCfg.dofFocus = Math.hypot(e[0] - worldPt[0], e[1] - worldPt[1], e[2] - worldPt[2]);
    } else {
      postCfg._autoFocusPt = null;
    }
    if (aperture !== undefined) postCfg.dofAperture = aperture;
    return sceneApi;
  };

  // Organic 3-axis cinema handheld micro-sway
  sceneApi.handheld = (amp, speed) => {
    const a = amp !== undefined ? amp : 0.045, sp = speed !== undefined ? speed : 1.35;
    const e = getEye(), tg = getTarget();
    const ox = (Math.sin(tSec * sp * 1.7) * 0.6 + Math.cos(tSec * sp * 2.9) * 0.4) * a;
    const oy = (Math.cos(tSec * sp * 1.4) * 0.6 + Math.sin(tSec * sp * 2.5) * 0.4) * a * 0.75;
    const oz = Math.sin(tSec * sp * 1.1) * a * 0.35;
    setCam([e[0] + ox, e[1] + oy, e[2] + oz], [tg[0] + ox * 0.25, tg[1] + oy * 0.25, tg[2]], null);
    return sceneApi;
  };

  // Hitchcock Vertigo Dolly-Zoom (moves camera while counter-scaling FOV to keep hero constant size)
  sceneApi.dollyZoom = (worldTarget, baseDist, factor, baseFov) => {
    const tg = worldTarget || getTarget();
    const f0 = baseFov || getFov() || 0.64;
    const k = clampNum(factor !== undefined ? factor : 1.0, 0.45, 2.2);
    const e = getEye();
    let dx = e[0] - tg[0], dy = e[1] - tg[1], dz = e[2] - tg[2];
    const dm = Math.hypot(dx, dy, dz) || 1;
    dx /= dm; dy /= dm; dz /= dm;
    const newDist = (baseDist || dm) * k;
    const newFov = clampNum(2 * Math.atan(Math.tan(f0 * 0.5) / k), 0.28, 1.35);
    setCam([tg[0] + dx * newDist, tg[1] + dy * newDist, tg[2] + dz * newDist], tg, newFov);
    return sceneApi;
  };
}

// High-Detail Procedural 3D Storytelling Props (node.prop)
function attachProNodeProps(nodeApi, g3dObj, tSec) {
  nodeApi.prop = (type, pos, rot, opts) => {
    const o = opts || {};
    const pr = nodeApi.node({ pos: pos || [0, 0, 0], rot: rot || [0, 0, 0], scale: o.scale !== undefined ? o.scale : 1 });
    if (o.shadow) pr.shadow([0, 0.005, 0], o.shadowR || 0.45, o.shadowR || 0.45, 0.32);

    if (type === "watering_can") {
      const col = o.color || "#1C8CD8", col2 = o.color2 || "#58C8FF";
      pr.cylinder([0, 0.14, 0], 0.16, 0.15, 0.28, [0, 0, 0], { color: col, color2: col2, material: "brushed_metal", metalness: 0.35, roughness: 0.24 }, 24);
      pr.torus([0, 0.16, -0.15], 0.10, 0.020, [0, Math.PI * 0.5, 0], { color: col, roughness: 0.28 }, 18, 8);
      pr.cylinder([0, 0.25, 0.21], 0.024, 0.044, 0.32, [0.95, 0, 0], { color: col, roughness: 0.28 }, 14);
      pr.sphere([0, 0.35, 0.35], 0.054, { color: "#F5C242", material: "brushed_metal", metalness: 0.78 }, 14);
    } else if (type === "spray_bottle") {
      const col = o.color || "#1E8E4E";
      const prof = [[0, 0], [0.16, 0], [0.18, 0.04], [0.18, 0.36], [0.08, 0.48], [0.07, 0.58], [0, 0.58]];
      pr.lathe(prof, [0, 0, 0], [0, 0, 0], { color: col, color2: "#4CE088", material: "glass", alpha: 0.90 }, 24);
      pr.roundBox([0, 0.64, 0.04], [0.10, 0.11, 0.22], 0.03, [0, 0, 0], { color: "#F2F5F8", roughness: 0.32 }, 12);
      pr.box([0, 0.57, 0.11], [0.03, 0.10, 0.025], [-0.35, 0, 0], { color: "#E53935", roughness: 0.35 });
      if (o.label) pr.lathe([[0.184, 0.08], [0.184, 0.32]], [0, 0, 0], [0, 0, 0], { color: "#FFFFFF", map: o.label, roughness: 0.35 }, 24);
    } else if (type === "laptop") {
      const openA = o.openAngle !== undefined ? o.openAngle : 1.82;
      const bodyMat = { color: o.color || "#A6B0BE", color2: "#E8EEF6", material: "brushed_metal", metalness: 0.90, roughness: 0.18 };
      pr.roundBox([0, 0.025, 0], [0.92, 0.045, 0.64], 0.02, [0, 0, 0], bodyMat, 14);
      pr.box([0, 0.05, 0.02], [0.78, 0.008, 0.34], [0, 0, 0], { color: "#1A202B", roughness: 0.6 });
      const lid = pr.node({ pos: [0, 0.045, -0.30], rot: [-(Math.PI - openA), 0, 0] });
      lid.roundBox([0, 0.31, 0], [0.92, 0.62, 0.032], 0.02, [0, 0, 0], bodyMat, 14);
      lid.mesh(buildQuadPlaneGeo(0.84, 0.54), [0, 0.31, 0.019], [0, 0, 0], 1, {
        color: "#FFFFFF", map: o.screen || null, unlit: !!o.screen, emissive: o.screen ? "#101828" : "#182848"
      });
    } else if (type === "signpost") {
      const wMat = { color: o.woodColor || "#7A4F30", color2: "#A8744B", material: "wood", roughness: 0.72 };
      pr.cylinder([0, 0.45, 0], 0.055, 0.048, 0.90, [0, 0, 0], wMat, 14);
      pr.roundBox([0, 0.76, 0.05], [0.88, 0.42, 0.06], 0.02, [0, 0, o.tilt || 0.04], wMat, 12);
      if (o.text || o.map) {
        const signTex = o.map || g3dObj.texture((c2, tw, th) => {
          c2.fillStyle = o.bgColor || "#FAF4E6"; c2.fillRect(0, 0, tw, th);
          c2.strokeStyle = o.borderColor || "#2B8A4E"; c2.lineWidth = 18; c2.strokeRect(18, 18, tw - 36, th - 36);
          c2.fillStyle = o.textColor || "#18261D"; c2.font = "800 72px sans-serif";
          c2.textAlign = "center"; c2.textBaseline = "middle";
          c2.fillText(String(o.text || "GARDEN"), tw * 0.5, th * 0.52);
        }, 512);
        pr.mesh(buildQuadPlaneGeo(0.80, 0.35), [0, 0.76, 0.084], [0, 0, o.tilt || 0.04], 1, { color: "#FFFFFF", map: signTex, roughness: 0.55 });
      }
    } else if (type === "lamp") {
      const mMat = { color: o.color || "#2A323F", material: "brushed_metal", metalness: 0.82, roughness: 0.26 };
      pr.cylinder([0, 0.03, 0], 0.18, 0.16, 0.06, [0, 0, 0], mMat, 20);
      pr.cylinder([0, 0.48, 0], 0.032, 0.028, 0.90, [0, 0, 0], mMat, 14);
      pr.cone([0, 0.96, 0], 0.24, 0.18, [0, 0, 0], mMat, 22);
      pr.sphere([0, 0.86, 0], 0.11, { color: "#FFF8D8", emissive: o.glowColor || "#FFD470", unlit: false, castShadow: false }, 16);
    } else if (type === "book") {
      const col = o.color || "#C83E37";
      pr.roundBox([0, 0.06, 0], [0.52, 0.11, 0.68], 0.02, [0, 0, 0], { color: col, material: "fabric", roughness: 0.65 }, 12);
      pr.box([0.02, 0.06, 0], [0.47, 0.085, 0.62], [0, 0, 0], { color: "#FAF5E8", roughness: 0.82 });
    } else if (type === "bench") {
      const wMat = { color: "#8C5834", color2: "#B87D50", material: "wood", roughness: 0.68 };
      const iMat = { color: "#28303A", material: "brushed_metal", metalness: 0.78, roughness: 0.32 };
      pr.roundBox([0, 0.34, 0], [1.35, 0.07, 0.46], 0.02, [0, 0, 0], wMat, 12);
      pr.roundBox([0, 0.62, -0.20], [1.35, 0.24, 0.06], 0.02, [-0.15, 0, 0], wMat, 12);
      [-0.52, 0.52].forEach((lx) => {
        pr.box([lx, 0.17, 0.16], [0.06, 0.34, 0.06], [0, 0, 0], iMat);
        pr.box([lx, 0.34, -0.18], [0.06, 0.68, 0.06], [0, 0, 0], iMat);
      });
    } else if (type === "crate") {
      const wMat = { color: o.color || "#9E6B42", color2: "#C48E5E", material: "wood", roughness: 0.75 };
      pr.roundBox([0, 0.24, 0], [0.56, 0.48, 0.56], 0.03, [0, 0, 0], wMat, 12);
      pr.box([0, 0.24, 0.285], [0.54, 0.08, 0.02], [0, 0, 0], { color: "#734B2C", material: "wood" });
      pr.box([0, 0.24, -0.285], [0.54, 0.08, 0.02], [0, 0, 0], { color: "#734B2C", material: "wood" });
    }
    return pr;
  };
}

// =======================================================
// 2D PRO EXTENSIONS: REELS SAFE ZONES, SPEECH BUBBLE, SPLIT COMPARE, BENTO, TIMELINE, PATHS & NOISE2D
// =======================================================
function enhanceProUi(baseUi, W, H, S) {
  const isVert = H > W * 1.1;
  const padX = Math.min(W, H) * 0.068;
  const topM = isVert ? H * 0.105 : H * 0.08;
  const botM = isVert ? H * 0.155 : H * 0.10;
  const safe = Object.freeze({
    top: topM, bottom: botM, left: padX, right: padX,
    x: padX, y: topM, w: W - padX * 2, h: H - topM - botM
  });

  // 3D-Tracked Smart Speech Bubble (auto-clamps inside screen & draws tail to character!)
  const drawSpeechBubble = (c, projPt, text, opts) => {
    if (!projPt || projPt.visible === false) return;
    const o = opts || {}, k = ease.outBack(clampNum(o.prog === undefined ? 1 : o.prog, 0, 1));
    if (k <= 0.01) return;
    const fSize = Math.round(o.size || 28 * S);
    const maxW = o.maxW || Math.min(W * 0.62, 540 * S);
    const light = o.light !== false;
    c.save();
    c.font = "700 " + fSize + "px sans-serif";
    const lines = baseUi.wrapText(c, String(text || ""), maxW - 44 * S);
    let maxLineW = 0;
    for (let i = 0; i < lines.length; i++) maxLineW = Math.max(maxLineW, c.measureText(lines[i]).width);
    const lineH = fSize * 1.28;
    const bw = Math.max(120 * S, maxLineW + 48 * S);
    const bh = lines.length * lineH + 34 * S;
    const offX = (o.dx || 0) * S, offY = (o.dy !== undefined ? o.dy : -145) * S;
    const bx = clampNum(projPt.x + offX - bw * 0.5, padX, W - padX - bw);
    const by = clampNum(projPt.y + offY - bh, padX, H - padX - bh - 40 * S);
    const pivotX = clampNum(projPt.x, bx + 28 * S, bx + bw - 28 * S);
    const pivotY = by + bh;

    c.translate(pivotX, pivotY);
    c.scale(k, k);
    c.translate(-pivotX, -pivotY);

    // Bubble Shadow + Tail + Frosted Glass Body
    c.fillStyle = light ? "rgba(255,255,255,0.92)" : "rgba(18,26,38,0.86)";
    c.beginPath();
    c.moveTo(pivotX - 14 * S, by + bh - 2 * S);
    c.lineTo(pivotX + 14 * S, by + bh - 2 * S);
    c.lineTo(clampNum(projPt.x, bx + 12 * S, bx + bw - 12 * S), Math.min(projPt.y - 12 * S, by + bh + 34 * S));
    c.closePath();
    c.fill();

    baseUi.drawLiquidGlass(c, bx, by, bw, bh, 24 * S, { light, chromatic: true });
    c.fillStyle = light ? "#111A14" : "#F6F8FB";
    c.textAlign = "left"; c.textBaseline = "top";
    for (let i = 0; i < lines.length; i++) {
      c.fillText(lines[i], bx + 24 * S, by + 18 * S + i * lineH);
    }
    c.restore();
  };

  // Interactive Before/After Wipe Comparison (Killer for gardening, editing & product demos!)
  const drawSplitCompare = (c, u, drawBefore, drawAfter, opts) => {
    const o = opts || {}, k = clampNum(u, 0, 1);
    const cutX = W * k, col = o.color || "#FFFFFF";
    drawBefore(k);
    c.save();
    c.beginPath(); c.rect(cutX, 0, W - cutX + 2, H); c.clip();
    drawAfter(k);
    c.restore();

    // Glowing glass divider line & center handle
    c.save();
    c.strokeStyle = col; c.lineWidth = Math.max(2.5, 4 * S);
    c.beginPath(); c.moveTo(cutX, 0); c.lineTo(cutX, H); c.stroke();
    const hy = H * 0.5, hr = 30 * S;
    baseUi.drawGlow(c, cutX, hy, 48 * S, col, 0.35);
    c.fillStyle = "rgba(255,255,255,0.92)";
    c.beginPath(); c.arc(cutX, hy, hr, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#101820"; c.font = "800 " + Math.round(22 * S) + "px sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("◂▸", cutX, hy + 1 * S);

    if (o.beforeLabel && cutX > 150 * S) {
      baseUi.drawPill(c, padX, safe.top, o.beforeLabel, "rgba(10,14,22,0.68)", "#FFFFFF", Math.round(18 * S));
    }
    if (o.afterLabel && (W - cutX) > 150 * S) {
      c.font = "700 " + Math.round(18 * S) + "px sans-serif";
      const pw = c.measureText(o.afterLabel).width + 32 * S;
      baseUi.drawPill(c, W - padX - pw, safe.top, o.afterLabel, "rgba(255,255,255,0.85)", "#0E141D", Math.round(18 * S));
    }
    c.restore();
  };

  // One-line Apple Keynote Bento Metric Card (zero layout overlap!)
  const drawBentoCard = (c, x, y, w, h, opts) => {
    const o = opts || {}, light = !!o.light, accent = o.accent || "#32D74B";
    baseUi.drawLiquidGlass(c, x, y, w, h, o.radius || 26 * S, { light, sweep: o.sweep });
    const px = x + 28 * S, hasRing = o.ring !== undefined && o.ring !== null;
    const textMaxW = w - (hasRing ? 156 * S : 56 * S);
    c.save(); c.textAlign = "left"; c.textBaseline = "top";
    if (o.eyebrow) {
      c.fillStyle = accent;
      c.font = "800 " + Math.max(11, Math.round(18 * S)) + "px monospace, sans-serif";
      c.fillText(String(o.eyebrow).toUpperCase(), px, y + 24 * S, textMaxW);
    }
    if (o.value !== undefined) {
      c.fillStyle = light ? "#0E141D" : "#FFFFFF";
      c.font = "800 " + Math.max(18, Math.round((o.valueSize || 46) * S)) + "px sans-serif";
      c.fillText(String(o.value), px, y + (o.eyebrow ? 54 * S : 26 * S), textMaxW);
    }
    if (o.sub) {
      c.fillStyle = light ? "rgba(14,20,29,0.66)" : "rgba(218,232,248,0.72)";
      c.font = "500 " + Math.max(11, Math.round(21 * S)) + "px sans-serif";
      c.fillText(String(o.sub), px, y + h - 44 * S, textMaxW);
    }
    if (hasRing) {
      const rRad = Math.min(44 * S, h * 0.30);
      baseUi.drawRing(c, x + w - rRad - 28 * S, y + h * 0.5, rRad, o.ring, accent, o.ringLabel || (Math.round(o.ring * 100) + "%"), light ? "rgba(14,20,29,0.08)" : "rgba(255,255,255,0.12)", light ? "#0E141D" : "#FFFFFF", 6 * S);
    }
    c.restore();
  };

  return Object.freeze(Object.assign({}, baseUi, { safe, drawSpeechBubble, drawSplitCompare, drawBentoCard }));
}

function enhanceProFx(baseFx, W, H, S, t, frame, fps, rand, ui) {
  // Deterministic 2D Smooth Gradient/Value Noise in [-1, 1]
  const h2 = (ix, iy) => {
    let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise2D = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
    return (lerpNum(lerpNum(a, b, ux), lerpNum(c, d, ux), uy) * 2 - 1);
  };

  // Catmull-Rom Smooth Spline Path Follower -> { x, y, angle, tx, ty }
  const followPath = (pts, uVal) => {
    if (!Array.isArray(pts) || pts.length < 2) return { x: 0, y: 0, angle: 0, tx: 1, ty: 0 };
    const n = pts.length - 1, u = clampNum(uVal, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(u)), f = u - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
    const f2 = f * f, f3 = f2 * f;
    const cr = (v0, v1, v2, v3) => 0.5 * ((2 * v1) + (-v0 + v2) * f + (2 * v0 - 5 * v1 + 4 * v2 - v3) * f2 + (-v0 + 3 * v1 - 3 * v2 + v3) * f3);
    const crD = (v0, v1, v2, v3) => 0.5 * ((-v0 + v2) + 2 * (2 * v0 - 5 * v1 + 4 * v2 - v3) * f + 3 * (-v0 + 3 * v1 - 3 * v2 + v3) * f2);
    const x = cr(p0[0], p1[0], p2[0], p3[0]), y = cr(p0[1], p1[1], p2[1], p3[1]);
    const tx = crD(p0[0], p1[0], p2[0], p3[0]), ty = crD(p0[1], p1[1], p2[1], p3[1]);
    const tm = Math.hypot(tx, ty) || 1;
    return { x, y, angle: Math.atan2(ty, tx), tx: tx / tm, ty: ty / tm };
  };

  // Declarative Remotion-Grade Multi-Scene Timeline Sequencer!
  // Accepts [{ id: "hook", dur: 3.5 }, { id: "demo", dur: 6.5, trans: 0.5 }, ...] OR explicit { start, end }
  const timeline = (tSec, defs) => {
    const curT = tSec !== undefined ? tSec : t;
    let cursor = 0;
    const list = (defs || []).map((d, idx) => {
      const st = d.start !== undefined ? d.start : cursor;
      const dur = d.dur !== undefined ? d.dur : Math.max(0.1, (d.end || (st + 3)) - st);
      const en = d.end !== undefined ? d.end : (st + dur);
      cursor = en;
      return { id: d.id || ("scene_" + idx), index: idx, start: st, end: en, dur: Math.max(0.001, en - st), trans: d.trans !== undefined ? d.trans : 0.42 };
    });
    let activeIdx = list.length - 1;
    for (let i = 0; i < list.length; i++) {
      if (curT >= list[i].start && curT < list[i].end) { activeIdx = i; break; }
    }
    const cur = list[Math.max(0, activeIdx)] || { id: "none", index: 0, start: 0, end: 1, dur: 1, trans: 0 };
    const prev = activeIdx > 0 ? list[activeIdx - 1] : null;
    const localT = clampNum(curT - cur.start, 0, cur.dur);
    const localP = clampNum(localT / cur.dur, 0, 1);
    const isTransition = !!(prev && cur.trans > 0 && localT < cur.trans);
    const transU = isTransition ? clampNum(localT / cur.trans, 0, 1) : 1;

    const byId = {};
    list.forEach((s) => { byId[s.id] = s; });

    return Object.freeze({
      id: cur.id, index: cur.index, localT, localP, dur: cur.dur,
      isTransition, transU, fromId: prev ? prev.id : null, toId: cur.id, scenes: list,
      active(id) { return cur.id === id || (isTransition && prev && prev.id === id); },
      at(id) {
        const s = byId[id];
        if (!s) return { active: false, t: 0, p: 0, in: 0, out: 0 };
        const lt = clampNum(curT - s.start, 0, s.dur), lp = clampNum(lt / s.dur, 0, 1);
        const isAct = (curT >= s.start && curT < s.end + (list[s.index + 1] ? list[s.index + 1].trans : 0));
        return {
          active: isAct, t: lt, p: lp,
          in: ease.snap(clampNum(lt / Math.max(0.12, s.trans || 0.35), 0, 1)),
          out: 1 - ease.whip(clampNum((curT - (s.end - 0.30)) / 0.30, 0, 1))
        };
      }
    });
  };

  const math = Object.freeze({
    smoothstep: (e0, e1, x) => { const u = clampNum((x - e0) / Math.max(0.0001, e1 - e0), 0, 1); return u * u * (3 - 2 * u); },
    smootherstep: (e0, e1, x) => { const u = clampNum((x - e0) / Math.max(0.0001, e1 - e0), 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); },
    remap: (v, a0, a1, b0, b1) => lerpNum(b0, b1, clampNum((v - a0) / Math.max(0.0001, a1 - a0), 0, 1)),
    pingPong: (x) => 1 - Math.abs(((x % 2) + 2) % 2 - 1),
    fract: (x) => x - Math.floor(x),
    rad: (deg) => deg * (Math.PI / 180),
    deg: (rad) => rad * (180 / Math.PI)
  });

  return Object.freeze(Object.assign({}, baseFx, { timeline, noise2D, followPath, math }));
}
// =======================================================
// SOFTWARE 3D FALLBACK (d3), 2D MOTION PRO SUITE (ui, fx) & WORKER ENTRY
// =======================================================
const d3 = Object.freeze({
  rotX(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1]*c - v[2]*s, v[1]*s + v[2]*c]; },
  rotY(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0]*c + v[2]*s, v[1], -v[0]*s + v[2]*c]; },
  rotZ(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0]*c - v[1]*s, v[0]*s + v[1]*c, v[2]]; },
  norm(a) { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/m, a[1]/m, a[2]/m]; },
  dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; },
  cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; },
  sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; },
  camera(eye, target, fovRad, W, H, cyRatio) {
    const fwd = d3.norm(d3.sub(target, eye)), right = d3.norm(d3.cross(fwd, [0, 1, 0])), up = d3.cross(right, fwd);
    const focal = (Math.min(W, H) * 0.9) / Math.tan((fovRad || 0.72) * 0.5), cx = W * 0.5, cy = H * (cyRatio !== undefined ? cyRatio : 0.5);
    return (pt) => {
      const d = d3.sub(pt, eye), px = d3.dot(d, right), py = d3.dot(d, up), pz = d3.dot(d, fwd);
      if (pz < 0.25) return null;
      const k = focal / pz; return [cx + px * k, cy - py * k, pz];
    };
  },
  createScene(eye, target, fovRad, W, H, cyRatio) {
    const proj = d3.camera(eye, target, fovRad, W, H, cyRatio), q = [];
    return {
      project: proj,
      poly(verts, colHex, opts) {
        const o = opts || {}, ps = []; let sz = 0;
        for (let i = 0; i < verts.length; i++) { const pr = proj(verts[i]); if (!pr) return; ps.push(pr); sz += pr[2]; }
        q.push({ z: sz / verts.length, ps, c: rgbStr(parseHexRGB(colHex, [220, 60, 85]), o.alpha) });
      },
      render(c) {
        q.sort((a, b) => b.z - a.z);
        for (let i = 0; i < q.length; i++) {
          const it = q[i]; c.beginPath(); c.moveTo(it.ps[0][0], it.ps[0][1]);
          for (let k = 1; k < it.ps.length; k++) c.lineTo(it.ps[k][0], it.ps[k][1]);
          c.closePath(); c.fillStyle = it.c; c.fill();
        }
      }
    };
  }
});

function makeUiApi(S) {
  const rrectFn = (c, x, y, w, h, r) => {
    const rr = Math.max(0, Math.min(r || 0, w * 0.5, h * 0.5));
    c.beginPath();
    c.moveTo(x + rr, y); c.lineTo(x + w - rr, y); c.quadraticCurveTo(x + w, y, x + w, y + rr);
    c.lineTo(x + w, y + h - rr); c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    c.lineTo(x + rr, y + h); c.quadraticCurveTo(x, y + h, x, y + h - rr);
    c.lineTo(x, y + rr); c.quadraticCurveTo(x, y, x + rr, y); c.closePath();
  };

  const drawGlassBase = (c, x, y, w, h, r, opts) => {
    const o = opts || {}, light = !!o.light, rad = r !== undefined ? r : 28 * S, sweep = o.sweep !== undefined ? o.sweep : -1;
    c.save();
    c.shadowColor = light ? "rgba(18, 28, 42, 0.13)" : "rgba(0, 0, 0, 0.44)";
    c.shadowBlur = 40 * S; c.shadowOffsetY = 14 * S;
    const bg = c.createLinearGradient(x, y, x + w * 0.15, y + h);
    if (light) {
      bg.addColorStop(0, "rgba(255, 255, 255, 0.88)"); bg.addColorStop(0.5, "rgba(247, 250, 255, 0.72)"); bg.addColorStop(1, "rgba(255, 255, 255, 0.80)");
    } else {
      bg.addColorStop(0, "rgba(255, 255, 255, 0.16)"); bg.addColorStop(0.45, "rgba(255, 255, 255, 0.065)"); bg.addColorStop(1, "rgba(255, 255, 255, 0.11)");
    }
    c.fillStyle = bg; rrectFn(c, x, y, w, h, rad); c.fill(); c.restore();

    c.save(); rrectFn(c, x, y, w, h, rad); c.clip();
    const specR = Math.max(w, h) * 0.82;
    const sheen = c.createRadialGradient(x + w * 0.18, y - h * 0.12, 0, x + w * 0.18, y - h * 0.12, specR);
    sheen.addColorStop(0, light ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.20)");
    sheen.addColorStop(0.42, light ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = sheen; c.fillRect(x, y, w, h);

    if (sweep >= 0) {
      const sx = lerpNum(x - w * 0.55, x + w * 1.55, sweep % 1);
      const beam = c.createLinearGradient(sx - w * 0.24, y, sx + w * 0.24, y + h);
      beam.addColorStop(0, "rgba(255,255,255,0)");
      beam.addColorStop(0.5, light ? "rgba(255,255,255,0.52)" : "rgba(215,236,255,0.18)");
      beam.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = beam; c.fillRect(x, y, w, h);
    }
    c.restore();

    c.save();
    const rim = c.createLinearGradient(x, y, x + w, y + h);
    if (o.chromatic !== false) {
      rim.addColorStop(0, light ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.56)");
      rim.addColorStop(0.35, light ? "rgba(165,212,255,0.48)" : "rgba(155,212,255,0.24)");
      rim.addColorStop(0.70, light ? "rgba(255,198,224,0.32)" : "rgba(255,255,255,0.12)");
      rim.addColorStop(1, light ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.38)");
    } else {
      rim.addColorStop(0, light ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.42)");
      rim.addColorStop(1, light ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.26)");
    }
    c.strokeStyle = rim; c.lineWidth = Math.max(1.3, 2.1 * S); rrectFn(c, x, y, w, h, rad); c.stroke(); c.restore();
  };

  const drawGlowFn = (c, x, y, r, hex, alpha) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r), rgb = parseHexRGB(hex, [220, 230, 242]);
    g.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + clampNum(alpha, 0, 1) + ")");
    g.addColorStop(0.55, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + clampNum(alpha * 0.25, 0, 1) + ")");
    g.addColorStop(1, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  };

  // After Effects-style Trim Path along polyline points [[x,y], ...] with arrow or glowing head!
  const drawTrimPathFn = (c, pts, prog, opts) => {
    if (!Array.isArray(pts) || pts.length < 2) return null;
    const o = opts || {}, k = clampNum(prog === undefined ? 1 : prog, 0, 1);
    if (k <= 0.002) return null;
    const segLens = []; let totalLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      segLens.push(l); totalLen += l;
    }
    if (totalLen < 0.001) return null;
    const targetLen = totalLen * k;
    let acc = 0, tip = pts[0], prev = pts[0];
    c.save();
    c.strokeStyle = o.color || "#FFFFFF";
    c.lineWidth = o.width || Math.max(2, 3.6 * S);
    c.lineCap = "round"; c.lineJoin = "round";
    if (o.dash) c.setLineDash(o.dash);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < segLens.length; i++) {
      if (acc + segLens[i] >= targetLen) {
        const u = (targetLen - acc) / Math.max(0.0001, segLens[i]);
        const nx = lerpNum(pts[i][0], pts[i + 1][0], u), ny = lerpNum(pts[i][1], pts[i + 1][1], u);
        c.lineTo(nx, ny); prev = pts[i]; tip = [nx, ny]; break;
      } else {
        c.lineTo(pts[i + 1][0], pts[i + 1][1]); acc += segLens[i]; prev = pts[i]; tip = pts[i + 1];
      }
    }
    c.stroke();
    c.setLineDash([]);
    if (o.arrow && k > 0.1) {
      const ang = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]), asz = o.arrowSize || (14 * S);
      c.fillStyle = o.color || "#FFFFFF";
      c.beginPath(); c.moveTo(tip[0], tip[1]);
      c.lineTo(tip[0] - Math.cos(ang - 0.5) * asz, tip[1] - Math.sin(ang - 0.5) * asz);
      c.lineTo(tip[0] - Math.cos(ang + 0.5) * asz, tip[1] - Math.sin(ang + 0.5) * asz);
      c.closePath(); c.fill();
    }
    if (o.dot) {
      drawGlowFn(c, tip[0], tip[1], 16 * S, o.color || "#FFFFFF", 0.65);
      c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(tip[0], tip[1], 5 * S, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    return { x: tip[0], y: tip[1] };
  };

  return Object.freeze({
    clamp: clampNum, lerp: lerpNum, seg: (val, a, b) => clampNum((val - a) / Math.max(0.0001, b - a), 0, 1),
    rgba(hex, alpha) { const c = parseHexRGB(hex, [17, 24, 20]); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + clampNum(alpha, 0, 1) + ")"; },
    mixColor(h1, h2, u) {
      const a = parseHexRGB(h1, [15, 23, 42]), b = parseHexRGB(h2, [235, 240, 246]), k = clampNum(u, 0, 1);
      return "rgb(" + Math.round(lerpNum(a[0],b[0],k)) + "," + Math.round(lerpNum(a[1],b[1],k)) + "," + Math.round(lerpNum(a[2],b[2],k)) + ")";
    },
    rrect: rrectFn,
    wrapText(c, text, maxW) {
      const words = String(text || "").trim().split(/\s+/).filter(Boolean);
      if (!words.length) return [""];
      const out = []; let cur = words[0];
      for (let i = 1; i < words.length; i++) {
        const nxt = cur + " " + words[i];
        if (c.measureText(nxt).width <= maxW) cur = nxt; else { out.push(cur); cur = words[i]; }
      }
      out.push(cur); return out;
    },
    drawGrid(c, W, H, stepPx, colStr) {
      const st = Math.max(24, stepPx || 120 * S);
      c.save(); c.strokeStyle = colStr || "rgba(255,255,255,0.038)"; c.lineWidth = Math.max(1, 1.1 * S); c.beginPath();
      for (let x = 0; x <= W; x += st) { c.moveTo(x, 0); c.lineTo(x, H); }
      for (let y = 0; y <= H; y += st) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke(); c.restore();
    },
    drawVignette(c, W, H, strength, light) {
      const g = c.createRadialGradient(W * 0.5, H * 0.46, Math.min(W, H) * 0.34, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, light ? ("rgba(28,36,48," + clampNum(strength || 0.10, 0, 0.6) + ")") : ("rgba(0,0,0," + clampNum(strength || 0.38, 0, 0.85) + ")"));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    },
    drawGlow: drawGlowFn,
    drawTrimPath: drawTrimPathFn,
    // SVG Path2D renderer with optional stroke Trim-Path animation!
    drawSvg(c, dStr, x, y, scale, opts) {
      if (typeof Path2D === "undefined" || !dStr) return;
      const o = opts || {}, sc = scale !== undefined ? scale : S, path = new Path2D(String(dStr));
      c.save();
      c.translate(x || 0, y || 0);
      if (o.rot) c.rotate(o.rot);
      c.scale(sc, sc);
      if (o.fill) { c.fillStyle = o.fill; c.fill(path); }
      if (o.stroke) {
        c.strokeStyle = o.stroke;
        c.lineWidth = o.lineWidth || 2.5;
        c.lineCap = "round"; c.lineJoin = "round";
        if (o.trim !== undefined && o.trim < 0.999) {
          const total = o.pathLength || 600;
          const drawn = Math.max(0.01, total * clampNum(o.trim, 0, 1));
          c.setLineDash([drawn, total + 10]);
        }
        c.stroke(path);
      }
      c.restore();
    },
    // Auto-Fit Display Typography with custom tracking, gradient fill & stroke
    drawDisplayText(c, text, x, y, maxW, opts) {
      const o = opts || {}, s = String(text || ""), weight = o.weight || "800", family = o.font || "sans-serif";
      let fSize = Math.round(o.size || 78 * S);
      const minSize = Math.round(o.minSize || 24 * S), track = o.tracking || 0;
      const measureTracked = (str, fs) => {
        c.font = weight + " " + fs + "px " + family;
        if (!track) return c.measureText(str).width;
        let w = 0; for (let i = 0; i < str.length; i++) w += c.measureText(str[i]).width + (i < str.length - 1 ? track : 0);
        return w;
      };
      while (fSize > minSize && measureTracked(s, fSize) > maxW) fSize = Math.max(minSize, Math.floor(fSize * 0.94));
      const tw = measureTracked(s, fSize);
      const sx = o.align === "center" ? x - tw * 0.5 : (o.align === "right" ? x - tw : x);
      c.save();
      c.font = weight + " " + fSize + "px " + family;
      c.textBaseline = o.baseline || "top"; c.textAlign = "left";
      if (o.shadow) { c.shadowColor = o.shadow; c.shadowBlur = 18 * S; c.shadowOffsetY = 6 * S; }
      if (Array.isArray(o.gradient) && o.gradient.length >= 2) {
        const gr = c.createLinearGradient(sx, y, sx + tw, y + fSize);
        gr.addColorStop(0, o.gradient[0]); gr.addColorStop(1, o.gradient[1]);
        c.fillStyle = gr;
      } else {
        c.fillStyle = o.color || "#FFFFFF";
      }
      if (!track) {
        if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.strokeWidth || 3 * S; c.strokeText(s, sx, y); }
        c.fillText(s, sx, y);
      } else {
        let cx = sx;
        for (let i = 0; i < s.length; i++) {
          if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.strokeWidth || 3 * S; c.strokeText(s[i], cx, y); }
          c.fillText(s[i], cx, y);
          cx += c.measureText(s[i]).width + track;
        }
      }
      c.restore();
      return { fontSize: fSize, width: tw };
    },
    // 3D-to-2D AR / Apple Keynote Callout Pin (anchors to sc.project() screen coordinates!)
    drawCallout(c, projPt, title, sub, opts) {
      if (!projPt || projPt.visible === false) return;
      const o = opts || {}, k = ease.snap(clampNum(o.prog === undefined ? 1 : o.prog, 0, 1));
      if (k <= 0.01) return;
      const dx = (o.dx !== undefined ? o.dx : 110) * S, dy = (o.dy !== undefined ? o.dy : -110) * S;
      const col = o.color || "#4AA3FF", light = !!o.light;
      const ax = projPt.x, ay = projPt.y;
      const mx = ax + dx * 0.42, my = ay + dy;
      const bx = ax + dx, by = my;

      // Anchor pulse dot on 3D object
      c.save();
      drawGlowFn(c, ax, ay, 18 * S, col, 0.75 * k);
      c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(ax, ay, 5.5 * S * k, 0, Math.PI * 2); c.fill();
      c.strokeStyle = col; c.lineWidth = 2.5 * S; c.beginPath(); c.arc(ax, ay, 10 * S * k, 0, Math.PI * 2); c.stroke();
      c.restore();

      // Animated Trim-Path leader line
      drawTrimPathFn(c, [[ax, ay], [mx, my], [bx, by]], clampNum(k * 1.4, 0, 1), { color: col, width: 2.6 * S });

      // Floating Glass Callout Tag
      const cardK = clampNum((k - 0.25) / 0.75, 0, 1);
      if (cardK > 0.02) {
        c.save();
        c.font = "800 " + Math.round(24 * S) + "px sans-serif";
        const w1 = c.measureText(String(title || "")).width;
        c.font = "500 " + Math.round(18 * S) + "px sans-serif";
        const w2 = sub ? c.measureText(String(sub)).width : 0;
        const cw = Math.max(w1, w2) + 42 * S, ch = sub ? 78 * S : 52 * S;
        const padC = 28 * S;
        const rawCx = dx >= 0 ? bx + 8 * S : bx - cw - 8 * S;
        const cx = clampNum(rawCx, padC, c.canvas.width - padC - cw);
        const cy = clampNum(by - ch * 0.5, padC, c.canvas.height - padC - ch);
        c.globalAlpha *= cardK;
        drawGlassBase(c, cx, cy, cw, ch, 16 * S, { light, chromatic: true });
        c.fillStyle = light ? "#0E141D" : "#FFFFFF";
        c.font = "800 " + Math.round(23 * S) + "px sans-serif";
        c.textAlign = "left"; c.textBaseline = "top";
        c.fillText(String(title || ""), cx + 20 * S, cy + (sub ? 14 * S : 14 * S));
        if (sub) {
          c.fillStyle = light ? "rgba(14,20,29,0.68)" : "rgba(218,232,248,0.75)";
          c.font = "600 " + Math.round(17 * S) + "px monospace, sans-serif";
          c.fillText(String(sub), cx + 20 * S, cy + 44 * S);
        }
        c.restore();
      }
    },
    drawMeshBg(c, W, H, baseHex, orbs, tSec) {
      c.fillStyle = baseHex || "#0B0E14"; c.fillRect(0, 0, W, H);
      const list = orbs || [{ x: 0.82, y: 0.18, r: 0.72, col: "#9EB6D4", a: 0.28 }, { x: 0.16, y: 0.80, r: 0.68, col: "#E5EAF0", a: 0.18 }];
      const sh = Math.min(W, H);
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        const ox = W * o.x + Math.sin((tSec || 0) * (0.6 + i * 0.2) + i) * 38 * S;
        const oy = H * o.y + Math.cos((tSec || 0) * (0.5 + i * 0.25) + i) * 32 * S;
        const g = c.createRadialGradient(ox, oy, 0, ox, oy, sh * (o.r || 0.65)), rgb = parseHexRGB(o.col, [200, 212, 226]);
        g.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + clampNum(o.a || 0.24, 0, 1) + ")");
        g.addColorStop(0.58, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + clampNum((o.a || 0.24) * 0.22, 0, 1) + ")");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      }
    },
    drawGlassCard: drawGlassBase, drawLiquidGlass: drawGlassBase,
    drawWaterDrop(c, cx, cy, r, colHex) {
      const rgb = parseHexRGB(colHex, [220, 238, 255]); c.save();
      const g = c.createRadialGradient(cx - r * 0.28, cy - r * 0.28, r * 0.08, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,0.85)"); g.addColorStop(0.35, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.35)");
      g.addColorStop(0.85, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.12)"); g.addColorStop(1, "rgba(255,255,255,0.65)");
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(255,255,255,0.92)"; c.beginPath(); c.ellipse(cx - r * 0.30, cy - r * 0.30, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); c.fill(); c.restore();
    },
    drawPill(c, x, y, label, bgCol, txtCol, fontSize) {
      const f = fontSize || Math.max(12, Math.round(22 * S)); c.save(); c.font = "700 " + f + "px sans-serif";
      const pw = c.measureText(String(label)).width + 32 * S, ph = f + 18 * S;
      c.fillStyle = bgCol || "rgba(255,255,255,0.14)"; rrectFn(c, x, y, pw, ph, ph * 0.5); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.34)"; c.lineWidth = Math.max(1, 1.4 * S); c.stroke();
      c.fillStyle = txtCol || "#FFFFFF"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(String(label), x + pw * 0.5, y + ph * 0.52); c.restore(); return { w: pw, h: ph };
    },
    drawProgressBar(c, x, y, w, h, frac, col, trackCol) {
      c.save(); c.fillStyle = trackCol || "rgba(255,255,255,0.12)"; rrectFn(c, x, y, w, h, h * 0.5); c.fill();
      const fw = Math.max(h, w * clampNum(frac, 0, 1)); c.fillStyle = col || "#FFFFFF"; rrectFn(c, x, y, fw, h, h * 0.5); c.fill(); c.restore();
    },
    drawRing(c, cx, cy, rad, frac, col, label, bgCol, txtCol, lw) {
      c.save(); c.lineWidth = lw || Math.max(3, 5.5 * S); c.lineCap = "round";
      c.strokeStyle = bgCol || "rgba(255,255,255,0.12)"; c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.stroke();
      if (frac > 0.005) {
        c.strokeStyle = col; c.beginPath(); c.arc(cx, cy, rad, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * clampNum(frac, 0, 1)); c.stroke();
      }
      if (label !== undefined && label !== null && label !== "") {
        c.fillStyle = txtCol || "#FFFFFF"; c.font = "800 " + Math.max(11, Math.round(rad * 0.52)) + "px sans-serif";
        c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(label), cx, cy + 1 * S);
      }
      c.restore();
    },
    drawRichText(c, tokens, x, y, maxW, fontSize, lineH, baseCol, prog, align) {
      const getFont = (tk) => tk.italic ? ("italic 500 " + Math.round(fontSize * 1.06) + "px Georgia, serif") : ("800 " + fontSize + "px sans-serif");
      c.font = "800 " + fontSize + "px sans-serif"; const spW = c.measureText(" ").width;
      const words = [];
      for (let i = 0; i < tokens.length; i++) {
        const tk = tokens[i], parts = String(tk.text || "").split(/\s+/).filter(Boolean);
        for (let j = 0; j < parts.length; j++) {
          const f = getFont(tk); c.font = f;
          words.push({ text: parts[j], italic: !!tk.italic, color: tk.color || baseCol, font: f, w: c.measureText(parts[j]).width });
        }
      }
      const lines = []; let line = [], lw = 0;
      for (let i = 0; i < words.length; i++) {
        const wd = words[i], add = line.length ? spW + wd.w : wd.w;
        if (line.length && lw + add > maxW) { lines.push({ items: line, width: lw }); line = [wd]; lw = wd.w; }
        else { line.push(wd); lw += add; }
      }
      if (line.length) lines.push({ items: line, width: lw });
      c.textBaseline = "top"; c.textAlign = "left"; const descPad = fontSize * 0.40;
      for (let li = 0; li < lines.length; li++) {
        const ln = lines[li], lp = ease.snap(clampNum((prog - li * 0.13) / 0.72, 0, 1));
        if (lp <= 0.008) continue;
        const ly = y + li * lineH, sx = align === "center" ? x - ln.width * 0.5 : x;
        c.save(); c.beginPath(); c.rect(sx - 24 * S, ly - fontSize * 0.18, ln.width + 54 * S, lineH + descPad); c.clip(); c.globalAlpha *= lp;
        let cx = sx;
        for (let wi = 0; wi < ln.items.length; wi++) {
          const it = ln.items[wi]; c.font = it.font; c.fillStyle = it.color;
          c.fillText(it.text, cx, ly + (1 - lp) * lineH * 0.78 + (it.italic ? -fontSize * 0.03 : 0)); cx += it.w + spW;
        }
        c.restore();
      }
      return lines.length * lineH;
    },
    drawGrain(c, W, H, randFn, count, alpha) {
      c.save(); c.fillStyle = "rgba(255,255,255," + clampNum(alpha || 0.04, 0, 1) + ")";
      const n = Math.min(count || 90, 200);
      for (let i = 0; i < n; i++) {
        const gx = randFn(i * 3 + 701) * W, gy = randFn(i * 3 + 702) * H, gs = (0.8 + randFn(i * 3 + 703) * 1.4) * S;
        c.fillRect(gx, gy, gs, gs);
      }
      c.restore();
    }
  });
}

function makeFxApi(W, H, S, t, frame, fps, rand, ui) {
  const transition = Object.freeze({
    whipPan(c, u, drawA, drawB, accentCol) {
      const k = ease.whip(u);
      c.save(); c.translate(-k * W * 0.35, 0); drawA(k); c.restore();
      c.save(); c.beginPath(); c.rect(W * (1 - k), 0, W * k + 2, H); c.clip(); c.translate((1 - k) * W * 0.35, 0); drawB(k); c.restore();
      if (accentCol) { c.fillStyle = accentCol; c.fillRect(W * (1 - k) - 3 * S, 0, 6 * S, H); }
    },
    craneSweep(c, u, drawA, drawB, accentCol) {
      const k = ease.whip(u), cutY = H * (1 - k);
      c.save(); c.translate(0, -k * H * 0.18); drawA(k); c.restore();
      c.save(); c.beginPath(); c.rect(0, cutY, W, H - cutY + 2); c.clip(); c.translate(0, (1 - k) * H * 0.18); drawB(k); c.restore();
      if (accentCol) { c.fillStyle = accentCol; c.fillRect(0, cutY - 3 * S, W, 6 * S); }
    },
    irisPortal(c, u, drawA, drawB, cx, cy, ringCol) {
      const k = ease.whip(u), ox = cx !== undefined ? cx : W * 0.5, oy = cy !== undefined ? cy : H * 0.5, r = Math.hypot(W, H) * 1.05 * k;
      drawA(k); c.save(); c.beginPath(); c.arc(ox, oy, r, 0, Math.PI * 2); c.clip(); drawB(k); c.restore();
      if (ringCol) { c.save(); c.strokeStyle = ui.rgba(ringCol, (1 - k) * 0.85); c.lineWidth = Math.max(3, 8 * S); c.beginPath(); c.arc(ox, oy, r, 0, Math.PI * 2); c.stroke(); c.restore(); }
    },
    glassSlide(c, u, drawA, drawB) {
      const k = ease.liquid(u); c.save(); c.translate(-k * W * 0.22, 0); drawA(k); c.restore();
      const x = W * (1 - k); c.save(); c.beginPath(); ui.rrect(c, x, 0, W + 40 * S, H, 38 * S * (1 - k)); c.clip(); drawB(k); c.restore();
      c.save(); c.strokeStyle = "rgba(255,255,255," + (0.65 * Math.sin(k * Math.PI)) + ")"; c.lineWidth = 4 * S; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); c.restore();
    },
    zoomThrough(c, u, drawA, drawB) {
      const k = ease.whip(u), sA = 1 + k * 0.55;
      c.save(); c.translate(W * 0.5, H * 0.5); c.scale(sA, sA); c.translate(-W * 0.5, -H * 0.5); drawA(k); c.restore();
      if (k > 0.15) {
        const kb = clampNum((k - 0.15) / 0.85, 0, 1), sB = lerpNum(0.86, 1.0, kb);
        c.save(); c.beginPath(); c.arc(W * 0.5, H * 0.5, Math.hypot(W, H) * 0.85 * kb, 0, Math.PI * 2); c.clip();
        c.translate(W * 0.5, H * 0.5); c.scale(sB, sB); c.translate(-W * 0.5, -H * 0.5); drawB(kb); c.restore();
      }
    },
    splitShutter(c, u, drawA, drawB, accentCol) {
      const k = ease.whip(u); drawB(k); const half = H * 0.5 * (1 - k);
      if (half > 1) {
        c.save(); c.beginPath(); c.rect(0, 0, W, half); c.clip(); drawA(k); c.restore();
        c.save(); c.beginPath(); c.rect(0, H - half, W, half); c.clip(); drawA(k); c.restore();
        if (accentCol) { c.fillStyle = accentCol; c.fillRect(0, half - 2 * S, W, 4 * S); c.fillRect(0, H - half - 2 * S, W, 4 * S); }
      }
    },
    liquidWipe(c, u, drawA, drawB) {
      const k = ease.liquid(u); drawA(k); const baseX = W * (1 - k);
      c.save(); c.beginPath(); c.moveTo(W + 10, 0); c.lineTo(W + 10, H);
      for (let i = 20; i >= 0; i--) { const ry = (i / 20) * H; c.lineTo(baseX + Math.sin(i * 0.55 + k * 7) * 65 * S * Math.sin(k * Math.PI), ry); }
      c.closePath(); c.clip(); drawB(k); c.restore();
    },
    cardFlip3D(c, u, drawA, drawB) {
      const k = ease.whip(u), sx = Math.max(0.02, Math.abs(Math.cos(k * Math.PI)));
      c.save(); c.translate(W * 0.5, H * 0.5); c.scale(sx, 1 - Math.sin(k * Math.PI) * 0.06); c.translate(-W * 0.5, -H * 0.5);
      if (k < 0.5) drawA(k * 2); else drawB((k - 0.5) * 2); c.restore();
    }
  });

  const text = Object.freeze({
    wordStagger(c, str, x, y, maxW, fontSize, col, startFrame, align) {
      const words = String(str || "").trim().split(/\s+/).filter(Boolean);
      c.font = "800 " + fontSize + "px sans-serif"; const spW = c.measureText(" ").width, lineH = fontSize * 1.20;
      const lines = []; let ln = [], lw = 0;
      for (let i = 0; i < words.length; i++) {
        const ww = c.measureText(words[i]).width, add = ln.length ? spW + ww : ww;
        if (ln.length && lw + add > maxW) { lines.push({ items: ln, w: lw }); ln = [{ t: words[i], w: ww, idx: i }]; lw = ww; }
        else { ln.push({ t: words[i], w: ww, idx: i }); lw += add; }
      }
      if (ln.length) lines.push({ items: ln, w: lw });
      c.textBaseline = "top"; c.textAlign = "left"; c.fillStyle = col || "#FFFFFF";
      for (let li = 0; li < lines.length; li++) {
        let cx = align === "center" ? x - lines[li].w * 0.5 : x; const ly = y + li * lineH;
        for (let wi = 0; wi < lines[li].items.length; wi++) {
          const it = lines[li].items[wi];
          const sp = spring({ frame: frame - (startFrame || 0) - it.idx * Math.max(2, Math.round(fps * 0.06)), fps, config: { damping: 14, stiffness: 170 } });
          if (sp > 0.01) { c.save(); c.globalAlpha *= clampNum(sp * 1.25, 0, 1); c.fillText(it.t, cx, ly + (1 - sp) * fontSize * 0.55); c.restore(); }
          cx += it.w + spW;
        }
      }
      return lines.length * lineH;
    },
    charWave(c, str, x, y, fontSize, col, amp, speed, align) {
      const s = String(str || ""); c.font = "800 " + fontSize + "px sans-serif";
      let cx = align === "center" ? x - c.measureText(s).width * 0.5 : x;
      c.fillStyle = col || "#FFFFFF"; c.textBaseline = "top"; c.textAlign = "left";
      for (let i = 0; i < s.length; i++) { const ch = s[i]; c.fillText(ch, cx, y + Math.sin(t * (speed || 4.2) + i * 0.48) * (amp || 10 * S)); cx += c.measureText(ch).width; }
    },
    counterRoll(c, val, x, y, fontSize, col, suffix, align) {
      const v = Math.max(0, Number(val || 0)), base = Math.floor(v), frac = v - base;
      const txtA = String(base) + (suffix || ""), txtB = String(base + 1) + (suffix || "");
      c.save(); c.font = "800 " + fontSize + "px sans-serif";
      const mw = Math.max(c.measureText(txtA).width, c.measureText(txtB).width) + 28 * S;
      const sx = align === "center" ? x - mw * 0.5 : (align === "right" ? x - mw : x);
      c.beginPath(); c.rect(sx, y - fontSize * 0.08, mw, fontSize * 1.22); c.clip();
      c.fillStyle = col || "#FFFFFF"; c.textAlign = align || "left"; c.textBaseline = "top";
      const k = ease.ios(frac), stepY = fontSize * 1.24;
      c.save(); c.globalAlpha *= (1 - k); c.fillText(txtA, x, y - k * stepY); c.restore();
      if (frac > 0.01) { c.save(); c.globalAlpha *= k; c.fillText(txtB, x, y + (1 - k) * stepY); c.restore(); }
      c.restore();
    },
    highlightSweep(c, str, x, y, fontSize, bgCol, txtCol, prog, align) {
      c.save(); c.font = "800 " + fontSize + "px sans-serif";
      const tw = c.measureText(String(str)).width, padX = 20 * S, padY = 10 * S, bw = tw + padX * 2, bh = fontSize * 1.24 + padY * 2;
      const sx = align === "center" ? x - bw * 0.5 : x;
      c.fillStyle = bgCol || "#23C483"; ui.rrect(c, sx, y - padY, bw * ease.snap(prog), bh, 16 * S); c.fill();
      c.fillStyle = txtCol || "#0A1014"; c.textAlign = "left"; c.textBaseline = "top"; c.fillText(String(str), sx + padX, y + fontSize * 0.06); c.restore();
    },
    typewriter(c, str, x, y, fontSize, col, prog, showCursor) {
      const s = String(str || ""), sub = s.slice(0, Math.round(clampNum(prog, 0, 1) * s.length));
      c.save(); c.font = "700 " + fontSize + "px monospace, sans-serif"; c.fillStyle = col || "#FFFFFF"; c.textAlign = "left"; c.textBaseline = "top";
      c.fillText(sub, x, y);
      if (showCursor !== false && Math.floor(t * 2.5) % 2 === 0) c.fillRect(x + c.measureText(sub).width + 4 * S, y + 2 * S, Math.max(3, fontSize * 0.12), fontSize * 1.05);
      c.restore();
    },
    kineticMask(c, str, x, y, fontSize, col, prog, align) {
      const k = ease.snap(prog); c.save(); c.font = "800 " + fontSize + "px sans-serif";
      const w = c.measureText(String(str)).width + 24 * S, sx = align === "center" ? x - w * 0.5 : x;
      c.beginPath(); c.rect(sx, y - fontSize * 0.15, w, fontSize * 1.48); c.clip();
      c.fillStyle = col || "#FFFFFF"; c.textAlign = align || "left"; c.textBaseline = "top"; c.globalAlpha *= k;
      c.fillText(String(str), x, y + (1 - k) * fontSize * 1.02); c.restore();
    }
  });

  const particles = Object.freeze({
    bokeh(c, count, colHex, alpha) {
      const n = Math.min(count || 16, 40), rgb = parseHexRGB(colHex, [210, 232, 255]);
      for (let i = 0; i < n; i++) {
        const px = rand(800 + i * 3) * W + Math.sin(t * (0.5 + (i % 3) * 0.2) + i) * 32 * S;
        const py = ((rand(801 + i * 3) * H - t * (16 + (i % 4) * 8) * S) % (H + 80 * S) + H + 80 * S) % (H + 80 * S) - 40 * S;
        const r = (10 + rand(802 + i * 3) * 28) * S, a = (alpha || 0.16) * (0.45 + 0.55 * Math.sin(t + i));
        const g = c.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, rgbStr(rgb, a)); g.addColorStop(0.65, rgbStr(rgb, a * 0.35)); g.addColorStop(1, rgbStr(rgb, 0));
        c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
      }
    },
    petals(c, count, colHex, alpha) {
      const n = Math.min(count || 14, 36), rgb = parseHexRGB(colHex, [226, 68, 92]);
      for (let i = 0; i < n; i++) {
        const px = ((rand(850 + i * 3) * W + Math.sin(t * 1.2 + i) * 45 * S) % W + W) % W;
        const py = ((rand(851 + i * 3) * H + t * (32 + (i % 4) * 14) * S) % (H + 60 * S)) - 30 * S;
        const sz = (7 + rand(852 + i * 3) * 11) * S;
        c.save(); c.translate(px, py); c.rotate(t * (0.8 + (i % 3) * 0.3) + i);
        c.fillStyle = rgbStr(rgb, alpha || 0.32); c.beginPath(); c.ellipse(0, 0, sz * 1.4, sz * 0.65, 0.25, 0, Math.PI * 2); c.fill(); c.restore();
      }
    },
    confetti(c, count, colors, prog) {
      const cols = colors || ["#FF6B6B", "#FFD166", "#23C483", "#64B5F6", "#FFFFFF"], n = Math.min(count || 20, 48);
      const vis = clampNum(prog === undefined ? 1 : prog, 0, 1); if (vis <= 0.01) return;
      for (let i = 0; i < n; i++) {
        const u = ((t * (0.28 + (i % 3) * 0.08) + rand(900 + i)) % 1);
        const cx = rand(940 + i) * W + Math.sin(t * 3 + i) * 28 * S, cy = lerpNum(-20 * S, H + 20 * S, u), sz = (7 + rand(980 + i) * 8) * S;
        c.save(); c.translate(cx, cy); c.rotate(t * (2.2 + (i % 3)) + i); c.globalAlpha *= vis;
        c.fillStyle = cols[i % cols.length]; ui.rrect(c, -sz * 0.6, -sz * 0.32, sz * 1.2, sz * 0.64, 2 * S); c.fill(); c.restore();
      }
    },
    sparkles(c, count, colHex, alpha) {
      const n = Math.min(count || 14, 36), col = colHex || "#FFF4CC";
      for (let i = 0; i < n; i++) {
        const px = rand(1020 + i * 3) * W, py = rand(1021 + i * 3) * H;
        const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * (2.6 + (i % 3)) + i * 1.7), 3), r = (4 + rand(1022 + i * 3) * 10) * S * pulse;
        if (r < 0.8) continue;
        c.save(); c.translate(px, py); c.rotate(t * 0.6 + i); c.globalAlpha *= (alpha || 0.85) * pulse; c.fillStyle = col; c.beginPath();
        for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a + Math.PI / 4) * r * 0.25, Math.sin(a + Math.PI / 4) * r * 0.25); }
        c.closePath(); c.fill(); c.restore();
      }
    }
  });

  const chart = Object.freeze({
    spline(c, values, x, y, w, h, col, prog) {
      if (!values || values.length < 2) return;
      const k = ease.apple(prog === undefined ? 1 : prog), minV = Math.min(...values), span = Math.max(0.0001, Math.max(...values) - minV);
      const pts = values.map((v, i) => [x + (i / (values.length - 1)) * w, y + h - ((v - minV) / span) * h]);
      c.save();
      c.strokeStyle = "rgba(180,200,220,0.12)"; c.lineWidth = Math.max(1, 1.2 * S);
      for (let g = 0; g <= 3; g++) { const gy = y + (h * g) / 3; c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w, gy); c.stroke(); }
      c.beginPath(); c.rect(x - 10 * S, y - 24 * S, (w + 20 * S) * k, h + 48 * S); c.clip();
      const grad = c.createLinearGradient(0, y, 0, y + h); grad.addColorStop(0, ui.rgba(col, 0.34)); grad.addColorStop(1, ui.rgba(col, 0));
      c.beginPath(); c.moveTo(pts[0][0], y + h); c.lineTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) * 0.5, (pts[i][1] + pts[i + 1][1]) * 0.5);
      c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); c.lineTo(pts[pts.length - 1][0], y + h); c.closePath(); c.fillStyle = grad; c.fill();
      c.strokeStyle = col; c.lineWidth = Math.max(3, 5 * S); c.lineCap = "round"; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) * 0.5, (pts[i][1] + pts[i + 1][1]) * 0.5);
      c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); c.stroke();
      const lp = pts[pts.length - 1]; ui.drawGlow(c, lp[0], lp[1], 22 * S, col, 0.75); c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(lp[0], lp[1], 6.5 * S, 0, Math.PI * 2); c.fill(); c.restore();
    },
    bars(c, items, x, y, w, h, startFrame, opts) {
      if (!items || !items.length) return;
      const o = opts || {}, lblCol = o.labelColor || (o.light ? "rgba(14,20,29,0.72)" : "rgba(255,255,255,0.78)"), valCol = o.valueColor || (o.light ? "#0E141D" : "#FFFFFF");
      const gap = 20 * S, bw = (w - gap * (items.length - 1)) / items.length;
      c.save(); c.strokeStyle = o.light ? "rgba(14,20,29,0.08)" : "rgba(255,255,255,0.08)"; c.lineWidth = Math.max(1, 1.2 * S);
      c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w, y + h); c.stroke();
      for (let i = 0; i < items.length; i++) {
        const it = items[i], sp = spring({ frame: frame - (startFrame || 0) - i * 4, fps, config: { damping: 14, stiffness: 145 } });
        const frac = clampNum(it.value || 0, 0, 1) * clampNum(sp, 0, 1.06), bh = Math.max(8 * S, (h - 32 * S) * frac), bx = x + i * (bw + gap), by = y + h - bh;
        c.fillStyle = it.color || "#32D74B"; ui.rrect(c, bx, by, bw, bh, 14 * S); c.fill();
        if (o.showValues !== false && sp > 0.05) { c.fillStyle = valCol; c.font = "800 " + Math.max(11, Math.round(21 * S)) + "px sans-serif"; c.textAlign = "center"; c.textBaseline = "bottom"; c.fillText(Math.round(frac * 100) + "%", bx + bw * 0.5, by - 8 * S); }
        if (it.label) { c.fillStyle = lblCol; c.font = "700 " + Math.max(11, Math.round(20 * S)) + "px sans-serif"; c.textAlign = "center"; c.textBaseline = "top"; c.fillText(String(it.label), bx + bw * 0.5, y + h + 12 * S); }
      }
      c.restore();
    }
  });

  // Kinetic Storytelling Captions / Karaoke Subtitle Engine
  const captions = (c, cues, tSec, opts) => {
    if (!Array.isArray(cues) || !cues.length) return;
    const o = opts || {}, curT = tSec !== undefined ? tSec : t;
    let active = null;
    for (let i = 0; i < cues.length; i++) {
      if (curT >= cues[i].start && curT <= cues[i].end) { active = cues[i]; break; }
    }
    if (!active) return;
    const words = String(active.text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const dur = Math.max(0.1, active.end - active.start);
    const localU = clampNum((curT - active.start) / dur, 0, 0.999);
    const activeIdx = Math.floor(localU * words.length);
    const fSize = Math.round(o.size || 40 * S);
    const maxW = o.maxW || (W * 0.84);
    const cy = o.y !== undefined ? o.y : (H * 0.84);
    const light = !!o.light, accentCol = o.accent || "#32D74B";
    const inP = ease.snap(clampNum((curT - active.start) / 0.16, 0, 1));
    const outP = ease.snap(clampNum((active.end - curT) / 0.14, 0, 1));
    const vis = Math.min(inP, outP);

    c.save();
    c.font = "800 " + fSize + "px sans-serif";
    const spW = c.measureText(" ").width;
    const lines = []; let ln = [], lw = 0;
    for (let i = 0; i < words.length; i++) {
      const ww = c.measureText(words[i]).width, add = ln.length ? spW + ww : ww;
      if (ln.length && lw + add > maxW) { lines.push({ items: ln, w: lw }); ln = [{ t: words[i], w: ww, idx: i }]; lw = ww; }
      else { ln.push({ t: words[i], w: ww, idx: i }); lw += add; }
    }
    if (ln.length) lines.push({ items: ln, w: lw });

    const lineH = fSize * 1.32;
    const boxW = Math.min(maxW + 52 * S, Math.max(...lines.map((l) => l.w)) + 56 * S);
    const boxH = lines.length * lineH + 34 * S;
    const bx = W * 0.5 - boxW * 0.5, by = cy - boxH * 0.5 + (1 - vis) * 20 * S;

    c.globalAlpha *= vis;
    if (o.glass !== false) {
      ui.drawLiquidGlass(c, bx, by, boxW, boxH, 24 * S, { light, chromatic: true });
    }

    c.textBaseline = "middle"; c.textAlign = "left";
    for (let li = 0; li < lines.length; li++) {
      let wx = W * 0.5 - lines[li].w * 0.5;
      const wy = by + 18 * S + (li + 0.5) * lineH;
      for (let wi = 0; wi < lines[li].items.length; wi++) {
        const it = lines[li].items[wi];
        const isCur = it.idx === activeIdx;
        if (isCur && o.pill !== false) {
          c.fillStyle = ui.rgba(accentCol, light ? 0.20 : 0.28);
          ui.rrect(c, wx - 10 * S, wy - fSize * 0.62, it.w + 20 * S, fSize * 1.22, 12 * S);
          c.fill();
        }
        c.fillStyle = isCur ? accentCol : (it.idx < activeIdx ? (light ? "#0E141D" : "#FFFFFF") : (light ? "rgba(14,20,29,0.48)" : "rgba(255,255,255,0.52)"));
        c.fillText(it.t, wx, wy);
        wx += it.w + spW;
      }
    }
    c.restore();
  };

  // Cinema Motion Trail / Smear Layer (180-degree shutter echo)
  const trail = (c, steps, dtStep, drawAtFn) => {
    const n = clampNum(steps || 5, 2, 12), dt = dtStep || (0.5 / Math.max(24, fps));
    for (let i = n; i >= 0; i--) {
      const tPrev = Math.max(0, t - i * dt);
      const a = i === 0 ? 1.0 : ((1 - i / (n + 1)) * 0.34);
      c.save(); c.globalAlpha *= a;
      drawAtFn(tPrev, a, i);
      c.restore();
    }
  };

  const cameraRig = (pVal, keys, breathAmp) => {
    if (!Array.isArray(keys) || !keys.length) return { x: 0, y: 0, zoom: 1, rot: 0 };
    let k0 = keys[0], k1 = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) { if (pVal >= keys[i].p && pVal <= keys[i + 1].p) { k0 = keys[i]; k1 = keys[i + 1]; break; } }
    const u = k1.p > k0.p ? ease.smooth(clampNum((pVal - k0.p) / (k1.p - k0.p), 0, 1)) : 0, b = breathAmp !== undefined ? breathAmp : 4.5 * S;
    return {
      x: lerpNum(k0.x || 0, k1.x || 0, u) + Math.sin(t * 1.15) * b,
      y: lerpNum(k0.y || 0, k1.y || 0, u) + Math.cos(t * 0.92) * b * 0.8,
      zoom: lerpNum(k0.zoom !== undefined ? k0.zoom : 1, k1.zoom !== undefined ? k1.zoom : 1, u) + Math.sin(t * 0.7) * 0.005,
      rot: lerpNum(k0.rot || 0, k1.rot || 0, u) + Math.sin(t * 0.8) * 0.002
    };
  };

  return Object.freeze({
    stagger(frameVal, index, delayFrames, cfg) {
      const df = delayFrames !== undefined ? delayFrames : Math.max(3, Math.round(fps * 0.12));
      return spring({ frame: frameVal - index * df, fps, config: cfg || { damping: 14, stiffness: 160 } });
    },
    scene(pVal, start, end) {
      const sp = clampNum((pVal - start) / Math.max(0.0001, end - start), 0, 1);
      return { p: sp, in: ease.snap(clampNum(sp / 0.18, 0, 1)), out: 1 - ease.whip(clampNum((sp - 0.85) / 0.15, 0, 1)), active: pVal >= start && pVal <= end };
    },
    cameraRig, transition, text, particles, chart, captions, trail
  });
}

function ensureCanvas(width, height) {
  if (!canvas || width !== currentWidth || height !== currentHeight) {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("OffscreenCanvas 2D context is not supported.");
    currentWidth = width;
    currentHeight = height;
  }
}

function render(message) {
  const W = message.W | 0, H = message.H | 0;
  const frame = message.frame | 0, fps = message.fps | 0;
  const D = Number(message.D), totalFrames = message.totalFrames | 0;
  if (W < 2 || H < 2 || W > 3840 || H > 3840 || W * H * 4 > 35_000_000) throw new Error("Output dimensions exceed the runtime safety limit.");
  if (![24, 30, 60].includes(fps) || totalFrames < 1 || totalFrames > 3600 || frame < 0 || frame >= totalFrames) throw new Error("Invalid frame settings.");
  if (typeof message.sourceBody !== "string" || message.sourceBody.length > 262144) throw new Error("Source body must be 256 KiB or smaller.");

  ensureCanvas(W, H);
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Canvas 2D context could not be restored.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, W, H);

  const S = Math.min(W, H) / 1080;
  const t = frame / fps;
  const p = frame / Math.max(totalFrames - 1, 1);
  const P = Object.freeze(message.props || {});
  const rand = (index) => seededRandom(message.seed | 0, index | 0);
  const isExportMode = (message.mode !== "preview");
  const cam = makeCameraApi(W, H);
  const ui = typeof enhanceProUi === "function" ? enhanceProUi(makeUiApi(S), W, H, S) : makeUiApi(S);
  const fx = typeof enhanceProFx === "function" ? enhanceProFx(makeFxApi(W, H, S, t, frame, fps, rand, ui), W, H, S, t, frame, fps, rand, ui) : makeFxApi(W, H, S, t, frame, fps, rand, ui);
  const g3d = makeG3dApi(W, H, t, p, rand, isExportMode);

  const body = new Function(
    "ctx", "W", "H", "S", "t", "D", "p", "frame", "fps", "P", "ease", "rand",
    "spring", "interpolate", "bezier", "cam", "ui", "fx", "d3", "g3d",
    "globalThis", "self", "fetch", "XMLHttpRequest", "WebSocket", "importScripts",
    "indexedDB", "caches", "BroadcastChannel", "Worker", "WebAssembly", "setTimeout",
    "setInterval", "requestAnimationFrame", "document", "window",
    '"use strict";\n' + message.sourceBody
  );
  body(ctx, W, H, S, t, D, p, frame, fps, P, ease, rand, spring, interpolate, bezier, cam, ui, fx, d3, g3d);

  if (message.mode === "preview") {
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage({ type: "previewFrame", frame, width: W, height: H, image: bitmap }, [bitmap]);
  } else {
    const pixels = ctx.getImageData(0, 0, W, H).data;
    const buffer = pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + pixels.byteLength);
    if (message.livePreview) {
      const previewImage = canvas.transferToImageBitmap();
      self.postMessage({ type: "frameBuffer", frame, token: message.token, width: W, height: H, buffer, previewImage }, [buffer, previewImage]);
    } else {
      self.postMessage({ type: "frameBuffer", frame, token: message.token, buffer }, [buffer]);
    }
  }
}

self.onmessage = (event) => {
  const message = event.data || {};
  try { render(message); }
  catch (error) {
    self.postMessage({ type: "error", frame: message.frame, token: message.token, message: String(error?.message || error).slice(0, 240) });
  }
};

self.postMessage({ type: "ready" });
