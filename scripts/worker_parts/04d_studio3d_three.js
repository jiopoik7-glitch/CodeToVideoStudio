// =======================================================
// CINEMA ENGINE PRO v2.1 — STUDIO3D (THREE.JS WEBGL2) & CAM3D
// Persistent Hardware WebGLRenderer Singleton + Geometry/Material Pool
// =======================================================
let __threeInitAttempted = false;
let __threeReady = false;
let __threeCanvas = null;
let __threeRenderer = null;
let __threeW = 0;
let __threeH = 0;
let __threeScene = null;
let __threeSkyMesh = null;
let __threeSkyMat = null;
const __threeGeoCache = new Map();
const __threeMatCache = new Map();

function ensureThreeLoaded() {
  if (__threeReady && typeof THREE !== "undefined") return true;
  if (typeof THREE !== "undefined" && typeof THREE.WebGLRenderer === "function") {
    __threeReady = true;
    return true;
  }
  if (__threeInitAttempted) return __threeReady;
  __threeInitAttempted = true;
  try {
    if (typeof THREE === "undefined" && typeof importScripts === "function") {
      importScripts("/libs/three.min.js");
    }
    __threeReady = typeof THREE !== "undefined" && typeof THREE.WebGLRenderer === "function";
  } catch (_) {
    __threeReady = false;
  }
  return __threeReady;
}

function resetThreeContext() {
  try { __threeRenderer && __threeRenderer.dispose(); } catch (_) {}
  __threeGeoCache.forEach((g) => { try { g.dispose(); } catch (_) {} });
  __threeMatCache.forEach((m) => { try { m.dispose(); } catch (_) {} });
  __threeGeoCache.clear();
  __threeMatCache.clear();
  if (__threeSkyMesh) {
    try { __threeSkyMesh.geometry.dispose(); } catch (_) {}
    try { __threeSkyMat && __threeSkyMat.dispose(); } catch (_) {}
  }
  __threeRenderer = null;
  __threeCanvas = null;
  __threeScene = null;
  __threeSkyMesh = null;
  __threeSkyMat = null;
  __threeW = 0;
  __threeH = 0;
}

function getSharedThreeRenderer(W, H, isExportMode) {
  if (!ensureThreeLoaded()) return null;
  try {
    if (__threeRenderer) {
      const ctxGl = __threeRenderer.getContext();
      if (ctxGl && typeof ctxGl.isContextLost === "function" && ctxGl.isContextLost()) {
        resetThreeContext();
      }
    }
    if (!__threeCanvas) {
      __threeCanvas = createWorkCanvas(W, H);
      if (!__threeCanvas.style) __threeCanvas.style = {};
      if (typeof __threeCanvas.addEventListener === "function") {
        __threeCanvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); resetThreeContext(); }, false);
      }
      __threeRenderer = new THREE.WebGLRenderer({
        canvas: __threeCanvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance"
      });
      __threeRenderer.setPixelRatio(1);
      detectGpuProfile(__threeRenderer.getContext());
      __threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (typeof THREE.ACESFilmicToneMapping !== "undefined") {
        __threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        __threeRenderer.toneMappingExposure = 1.12;
      }
      if (typeof THREE.sRGBEncoding !== "undefined") {
        __threeRenderer.outputEncoding = THREE.sRGBEncoding;
      }
      __threeW = W;
      __threeH = H;
    }
    __threeRenderer.shadowMap.enabled = !shouldUseLightPreview(!!isExportMode);
    if (__threeW !== W || __threeH !== H) {
      __threeRenderer.setSize(W, H, false);
      __threeW = W;
      __threeH = H;
    }
    return __threeRenderer;
  } catch (_) {
    return null;
  }
}

function getPooledThreeGeo(key, factoryFn) {
  let g = __threeGeoCache.get(key);
  if (g) return g;
  g = factoryFn();
  if (__threeGeoCache.size >= 160) {
    const firstKey = __threeGeoCache.keys().next().value;
    const old = __threeGeoCache.get(firstKey);
    try { old && old.dispose(); } catch (_) {}
    __threeGeoCache.delete(firstKey);
  }
  __threeGeoCache.set(key, g);
  return g;
}

