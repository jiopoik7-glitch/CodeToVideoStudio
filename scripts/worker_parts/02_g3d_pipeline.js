// =======================================================
// GPU WEBGL 4-PASS PIPELINE (SHADOWS + 12 PBR SHADERS + BLOOM + DOF + GOD RAYS + 6 LUTS)
// =======================================================
let glCanvas = null, gl = null, glW = 0, glH = 0, glShadowResCur = 0;
let glPbrProg = null, glShadowProg = null, glDepthProg = null;
let glBloomExtProg = null, glBloomBlurProg = null, glPostProg = null;
let glShadowFbo = null, glShadowTex = null, glShadowRb = null;
let glSceneFbo = null, glSceneTex = null, glSceneRb = null;
let glDepthFbo = null, glDepthTex = null, glDepthRb = null;
let glBloomFboA = null, glBloomTexA = null, glBloomFboB = null, glBloomTexB = null;
let glBufPos = null, glBufNorm = null, glBufUv = null, glBufIdx = null, glQuadBuf = null;
let glWhiteTex = null, glDynamicTex = null;
const glShaderCache = new Map();

const MAT_TYPE_MAP = {
  standard: 0, pbr: 0, toon: 1, cel: 1, clay: 2, skin: 3, fabric: 4, cloth: 4,
  foliage: 5, leaf: 5, terracotta: 6, wood: 7, water: 8, glass: 9,
  brushed_metal: 10, metal: 10, hologram: 11, marble: 12
};

const LUT_MAP = {
  none: 0, neutral: 0, pixar_warm: 1, ghibli_daylight: 2, apple_studio: 3,
  botanical_film: 4, kodak_portra: 5, cyber_nocturne: 6
};

const SHADOW_VS = `
attribute vec3 aPos;
uniform mat4 uLightVP;
uniform mat4 uModel;
varying float vDepth;
void main() {
  vec4 lp = uLightVP * uModel * vec4(aPos, 1.0);
  vDepth = lp.z / lp.w * 0.5 + 0.5;
  gl_Position = lp;
}`;

const SHADOW_FS = `
precision highp float;
varying float vDepth;
vec4 packDepth(float d) {
  vec4 enc = vec4(1.0, 255.0, 65025.0, 16581375.0) * clamp(d, 0.0, 1.0);
  enc = fract(enc);
  enc -= enc.yzww * vec4(1.0/255.0, 1.0/255.0, 1.0/255.0, 0.0);
  return enc;
}
void main() { gl_FragColor = packDepth(vDepth); }`;

const DEPTH_VS = `
attribute vec3 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec3 uEye;
varying float vLinDist;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vLinDist = length(uEye - wp.xyz) / 36.0;
  gl_Position = uProj * uView * wp;
}`;

const DEPTH_FS = `
precision highp float;
varying float vLinDist;
void main() {
  float d = clamp(vLinDist, 0.0, 1.0);
  gl_FragColor = vec4(d, d, d, 1.0);
}`;

const PBR_VS = `
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec2 aUv;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormMat;
uniform mat4 uLightVP;
uniform float uOutlineWidth;
varying vec3 vWorldPos;
varying vec3 vNorm;
varying vec2 vUv;
varying vec4 vLightPos;
void main() {
  vec3 pLocal = aPos + aNorm * uOutlineWidth;
  vec4 wp = uModel * vec4(pLocal, 1.0);
  vWorldPos = wp.xyz;
  vNorm = normalize(uNormMat * aNorm);
  vUv = aUv;
  vLightPos = uLightVP * wp;
  gl_Position = uProj * uView * wp;
}`;

