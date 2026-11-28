// =======================================================
// CINEMA ENGINE PRO v2.1 — OPTICAL LIQUID GLASS & POST-FX WEBGL2 SHADERS
// =======================================================
let __fxGlCanvas = null;
let __fxGl = null;
let __fxGlW = 0;
let __fxGlH = 0;
let __fxGlassProg = null;
let __fxPostProg = null;
let __fxQuadBuf = null;
let __fxSrcTex = null;

function compileFxGlShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function createFxGlProgram(gl, vsSrc, fsSrc) {
  const vs = compileFxGlShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileFxGlShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

function resetFxGlContext() {
  __fxGl = null; __fxGlCanvas = null; __fxGlW = 0; __fxGlH = 0;
  __fxGlassProg = null; __fxPostProg = null; __fxQuadBuf = null; __fxSrcTex = null;
}

function ensureFxGl(W, H) {
  try {
    if (__fxGl && typeof __fxGl.isContextLost === "function" && __fxGl.isContextLost()) {
      resetFxGlContext();
    }
    if (!__fxGlCanvas) {
      __fxGlCanvas = createWorkCanvas(W, H);
      if (typeof __fxGlCanvas.addEventListener === "function") {
        __fxGlCanvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); resetFxGlContext(); }, false);
      }
      const glOpts = { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" };
      __fxGl = __fxGlCanvas.getContext("webgl2", glOpts) || __fxGlCanvas.getContext("webgl", glOpts);
      if (!__fxGl) return null;
      const gl = __fxGl;
      detectGpuProfile(gl);
      __fxQuadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, __fxQuadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

      __fxSrcTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, __fxSrcTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const vs = `
        attribute vec2 aPos;
        varying vec2 vUv;
        void main() {
          vUv = aPos * 0.5 + 0.5;
          gl_Position = vec4(aPos, 0.0, 1.0);
        }
      `;

      // Optical Liquid Glass Fragment Shader: SDF rounded box, refraction IOR, RGB chromatic aberration, frosted blur, Fresnel specular rim & sweep
      const glassFs = `
        precision highp float;
        uniform sampler2D uTex;
        uniform vec2 uRes;
        uniform vec4 uRect; // x, y, w, h in pixels (top-left origin)
        uniform float uRadius;
        uniform float uIor;
        uniform float uChroma;
        uniform float uBlur;
        uniform float uRimGlow;
        uniform float uSweep;
        uniform vec4 uTint;
        varying vec2 vUv;

        float sdRoundedBox(vec2 p, vec2 b, float r) {
          vec2 q = abs(p) - b + vec2(r);
          return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
        }

        vec3 sampleFrosted(vec2 uv, float blurPx) {
          vec2 px = blurPx / uRes;
          vec3 acc = texture2D(uTex, uv).rgb * 0.28;
          acc += texture2D(uTex, uv + vec2(px.x, 0.0)).rgb * 0.12;
          acc += texture2D(uTex, uv - vec2(px.x, 0.0)).rgb * 0.12;
          acc += texture2D(uTex, uv + vec2(0.0, px.y)).rgb * 0.12;
          acc += texture2D(uTex, uv - vec2(0.0, px.y)).rgb * 0.12;
          acc += texture2D(uTex, uv + vec2(px.x, px.y) * 0.85).rgb * 0.06;
          acc += texture2D(uTex, uv + vec2(-px.x, px.y) * 0.85).rgb * 0.06;
          acc += texture2D(uTex, uv + vec2(px.x, -px.y) * 0.85).rgb * 0.06;
          acc += texture2D(uTex, uv + vec2(-px.x, -px.y) * 0.85).rgb * 0.06;
          return acc;
        }

        void main() {
          vec2 fragPx = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
          vec2 center = uRect.xy + uRect.zw * 0.5;
          vec2 halfSize = uRect.zw * 0.5;
          vec2 local = fragPx - center;
          float d = sdRoundedBox(local, halfSize, uRadius);
          if (d > 2.5) discard;

          float edgeAA = smoothstep(1.5, -1.5, d);
          float bevel = clamp(-d / max(12.0, min(halfSize.x, halfSize.y) * 0.42), 0.0, 1.0);
          vec2 n = normalize(local / max(halfSize, vec2(1.0)) + vec2(0.0001));
          float bend = pow(1.0 - bevel, 2.2) * (uIor - 1.0) * 0.085;
          vec2 baseUv = vec2(vUv.x, vUv.y);
          vec2 refrUv = clamp(baseUv - vec2(n.x, -n.y) * bend, vec2(0.002), vec2(0.998));

          float ca = uChroma * (0.4 + (1.0 - bevel) * 1.6);
          float blurPx = uBlur * (2.6 + bevel * 3.8);
          float rCh = sampleFrosted(clamp(refrUv + vec2(ca, 0.0), 0.002, 0.998), blurPx).r;
          float gCh = sampleFrosted(refrUv, blurPx).g;
          float bCh = sampleFrosted(clamp(refrUv - vec2(ca, 0.0), 0.002, 0.998), blurPx).b;
          vec3 glassCol = vec3(rCh, gCh, bCh);

          // Tint + internal glass depth + top sheen
          glassCol = mix(glassCol, uTint.rgb, uTint.a);
          float topSheen = smoothstep(0.6, -0.8, local.y / max(1.0, halfSize.y)) * 0.14;
          glassCol += vec3(0.92, 0.96, 1.0) * topSheen;

          // Animated diagonal light sweep
          if (uSweep >= 0.0) {
            float sx = (local.x / max(1.0, halfSize.x) + local.y / max(1.0, halfSize.y) * 0.45);
            float swPos = mix(-1.8, 1.8, fract(uSweep));
            float beam = exp(-pow((sx - swPos) * 3.8, 2.0)) * 0.24;
            glassCol += vec3(0.86, 0.94, 1.0) * beam;
          }

          // Specular Fresnel rim highlight (chromatic prismatic border)
          float rimMask = smoothstep(-5.5, -0.6, d) * edgeAA;
          vec3 rimTint = mix(vec3(1.0), vec3(0.65, 0.85, 1.0), clamp(n.x * 0.5 + 0.5, 0.0, 1.0));
          glassCol += rimTint * rimMask * (0.48 * uRimGlow);

          gl_FragColor = vec4(glassCol, edgeAA);
        }
      `;

      // Post-FX Shader: Soft Bloom, Vignette, Film Grain, Optical Ripple & Chromatic Edge
      const postFs = `
        precision highp float;
        uniform sampler2D uTex;
        uniform vec2 uRes;
        uniform float uTime;
        uniform float uBloom;
        uniform float uVignette;
        uniform float uGrain;
        uniform float uRipple;
        uniform vec2 uRippleCenter;
        uniform float uAberration;
        varying vec2 vUv;

        float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
          vec2 uv = vUv;
          if (uRipple > 0.001) {
            vec2 dv = uv - uRippleCenter;
            float dist = length(dv);
            float wave = sin(dist * 34.0 - uTime * 8.0) * exp(-dist * 3.2) * uRipple * 0.025;
            uv = clamp(uv + normalize(dv + vec2(0.0001)) * wave, vec2(0.001), vec2(0.999));
          }

          vec3 col;
          if (uAberration > 0.0001) {
            vec2 off = (uv - 0.5) * uAberration;
            col.r = texture2D(uTex, clamp(uv + off, 0.0, 1.0)).r;
            col.g = texture2D(uTex, uv).g;
            col.b = texture2D(uTex, clamp(uv - off, 0.0, 1.0)).b;
          } else {
            col = texture2D(uTex, uv).rgb;
          }

          if (uBloom > 0.005) {
            vec2 px = vec2(6.0) / uRes;
            vec3 b = vec3(0.0);
            b += max(texture2D(uTex, uv + vec2(px.x, 0.0)).rgb - 0.62, 0.0);
            b += max(texture2D(uTex, uv - vec2(px.x, 0.0)).rgb - 0.62, 0.0);
            b += max(texture2D(uTex, uv + vec2(0.0, px.y)).rgb - 0.62, 0.0);
            b += max(texture2D(uTex, uv - vec2(0.0, px.y)).rgb - 0.62, 0.0);
            b += max(texture2D(uTex, uv + vec2(px.x, px.y) * 1.4).rgb - 0.62, 0.0);
            b += max(texture2D(uTex, uv - vec2(px.x, px.y) * 1.4).rgb - 0.62, 0.0);
            col += b * (0.28 * uBloom);
          }

          if (uVignette > 0.005) {
            float d = length((uv - 0.5) * vec2(1.05, 1.0));
            col *= 1.0 - smoothstep(0.32, 0.92, d) * uVignette;
          }

          if (uGrain > 0.001) {
            float g = (hash12(gl_FragCoord.xy + fract(uTime * 17.3) * 100.0) - 0.5) * 2.0;
            col += vec3(g * uGrain);
          }

          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }
      `;

      __fxGlassProg = createFxGlProgram(gl, vs, glassFs);
      __fxPostProg = createFxGlProgram(gl, vs, postFs);
      __fxGlW = W;
      __fxGlH = H;
    }
    if (__fxGlW !== W || __fxGlH !== H) {
      __fxGlCanvas.width = W;
      __fxGlCanvas.height = H;
      __fxGlW = W;
      __fxGlH = H;
    }
    __fxGl.viewport(0, 0, W, H);
    return __fxGl;
  } catch (_) {
    return null;
  }
}

