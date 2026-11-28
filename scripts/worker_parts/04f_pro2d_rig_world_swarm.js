// =======================================================
// CINEMA ENGINE PRO v2.1 — RIG2D, WORLD2D, FX.SWARM, ASSETS & VIRAL CAPTIONS
// =======================================================
const __texturePatternCache = new Map();
const __loadedMediaBitmaps = new Map();

function makeRig2DApi(W, H, S, t, frame, fps, ui) {
  function drawCharacter(c, opts) {
    const o = opts || {};
    const x = o.x !== undefined ? o.x : W * 0.5;
    const y = o.y !== undefined ? o.y : H * 0.56;
    const sc = (o.scale !== undefined ? o.scale : 1.0) * S;
    const squash = o.squash !== undefined ? o.squash : 1.0;
    const stretch = o.stretch !== undefined ? o.stretch : (1.0 / Math.max(0.5, squash));
    const skin = o.skinColor || "#FFD6B0";
    const shirt = o.shirtColor || "#3B82F6";
    const hair = o.hairColor || "#1E293B";
    const accent = o.accentColor || "#F59E0B";
    const expr = o.expression || "happy"; // happy | excited | thinking | surprised | focus
    const breath = Math.sin(t * 2.6) * 0.02;

    // Automatic organic eye blink every ~3.2s
    const blinkCycle = (t * (o.blinkRate || 0.31) + 0.4) % 1;
    const blink = o.blink !== undefined ? o.blink : (blinkCycle > 0.94 ? Math.sin(((blinkCycle - 0.94) / 0.06) * Math.PI) : 0);

    // Gaze lookAt offset
    let gazeX = 0, gazeY = 0;
    if (Array.isArray(o.lookAt)) {
      const dx = o.lookAt[0] - x;
      const dy = o.lookAt[1] - (y - 95 * sc);
      const ang = Math.atan2(dy, dx);
      const mag = Math.min(1, Math.hypot(dx, dy) / (260 * S));
      gazeX = Math.cos(ang) * 7 * mag;
      gazeY = Math.sin(ang) * 5 * mag;
    }

    c.save();
    c.translate(x, y);
    c.scale(sc * squash * (1 + breath), sc * stretch * (1 - breath * 0.5));

    // Soft ground shadow
    c.fillStyle = "rgba(0,0,0,0.16)";
    c.beginPath();
    c.ellipse(0, 128, 84, 18, 0, 0, Math.PI * 2);
    c.fill();

    // Torso / Shoulders
    c.fillStyle = shirt;
    ui.rrect(c, -68, -6, 136, 126, 46);
    c.fill();
    // Shirt highlight collar
    c.fillStyle = "rgba(255,255,255,0.22)";
    c.beginPath();
    c.arc(0, -4, 30, 0, Math.PI);
    c.fill();

    // Arms (optional wave or point gesture)
    const waveAng = o.wave ? Math.sin(t * 9.0) * 0.35 - 0.85 : (o.pointRight ? -0.35 : 0.25);
    c.save();
    c.translate(-68, 28);
    c.rotate(0.28 + Math.sin(t * 2.4) * 0.06);
    c.strokeStyle = shirt; c.lineWidth = 28; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-22, 68); c.stroke();
    c.fillStyle = skin; c.beginPath(); c.arc(-22, 74, 15, 0, Math.PI * 2); c.fill();
    c.restore();

    c.save();
    c.translate(68, 28);
    c.rotate(waveAng);
    c.strokeStyle = shirt; c.lineWidth = 28; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 0); c.lineTo(36, -34); c.stroke();
    c.fillStyle = skin; c.beginPath(); c.arc(40, -38, 16, 0, Math.PI * 2); c.fill();
    c.restore();

    // Neck & Head (slight head tilt)
    c.save();
    c.translate(0, -86);
    c.rotate(o.headTilt !== undefined ? o.headTilt : Math.sin(t * 1.6) * 0.04);

    c.fillStyle = skin;
    ui.rrect(c, -18, 44, 36, 36, 14);
    c.fill();

    // Ears
    c.beginPath(); c.arc(-68, 4, 16, 0, Math.PI * 2); c.arc(68, 4, 16, 0, Math.PI * 2); c.fill();

    // Head base
    c.fillStyle = skin;
    c.beginPath();
    c.ellipse(0, 0, 68, 72, 0, 0, Math.PI * 2);
    c.fill();

    // Stylized Hair Cap
    c.fillStyle = hair;
    c.beginPath();
    c.arc(0, -14, 70, Math.PI * 1.02, Math.PI * 1.98);
    c.quadraticCurveTo(38, -50, -18, -32);
    c.quadraticCurveTo(-52, -22, -69, -10);
    c.closePath();
    c.fill();

    // Blush cheeks
    c.fillStyle = "rgba(255, 118, 136, 0.28)";
    c.beginPath(); c.ellipse(-40, 18, 13, 8, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(40, 18, 13, 8, 0, 0, Math.PI * 2); c.fill();

    // Eyes with auto-blink & lookAt
    const eyeScaleY = Math.max(0.08, 1 - blink);
    for (let side of [-1, 1]) {
      const ex = side * 26;
      const ey = -4;
      c.save();
      c.translate(ex, ey);
      c.scale(1, eyeScaleY);
      c.fillStyle = "#FFFFFF";
      c.beginPath(); c.ellipse(0, 0, 15, 17, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#0F172A";
      c.beginPath(); c.arc(gazeX, gazeY, 8.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#FFFFFF";
      c.beginPath(); c.arc(gazeX + 3, gazeY - 3, 2.8, 0, Math.PI * 2); c.fill();
      c.restore();

      // Eyebrows based on expression
      c.strokeStyle = hair; c.lineWidth = 5.5; c.lineCap = "round";
      const browLift = expr === "surprised" || expr === "excited" ? -8 : (expr === "thinking" && side === 1 ? -7 : 0);
      const browTilt = expr === "focus" ? side * 4 : (expr === "happy" ? -side * 2 : 0);
      c.beginPath();
      c.moveTo(ex - 13, ey - 24 + browLift - browTilt);
      c.quadraticCurveTo(ex, ey - 29 + browLift, ex + 13, ey - 24 + browLift + browTilt);
      c.stroke();
    }

    // Mouth / Lip-Sync
    const mouthMode = o.mouth || (o.talk ? "talk" : (expr === "surprised" ? "oh" : "smile"));
    c.save();
    c.translate(0, 28);
    if (mouthMode === "talk") {
      const openAmt = 4 + Math.abs(Math.sin(t * 14.5) * Math.cos(t * 5.2)) * 14;
      c.fillStyle = "#7F1D1D";
      c.beginPath(); c.ellipse(0, 2, 16, openAmt, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#FB7185";
      c.beginPath(); c.ellipse(0, 2 + openAmt * 0.35, 9, openAmt * 0.45, 0, 0, Math.PI * 2); c.fill();
    } else if (mouthMode === "oh") {
      c.fillStyle = "#7F1D1D";
      c.beginPath(); c.ellipse(0, 4, 11, 13, 0, 0, Math.PI * 2); c.fill();
    } else if (mouthMode === "open" || expr === "excited") {
      c.fillStyle = "#7F1D1D";
      c.beginPath(); c.arc(0, -2, 18, 0, Math.PI); c.closePath(); c.fill();
      c.fillStyle = "#FFFFFF";
      c.fillRect(-13, -2, 26, 5);
    } else {
      c.strokeStyle = "#7F1D1D"; c.lineWidth = 5; c.lineCap = "round";
      c.beginPath();
      c.arc(0, -4, 16, 0.18 * Math.PI, 0.82 * Math.PI);
      c.stroke();
    }
    c.restore();

    if (o.glasses) {
      c.strokeStyle = accent; c.lineWidth = 4.2;
      c.beginPath(); c.arc(-26, -4, 19, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(26, -4, 19, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(-7, -4); c.lineTo(7, -4); c.stroke();
    }

    c.restore();
    c.restore();
  }

  function drawSpeechBubble(c, x, y, text, opts) {
    const o = opts || {};
    const maxW = o.maxW || 440 * S;
    const fSize = Math.round(o.fontSize || 28 * S);
    const padX = 28 * S, padY = 20 * S;
    const pop = o.progress !== undefined ? ease.snap(clampNum(o.progress, 0, 1)) : 1;
    if (pop <= 0.01) return;

    c.save();
    c.font = "700 " + fSize + "px 'Plus Jakarta Sans', 'Inter', sans-serif";
    const lines = ui.wrapText(c, String(text || ""), maxW - padX * 2);
    const lineH = fSize * 1.3;
    let textW = 0;
    for (let ln of lines) textW = Math.max(textW, c.measureText(ln).width);
    const bw = Math.min(maxW, textW + padX * 2);
    const bh = lines.length * lineH + padY * 2;
    const bx = x - bw * 0.5;
    const by = y - bh;

    c.translate(x, y);
    c.scale(pop, pop);
    c.translate(-x, -y);
    c.globalAlpha *= pop;

    c.shadowColor = "rgba(15,23,42,0.22)";
    c.shadowBlur = 24 * S;
    c.shadowOffsetY = 8 * S;
    c.fillStyle = o.bg || "#FFFFFF";
    ui.rrect(c, bx, by, bw, bh, 24 * S);
    c.fill();
    c.shadowColor = "transparent";

    // Bubble pointer tail
    const tailDir = o.tail || "bottom-left";
    const tx = tailDir === "bottom-right" ? (bx + bw * 0.74) : (bx + bw * 0.26);
    c.beginPath();
    c.moveTo(tx - 14 * S, by + bh - 2);
    c.lineTo(tx, by + bh + 20 * S);
    c.lineTo(tx + 18 * S, by + bh - 2);
    c.closePath();
    c.fill();

    if (o.border) {
      c.strokeStyle = o.border; c.lineWidth = 2.5 * S;
      ui.rrect(c, bx, by, bw, bh, 24 * S); c.stroke();
    }

    c.fillStyle = o.color || "#0F172A";
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (let i = 0; i < lines.length; i++) {
      c.fillText(lines[i], x, by + padY + (i + 0.5) * lineH);
    }
    c.restore();
  }

  function drawChecklist(c, x, y, w, items, progress, opts) {
    const o = opts || {};
    const list = Array.isArray(items) ? items : [];
    const rowH = o.rowH || 74 * S;
    const pad = 26 * S;
    const totalH = pad * 2 + list.length * rowH + (o.title ? 48 * S : 0);
    const light = o.light !== false;
    const accent = o.accent || "#10B981";

    c.save();
    if (o.glass) {
      ui.drawLiquidGlass(c, x, y, w, totalH, 28 * S, { light });
    } else {
      c.shadowColor = "rgba(15,23,42,0.18)";
      c.shadowBlur = 28 * S;
      c.shadowOffsetY = 12 * S;
      c.fillStyle = light ? "#FFFFFF" : "rgba(18,24,36,0.92)";
      ui.rrect(c, x, y, w, totalH, 26 * S);
      c.fill();
      c.shadowColor = "transparent";
    }

    let cy = y + pad;
    if (o.title) {
      c.fillStyle = light ? "#0F172A" : "#F8FAFC";
      c.font = "800 " + Math.round(28 * S) + "px 'Plus Jakarta Sans', sans-serif";
      c.textAlign = "left"; c.textBaseline = "top";
      c.fillText(String(o.title), x + pad, cy, w - pad * 2);
      cy += 48 * S;
    }

    for (let i = 0; i < list.length; i++) {
      const itemP = clampNum((progress * list.length) - i, 0, 1);
      const checkPop = ease.snap(itemP);
      const ry = cy + i * rowH + rowH * 0.5;
      const cx = x + pad + 20 * S;

      // Checkbox circle
      c.fillStyle = itemP > 0.1 ? accent : (light ? "#E2E8F0" : "rgba(255,255,255,0.12)");
      c.beginPath();
      c.arc(cx, ry, (18 * S) * (0.85 + 0.15 * checkPop), 0, Math.PI * 2);
      c.fill();

      if (itemP > 0.15) {
        c.strokeStyle = "#FFFFFF"; c.lineWidth = 4.2 * S; c.lineCap = "round"; c.lineJoin = "round";
        c.beginPath();
        c.moveTo(cx - 8 * S, ry);
        c.lineTo(cx - 2 * S, ry + 6 * S);
        c.lineTo(cx + 9 * S, ry - 7 * S);
        c.stroke();
      }

      c.fillStyle = light ? (itemP > 0.1 ? "#0F172A" : "#64748B") : (itemP > 0.1 ? "#FFFFFF" : "rgba(255,255,255,0.55)");
      c.font = (itemP > 0.1 ? "700 " : "500 ") + Math.round(25 * S) + "px 'Inter', sans-serif";
      c.textAlign = "left"; c.textBaseline = "middle";
      c.fillText(String(list[i]), cx + 32 * S, ry, w - pad * 2 - 58 * S);
    }
    c.restore();
    return totalH;
  }

  function drawHalftoneBg(c, w, h, opts) {
    const o = opts || {};
    c.save();
    c.fillStyle = o.bg || "#FFFDF7";
    c.fillRect(0, 0, w, h);
    const step = Math.max(18, Math.round(o.step || 34 * S));
    const maxR = o.dotRadius || 4.2 * S;
    c.fillStyle = o.dotColor || "rgba(59,130,246,0.14)";
    for (let y = step * 0.5; y < h; y += step) {
      const shift = (Math.floor(y / step) % 2) * (step * 0.5);
      for (let x = shift; x < w + step; x += step) {
        const d = Math.hypot((x - w * 0.5) / w, (y - h * 0.5) / h);
        const r = maxR * clampNum(0.45 + d * 0.9, 0.2, 1.3);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }

  return Object.freeze({
    drawCharacter,
    drawSpeechBubble,
    drawChecklist,
    drawHalftoneBg
  });
}

function makeWorld2DApi(W, H, S, t, rand) {
  function getOrganicPattern(type, color) {
    const key = type + "_" + (color || "");
    if (__texturePatternCache.has(key)) return __texturePatternCache.get(key);
    const sz = 128;
    const oc = createWorkCanvas(sz, sz);
    const ocx = oc.getContext("2d");
    const base = color || (type === "rock" ? "#475569" : type === "paper" ? "#F8F3E6" : "#5B3A29");
    ocx.fillStyle = base;
    ocx.fillRect(0, 0, sz, sz);
    const count = type === "paper" ? 180 : 140;
    for (let i = 0; i < count; i++) {
      const rx = seededRandom(i * 17 + 3, 1) * sz;
      const ry = seededRandom(i * 19 + 7, 2) * sz;
      const rr = (type === "rock" ? 3 + seededRandom(i, 3) * 8 : 1.2 + seededRandom(i, 3) * 3.5);
      const dark = seededRandom(i, 4) > 0.5;
      ocx.fillStyle = dark ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.08)";
      ocx.beginPath();
      ocx.arc(rx, ry, rr, 0, Math.PI * 2);
      ocx.fill();
    }
    __texturePatternCache.set(key, oc);
    return oc;
  }

  return Object.freeze({
    keyframeCamera(pVal, keys) {
      if (!Array.isArray(keys) || !keys.length) return { x: 0, y: 0, zoom: 1, rot: 0 };
      let k0 = keys[0], k1 = keys[keys.length - 1];
      for (let i = 0; i < keys.length - 1; i++) {
        if (pVal >= keys[i].p && pVal <= keys[i + 1].p) { k0 = keys[i]; k1 = keys[i + 1]; break; }
      }
      const u = k1.p > k0.p ? ease.apple(clampNum((pVal - k0.p) / (k1.p - k0.p), 0, 1)) : 0;
      return {
        x: lerpNum(k0.x || 0, k1.x || 0, u),
        y: lerpNum(k0.y || 0, k1.y || 0, u),
        zoom: lerpNum(k0.zoom !== undefined ? k0.zoom : 1, k1.zoom !== undefined ? k1.zoom : 1, u),
        rot: lerpNum(k0.rot || 0, k1.rot || 0, u)
      };
    },
    applyCamera(c, camState) {
      const st = camState || { x: 0, y: 0, zoom: 1, rot: 0 };
      c.translate(W * 0.5, H * 0.5);
      c.scale(st.zoom || 1, st.zoom || 1);
      if (st.rot) c.rotate(st.rot);
      c.translate(-(st.x || 0), -(st.y || 0));
    },
    drawOrganicTexture(c, x, y, w, h, type, color) {
      const tile = getOrganicPattern(type || "soil", color);
      const pat = c.createPattern(tile, "repeat");
      if (pat) {
        c.save();
        c.fillStyle = pat;
        c.fillRect(x, y, w, h);
        c.restore();
      }
    },
    drawTunnel(c, pts, width, opts) {
      if (!Array.isArray(pts) || pts.length < 2) return;
      const o = opts || {};
      c.save();
      c.lineCap = "round"; c.lineJoin = "round";
      // Outer dark soil rim
      c.strokeStyle = o.rimColor || "#24160E";
      c.lineWidth = (width || 80 * S) + 18 * S;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
      // Inner hollowed tunnel
      c.strokeStyle = o.fillColor || "#3D2618";
      c.lineWidth = width || 80 * S;
      c.stroke();
      c.restore();
    },
    drawRoomLight(c, x, y, radius, color, intensity) {
      const rgb = parseHexRGB(color || "#FFCA6B", [255, 202, 107]);
      const a = clampNum(intensity !== undefined ? intensity : 0.42, 0, 1);
      const g = c.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
      g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
      g.addColorStop(0.55, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * 0.28})`);
      g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      c.save();
      c.globalCompositeOperation = "screen";
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, Math.max(1, radius), 0, Math.PI * 2); c.fill();
      c.restore();
    }
  });
}

function makeSwarmApi(S, t) {
  function catmullRom(pts, u) {
    if (!Array.isArray(pts) || pts.length < 2) return { x: 0, y: 0, angle: 0 };
    const n = pts.length - 1;
    const scaled = clampNum(u, 0, 0.99999) * n;
    const seg = Math.min(n - 1, Math.floor(scaled));
    const f = scaled - seg;
    const p0 = pts[Math.max(0, seg - 1)];
    const p1 = pts[seg];
    const p2 = pts[Math.min(n, seg + 1)];
    const p3 = pts[Math.min(n, seg + 2)];
    const f2 = f * f, f3 = f2 * f;
    const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * f + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * f2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * f3);
    const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * f + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * f2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * f3);
    const dx = 0.5 * ((-p0[0] + p2[0]) + 2 * (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * f + 3 * (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * f2);
    const dy = 0.5 * ((-p0[1] + p2[1]) + 2 * (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * f + 3 * (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * f2);
    return { x, y, angle: Math.atan2(dy, dx) };
  }

  function drawSwarm(c, paths, opts) {
    const o = opts || {};
    const pathList = Array.isArray(paths[0]) && Array.isArray(paths[0][0]) ? paths : [paths];
    const count = clampNum(o.count || 48, 1, 400);
    const speed = o.speed !== undefined ? o.speed : 0.14;
    const spread = o.spread !== undefined ? o.spread : 18 * S;
    const size = o.size !== undefined ? o.size : 10 * S;
    const type = o.type || "ant"; // ant | cell | leaf | spark | dot
    const color = o.color || (type === "ant" ? "#1E1410" : type === "leaf" ? "#34D399" : "#FDE047");

    c.save();
    for (let i = 0; i < count; i++) {
      const path = pathList[i % pathList.length];
      if (!path || path.length < 2) continue;
      const offset = seededRandom(i * 13 + 5, 1);
      const lane = (seededRandom(i * 17 + 11, 2) - 0.5) * 2 * spread;
      const spdVar = 0.8 + seededRandom(i * 23 + 3, 3) * 0.4;
      const dir = o.bidirectional && (i % 2 === 1) ? -1 : 1;
      const rawU = (offset + t * speed * spdVar * dir) % 1;
      const u = rawU < 0 ? rawU + 1 : rawU;
      const pt = catmullRom(path, u);
      const ang = dir < 0 ? pt.angle + Math.PI : pt.angle;
      const nx = -Math.sin(pt.angle) * lane;
      const ny = Math.cos(pt.angle) * lane;

      c.save();
      c.translate(pt.x + nx, pt.y + ny);
      c.rotate(ang);
      if (typeof o.drawAgent === "function") {
        o.drawAgent(c, i, size, t);
      } else if (type === "ant") {
        const legWig = Math.sin(t * 22 + i * 2.1) * size * 0.25;
        c.strokeStyle = color; c.lineWidth = Math.max(1.2, size * 0.14);
        for (let l = -1; l <= 1; l++) {
          c.beginPath();
          c.moveTo(l * size * 0.4, 0); c.lineTo(l * size * 0.4 + legWig, -size * 0.72);
          c.moveTo(l * size * 0.4, 0); c.lineTo(l * size * 0.4 - legWig, size * 0.72);
          c.stroke();
        }
        c.fillStyle = color;
        c.beginPath(); c.ellipse(-size * 0.75, 0, size * 0.52, size * 0.36, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(0, 0, size * 0.36, size * 0.26, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(size * 0.62, 0, size * 0.32, size * 0.28, 0, 0, Math.PI * 2); c.fill();
        if (o.carryFood && i % 3 === 0) {
          c.fillStyle = "#F59E0B";
          c.beginPath(); c.arc(size * 1.05, 0, size * 0.28, 0, Math.PI * 2); c.fill();
        }
      } else if (type === "leaf") {
        c.fillStyle = color;
        c.beginPath();
        c.ellipse(0, 0, size, size * 0.45, 0, 0, Math.PI * 2);
        c.fill();
      } else if (type === "cell") {
        c.fillStyle = color;
        c.globalAlpha = 0.85;
        c.beginPath(); c.arc(0, 0, size * 0.7, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(255,255,255,0.5)";
        c.beginPath(); c.arc(-size * 0.2, -size * 0.15, size * 0.24, 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = color;
        c.beginPath(); c.arc(0, 0, size * 0.55, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    c.restore();
  }

  return Object.freeze({
    catmullRom,
    drawSwarm,
    createPathSwarm: drawSwarm
  });
}

function makeAssetsApi(S, ui) {
  return Object.freeze({
    has(alias) { return __loadedMediaBitmaps.has(String(alias || "").trim().toLowerCase()); },
    list() { return Array.from(__loadedMediaBitmaps.keys()); },
    get(alias) { return __loadedMediaBitmaps.get(String(alias || "").trim().toLowerCase()) || null; },
    drawImage(c, alias, x, y, w, h, opts) {
      const o = opts || {};
      const key = String(alias || "").trim().toLowerCase();
      const bmp = __loadedMediaBitmaps.get(key);
      const rad = o.radius !== undefined ? o.radius : 24 * S;
      const pop = o.popIn !== undefined ? ease.snap(clampNum(o.popIn, 0, 1)) : 1;
      if (pop <= 0.01) return false;

      c.save();
      const cx = x + w * 0.5, cy = y + h * 0.5;
      c.translate(cx, cy);
      c.scale(pop, pop);
      if (o.rot) c.rotate(o.rot);
      c.translate(-cx, -cy);
      c.globalAlpha *= pop;

      if (o.shadow !== false) {
        c.shadowColor = "rgba(0,0,0,0.34)";
        c.shadowBlur = 28 * S;
        c.shadowOffsetY = 12 * S;
        c.fillStyle = "rgba(0,0,0,0.08)";
        ui.rrect(c, x, y, w, h, rad);
        c.fill();
        c.shadowColor = "transparent";
      }

      ui.rrect(c, x, y, w, h, rad);
      c.clip();

      if (bmp) {
        const iw = bmp.width || 1, ih = bmp.height || 1;
        const fit = o.fit || "cover";
        const scale = fit === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
        const dw = iw * scale, dh = ih * scale;
        c.drawImage(bmp, x + (w - dw) * 0.5, y + (h - dh) * 0.5, dw, dh);
      } else {
        // Friendly placeholder if alias has not been imported yet
        c.fillStyle = "rgba(30,41,59,0.85)";
        c.fillRect(x, y, w, h);
        c.fillStyle = "rgba(226,232,240,0.75)";
        c.font = "600 " + Math.round(20 * S) + "px 'JetBrains Mono', monospace";
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("ASSET: " + key, cx, cy, w - 20 * S);
      }

      if (o.border) {
        c.strokeStyle = o.border;
        c.lineWidth = o.borderWidth || (2.5 * S);
        ui.rrect(c, x, y, w, h, rad);
        c.stroke();
      }
      c.restore();
      return !!bmp;
    }
  });
}

function drawViralCaptions(c, W, H, S, t, ui, cues, tSec, opts) {
  if (!Array.isArray(cues) || !cues.length) return;
  const o = opts || {};
  const curT = tSec !== undefined ? tSec : t;
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
  const wordLocalU = (localU * words.length) - activeIdx;
  const bounce = 1.0 + Math.sin(clampNum(wordLocalU * 2.5, 0, 1) * Math.PI) * 0.14;

  const preset = o.preset || "pill_highlight"; // pill_highlight | universe_bold | editorial_glass
  const fSize = Math.round(o.size || (preset === "universe_bold" ? 54 * S : preset === "editorial_glass" ? 38 * S : 46 * S));
  const maxW = o.maxW || (W * 0.84);
  const cy = o.y !== undefined ? o.y : (H * (o.yRatio !== undefined ? o.yRatio : 0.82));
  const accent = o.accent || (preset === "universe_bold" ? "#FFE600" : preset === "editorial_glass" ? "#7AC8FF" : "#FF3B5C");
  const inP = ease.snap(clampNum((curT - active.start) / 0.14, 0, 1));
  const outP = ease.snap(clampNum((active.end - curT) / 0.12, 0, 1));
  const vis = Math.min(inP, outP);

  c.save();
  const fontSpec = preset === "editorial_glass"
    ? ("italic 700 " + fSize + "px 'Playfair Display', 'Plus Jakarta Sans', serif")
    : ("800 " + fSize + "px 'Plus Jakarta Sans', 'Inter', sans-serif");
  c.font = fontSpec;
  const spW = c.measureText(" ").width;
  const lines = [];
  let ln = [], lw = 0;
  for (let i = 0; i < words.length; i++) {
    const ww = c.measureText(words[i]).width;
    const add = ln.length ? spW + ww : ww;
    if (ln.length && lw + add > maxW) {
      lines.push({ items: ln, w: lw });
      ln = [{ t: words[i], w: ww, idx: i }];
      lw = ww;
    } else {
      ln.push({ t: words[i], w: ww, idx: i });
      lw += add;
    }
  }
  if (ln.length) lines.push({ items: ln, w: lw });

  const lineH = fSize * 1.32;
  const boxW = Math.min(maxW + 54 * S, Math.max(...lines.map((l) => l.w)) + 60 * S);
  const boxH = lines.length * lineH + 34 * S;
  const bx = W * 0.5 - boxW * 0.5;
  const by = cy - boxH * 0.5 + (1 - vis) * 18 * S;

  c.globalAlpha *= vis;
  if (preset === "editorial_glass") {
    ui.drawLiquidGlass(c, bx, by, boxW, boxH, 26 * S, { light: !!o.light, chromatic: true });
  }

  c.textBaseline = "middle";
  c.textAlign = "left";
  for (let li = 0; li < lines.length; li++) {
    let wx = W * 0.5 - lines[li].w * 0.5;
    const wy = by + 18 * S + (li + 0.5) * lineH;
    for (let wi = 0; wi < lines[li].items.length; wi++) {
      const it = lines[li].items[wi];
      const isCur = it.idx === activeIdx;
      c.save();
      if (isCur && preset !== "editorial_glass") {
        c.translate(wx + it.w * 0.5, wy);
        c.scale(bounce, bounce);
        c.translate(-(wx + it.w * 0.5), -wy);
      }

      if (preset === "pill_highlight") {
        if (isCur) {
          c.fillStyle = accent;
          ui.rrect(c, wx - 12 * S, wy - fSize * 0.62, it.w + 24 * S, fSize * 1.24, 16 * S);
          c.fill();
        }
        c.lineJoin = "round";
        c.lineWidth = Math.max(3, 6 * S);
        c.strokeStyle = "rgba(0,0,0,0.82)";
        c.strokeText(it.t, wx, wy);
        c.fillStyle = "#FFFFFF";
        c.fillText(it.t, wx, wy);
      } else if (preset === "universe_bold") {
        c.shadowColor = "rgba(0,0,0,0.88)";
        c.shadowBlur = 10 * S;
        c.shadowOffsetY = 5 * S;
        c.lineJoin = "round";
        c.lineWidth = Math.max(4, 9 * S);
        c.strokeStyle = "#080B10";
        c.strokeText(it.t, wx, wy);
        c.fillStyle = isCur ? accent : "#FFFFFF";
        c.fillText(it.t, wx, wy);
      } else {
        if (isCur) {
          c.fillStyle = ui.rgba(accent, 0.24);
          ui.rrect(c, wx - 10 * S, wy - fSize * 0.58, it.w + 20 * S, fSize * 1.16, 12 * S);
          c.fill();
        }
        c.fillStyle = isCur ? accent : (it.idx < activeIdx ? "#FFFFFF" : "rgba(255,255,255,0.62)");
        c.fillText(it.t, wx, wy);
      }
      c.restore();
      wx += it.w + spW;
    }
  }
  c.restore();
}

let __magnifierSnapCanvas = null;

function drawMagnifierCallout(c, W, H, S, ui, cx, cy, radius, opts) {
  const o = opts || {};
  const zoom = o.zoom || 2.1;
  const srcX = o.srcX !== undefined ? o.srcX : cx;
  const srcY = o.srcY !== undefined ? o.srcY : cy;
  const r = Math.max(12, radius || 110 * S);
  const snapDim = Math.max(4, Math.ceil(r * 2));

  if (!__magnifierSnapCanvas) {
    __magnifierSnapCanvas = createWorkCanvas(snapDim, snapDim);
  } else if (__magnifierSnapCanvas.width !== snapDim || __magnifierSnapCanvas.height !== snapDim) {
    __magnifierSnapCanvas.width = snapDim;
    __magnifierSnapCanvas.height = snapDim;
  }
  const snap = __magnifierSnapCanvas;
  const sctx = snap.getContext("2d");
  sctx.clearRect(0, 0, snapDim, snapDim);
  const sw = (r * 2) / zoom;
  sctx.drawImage(c.canvas, srcX - sw * 0.5, srcY - sw * 0.5, sw, sw, 0, 0, snap.width, snap.height);

  c.save();
  // Leader callout line if offset from target
  if (Math.hypot(cx - srcX, cy - srcY) > r * 0.6 && o.leader !== false) {
    c.strokeStyle = o.ringColor || "#FFFFFF";
    c.lineWidth = 3 * S;
    c.setLineDash([8 * S, 6 * S]);
    c.beginPath(); c.moveTo(srcX, srcY); c.lineTo(cx, cy); c.stroke();
    c.setLineDash([]);
    c.fillStyle = o.ringColor || "#FFFFFF";
    c.beginPath(); c.arc(srcX, srcY, 6 * S, 0, Math.PI * 2); c.fill();
  }

  // Drop shadow
  c.shadowColor = "rgba(0,0,0,0.42)";
  c.shadowBlur = 28 * S;
  c.shadowOffsetY = 10 * S;
  c.fillStyle = "#0E141F";
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
  c.shadowColor = "transparent";

  // Magnified circular crop
  c.save();
  c.beginPath(); c.arc(cx, cy, r - 4 * S, 0, Math.PI * 2); c.clip();
  c.drawImage(snap, cx - r, cy - r, r * 2, r * 2);
  // Subtle glass glare highlight
  const gl = c.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r * 0.4);
  gl.addColorStop(0, "rgba(255,255,255,0.34)");
  gl.addColorStop(0.35, "rgba(255,255,255,0.05)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gl;
  c.fillRect(cx - r, cy - r, r * 2, r * 2);
  c.restore();

  // Outer bezel ring
  c.strokeStyle = o.ringColor || "#FFFFFF";
  c.lineWidth = 6 * S;
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();

  if (o.label) {
    ui.drawPill(c, cx - 72 * S, cy + r + 14 * S, String(o.label), "rgba(15,23,42,0.85)", "#FFFFFF", Math.round(20 * S));
  }
  c.restore();
}
