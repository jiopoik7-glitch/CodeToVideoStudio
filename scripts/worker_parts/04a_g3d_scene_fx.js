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