const PBR_FS = `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vNorm;
varying vec2 vUv;
varying vec4 vLightPos;
uniform sampler2D uShadowMap;
uniform sampler2D uAlbedoTex;
uniform float uHasTex;
uniform float uShadowEnabled;
uniform float uShadowTexel;
uniform vec3 uShadowColor;
uniform vec3 uEye;
uniform vec3 uKeyDir;
uniform vec3 uFillDir;
uniform vec3 uRimDir;
uniform vec3 uKeyCol;
uniform vec3 uFillCol;
uniform vec3 uPtPos[4];
uniform vec3 uPtCol[4];
uniform vec2 uPtParam[4];
uniform vec3 uSpotPos;
uniform vec3 uSpotDir;
uniform vec3 uSpotCol;
uniform vec3 uSpotParam;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec3 uEmissive;
uniform vec3 uRimColor;
uniform float uRoughness;
uniform float uMetalness;
uniform float uRimPow;
uniform float uSss;
uniform float uAlpha;
uniform float uAmb;
uniform float uUnlit;
uniform float uFeatherShadow;
uniform float uDetail;
uniform float uMatType;
uniform float uTime;
uniform float uSkyMode;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyGround;
uniform vec3 uSunCol;
uniform vec3 uFogColor;
uniform vec2 uFogRange;

float unpackDepth(vec4 rgba) {
  return dot(rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0));
}

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x),
        mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
        mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z
  );
}

// 9-Tap Soft PCF Shadow Sampling
float calcShadow(vec3 N, vec3 L) {
  if (uShadowEnabled < 0.5) return 1.0;
  vec3 proj = vLightPos.xyz / vLightPos.w * 0.5 + 0.5;
  if (proj.x < 0.01 || proj.x > 0.99 || proj.y < 0.01 || proj.y > 0.99 || proj.z > 1.0) return 1.0;
  float bias = max(0.0020 * (1.0 - dot(N, L)), 0.0007);
  float cur = proj.z - bias;
  float vis = 0.0;
  float t = uShadowTexel * 1.45;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 off = vec2(float(x), float(y)) * t;
      vis += (cur <= unpackDepth(texture2D(uShadowMap, proj.xy + off))) ? 1.0 : 0.0;
    }
  }
  return vis / 9.0;
}

void main() {
  // 3D SKY DOME SHADER MODE
  if (uSkyMode > 0.5) {
    vec3 dir = normalize(vWorldPos - uEye);
    float y = dir.y;
    vec3 sky = y >= 0.0
      ? mix(uSkyHorizon, uSkyZenith, pow(clamp(y, 0.0, 1.0), 0.58))
      : mix(uSkyHorizon, uSkyGround, pow(clamp(-y, 0.0, 1.0), 0.55));
    vec3 sunDir = normalize(uKeyDir);
    float sunDot = max(dot(dir, sunDir), 0.0);
    sky += uSunCol * pow(sunDot, 22.0) * 0.55;
    sky += uSunCol * smoothstep(0.994, 0.9988, sunDot) * 1.45;
    // Starry night procedural stars when uSkyMode > 1.5
    if (uSkyMode > 1.5 && y > 0.02) {
      float st = hash3(floor(dir * 260.0));
      float starMask = smoothstep(0.9955, 0.9998, st) * smoothstep(0.02, 0.25, y);
      float twinkle = 0.65 + 0.35 * sin(uTime * 3.0 + st * 90.0);
      sky += vec3(0.95, 0.97, 1.0) * starMask * twinkle * 1.35;
    }
    gl_FragColor = vec4(clamp(sky, 0.0, 1.0), 1.0);
    return;
  }

  vec3 srgbBase = mix(uColor, uColor2, clamp(vUv.y, 0.0, 1.0));
  float alphaOut = clamp(uAlpha, 0.0, 1.0);
  if (uHasTex > 0.5) {
    vec4 tx = texture2D(uAlbedoTex, vec2(vUv.x, 1.0 - vUv.y));
    srgbBase = mix(srgbBase, tx.rgb, tx.a);
    alphaOut *= max(tx.a, 0.02);
  }

  if (uFeatherShadow > 0.5) {
    vec3 N0 = normalize(vNorm);
    float rDist = length(N0.xz);
    float falloff = pow(clamp(1.0 - rDist * 1.12, 0.0, 1.0), 2.1);
    float aS = clamp(alphaOut * falloff, 0.0, 1.0);
    gl_FragColor = vec4(srgbBase * aS, aS);
    return;
  }

  if (uUnlit > 0.5) {
    gl_FragColor = vec4(srgbBase * alphaOut, alphaOut);
    return;
  }

  vec3 baseCol = pow(max(srgbBase, vec3(0.0)), vec3(2.2));
  vec3 N = normalize(vNorm);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uEye - vWorldPos);
  vec3 L1 = normalize(uKeyDir);
  vec3 L2 = normalize(uFillDir);
  vec3 L3 = normalize(uRimDir);

  float rough = clamp(uRoughness, 0.05, 0.98);
  float metal = clamp(uMetalness, 0.0, 1.0);
  float sssAmt = uSss;
  int mt = int(uMatType + 0.5);

  // 12 PROCEDURAL PBR MATERIALS + MICRO-BUMP PERTURBATION
  vec3 wp = vWorldPos;
  if (mt == 2) { // clay
    float c1 = noise3(wp * 14.0), c2 = noise3(wp * 36.0);
    baseCol *= (0.94 + (c1 * 0.6 + c2 * 0.4) * 0.14);
    N = normalize(N + vec3(c1 - 0.5, c2 - 0.5, c1 - c2) * 0.09);
    rough = max(rough, 0.66);
  } else if (mt == 3) { // skin
    float p = noise3(wp * 42.0);
    baseCol *= (0.97 + p * 0.06);
    sssAmt = max(sssAmt, 0.36);
    rough = clamp(rough, 0.40, 0.62);
  } else if (mt == 4) { // fabric
    float weave = sin(wp.x * 165.0) * sin(wp.y * 165.0 + wp.z * 165.0);
    baseCol *= (0.94 + weave * 0.07);
    N = normalize(N + vec3(weave * 0.06, 0.0, weave * 0.06));
    rough = max(rough, 0.78);
  } else if (mt == 5) { // foliage
    float vein = abs(sin((vUv.x - 0.5) * 32.0 + vUv.y * 10.0));
    baseCol *= (0.90 + vein * 0.16);
    sssAmt = max(sssAmt, 0.42);
  } else if (mt == 6) { // terracotta
    float gr = noise3(wp * 26.0) * 0.6 + noise3(wp * 64.0) * 0.4;
    baseCol *= (0.86 + gr * 0.24);
    N = normalize(N + vec3(gr - 0.5) * 0.12);
    rough = max(rough, 0.68);
  } else if (mt == 7) { // wood
    float wDist = length(wp.xz * vec2(1.0, 1.2)) * 18.0 + noise3(wp * 4.5) * 3.5;
    float rings = 0.5 + 0.5 * sin(wDist + wp.y * 2.5);
    baseCol = mix(baseCol * 0.68, baseCol * 1.15, rings);
    rough = clamp(rough, 0.42, 0.72);
  } else if (mt == 8) { // water
    float w1 = sin(wp.x * 12.0 + uTime * 3.2) * cos(wp.z * 11.0 - uTime * 2.6);
    float w2 = noise3(wp * 9.0 + vec3(uTime * 1.2, 0.0, uTime * 0.9));
    N = normalize(N + vec3(w1 * 0.08 + (w2 - 0.5) * 0.08, 0.0, (w2 - 0.5) * 0.08));
    rough = 0.08;
    metal = 0.12;
  } else if (mt == 9) { // glass
    rough = 0.06;
    metal = 0.15;
    float frG = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    alphaOut = clamp(mix(alphaOut, 0.92, frG * 0.72), 0.12, 1.0);
  } else if (mt == 10) { // brushed_metal
    float brush = noise3(vec3(wp.x * 4.0, wp.y * 95.0, wp.z * 4.0));
    baseCol *= (0.90 + brush * 0.20);
    rough = clamp(rough, 0.10, 0.28);
    metal = max(metal, 0.88);
  } else if (mt == 11) { // hologram
    float ndvH = max(dot(N, V), 0.0);
    vec3 irid = 0.55 + 0.45 * cos(6.28318 * (ndvH * 1.4 + uTime * 0.22 + vec3(0.0, 0.33, 0.67)));
    baseCol = mix(baseCol, pow(irid, vec3(2.2)), 0.65);
    rough = 0.12;
    metal = 0.65;
  } else if (mt == 12) { // marble
    float mWave = sin(wp.x * 6.0 + wp.y * 4.0 + noise3(wp * 5.0) * 5.5);
    float veinM = smoothstep(0.75, 0.98, abs(mWave));
    baseCol = mix(baseCol, baseCol * 0.42, veinM * 0.55);
    rough = 0.16;
  } else if (uDetail > 0.001) {
    float det = (noise3(wp * 14.0) * 0.65 + noise3(wp * 34.0) * 0.35) - 0.5;
    baseCol *= (1.0 + det * uDetail);
  }

  float shadowVis = calcShadow(N, L1);
  vec3 shadowTint = mix(pow(max(uShadowColor, vec3(0.02)), vec3(2.2)), vec3(1.0), shadowVis);
  float ndl1 = max(dot(N, L1), 0.0);
  float ndl2 = max(dot(N, L2), 0.0);
  float ndv = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - ndv, 3.6);

  vec3 keyLin = pow(max(uKeyCol, vec3(0.0)), vec3(2.2));
  vec3 fillLin = pow(max(uFillCol, vec3(0.0)), vec3(2.2));

  // Dynamic 4 Point Lights + 1 Spot Light Accumulation
  vec3 dynDiff = vec3(0.0);
  vec3 dynSpec = vec3(0.0);
  float shininess = exp2(9.2 * (1.0 - rough) + 1.4);
  for (int i = 0; i < 4; i++) {
    float pInt = uPtParam[i].x;
    if (pInt > 0.001) {
      vec3 toL = uPtPos[i] - wp;
      float d = length(toL);
      float rad = max(uPtParam[i].y, 0.1);
      float att = pow(clamp(1.0 - d / rad, 0.0, 1.0), 2.0) * pInt;
      vec3 pL = toL / max(d, 0.001);
      float pNdl = max(dot(N, pL), 0.0);
      vec3 pCol = pow(max(uPtCol[i], vec3(0.0)), vec3(2.2));
      dynDiff += pCol * pNdl * att;
      vec3 pH = normalize(pL + V);
      dynSpec += pCol * pow(max(dot(N, pH), 0.0), shininess * 0.7) * att * 0.45;
    }
  }
  if (uSpotParam.x > 0.001) {
    vec3 toS = uSpotPos - wp;
    float dS = length(toS);
    vec3 sL = toS / max(dS, 0.001);
    float spotCos = dot(-sL, normalize(uSpotDir));
    float cone = smoothstep(uSpotParam.y, uSpotParam.y + 0.14, spotCos);
    float attS = pow(clamp(1.0 - dS / max(uSpotParam.z, 0.1), 0.0, 1.0), 1.8) * uSpotParam.x * cone;
    vec3 sCol = pow(max(uSpotCol, vec3(0.0)), vec3(2.2));
    dynDiff += sCol * max(dot(N, sL), 0.0) * attS;
    dynSpec += sCol * pow(max(dot(N, normalize(sL + V)), 0.0), shininess) * attS * 0.5;
  }

  vec3 col;
  if (mt == 1) {
    // 3-BAND STUDIO GHIBLI / SPIDER-VERSE TOON CEL SHADER
    float litVal = ndl1 * (0.35 + 0.65 * shadowVis);
    float band = litVal > 0.58 ? 1.0 : (litVal > 0.18 ? 0.66 : 0.36);
    vec3 toonShade = mix(pow(max(uShadowColor, vec3(0.1)), vec3(2.2)) * 1.4, keyLin, band);
    float toonSpec = smoothstep(0.86, 0.91, dot(N, normalize(L1 + V))) * shadowVis * (1.0 - rough) * 0.48;
    float toonRim = smoothstep(0.58, 0.72, 1.0 - ndv) * max(dot(N, L1) + 0.4, 0.0) * uRimPow * 0.55;
    col = baseCol * (toonShade + dynDiff * 0.7 + fillLin * ndl2 * 0.22 + vec3(uAmb * 0.45)) + vec3(toonSpec) + pow(max(uRimColor, vec3(0.0)), vec3(2.2)) * toonRim;
  } else {
    float wrap = max(0.0, (dot(N, L1) + 0.38) / 1.38);
    float sssTerm = (pow(max(0.0, dot(-L1, V)), 2.2) * 0.72 + wrap * 0.35) * sssAmt;
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(dot(N, H1), 0.0), shininess) * (0.14 + 0.86 * (1.0 - rough));

    // Procedural Studio HDRI Reflection
    vec3 R = reflect(-V, N);
    float skyT = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 envCol = skyT < 0.5
      ? mix(vec3(0.04, 0.05, 0.07), vec3(0.32, 0.38, 0.48), pow(skyT * 2.0, 1.5))
      : mix(vec3(0.32, 0.38, 0.48), vec3(0.76, 0.85, 0.98), pow((skyT - 0.5) * 2.0, 1.0));
    envCol += vec3(0.88, 0.90, 0.96) * smoothstep(0.76, 0.96, dot(R, normalize(vec3(0.45, 0.78, 0.42)))) * (1.0 - rough * 0.8);

    vec3 F0 = mix(vec3(0.035), baseCol, metal);
    vec3 F = F0 + (vec3(1.0) - F0) * fresnel;
    vec3 hemi = mix(vec3(0.24, 0.20, 0.17), vec3(0.58, 0.72, 0.92), N.y * 0.5 + 0.5) * uAmb;

    vec3 diff = baseCol * (1.0 - metal * 0.86) * (hemi + keyLin * ndl1 * shadowTint * 1.18 + fillLin * ndl2 * 0.40 + dynDiff);
    vec3 specCol = mix(vec3(1.0), baseCol, metal) * (spec1 * keyLin * shadowVis * (0.12 + 0.88 * metal + (1.0 - rough) * 0.25) + dynSpec);
    float envW = (0.02 + 0.98 * metal + (mt == 9 ? 0.65 : 0.0)) * (0.18 + 0.82 * (1.0 - rough));
    vec3 envRefl = envCol * F * envW;
    vec3 rimGlow = pow(max(uRimColor, vec3(0.0)), vec3(2.2)) * (fresnel * 0.42 + max(dot(N, L3), 0.0) * 0.22) * uRimPow * (0.25 + 0.75 * shadowVis);
    vec3 sssCol = baseCol * vec3(1.28, 0.88, 0.90) * sssTerm * (0.45 + 0.55 * shadowVis);
    col = diff + specCol + envRefl + rimGlow + sssCol;
  }

  col += pow(max(uEmissive, vec3(0.0)), vec3(2.2)) * 1.45;
  col = col / (1.0 + col * 0.36);
  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

  if (uFogRange.y > uFogRange.x) {
    float dist = length(uEye - wp);
    float fogF = smoothstep(uFogRange.x, uFogRange.y, dist);
    col = mix(col, uFogColor, fogF * 0.85);
  }
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col * alphaOut, alphaOut);
}`;

