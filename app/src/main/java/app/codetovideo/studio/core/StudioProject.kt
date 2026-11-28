package app.codetovideo.studio.core

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class RenderSettings(
    val longEdge: Int = 1080,
    val aspect: String = "9:16",
    val fps: Int = 30,
    val durationSeconds: Int = 5,
    val quality: String = "high",
    val includeAudio: Boolean = true,
    val sfxVolume: Float = 1.0f,
    val ambienceVolume: Float = 0.85f,
    val voiceoverUri: String = "",
    val voiceoverName: String = "",
    val voiceoverVolume: Float = 1.0f,
    val autoDucking: Boolean = true,
    val motionBlurSamples: Int = 1, // 1 = Off, 2 = 2x, 4 = 4x
    val showSafeZone: Boolean = false
) {
    fun dimensions(): Pair<Int, Int> {
        val long = longEdge.coerceIn(480, 2160)
        fun even(value: Double): Int = (kotlin.math.round(value / 2.0) * 2.0).toInt().coerceAtLeast(2)
        return when (aspect) {
            "1:1" -> long to long
            "16:9" -> long to even(long * 9.0 / 16.0)
            "4:5" -> even(long * 4.0 / 5.0) to long
            else -> even(long * 9.0 / 16.0) to long
        }
    }

    fun totalFrames(): Int = (durationSeconds.coerceIn(1, 60) * fps.coerceIn(24, 60))
}

