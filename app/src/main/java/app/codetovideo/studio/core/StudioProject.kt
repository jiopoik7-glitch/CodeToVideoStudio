package app.codetovideo.studio.core

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
    val autoDucking: Boolean = true
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
    val name: String = "iOS 26 Liquid Glass Keynote",
    val sourceBody: String = DEFAULT_SOURCE,
    val seed: Int = 26,
    val propsValues: Map<String, String> = emptyMap(),
    val renderSettings: RenderSettings = RenderSettings(),
    val createdAtEpochMs: Long = System.currentTimeMillis(),
    val updatedAtEpochMs: Long = System.currentTimeMillis()
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("schemaVersion", 6)
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
        })
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
                    autoDucking = settings.optBoolean("autoDucking", true)
                ),
                createdAtEpochMs = json.optLong("createdAtEpochMs", System.currentTimeMillis()),
                updatedAtEpochMs = json.optLong("updatedAtEpochMs", System.currentTimeMillis())
            )
        }
    }
}

const val DEFAULT_SOURCE = """/*<studio-meta>
{
  "schemaVersion": 10,
  "title": "iOS 26 Liquid Glass Keynote",
  "defaultDurationSeconds": 5,
  "seed": 26,
  "props": [
    {"key":"eyebrow","label":"Tag Atas","type":"text","default":"RENDER VIDEO CODE V1.0"},
    {"key":"title","label":"Judul Utama","type":"text","default":"Desain kaca yang"},
    {"key":"highlight","label":"Kata Aksen","type":"text","default":"mengalir."},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#DCE8F5"}
  ],
  "audio": {
    "ambience": "keynote_pulse",
    "ambienceVolume": 0.14,
    "cues": [
      {"p": 0.01, "sfx": "air_whoosh", "gain": 0.52, "pitch": 1.0},
      {"p": 0.09, "sfx": "taptic_thock", "gain": 0.56, "pitch": 1.0},
      {"p": 0.14, "sfx": "taptic_thock", "gain": 0.52, "pitch": 1.12},
      {"p": 0.21, "sfx": "glass_tap", "gain": 0.48, "pitch": 1.05},
      {"p": 0.84, "sfx": "chime", "gain": 0.56, "pitch": 1.0}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#DCE8F5");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const cState = fx.cameraRig(p, [
  { p: 0.0, x: 0, y: -20 * S, zoom: 1.12, rot: -0.008 },
  { p: 0.45, x: 0, y: 0, zoom: 1.0, rot: 0.0 },
  { p: 1.0, x: 10 * S, y: 14 * S, zoom: 1.04, rot: 0.006 }
], 4 * S);

ui.drawMeshBg(ctx, W, H, "#080B11", [
  { x: 0.82, y: 0.15, r: 0.78, col: accent, a: 0.30 },
  { x: 0.16, y: 0.84, r: 0.74, col: "#4AA3FF", a: 0.22 },
  { x: 0.50, y: 0.52, r: 0.58, col: "#FFFFFF", a: 0.07 }
], t);

ctx.save();
cam.apply(ctx, cState, 0.35);
ui.drawGrid(ctx, W, H, 130 * S, "rgba(255,255,255,0.032)");
fx.particles.bokeh(ctx, 14, accent, 0.16);
ctx.restore();

ctx.save();
cam.apply(ctx, cState, 1.0);

const pillP = fx.stagger(frame, 0, 4);
ctx.save();
ctx.globalAlpha = ui.clamp(pillP, 0, 1);
ctx.translate(0, (1 - pillP) * 18 * S);
ui.drawPill(ctx, pad, H * 0.14, String(P.eyebrow || "RENDER VIDEO CODE V1.0"), "rgba(255,255,255,0.12)", "#F5F7FA", Math.max(12, Math.round(21 * S)));
ctx.restore();

const fSize = Math.round(80 * S);
const used = ui.drawRichText(ctx, [
  { text: String(P.title || "Desain kaca yang") },
  { text: String(P.highlight || "mengalir."), italic: true, color: accent }
], pad, H * 0.21, innerW, fSize, fSize * 1.18, "#FFFFFF", ui.seg(p, 0.05, 0.42), "left");

const cards = [
  { title: "Real Studio SFX Library", sub: "36 SFX Akustik + Impor Audio Sendiri", val: 0.96, lbl: "96%" },
  { title: "Live Render Preview HUD", sub: "Pantau frame, FPS & ETA real-time", val: 1.00, lbl: "100%" }
];
const cH = 176 * S;
const cStart = H * 0.21 + used + 54 * S;
for (let i = 0; i < cards.length; i++) {
  const sp = fx.stagger(frame, i + 2, Math.round(fps * 0.22));
  const cy = cStart + i * (cH + 26 * S);
  ctx.save();
  ctx.globalAlpha = ui.clamp(sp * 1.25, 0, 1);
  ctx.translate(0, (1 - sp) * 58 * S);
  ui.drawLiquidGlass(ctx, pad, cy, innerW, cH, 28 * S, { light: false, sweep: (p * 1.5 + i * 0.35) % 1 });

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#F7F9FC";
  ctx.font = "700 " + Math.max(15, Math.round(32 * S)) + "px sans-serif";
  ctx.fillText(cards[i].title, pad + 32 * S, cy + cH * 0.37, innerW - 180 * S);

  ctx.fillStyle = "rgba(220,232,246,0.74)";
  ctx.font = "400 " + Math.max(12, Math.round(23 * S)) + "px sans-serif";
  ctx.fillText(cards[i].sub, pad + 32 * S, cy + cH * 0.67, innerW - 180 * S);

  const rp = ease.liquid(ui.seg(p, 0.16 + i * 0.12, 0.92));
  ui.drawRing(ctx, pad + innerW - 76 * S, cy + cH * 0.5, 44 * S, cards[i].val * rp, accent, Math.round(cards[i].val * rp * 100) + "%", "rgba(255,255,255,0.12)", "#FFFFFF", 6 * S);
  ctx.restore();
}

const fCardY = cStart + 2 * (cH + 26 * S) + 12 * S;
const fCardH = 220 * S;
const fSp = fx.stagger(frame, 6, Math.round(fps * 0.16));
ctx.save();
ctx.globalAlpha = ui.clamp(fSp * 1.25, 0, 1);
ctx.translate(0, (1 - fSp) * 52 * S);
ui.drawLiquidGlass(ctx, pad, fCardY, innerW, fCardH, 28 * S, { light: false, sweep: (p * 1.2 + 0.6) % 1 });
fx.chart.spline(ctx, [22, 34, 38, 55, 68, 82, 96], pad + 34 * S, fCardY + 42 * S, innerW - 68 * S, fCardH - 84 * S, "#5CE1A8", ui.seg(p, 0.25, 0.95));
ctx.restore();

ctx.restore();
ui.drawVignette(ctx, W, H, 0.32, false);
ui.drawGrain(ctx, W, H, rand, 70, 0.03);
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, "#FFFFFF", "rgba(255,255,255,0.14)");
"""
