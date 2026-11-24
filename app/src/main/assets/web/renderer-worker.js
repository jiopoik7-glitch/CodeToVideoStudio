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

// Micro 3D Engine v2 dengan Z-Buffer Scene Builder & 3-Point PBR Lighting
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

    const shade = (rgb, n, vDir, specPow) => {
      const dk = Math.max(0, d3.dot(n, lKey));
      const df = Math.max(0, d3.dot(n, lFill));
      const dr = Math.max(0, d3.dot(n, lRim));
      const fr = Math.pow(1 - Math.max(0, d3.dot(n, vDir)), 2.5);
      let sp = 0;
      if (specPow > 0) {
        const hv = d3.norm([lKey[0]+vDir[0], lKey[1]+vDir[1], lKey[2]+vDir[2]]);
        sp = Math.pow(Math.max(0, d3.dot(n, hv)), specPow) * 0.30;
      }
      const lit = 0.34 + dk * 0.70 + df * 0.16;
      const rim = (dr * 0.26 + fr * 0.24) * 0.24;
      return [rgb[0]*lit + 255*sp + 170*rim, rgb[1]*lit + 248*sp + 225*rim, rgb[2]*lit + 240*sp + 210*rim];
    };

    return {
      project: proj,
      poly(verts, colHex, opts) {
        const o = opts || {};
        const n = verts.length, ps = [];
        let sz = 0, cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < n; i++) {
          const pr = proj(verts[i]);
          if (!pr) return;
          ps.push(pr); sz += pr[2];
          cx += verts[i][0]; cy += verts[i][1]; cz += verts[i][2];
        }
        const ctr = [cx/n, cy/n, cz/n];
        let norm = d3.norm(d3.cross(d3.sub(verts[1], verts[0]), d3.sub(verts[2], verts[0])));
        const vDir = d3.norm(d3.sub(eye, ctr));
        if (d3.dot(norm, vDir) <= 0) {
          if (!o.twoSided) return;
          norm = [-norm[0], -norm[1], -norm[2]];
        }
        const cA = shade(parseHexRGB(colHex, [220, 60, 85]), norm, vDir, o.spec || 18);
        const cB = o.col2 ? shade(parseHexRGB(o.col2, cA), norm, vDir, (o.spec || 18) * 1.1) : null;
        q.push({
          t: cB ? 3 : 0, z: sz/n + (o.zBias || 0), ps,
          cA: rgbStr(cA, o.alpha), cB: cB ? rgbStr(cB, o.alpha) : null,
          gA: o.gA || 0, gB: o.gB !== undefined ? o.gB : Math.min(2, n - 1),
          st: rgbStr([cA[0]*0.88, cA[1]*0.88, cA[2]*0.88], o.alpha === undefined ? 0.85 : o.alpha * 0.85)
        });
      },
      line(a, b, colStr, wPx) {
        const pa = proj(a), pb = proj(b);
        if (!pa || !pb) return;
        q.push({ t: 1, z: (pa[2]+pb[2])*0.5, pa, pb, col: colStr, w: wPx || 2 });
      },
      orb(pt, rWorld, colHex, alpha) {
        const pr = proj(pt);
        if (!pr) return;
        const rPx = (rWorld * focal) / pr[2];
        if (rPx < 0.6) return;
        const rgb = parseHexRGB(colHex, [255, 220, 140]);
        q.push({ t: 2, z: pr[2], x: pr[0], y: pr[1], r: rPx, col: rgbStr(rgb, alpha), glow: rgbStr(rgb, (alpha || 1) * 0.25) });
      },
      render(c, S) {
        q.sort((a, b) => b.z - a.z);
        c.save();
        c.lineJoin = "round"; c.lineCap = "round";
        for (let i = 0; i < q.length; i++) {
          const it = q[i];
          if (it.t === 0 || it.t === 3) {
            c.beginPath();
            c.moveTo(it.ps[0][0], it.ps[0][1]);
            for (let k = 1; k < it.ps.length; k++) c.lineTo(it.ps[k][0], it.ps[k][1]);
            c.closePath();
            if (it.t === 3) {
              const pA = it.ps[it.gA], pB = it.ps[it.gB];
              const g = c.createLinearGradient(pA[0], pA[1], pB[0], pB[1]);
              g.addColorStop(0, it.cA); g.addColorStop(1, it.cB);
              c.fillStyle = g;
            } else c.fillStyle = it.cA;
            c.fill();
            c.strokeStyle = it.st;
            c.lineWidth = Math.max(0.6, 0.85 * S);
            c.stroke();
          } else if (it.t === 1) {
            c.strokeStyle = it.col; c.lineWidth = it.w;
            c.beginPath(); c.moveTo(it.pa[0], it.pa[1]); c.lineTo(it.pb[0], it.pb[1]); c.stroke();
          } else {
            c.fillStyle = it.glow; c.beginPath(); c.arc(it.x, it.y, it.r * 2.4, 0, Math.PI * 2); c.fill();
            c.fillStyle = it.col; c.beginPath(); c.arc(it.x, it.y, it.r, 0, Math.PI * 2); c.fill();
          }
        }
        c.restore();
      }
    };
  }
});

