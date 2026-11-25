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