const QUAD_VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const BLOOM_EXT_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uThreshold;
void main() {
  vec4 c = texture2D(uTex, vUv);
  float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float knee = smoothstep(uThreshold - 0.14, uThreshold + 0.18, luma);
  gl_FragColor = vec4(c.rgb * knee, 1.0);
}`;

const BLOOM_BLUR_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uSpread;
void main() {
  vec2 d = uTexel * uSpread;
  vec3 sum = texture2D(uTex, vUv).rgb * 0.20;
  sum += texture2D(uTex, vUv + vec2(-d.x, -d.y)).rgb * 0.20;
  sum += texture2D(uTex, vUv + vec2( d.x, -d.y)).rgb * 0.20;
  sum += texture2D(uTex, vUv + vec2(-d.x,  d.y)).rgb * 0.20;
  sum += texture2D(uTex, vUv + vec2( d.x,  d.y)).rgb * 0.20;
  gl_FragColor = vec4(sum, 1.0);
}`;

const POST_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSceneTex;
uniform sampler2D uBloomTex;
uniform sampler2D uDepthTex;
uniform vec2 uRes;
uniform float uBloomStrength;
uniform float uDofFocus;
uniform float uDofAperture;
uniform float uGodRayStrength;
uniform vec2 uSunScreen;
uniform vec3 uSunColor;
uniform float uLutId;
uniform float uVibrancy;
uniform float uChromatic;
uniform float uVignette;
uniform float uHasSky;

