// =======================================================
// EXPRESSIVE 2-BONE ARTICULATED 3D CHARACTERS (v3) & CREATURE MASCOTS
// =======================================================
function evalCharacterPose(name, tSec) {
  const cycW = tSec * 7.2, cycR = tSec * 10.5, jCyc = tSec * 5.6;
  switch (name) {
    case "walk": {
      const s = Math.sin(cycW);
      return {
        bounceY: Math.abs(s) * 0.085, squashY: 1 + Math.cos(cycW * 2) * 0.035, leanX: 0.10, twistY: s * 0.14,
        lHipX: s * 0.52, lKneeX: Math.max(0, -s) * 0.65, rHipX: -s * 0.52, rKneeX: Math.max(0, s) * 0.65,
        lShX: -s * 0.48, lShZ: -0.22, lElbX: -0.35 - Math.max(0, s) * 0.35,
        rShX: s * 0.48, rShZ: 0.22, rElbX: -0.35 - Math.max(0, -s) * 0.35
      };
    }
    case "run": {
      const s = Math.sin(cycR);
      return {
        bounceY: Math.abs(s) * 0.14, squashY: 1 + Math.cos(cycR * 2) * 0.05, leanX: 0.22, twistY: s * 0.20,
        lHipX: s * 0.80, lKneeX: Math.max(0, -s) * 1.15, rHipX: -s * 0.80, rKneeX: Math.max(0, s) * 1.15,
        lShX: -s * 0.85, lShZ: -0.26, lElbX: -1.10,
        rShX: s * 0.85, rShZ: 0.26, rElbX: -1.10
      };
    }
    case "wave": {
      const wv = Math.sin(tSec * 8.4);
      return {
        bounceY: Math.sin(tSec * 4.0) * 0.035, squashY: 1 + Math.sin(tSec * 4.0) * 0.025, leanX: 0.03, twistY: -0.10,
        lHipX: 0, lKneeX: 0.04, rHipX: 0, rKneeX: 0.04,
        lShX: 0.08, lShZ: -0.28, lElbX: -0.22,
        rShX: -0.32, rShZ: 2.05 + wv * 0.22, rElbX: -0.45 - wv * 0.32
      };
    }
    case "pour": {
      const nod = Math.sin(tSec * 3.4) * 0.14;
      return {
        bounceY: Math.sin(tSec * 3.0) * 0.025, squashY: 1.0, leanX: 0.12, twistY: -0.18,
        lHipX: -0.06, lKneeX: 0.12, rHipX: 0.06, rKneeX: 0.12,
        lShX: 0.18, lShZ: -0.36, lElbX: -0.40,
        rShX: -0.78 - nod, rShZ: 0.18, rElbX: -0.52 - nod * 0.5
      };
    }
    case "spray": {
      const sq = Math.pow(0.5 + 0.5 * Math.sin(tSec * 7.0), 3);
      return {
        bounceY: Math.sin(tSec * 3.5) * 0.02, squashY: 1.0, leanX: 0.08, twistY: -0.22,
        lHipX: 0, lKneeX: 0.08, rHipX: 0, rKneeX: 0.08,
        lShX: 0.12, lShZ: -0.30, lElbX: -0.35,
        rShX: -1.18 - sq * 0.08, rShZ: 0.12, rElbX: -0.32
      };
    }
    case "point": {
      return {
        bounceY: Math.sin(tSec * 3.2) * 0.025, squashY: 1.0, leanX: 0.04, twistY: -0.16,
        lHipX: 0, lKneeX: 0.05, rHipX: 0, rKneeX: 0.05,
        lShX: 0.14, lShZ: -0.28, lElbX: -0.38,
        rShX: -1.32, rShZ: 0.32, rElbX: -0.12
      };
    }
    case "present": {
      const sw = Math.sin(tSec * 3.0) * 0.08;
      return {
        bounceY: Math.sin(tSec * 3.0) * 0.03, squashY: 1.02, leanX: 0.02, twistY: 0.08,
        lHipX: 0, lKneeX: 0.04, rHipX: 0, rKneeX: 0.04,
        lShX: -0.55 + sw, lShZ: -0.58, lElbX: -0.55,
        rShX: -0.68 - sw, rShZ: 0.78, rElbX: -0.45
      };
    }
    case "think": {
      return {
        bounceY: Math.sin(tSec * 2.4) * 0.02, squashY: 1.0, leanX: 0.06, twistY: 0.08,
        lHipX: 0, lKneeX: 0.06, rHipX: 0, rKneeX: 0.06,
        lShX: 0.12, lShZ: -0.22, lElbX: -0.45,
        rShX: -0.95, rShZ: -0.18, rElbX: -1.45
      };
    }
    case "sad": {
      return {
        bounceY: Math.sin(tSec * 2.0) * 0.015 - 0.03, squashY: 0.96, leanX: 0.18, twistY: 0,
        lHipX: 0.08, lKneeX: 0.14, rHipX: 0.08, rKneeX: 0.14,
        lShX: 0.25, lShZ: -0.14, lElbX: -0.25,
        rShX: 0.25, rShZ: 0.14, rElbX: -0.25
      };
    }
    case "jump":
    case "joy": {
      const j = Math.abs(Math.sin(jCyc));
      return {
        bounceY: j * 0.28, squashY: j > 0.16 ? (1 + j * 0.07) : 0.92, leanX: -0.06 * j, twistY: Math.sin(jCyc) * 0.08,
        lHipX: -0.24 * j, lKneeX: 0.45 * j, rHipX: 0.20 * j, rKneeX: 0.45 * j,
        lShX: -0.20, lShZ: -2.15 - j * 0.32, lElbX: -0.35,
        rShX: -0.20, rShZ: 2.15 + j * 0.32, rElbX: -0.35
      };
    }
    default: // idle
      return {
        bounceY: Math.sin(tSec * 3.2) * 0.03, squashY: 1 + Math.sin(tSec * 3.2) * 0.022, leanX: 0.04, twistY: Math.sin(tSec * 1.4) * 0.04,
        lHipX: 0, lKneeX: 0.04, rHipX: 0, rKneeX: 0.04,
        lShX: 0.10, lShZ: -0.24, lElbX: -0.28,
        rShX: 0.10, rShZ: 0.24, rElbX: -0.28
      };
  }
}

