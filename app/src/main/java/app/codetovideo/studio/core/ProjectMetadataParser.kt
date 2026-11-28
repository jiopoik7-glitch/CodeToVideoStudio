package app.codetovideo.studio.core

import org.json.JSONArray
import org.json.JSONObject

enum class PropType { TEXT, COLOR, RANGE, BOOLEAN }

data class StudioProp(
    val key: String,
    val label: String,
    val type: PropType,
    val defaultValue: String,
    val min: Float = 0f,
    val max: Float = 1f,
    val step: Float = 0.1f
)

data class AudioCue(
    val atSeconds: Double = 0.0,
    val atProgress: Double? = null,
    val sfx: String = "pop",
    val gain: Float = 0.8f,
    val pitch: Float = 1.0f
)

data class StudioAudioConfig(
    val ambience: String = "none",
    val ambienceVolume: Float = 0.22f,
    val cues: List<AudioCue> = emptyList()
)

data class SubtitleCue(
    val start: Double,
    val end: Double,
    val text: String
)

data class StudioSubtitleConfig(
    val enabled: Boolean = false,
    val preset: String = "pill_highlight", // pill_highlight | universe_bold | editorial_glass
    val accentColor: String = "#FF3B5C",
    val yRatio: Float = 0.82f,
    val rawSrt: String = "",
    val cues: List<SubtitleCue> = emptyList()
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("enabled", enabled)
        put("preset", preset)
        put("accentColor", accentColor)
        put("yRatio", yRatio.toDouble())
        put("rawSrt", rawSrt)
        put("cues", JSONArray().apply {
            cues.forEach { c ->
                put(JSONObject().apply {
                    put("start", c.start)
                    put("end", c.end)
                    put("text", c.text)
                })
            }
        })
    }

    companion object {
        fun fromJson(json: JSONObject?): StudioSubtitleConfig {
            if (json == null) return StudioSubtitleConfig()
            val arr = json.optJSONArray("cues")
            val cues = mutableListOf<SubtitleCue>()
            if (arr != null) {
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val start = o.optDouble("start", 0.0).coerceAtLeast(0.0)
                    val end = o.optDouble("end", start + 1.5).coerceAtLeast(start + 0.1)
                    val text = o.optString("text", "").trim()
                    if (text.isNotEmpty()) cues += SubtitleCue(start, end, text)
                }
            }
            val preset = json.optString("preset", "pill_highlight").let {
                if (it in setOf("pill_highlight", "universe_bold", "editorial_glass")) it else "pill_highlight"
            }
            return StudioSubtitleConfig(
                enabled = json.optBoolean("enabled", cues.isNotEmpty()),
                preset = preset,
                accentColor = json.optString("accentColor", "#FF3B5C").ifBlank { "#FF3B5C" },
                yRatio = json.optDouble("yRatio", 0.82).toFloat().coerceIn(0.12f, 0.94f),
                rawSrt = json.optString("rawSrt", ""),
                cues = cues
            )
        }
    }
}

data class StudioMetadata(
    val title: String,
    val defaultDurationSeconds: Int,
    val seed: Int,
    val props: List<StudioProp>,
    val audio: StudioAudioConfig = StudioAudioConfig(),
    val subtitles: StudioSubtitleConfig = StudioSubtitleConfig()
)

object SrtSubtitleParser {
    private val SRT_TIME = Regex("""(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})""")
    private val SIMPLE_LINE = Regex("""^(\d+(?:\.\d+)?)\s*[-–>]\s*(\d+(?:\.\d+)?)\s*[:|]\s*(.+)$""")

