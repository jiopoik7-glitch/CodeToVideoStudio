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

let glCanvas = null;
let gl = null;
let glW = 0;
let glH = 0;
let glPbrProg = null;
let glShadowProg = null;
let glShadowFbo = null;
let glShadowTex = null;
const SHADOW_RES = 1024;
let glBufPos = null, glBufNorm = null, glBufUv = null, glBufIdx = null;
let glQuadBuf = null;
const glShaderCache = new Map();

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

// =======================================================
// REAL GPU WEBGL 3D ENGINE v1.0 — SHADOW MAPS, RICH COLOR PBR & EXPRESSIVE RIGS
// =======================================================
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
void main() {
  gl_FragColor = packDepth(vDepth);
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
varying vec3 vWorldPos;
varying vec3 vNorm;
varying vec2 vUv;
varying vec4 vLightPos;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
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
uniform float uShadowEnabled;
uniform float uShadowTexel;
uniform vec3 uEye;
uniform vec3 uKeyDir;
uniform vec3 uFillDir;
uniform vec3 uRimDir;
uniform vec3 uKeyCol;
uniform vec3 uFillCol;
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
uniform float uVibrancy;
uniform vec3 uFogColor;
uniform vec2 uFogRange;

float unpackDepth(vec4 rgba) {
  return dot(rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0));
}

float calcShadow(vec3 N, vec3 L) {
  if (uShadowEnabled < 0.5) return 1.0;
  vec3 proj = vLightPos.xyz / vLightPos.w * 0.5 + 0.5;
  if (proj.x < 0.01 || proj.x > 0.99 || proj.y < 0.01 || proj.y > 0.99 || proj.z > 1.0) return 1.0;
  float bias = max(0.0022 * (1.0 - dot(N, L)), 0.0008);
  float cur = proj.z - bias;
  float vis = 0.0;
  float t = uShadowTexel * 1.35;
  vis += (cur <= unpackDepth(texture2D(uShadowMap, proj.xy + vec2(-t, -t)))) ? 1.0 : 0.0;
  vis += (cur <= unpackDepth(texture2D(uShadowMap, proj.xy + vec2( t, -t)))) ? 1.0 : 0.0;
  vis += (cur <= unpackDepth(texture2D(uShadowMap, proj.xy + vec2(-t,  t)))) ? 1.0 : 0.0;
  vis += (cur <= unpackDepth(texture2D(uShadowMap, proj.xy + vec2( t,  t)))) ? 1.0 : 0.0;
  return mix(0.32, 1.0, vis * 0.25);
}

// Smooth 3D procedural organic grain (prevents flat plastic look!)
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

