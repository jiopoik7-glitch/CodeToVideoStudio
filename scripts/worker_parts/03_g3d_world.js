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

const __g3dGeoCache = new Map();
function getCachedG3dGeo(key, builderFn) {
  let g = __g3dGeoCache.get(key);
  if (g) return g;
  g = ensureTypedGeo(builderFn());
  if (__g3dGeoCache.size >= 256) {
    const first = __g3dGeoCache.keys().next().value;
    __g3dGeoCache.delete(first);
  }
  __g3dGeoCache.set(key, g);
  return g;
}

function buildEllipsoidGeo(rx, ry, rz, segs) {
  const s = clampNum(segs || 28, 8, 52), rings = Math.max(6, Math.round(s * 0.72));
  const key = "el:" + Math.round(rx * 1000) + ":" + Math.round(ry * 1000) + ":" + Math.round(rz * 1000) + ":" + s;
  return getCachedG3dGeo(key, () => {
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
  });
}

function buildBoxGeo(w, h, d) {
  const key = "bx:" + Math.round(w * 1000) + ":" + Math.round(h * 1000) + ":" + Math.round(d * 1000);
  return getCachedG3dGeo(key, () => {
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
  });
}

function buildShadowDiscGeo(rx, rz, segs) {
  const s = clampNum(segs || 32, 12, 48);
  const key = "sd:" + Math.round(rx * 1000) + ":" + Math.round(rz * 1000) + ":" + s;
  return getCachedG3dGeo(key, () => {
    const pos = [0, 0, 0], norm = [0, 1, 0], uv = [0.5, 0.5], idx = [];
    for (let i = 0; i <= s; i++) {
      const a = (i / s) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(ca * rx, 0, sa * rz);
      norm.push(0, 1, 0);
      uv.push(0.5 + ca * 0.5, 0.5 + sa * 0.5);
    }
    for (let i = 1; i <= s; i++) idx.push(0, i + 1, i);
    return { pos, norm, uv, idx };
  });
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
  const key = "pt:" + Math.round(w * 1000) + ":" + Math.round(h * 1000) + ":" + Math.round((cup || 0.12) * 1000) + ":" + Math.round((curl || 0.16) * 1000);
  return getCachedG3dGeo(key, () => {
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
  });
}

function buildLeafGeo(len, wid, bend) {
  const key = "lf:" + Math.round(len * 1000) + ":" + Math.round(wid * 1000) + ":" + Math.round((bend || 0.14) * 1000);
  return getCachedG3dGeo(key, () => {
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
  });
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
    const o = opts || {};
    const rawCount = clampNum(o.count || 28, 4, 140);
    const count = nodeApi.__lightPreview ? Math.max(6, Math.round(rawCount * 0.45)) : rawCount;
    const rad = o.radius || 2.1, minR = o.minRadius || 0.4;
    const hFn = o.heightFn || (() => 0);
    const seedOff = o.seedOffset || 1200;
    for (let i = 0; i < count; i++) {
      const a = randFn(seedOff + i * 3) * Math.PI * 2;
      const r = lerpNum(minR, rad, Math.sqrt(randFn(seedOff + i * 3 + 1)));
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = hFn(x, z);
      const sc = lerpNum(0.65, 1.25, randFn(seedOff + i * 3 + 2)) * (o.scale || 1);
      if (type === "pebbles") {
        nodeApi.ellipsoid([x, y + 0.03 * sc, z], [0.10 * sc, 0.055 * sc, 0.08 * sc], [0, a, 0], { color: i % 2 === 0 ? "#8E8A82" : "#A6A298", material: "clay" }, 10);
      } else if (type === "wildflowers") {
        nodeApi.cylinder([x, y + 0.07 * sc, z], 0.012 * sc, 0.01 * sc, 0.14 * sc, [0, 0, 0], { color: "#28924C" }, 8);
        nodeApi.sphere([x, y + 0.15 * sc, z], 0.042 * sc, { color: i % 3 === 0 ? "#FFD166" : (i % 3 === 1 ? "#FF8FA3" : "#FFFFFF"), emissive: i % 3 === 0 ? "#A87400" : "#000000" }, 8);
      } else {
        nodeApi.grassTuft([x, y, z], sc * 0.85, i % 2 === 0 ? (o.color || "#258C44") : "#34A858");
      }
    }
    return nodeApi;
  };
}