vec3 applyCinemaLut(vec3 c, int id) {
  if (id == 1) { // pixar_warm
    c = pow(c, vec3(0.97, 0.99, 1.03));
    c *= vec3(1.04, 1.01, 0.96);
  } else if (id == 2) { // ghibli_daylight
    c = mix(c, pow(c, vec3(0.94, 0.96, 0.98)), 0.5);
    c *= vec3(1.02, 1.04, 1.01);
  } else if (id == 3) { // apple_studio
    c = smoothstep(vec3(0.015), vec3(0.985), c);
    c *= vec3(0.99, 1.00, 1.02);
  } else if (id == 4) { // botanical_film
    c.g = pow(c.g, 0.95);
    c *= vec3(0.99, 1.03, 0.96);
  } else if (id == 5) { // kodak_portra
    vec3 lift = vec3(0.018, 0.012, 0.008);
    c = lift + c * vec3(1.03, 1.00, 0.94);
  } else if (id == 6) { // cyber_nocturne
    c = smoothstep(vec3(0.02), vec3(0.97), c);
    c *= vec3(0.95, 1.01, 1.08);
  }
  return clamp(c, 0.0, 1.0);
}

void main() {
  vec2 texel = 1.0 / max(uRes, vec2(1.0));
  vec4 center = texture2D(uSceneTex, vUv);

  // Subtle Chromatic Aberration at lens edges
  vec4 sceneSample = center;
  if (uChromatic > 0.001) {
    vec2 dirC = (vUv - 0.5) * uChromatic * 0.007;
    float rCh = texture2D(uSceneTex, vUv + dirC).r;
    float bCh = texture2D(uSceneTex, vUv - dirC).b;
    sceneSample.r = rCh;
    sceneSample.b = bCh;
  }

  // Smooth Cinema Depth-of-Field (8-tap bokeh disc weighted by linear depth CoC)
  if (uDofAperture > 0.005) {
    float depth = texture2D(uDepthTex, vUv).r;
    float coc = clamp(abs(depth - uDofFocus) * uDofAperture * 9.5, 0.0, 7.5);
    if (coc > 0.35) {
      vec4 acc = sceneSample;
      float rad = coc;
      acc += texture2D(uSceneTex, vUv + vec2( rad, 0.0) * texel);
      acc += texture2D(uSceneTex, vUv + vec2(-rad, 0.0) * texel);
      acc += texture2D(uSceneTex, vUv + vec2(0.0,  rad) * texel);
      acc += texture2D(uSceneTex, vUv + vec2(0.0, -rad) * texel);
      float d7 = rad * 0.707;
      acc += texture2D(uSceneTex, vUv + vec2( d7,  d7) * texel);
      acc += texture2D(uSceneTex, vUv + vec2(-d7,  d7) * texel);
      acc += texture2D(uSceneTex, vUv + vec2( d7, -d7) * texel);
      acc += texture2D(uSceneTex, vUv + vec2(-d7, -d7) * texel);
      sceneSample = acc / 9.0;
    }
  }

  float a = clamp(sceneSample.a, 0.0, 1.0);
  vec3 col = a > 0.002 ? (sceneSample.rgb / a) : vec3(0.0);

  // Vibrancy + Cinema LUT Grade
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uVibrancy);
  col = applyCinemaLut(col, int(uLutId + 0.5));

  // Add Dual-Filter Kawase Bloom
  vec3 bloom = texture2D(uBloomTex, vUv).rgb * uBloomStrength;

  // Add Volumetric Screen-Space God Rays (Sun Shafts!)
  vec3 godRay = vec3(0.0);
  if (uGodRayStrength > 0.005) {
    vec2 delta = (vUv - uSunScreen) * (1.0 / 18.0) * 0.72;
    vec2 uvR = vUv;
    float decay = 1.0;
    float raySum = 0.0;
    for (int i = 0; i < 16; i++) {
      uvR -= delta;
      vec3 s = texture2D(uBloomTex, clamp(uvR, 0.0, 1.0)).rgb;
      raySum += dot(s, vec3(0.333)) * decay;
      decay *= 0.90;
    }
    float sunDistMask = clamp(1.25 - length(vUv - uSunScreen), 0.0, 1.0);
    godRay = uSunColor * (raySum / 14.0) * uGodRayStrength * sunDistMask;
  }

  // Optional Optical Lens Vignette
  if (uVignette > 0.005 && uHasSky > 0.5) {
    float vig = 1.0 - smoothstep(0.45, 1.05, length((vUv - 0.5) * vec2(1.15, 1.05))) * uVignette;
    col *= vig;
  }

  vec3 outPremul = col * a + bloom + godRay;
  float haloA = max(max(bloom.r, bloom.g), bloom.b) * 0.85 + max(max(godRay.r, godRay.g), godRay.b) * 0.55;
  float outA = clamp(a + haloA, 0.0, 1.0);
  gl_FragColor = vec4(clamp(outPremul, 0.0, 1.0), outA);
}`;

const SHADER_FS_HEADER = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uProgress;
mat2 rot2(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
float sdSphere(vec3 p, float r){ return length(p) - r; }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdRoundBox(vec3 p, vec3 b, float r){ return sdBox(p, b) - r; }
float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float sdCylinder(vec3 p, float r, float h){ vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0-h); }
vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(6.28318*(c*t + d)); }
`;