data class StudioProject(
    val projectId: String = UUID.randomUUID().toString(),
    val name: String = "Cinema Engine Pro v2.1",
    val sourceBody: String = DEFAULT_SOURCE,
    val seed: Int = 26,
    val propsValues: Map<String, String> = emptyMap(),
    val renderSettings: RenderSettings = RenderSettings(),
    val audioCueOverrides: List<AudioCue>? = null,
    val subtitleConfig: StudioSubtitleConfig = StudioSubtitleConfig(),
    val createdAtEpochMs: Long = System.currentTimeMillis(),
    val updatedAtEpochMs: Long = System.currentTimeMillis()
) {
    fun effectiveAudioConfig(meta: StudioMetadata?): StudioAudioConfig {
        val base = meta?.audio ?: StudioAudioConfig()
        val cues = audioCueOverrides ?: base.cues
        return base.copy(cues = cues)
    }

    fun effectiveSubtitles(meta: StudioMetadata?): StudioSubtitleConfig {
        return if (subtitleConfig.enabled || subtitleConfig.cues.isNotEmpty() || subtitleConfig.rawSrt.isNotBlank()) {
            subtitleConfig
        } else {
            meta?.subtitles ?: StudioSubtitleConfig()
        }
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("schemaVersion", 21)
        put("projectId", projectId)
        put("name", name)
        put("sourceBody", sourceBody)
        put("seed", seed)
        put("propsValues", JSONObject(propsValues))
        put("renderSettings", JSONObject().apply {
            put("longEdge", renderSettings.longEdge)
            put("aspect", renderSettings.aspect)
            put("fps", renderSettings.fps)
            put("durationSeconds", renderSettings.durationSeconds)
            put("quality", renderSettings.quality)
            put("includeAudio", renderSettings.includeAudio)
            put("sfxVolume", renderSettings.sfxVolume.toDouble())
            put("ambienceVolume", renderSettings.ambienceVolume.toDouble())
            put("voiceoverUri", renderSettings.voiceoverUri)
            put("voiceoverName", renderSettings.voiceoverName)
            put("voiceoverVolume", renderSettings.voiceoverVolume.toDouble())
            put("autoDucking", renderSettings.autoDucking)
            put("motionBlurSamples", renderSettings.motionBlurSamples)
            put("showSafeZone", renderSettings.showSafeZone)
        })
        if (audioCueOverrides != null) {
            put("audioCueOverrides", JSONArray().apply {
                audioCueOverrides.forEach { c ->
                    put(JSONObject().apply {
                        put("at", c.atSeconds)
                        if (c.atProgress != null) put("p", c.atProgress)
                        put("sfx", c.sfx)
                        put("gain", c.gain.toDouble())
                        put("pitch", c.pitch.toDouble())
                    })
                }
            })
        }
        put("subtitleConfig", subtitleConfig.toJson())
        put("createdAtEpochMs", createdAtEpochMs)
        put("updatedAtEpochMs", updatedAtEpochMs)
    }

    companion object {
        fun fromJson(json: JSONObject): StudioProject {
            val settings = json.optJSONObject("renderSettings") ?: JSONObject()
            val props = mutableMapOf<String, String>()
            json.optJSONObject("propsValues")?.let { obj ->
                val keys = obj.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    props[key] = obj.opt(key)?.toString().orEmpty()
                }
            }
            val cueOverrides = json.optJSONArray("audioCueOverrides")?.let { arr ->
                val list = mutableListOf<AudioCue>()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    list += AudioCue(
                        atSeconds = o.optDouble("at", 0.0).coerceAtLeast(0.0),
                        atProgress = if (o.has("p")) o.optDouble("p", 0.0).coerceIn(0.0, 1.0) else null,
                        sfx = o.optString("sfx", "pop").trim().lowercase(),
                        gain = o.optDouble("gain", 0.8).toFloat().coerceIn(0f, 1.5f),
                        pitch = o.optDouble("pitch", 1.0).toFloat().coerceIn(0.4f, 2.5f)
                    )
                }
                list
            }
            val subCfg = StudioSubtitleConfig.fromJson(json.optJSONObject("subtitleConfig"))
            val mb = settings.optInt("motionBlurSamples", 1).let { if (it in setOf(1, 2, 4)) it else 1 }
            return StudioProject(
                projectId = json.optString("projectId").ifBlank { UUID.randomUUID().toString() },
                name = json.optString("name", "Imported Motion").take(80),
                sourceBody = json.optString("sourceBody", DEFAULT_SOURCE).take(ProjectMetadataParser.MAX_SOURCE_CHARS),
                seed = json.optInt("seed", 26),
                propsValues = props,
                renderSettings = RenderSettings(
                    longEdge = settings.optInt("longEdge", 1080).coerceIn(480, 2160),
                    aspect = settings.optString("aspect", "9:16").let { if (it in setOf("1:1", "16:9", "9:16", "4:5")) it else "9:16" },
                    fps = settings.optInt("fps", 30).let { if (it in setOf(24, 30, 60)) it else 30 },
                    durationSeconds = settings.optInt("durationSeconds", 5).coerceIn(1, 60),
                    quality = settings.optString("quality", "high").let { if (it in setOf("low", "medium", "high", "ultra")) it else "high" },
                    includeAudio = settings.optBoolean("includeAudio", true),
                    sfxVolume = settings.optDouble("sfxVolume", 1.0).toFloat().coerceIn(0f, 1.5f),
                    ambienceVolume = settings.optDouble("ambienceVolume", 0.85).toFloat().coerceIn(0f, 1.5f),
                    voiceoverUri = settings.optString("voiceoverUri", ""),
                    voiceoverName = settings.optString("voiceoverName", ""),
                    voiceoverVolume = settings.optDouble("voiceoverVolume", 1.0).toFloat().coerceIn(0f, 1.5f),
                    autoDucking = settings.optBoolean("autoDucking", true),
                    motionBlurSamples = mb,
                    showSafeZone = settings.optBoolean("showSafeZone", false)
                ),
                audioCueOverrides = cueOverrides,
                subtitleConfig = subCfg,
                createdAtEpochMs = json.optLong("createdAtEpochMs", System.currentTimeMillis()),
                updatedAtEpochMs = json.optLong("updatedAtEpochMs", System.currentTimeMillis())
            )
        }
    }
}

