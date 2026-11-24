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
  ios: bezier(0.25, 0.9, 0.3, 1.0)
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
  const clean = String(hex || "").trim().replace(/^#/, "");
  const full = clean.length === 3 ? clean[0]+clean[0]+clean[1]+clean[1]+clean[2]+clean[2] : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fb || [235, 240, 246];
  return [parseInt(full.slice(0,2),16), parseInt(full.slice(2,4),16), parseInt(full.slice(4,6),16)];
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

function makeFxApi(fps) {
  return Object.freeze({
    stagger(frameVal, index, delayFrames, cfg) {
      const df = delayFrames !== undefined ? delayFrames : Math.max(3, Math.round(fps * 0.12));
      return spring({ frame: frameVal - index * df, fps, config: cfg || { damping: 14, stiffness: 160 } });
    },
    scene(pVal, start, end) {
      const sp = clampNum((pVal - start) / Math.max(0.0001, end - start), 0, 1);
      return {
        p: sp,
        in: ease.snap(clampNum(sp / 0.18, 0, 1)),
        out: 1 - ease.whip(clampNum((sp - 0.85) / 0.15, 0, 1)),
        active: pVal >= start && pVal <= end
      };
    }
  });
}

// Micro 3D Engine bawaan untuk visual 3D sinematik ringkas
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
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    },
    // Latar Mesh Fluid ala iOS Wallpaper
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
    // Kartu iOS Liquid Glass dengan pantulan cermin atas & specular rim
    drawGlassCard(c, x, y, w, h, r, opts) {
      const o = opts || {};
      const light = !!o.light;
      const rad = r !== undefined ? r : 28 * S;
      c.save();
      c.shadowColor = light ? "rgba(18, 26, 36, 0.12)" : "rgba(0, 0, 0, 0.36)";
      c.shadowBlur = 34 * S;
      c.shadowOffsetY = 14 * S;
      const bg = c.createLinearGradient(x, y, x, y + h);
      if (light) {
        bg.addColorStop(0, "rgba(255, 255, 255, 0.78)");
        bg.addColorStop(1, "rgba(244, 247, 252, 0.56)");
      } else {
        bg.addColorStop(0, "rgba(255, 255, 255, 0.13)");
        bg.addColorStop(0.5, "rgba(255, 255, 255, 0.055)");
        bg.addColorStop(1, "rgba(255, 255, 255, 0.09)");
      }
      c.fillStyle = bg;
      rrectFn(c, x, y, w, h, rad);
      c.fill();
      c.restore();

      // Pantulan kaca diagonal lembut di dalam kartu
      c.save();
      rrectFn(c, x, y, w, h, rad);
      c.clip();
      const sheen = c.createLinearGradient(x, y, x + w * 0.5, y + h * 0.55);
      sheen.addColorStop(0, light ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.16)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = sheen;
      c.fillRect(x, y, w, h * 0.52);
      c.restore();

      // Rim border cermin specular
      c.save();
      const rim = c.createLinearGradient(x, y, x + w, y + h);
      rim.addColorStop(0, light ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.42)");
      rim.addColorStop(0.5, light ? "rgba(180,192,208,0.28)" : "rgba(255,255,255,0.10)");
      rim.addColorStop(1, light ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.28)");
      c.strokeStyle = rim;
      c.lineWidth = Math.max(1.2, 2.0 * S);
      rrectFn(c, x, y, w, h, rad);
      c.stroke();
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
      c.strokeStyle = "rgba(255,255,255,0.28)";
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
      c.beginPath();
      c.arc(cx, cy, rad, 0, Math.PI * 2);
      c.stroke();
      if (frac > 0.005) {
        c.strokeStyle = col;
        c.beginPath();
        c.arc(cx, cy, rad, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * clampNum(frac, 0, 1));
        c.stroke();
      }
      if (label !== undefined && label !== null && label !== "") {
        c.fillStyle = txtCol || "#FFFFFF";
        c.font = "800 " + Math.max(11, Math.round(rad * 0.52)) + "px sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(String(label), cx, cy + 1 * S);
      }
      c.restore();
    },
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
      for (let li = 0; li < lines.length; li++) {
        const ln = lines[li];
        const lp = ease.snap(clampNum((prog - li * 0.13) / 0.72, 0, 1));
        if (lp <= 0.008) continue;
        const ly = y + li * lineH;
        const sx = align === "center" ? x - ln.width * 0.5 : x;
        c.save();
        c.beginPath();
        c.rect(sx - 20 * S, ly - 10 * S, ln.width + 44 * S, lineH + fontSize * 0.24);
        c.clip();
        c.globalAlpha *= lp;
        let cx = sx;
        for (let wi = 0; wi < ln.items.length; wi++) {
          const it = ln.items[wi];
          c.font = it.font;
          c.fillStyle = it.color;
          c.fillText(it.text, cx, ly + (1 - lp) * lineH * 0.85 + (it.italic ? -fontSize * 0.03 : 0));
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
  const W = message.W | 0;
  const H = message.H | 0;
  const frame = message.frame | 0;
  const fps = message.fps | 0;
  const D = Number(message.D);
  const totalFrames = message.totalFrames | 0;
  if (W < 2 || H < 2 || W > 3840 || H > 3840 || W * H * 4 > 35_000_000) {
    throw new Error("Output dimensions exceed the runtime safety limit.");
  }
  if (![24, 30, 60].includes(fps) || totalFrames < 1 || totalFrames > 3600 || frame < 0 || frame >= totalFrames) {
    throw new Error("Invalid frame settings.");
  }
  if (typeof message.sourceBody !== "string" || message.sourceBody.length > 262144) {
    throw new Error("Source body must be 256 KiB or smaller.");
  }
  ensureCanvas(W, H);
  canvas.width = W;
  canvas.height = H;
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
  const fx = makeFxApi(fps);

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
  try {
    render(message);
  } catch (error) {
    self.postMessage({ type: "error", frame: message.frame, token: message.token, message: String(error?.message || error).slice(0, 240) });
  }
};

self.postMessage({ type: "ready" });