function compileGlShader(glCtx, type, src) {
  const sh = glCtx.createShader(type);
  glCtx.shaderSource(sh, src);
  glCtx.compileShader(sh);
  if (!glCtx.getShaderParameter(sh, glCtx.COMPILE_STATUS)) {
    const err = glCtx.getShaderInfoLog(sh) || "Shader compile error";
    glCtx.deleteShader(sh);
    throw new Error("GLSL: " + err.slice(0, 180));
  }
  return sh;
}

function linkGlProgram(glCtx, vsSrc, fsSrc) {
  const vs = compileGlShader(glCtx, glCtx.VERTEX_SHADER, vsSrc);
  const fs = compileGlShader(glCtx, glCtx.FRAGMENT_SHADER, fsSrc);
  const prog = glCtx.createProgram();
  glCtx.attachShader(prog, vs);
  glCtx.attachShader(prog, fs);
  glCtx.linkProgram(prog);
  glCtx.deleteShader(vs);
  glCtx.deleteShader(fs);
  if (!glCtx.getProgramParameter(prog, glCtx.LINK_STATUS)) {
    const err = glCtx.getProgramInfoLog(prog) || "Link error";
    glCtx.deleteProgram(prog);
    throw new Error("GLSL Link: " + err.slice(0, 160));
  }
  return prog;
}