const val DEFAULT_SOURCE = """/*<studio-meta>
{
  "schemaVersion": 21,
  "title": "Cinema Engine Pro v2.1",
  "defaultDurationSeconds": 6,
  "seed": 26,
  "props": [
    {"key":"eyebrow","label":"Tag Atas","type":"text","default":"CINEMA ENGINE PRO V2.1"},
    {"key":"title","label":"Judul Utama","type":"text","default":"Liquid Glass"},
    {"key":"highlight","label":"Kata Aksen","type":"text","default":"Refraction."},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#7AC8FF"}
  ],
  "audio": {
    "ambience": "ios_glass_chimes",
    "ambienceVolume": 0.16,
    "cues": [
      {"p": 0.02, "sfx": "silk_swoosh", "gain": 0.56, "pitch": 1.0},
      {"p": 0.16, "sfx": "glass_clink", "gain": 0.52, "pitch": 1.04},
      {"p": 0.36, "sfx": "crystal_tap", "gain": 0.54, "pitch": 1.0},
      {"p": 0.58, "sfx": "cinema_boom", "gain": 0.62, "pitch": 1.0},
      {"p": 0.82, "sfx": "sparkle_chime", "gain": 0.56, "pitch": 1.0}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#7AC8FF");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const cState = fx.cameraRig(p, [
  { p: 0.0, x: 0, y: -18 * S, zoom: 1.08, rot: -0.006 },
  { p: 0.5, x: 0, y: 0, zoom: 1.0, rot: 0.0 },
  { p: 1.0, x: 8 * S, y: 12 * S, zoom: 1.03, rot: 0.005 }
], 3.5 * S);

ui.drawMeshBg(ctx, W, H, "#070B12", [
  { x: 0.82, y: 0.16, r: 0.78, col: accent, a: 0.34 },
  { x: 0.18, y: 0.82, r: 0.76, col: "#A78BFA", a: 0.26 },
  { x: 0.50, y: 0.48, r: 0.62, col: "#34D399", a: 0.14 }
], t);

ctx.save();
cam.apply(ctx, cState, 0.35);
ui.drawGrid(ctx, W, H, 120 * S, "rgba(255,255,255,0.036)");
fx.particles.bokeh(ctx, 18, accent, 0.20);
ctx.restore();

ctx.save();
cam.apply(ctx, cState, 1.0);

const pillP = fx.stagger(frame, 0, 4);
ctx.save();
ctx.globalAlpha = ui.clamp(pillP, 0, 1);
ctx.translate(0, (1 - pillP) * 18 * S);
ui.drawPill(ctx, pad, H * 0.13, String(P.eyebrow || "CINEMA ENGINE PRO V2.1"), "rgba(255,255,255,0.12)", "#F5F7FA", Math.max(12, Math.round(20 * S)));
ctx.restore();

// Kinetic Typography using Bundled Offline Fonts (Plus Jakarta Sans + Playfair Display Italic)
const fSize = Math.round(86 * S);
ctx.save();
ctx.textAlign = "left";
ctx.textBaseline = "top";
const titleIn = ease.apple(ui.seg(p, 0.04, 0.30));
ctx.globalAlpha = titleIn;
ctx.font = "800 " + fSize + "px 'Plus Jakarta Sans', sans-serif";
ctx.fillStyle = "#FFFFFF";
ctx.fillText(String(P.title || "Liquid Glass"), pad, H * 0.20 + (1 - titleIn) * 24 * S, innerW);

const hiIn = ease.apple(ui.seg(p, 0.12, 0.42));
ctx.globalAlpha = hiIn;
ctx.font = "italic 700 " + Math.round(fSize * 1.06) + "px 'Playfair Display', serif";
ctx.fillStyle = accent;
ctx.fillText(String(P.highlight || "Refraction."), pad, H * 0.20 + fSize * 1.12 + (1 - hiIn) * 26 * S, innerW);
ctx.restore();

// Real WebGL2 Optical Liquid Glass Refraction Lens gliding across the scene!
const lensX = pad + innerW * (0.5 + Math.sin(p * Math.PI * 2 - 0.8) * 0.22);
const lensY = H * 0.56 + Math.cos(p * Math.PI * 2) * 32 * S;
fx.glass.refract(ctx, lensX - innerW * 0.46, lensY - 130 * S, innerW * 0.92, 260 * S, 42 * S, {
  ior: 1.48,
  chroma: 0.014,
  blur: 1.2,
  rimGlow: 0.85,
  tint: "rgba(220,238,255,0.12)",
  sweep: (p * 1.4) % 1
});

ctx.save();
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillStyle = "#FFFFFF";
ctx.font = "700 " + Math.round(34 * S) + "px 'Plus Jakarta Sans', sans-serif";
ctx.fillText("WebGL2 Optical Engine · 100% Offline", lensX, lensY - 22 * S, innerW * 0.82);
ctx.fillStyle = "rgba(224,238,255,0.82)";
ctx.font = "500 " + Math.round(22 * S) + "px 'JetBrains Mono', monospace";
ctx.fillText("THREE.JS · GLSL · RIG2D · 108 SFX", lensX, lensY + 34 * S, innerW * 0.82);
ctx.restore();

ctx.restore();
fx.shader.postFx(ctx, { bloom: 0.22, vignette: 0.30, grain: 0.025, ripple: 0 });
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, "#FFFFFF", "rgba(255,255,255,0.14)");
"""
