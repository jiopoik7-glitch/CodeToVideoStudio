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