function makeFboBundle(g, w, h, withDepth, linearFilter) {
  const tex = g.createTexture();
  g.bindTexture(g.TEXTURE_2D, tex);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
  const filt = linearFilter ? g.LINEAR : g.NEAREST;
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, filt);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, filt);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  const fbo = g.createFramebuffer();
  g.bindFramebuffer(g.FRAMEBUFFER, fbo);
  g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
  let rb = null;
  if (withDepth) {
    rb = g.createRenderbuffer();
    g.bindRenderbuffer(g.RENDERBUFFER, rb);
    g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT16, w, h);
    g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, rb);
  }
  g.bindFramebuffer(g.FRAMEBUFFER, null);
  return { fbo, tex, rb };
}

function resizeFboTargets(g, W, H, shadowRes) {
  const del = (f, t, r) => { if (f) g.deleteFramebuffer(f); if (t) g.deleteTexture(t); if (r) g.deleteRenderbuffer(r); };
  if (glShadowResCur !== shadowRes) {
    del(glShadowFbo, glShadowTex, glShadowRb);
    const sh = makeFboBundle(g, shadowRes, shadowRes, true, false);
    glShadowFbo = sh.fbo; glShadowTex = sh.tex; glShadowRb = sh.rb;
    glShadowResCur = shadowRes;
  }
  if (glW !== W || glH !== H || !glSceneFbo) {
    glCanvas.width = W; glCanvas.height = H;
    del(glSceneFbo, glSceneTex, glSceneRb);
    del(glDepthFbo, glDepthTex, glDepthRb);
    del(glBloomFboA, glBloomTexA, null);
    del(glBloomFboB, glBloomTexB, null);
    const sc = makeFboBundle(g, W, H, true, true);
    glSceneFbo = sc.fbo; glSceneTex = sc.tex; glSceneRb = sc.rb;
    const hw = Math.max(2, W >> 1), hh = Math.max(2, H >> 1);
    const dp = makeFboBundle(g, hw, hh, true, true);
    glDepthFbo = dp.fbo; glDepthTex = dp.tex; glDepthRb = dp.rb;
    const bA = makeFboBundle(g, hw, hh, false, true);
    glBloomFboA = bA.fbo; glBloomTexA = bA.tex;
    const qw = Math.max(2, W >> 2), qh = Math.max(2, H >> 2);
    const bB = makeFboBundle(g, qw, qh, false, true);
    glBloomFboB = bB.fbo; glBloomTexB = bB.tex;
    glW = W; glH = H;
  }
}