function blendPoses(a, b, u) {
  const k = ease.apple(clampNum(u, 0, 1)), out = {};
  Object.keys(a).forEach((key) => { out[key] = lerpNum(a[key], b[key], k); });
  return out;
}

// Analytical 2-Bone Arm IK in Character Local Space
function solveArmIK(shoulderLocal, targetLocal, upperLen, foreLen, sideSign) {
  const dx = targetLocal[0] - shoulderLocal[0];
  const dy = targetLocal[1] - shoulderLocal[1];
  const dz = targetLocal[2] - shoulderLocal[2];
  const dist = clampNum(Math.hypot(dx, dy, dz), 0.08, upperLen + foreLen - 0.01);
  const cosBend = clampNum((upperLen*upperLen + foreLen*foreLen - dist*dist) / (2 * upperLen * foreLen), -1, 1);
  const elbowBend = -(Math.PI - Math.acos(cosBend));
  const horiz = Math.hypot(dx, dz) || 0.0001;
  const pitchToTgt = -Math.atan2(dz, -dy);
  const shZ = clampNum(Math.atan2(dx, Math.max(0.15, -dy + 0.35)) * 0.85, -2.4, 2.4);
  const cosA = clampNum((upperLen*upperLen + dist*dist - foreLen*foreLen) / (2 * upperLen * dist), -1, 1);
  const lift = Math.acos(cosA);
  return { shX: clampNum(pitchToTgt - lift * 0.75, -2.4, 1.4), shZ: shZ || (sideSign * 0.22), elbX: clampNum(elbowBend, -2.1, -0.08) };
}

