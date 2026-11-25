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