function ensureGl(W, H, shadowRes) {
  const sRes = shadowRes || 1024;
  if (!glCanvas) {
    glCanvas = new OffscreenCanvas(W, H);
    const opts = { alpha: true, antialias: true, depth: true, premultipliedAlpha: true, preserveDrawingBuffer: true };
    gl = glCanvas.getContext("webgl2", opts) || glCanvas.getContext("webgl", opts);
    if (!gl) return null;
    glBufPos = gl.createBuffer();
    glBufNorm = gl.createBuffer();
    glBufUv = gl.createBuffer();
    glBufIdx = gl.createBuffer();
    glQuadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, glQuadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    glPbrProg = linkGlProgram(gl, PBR_VS, PBR_FS);
    glShadowProg = linkGlProgram(gl, SHADOW_VS, SHADOW_FS);
    glDepthProg = linkGlProgram(gl, DEPTH_VS, DEPTH_FS);
    glBloomExtProg = linkGlProgram(gl, QUAD_VS, BLOOM_EXT_FS);
    glBloomBlurProg = linkGlProgram(gl, QUAD_VS, BLOOM_BLUR_FS);
    glPostProg = linkGlProgram(gl, QUAD_VS, POST_FS);

    glWhiteTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glWhiteTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    glDynamicTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glDynamicTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  resizeFboTargets(gl, W, H, sRes);
  return gl;
}

// Helper: Draw Full-Screen Quad for Post-FX
function drawGlQuad(g, prog) {
  const loc = g.getAttribLocation(prog, "aPos");
  g.bindBuffer(g.ARRAY_BUFFER, glQuadBuf);
  g.enableVertexAttribArray(loc);
  g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
}