function getPooledStdMat(opts) {
  const c = String(opts.color || "#E2E8F0");
  const e = String(opts.emissive || "#000000");
  const ei = Math.round((opts.emissiveIntensity || 0) * 100);
  const r = Math.round((opts.roughness !== undefined ? opts.roughness : 0.5) * 100);
  const m = Math.round((opts.metalness !== undefined ? opts.metalness : 0.1) * 100);
  const f = opts.flatShading ? 1 : 0;
  const tr = opts.transparent ? 1 : 0;
  const op = Math.round((opts.opacity !== undefined ? opts.opacity : 1) * 100);
  const key = c + "|" + e + "|" + ei + "|" + r + "|" + m + "|" + f + "|" + tr + "|" + op;
  let mat = __threeMatCache.get(key);
  if (mat) return mat;
  mat = new THREE.MeshStandardMaterial({
    color: c,
    emissive: e,
    emissiveIntensity: opts.emissiveIntensity || 0,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.5,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.1,
    flatShading: !!opts.flatShading,
    transparent: !!opts.transparent,
    opacity: opts.opacity !== undefined ? opts.opacity : 1
  });
  if (__threeMatCache.size >= 128) {
    const firstKey = __threeMatCache.keys().next().value;
    const old = __threeMatCache.get(firstKey);
    try { old && old.dispose(); } catch (_) {}
    __threeMatCache.delete(firstKey);
  }
  __threeMatCache.set(key, mat);
  return mat;
}

function getPooledSkyMesh(skyTop, skyHorizon, sunColor) {
  if (!__threeSkyMesh) {
    const skyGeo = new THREE.SphereGeometry(140, 20, 14);
    __threeSkyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(skyTop) },
        bottomColor: { value: new THREE.Color(skyHorizon) },
        sunDir: { value: new THREE.Vector3(0.55, 0.45, -0.6).normalize() },
        sunColor: { value: new THREE.Color(sunColor || "#FFE7BA") }
      },
      vertexShader: "varying vec3 vWorldPos; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorldPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }",
      fragmentShader: "uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 sunDir; uniform vec3 sunColor; varying vec3 vWorldPos; void main(){ vec3 d = normalize(vWorldPos); float h = clamp(d.y * 1.45 + 0.12, 0.0, 1.0); vec3 col = mix(bottomColor, topColor, pow(h, 0.65)); float s = max(dot(d, sunDir), 0.0); col += sunColor * (pow(s, 36.0) * 0.65 + pow(s, 6.0) * 0.14); gl_FragColor = vec4(col, 1.0); }"
    });
    __threeSkyMesh = new THREE.Mesh(skyGeo, __threeSkyMat);
  } else {
    __threeSkyMat.uniforms.topColor.value.set(skyTop);
    __threeSkyMat.uniforms.bottomColor.value.set(skyHorizon);
    __threeSkyMat.uniforms.sunColor.value.set(sunColor || "#FFE7BA");
  }
  return __threeSkyMesh;
}

function disposeEphemeralObjects(sceneObj) {
  if (!sceneObj) return;
  sceneObj.traverse((child) => {
    if (child.userData && child.userData.__ephemeralGeo && child.geometry && typeof child.geometry.dispose === "function") {
      child.geometry.dispose();
    }
    if (child.userData && child.userData.__ephemeralMat && child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m && m.dispose && m.dispose());
      else if (typeof child.material.dispose === "function") child.material.dispose();
    }
  });
  sceneObj.clear();
}