function makeUiApi(S) {
  const rrectFn = (c, x, y, w, h, r) => {
    const rr = Math.max(0, Math.min(r || 0, w * 0.5, h * 0.5));
    c.beginPath();
    c.moveTo(x + rr, y);
    c.lineTo(x + w - rr, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rr);
    c.lineTo(x + w, y + h - rr);
    c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    c.lineTo(x + rr, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rr);
    c.lineTo(x, y + rr);
    c.quadraticCurveTo(x, y, x + rr, y);
    c.closePath();
  };

  const drawGlassBase = (c, x, y, w, h, r, opts) => {
    const o = opts || {};
    const light = !!o.light;
    const rad = r !== undefined ? r : 28 * S;
    const sweep = o.sweep !== undefined ? o.sweep : -1;

    c.save();
    c.shadowColor = light ? "rgba(18, 28, 42, 0.14)" : "rgba(0, 0, 0, 0.42)";
    c.shadowBlur = 38 * S;
    c.shadowOffsetY = 14 * S;
    const bg = c.createLinearGradient(x, y, x, y + h);
    if (light) {
      bg.addColorStop(0, "rgba(255, 255, 255, 0.84)");
      bg.addColorStop(0.55, "rgba(246, 249, 254, 0.64)");
      bg.addColorStop(1, "rgba(255, 255, 255, 0.74)");
    } else {
      bg.addColorStop(0, "rgba(255, 255, 255, 0.16)");
      bg.addColorStop(0.5, "rgba(255, 255, 255, 0.06)");
      bg.addColorStop(1, "rgba(255, 255, 255, 0.11)");
    }
    c.fillStyle = bg;
    rrectFn(c, x, y, w, h, rad);
    c.fill();
    c.restore();

    // Specular sheen + moving liquid reflection
    c.save();
    rrectFn(c, x, y, w, h, rad);
    c.clip();
    const sheen = c.createLinearGradient(x, y, x + w * 0.45, y + h * 0.55);
    sheen.addColorStop(0, light ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = sheen;
    c.fillRect(x, y, w, h * 0.50);

    if (sweep >= 0) {
      const sx = lerpNum(x - w * 0.5, x + w * 1.5, sweep % 1);
      const beam = c.createLinearGradient(sx - w * 0.25, y, sx + w * 0.25, y + h);
      beam.addColorStop(0, "rgba(255,255,255,0)");
      beam.addColorStop(0.5, light ? "rgba(255,255,255,0.55)" : "rgba(210,235,255,0.22)");
      beam.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = beam;
      c.fillRect(x, y, w, h);
    }
    c.restore();

    // Chromatic iOS 26 specular border rim
    c.save();
    const rim = c.createLinearGradient(x, y, x + w, y + h);
    if (o.chromatic !== false) {
      rim.addColorStop(0, light ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.55)");
      rim.addColorStop(0.35, light ? "rgba(165,212,255,0.45)" : "rgba(155,210,255,0.24)");
      rim.addColorStop(0.7, light ? "rgba(255,195,220,0.30)" : "rgba(255,255,255,0.12)");
      rim.addColorStop(1, light ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.38)");
    } else {
      rim.addColorStop(0, light ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.42)");
      rim.addColorStop(1, light ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.26)");
    }
    c.strokeStyle = rim;
    c.lineWidth = Math.max(1.3, 2.2 * S);
    rrectFn(c, x, y, w, h, rad);
    c.stroke();
    c.restore();
  };

  return Object.freeze({
    clamp: clampNum,
    lerp: lerpNum,
    seg: (val, a, b) => clampNum((val - a) / Math.max(0.0001, b - a), 0, 1),
    rgba(hex, alpha) {
      const c = parseHexRGB(hex, [17, 24, 20]);
      return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + clampNum(alpha, 0, 1) + ")";
    },
    mixColor(h1, h2, u) {
      const a = parseHexRGB(h1, [15, 23, 42]);
      const b = parseHexRGB(h2, [235, 240, 246]);
      const k = clampNum(u, 0, 1);
      return "rgb(" + Math.round(lerpNum(a[0],b[0],k)) + "," + Math.round(lerpNum(a[1],b[1],k)) + "," + Math.round(lerpNum(a[2],b[2],k)) + ")";
    },
    rrect: rrectFn,
    wrapText(c, text, maxW) {
      const words = String(text || "").trim().split(/\s+/).filter(Boolean);
      if (!words.length) return [""];
      const out = [];
      let cur = words[0];
      for (let i = 1; i < words.length; i++) {
        const nxt = cur + " " + words[i];
        if (c.measureText(nxt).width <= maxW) cur = nxt;
        else { out.push(cur); cur = words[i]; }
      }
      out.push(cur);
      return out;
    },
    drawGlow(c, x, y, r, hex, alpha) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const rgb = parseHexRGB(hex, [220, 230, 242]);
      g.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + clampNum(alpha, 0, 1) + ")");
      g.addColorStop(0.55, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + clampNum(alpha * 0.25, 0, 1) + ")");
      g.addColorStop(1, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0)");
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    },
    drawMeshBg(c, W, H, baseHex, orbs, tSec) {
      c.fillStyle = baseHex || "#0B0E14";
      c.fillRect(0, 0, W, H);
      const list = orbs || [
        { x: 0.82, y: 0.18, r: 0.72, col: "#9EB6D4", a: 0.28 },
        { x: 0.16, y: 0.80, r: 0.68, col: "#E5EAF0", a: 0.18 }
      ];
      const sh = Math.min(W, H);
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        const ox = W * o.x + Math.sin((tSec || 0) * (0.6 + i * 0.2) + i) * 38 * S;
        const oy = H * o.y + Math.cos((tSec || 0) * (0.5 + i * 0.25) + i) * 32 * S;
        const g = c.createRadialGradient(ox, oy, 0, ox, oy, sh * (o.r || 0.65));
        const rgb = parseHexRGB(o.col, [200, 212, 226]);
        g.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + clampNum(o.a || 0.24, 0, 1) + ")");
        g.addColorStop(0.58, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + clampNum((o.a || 0.24) * 0.22, 0, 1) + ")");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
      }
    },
    drawGlassCard: drawGlassBase,
    drawLiquidGlass: drawGlassBase,
    drawWaterDrop(c, cx, cy, r, colHex) {
      const rgb = parseHexRGB(colHex, [220, 238, 255]);
      c.save();
      const g = c.createRadialGradient(cx - r * 0.28, cy - r * 0.28, r * 0.08, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,0.85)");
      g.addColorStop(0.35, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.35)");
      g.addColorStop(0.85, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.12)");
      g.addColorStop(1, "rgba(255,255,255,0.65)");
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(255,255,255,0.92)";
      c.beginPath(); c.ellipse(cx - r * 0.30, cy - r * 0.30, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); c.fill();
      c.restore();
    },
    drawPill(c, x, y, label, bgCol, txtCol, fontSize) {
      const f = fontSize || Math.max(12, Math.round(22 * S));
      c.save();
      c.font = "700 " + f + "px sans-serif";
      const pw = c.measureText(String(label)).width + 32 * S;
      const ph = f + 18 * S;
      c.fillStyle = bgCol || "rgba(255,255,255,0.14)";
      rrectFn(c, x, y, pw, ph, ph * 0.5);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.34)";
      c.lineWidth = Math.max(1, 1.4 * S);
      c.stroke();
      c.fillStyle = txtCol || "#FFFFFF";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(String(label), x + pw * 0.5, y + ph * 0.52);
      c.restore();
      return { w: pw, h: ph };
    },
    drawProgressBar(c, x, y, w, h, frac, col, trackCol) {
      c.save();
      c.fillStyle = trackCol || "rgba(255,255,255,0.12)";
      rrectFn(c, x, y, w, h, h * 0.5);
      c.fill();
      const fw = Math.max(h, w * clampNum(frac, 0, 1));
      c.fillStyle = col || "#FFFFFF";
      rrectFn(c, x, y, fw, h, h * 0.5);
      c.fill();
      c.restore();
    },
    drawRing(c, cx, cy, rad, frac, col, label, bgCol, txtCol, lw) {
      c.save();
      c.lineWidth = lw || Math.max(3, 5.5 * S);
      c.lineCap = "round";
      c.strokeStyle = bgCol || "rgba(255,255,255,0.12)";
      c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.stroke();
      if (frac > 0.005) {
        c.strokeStyle = col;
        c.beginPath();
        c.arc(cx, cy, rad, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * clampNum(frac, 0, 1));
        c.stroke();
      }
      if (label !== undefined && label !== null && label !== "") {
        c.fillStyle = txtCol || "#FFFFFF";
        c.font = "800 " + Math.max(11, Math.round(rad * 0.52)) + "px sans-serif";
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(String(label), cx, cy + 1 * S);
      }
      c.restore();
    },
    // Fixed descender clip headroom (g, y, p, j tidak pernah terpotong!)
    drawRichText(c, tokens, x, y, maxW, fontSize, lineH, baseCol, prog, align) {
      const getFont = (tk) => tk.italic
        ? ("italic 500 " + Math.round(fontSize * 1.06) + "px Georgia, serif")
        : ("800 " + fontSize + "px sans-serif");
      c.font = "800 " + fontSize + "px sans-serif";
      const spW = c.measureText(" ").width;
      const words = [];
      for (let i = 0; i < tokens.length; i++) {
        const tk = tokens[i];
        const parts = String(tk.text || "").split(/\s+/).filter(Boolean);
        for (let j = 0; j < parts.length; j++) {
          const f = getFont(tk);
          c.font = f;
          words.push({ text: parts[j], italic: !!tk.italic, color: tk.color || baseCol, font: f, w: c.measureText(parts[j]).width });
        }
      }
      const lines = [];
      let line = [], lw = 0;
      for (let i = 0; i < words.length; i++) {
        const wd = words[i];
        const add = line.length ? spW + wd.w : wd.w;
        if (line.length && lw + add > maxW) { lines.push({ items: line, width: lw }); line = [wd]; lw = wd.w; }
        else { line.push(wd); lw += add; }
      }
      if (line.length) lines.push({ items: line, width: lw });
      c.textBaseline = "top";
      c.textAlign = "left";
      const descPad = fontSize * 0.36;
      for (let li = 0; li < lines.length; li++) {
        const ln = lines[li];
        const lp = ease.snap(clampNum((prog - li * 0.13) / 0.72, 0, 1));
        if (lp <= 0.008) continue;
        const ly = y + li * lineH;
        const sx = align === "center" ? x - ln.width * 0.5 : x;
        c.save();
        c.beginPath();
        c.rect(sx - 24 * S, ly - fontSize * 0.18, ln.width + 54 * S, lineH + descPad);
        c.clip();
        c.globalAlpha *= lp;
        let cx = sx;
        for (let wi = 0; wi < ln.items.length; wi++) {
          const it = ln.items[wi];
          c.font = it.font;
          c.fillStyle = it.color;
          c.fillText(it.text, cx, ly + (1 - lp) * lineH * 0.80 + (it.italic ? -fontSize * 0.03 : 0));
          cx += it.w + spW;
        }
        c.restore();
      }
      return lines.length * lineH;
    },
    drawGrain(c, W, H, randFn, count, alpha) {
      c.save();
      c.fillStyle = "rgba(255,255,255," + clampNum(alpha || 0.04, 0, 1) + ")";
      const n = Math.min(count || 90, 200);
      for (let i = 0; i < n; i++) {
        const gx = randFn(i * 3 + 701) * W;
        const gy = randFn(i * 3 + 702) * H;
        const gs = (0.8 + randFn(i * 3 + 703) * 1.4) * S;
        c.fillRect(gx, gy, gs, gs);
      }
      c.restore();
    }
  });
}