    fun parse(input: String): List<SubtitleCue> {
        val text = input.replace("\r\n", "\n").trim()
        if (text.isEmpty()) return emptyList()
        val out = mutableListOf<SubtitleCue>()
        val blocks = text.split(Regex("\n\\s*\n"))
        for (block in blocks) {
            val lines = block.lines().map { it.trim() }.filter { it.isNotEmpty() }
            if (lines.isEmpty()) continue
            val timeIdx = lines.indexOfFirst { SRT_TIME.containsMatchIn(it) }
            if (timeIdx >= 0) {
                val m = SRT_TIME.find(lines[timeIdx]) ?: continue
                val start = toSec(m.groupValues[1], m.groupValues[2], m.groupValues[3], m.groupValues[4])
                val end = toSec(m.groupValues[5], m.groupValues[6], m.groupValues[7], m.groupValues[8])
                val caption = lines.drop(timeIdx + 1).joinToString(" ").trim()
                if (caption.isNotEmpty() && end > start) {
                    out += SubtitleCue(start, end, caption)
                }
            } else {
                for (line in lines) {
                    val m = SIMPLE_LINE.find(line) ?: continue
                    val start = m.groupValues[1].toDoubleOrNull() ?: continue
                    val end = m.groupValues[2].toDoubleOrNull() ?: continue
                    val caption = m.groupValues[3].trim()
                    if (caption.isNotEmpty() && end > start) {
                        out += SubtitleCue(start, end, caption)
                    }
                }
            }
        }
        return out.sortedBy { it.start }
    }

    fun formatToSrt(cues: List<SubtitleCue>): String = buildString {
        cues.forEachIndexed { idx, cue ->
            appendLine(idx + 1)
            appendLine("${formatTs(cue.start)} --> ${formatTs(cue.end)}")
            appendLine(cue.text)
            if (idx != cues.lastIndex) appendLine()
        }
    }

    private fun toSec(h: String, m: String, s: String, ms: String): Double {
        val msPad = ms.padEnd(3, '0').take(3).toDoubleOrNull() ?: 0.0
        return (h.toDoubleOrNull() ?: 0.0) * 3600.0 +
            (m.toDoubleOrNull() ?: 0.0) * 60.0 +
            (s.toDoubleOrNull() ?: 0.0) +
            msPad / 1000.0
    }

    private fun formatTs(sec: Double): String {
        val totalMs = (sec.coerceAtLeast(0.0) * 1000.0).toLong()
        val h = totalMs / 3_600_000
        val m = (totalMs % 3_600_000) / 60_000
        val s = (totalMs % 60_000) / 1000
        val ms = totalMs % 1000
        return "%02d:%02d:%02d,%03d".format(java.util.Locale.US, h, m, s, ms)
    }
}

object ProjectMetadataParser {
    private const val OPEN = "/*<studio-meta>"
    private const val CLOSE = "</studio-meta>*/"
    const val MAX_SOURCE_CHARS = 262_144

    fun parse(source: String): StudioMetadata {
        require(source.length <= MAX_SOURCE_CHARS) { "Source code melebihi batas 256 KiB." }
        val start = source.indexOf(OPEN)
        val end = source.indexOf(CLOSE)
        if (start < 0 || end <= start) return StudioMetadata("Untitled Motion", 5, 17, emptyList())
        val jsonText = source.substring(start + OPEN.length, end).trim()
        val json = JSONObject(jsonText)
        val version = json.optInt("schemaVersion", 1)
        require(version in 1..21) { "Schema metadata tidak didukung (versi $version)." }

        val propsArray = json.optJSONArray("props")
        require(propsArray == null || propsArray.length() <= 48) { "Maksimal 48 Props." }
        val props = mutableListOf<StudioProp>()
        val keys = mutableSetOf<String>()
        for (i in 0 until (propsArray?.length() ?: 0)) {
            val item = propsArray!!.getJSONObject(i)
            val key = item.getString("key")
            require(key.matches(Regex("[A-Za-z][A-Za-z0-9_]{0,31}"))) { "Key Prop '$key' tidak valid." }
            require(keys.add(key)) { "Key Prop '$key' duplikat." }
            val type = when (item.getString("type")) {
                "text" -> PropType.TEXT
                "color" -> PropType.COLOR
                "range" -> PropType.RANGE
                "boolean" -> PropType.BOOLEAN
                else -> throw IllegalArgumentException("Tipe Prop '$key' tidak didukung.")
            }
            val min = item.optDouble("min", 0.0).toFloat()
            val max = item.optDouble("max", 1.0).toFloat()
            val step = item.optDouble("step", 0.1).toFloat().coerceAtLeast(0.001f)
            require(min.isFinite() && max.isFinite() && step.isFinite() && max >= min) { "Batas range '$key' tidak valid." }
            if (type == PropType.RANGE) require(max > min) { "Range '$key' harus memiliki max lebih besar dari min." }
            val default = item.opt("default")?.toString() ?: ""
            if (type == PropType.RANGE) {
                val initial = default.toFloatOrNull() ?: throw IllegalArgumentException("Default range '$key' harus berupa angka.")
                require(initial.isFinite() && initial in min..max) { "Default range '$key' berada di luar batas." }
            }
            props += StudioProp(key, item.optString("label", key).take(60), type, default, min, max, step)
        }

        val audioObj = json.optJSONObject("audio")
        val audioConfig = if (audioObj != null) {
            val ambience = audioObj.optString("ambience", "none").trim().lowercase()
            val ambVol = audioObj.optDouble("ambienceVolume", 0.22).toFloat().coerceIn(0f, 1f)
            val cuesArr = audioObj.optJSONArray("cues")
            require(cuesArr == null || cuesArr.length() <= 128) { "Maksimal 128 Audio SFX cues." }
            val cues = mutableListOf<AudioCue>()
            for (i in 0 until (cuesArr?.length() ?: 0)) {
                val c = cuesArr!!.getJSONObject(i)
                val sfx = c.optString("sfx", "pop").trim().lowercase()
                val atSec = c.optDouble("at", 0.0).coerceAtLeast(0.0)
                val atProg = if (c.has("p")) c.optDouble("p", 0.0).coerceIn(0.0, 1.0) else null
                val gain = c.optDouble("gain", 0.8).toFloat().coerceIn(0f, 1.5f)
                val pitch = c.optDouble("pitch", 1.0).toFloat().coerceIn(0.4f, 2.5f)
                cues += AudioCue(atSeconds = atSec, atProgress = atProg, sfx = sfx, gain = gain, pitch = pitch)
            }
            StudioAudioConfig(ambience = ambience, ambienceVolume = ambVol, cues = cues)
        } else {
            StudioAudioConfig()
        }

        val subtitles = StudioSubtitleConfig.fromJson(json.optJSONObject("subtitles"))

        return StudioMetadata(
            title = json.optString("title", "Untitled Motion").take(80),
            defaultDurationSeconds = json.optInt("defaultDurationSeconds", 5).coerceIn(1, 60),
            seed = json.optInt("seed", 17),
            props = props,
            audio = audioConfig,
            subtitles = subtitles
        )
    }

