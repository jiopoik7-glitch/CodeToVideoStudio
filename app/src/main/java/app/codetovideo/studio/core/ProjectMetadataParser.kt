package app.codetovideo.studio.core

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

data class StudioMetadata(
    val title: String,
    val defaultDurationSeconds: Int,
    val seed: Int,
    val props: List<StudioProp>,
    val audio: StudioAudioConfig = StudioAudioConfig()
)

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
        require(version in 1..7) { "Schema metadata tidak didukung." }

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

        return StudioMetadata(
            title = json.optString("title", "Untitled Motion").take(80),
            defaultDurationSeconds = json.optInt("defaultDurationSeconds", 5).coerceIn(1, 60),
            seed = json.optInt("seed", 17),
            props = props,
            audio = audioConfig
        )
    }
}
