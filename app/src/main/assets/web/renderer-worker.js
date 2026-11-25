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

// Persistent GPU WebGL OffscreenCanvas & Reusable Buffers (Zero GPU Memory Leak!)
let glCanvas = null;
let gl = null;
let glW = 0;
let glH = 0;
let glPbrProg = null;
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
// REAL GPU WEBGL 3D ENGINE (g3d) + GLSL RAYMARCHING SHADER
// =======================================================
const PBR_VS = `
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec2 aUv;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormMat;
varying vec3 vWorldPos;
varying vec3 vNorm;
varying vec2 vUv;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vNorm = normalize(uNormMat * aNorm);
  vUv = aUv;
  gl_Position = uProj * uView * wp;
}`;

const PBR_FS = `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vNorm;
varying vec2 vUv;
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
uniform vec3 uFogColor;
uniform vec2 uFogRange;
void main() {
  vec3 N = normalize(vNorm);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uEye - vWorldPos);
  vec3 L1 = normalize(uKeyDir);
  vec3 L2 = normalize(uFillDir);
  vec3 L3 = normalize(uRimDir);

  vec3 baseCol = mix(uColor, uColor2, clamp(vUv.y, 0.0, 1.0));
  float rough = clamp(uRoughness, 0.06, 0.98);
  float metal = clamp(uMetalness, 0.0, 1.0);

  // Diffuse + soft wrap subsurface scattering
  float ndl1 = max(dot(N, L1), 0.0);
  float ndl2 = max(dot(N, L2), 0.0);
  float wrap = max(0.0, (dot(N, L1) + 0.45) / 1.45);
  float sssTerm = pow(max(0.0, dot(-L1, V)), 2.2) * uSss + wrap * uSss * 0.25;

  // Specular GGX-like highlight
  float shininess = exp2(10.0 * (1.0 - rough) + 1.5);
  vec3 H1 = normalize(L1 + V);
  vec3 H2 = normalize(L2 + V);
  float spec1 = pow(max(dot(N, H1), 0.0), shininess) * (0.28 + 0.85 * (1.0 - rough));
  float spec2 = pow(max(dot(N, H2), 0.0), shininess * 0.5) * 0.16;

  // Procedural Studio HDRI Reflection (gives chrome/glass/titanium realism!)
  vec3 R = reflect(-V, N);
  float skyT = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 envGround = vec3(0.06, 0.08, 0.11);
  vec3 envHorizon = vec3(0.55, 0.62, 0.72);
  vec3 envSky = vec3(0.88, 0.93, 1.0);
  vec3 envCol = skyT < 0.5
    ? mix(envGround, envHorizon, pow(skyT * 2.0, 1.6))
    : mix(envHorizon, envSky, pow((skyT - 0.5) * 2.0, 0.9));
  float softbox = smoothstep(0.68, 0.95, dot(R, normalize(vec3(0.45, 0.78, 0.42))));
  envCol += vec3(0.95, 0.96, 1.0) * softbox * (1.15 - rough * 0.75);

  float ndv = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - ndv, 3.2);
  vec3 F0 = mix(vec3(0.04), baseCol, metal);
  vec3 F = F0 + (vec3(1.0) - F0) * fresnel;

  // Hemisphere ambient
  vec3 hemi = mix(vec3(0.22, 0.25, 0.30), vec3(0.85, 0.92, 0.98), N.y * 0.5 + 0.5) * uAmb;
  vec3 diff = baseCol * (1.0 - metal * 0.78) * (hemi + uKeyCol * ndl1 * 0.95 + uFillCol * ndl2 * 0.34);
  vec3 specCol = mix(vec3(1.0), baseCol, metal) * (spec1 * uKeyCol + spec2 * uFillCol);
  vec3 envRefl = envCol * F * (0.28 + 0.72 * (1.0 - rough)) * (0.35 + 0.65 * metal + 0.45 * fresnel);
  vec3 rimGlow = uRimColor * (fresnel * 0.55 + max(dot(N, L3), 0.0) * 0.35) * uRimPow;
  vec3 sssCol = baseCol * vec3(1.25, 0.85, 0.90) * sssTerm;

  vec3 col = diff + specCol + envRefl + rimGlow + sssCol + uEmissive;

  // Distance fog
  if (uFogRange.y > uFogRange.x) {
    float dist = length(uEye - vWorldPos);
    float fogF = smoothstep(uFogRange.x, uFogRange.y, dist);
    col = mix(col, uFogColor, fogF * 0.85);
  }

  // Smooth Filmic Tone Mapping
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
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
    glW = W; glH = H;
  } else if (glW !== W || glH !== H) {
    glCanvas.width = W;
    glCanvas.height = H;
    glW = W; glH = H;
  }
  return gl;
}

// Column-Major 4x4 Matrix Math for WebGL
function m4Persp(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov * 0.5), nf = 1.0 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
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

function m4Model(pos, rot, scale) {
  const px = pos ? pos[0] : 0, py = pos ? pos[1] : 0, pz = pos ? pos[2] : 0;
  const rx = rot ? rot[0] : 0, ry = rot ? rot[1] : 0, rz = rot ? rot[2] : 0;
  const sx = Array.isArray(scale) ? scale[0] : (scale !== undefined ? scale : 1);
  const sy = Array.isArray(scale) ? scale[1] : (scale !== undefined ? scale : 1);
  const sz = Array.isArray(scale) ? scale[2] : (scale !== undefined ? scale : 1);
  const cx = Math.cos(rx), sxr = Math.sin(rx);
  const cy = Math.cos(ry), syr = Math.sin(ry);
  const cz = Math.cos(rz), szr = Math.sin(rz);
  // Rotation order: Ry * Rx * Rz
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

// High-Resolution Smooth Geometry Builders for g3d
function buildSphereGeo(rad, segs) {
  const s = clampNum(segs || 28, 8, 56);
  const rings = Math.max(6, Math.round(s * 0.72));
  const pos = [], norm = [], uv = [], idx = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings, phi = v * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let x = 0; x <= s; x++) {
      const u = x / s, th = u * Math.PI * 2;
      const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
      pos.push(nx * rad, ny * rad, nz * rad);
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
    for (let k = 1; k <= 4; k++) {
      pos.push(fc[k][0], fc[k][1], fc[k][2]);
      norm.push(n[0], n[1], n[2]);
    }
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { pos, norm, uv, idx };
}

function buildTorusGeo(R, r, segsU, segsV) {
  const su = clampNum(segsU || 40, 12, 64), sv = clampNum(segsV || 20, 8, 36);
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j <= sv; j++) {
    const v = j / sv, phi = v * Math.PI * 2;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    for (let i = 0; i <= su; i++) {
      const u = i / su, th = u * Math.PI * 2;
      const ct = Math.cos(th), st = Math.sin(th);
      const rr = R + r * cp;
      pos.push(rr * ct, r * sp, rr * st);
      norm.push(cp * ct, sp, cp * st);
      uv.push(u, v);
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
  const s = clampNum(segs || 32, 8, 64);
  const m = profile.length;
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j < m; j++) {
    const pPrev = profile[Math.max(0, j - 1)];
    const pCur = profile[j];
    const pNext = profile[Math.min(m - 1, j + 1)];
    const dr = pNext[0] - pPrev[0];
    const dy = pNext[1] - pPrev[1];
    let nr = dy, ny = -dr;
    const nm = Math.hypot(nr, ny) || 1;
    nr /= nm; ny /= nm;
    const v = j / Math.max(1, m - 1);
    for (let i = 0; i <= s; i++) {
      const u = i / s, a = u * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
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

// Ultra-smooth curved 3D petal grid (6x8 smooth normals — Blender quality!)
function buildPetalGeo(w, h, cup, curl) {
  const nu = 6, nv = 8;
  const grid = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    // Organic teardrop-heart rose petal width profile
    const widthProfile = Math.sin(Math.pow(v, 0.72) * Math.PI) * (0.85 + 0.25 * Math.sin(v * Math.PI));
    const halfW = w * 0.5 * Math.max(0.08, widthProfile);
    const y = v * h;
    const curlZ = Math.pow(v, 2.6) * (curl || 0.16);
    const row = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, su = (u - 0.5) * 2;
      const x = su * halfW;
      const cupZ = -(1 - su * su) * (cup || 0.12) * Math.sin(v * Math.PI);
      row.push([x, y, cupZ + curlZ]);
    }
    grid.push(row);
  }
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const p0 = grid[j][i];
      const pL = grid[j][Math.max(0, i - 1)], pR = grid[j][Math.min(nu, i + 1)];
      const pD = grid[Math.max(0, j - 1)][i], pU = grid[Math.min(nv, j + 1)][i];
      const tx = pR[0] - pL[0], ty = pR[1] - pL[1], tz = pR[2] - pL[2];
      const bx = pU[0] - pD[0], by = pU[1] - pD[1], bz = pU[2] - pD[2];
      let nx = ty * bz - tz * by, ny = tz * bx - tx * bz, nz = tx * by - ty * bx;
      const nm = Math.hypot(nx, ny, nz) || 1;
      pos.push(p0[0], p0[1], p0[2]);
      norm.push(nx / nm, ny / nm, nz / nm);
      uv.push(i / nu, j / nv);
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
  const nu = 6, nv = 8;
  const grid = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const halfW = wid * 0.5 * Math.sin(Math.pow(v, 0.78) * Math.PI);
    const z = v * len;
    const archY = Math.sin(v * Math.PI) * (bend || 0.14) - v * v * (bend || 0.14) * 1.1;
    const row = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, su = (u - 0.5) * 2;
      const x = su * halfW;
      const vFold = Math.abs(su) * 0.06 * wid * Math.sin(v * Math.PI);
      row.push([x, archY + vFold, z]);
    }
    grid.push(row);
  }
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const p0 = grid[j][i];
      const pL = grid[j][Math.max(0, i - 1)], pR = grid[j][Math.min(nu, i + 1)];
      const pD = grid[Math.max(0, j - 1)][i], pU = grid[Math.min(nv, j + 1)][i];
      const tx = pR[0] - pL[0], ty = pR[1] - pL[1], tz = pR[2] - pL[2];
      const bx = pU[0] - pD[0], by = pU[1] - pD[1], bz = pU[2] - pD[2];
      let nx = by * tz - bz * ty, ny = bz * tx - bx * tz, nz = bx * ty - by * tx;
      const nm = Math.hypot(nx, ny, nz) || 1;
      pos.push(p0[0], p0[1], p0[2]);
      norm.push(nx / nm, ny / nm, nz / nm);
      uv.push(i / nu, j / nv);
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

function buildTubeGeo(pathPts, rStart, rEnd, segs) {
  const s = clampNum(segs || 16, 6, 36);
  const m = pathPts.length;
  const pos = [], norm = [], uv = [], idx = [];
  for (let j = 0; j < m; j++) {
    const v = j / Math.max(1, m - 1);
    const r = lerpNum(rStart, rEnd !== undefined ? rEnd : rStart, v);
    const pCur = pathPts[j];
    const pPrev = pathPts[Math.max(0, j - 1)], pNext = pathPts[Math.min(m - 1, j + 1)];
    let tx = pNext[0] - pPrev[0], ty = pNext[1] - pPrev[1], tz = pNext[2] - pPrev[2];
    const tm = Math.hypot(tx, ty, tz) || 1; tx /= tm; ty /= tm; tz /= tm;
    const up = Math.abs(ty) > 0.92 ? [1, 0, 0] : [0, 1, 0];
    let rx = up[1] * tz - up[2] * ty, ry = up[2] * tx - up[0] * tz, rz = up[0] * ty - up[1] * tx;
    const rm = Math.hypot(rx, ry, rz) || 1; rx /= rm; ry /= rm; rz /= rm;
    const bx = ty * rz - tz * ry, by = tz * rx - tx * rz, bz = tx * ry - ty * rx;
    for (let i = 0; i <= s; i++) {
      const u = i / s, a = u * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = rx * ca + bx * sa, ny = ry * ca + by * sa, nz = rz * ca + bz * sa;
      pos.push(pCur[0] + nx * r, pCur[1] + ny * r, pCur[2] + nz * r);
      norm.push(nx, ny, nz);
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

function makeG3dApi(W, H, tSec, pVal) {
  return Object.freeze({
    get supported() { return !!ensureGl(W, H); },
    scene(opts) {
      const o = opts || {};
      let eye = o.eye || [0, 1.5, 6];
      let target = o.target || [0, 0, 0];
      let up = o.up || [0, 1, 0];
      let fov = o.fov || 0.72;
      const lights = {
        key: o.keyDir || [0.58, 0.80, 0.45],
        fill: o.fillDir || [-0.72, 0.25, -0.35],
        rim: o.rimDir || [-0.25, 0.55, -0.82],
        keyCol: hexToVec3(o.keyColor || "#FFF9F2"),
        fillCol: hexToVec3(o.fillColor || "#C8E0FF"),
        amb: o.ambient !== undefined ? o.ambient : 0.34,
        fogCol: hexToVec3(o.fogColor || "#06090F"),
        fogNear: o.fogNear || 0,
        fogFar: o.fogFar || 0
      };
      const items = [];
      const addItem = (geo, pos, rot, scale, mat) => {
        items.push({ geo, pos: pos || [0, 0, 0], rot: rot || [0, 0, 0], scale: scale !== undefined ? scale : 1, mat: mat || {} });
      };
      const api = {
        camera(newEye, newTarget, newFov, newUp) {
          if (newEye) eye = newEye;
          if (newTarget) target = newTarget;
          if (newFov) fov = newFov;
          if (newUp) up = newUp;
          return api;
        },
        orbit(az, elev, dist, tgt, newFov) {
          const tt = tgt || target;
          target = tt;
          eye = [
            tt[0] + dist * Math.cos(elev) * Math.sin(az),
            tt[1] + dist * Math.sin(elev),
            tt[2] + dist * Math.cos(elev) * Math.cos(az)
          ];
          if (newFov) fov = newFov;
          return api;
        },
        lights(cfg) {
          if (!cfg) return api;
          if (cfg.key) lights.key = cfg.key;
          if (cfg.fill) lights.fill = cfg.fill;
          if (cfg.rim) lights.rim = cfg.rim;
          if (cfg.keyColor) lights.keyCol = hexToVec3(cfg.keyColor);
          if (cfg.fillColor) lights.fillCol = hexToVec3(cfg.fillColor);
          if (cfg.ambient !== undefined) lights.amb = cfg.ambient;
          if (cfg.fogColor) lights.fogCol = hexToVec3(cfg.fogColor);
          if (cfg.fogNear !== undefined) lights.fogNear = cfg.fogNear;
          if (cfg.fogFar !== undefined) lights.fogFar = cfg.fogFar;
          return api;
        },
        sphere(pos, r, mat, segs) { addItem(buildSphereGeo(r || 1, segs), pos, [0, 0, 0], 1, mat); return api; },
        box(pos, size, rot, mat) {
          const sz = Array.isArray(size) ? size : [size || 1, size || 1, size || 1];
          addItem(buildBoxGeo(sz[0], sz[1], sz[2]), pos, rot, 1, mat); return api;
        },
        cylinder(pos, rBot, rTop, h, rot, mat, segs) {
          const hh = (h || 1) * 0.5;
          const prof = [[0, -hh], [rBot, -hh], [rBot, -hh], [rTop, hh], [rTop, hh], [0, hh]];
          addItem(buildLatheGeo(prof, segs || 32), pos, rot, 1, mat); return api;
        },
        cone(pos, r, h, rot, mat, segs) {
          const hh = (h || 1) * 0.5;
          addItem(buildLatheGeo([[0, -hh], [r || 0.6, -hh], [r || 0.6, -hh], [0.001, hh]], segs || 28), pos, rot, 1, mat); return api;
        },
        torus(pos, R, r, rot, mat, segsU, segsV) { addItem(buildTorusGeo(R || 1, r || 0.22, segsU, segsV), pos, rot, 1, mat); return api; },
        plane(pos, w, h, rot, mat) { addItem(buildBoxGeo(w || 2, 0.02, h || 2), pos, rot, 1, mat); return api; },
        lathe(profile, pos, rot, mat, segs) { addItem(buildLatheGeo(profile, segs || 36), pos, rot, 1, mat); return api; },
        petal(pos, rot, w, h, cup, curl, mat) { addItem(buildPetalGeo(w || 0.5, h || 0.75, cup, curl), pos, rot, 1, mat); return api; },
        leaf(pos, rot, len, wid, bend, mat) { addItem(buildLeafGeo(len || 0.9, wid || 0.36, bend), pos, rot, 1, mat); return api; },
        tube(pathPts, rStart, rEnd, mat, segs) { addItem(buildTubeGeo(pathPts, rStart || 0.08, rEnd, segs || 16), [0, 0, 0], [0, 0, 0], 1, mat); return api; },
        mesh(geo, pos, rot, scale, mat) { addItem(geo, pos, rot, scale, mat); return api; },
        render(targetCtx) {
          const g = ensureGl(W, H);
          if (!g) return false;
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

          g.uniformMatrix4fv(uLoc("uProj"), false, projM);
          g.uniformMatrix4fv(uLoc("uView"), false, viewM);
          g.uniform3fv(uLoc("uEye"), new Float32Array(eye));
          g.uniform3fv(uLoc("uKeyDir"), new Float32Array(lights.key));
          g.uniform3fv(uLoc("uFillDir"), new Float32Array(lights.fill));
          g.uniform3fv(uLoc("uRimDir"), new Float32Array(lights.rim));
          g.uniform3fv(uLoc("uKeyCol"), new Float32Array(lights.keyCol));
          g.uniform3fv(uLoc("uFillCol"), new Float32Array(lights.fillCol));
          g.uniform1f(uLoc("uAmb"), lights.amb);
          g.uniform3fv(uLoc("uFogColor"), new Float32Array(lights.fogCol));
          g.uniform2f(uLoc("uFogRange"), lights.fogNear, lights.fogFar);

          const aPos = g.getAttribLocation(glPbrProg, "aPos");
          const aNorm = g.getAttribLocation(glPbrProg, "aNorm");
          const aUv = g.getAttribLocation(glPbrProg, "aUv");
          g.enableVertexAttribArray(aPos);
          g.enableVertexAttribArray(aNorm);
          g.enableVertexAttribArray(aUv);

          const opaque = [];
          const trans = [];
          for (let i = 0; i < items.length; i++) {
            const alpha = items[i].mat.alpha !== undefined ? items[i].mat.alpha : 1.0;
            if (alpha < 0.99) trans.push(items[i]); else opaque.push(items[i]);
          }
          if (trans.length > 1) {
            trans.sort((a, b) => {
              const da = Math.hypot(a.pos[0] - eye[0], a.pos[1] - eye[1], a.pos[2] - eye[2]);
              const db = Math.hypot(b.pos[0] - eye[0], b.pos[1] - eye[1], b.pos[2] - eye[2]);
              return db - da;
            });
          }

          const drawList = (list, isTrans) => {
            if (isTrans) {
              g.enable(g.BLEND);
              g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
              g.depthMask(false);
            } else {
              g.disable(g.BLEND);
              g.depthMask(true);
            }
            for (let i = 0; i < list.length; i++) {
              const it = list[i], m = it.mat, geo = it.geo;
              const modelM = m4Model(it.pos, it.rot, it.scale);
              const normM = m3NormalFromM4(modelM);
              g.uniformMatrix4fv(uLoc("uModel"), false, modelM);
              g.uniformMatrix3fv(uLoc("uNormMat"), false, normM);
              const c1 = hexToVec3(m.color || "#E6ECF5");
              const c2 = m.color2 ? hexToVec3(m.color2) : c1;
              g.uniform3fv(uLoc("uColor"), new Float32Array(c1));
              g.uniform3fv(uLoc("uColor2"), new Float32Array(c2));
              g.uniform3fv(uLoc("uEmissive"), new Float32Array(m.emissive ? hexToVec3(m.emissive) : [0, 0, 0]));
              g.uniform3fv(uLoc("uRimColor"), new Float32Array(hexToVec3(m.rimColor || "#FFFFFF")));
              g.uniform1f(uLoc("uRoughness"), m.roughness !== undefined ? m.roughness : 0.35);
              g.uniform1f(uLoc("uMetalness"), m.metalness !== undefined ? m.metalness : 0.08);
              g.uniform1f(uLoc("uRimPow"), m.rim !== undefined ? m.rim : 0.45);
              g.uniform1f(uLoc("uSss"), m.sss !== undefined ? m.sss : 0.0);
              g.uniform1f(uLoc("uAlpha"), m.alpha !== undefined ? m.alpha : 1.0);

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
      };
      return api;
    },

    // Real-Time GPU GLSL Fragment Shader / 3D Raymarching Runner
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
  });
}

// Software Micro 3D Engine (d3) — Tetap tersedia untuk Stylized 2D/3D & Fallback!
const d3 = Object.freeze({
  rotX(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1]*c - v[2]*s, v[1]*s + v[2]*c]; },
  rotY(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0]*c + v[2]*s, v[1], -v[0]*s + v[2]*c]; },
  rotZ(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0]*c - v[1]*s, v[0]*s + v[1]*c, v[2]]; },
  norm(a) { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/m, a[1]/m, a[2]/m]; },
  dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; },
  cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; },
  sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; },
  camera(eye, target, fovRad, W, H, cyRatio) {
    const fwd = d3.norm(d3.sub(target, eye));
    const right = d3.norm(d3.cross(fwd, [0, 1, 0]));
    const up = d3.cross(right, fwd);
    const focal = (Math.min(W, H) * 0.9) / Math.tan((fovRad || 0.72) * 0.5);
    const cx = W * 0.5, cy = H * (cyRatio !== undefined ? cyRatio : 0.5);
    return (pt) => {
      const d = d3.sub(pt, eye);
      const px = d3.dot(d, right), py = d3.dot(d, up), pz = d3.dot(d, fwd);
      if (pz < 0.25) return null;
      const k = focal / pz;
      return [cx + px * k, cy - py * k, pz];
    };
  },
  createScene(eye, target, fovRad, W, H, cyRatio) {
    const proj = d3.camera(eye, target, fovRad, W, H, cyRatio);
    const focal = (Math.min(W, H) * 0.9) / Math.tan((fovRad || 0.72) * 0.5);
    const lKey = d3.norm([0.58, 0.80, 0.44]);
    const lFill = d3.norm([-0.72, 0.24, -0.35]);
    const lRim = d3.norm([-0.22, 0.58, -0.80]);
    const q = [];
    const shade = (rgb, n, vDir, specPow, sssAmt) => {
      const dk = Math.max(0, d3.dot(n, lKey)), df = Math.max(0, d3.dot(n, lFill)), dr = Math.max(0, d3.dot(n, lRim));
      const fr = Math.pow(1 - Math.max(0, d3.dot(n, vDir)), 2.6);
      let sp = 0;
      if (specPow > 0) {
        const hv = d3.norm([lKey[0]+vDir[0], lKey[1]+vDir[1], lKey[2]+vDir[2]]);
        sp = Math.pow(Math.max(0, d3.dot(n, hv)), specPow) * 0.30;
      }
      const sss = sssAmt ? Math.pow(Math.max(0, d3.dot([-lKey[0], -lKey[1], -lKey[2]], vDir)), 2) * sssAmt : 0;
      const lit = 0.34 + dk * 0.70 + df * 0.16 + sss * 0.32;
      const rim = (dr * 0.28 + fr * 0.26) * 0.24;
      return [rgb[0]*lit + 255*sp + sss*65 + 170*rim, rgb[1]*lit + 248*sp + sss*18 + 225*rim, rgb[2]*lit + 240*sp + sss*28 + 210*rim];
    };
    const scene = {
      project: proj,
      poly(verts, colHex, opts) {
        const o = opts || {}, n = verts.length, ps = [];
        let sz = 0, cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < n; i++) {
          const pr = proj(verts[i]); if (!pr) return;
          ps.push(pr); sz += pr[2]; cx += verts[i][0]; cy += verts[i][1]; cz += verts[i][2];
        }
        const ctr = [cx/n, cy/n, cz/n];
        let norm = d3.norm(d3.cross(d3.sub(verts[1], verts[0]), d3.sub(verts[2], verts[0])));
        const vDir = d3.norm(d3.sub(eye, ctr));
        if (d3.dot(norm, vDir) <= 0) { if (!o.twoSided) return; norm = [-norm[0], -norm[1], -norm[2]]; }
        const cA = shade(parseHexRGB(colHex, [220, 60, 85]), norm, vDir, o.spec || 18, o.sss || 0);
        const cB = o.col2 ? shade(parseHexRGB(o.col2, cA), norm, vDir, (o.spec || 18) * 1.15, (o.sss || 0) * 1.2) : null;
        const edgeMul = o.edgeMul !== undefined ? o.edgeMul : 0.90;
        q.push({
          t: cB ? 3 : 0, z: sz/n + (o.zBias || 0), ps,
          cA: rgbStr(cA, o.alpha), cB: cB ? rgbStr(cB, o.alpha) : null,
          gA: o.gA || 0, gB: o.gB !== undefined ? o.gB : Math.min(2, n - 1),
          st: rgbStr([cA[0]*edgeMul, cA[1]*edgeMul, cA[2]*edgeMul], o.edgeAlpha !== undefined ? o.edgeAlpha : (o.alpha === undefined ? 0.85 : o.alpha * 0.85))
        });
      },
      addOrganicPetal(origin, angY, baseRad, baseY, pW, pH, pitch, cup, curl, colBase, colTip, zBias) {
        const local = [
          [-pW*0.22,0,0],[pW*0.22,0,0],[pW*0.48,pH*0.36,-cup*0.80],[pW*0.52,pH*0.72,-cup*0.55],
          [pW*0.30,pH*0.95,-cup*0.14+curl*0.9],[0,pH*1.03,-cup*0.06+curl*1.2],
          [-pW*0.30,pH*0.95,-cup*0.14+curl*0.9],[-pW*0.52,pH*0.72,-cup*0.55],[-pW*0.48,pH*0.36,-cup*0.80]
        ];
        const world = local.map((pt) => {
          let qv = d3.rotX(pt, pitch); qv = [qv[0], qv[1] + baseY, qv[2] + baseRad]; qv = d3.rotY(qv, angY);
          return [origin[0] + qv[0], origin[1] + qv[1], origin[2] + qv[2]];
        });
        scene.poly(world, colBase, { col2: colTip, gA: 0, gB: 5, twoSided: true, spec: 26, sss: 0.36, zBias: zBias || 0, edgeAlpha: 0.30 });
      },
      addLathe(rings, sides, colBot, colTop, yOff, specPow, zBias) {
        const rPts = [];
        for (let r = 0; r < rings.length; r++) {
          const rad = rings[r].r, y = rings[r].y + (yOff || 0), pts = [];
          for (let i = 0; i < sides; i++) { const a = (i * Math.PI * 2) / sides; pts.push([Math.cos(a) * rad, y, Math.sin(a) * rad]); }
          rPts.push(pts);
        }
        for (let r = 0; r < rings.length - 1; r++) {
          for (let i = 0; i < sides; i++) {
            const ni = (i + 1) % sides;
            const v0 = rPts[r][i], v1 = rPts[r + 1][i], v2 = rPts[r + 1][ni], v3 = rPts[r][ni];
            const polyVerts = rings[r].r < 0.001 ? [v0, v1, v2] : (rings[r + 1].r < 0.001 ? [v0, v1, v3] : [v0, v1, v2, v3]);
            scene.poly(polyVerts, colBot, { col2: colTop, gA: 0, gB: 1, twoSided: false, spec: specPow || 16, zBias: zBias || 0, edgeMul: 0.96, edgeAlpha: 0.92 });
          }
        }
      },
      line(a, b, colStr, wPx) {
        const pa = proj(a), pb = proj(b); if (!pa || !pb) return;
        q.push({ t: 1, z: (pa[2]+pb[2])*0.5, pa, pb, col: colStr, w: wPx || 2 });
      },
      orb(pt, rWorld, colHex, alpha) {
        const pr = proj(pt); if (!pr) return;
        const rPx = (rWorld * focal) / pr[2]; if (rPx < 0.6) return;
        q.push({ t: 2, z: pr[2], x: pr[0], y: pr[1], r: rPx, rgb: parseHexRGB(colHex, [255, 224, 155]), a: alpha === undefined ? 0.85 : alpha });
      },
      render(c, S) {
        q.sort((a, b) => b.z - a.z);
        c.save(); c.lineJoin = "round"; c.lineCap = "round";
        for (let i = 0; i < q.length; i++) {
          const it = q[i];
          if (it.t === 0 || it.t === 3) {
            c.beginPath(); c.moveTo(it.ps[0][0], it.ps[0][1]);
            for (let k = 1; k < it.ps.length; k++) c.lineTo(it.ps[k][0], it.ps[k][1]);
            c.closePath();
            if (it.t === 3) {
              const pA = it.ps[it.gA], pB = it.ps[it.gB];
              const g = c.createLinearGradient(pA[0], pA[1], pB[0], pB[1]);
              g.addColorStop(0, it.cA); g.addColorStop(1, it.cB); c.fillStyle = g;
            } else c.fillStyle = it.cA;
            c.fill(); c.strokeStyle = it.st; c.lineWidth = Math.max(0.55, 0.8 * S); c.stroke();
          } else if (it.t === 1) {
            c.strokeStyle = it.col; c.lineWidth = it.w; c.beginPath(); c.moveTo(it.pa[0], it.pa[1]); c.lineTo(it.pb[0], it.pb[1]); c.stroke();
          } else {
            const g = c.createRadialGradient(it.x, it.y, 0, it.x, it.y, it.r * 2.8);
            g.addColorStop(0, rgbStr([255, 252, 240], it.a)); g.addColorStop(0.28, rgbStr(it.rgb, it.a * 0.72));
            g.addColorStop(0.65, rgbStr(it.rgb, it.a * 0.16)); g.addColorStop(1, rgbStr(it.rgb, 0));
            c.fillStyle = g; c.beginPath(); c.arc(it.x, it.y, it.r * 2.8, 0, Math.PI * 2); c.fill();
          }
        }
        c.restore();
      }
    };
    return scene;
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