    /**
     * Syncs updated audio cues and/or subtitles cleanly back into the /*<studio-meta>*/ JSON block
     * without altering the user's JS animation body.
     */
    fun writeBackMetadata(
        source: String,
        cues: List<AudioCue>? = null,
        subtitles: StudioSubtitleConfig? = null
    ): String {
        val start = source.indexOf(OPEN)
        val end = source.indexOf(CLOSE)
        val json = if (start >= 0 && end > start) {
            runCatching { JSONObject(source.substring(start + OPEN.length, end).trim()) }
                .getOrElse { JSONObject() }
        } else {
            JSONObject().apply {
                put("schemaVersion", 21)
                put("title", "Cinema Engine Pro v2.1")
                put("defaultDurationSeconds", 8)
                put("seed", 21)
                put("props", JSONArray())
            }
        }
        if (json.optInt("schemaVersion", 1) < 21) {
            json.put("schemaVersion", 21)
        }
        if (cues != null) {
            val audioObj = json.optJSONObject("audio") ?: JSONObject().apply {
                put("ambience", "none")
                put("ambienceVolume", 0.18)
            }
            val arr = JSONArray()
            cues.forEach { cue ->
                arr.put(JSONObject().apply {
                    if (cue.atProgress != null) {
                        put("p", (kotlin.math.round(cue.atProgress * 1000.0) / 1000.0))
                    } else {
                        put("at", (kotlin.math.round(cue.atSeconds * 100.0) / 100.0))
                    }
                    put("sfx", cue.sfx)
                    put("gain", (kotlin.math.round(cue.gain * 100.0) / 100.0))
                    if (kotlin.math.abs(cue.pitch - 1.0f) > 0.01f) {
                        put("pitch", (kotlin.math.round(cue.pitch * 100.0) / 100.0))
                    }
                })
            }
            audioObj.put("cues", arr)
            json.put("audio", audioObj)
        }
        if (subtitles != null) {
            json.put("subtitles", subtitles.toJson())
        }
        val block = "$OPEN\n${json.toString(2)}\n$CLOSE"
        return if (start >= 0 && end > start) {
            source.substring(0, start) + block + source.substring(end + CLOSE.length)
        } else {
            "$block\n\n$source"
        }
    }
}
