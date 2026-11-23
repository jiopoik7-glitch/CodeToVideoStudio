package app.codetovideo.studio.core

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class RenderSettings(
    val longEdge: Int = 720,
    val aspect: String = "9:16",
    val fps: Int = 30,
    val durationSeconds: Int = 5,
    val quality: String = "medium"
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

    fun totalFrames(): Int = (durationSeconds.coerceIn(1, 30) * fps.coerceIn(24, 60))
}

data class StudioProject(
    val projectId: String = UUID.randomUUID().toString(),
    val name: String = "Untitled Motion",
    val sourceBody: String = DEFAULT_SOURCE,
    val seed: Int = 17,
    val propsValues: Map<String, String> = emptyMap(),
    val renderSettings: RenderSettings = RenderSettings(),
    val createdAtEpochMs: Long = System.currentTimeMillis(),
    val updatedAtEpochMs: Long = System.currentTimeMillis()
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("schemaVersion", 1)
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
                sourceBody = json.optString("sourceBody", DEFAULT_SOURCE).take(65_536),
                seed = json.optInt("seed", 17),
                propsValues = props,
                renderSettings = RenderSettings(
                    longEdge = settings.optInt("longEdge", 720).coerceIn(480, 2160),
                    aspect = settings.optString("aspect", "9:16").let { if (it in setOf("1:1", "16:9", "9:16", "4:5")) it else "9:16" },
                    fps = settings.optInt("fps", 30).let { if (it in setOf(24, 30, 60)) it else 30 },
                    durationSeconds = settings.optInt("durationSeconds", 5).coerceIn(1, 30),
                    quality = settings.optString("quality", "medium").let { if (it in setOf("low", "medium", "high", "ultra")) it else "medium" }
                ),
                createdAtEpochMs = json.optLong("createdAtEpochMs", System.currentTimeMillis()),
                updatedAtEpochMs = json.optLong("updatedAtEpochMs", System.currentTimeMillis())
            )
        }
    }
}

const val DEFAULT_SOURCE = """/*<studio-meta>
{
  "schemaVersion": 1,
  "title": "Kinetic Title",
  "defaultDurationSeconds": 5,
  "seed": 17,
  "props": [
    {"key":"title","label":"Title","type":"text","default":"CREATE SOMETHING"},
    {"key":"accent","label":"Accent","type":"color","default":"#66E3D1"},
    {"key":"scale","label":"Scale","type":"range","min":0.65,"max":1.25,"step":0.05,"default":1.0},
    {"key":"showSubtitle","label":"Show subtitle","type":"boolean","default":true}
  ]
}
</studio-meta>*/

ctx.fillStyle = "#0B1020";
ctx.fillRect(0, 0, W, H);

const accent = P.accent || "#66E3D1";
const scale = Number(P.scale || 1);
const title = String(P.title || "CREATE SOMETHING");
const rise = (1 - ease.outCubic(Math.min(p * 2.2, 1))) * H * 0.12;

ctx.save();
ctx.globalAlpha = 0.16;
ctx.strokeStyle = accent;
ctx.lineWidth = Math.max(1, 2 * S);
for (let i = 0; i < 8; i++) {
  const x = W * (0.08 + i * 0.12);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + Math.sin(t * 0.8 + i) * 36 * S, H);
  ctx.stroke();
}
ctx.restore();

ctx.save();
ctx.translate(W / 2, H / 2 - rise);
ctx.scale(scale, scale);
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillStyle = "#F5F7FF";
ctx.font = `800 ${'$'}{Math.max(32, 76 * S)}px sans-serif`;
const words = title.toUpperCase().split(" ");
const lines = [];
let line = "";
for (const word of words) {
  const test = line ? line + " " + word : word;
  if (ctx.measureText(test).width > W * 0.78 && line) { lines.push(line); line = word; }
  else line = test;
}
if (line) lines.push(line);
const lineHeight = 1.08 * 76 * S;
lines.slice(0, 3).forEach((value, i) => {
  ctx.fillText(value, 0, (i - (lines.length - 1) / 2) * lineHeight);
});
ctx.restore();

ctx.fillStyle = accent;
ctx.fillRect(W * 0.12, H * 0.68, W * 0.76 * ease.outCubic(p), Math.max(3, 5 * S));
if (P.showSubtitle !== false && P.showSubtitle !== "false") {
  ctx.textAlign = "center";
  ctx.fillStyle = "#AAB4CC";
  ctx.font = `500 ${'$'}{Math.max(14, 24 * S)}px sans-serif`;
  ctx.fillText("A FRAME-BY-FRAME CANVAS STUDY", W / 2, H * 0.76);
}
ctx.textAlign = "left";
ctx.fillStyle = "#71809F";
ctx.font = `${'$'}{Math.max(12, 18 * S)}px monospace`;
ctx.fillText(`FRAME ${'$'}{frame + 1}`, W * 0.08, H * 0.91);
"""
