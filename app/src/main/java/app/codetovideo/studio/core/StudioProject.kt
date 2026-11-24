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
    val name: String = "iOS 26 Liquid Glass Hero",
    val sourceBody: String = DEFAULT_SOURCE,
    val seed: Int = 26,
    val propsValues: Map<String, String> = emptyMap(),
    val renderSettings: RenderSettings = RenderSettings(),
    val createdAtEpochMs: Long = System.currentTimeMillis(),
    val updatedAtEpochMs: Long = System.currentTimeMillis()
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("schemaVersion", 4)
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
                seed = json.optInt("seed", 26),
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
  "schemaVersion": 4,
  "title": "iOS 26 Liquid Glass Hero",
  "defaultDurationSeconds": 5,
  "seed": 26,
  "props": [
    {"key":"eyebrow","label":"Tag Atas","type":"text","default":"RENDER VIDEO CODE V0.4"},
    {"key":"title","label":"Judul Utama","type":"text","default":"Desain kaca yang"},
    {"key":"highlight","label":"Kata Aksen","type":"text","default":"mengalir."},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#DCE8F5"}
  ],
  "audio": {
    "ambience": "ios_glass_chimes",
    "ambienceVolume": 0.24,
    "cues": [
      {"p": 0.02, "sfx": "liquid_morph", "gain": 0.80},
      {"p": 0.24, "sfx": "water_drop", "gain": 0.78, "pitch": 1.04},
      {"p": 0.44, "sfx": "glass_tap", "gain": 0.78, "pitch": 1.18},
      {"p": 0.76, "sfx": "glass_shimmer", "gain": 0.88}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#DCE8F5");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const settle = spring({ frame, fps, config: { damping: 16, stiffness: 125 } });
const drift = cam.shake(t, 5 * S, 0.75);
const cState = {
  x: drift.x,
  y: drift.y + interpolate(p, [0, 1], [-14 * S, 14 * S]),
  zoom: interpolate(settle, [0, 1], [1.12, 1.0]) + p * 0.035,
  rot: drift.rot
};

ui.drawMeshBg(ctx, W, H, "#090C12", [
  { x: 0.82, y: 0.16, r: 0.78, col: accent, a: 0.32 },
  { x: 0.16, y: 0.84, r: 0.74, col: "#7497C4", a: 0.26 },
  { x: 0.50, y: 0.52, r: 0.58, col: "#FFFFFF", a: 0.08 }
], t);

ctx.save();
cam.apply(ctx, cState, 0.55);
fx.particles.bokeh(ctx, 12, accent, 0.14);
ctx.restore();

ctx.save();
cam.apply(ctx, cState, 1.0);

const pillP = fx.stagger(frame, 0, 4);
ctx.save();
ctx.globalAlpha = ui.clamp(pillP, 0, 1);
ctx.translate(0, (1 - pillP) * 20 * S);
ui.drawPill(ctx, pad, H * 0.17, String(P.eyebrow || "RENDER VIDEO CODE V0.4"), "rgba(255,255,255,0.14)", "#F5F7FA", Math.max(12, Math.round(21 * S)));
ctx.restore();

const fSize = Math.round(80 * S);
const used = ui.drawRichText(ctx, [
  { text: String(P.title || "Desain kaca yang") },
  { text: String(P.highlight || "mengalir."), italic: true, color: accent }
], pad, H * 0.24, innerW, fSize, fSize * 1.18, "#FFFFFF", ui.seg(p, 0.06, 0.42), "left");

const cards = [
  { title: "Liquid Glass Specular", sub: "Chromatic rim + moving sheen", val: 0.96, lbl: "96%" },
  { title: "26 SFX + Motion Director", sub: "Transitions, Charts, 3D & AAC", val: 1.00, lbl: "100%" }
];
const cH = 176 * S;
const cStart = H * 0.24 + used + 58 * S;
for (let i = 0; i < cards.length; i++) {
  const sp = fx.stagger(frame, i + 2, Math.round(fps * 0.26));
  const cy = cStart + i * (cH + 26 * S);
  ctx.save();
  ctx.globalAlpha = ui.clamp(sp * 1.25, 0, 1);
  ctx.translate(0, (1 - sp) * 62 * S);
  ui.drawLiquidGlass(ctx, pad, cy, innerW, cH, 28 * S, { light: false, sweep: (p * 1.4 + i * 0.35) % 1 });

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#F7F9FC";
  ctx.font = "700 " + Math.max(15, Math.round(32 * S)) + "px sans-serif";
  ctx.fillText(cards[i].title, pad + 32 * S, cy + cH * 0.37, innerW - 180 * S);

  ctx.fillStyle = "rgba(220,232,246,0.74)";
  ctx.font = "400 " + Math.max(12, Math.round(23 * S)) + "px sans-serif";
  ctx.fillText(cards[i].sub, pad + 32 * S, cy + cH * 0.67, innerW - 180 * S);

  const rp = ease.liquid(ui.seg(p, 0.24 + i * 0.14, 0.86));
  ui.drawRing(ctx, pad + innerW - 76 * S, cy + cH * 0.5, 44 * S, cards[i].val * rp, accent, cards[i].lbl, "rgba(255,255,255,0.12)", "#FFFFFF", 6 * S);
  ctx.restore();
}
ctx.restore();

ui.drawGrain(ctx, W, H, rand, 70, 0.032);
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, "#FFFFFF", "rgba(255,255,255,0.14)");
"""
