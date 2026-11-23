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

data class StudioMetadata(val title: String, val defaultDurationSeconds: Int, val seed: Int, val props: List<StudioProp>)

object ProjectMetadataParser {
    private const val OPEN = "/*<studio-meta>"
    private const val CLOSE = "</studio-meta>*/"

    fun parse(source: String): StudioMetadata {
        require(source.length <= 65_536) { "Source code melebihi batas 64 KiB." }
        val start = source.indexOf(OPEN)
        val end = source.indexOf(CLOSE)
        if (start < 0 || end <= start) return StudioMetadata("Untitled Motion", 5, 17, emptyList())
        val jsonText = source.substring(start + OPEN.length, end).trim()
        val json = JSONObject(jsonText)
        require(json.optInt("schemaVersion", 1) == 1) { "Schema metadata tidak didukung." }
        val propsArray = json.optJSONArray("props")
        require(propsArray == null || propsArray.length() <= 32) { "Maksimal 32 Props." }
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
        return StudioMetadata(
            title = json.optString("title", "Untitled Motion").take(80),
            defaultDurationSeconds = json.optInt("defaultDurationSeconds", 5).coerceIn(1, 30),
            seed = json.optInt("seed", 17),
            props = props
        )
    }
}