// =======================================================
// MOTION DIRECTOR FX SUITE v0.4 (Transitions, Kinetic Text, Particles, Charts)
// =======================================================
function makeFxApi(W, H, S, t, frame, fps, rand, ui) {
  const transition = Object.freeze({
    whipPan(c, u, drawA, drawB, accentCol) {
      const k = ease.whip(u);
      c.save(); c.translate(-k * W * 0.35, 0); drawA(k); c.restore();
      c.save();
      c.beginPath(); c.rect(W * (1 - k), 0, W * k + 2, H); c.clip();
      c.translate((1 - k) * W * 0.35, 0); drawB(k);
      c.restore();
      if (accentCol) { c.fillStyle = accentCol; c.fillRect(W * (1 - k) - 3 * S, 0, 6 * S, H); }
    },
    craneSweep(c, u, drawA, drawB, accentCol) {
      const k = ease.whip(u);
      const cutY = H * (1 - k);
      c.save(); c.translate(0, -k * H * 0.18); drawA(k); c.restore();
      c.save();
      c.beginPath(); c.rect(0, cutY, W, H - cutY + 2); c.clip();
      c.translate(0, (1 - k) * H * 0.18); drawB(k);
      c.restore();
      if (accentCol) { c.fillStyle = accentCol; c.fillRect(0, cutY - 3 * S, W, 6 * S); }
    },
    irisPortal(c, u, drawA, drawB, cx, cy, ringCol) {
      const k = ease.whip(u);
      const ox = cx !== undefined ? cx : W * 0.5;
      const oy = cy !== undefined ? cy : H * 0.5;
      const r = Math.hypot(W, H) * 1.05 * k;
      drawA(k);
      c.save();
      c.beginPath(); c.arc(ox, oy, r, 0, Math.PI * 2); c.clip();
      drawB(k);
      c.restore();
      if (ringCol) {
        c.save(); c.strokeStyle = ui.rgba(ringCol, (1 - k) * 0.85); c.lineWidth = Math.max(3, 8 * S);
        c.beginPath(); c.arc(ox, oy, r, 0, Math.PI * 2); c.stroke(); c.restore();
      }
    },
    glassSlide(c, u, drawA, drawB) {
      const k = ease.liquid(u);
      c.save(); c.translate(-k * W * 0.25, 0); drawA(k); c.restore();
      const x = W * (1 - k);
      c.save();
      c.beginPath(); ui.rrect(c, x, 0, W + 40 * S, H, 38 * S * (1 - k)); c.clip();
      drawB(k);
      c.restore();
      c.save();
      c.strokeStyle = "rgba(255,255,255," + (0.65 * Math.sin(k * Math.PI)) + ")";
      c.lineWidth = 4 * S;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
      c.restore();
    },
    zoomThrough(c, u, drawA, drawB) {
      const k = ease.whip(u);
      c.save();
      const sA = 1 + k * 0.55;
      c.translate(W * 0.5, H * 0.5); c.scale(sA, sA); c.translate(-W * 0.5, -H * 0.5);
      drawA(k); c.restore();
      if (k > 0.15) {
        const kb = clampNum((k - 0.15) / 0.85, 0, 1);
        c.save();
        c.beginPath(); c.arc(W * 0.5, H * 0.5, Math.hypot(W, H) * 0.85 * kb, 0, Math.PI * 2); c.clip();
        const sB = lerpNum(0.86, 1.0, kb);
        c.translate(W * 0.5, H * 0.5); c.scale(sB, sB); c.translate(-W * 0.5, -H * 0.5);
        drawB(kb); c.restore();
      }
    },
    splitShutter(c, u, drawA, drawB, accentCol) {
      const k = ease.whip(u);
      drawB(k);
      const half = H * 0.5 * (1 - k);
      if (half > 1) {
        c.save(); c.beginPath(); c.rect(0, 0, W, half); c.clip(); drawA(k); c.restore();
        c.save(); c.beginPath(); c.rect(0, H - half, W, half); c.clip(); drawA(k); c.restore();
        if (accentCol) {
          c.fillStyle = accentCol;
          c.fillRect(0, half - 2 * S, W, 4 * S);
          c.fillRect(0, H - half - 2 * S, W, 4 * S);
        }
      }
    },
    liquidWipe(c, u, drawA, drawB) {
      const k = ease.liquid(u);
      drawA(k);
      const baseX = W * (1 - k);
      c.save();
      c.beginPath();
      c.moveTo(W + 10, 0);
      c.lineTo(W + 10, H);
      for (let i = 20; i >= 0; i--) {
        const ry = (i / 20) * H;
        const wave = Math.sin(i * 0.55 + k * 7) * 65 * S * Math.sin(k * Math.PI);
        c.lineTo(baseX + wave, ry);
      }
      c.closePath();
      c.clip();
      drawB(k);
      c.restore();
    },
    cardFlip3D(c, u, drawA, drawB) {
      const k = ease.whip(u);
      const sx = Math.max(0.02, Math.abs(Math.cos(k * Math.PI)));
      c.save();
      c.translate(W * 0.5, H * 0.5);
      c.scale(sx, 1 - Math.sin(k * Math.PI) * 0.06);
      c.translate(-W * 0.5, -H * 0.5);
      if (k < 0.5) drawA(k * 2); else drawB((k - 0.5) * 2);
      c.restore();
    }
  });

  const text = Object.freeze({
    wordStagger(c, str, x, y, maxW, fontSize, col, startFrame, align) {
      const words = String(str || "").trim().split(/\s+/).filter(Boolean);
      c.font = "800 " + fontSize + "px sans-serif";
      const spW = c.measureText(" ").width;
      const lineH = fontSize * 1.18;
      const lines = [];
      let ln = [], lw = 0;
      for (let i = 0; i < words.length; i++) {
        const ww = c.measureText(words[i]).width;
        const add = ln.length ? spW + ww : ww;
        if (ln.length && lw + add > maxW) { lines.push({ items: ln, w: lw }); ln = [{ t: words[i], w: ww, idx: i }]; lw = ww; }
        else { ln.push({ t: words[i], w: ww, idx: i }); lw += add; }
      }
      if (ln.length) lines.push({ items: ln, w: lw });
      c.textBaseline = "top"; c.textAlign = "left"; c.fillStyle = col || "#FFFFFF";
      for (let li = 0; li < lines.length; li++) {
        let cx = align === "center" ? x - lines[li].w * 0.5 : x;
        const ly = y + li * lineH;
        for (let wi = 0; wi < lines[li].items.length; wi++) {
          const it = lines[li].items[wi];
          const sp = spring({ frame: frame - (startFrame || 0) - it.idx * Math.max(2, Math.round(fps * 0.06)), fps, config: { damping: 14, stiffness: 170 } });
          if (sp > 0.01) {
            c.save();
            c.globalAlpha *= clampNum(sp * 1.25, 0, 1);
            c.fillText(it.t, cx, ly + (1 - sp) * fontSize * 0.65);
            c.restore();
          }
          cx += it.w + spW;
        }
      }
      return lines.length * lineH;
    },
    charWave(c, str, x, y, fontSize, col, amp, speed, align) {
      const s = String(str || "");
      c.font = "800 " + fontSize + "px sans-serif";
      const totalW = c.measureText(s).width;
      let cx = align === "center" ? x - totalW * 0.5 : x;
      c.fillStyle = col || "#FFFFFF"; c.textBaseline = "top"; c.textAlign = "left";
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const dy = Math.sin(t * (speed || 4.2) + i * 0.48) * (amp || 10 * S);
        c.fillText(ch, cx, y + dy);
        cx += c.measureText(ch).width;
      }
    },
    counterRoll(c, val, x, y, fontSize, col, suffix, align) {
      const v = Math.max(0, Number(val || 0));
      const base = Math.floor(v);
      const frac = v - base;
      const txtA = String(base) + (suffix || "");
      const txtB = String(base + 1) + (suffix || "");
      c.save();
      c.font = "800 " + fontSize + "px sans-serif";
      const mw = Math.max(c.measureText(txtA).width, c.measureText(txtB).width) + 20 * S;
      const sx = align === "center" ? x - mw * 0.5 : (align === "right" ? x - mw : x);
      c.beginPath(); c.rect(sx, y - fontSize * 0.12, mw, fontSize * 1.25); c.clip();
      c.fillStyle = col || "#FFFFFF"; c.textAlign = align || "left"; c.textBaseline = "top";
      const k = ease.ios(frac);
      c.globalAlpha *= (1 - k * 0.6);
      c.fillText(txtA, x, y - k * fontSize * 1.15);
      if (frac > 0.01) {
        c.globalAlpha = clampNum(k * 1.2, 0, 1);
        c.fillText(txtB, x, y + (1 - k) * fontSize * 1.15);
      }
      c.restore();
    },
    highlightSweep(c, str, x, y, fontSize, bgCol, txtCol, prog, align) {
      c.save();
      c.font = "800 " + fontSize + "px sans-serif";
      const tw = c.measureText(String(str)).width;
      const padX = 18 * S, padY = 8 * S;
      const bw = tw + padX * 2, bh = fontSize * 1.24 + padY * 2;
      const sx = align === "center" ? x - bw * 0.5 : x;
      const k = ease.snap(prog);
      c.fillStyle = bgCol || "#23C483";
      ui.rrect(c, sx, y - padY, bw * k, bh, 14 * S);
      c.fill();
      c.fillStyle = txtCol || "#0A1014";
      c.textAlign = "left"; c.textBaseline = "top";
      c.fillText(String(str), sx + padX, y + fontSize * 0.06);
      c.restore();
    },
    typewriter(c, str, x, y, fontSize, col, prog, showCursor) {
      const s = String(str || "");
      const count = Math.round(clampNum(prog, 0, 1) * s.length);
      const sub = s.slice(0, count);
      c.save();
      c.font = "700 " + fontSize + "px monospace, sans-serif";
      c.fillStyle = col || "#FFFFFF"; c.textAlign = "left"; c.textBaseline = "top";
      c.fillText(sub, x, y);
      if (showCursor !== false && Math.floor(t * 2.5) % 2 === 0) {
        const w = c.measureText(sub).width;
        c.fillRect(x + w + 4 * S, y + 2 * S, Math.max(3, fontSize * 0.12), fontSize * 1.05);
      }
      c.restore();
    },
    kineticMask(c, str, x, y, fontSize, col, prog, align) {
      const k = ease.snap(prog);
      c.save();
      c.font = "800 " + fontSize + "px sans-serif";
      const w = c.measureText(String(str)).width + 24 * S;
      const sx = align === "center" ? x - w * 0.5 : x;
      c.beginPath(); c.rect(sx, y - fontSize * 0.15, w, fontSize * 1.45); c.clip();
      c.fillStyle = col || "#FFFFFF"; c.textAlign = align || "left"; c.textBaseline = "top";
      c.globalAlpha *= k;
      c.fillText(String(str), x, y + (1 - k) * fontSize * 1.05);
      c.restore();
    }
  });

  const particles = Object.freeze({
    bokeh(c, count, colHex, alpha) {
      const n = Math.min(count || 16, 40);
      const rgb = parseHexRGB(colHex, [210, 232, 255]);
      for (let i = 0; i < n; i++) {
        const px = rand(800 + i * 3) * W + Math.sin(t * (0.5 + (i % 3) * 0.2) + i) * 32 * S;
        const py = ((rand(801 + i * 3) * H - t * (16 + (i % 4) * 8) * S) % (H + 80 * S) + H + 80 * S) % (H + 80 * S) - 40 * S;
        const r = (10 + rand(802 + i * 3) * 28) * S;
        c.fillStyle = rgbStr(rgb, (alpha || 0.16) * (0.45 + 0.55 * Math.sin(t + i)));
        c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
      }
    },
    petals(c, count, colHex, alpha) {
      const n = Math.min(count || 14, 36);
      const rgb = parseHexRGB(colHex, [226, 68, 92]);
      for (let i = 0; i < n; i++) {
        const px = ((rand(850 + i * 3) * W + Math.sin(t * 1.2 + i) * 45 * S) % W + W) % W;
        const py = ((rand(851 + i * 3) * H + t * (32 + (i % 4) * 14) * S) % (H + 60 * S)) - 30 * S;
        const sz = (7 + rand(852 + i * 3) * 11) * S;
        c.save(); c.translate(px, py); c.rotate(t * (0.8 + (i % 3) * 0.3) + i);
        c.fillStyle = rgbStr(rgb, alpha || 0.32);
        c.beginPath(); c.ellipse(0, 0, sz * 1.4, sz * 0.65, 0.25, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    },
    confetti(c, count, colors, prog) {
      const cols = colors || ["#FF6B6B", "#FFD166", "#23C483", "#64B5F6", "#FFFFFF"];
      const n = Math.min(count || 20, 48);
      const vis = clampNum(prog === undefined ? 1 : prog, 0, 1);
      if (vis <= 0.01) return;
      for (let i = 0; i < n; i++) {
        const u = ((t * (0.28 + (i % 3) * 0.08) + rand(900 + i)) % 1);
        const cx = rand(940 + i) * W + Math.sin(t * 3 + i) * 28 * S;
        const cy = lerpNum(-20 * S, H + 20 * S, u);
        const sz = (7 + rand(980 + i) * 8) * S;
        c.save(); c.translate(cx, cy); c.rotate(t * (2.2 + (i % 3)) + i);
        c.globalAlpha *= vis;
        c.fillStyle = cols[i % cols.length];
        ui.rrect(c, -sz * 0.6, -sz * 0.32, sz * 1.2, sz * 0.64, 2 * S); c.fill();
        c.restore();
      }
    },
    sparkles(c, count, colHex, alpha) {
      const n = Math.min(count || 14, 36);
      const col = colHex || "#FFF4CC";
      for (let i = 0; i < n; i++) {
        const px = rand(1020 + i * 3) * W;
        const py = rand(1021 + i * 3) * H;
        const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * (2.6 + (i % 3)) + i * 1.7), 3);
        const r = (4 + rand(1022 + i * 3) * 10) * S * pulse;
        if (r < 0.8) continue;
        c.save(); c.translate(px, py); c.rotate(t * 0.6 + i);
        c.globalAlpha *= (alpha || 0.85) * pulse;
        c.fillStyle = col;
        c.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          c.lineTo(Math.cos(a + Math.PI / 4) * r * 0.25, Math.sin(a + Math.PI / 4) * r * 0.25);
        }
        c.closePath(); c.fill(); c.restore();
      }
    }
  });

  const chart = Object.freeze({
    spline(c, values, x, y, w, h, col, prog) {
      if (!values || values.length < 2) return;
      const k = ease.apple(prog === undefined ? 1 : prog);
      const minV = Math.min(...values), maxV = Math.max(...values);
      const span = Math.max(0.0001, maxV - minV);
      const pts = values.map((v, i) => [
        x + (i / (values.length - 1)) * w,
        y + h - ((v - minV) / span) * h
      ]);
      c.save();
      c.beginPath(); c.rect(x - 10 * S, y - 20 * S, (w + 20 * S) * k, h + 40 * S); c.clip();
      const grad = c.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, ui.rgba(col, 0.32)); grad.addColorStop(1, ui.rgba(col, 0));
      c.beginPath(); c.moveTo(pts[0][0], y + h); c.lineTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) * 0.5;
        const my = (pts[i][1] + pts[i + 1][1]) * 0.5;
        c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      c.lineTo(pts[pts.length - 1][0], y + h); c.closePath();
      c.fillStyle = grad; c.fill();

      c.strokeStyle = col; c.lineWidth = Math.max(2.5, 4.5 * S); c.lineCap = "round";
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) * 0.5;
        const my = (pts[i][1] + pts[i + 1][1]) * 0.5;
        c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); c.stroke();
      c.restore();
    },
    bars(c, items, x, y, w, h, startFrame) {
      if (!items || !items.length) return;
      const gap = 18 * S;
      const bw = (w - gap * (items.length - 1)) / items.length;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const sp = spring({ frame: frame - (startFrame || 0) - i * 4, fps, config: { damping: 14, stiffness: 140 } });
        const bh = Math.max(8 * S, h * clampNum(it.value || 0, 0, 1) * clampNum(sp, 0, 1.1));
        const bx = x + i * (bw + gap);
        const by = y + h - bh;
        c.fillStyle = it.color || "#66E3D1";
        ui.rrect(c, bx, by, bw, bh, 12 * S); c.fill();
        if (it.label) {
          c.fillStyle = "rgba(255,255,255,0.75)";
          c.font = "700 " + Math.max(10, Math.round(18 * S)) + "px sans-serif";
          c.textAlign = "center"; c.textBaseline = "top";
          c.fillText(String(it.label), bx + bw * 0.5, y + h + 10 * S);
        }
      }
    }
  });

  return Object.freeze({
    stagger(frameVal, index, delayFrames, cfg) {
      const df = delayFrames !== undefined ? delayFrames : Math.max(3, Math.round(fps * 0.12));
      return spring({ frame: frameVal - index * df, fps, config: cfg || { damping: 14, stiffness: 160 } });
    },
    scene(pVal, start, end) {
      const sp = clampNum((pVal - start) / Math.max(0.0001, end - start), 0, 1);
      return { p: sp, in: ease.snap(clampNum(sp / 0.18, 0, 1)), out: 1 - ease.whip(clampNum((sp - 0.85) / 0.15, 0, 1)), active: pVal >= start && pVal <= end };
    },
    transition,
    text,
    particles,
    chart
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
  ctx.clearRect(0, 0, W, H);

  const S = Math.min(W, H) / 1080;
  const t = frame / fps;
  const p = frame / Math.max(totalFrames - 1, 1);
  const P = Object.freeze(message.props || {});
  const rand = (index) => seededRandom(message.seed | 0, index | 0);
  const cam = makeCameraApi(W, H);
  const ui = makeUiApi(S);
  const fx = makeFxApi(W, H, S, t, frame, fps, rand, ui);

  const body = new Function(
    "ctx", "W", "H", "S", "t", "D", "p", "frame", "fps", "P", "ease", "rand",
    "spring", "interpolate", "bezier", "cam", "ui", "fx", "d3",
    "globalThis", "self", "fetch", "XMLHttpRequest", "WebSocket", "importScripts",
    "indexedDB", "caches", "BroadcastChannel", "Worker", "WebAssembly", "setTimeout",
    "setInterval", "requestAnimationFrame", "document", "window",
    '"use strict";\n' + message.sourceBody
  );
  body(ctx, W, H, S, t, D, p, frame, fps, P, ease, rand, spring, interpolate, bezier, cam, ui, fx, d3);

  if (message.mode === "preview") {
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage({ type: "previewFrame", frame, width: W, height: H, image: bitmap }, [bitmap]);
  } else {
    const pixels = ctx.getImageData(0, 0, W, H).data;
    const buffer = pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + pixels.byteLength);
    self.postMessage({ type: "frameBuffer", frame, token: message.token, buffer }, [buffer]);
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