function parseRgbaTint(str) {
  if (!str) return [0.88, 0.95, 1.0, 0.14];
  const m = String(str).match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, m[4] !== undefined ? Number(m[4]) : 0.18];
  const rgb = parseHexRGB(str, [220, 238, 255]);
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 0.16];
}

function makeOpticalShaderApis(W, H, S, t, ui, isExportMode) {
  const lightPreview = shouldUseLightPreview(!!isExportMode);
  const glass = Object.freeze({
    refract(targetCtx, x, y, w, h, radius, opts) {
      const o = opts || {};
      const rad = Math.min(radius !== undefined ? radius : 32 * S, w * 0.5, h * 0.5);
      const gl = ensureFxGl(W, H);
      if (gl && __fxGlassProg) {
        if (o.shadow !== false && !lightPreview) {
          targetCtx.save();
          targetCtx.shadowColor = "rgba(0,0,0,0.36)";
          targetCtx.shadowBlur = 24 * S;
          targetCtx.shadowOffsetY = 10 * S;
          targetCtx.fillStyle = "rgba(255,255,255,0.02)";
          ui.rrect(targetCtx, x, y, w, h, rad);
          targetCtx.fill();
          targetCtx.restore();
        }

        gl.useProgram(__fxGlassProg);
        gl.bindBuffer(gl.ARRAY_BUFFER, __fxQuadBuf);
        const locPos = getGlAttrib(gl, __fxGlassProg, "aPos");
        gl.enableVertexAttribArray(locPos);
        gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, __fxSrcTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, targetCtx.canvas);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1i(getGlUniform(gl, __fxGlassProg, "uTex"), 0);
        gl.uniform2f(getGlUniform(gl, __fxGlassProg, "uRes"), W, H);
        gl.uniform4f(getGlUniform(gl, __fxGlassProg, "uRect"), x, y, w, h);
        gl.uniform1f(getGlUniform(gl, __fxGlassProg, "uRadius"), rad);
        gl.uniform1f(getGlUniform(gl, __fxGlassProg, "uIor"), o.ior !== undefined ? o.ior : 1.45);
        gl.uniform1f(getGlUniform(gl, __fxGlassProg, "uChroma"), o.chroma !== undefined ? o.chroma : 0.012);
        gl.uniform1f(getGlUniform(gl, __fxGlassProg, "uBlur"), lightPreview ? Math.min(0.4, o.blur !== undefined ? o.blur : 0.4) : (o.blur !== undefined ? o.blur : 1.0));
        gl.uniform1f(getGlUniform(gl, __fxGlassProg, "uRimGlow"), o.rimGlow !== undefined ? o.rimGlow : 0.85);
        gl.uniform1f(getGlUniform(gl, __fxGlassProg, "uSweep"), o.sweep !== undefined ? o.sweep : -1.0);
        const tint = parseRgbaTint(o.tint);
        gl.uniform4f(getGlUniform(gl, __fxGlassProg, "uTint"), tint[0], tint[1], tint[2], tint[3]);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        targetCtx.save();
        targetCtx.drawImage(__fxGlCanvas, 0, 0, W, H);
        targetCtx.restore();
      } else {
        ui.drawLiquidGlass(targetCtx, x, y, w, h, rad, o);
      }
    },
    lens(targetCtx, cx, cy, r, opts) {
      this.refract(targetCtx, cx - r, cy - r, r * 2, r * 2, r, opts);
    },
    pill(targetCtx, x, y, w, h, label, opts) {
      const o = opts || {};
      this.refract(targetCtx, x, y, w, h, h * 0.5, o);
      if (label) {
        targetCtx.save();
        targetCtx.fillStyle = o.textColor || "#FFFFFF";
        targetCtx.font = "700 " + Math.round(o.fontSize || (h * 0.36)) + "px 'Plus Jakarta Sans', 'Inter', sans-serif";
        targetCtx.textAlign = "center";
        targetCtx.textBaseline = "middle";
        targetCtx.fillText(String(label), x + w * 0.5, y + h * 0.52, w - 24 * S);
        targetCtx.restore();
      }
    }
  });

  const shader = Object.freeze({
    postFx(targetCtx, opts) {
      const o = opts || {};
      if (lightPreview) {
        if (o.vignette) ui.drawVignette(targetCtx, W, H, o.vignette, false);
        return;
      }
      const gl = ensureFxGl(W, H);
      if (gl && __fxPostProg) {
        gl.useProgram(__fxPostProg);
        gl.bindBuffer(gl.ARRAY_BUFFER, __fxQuadBuf);
        const locPos = getGlAttrib(gl, __fxPostProg, "aPos");
        gl.enableVertexAttribArray(locPos);
        gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, __fxSrcTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, targetCtx.canvas);

        gl.uniform1i(getGlUniform(gl, __fxPostProg, "uTex"), 0);
        gl.uniform2f(getGlUniform(gl, __fxPostProg, "uRes"), W, H);
        gl.uniform1f(getGlUniform(gl, __fxPostProg, "uTime"), t);
        gl.uniform1f(getGlUniform(gl, __fxPostProg, "uBloom"), o.bloom !== undefined ? o.bloom : 0.0);
        gl.uniform1f(getGlUniform(gl, __fxPostProg, "uVignette"), o.vignette !== undefined ? o.vignette : 0.25);
        gl.uniform1f(getGlUniform(gl, __fxPostProg, "uGrain"), o.grain !== undefined ? o.grain : 0.02);
        gl.uniform1f(getGlUniform(gl, __fxPostProg, "uRipple"), o.ripple !== undefined ? o.ripple : 0.0);
        const rc = o.rippleCenter || [0.5, 0.5];
        gl.uniform2f(getGlUniform(gl, __fxPostProg, "uRippleCenter"), rc[0], 1.0 - rc[1]);
        gl.uniform1f(getGlUniform(gl, __fxPostProg, "uAberration"), o.aberration !== undefined ? o.aberration : 0.0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        targetCtx.save();
        targetCtx.globalCompositeOperation = "copy";
        targetCtx.drawImage(__fxGlCanvas, 0, 0, W, H);
        targetCtx.restore();
      } else {
        if (o.vignette) ui.drawVignette(targetCtx, W, H, o.vignette, false);
      }
    }
  });

  return { glass, shader };
}
