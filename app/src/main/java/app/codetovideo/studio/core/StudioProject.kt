package app.codetovideo.studio.core

import org.json.JSONObject
import java.util.UUID

data class RenderSettings(
    val longEdge: Int = 1080,
    val aspect: String = "9:16",
    val fps: Int = 30,
    val durationSeconds: Int = 5,
    val quality: String = "high",
    val includeAudio: Boolean = true
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
    val name: String = "Kinetic Studio Pro",
    val sourceBody: String = DEFAULT_SOURCE,
    val seed: Int = 17,
    val propsValues: Map<String, String> = emptyMap(),
    val renderSettings: RenderSettings = RenderSettings(),
    val createdAtEpochMs: Long = System.currentTimeMillis(),
    val updatedAtEpochMs: Long = System.currentTimeMillis()
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("schemaVersion", 2)
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
                seed = json.optInt("seed", 17),
                propsValues = props,
                renderSettings = RenderSettings(
                    longEdge = settings.optInt("longEdge", 1080).coerceIn(480, 2160),
                    aspect = settings.optString("aspect", "9:16").let { if (it in setOf("1:1", "16:9", "9:16", "4:5")) it else "9:16" },
                    fps = settings.optInt("fps", 30).let { if (it in setOf(24, 30, 60)) it else 30 },
                    durationSeconds = settings.optInt("durationSeconds", 5).coerceIn(1, 60),
                    quality = settings.optString("quality", "high").let { if (it in setOf("low", "medium", "high", "ultra")) it else "high" },
                    includeAudio = settings.optBoolean("includeAudio", true)
                ),
                createdAtEpochMs = json.optLong("createdAtEpochMs", System.currentTimeMillis()),
                updatedAtEpochMs = json.optLong("updatedAtEpochMs", System.currentTimeMillis())
            )
        }
    }
}

const val DEFAULT_SOURCE = """/*<studio-meta>
{
  "schemaVersion": 2,
  "title": "Kinetic Studio Pro",
  "defaultDurationSeconds": 5,
  "seed": 17,
  "props": [
    {"key":"eyebrow","label":"Eyebrow","type":"text","default":"STUDIO ENGINE V0.2"},
    {"key":"title","label":"Judul Utama","type":"text","default":"MOTION TANPA KAKU"},
    {"key":"highlight","label":"Kata Aksen","type":"text","default":"halus."},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#23C483"}
  ],
  "audio": {
    "ambience": "warm_pad",
    "ambienceVolume": 0.20,
    "cues": [
      {"p": 0.02, "sfx": "whoosh", "gain": 0.75},
      {"p": 0.22, "sfx": "pop", "gain": 0.80, "pitch": 1.05},
      {"p": 0.45, "sfx": "click", "gain": 0.70},
      {"p": 0.72, "sfx": "chime", "gain": 0.85}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#23C483");
const pad = Math.min(W, H) * 0.07;
const innerW = W - pad * 2;

// Kamera 2.5D hidup dengan spring settle + organic drift
const settle = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
const drift = cam.shake(t, 6 * S, 0.8);
const camState = {
  x: drift.x,
  y: drift.y + interpolate(p, [0, 1], [-14 * S, 14 * S]),
  zoom: interpolate(settle, [0, 1], [1.14, 1.0]) + p * 0.04,
  rot: drift.rot
};

ctx.fillStyle = "#06110B";
ctx.fillRect(0, 0, W, H);

ctx.save();
cam.apply(ctx, camState, 0.35);
ui.drawGlow(ctx, W * 0.82, H * 0.18, Math.min(W, H) * 0.65, accent, 0.28);
ui.drawGlow(ctx, W * 0.18, H * 0.82, Math.min(W, H) * 0.55, "#F2B652", 0.16);
ctx.restore();

ctx.save();
cam.apply(ctx, camState, 1.0);

const eyP = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 180 } });
ctx.save();
ctx.globalAlpha = ui.clamp(eyP, 0, 1);
ctx.fillStyle = accent;
ctx.font = "800 " + Math.max(12, Math.round(24 * S)) + "px monospace, sans-serif";
ctx.textAlign = "left";
ctx.textBaseline = "top";
ctx.fillText(String(P.eyebrow || "STUDIO ENGINE V0.2"), pad, H * 0.26 + (1 - eyP) * 20 * S);
ctx.restore();

const fSize = Math.round(78 * S);
const usedH = ui.drawRichText(ctx, [
  { text: String(P.title || "MOTION TANPA KAKU") },
  { text: String(P.highlight || "halus."), italic: true, color: accent }
], pad, H * 0.32, innerW, fSize, fSize * 1.15, "#F5FAF7", ui.seg(p, 0.06, 0.45), "left");

// Kartu metrik dengan spring masuk
const cardP = spring({ frame: frame - Math.round(fps * 0.8), fps, config: { damping: 14, stiffness: 150 } });
const cardY = H * 0.32 + usedH + 46 * S;
const cardH = 156 * S;
ctx.save();
ctx.globalAlpha = ui.clamp(cardP * 1.2, 0, 1);
ctx.translate(0, (1 - cardP) * 60 * S);
ctx.fillStyle = "rgba(255,255,255,0.055)";
ctx.strokeStyle = ui.rgba(accent, 0.35);
ctx.lineWidth = Math.max(1.5, 2 * S);
ui.rrect(ctx, pad, cardY, innerW, cardH, 24 * S);
ctx.fill();
ctx.stroke();

ctx.fillStyle = "#F5FAF7";
ctx.font = "700 " + Math.max(15, Math.round(30 * S)) + "px sans-serif";
ctx.textAlign = "left";
ctx.textBaseline = "middle";
ctx.fillText("Spring Physics + SFX AAC", pad + 30 * S, cardY + cardH * 0.38);
ctx.fillStyle = "#97ACA0";
ctx.font = "500 " + Math.max(12, Math.round(22 * S)) + "px sans-serif";
ctx.fillText("Sinkron otomatis per frame di MP4", pad + 30 * S, cardY + cardH * 0.67);

const ringP = ease.apple(ui.seg(p, 0.25, 0.85));
ui.drawRing(ctx, pad + innerW - 76 * S, cardY + cardH * 0.5, 42 * S, ringP, accent, Math.round(ringP * 100) + "%", "rgba(255,255,255,0.1)", "#FFFFFF");
ctx.restore();

ctx.restore();

ui.drawGrain(ctx, W, H, rand, 80, 0.04);
ctx.fillStyle = accent;
ctx.fillRect(0, H - Math.max(4, 6 * S), W * p, Math.max(4, 6 * S));
"""