void main() {
  vec3 srgbBase = mix(uColor, uColor2, clamp(vUv.y, 0.0, 1.0));

  // Soft radial feathered contact shadow disc (zero hard black circle edge!)
  if (uFeatherShadow > 0.5) {
    vec3 N0 = normalize(vNorm);
    float rDist = length(N0.xz);
    float falloff = pow(clamp(1.0 - rDist * 1.12, 0.0, 1.0), 2.1);
    float aS = clamp(uAlpha * falloff, 0.0, 1.0);
    gl_FragColor = vec4(srgbBase * aS, aS);
    return;
  }

  if (uUnlit > 0.5) {
    float a0 = clamp(uAlpha, 0.0, 1.0);
    gl_FragColor = vec4(srgbBase * a0, a0);
    return;
  }

  // Convert sRGB to Linear Light Space so colors stay rich & saturated!
  vec3 baseCol = pow(max(srgbBase, vec3(0.0)), vec3(2.2));
  if (uDetail > 0.001) {
    float n1 = noise3(vWorldPos * 11.0);
    float n2 = noise3(vWorldPos * 29.0);
    float tex = (n1 * 0.65 + n2 * 0.35) - 0.5;
    baseCol *= (1.0 + tex * uDetail);
  }

  vec3 N = normalize(vNorm);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uEye - vWorldPos);
  vec3 L1 = normalize(uKeyDir);
  vec3 L2 = normalize(uFillDir);
  vec3 L3 = normalize(uRimDir);

  float rough = clamp(uRoughness, 0.06, 0.98);
  float metal = clamp(uMetalness, 0.0, 1.0);
  float shadow = calcShadow(N, L1);

  float ndl1 = max(dot(N, L1), 0.0);
  float ndl2 = max(dot(N, L2), 0.0);
  float wrap = max(0.0, (dot(N, L1) + 0.38) / 1.38);
  float sssTerm = (pow(max(0.0, dot(-L1, V)), 2.2) * 0.75 + wrap * 0.35) * uSss;

  // Specular highlight (sharp & glossy on metals/eyes, subtle on matte clay/cloth)
  float shininess = exp2(9.2 * (1.0 - rough) + 1.4);
  vec3 H1 = normalize(L1 + V);
  float spec1 = pow(max(dot(N, H1), 0.0), shininess) * (0.14 + 0.86 * (1.0 - rough));

  // Studio HDRI Reflection (strictly weighted by metalness so dielectrics never turn chalky!)
  vec3 R = reflect(-V, N);
  float skyT = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 envGround = vec3(0.04, 0.05, 0.07);
  vec3 envHorizon = vec3(0.32, 0.38, 0.48);
  vec3 envSky = vec3(0.75, 0.84, 0.96);
  vec3 envCol = skyT < 0.5
    ? mix(envGround, envHorizon, pow(skyT * 2.0, 1.5))
    : mix(envHorizon, envSky, pow((skyT - 0.5) * 2.0, 1.0));
  float softbox = smoothstep(0.78, 0.96, dot(R, normalize(vec3(0.45, 0.78, 0.42))));
  envCol += vec3(0.85, 0.88, 0.95) * softbox * (1.0 - rough * 0.8);

  float ndv = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - ndv, 3.8);
  vec3 F0 = mix(vec3(0.035), baseCol, metal);
  vec3 F = F0 + (vec3(1.0) - F0) * fresnel;

  // Warm/Cool Pixar-style Hemisphere + Key + Fill Lighting
  vec3 keyLin = pow(max(uKeyCol, vec3(0.0)), vec3(2.2));
  vec3 fillLin = pow(max(uFillCol, vec3(0.0)), vec3(2.2));
  vec3 skyAmb = vec3(0.58, 0.72, 0.92);
  vec3 groundBounce = vec3(0.24, 0.20, 0.17);
  vec3 hemi = mix(groundBounce, skyAmb, N.y * 0.5 + 0.5) * uAmb;

  vec3 diff = baseCol * (1.0 - metal * 0.86) * (hemi + keyLin * ndl1 * shadow * 1.18 + fillLin * ndl2 * 0.42);
  vec3 specCol = mix(vec3(1.0), baseCol, metal) * spec1 * keyLin * shadow * (0.12 + 0.88 * metal + (1.0 - rough) * 0.25);
  float envWeight = (0.02 + 0.98 * metal) * (0.18 + 0.82 * (1.0 - rough));
  vec3 envRefl = envCol * F * envWeight;
  vec3 rimGlow = pow(max(uRimColor, vec3(0.0)), vec3(2.2)) * (fresnel * 0.42 + max(dot(N, L3), 0.0) * 0.22) * uRimPow * (0.25 + 0.75 * shadow);
  vec3 sssCol = baseCol * vec3(1.28, 0.88, 0.90) * sssTerm * (0.45 + 0.55 * shadow);
  vec3 emLin = pow(max(uEmissive, vec3(0.0)), vec3(2.2));

  vec3 col = diff + specCol + envRefl + rimGlow + sssCol + emLin;

  // Rich Filmic Soft-Shoulder Tone Mapping (preserves deep saturation instead of washing to grey!)
  col = col / (1.0 + col * 0.42);
  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

  // Color Vibrancy & Contrast Grade
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uVibrancy);
  col = smoothstep(vec3(-0.02), vec3(1.02), col);

  if (uFogRange.y > uFogRange.x) {
    float dist = length(uEye - vWorldPos);
    float fogF = smoothstep(uFogRange.x, uFogRange.y, dist);
    col = mix(col, uFogColor, fogF * 0.85);
  }

  col = clamp(col, 0.0, 1.0);
  float a = clamp(uAlpha, 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}`;

const SHADER_QUAD_VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
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

function ensureGl(W, H) {
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

    // Setup 1024x1024 RGBA Shadow Map FBO + Depth Renderbuffer (works on 100% WebGL1/WebGL2 GPUs!)
    glShadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glShadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW_RES, SHADOW_RES, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const depthRb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SHADOW_RES, SHADOW_RES);

    glShadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, glShadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glShadowTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    glW = W; glH = H;
  } else if (glW !== W || glH !== H) {
    glCanvas.width = W;
    glCanvas.height = H;
    glW = W; glH = H;
  }
  return gl;
}

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
// HIGH-DETAIL 3D GEOMETRY BUILDERS
// =======================================================
function buildEllipsoidGeo(rx, ry, rz, segs) {
  const s = clampNum(segs || 28, 8, 52);
  const rings = Math.max(6, Math.round(s * 0.72));
  const pos = [], norm = [], uv = [], idx = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings, phi = v * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let x = 0; x <= s; x++) {
      const u = x / s, th = u * Math.PI * 2;
      const ux = sp * Math.cos(th), uy = cp, uz = sp * Math.sin(th);
      pos.push(ux * rx, uy * ry, uz * rz);
      let nx = ux / (rx || 1), ny = uy / (ry || 1), nz = uz / (rz || 1);
      const nm = Math.hypot(nx, ny, nz) || 1;
      norm.push(nx / nm, ny / nm, nz / nm);
      uv.push(u, 1 - v);
    }
  }
  const stride = s + 1;
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < s; x++) {
      const a = y * stride + x, b = a + stride;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
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
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos, norm, uv, idx };
}

function buildRoundBoxGeo(w, h, d, rad, segs) {
  const s = clampNum(segs || 16, 8, 28);
  const rings = Math.max(8, Math.round(s * 0.8));
  const r = Math.min(rad || 0.12, w * 0.45, h * 0.45, d * 0.45);
  const bx = Math.max(0.001, w * 0.5 - r), by = Math.max(0.001, h * 0.5 - r), bz = Math.max(0.001, d * 0.5 - r);
  const pos = [], norm = [], uv = [], idx = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings, phi = v * Math.PI, sp = Math.sin(phi), cp = Math.cos(phi);
    for (let x = 0; x <= s; x++) {
      const u = x / s, th = u * Math.PI * 2;
      const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
      pos.push((nx >= 0 ? 1 : -1) * bx + nx * r, (ny >= 0 ? 1 : -1) * by + ny * r, (nz >= 0 ? 1 : -1) * bz + nz * r);
      norm.push(nx, ny, nz);
      uv.push(u, 1 - v);
    }
  }
  const stride = s + 1;
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < s; x++) {
      const a = y * stride + x, b = a + stride;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { pos, norm, uv, idx };
}

function buildCapsuleGeo(r, len, segs) {
  const s = clampNum(segs || 20, 8, 36);
  const halfCyl = Math.max(0.001, (len || 0.6) * 0.5);
  const hemiRings = 6, prof = [];
  for (let i = 0; i <= hemiRings; i++) {
    const a = -Math.PI * 0.5 + (i / hemiRings) * (Math.PI * 0.5);
    prof.push([Math.cos(a) * r, -halfCyl + Math.sin(a) * r]);
  }
  for (let i = 0; i <= hemiRings; i++) {
    const a = (i / hemiRings) * (Math.PI * 0.5);
    prof.push([Math.cos(a) * r, halfCyl + Math.sin(a) * r]);
  }
  return buildLatheGeo(prof, s);
}

function buildTorusGeo(R, r, segsU, segsV) {
  const su = clampNum(segsU || 40, 12, 64), sv = clampNum(segsV || 20, 8, 36);
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j <= sv; j++) {
    const v = j / sv, phi = v * Math.PI * 2, cp = Math.cos(phi), sp = Math.sin(phi);
    for (let i = 0; i <= su; i++) {
      const u = i / su, th = u * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
      const rr = R + r * cp;
      pos.push(rr * ct, r * sp, rr * st); norm.push(cp * ct, sp, cp * st); uv.push(u, v);
    }
  }
  const st = su + 1;
  for (let j = 0; j < sv; j++) {
    for (let i = 0; i < su; i++) {
      const a = j * st + i, b = a + st;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { pos, norm, uv, idx };
}

function buildLatheGeo(profile, segs) {
  const s = clampNum(segs || 32, 8, 64), m = profile.length;
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j < m; j++) {
    const pPrev = profile[Math.max(0, j - 1)], pCur = profile[j], pNext = profile[Math.min(m - 1, j + 1)];
    const dr = pNext[0] - pPrev[0], dy = pNext[1] - pPrev[1];
    let nr = dy, ny = -dr;
    const nm = Math.hypot(nr, ny) || 1; nr /= nm; ny /= nm;
    const v = j / Math.max(1, m - 1);
    for (let i = 0; i <= s; i++) {
      const u = i / s, a = u * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(ca * pCur[0], pCur[1], sa * pCur[0]);
      norm.push(ca * nr, ny, sa * nr);
      uv.push(u, v);
    }
  }
  const st = s + 1;
  for (let j = 0; j < m - 1; j++) {
    for (let i = 0; i < s; i++) {
      const a = j * st + i, b = a + st;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return { pos, norm, uv, idx };
}

function buildPetalGeo(w, h, cup, curl) {
  const nu = 6, nv = 8, grid = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const widthProfile = Math.sin(Math.pow(v, 0.72) * Math.PI) * (0.85 + 0.25 * Math.sin(v * Math.PI));
    const halfW = w * 0.5 * Math.max(0.08, widthProfile);
    const y = v * h, curlZ = Math.pow(v, 2.6) * (curl || 0.16), row = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, su = (u - 0.5) * 2;
      row.push([su * halfW, y, -(1 - su * su) * (cup || 0.12) * Math.sin(v * Math.PI) + curlZ]);
    }
    grid.push(row);
  }
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const p0 = grid[j][i], pL = grid[j][Math.max(0, i - 1)], pR = grid[j][Math.min(nu, i + 1)];
      const pD = grid[Math.max(0, j - 1)][i], pU = grid[Math.min(nv, j + 1)][i];
      const tx = pR[0] - pL[0], ty = pR[1] - pL[1], tz = pR[2] - pL[2];
      const bx = pU[0] - pD[0], by = pU[1] - pD[1], bz = pU[2] - pD[2];
      let nx = ty * bz - tz * by, ny = tz * bx - tx * bz, nz = tx * by - ty * bx;
      const nm = Math.hypot(nx, ny, nz) || 1;
      pos.push(p0[0], p0[1], p0[2]); norm.push(nx / nm, ny / nm, nz / nm); uv.push(i / nu, j / nv);
    }
  }
  const st = nu + 1;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * st + i, b = a + st;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return { pos, norm, uv, idx };
}

function buildLeafGeo(len, wid, bend) {
  const nu = 6, nv = 8, grid = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, halfW = wid * 0.5 * Math.sin(Math.pow(v, 0.78) * Math.PI), z = v * len;
    const archY = Math.sin(v * Math.PI) * (bend || 0.14) - v * v * (bend || 0.14) * 1.1, row = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, su = (u - 0.5) * 2;
      row.push([su * halfW, archY + Math.abs(su) * 0.06 * wid * Math.sin(v * Math.PI), z]);
    }
    grid.push(row);
  }
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const p0 = grid[j][i], pL = grid[j][Math.max(0, i - 1)], pR = grid[j][Math.min(nu, i + 1)];
      const pD = grid[Math.max(0, j - 1)][i], pU = grid[Math.min(nv, j + 1)][i];
      const tx = pR[0] - pL[0], ty = pR[1] - pL[1], tz = pR[2] - pL[2];
      const bx = pU[0] - pD[0], by = pU[1] - pD[1], bz = pU[2] - pD[2];
      let nx = ty * bz - tz * by, ny = tz * bx - tx * bz, nz = tx * by - ty * bx;
      const nm = Math.hypot(nx, ny, nz) || 1;
      pos.push(p0[0], p0[1], p0[2]); norm.push(nx / nm, ny / nm, nz / nm); uv.push(i / nu, j / nv);
    }
  }
  const st = nu + 1;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * st + i, b = a + st;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
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
  for (let j = 0; j < m - 1; j++) {
    for (let i = 0; i < s; i++) {
      const a = j * st + i, b = a + st;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return { pos, norm, uv, idx };
}

function makeG3dApi(W, H, tSec, pVal) {
  const g3dObj = {
    get supported() { return !!ensureGl(W, H); },
    scene(opts) {
      const o = opts || {};
      let eye = o.eye || [0, 1.5, 6];
      let target = o.target || [0, 0, 0];
      let up = o.up || [0, 1, 0];
      let fov = o.fov || 0.72;
      const lights = {
        key: o.keyDir || [0.55, 0.82, 0.48],
        fill: o.fillDir || [-0.72, 0.25, -0.35],
        rim: o.rimDir || [-0.25, 0.55, -0.82],
        keyCol: hexToVec3(o.keyColor || "#FFF3DF"),
        fillCol: hexToVec3(o.fillColor || "#A8D0FF"),
        amb: o.ambient !== undefined ? o.ambient : 0.26,
        shadows: o.shadows !== false,
        shadowExtent: o.shadowExtent || 4.0,
        vibrancy: o.vibrancy !== undefined ? o.vibrancy : 1.18,
        fogCol: hexToVec3(o.fogColor || "#06090F"),
        fogNear: o.fogNear || 0,
        fogFar: o.fogFar || 0
      };
      const items = [];

      const createNode = (parentWorldM, nodeOpts) => {
        const no = nodeOpts || {};
        const localM = m4Transform(no.pos, no.rot, no.scale);
        const worldM = m4Multiply(parentWorldM, localM);
        const pushMesh = (geo, pos, rot, scale, mat) => {
          const itemM = m4Multiply(worldM, m4Transform(pos, rot, scale));
          items.push({ geo, modelM: itemM, mat: mat || {} });
        };
        const nodeApi = {
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
          capsule(pos, r, len, rot, mat, segs) {
            pushMesh(buildCapsuleGeo(r || 0.14, len || 0.6, segs), pos, rot, 1, mat); return nodeApi;
          },
          cylinder(pos, rBot, rTop, h, rot, mat, segs) {
            const hh = (h || 1) * 0.5;
            pushMesh(buildLatheGeo([[0, -hh], [rBot, -hh], [rBot, -hh], [rTop, hh], [rTop, hh], [0, hh]], segs || 32), pos, rot, 1, mat); return nodeApi;
          },
          cone(pos, r, h, rot, mat, segs) {
            const hh = (h || 1) * 0.5;
            pushMesh(buildLatheGeo([[0, -hh], [r || 0.6, -hh], [r || 0.6, -hh], [0.001, hh]], segs || 28), pos, rot, 1, mat); return nodeApi;
          },
          torus(pos, R, r, rot, mat, segsU, segsV) {
            pushMesh(buildTorusGeo(R || 1, r || 0.22, segsU, segsV), pos, rot, 1, mat); return nodeApi;
          },
          plane(pos, w, h, rot, mat) {
            pushMesh(buildBoxGeo(w || 2, 0.02, h || 2), pos, rot, 1, mat); return nodeApi;
          },
          shadow(pos, rx, rz, alpha) {
            pushMesh(buildEllipsoidGeo(rx || 0.65, 0.015, rz || 0.65, 28), pos, [0, 0, 0], 1, {
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
            const blades = [[0.0, 0.25, 0.28], [2.1, 0.32, 0.24], [4.2, 0.28, 0.26]];
            for (let i = 0; i < 3; i++) {
              pushMesh(buildLeafGeo(0.28 * sc, 0.065 * sc, 0.06 * sc), pos, [-0.85, blades[i][0], 0], 1, {
                color: col, color2: "#6CE08A", roughness: 0.38, sss: 0.35, detail: 0.08
              });
            }
            return nodeApi;
          },
          mesh(geo, pos, rot, scale, mat) { pushMesh(geo, pos, rot, scale, mat); return nodeApi; }
        };
        return nodeApi;
      };

      const rootNode = createNode(m4Identity(), {});
      const sceneApi = Object.assign({}, rootNode, {
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
        // Multi-shot smooth 3D camera rig (orbit azimuth/elevation/distance/target keyframes!)
        cameraRig(pProg, keys) {
          if (!Array.isArray(keys) || !keys.length) return sceneApi;
          let k0 = keys[0], k1 = keys[keys.length - 1];
          for (let i = 0; i < keys.length - 1; i++) {
            if (pProg >= keys[i].p && pProg <= keys[i + 1].p) { k0 = keys[i]; k1 = keys[i + 1]; break; }
          }
          const u = k1.p > k0.p ? ease.apple(clampNum((pProg - k0.p) / (k1.p - k0.p), 0, 1)) : 0;
          const az = lerpNum(k0.az || 0, k1.az || 0, u) + Math.sin(tSec * 0.9) * 0.025;
          const el = lerpNum(k0.elev !== undefined ? k0.elev : 0.24, k1.elev !== undefined ? k1.elev : 0.24, u) + Math.cos(tSec * 0.8) * 0.015;
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
          if (cfg.vibrancy !== undefined) lights.vibrancy = cfg.vibrancy;
          if (cfg.fogColor) lights.fogCol = hexToVec3(cfg.fogColor);
          if (cfg.fogNear !== undefined) lights.fogNear = cfg.fogNear; if (cfg.fogFar !== undefined) lights.fogFar = cfg.fogFar;
          return sceneApi;
        },
        render(targetCtx) {
          const g = ensureGl(W, H);
          if (!g) return false;

          // Compute Directional Light View-Projection Matrix
          const km = Math.hypot(lights.key[0], lights.key[1], lights.key[2]) || 1;
          const kx = lights.key[0] / km, ky = lights.key[1] / km, kz = lights.key[2] / km;
          const lightEye = [kx * 10.0, ky * 10.0 + 0.4, kz * 10.0];
          const lightView = m4LookAt(lightEye, [0, 0.4, 0], [0, 1, 0]);
          const ext = lights.shadowExtent;
          const lightProj = m4Ortho(-ext, ext, -ext, ext, 1.0, 22.0);
          const lightVP = m4Multiply(lightProj, lightView);

          const opaque = [], trans = [];
          for (let i = 0; i < items.length; i++) {
            const alpha = items[i].mat.alpha !== undefined ? items[i].mat.alpha : 1.0;
            if (alpha < 0.99) trans.push(items[i]); else opaque.push(items[i]);
          }

          // PASS 1: 1024x1024 Hardware Depth Shadow Map Pass
          if (lights.shadows && glShadowFbo && glShadowProg) {
            g.bindFramebuffer(g.FRAMEBUFFER, glShadowFbo);
            g.viewport(0, 0, SHADOW_RES, SHADOW_RES);
            g.disable(g.BLEND);
            g.enable(g.DEPTH_TEST);
            g.depthMask(true);
            g.clearColor(1, 1, 1, 1);
            g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);

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
            g.bindFramebuffer(g.FRAMEBUFFER, null);
          }

          // PASS 2: Main Camera Rich PBR Render Pass
          g.viewport(0, 0, W, H);
          g.depthMask(true);
          g.enable(g.DEPTH_TEST);
          g.depthFunc(g.LEQUAL);
          g.disable(g.CULL_FACE);
          g.clearColor(0, 0, 0, 0);
          g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);

          g.useProgram(glPbrProg);
          const projM = m4Persp(fov, W / Math.max(1, H), 0.1, 120.0);
          const viewM = m4LookAt(eye, target, up);
          const uLoc = (name) => g.getUniformLocation(glPbrProg, name);

          g.activeTexture(g.TEXTURE0);
          g.bindTexture(g.TEXTURE_2D, glShadowTex);
          g.uniform1i(uLoc("uShadowMap"), 0);
          g.uniform1f(uLoc("uShadowEnabled"), lights.shadows ? 1.0 : 0.0);
          g.uniform1f(uLoc("uShadowTexel"), 1.0 / SHADOW_RES);
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
          g.uniform1f(uLoc("uVibrancy"), lights.vibrancy);
          g.uniform3fv(uLoc("uFogColor"), new Float32Array(lights.fogCol));
          g.uniform2f(uLoc("uFogRange"), lights.fogNear, lights.fogFar);

          const aPos = g.getAttribLocation(glPbrProg, "aPos");
          const aNorm = g.getAttribLocation(glPbrProg, "aNorm");
          const aUv = g.getAttribLocation(glPbrProg, "aUv");
          g.enableVertexAttribArray(aPos);
          g.enableVertexAttribArray(aNorm);
          g.enableVertexAttribArray(aUv);

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

              g.bindBuffer(g.ARRAY_BUFFER, glBufPos);
              g.bufferData(g.ARRAY_BUFFER, new Float32Array(geo.pos), g.STREAM_DRAW);
              g.vertexAttribPointer(aPos, 3, g.FLOAT, false, 0, 0);

              g.bindBuffer(g.ARRAY_BUFFER, glBufNorm);
              g.bufferData(g.ARRAY_BUFFER, new Float32Array(geo.norm), g.STREAM_DRAW);
              g.vertexAttribPointer(aNorm, 3, g.FLOAT, false, 0, 0);

              g.bindBuffer(g.ARRAY_BUFFER, glBufUv);
              g.bufferData(g.ARRAY_BUFFER, new Float32Array(geo.uv), g.STREAM_DRAW);
              g.vertexAttribPointer(aUv, 2, g.FLOAT, false, 0, 0);

              g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, glBufIdx);
              g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.idx), g.STREAM_DRAW);
              g.drawElements(m.wireframe ? g.LINES : g.TRIANGLES, geo.idx.length, g.UNSIGNED_SHORT, 0);
            }
          };

          drawList(opaque, false);
          if (trans.length) drawList(trans, true);
          g.depthMask(true);
          g.flush();
          if (targetCtx) targetCtx.drawImage(glCanvas, 0, 0, W, H);
          return true;
        }
      });
      return sceneApi;
    },

    // Expressive Articulated 3D Character Rig v2 (Fixed Outward Arm Kinematics + Hand Sockets + Eyebrows + Squash/Stretch!)
    stylizedCharacter(parentNode, cfg) {
      const c = cfg || {};
      const skin = c.skinColor || "#F2B892";
      const shirt = c.shirtColor || "#FFFFFF";
      const overalls = c.overallColor || "#1E8E4E";
      const hair = c.hairColor || "#38241C";
      const hatCol = c.hatColor || "#E4AE48";
      const bootCol = c.bootColor || "#5A3826";
      const eyeCol = c.eyeColor || "#1E354D";
      const pose = c.pose || "idle"; // "idle" | "wave" | "pour" | "walk" | "jump" | "joy" | "think"
      const expr = c.expression || (pose === "joy" || pose === "jump" ? "joy" : (pose === "pour" ? "focus" : "smile"));
      const headYaw = c.headYaw || 0;
      const headPitch = c.headPitch || 0;
      const headRoll = c.headRoll || 0;
      const blink = c.blink !== undefined ? c.blink : ((tSec % 3.4) > 3.24 ? 1 : 0);

      let bounceY = Math.sin(tSec * 3.4) * 0.035;
      let squashY = 1.0 + Math.sin(tSec * 3.4) * 0.025;
      let leanX = 0.04, twistY = 0;
      // Note: side=-1 is viewer-left arm (negative rz raises outward); side=+1 is viewer-right arm (positive rz raises outward!)
      let lLegA = 0, rLegA = 0;
      let lArmX = 0.14, lArmZ = -0.26;
      let rArmX = 0.14, rArmZ = 0.26;

      if (pose === "walk") {
        const cyc = tSec * 7.4;
        bounceY = Math.abs(Math.sin(cyc)) * 0.09;
        squashY = 1.0 + Math.cos(cyc * 2) * 0.04;
        leanX = 0.12;
        twistY = Math.sin(cyc) * 0.12;
        lLegA = Math.sin(cyc) * 0.56;
        rLegA = -Math.sin(cyc) * 0.56;
        lArmX = -Math.sin(cyc) * 0.52;
        rArmX = Math.sin(cyc) * 0.52;
      } else if (pose === "wave") {
        // Raises viewer-right arm (+X side) outward & up, waving warmly!
        bounceY = Math.sin(tSec * 4.2) * 0.04;
        squashY = 1.0 + Math.sin(tSec * 4.2) * 0.03;
        twistY = -0.10;
        rArmX = -0.28;
        rArmZ = 2.38 + Math.sin(tSec * 8.5) * 0.34;
        lArmX = 0.10;
        lArmZ = -0.32 + Math.sin(tSec * 4.2) * 0.06;
      } else if (pose === "pour") {
        // Reaches viewer-right arm forward (+Z) holding watering can, with gentle pouring tilt!
        const pourNod = Math.sin(tSec * 3.6) * 0.14;
        bounceY = Math.sin(tSec * 3.2) * 0.025;
        leanX = 0.10;
        twistY = -0.16;
        rArmX = -0.92 - pourNod;
        rArmZ = 0.24;
        lArmX = 0.22;
        lArmZ = -0.38;
      } else if (pose === "think") {
        bounceY = Math.sin(tSec * 2.6) * 0.02;
        rArmX = -1.15;
        rArmZ = -0.45;
        lArmX = 0.15;
        lArmZ = -0.24;
      } else if (pose === "jump" || pose === "joy") {
        const cyc = tSec * 5.6;
        const j = Math.abs(Math.sin(cyc));
        bounceY = j * 0.28;
        squashY = j > 0.15 ? (1.0 + j * 0.07) : 0.92;
        leanX = -0.06 * j;
        lArmZ = -2.28 - j * 0.36;
        rArmZ = 2.28 + j * 0.36;
        lArmX = -0.15;
        rArmX = -0.15;
        lLegA = -0.24 * j;
        rLegA = 0.24 * j;
      }

      const root = parentNode.node({ pos: c.pos || [0, 0, 0], rot: c.rot || [0, 0, 0], scale: c.scale !== undefined ? c.scale : 1 });
      if (c.shadow !== false) {
        root.shadow([0, 0.005, 0], 0.56 * (1 - bounceY * 0.45), 0.48 * (1 - bounceY * 0.45), 0.38);
      }

      const hips = root.node({ pos: [0, 0.44 + bounceY, 0], scale: [1 / Math.sqrt(squashY), squashY, 1 / Math.sqrt(squashY)] });
      [-1, 1].forEach((side) => {
        const legAng = side < 0 ? lLegA : rLegA;
        const hipJoint = hips.node({ pos: [side * 0.16, 0.0, 0], rot: [legAng, 0, 0] });
        hipJoint.capsule([0, -0.18, 0], 0.096, 0.24, [0, 0, 0], { color: overalls, roughness: 0.65, detail: 0.06 });
        hipJoint.ellipsoid([0, -0.36, 0.05], [0.118, 0.078, 0.168], [0, 0, 0], { color: bootCol, roughness: 0.48 });
      });

      const torso = hips.node({ pos: [0, 0.24, 0], rot: [leanX, twistY, 0] });
      torso.roundBox([0, 0.02, 0], [0.52, 0.52, 0.38], 0.18, [0, 0, 0], { color: shirt, roughness: 0.68 });
      torso.roundBox([0, -0.05, 0.01], [0.54, 0.38, 0.40], 0.16, [0, 0, 0], { color: overalls, roughness: 0.65, detail: 0.06 });
      [-1, 1].forEach((s) => {
        torso.box([s * 0.14, 0.18, 0.18], [0.06, 0.18, 0.04], [0, 0, 0], { color: overalls, roughness: 0.6 });
        torso.sphere([s * 0.14, 0.11, 0.205], 0.028, { color: "#F5C242", metalness: 0.85, roughness: 0.22 });
      });
      if (c.backpack !== false) {
        torso.roundBox([0, 0.04, -0.24], [0.36, 0.38, 0.16], 0.07, [0, 0, 0], { color: "#C6643A", roughness: 0.62, detail: 0.06 });
      }

      // Articulated Arms + Exposed Hand Sockets (leftHand / rightHand) for gripping props!
      let leftHand = null;
      let rightHand = null;
      [-1, 1].forEach((side) => {
        const ax = side < 0 ? lArmX : rArmX;
        const az = side < 0 ? lArmZ : rArmZ;
        const shoulder = torso.node({ pos: [side * 0.31, 0.18, 0], rot: [ax, 0, az] });
        shoulder.capsule([0, -0.17, 0], 0.080, 0.24, [0, 0, 0], { color: shirt, roughness: 0.65 });
        const handNode = shoulder.node({ pos: [0, -0.34, 0] });
        handNode.sphere([0, 0, 0], 0.085, { color: skin, roughness: 0.52, sss: 0.30 });
        if (side < 0) leftHand = handNode; else rightHand = handNode;
      });

      const head = torso.node({ pos: [0, 0.54, 0.02], rot: [headPitch, headYaw, headRoll] });
      head.ellipsoid([0, 0.02, 0], [0.36, 0.34, 0.34], [0, 0, 0], { color: skin, roughness: 0.50, sss: 0.34 }, 32);

      [-1, 1].forEach((s) => {
        head.sphere([s * 0.35, 0.0, -0.02], 0.076, { color: skin, roughness: 0.52, sss: 0.28 });
      });

      // Nose & Warm Rosy Cheeks
      head.ellipsoid([0, -0.02, 0.34], [0.054, 0.044, 0.050], [0, 0, 0], { color: "#E29572", roughness: 0.46, sss: 0.38 });
      [-1, 1].forEach((s) => {
        head.ellipsoid([s * 0.20, -0.07, 0.28], [0.072, 0.044, 0.032], [0, s * 0.45, 0], { color: "#FF6E86", roughness: 0.58, sss: 0.35 });
      });

      // Expressive Mouth Shapes ("smile" | "joy" | "wow")
      if (expr === "joy") {
        head.ellipsoid([0, -0.13, 0.30], [0.072, 0.052, 0.042], [0.15, 0, 0], { color: "#B83244", roughness: 0.38 });
      } else if (expr === "wow") {
        head.ellipsoid([0, -0.13, 0.31], [0.042, 0.048, 0.038], [0, 0, 0], { color: "#B83244", roughness: 0.38 });
      } else {
        head.torus([0, -0.11, 0.30], 0.058, 0.017, [0.25, 0, Math.PI], { color: "#9E3442", roughness: 0.42 }, 20, 10);
      }

      // 3D Layered Glossy Eyes + Expressive Eyebrows
      const eyeOpenY = lerpNum(1.0, 0.08, clampNum(blink, 0, 1));
      const browLift = expr === "joy" ? 0.022 : (expr === "focus" ? -0.010 : 0.008);
      const browTilt = expr === "focus" ? -0.18 : 0.12;
      [-1, 1].forEach((s) => {
        const ex = s * 0.135, ey = 0.045, ez = 0.295;
        head.ellipsoid([ex, ey, ez], [0.074, 0.084 * eyeOpenY, 0.044], [0, s * 0.22, 0], { color: "#FFFFFF", roughness: 0.10 });
        if (eyeOpenY > 0.25) {
          head.ellipsoid([ex + s * 0.008, ey, ez + 0.027], [0.048, 0.058 * eyeOpenY, 0.028], [0, s * 0.22, 0], { color: eyeCol, roughness: 0.08 });
          head.sphere([ex + s * 0.022, ey + 0.022, ez + 0.046], 0.017, { color: "#FFFFFF", unlit: true });
        }
        // Expressive 3D Eyebrow
        head.capsule([ex, ey + 0.105 + browLift, ez + 0.01], 0.016, 0.075, [0, s * 0.22, Math.PI * 0.5 + s * browTilt], { color: hair, roughness: 0.72 }, 12);
      });

      // Hair & Sunhat / Sprout
      head.ellipsoid([0, 0.13, -0.04], [0.37, 0.26, 0.36], [-0.15, 0, 0], { color: hair, roughness: 0.76, detail: 0.08 });
      if (c.hat !== false) {
        head.cylinder([0, 0.26, -0.02], 0.56, 0.52, 0.035, [-0.12, 0, 0], { color: hatCol, roughness: 0.68, detail: 0.08 }, 32);
        head.ellipsoid([0, 0.32, -0.02], [0.33, 0.18, 0.33], [-0.12, 0, 0], { color: hatCol, roughness: 0.65, detail: 0.08 }, 28);
        head.torus([0, 0.285, -0.02], 0.335, 0.022, [Math.PI * 0.5 - 0.12, 0, 0], { color: overalls, roughness: 0.58 }, 32, 10);
      } else {
        head.cylinder([0, 0.42, 0], 0.02, 0.015, 0.18, [0, 0, 0], { color: "#229652", roughness: 0.42 });
        head.leaf([0, 0.50, 0], [0.3, 0.4, 0], 0.24, 0.12, 0.05, { color: "#28B862", color2: "#6CE896", sss: 0.35 });
        head.leaf([0, 0.50, 0], [0.3, -2.6, 0], 0.22, 0.11, 0.05, { color: "#34C76E", color2: "#7EF0A4", sss: 0.35 });
      }

      return { root, hips, torso, head, leftHand, rightHand };
    },

    shader(targetCtx, fragCode, uniforms) {
      const g = ensureGl(W, H);
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
        prog = linkGlProgram(g, SHADER_QUAD_VS, fsSrc);
        glShaderCache.set(fsSrc, prog);
      }
      g.viewport(0, 0, W, H);
      g.disable(g.DEPTH_TEST);
      g.disable(g.BLEND);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.useProgram(prog);
      const uResLoc = g.getUniformLocation(prog, "uRes");
      if (uResLoc) g.uniform2f(uResLoc, W, H);
      const uTimeLoc = g.getUniformLocation(prog, "uTime");
      if (uTimeLoc) g.uniform1f(uTimeLoc, tSec);
      const uProgLoc = g.getUniformLocation(prog, "uProgress");
      if (uProgLoc) g.uniform1f(uProgLoc, pVal);
      if (uniforms && typeof uniforms === "object") {
        Object.keys(uniforms).forEach((k) => {
          const loc = g.getUniformLocation(prog, k);
          if (!loc) return;
          const v = uniforms[k];
          if (typeof v === "number") g.uniform1f(loc, v);
          else if (typeof v === "string" && v.startsWith("#")) { const c = hexToVec3(v); g.uniform3f(loc, c[0], c[1], c[2]); }
          else if (Array.isArray(v) && v.length === 2) g.uniform2f(loc, v[0], v[1]);
          else if (Array.isArray(v) && v.length === 3) g.uniform3f(loc, v[0], v[1], v[2]);
          else if (Array.isArray(v) && v.length === 4) g.uniform4f(loc, v[0], v[1], v[2], v[3]);
        });
      }
      const aPos = g.getAttribLocation(prog, "aPos");
      g.bindBuffer(g.ARRAY_BUFFER, glQuadBuf);
      g.enableVertexAttribArray(aPos);
      g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 0, 0);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      g.flush();
      if (targetCtx) targetCtx.drawImage(glCanvas, 0, 0, W, H);
      return true;
    }
  };
  return Object.freeze(g3dObj);
}

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
    drawGlow(c, x, y, r, hex, alpha) {
      const g = c.createRadialGradient(x, y, 0, x, y, r), rgb = parseHexRGB(hex, [220, 230, 242]);
      g.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + clampNum(alpha, 0, 1) + ")");
      g.addColorStop(0.55, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + clampNum(alpha * 0.25, 0, 1) + ")");
      g.addColorStop(1, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0)");
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
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
    cameraRig, transition, text, particles, chart
  });
}

function seededRandom(seed, index) {
  let value = (seed ^ Math.imul(index + 1, 0x45d9f3b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 4294967296;
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
  const cam = makeCameraApi(W, H);
  const ui = makeUiApi(S);
  const fx = makeFxApi(W, H, S, t, frame, fps, rand, ui);
  const g3d = makeG3dApi(W, H, t, p);

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