function makeStudio3DApi(W, H, t, p, frame, fps, rand, isExportMode) {
  const springPop = (prog, delay) => {
    const localP = clampNum((prog - (delay || 0)) / Math.max(0.001, 1 - (delay || 0)), 0, 1);
    return spring({ frame: localP * fps * 0.85, fps, config: { damping: 12, stiffness: 170, mass: 0.9 } });
  };

  function createScene(opts) {
    const o = opts || {};
    const renderer = getSharedThreeRenderer(W, H, !!isExportMode);
    if (!renderer) {
      return {
        available: false,
        cam3D: { splineDolly() {}, orbit() {}, pan() {}, tilt() {}, focusOn() {} },
        addTerrain() { return null; }, addVilla() { return null; }, addBuilding() { return null; },
        addTree() { return null; }, addPool() { return null; }, addExtrude() { return null; },
        addBox() { return null; }, addSphere() { return null; }, addCylinder() { return null; },
        addLight() { return null; }, addGlowOrb() { return null; }, addGroup() { return null; },
        renderTo(targetCtx) {
          targetCtx.save();
          targetCtx.fillStyle = "#101724";
          targetCtx.fillRect(0, 0, W, H);
          targetCtx.restore();
        }
      };
    }

    const useLight = shouldUseLightPreview(!!isExportMode);
    if (!__threeScene) __threeScene = new THREE.Scene();
    else __threeScene.clear();
    const scene = __threeScene;
    scene.fog = null;

    const skyTop = o.skyTop || "#10203A";
    const skyHorizon = o.skyHorizon || "#6FA8DC";
    const fogColor = o.fogColor || skyHorizon;
    const fogDensity = o.fogDensity !== undefined ? o.fogDensity : 0.018;
    if (o.transparent !== true && fogDensity > 0) {
      scene.fog = new THREE.FogExp2(fogColor, fogDensity);
    }

    if (o.transparent !== true && o.sky !== false) {
      scene.add(getPooledSkyMesh(skyTop, skyHorizon, o.sunColor || "#FFE7BA"));
    }

    // PBR Lighting Rig: Hemisphere + Sun Directional (Adaptive Shadow Map) + Rim Light
    const hemi = new THREE.HemisphereLight(o.hemiSky || "#D9ECFF", o.hemiGround || "#3C4654", o.hemiIntensity !== undefined ? o.hemiIntensity : 0.85);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(o.sunColor || "#FFF1D6", o.sunIntensity !== undefined ? o.sunIntensity : 1.55);
    const sunPos = o.sunPos || [12, 18, 10];
    sun.position.set(sunPos[0], sunPos[1], sunPos[2]);
    const enableShadows = o.shadows !== false && !useLight;
    sun.castShadow = enableShadows;
    const shadowSize = isExportMode ? 2048 : 512;
    sun.shadow.mapSize.width = shadowSize;
    sun.shadow.mapSize.height = shadowSize;
    const ext = o.shadowExtent || 16;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -ext;
    sun.shadow.camera.right = ext;
    sun.shadow.camera.top = ext;
    sun.shadow.camera.bottom = -ext;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const rim = new THREE.DirectionalLight(o.rimColor || "#7AC8FF", o.rimIntensity !== undefined ? o.rimIntensity : 0.55);
    rim.position.set(-10, 8, -12);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(o.fov || 42, W / Math.max(1, H), 0.1, 260);
    camera.position.set(10, 8, 14);
    camera.lookAt(0, 1.2, 0);
    const lookTarget = new THREE.Vector3(0, 1.2, 0);

    const cam3D = {
      splineDolly(progress, controlPts, targetPt, opts) {
        const co = opts || {};
        if (!Array.isArray(controlPts) || controlPts.length < 2) return;
        const vecs = controlPts.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]));
        const curve = new THREE.CatmullRomCurve3(vecs);
        const u = ease.apple(clampNum(progress, 0, 1));
        const pos = curve.getPoint(u);
        const breath = co.breath !== undefined ? co.breath : 0.08;
        camera.position.set(
          pos.x + Math.sin(t * 1.1) * breath,
          pos.y + Math.cos(t * 0.85) * breath * 0.7,
          pos.z
        );
        if (typeof targetPt === "function") {
          const tp = targetPt(u);
          if (tp) lookTarget.set(tp[0], tp[1], tp[2]);
        } else if (Array.isArray(targetPt)) {
          lookTarget.set(targetPt[0], targetPt[1], targetPt[2]);
        }
        camera.lookAt(lookTarget);
      },
      orbit(progress, center, radius, height, startAz, endAz, opts) {
        const co = opts || {};
        const c = center || [0, 1, 0];
        const u = co.ease ? co.ease(clampNum(progress, 0, 1)) : ease.apple(clampNum(progress, 0, 1));
        const az = lerpNum(startAz !== undefined ? startAz : -0.6, endAz !== undefined ? endAz : 0.9, u);
        const r = Array.isArray(radius) ? lerpNum(radius[0], radius[1], u) : (radius || 14);
        const h = Array.isArray(height) ? lerpNum(height[0], height[1], u) : (height !== undefined ? height : 7.5);
        camera.position.set(c[0] + Math.sin(az) * r, c[1] + h + Math.sin(t * 0.9) * 0.06, c[2] + Math.cos(az) * r);
        lookTarget.set(c[0], c[1], c[2]);
        camera.lookAt(lookTarget);
      },
      pan(progress, fromPos, toPos, targetPos) {
        const u = ease.apple(clampNum(progress, 0, 1));
        camera.position.set(
          lerpNum(fromPos[0], toPos[0], u),
          lerpNum(fromPos[1], toPos[1], u),
          lerpNum(fromPos[2], toPos[2], u)
        );
        if (targetPos) lookTarget.set(targetPos[0], targetPos[1], targetPos[2]);
        camera.lookAt(lookTarget);
      },
      tilt(progress, fromPitch, toPitch, dist) {
        const u = ease.apple(clampNum(progress, 0, 1));
        const pitch = lerpNum(fromPitch, toPitch, u);
        const d = dist || 10;
        lookTarget.set(camera.position.x, camera.position.y + Math.sin(pitch) * d, camera.position.z - Math.cos(pitch) * d);
        camera.lookAt(lookTarget);
      },
      focusOn(target, opts) {
        const co = opts || {};
        const dist = co.distance || 8.5;
        const az = co.azimuth !== undefined ? co.azimuth : 0.45;
        const elev = co.elevation !== undefined ? co.elevation : 0.36;
        const sp = co.progress !== undefined ? ease.apple(clampNum(co.progress, 0, 1)) : 1;
        const tx = target[0], ty = target[1], tz = target[2];
        const gx = tx + Math.sin(az) * Math.cos(elev) * dist;
        const gy = ty + Math.sin(elev) * dist;
        const gz = tz + Math.cos(az) * Math.cos(elev) * dist;
        camera.position.lerp(new THREE.Vector3(gx, gy, gz), sp);
        lookTarget.lerp(new THREE.Vector3(tx, ty, tz), sp);
        camera.lookAt(lookTarget);
      }
    };

    const boxGeo = (w, h, d) => getPooledThreeGeo("b:" + Math.round(w * 100) + ":" + Math.round(h * 100) + ":" + Math.round(d * 100), () => new THREE.BoxGeometry(w, h, d));
    const cylGeo = (rt, rb, h, s) => getPooledThreeGeo("c:" + Math.round(rt * 100) + ":" + Math.round(rb * 100) + ":" + Math.round(h * 100) + ":" + s, () => new THREE.CylinderGeometry(rt, rb, h, s));
    const coneGeo = (r, h, s) => getPooledThreeGeo("k:" + Math.round(r * 100) + ":" + Math.round(h * 100) + ":" + s, () => new THREE.ConeGeometry(r, h, s));
    const sphGeo = (r, ws, hs) => getPooledThreeGeo("s:" + Math.round(r * 100) + ":" + ws + ":" + hs, () => new THREE.SphereGeometry(r, ws, hs));

    function addTerrain(to) {
      const cfg = to || {};
      const grp = new THREE.Group();
      const size = cfg.size || 24;
      const th = cfg.thickness || 1.2;
      const base = new THREE.Mesh(
        boxGeo(size, th, size),
        getPooledStdMat({ color: cfg.color || "#3B5E42", roughness: cfg.roughness !== undefined ? cfg.roughness : 0.88, metalness: 0.04 })
      );
      base.position.y = -th * 0.5;
      base.receiveShadow = enableShadows;
      grp.add(base);

      if (cfg.grid !== false) {
        const grid = new THREE.GridHelper(size, cfg.divisions || 16, cfg.gridCenter || "#88C9A1", cfg.gridColor || "#2A4230");
        grid.position.y = 0.015;
        grid.userData.__ephemeralGeo = true;
        grid.userData.__ephemeralMat = true;
        if (grid.material) {
          grid.material.transparent = true;
          grid.material.opacity = cfg.gridOpacity !== undefined ? cfg.gridOpacity : 0.32;
        }
        grp.add(grid);
      }
      if (cfg.pos) grp.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      scene.add(grp);
      return grp;
    }

    function addVilla(vo) {
      const cfg = vo || {};
      const grp = new THREE.Group();
      const pop = cfg.progress !== undefined ? Math.max(0.001, springPop(cfg.progress, cfg.delay || 0)) : 1;
      const w = cfg.width || 4.8;
      const h = cfg.height || 2.8;
      const d = cfg.depth || 3.8;
      const floors = clampNum(cfg.floors || 2, 1, 5);
      const wallMat = getPooledStdMat({ color: cfg.wallColor || "#F3EFE8", roughness: 0.65, metalness: 0.05 });
      const woodMat = getPooledStdMat({ color: cfg.woodColor || "#9C6B43", roughness: 0.72, metalness: 0.04 });
      const roofMat = getPooledStdMat({ color: cfg.roofColor || "#252B36", roughness: 0.45, metalness: 0.25 });
      const glassMat = getPooledStdMat({
        color: cfg.windowColor || "#9ED6FF",
        emissive: cfg.glowColor || "#FFB86C",
        emissiveIntensity: cfg.glowIntensity !== undefined ? cfg.glowIntensity : 0.52,
        roughness: 0.12,
        metalness: 0.35
      });

      const deck = new THREE.Mesh(boxGeo(w + 1.2, 0.28, d + 1.2), woodMat);
      deck.position.y = 0.14;
      deck.castShadow = enableShadows;
      deck.receiveShadow = enableShadows;
      grp.add(deck);

      for (let f = 0; f < floors; f++) {
        const fw = f === 0 ? w : w * 0.84;
        const fd = f === 0 ? d : d * 0.82;
        const fy = 0.28 + f * (h * 0.62) + (h * 0.31);
        const fPop = cfg.progress !== undefined ? Math.max(0.001, springPop(cfg.progress, (cfg.delay || 0) + f * 0.12)) : 1;
        const floorGrp = new THREE.Group();
        floorGrp.scale.set(fPop, fPop, fPop);

        const body = new THREE.Mesh(boxGeo(fw, h * 0.62, fd), wallMat);
        body.position.set(f === 1 ? -w * 0.06 : 0, fy, 0);
        body.castShadow = enableShadows;
        body.receiveShadow = enableShadows;
        floorGrp.add(body);

        const win = new THREE.Mesh(boxGeo(fw * 0.72, h * 0.38, 0.08), glassMat);
        win.position.set(body.position.x, fy + 0.04, fd * 0.5 + 0.01);
        floorGrp.add(win);

        const slab = new THREE.Mesh(boxGeo(fw + 0.75, 0.18, fd + 0.85), roofMat);
        slab.position.set(body.position.x, fy + h * 0.31 + 0.09, 0.12);
        slab.castShadow = enableShadows;
        slab.receiveShadow = enableShadows;
        floorGrp.add(slab);

        grp.add(floorGrp);
      }

      grp.scale.set(pop, pop, pop);
      if (cfg.pos) grp.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      if (cfg.rotY) grp.rotation.y = cfg.rotY;
      scene.add(grp);
      return grp;
    }

    function addTree(to) {
      const cfg = to || {};
      const grp = new THREE.Group();
      const sc = (cfg.scale || 1) * (cfg.progress !== undefined ? Math.max(0.001, springPop(cfg.progress, cfg.delay || 0)) : 1);
      const trunk = new THREE.Mesh(
        cylGeo(0.11, 0.18, 0.95, 7),
        getPooledStdMat({ color: cfg.trunkColor || "#6E4732", roughness: 0.9, metalness: 0.02 })
      );
      trunk.position.y = 0.47;
      trunk.castShadow = enableShadows;
      grp.add(trunk);

      const leafMat = getPooledStdMat({ color: cfg.leafColor || "#2E9E5B", roughness: 0.75, metalness: 0.02, flatShading: true });
      const tiers = cfg.tiers || 3;
      for (let i = 0; i < tiers; i++) {
        const cone = new THREE.Mesh(coneGeo(0.85 - i * 0.18, 1.15 - i * 0.12, 7), leafMat);
        cone.position.y = 1.15 + i * 0.55;
        cone.castShadow = enableShadows;
        cone.receiveShadow = enableShadows;
        grp.add(cone);
      }
      const sway = Math.sin(t * 1.8 + (cfg.pos ? cfg.pos[0] : 0)) * 0.035;
      grp.rotation.z = sway;
      grp.scale.set(sc, sc, sc);
      if (cfg.pos) grp.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      scene.add(grp);
      return grp;
    }

    function addPool(po) {
      const cfg = po || {};
      const grp = new THREE.Group();
      const pw = cfg.width || 4.2;
      const pd = cfg.depth || 2.4;
      const pop = cfg.progress !== undefined ? Math.max(0.001, springPop(cfg.progress, cfg.delay || 0)) : 1;

      const rim = new THREE.Mesh(
        boxGeo(pw + 0.45, 0.24, pd + 0.45),
        getPooledStdMat({ color: cfg.rimColor || "#E4E8EE", roughness: 0.5, metalness: 0.05 })
      );
      rim.position.y = 0.12;
      rim.receiveShadow = enableShadows;
      grp.add(rim);

      const wSegX = isExportMode ? 24 : 12;
      const wSegY = isExportMode ? 16 : 8;
      const waterGeo = new THREE.PlaneGeometry(pw, pd, wSegX, wSegY);
      const posAttr = waterGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const wave = Math.sin(vx * 3.2 + t * 3.4) * 0.025 + Math.cos(vy * 4.0 - t * 2.8) * 0.02;
        posAttr.setZ(i, wave);
      }
      waterGeo.computeVertexNormals();
      const waterMat = getPooledStdMat({
        color: cfg.waterColor || "#22B8E6",
        emissive: "#0A4C6E",
        emissiveIntensity: 0.32,
        roughness: 0.08,
        metalness: 0.45,
        transparent: true,
        opacity: 0.88
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.userData.__ephemeralGeo = true;
      water.rotation.x = -Math.PI * 0.5;
      water.position.y = 0.25;
      water.receiveShadow = enableShadows;
      grp.add(water);

      grp.scale.set(pop, pop, pop);
      if (cfg.pos) grp.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      scene.add(grp);
      return grp;
    }

    function addExtrude(points2D, eo) {
      const cfg = eo || {};
      if (!Array.isArray(points2D) || points2D.length < 3) return null;
      const shape = new THREE.Shape();
      shape.moveTo(points2D[0][0], points2D[0][1]);
      for (let i = 1; i < points2D.length; i++) shape.lineTo(points2D[i][0], points2D[i][1]);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: cfg.depth || 0.6,
        bevelEnabled: cfg.bevel !== false,
        bevelThickness: cfg.bevelThickness || 0.08,
        bevelSize: cfg.bevelSize || 0.06,
        bevelSegments: isExportMode ? 3 : 2
      });
      const mat = getPooledStdMat({
        color: cfg.color || "#5CC8FF",
        emissive: cfg.emissive || "#000000",
        emissiveIntensity: cfg.emissiveIntensity || 0,
        roughness: cfg.roughness !== undefined ? cfg.roughness : 0.35,
        metalness: cfg.metalness !== undefined ? cfg.metalness : 0.2
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.__ephemeralGeo = true;
      mesh.castShadow = enableShadows;
      mesh.receiveShadow = enableShadows;
      if (cfg.pos) mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      if (cfg.rot) mesh.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
      scene.add(mesh);
      return mesh;
    }

    function addBox(pos, size, matCfg) {
      const m = matCfg || {};
      const mesh = new THREE.Mesh(
        boxGeo(size[0], size[1], size[2]),
        getPooledStdMat({
          color: m.color || "#E2E8F0",
          emissive: m.emissive || "#000000",
          emissiveIntensity: m.emissiveIntensity || 0,
          roughness: m.roughness !== undefined ? m.roughness : 0.5,
          metalness: m.metalness !== undefined ? m.metalness : 0.1
        })
      );
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.castShadow = enableShadows && m.castShadow !== false;
      mesh.receiveShadow = enableShadows && m.receiveShadow !== false;
      scene.add(mesh);
      return mesh;
    }

    function addSphere(pos, radius, matCfg) {
      const m = matCfg || {};
      const segW = isExportMode ? 24 : 16;
      const segH = isExportMode ? 18 : 12;
      const mesh = new THREE.Mesh(
        sphGeo(radius || 0.6, segW, segH),
        getPooledStdMat({
          color: m.color || "#7AC8FF",
          emissive: m.emissive || "#000000",
          emissiveIntensity: m.emissiveIntensity || 0,
          roughness: m.roughness !== undefined ? m.roughness : 0.25,
          metalness: m.metalness !== undefined ? m.metalness : 0.2
        })
      );
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.castShadow = enableShadows && m.castShadow !== false;
      mesh.receiveShadow = enableShadows && m.receiveShadow !== false;
      scene.add(mesh);
      return mesh;
    }

    function addGlowOrb(pos, radius, color, intensity) {
      const orb = addSphere(pos, radius || 0.25, { color: color || "#FFE08A", emissive: color || "#FFE08A", emissiveIntensity: 1.8, castShadow: false });
      const pt = new THREE.PointLight(color || "#FFE08A", intensity || 1.6, 10);
      pt.position.set(pos[0], pos[1], pos[2]);
      scene.add(pt);
      return orb;
    }

    function renderTo(targetCtx, alpha) {
      renderer.setClearColor(0x000000, o.transparent ? 0 : 1);
      renderer.render(scene, camera);
      targetCtx.save();
      if (alpha !== undefined) targetCtx.globalAlpha *= clampNum(alpha, 0, 1);
      targetCtx.drawImage(__threeCanvas, 0, 0, W, H);
      targetCtx.restore();
      disposeEphemeralObjects(scene);
    }

    return {
      available: true,
      THREE: typeof THREE !== "undefined" ? THREE : null,
      scene,
      camera,
      cam3D,
      addTerrain,
      addVilla,
      addBuilding: addVilla,
      addTree,
      addPool,
      addExtrude,
      addBox,
      addSphere,
      addGlowOrb,
      addLight(pos, color, intensity, distance) {
        const pt = new THREE.PointLight(color || "#FFFFFF", intensity || 1.2, distance || 12);
        pt.position.set(pos[0], pos[1], pos[2]);
        scene.add(pt);
        return pt;
      },
      addGroup() { const g = new THREE.Group(); scene.add(g); return g; },
      renderTo
    };
  }

  return Object.freeze({
    isAvailable: () => ensureThreeLoaded(),
    createScene,
    springPop
  });
}