function attachActorBuilders(g3dObj, tSec) {
  // 1) EXPRESSIVE 2-BONE ARTICULATED 3D CHARACTER (v3)
  const buildChar = (parentNode, cfg) => {
    const c = cfg || {};
    const skin = c.skinColor || "#F2B892";
    const shirt = c.shirtColor || "#FFFFFF";
    const overalls = c.overallColor || "#1E8E4E";
    const hair = c.hairColor || "#38241C";
    const hatCol = c.hatColor || "#E4AE48";
    const bootCol = c.bootColor || "#5A3826";
    const eyeCol = c.eyeColor || "#1E354D";
    const matStyle = c.material || "clay"; // "clay" | "toon" | "standard"
    const outlineW = c.outline !== undefined ? c.outline : (matStyle === "toon" ? 0.022 : 0);
    const outCol = c.outlineColor || "#1B2028";
    const mkMat = (col, extra) => Object.assign({ color: col, material: matStyle, outline: outlineW, outlineColor: outCol }, extra || {});

    // Smooth Pose Morphing (pose / poseFrom -> poseTo with blend [0..1])
    const pA = evalCharacterPose(c.poseFrom || c.pose || "idle", tSec);
    const poseData = (c.poseTo && c.blend !== undefined) ? blendPoses(pA, evalCharacterPose(c.poseTo, tSec), c.blend) : pA;

    const pos = c.pos || [0, 0, 0], rot = c.rot || [0, 0, 0], scale = c.scale !== undefined ? c.scale : 1;
    const bodyYaw = rot[1] || 0;

    // Automatic headLookAt toward any 3D world point!
    let headYaw = c.headYaw || 0, headPitch = c.headPitch || 0, headRoll = c.headRoll || 0;
    if (Array.isArray(c.headLookAt)) {
      const hx = pos[0], hy = pos[1] + 1.22 * scale, hz = pos[2];
      const lx = c.headLookAt[0] - hx, ly = c.headLookAt[1] - hy, lz = c.headLookAt[2] - hz;
      const worldYaw = Math.atan2(lx, lz);
      let relYaw = worldYaw - bodyYaw;
      while (relYaw > Math.PI) relYaw -= Math.PI * 2;
      while (relYaw < -Math.PI) relYaw += Math.PI * 2;
      headYaw = clampNum(relYaw, -0.85, 0.85);
      headPitch = clampNum(-Math.atan2(ly, Math.hypot(lx, lz) || 0.01), -0.45, 0.45);
    }

    // Optional Analytical 2-Bone Arm IK for rightHandTarget / leftHandTarget
    const toLocal = (wPt) => {
      const dx = (wPt[0] - pos[0]) / scale, dy = (wPt[1] - pos[1]) / scale, dz = (wPt[2] - pos[2]) / scale;
      const cy = Math.cos(-bodyYaw), sy = Math.sin(-bodyYaw);
      return [dx * cy + dz * sy, dy - (0.68 + poseData.bounceY), -dx * sy + dz * cy];
    };
    if (Array.isArray(c.rightHandTarget)) {
      const ik = solveArmIK([0.31, 0.18, 0], toLocal(c.rightHandTarget), 0.21, 0.20, 1);
      poseData.rShX = ik.shX; poseData.rShZ = ik.shZ; poseData.rElbX = ik.elbX;
    }
    if (Array.isArray(c.leftHandTarget)) {
      const ik = solveArmIK([-0.31, 0.18, 0], toLocal(c.leftHandTarget), 0.21, 0.20, -1);
      poseData.lShX = ik.shX; poseData.lShZ = ik.shZ; poseData.lElbX = ik.elbX;
    }

    const expr = c.expression || ((c.pose === "joy" || c.pose === "jump") ? "joy" : (c.pose === "sad" ? "sad" : "smile"));
    const blink = c.blink !== undefined ? c.blink : ((tSec % 3.4) > 3.24 ? 1 : 0);
    const talkOpen = c.talk ? (0.35 + 0.65 * Math.abs(Math.sin(tSec * 14.5) * Math.cos(tSec * 6.2))) * (c.talkAmp || 1.0) : 0;

    // Secondary delayed bounce for hair/hat/backpack!
    const secLag = Math.sin((tSec - 0.09) * 3.8) * 0.04;

    const root = parentNode.node({ pos, rot, scale });
    if (c.shadow !== false) {
      root.shadow([0, 0.005, 0], 0.56 * (1 - poseData.bounceY * 0.45), 0.48 * (1 - poseData.bounceY * 0.45), 0.36);
    }

    const hips = root.node({ pos: [0, 0.45 + poseData.bounceY, 0], scale: [1 / Math.sqrt(poseData.squashY), poseData.squashY, 1 / Math.sqrt(poseData.squashY)] });

    // 2-BONE LEGS (Thigh -> Knee -> Calf -> Boot)
    [-1, 1].forEach((side) => {
      const hipX = side < 0 ? poseData.lHipX : poseData.rHipX;
      const kneeX = side < 0 ? poseData.lKneeX : poseData.rKneeX;
      const hipJ = hips.node({ pos: [side * 0.155, 0.0, 0], rot: [hipX, 0, 0] });
      hipJ.capsule([0, -0.10, 0], 0.095, 0.14, [0, 0, 0], mkMat(overalls, { material: matStyle === "toon" ? "toon" : "fabric", roughness: 0.72 }), 16);
      const kneeJ = hipJ.node({ pos: [0, -0.20, 0], rot: [kneeX, 0, 0] });
      kneeJ.capsule([0, -0.09, 0], 0.084, 0.13, [0, 0, 0], mkMat(overalls, { material: matStyle === "toon" ? "toon" : "fabric", roughness: 0.72 }), 16);
      kneeJ.ellipsoid([0, -0.20, 0.055], [0.115, 0.078, 0.165], [0, 0, 0], mkMat(bootCol, { roughness: 0.48 }), 16);
    });

    // TORSO + OVERALLS / APRON + BACKPACK
    const torso = hips.node({ pos: [0, 0.24, 0], rot: [poseData.leanX, poseData.twistY, 0] });
    torso.roundBox([0, 0.02, 0], [0.52, 0.52, 0.38], 0.18, [0, 0, 0], mkMat(shirt, { material: matStyle === "toon" ? "toon" : "fabric", roughness: 0.70 }));
    torso.roundBox([0, -0.05, 0.01], [0.54, 0.38, 0.40], 0.16, [0, 0, 0], mkMat(overalls, { material: matStyle === "toon" ? "toon" : "fabric", roughness: 0.72 }));
    [-1, 1].forEach((s) => {
      torso.box([s * 0.14, 0.18, 0.18], [0.06, 0.18, 0.04], [0, 0, 0], mkMat(overalls, { roughness: 0.65 }));
      torso.sphere([s * 0.14, 0.11, 0.208], 0.028, { color: "#F5C242", material: "brushed_metal", metalness: 0.88, roughness: 0.20 }, 12);
    });
    if (c.apron) {
      torso.roundBox([0, -0.08, 0.205], [0.38, 0.32, 0.03], 0.02, [0, 0, 0], mkMat(c.apronColor || "#E4AE48", { material: "fabric" }), 12);
    }
    if (c.backpack !== false) {
      torso.roundBox([0, 0.04 + secLag * 0.3, -0.24], [0.36, 0.38, 0.16], 0.07, [secLag * 0.5, 0, 0], mkMat("#C6643A", { roughness: 0.62 }));
    }

    // 2-BONE ARMS (Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand Socket!)
    let leftHand = null, rightHand = null;
    [-1, 1].forEach((side) => {
      const shX = side < 0 ? poseData.lShX : poseData.rShX;
      const shZ = side < 0 ? poseData.lShZ : poseData.rShZ;
      const elbX = side < 0 ? poseData.lElbX : poseData.rElbX;
      const shoulder = torso.node({ pos: [side * 0.31, 0.18, 0], rot: [shX, 0, shZ] });
      shoulder.capsule([0, -0.10, 0], 0.078, 0.14, [0, 0, 0], mkMat(shirt, { material: matStyle === "toon" ? "toon" : "fabric" }), 14);
      const elbow = shoulder.node({ pos: [0, -0.21, 0], rot: [elbX, 0, 0] });
      elbow.capsule([0, -0.095, 0], 0.068, 0.14, [0, 0, 0], mkMat(skin, { material: matStyle === "toon" ? "toon" : "skin", sss: 0.32 }), 14);
      const handNode = elbow.node({ pos: [0, -0.20, 0] });
      handNode.sphere([0, 0, 0], 0.082, mkMat(skin, { material: matStyle === "toon" ? "toon" : "skin", sss: 0.34 }), 14);
      if (side < 0) leftHand = handNode; else rightHand = handNode;
    });

    // HEAD, EYES, EXPRESSIVE BROWS, LIP-SYNC MOUTH & HAIR/HAT STYLES
    const head = torso.node({ pos: [0, 0.54, 0.02], rot: [headPitch + secLag * 0.4, headYaw, headRoll] });
    head.ellipsoid([0, 0.02, 0], [0.36, 0.34, 0.34], [0, 0, 0], mkMat(skin, { material: matStyle === "toon" ? "toon" : "skin", sss: 0.36 }), 32);
    [-1, 1].forEach((s) => head.sphere([s * 0.35, 0.0, -0.02], 0.076, mkMat(skin, { material: matStyle === "toon" ? "toon" : "skin", sss: 0.42 }), 14));

    // Nose & Cheeks
    head.ellipsoid([0, -0.02, 0.34], [0.054, 0.044, 0.050], [0, 0, 0], mkMat("#E29572", { material: matStyle === "toon" ? "toon" : "skin", sss: 0.4 }), 14);
    [-1, 1].forEach((s) => head.ellipsoid([s * 0.20, -0.07, 0.28], [0.072, 0.044, 0.032], [0, s * 0.45, 0], { color: "#FF6E86", material: "skin", sss: 0.38 }, 12));

    // Mouth with Auto Lip-Sync or Expression
    if (talkOpen > 0.08) {
      head.ellipsoid([0, -0.13, 0.305], [0.058, 0.022 + talkOpen * 0.048, 0.038], [0.1, 0, 0], { color: "#A82B3D", roughness: 0.38 }, 14);
    } else if (expr === "joy") {
      head.ellipsoid([0, -0.13, 0.30], [0.074, 0.052, 0.042], [0.15, 0, 0], { color: "#B83244", roughness: 0.38 }, 14);
    } else if (expr === "wow") {
      head.ellipsoid([0, -0.13, 0.31], [0.042, 0.050, 0.038], [0, 0, 0], { color: "#B83244", roughness: 0.38 }, 14);
    } else if (expr === "sad") {
      head.torus([0, -0.16, 0.30], 0.054, 0.016, [-0.2, 0, 0], { color: "#9E3442", roughness: 0.42 }, 18, 8);
    } else {
      head.torus([0, -0.11, 0.30], 0.058, 0.017, [0.25, 0, Math.PI], { color: "#9E3442", roughness: 0.42 }, 20, 10);
    }

    // Glossy Eyes & Expressive Eyebrows
    const browLift = expr === "joy" ? 0.024 : (expr === "focus" ? -0.012 : (expr === "sad" ? 0.012 : 0.008));
    const browTilt = expr === "focus" ? -0.22 : (expr === "sad" ? -0.26 : 0.14);
    [-1, 1].forEach((s) => {
      const isWink = (expr === "wink" && s > 0);
      const eyeOpenY = isWink ? 0.10 : lerpNum(1.0, 0.08, clampNum(blink, 0, 1));
      const ex = s * 0.135, ey = 0.045, ez = 0.295;
      head.ellipsoid([ex, ey, ez], [0.074, 0.084 * eyeOpenY, 0.044], [0, s * 0.22, 0], { color: "#FFFFFF", roughness: 0.08 }, 18);
      if (eyeOpenY > 0.25) {
        head.ellipsoid([ex + s * 0.008, ey, ez + 0.027], [0.048, 0.058 * eyeOpenY, 0.028], [0, s * 0.22, 0], { color: eyeCol, roughness: 0.06 }, 16);
        head.sphere([ex + s * 0.022, ey + 0.022, ez + 0.046], 0.017, { color: "#FFFFFF", unlit: true }, 8);
      }
      head.capsule([ex, ey + 0.108 + browLift, ez + 0.01], 0.016, 0.076, [0, s * 0.22, Math.PI * 0.5 + s * browTilt], mkMat(hair, { roughness: 0.72 }), 10);
    });

    // Optional Stylish Glasses
    if (c.glasses) {
      const gMat = { color: c.glassesColor || "#222832", material: "brushed_metal", metalness: 0.85, roughness: 0.18 };
      [-1, 1].forEach((s) => head.torus([s * 0.138, 0.045, 0.345], 0.095, 0.012, [0, s * 0.18, 0], gMat, 22, 8));
      head.box([0, 0.05, 0.36], [0.08, 0.018, 0.016], [0, 0, 0], gMat);
    }

    // Hair & Headgear Styles ("hat" | "sprout" | "bob" | "spiky" | "bun" | "curly")
    const hairStyle = c.hairStyle || (c.hat === false ? "sprout" : "hat");
    head.ellipsoid([0, 0.13, -0.04], [0.37, 0.26, 0.36], [-0.15, 0, 0], mkMat(hair, { roughness: 0.78 }), 24);
    if (hairStyle === "bun") {
      head.sphere([0, 0.38, -0.14], 0.16, mkMat(hair, { roughness: 0.78 }), 18);
    } else if (hairStyle === "spiky") {
      for (let k = -2; k <= 2; k++) head.cone([k * 0.10, 0.36, 0.08 - Math.abs(k) * 0.05], 0.085, 0.22, [-0.2, 0, -k * 0.22], mkMat(hair), 12);
    } else if (hairStyle === "curly") {
      for (let k = 0; k < 7; k++) {
        const a = (k / 6) * Math.PI - Math.PI * 0.5;
        head.sphere([Math.sin(a) * 0.34, 0.24 + Math.cos(a * 2) * 0.06, Math.cos(a) * 0.26 - 0.08], 0.13, mkMat(hair), 14);
      }
    } else if (hairStyle === "sprout") {
      const spNode = head.node({ pos: [0, 0.36, 0], rot: [secLag, 0, secLag * 1.4] });
      spNode.cylinder([0, 0.08, 0], 0.02, 0.015, 0.18, [0, 0, 0], { color: "#229652", material: "foliage" }, 10);
      spNode.leaf([0, 0.16, 0], [0.3, 0.4, 0], 0.25, 0.12, 0.05, { color: "#28B862", color2: "#6CE896", material: "foliage" });
      spNode.leaf([0, 0.16, 0], [0.3, -2.6, 0], 0.23, 0.11, 0.05, { color: "#34C76E", color2: "#7EF0A4", material: "foliage" });
    } else if (hairStyle === "hat") {
      const hatNode = head.node({ pos: [0, 0.26, -0.02], rot: [-0.12 + secLag * 0.6, 0, 0] });
      hatNode.cylinder([0, 0, 0], 0.56, 0.52, 0.036, [0, 0, 0], mkMat(hatCol, { material: matStyle === "toon" ? "toon" : "fabric" }), 32);
      hatNode.ellipsoid([0, 0.06, 0], [0.33, 0.18, 0.33], [0, 0, 0], mkMat(hatCol, { material: matStyle === "toon" ? "toon" : "fabric" }), 26);
      hatNode.torus([0, 0.025, 0], 0.335, 0.022, [Math.PI * 0.5, 0, 0], mkMat(overalls), 32, 10);
    }

    return { root, hips, torso, head, leftHand, rightHand };
  };

  g3dObj.character = buildChar;
  g3dObj.stylizedCharacter = buildChar;

  // 2) NON-HUMAN 3D CREATURES & MASCOTS (plant_buddy, aphid, caterpillar, mini_robot, chibi_mascot)
  g3dObj.creature = (parentNode, type, cfg) => {
    const c = cfg || {};
    const bounce = Math.abs(Math.sin(tSec * (c.speed || 4.5))) * (c.hop !== undefined ? c.hop : 0.08);
    const root = parentNode.node({ pos: c.pos || [0, 0, 0], rot: c.rot || [0, 0, 0], scale: c.scale || 1 });
    if (c.shadow !== false) root.shadow([0, 0.005, 0], 0.45, 0.45, 0.34);

    if (type === "aphid" || type === "caterpillar") {
      // Expressive Garden Pest (Aphid or Multi-Segment Crawling Caterpillar!)
      const col = c.color || (type === "aphid" ? "#84D938" : "#68C446");
      const segs = type === "caterpillar" ? 5 : 2;
      const body = root.node({ pos: [0, 0.22 + bounce * 0.4, 0] });
      for (let i = 0; i < segs; i++) {
        const wv = Math.sin(tSec * 6.5 - i * 0.85) * 0.05;
        const r = i === 0 ? 0.24 : lerpNum(0.22, 0.14, i / segs);
        body.ellipsoid([wv * 0.6, Math.max(0, wv), -i * 0.24], [r, r * 0.92, r * 1.05], [0, 0, 0], {
          color: col, color2: "#B8F268", material: c.material || "clay", sss: 0.42
        }, 20);
      }
      // Big expressive eyes & antennae on head segment
      const scared = c.expression === "scared" || c.expression === "wow";
      [-1, 1].forEach((s) => {
        body.sphere([s * 0.11, 0.08, 0.20], scared ? 0.075 : 0.062, { color: "#FFFFFF", roughness: 0.08 }, 14);
        body.sphere([s * 0.11, 0.08, 0.25], scared ? 0.028 : 0.036, { color: "#141A20", roughness: 0.06 }, 12);
        body.sphere([s * 0.125, 0.10, 0.275], 0.012, { color: "#FFFFFF", unlit: true }, 6);
        body.tube([[s * 0.07, 0.19, 0.10], [s * 0.15, 0.34, 0.18 + Math.sin(tSec * 5 + s) * 0.04]], 0.016, 0.010, { color: "#3A6E24" }, 8);
        body.sphere([s * 0.15, 0.35, 0.18 + Math.sin(tSec * 5 + s) * 0.04], 0.026, { color: "#FFD166" }, 8);
      });
      if (scared) body.ellipsoid([0, -0.06, 0.23], [0.05, 0.065, 0.03], [0, 0, 0], { color: "#9C2634" }, 12);
      else body.torus([0, -0.05, 0.22], 0.055, 0.015, [0.2, 0, Math.PI], { color: "#3A6E24" }, 16, 8);
      return { root, body };
    }

    if (type === "mini_robot") {
      const body = root.node({ pos: [0, 0.56 + Math.sin(tSec * 3.0) * 0.07, 0] });
      body.roundBox([0, 0, 0], [0.62, 0.56, 0.52], 0.20, [0, 0, 0], { color: c.color || "#DCE6F2", color2: "#FFFFFF", material: "brushed_metal", roughness: 0.18, metalness: 0.72 }, 20);
      body.roundBox([0, 0.04, 0.23], [0.48, 0.28, 0.08], 0.08, [0, 0, 0], { color: "#0B111C", material: "glass", roughness: 0.08 }, 16);
      const glow = c.eyeColor || "#4CC8FF";
      [-1, 1].forEach((s) => {
        body.ellipsoid([s * 0.12, 0.05, 0.275], [0.055, 0.068, 0.015], [0, 0, 0], { color: glow, emissive: glow, unlit: true }, 12);
        const arm = body.node({ pos: [s * 0.42, -0.02, 0], rot: [Math.sin(tSec * 4 + s) * 0.35, 0, s * 0.25] });
        arm.capsule([0, -0.10, 0], 0.065, 0.16, [0, 0, 0], { color: "#9EB0C8", material: "brushed_metal" }, 12);
      });
      body.cylinder([0, 0.36, 0], 0.016, 0.012, 0.22, [0, 0, 0], { color: "#9EB0C8", material: "brushed_metal" }, 10);
      body.sphere([0, 0.48, 0], 0.048, { color: glow, emissive: glow }, 12);
      return { root, body };
    }

    // Default: "plant_buddy" or "chibi_mascot" — Living Cute Potted Plant Mascot!
    const body = root.node({ pos: [0, bounce, 0] });
    body.lathe([[0, 0], [0.28, 0], [0.36, 0.38], [0.42, 0.40], [0.42, 0.48], [0.35, 0.48], [0, 0.44]], [0, 0, 0], [0, 0, 0], {
      color: c.potColor || "#A84224", color2: "#DC6A40", material: "terracotta"
    }, 32);
    [-1, 1].forEach((s) => {
      body.sphere([s * 0.12, 0.25, 0.33], 0.052, { color: "#FFFFFF", roughness: 0.08 }, 12);
      body.sphere([s * 0.12, 0.25, 0.37], 0.030, { color: "#1A2228", roughness: 0.06 }, 12);
      body.sphere([s * 0.132, 0.265, 0.392], 0.010, { color: "#FFFFFF", unlit: true }, 6);
      body.leaf([s * 0.34, 0.30, 0.05], [0.2, s * 1.4, Math.sin(tSec * 6 + s) * 0.35], 0.34, 0.15, 0.06, { color: "#229652", color2: "#5AE086", material: "foliage" });
    });
    body.torus([0, 0.16, 0.34], 0.048, 0.014, [0.2, 0, Math.PI], { color: "#521C10" }, 16, 8);
    body.flower(c.flowerType || "chili_plant", [0, 0.42, 0], { grow: 0.85, bloom: 1.0, scale: 0.85 });
    return { root, body };
  };
}
