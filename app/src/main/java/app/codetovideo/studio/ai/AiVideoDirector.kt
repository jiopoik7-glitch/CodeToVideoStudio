package app.codetovideo.studio.ai

import android.content.Context
import app.codetovideo.studio.core.ProjectMetadataParser
import app.codetovideo.studio.core.StudioProject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

enum class AiMode { INSTANT_PROXY, BYOK }
enum class ByokProvider { GEMINI, OPENROUTER }

data class AiConfig(
    val mode: AiMode = AiMode.BYOK,
    val proxyUrl: String = "",
    val provider: ByokProvider = ByokProvider.GEMINI,
    val geminiKey: String = "",
    val geminiModel: String = "gemini-2.5-flash",
    val openRouterKey: String = "",
    val openRouterModel: String = "google/gemini-2.5-flash"
)

object AiConfigStore {
    private const val PREFS = "ctv_ai_director_prefs_v1"

    fun load(context: Context): AiConfig {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val mode = runCatching { AiMode.valueOf(p.getString("mode", AiMode.BYOK.name) ?: AiMode.BYOK.name) }
            .getOrDefault(AiMode.BYOK)
        val prov = runCatching { ByokProvider.valueOf(p.getString("provider", ByokProvider.GEMINI.name) ?: ByokProvider.GEMINI.name) }
            .getOrDefault(ByokProvider.GEMINI)
        return AiConfig(
            mode = mode,
            proxyUrl = p.getString("proxyUrl", "") ?: "",
            provider = prov,
            geminiKey = p.getString("geminiKey", "") ?: "",
            geminiModel = p.getString("geminiModel", "gemini-2.5-flash")?.ifBlank { "gemini-2.5-flash" } ?: "gemini-2.5-flash",
            openRouterKey = p.getString("openRouterKey", "") ?: "",
            openRouterModel = p.getString("openRouterModel", "google/gemini-2.5-flash")?.ifBlank { "google/gemini-2.5-flash" } ?: "google/gemini-2.5-flash"
        )
    }

    fun save(context: Context, cfg: AiConfig) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("mode", cfg.mode.name)
            .putString("provider", cfg.provider.name)
            .putString("proxyUrl", cfg.proxyUrl.trim())
            .putString("geminiKey", cfg.geminiKey.trim())
            .putString("geminiModel", cfg.geminiModel.trim().ifBlank { "gemini-2.5-flash" })
            .putString("openRouterKey", cfg.openRouterKey.trim())
            .putString("openRouterModel", cfg.openRouterModel.trim().ifBlank { "google/gemini-2.5-flash" })
            .apply()
    }
}

object AiVideoDirector {

    suspend fun generateNew(
        context: Context,
        baseProject: StudioProject,
        storyPrompt: String,
        aspect: String,
        durationSeconds: Int,
        stylePreset: String,
        onStatus: (String) -> Unit
    ): StudioProject = withContext(Dispatchers.IO) {
        val clean = storyPrompt.trim()
        require(clean.isNotEmpty()) { "Tulis dulu cerita, ide, atau tempel naskah videomu." }

        val cfg = AiConfigStore.load(context)
        val sysPrompt = buildSystemPrompt(context)
        val userPrompt = buildString {
            appendLine("BUAT VIDEO ANIMASI BARU BERDASARKAN PERMINTAAN PENGGUNA:")
            appendLine("- Rasio Aspek: $aspect")
            appendLine("- Durasi Target: $durationSeconds detik (30 FPS)")
            appendLine("- Gaya Visual: $stylePreset")
            appendLine("- Cerita / Naskah / Ide Pengguna:")
            appendLine(clean)
            appendLine()
            appendLine("WAJIB awali kode dengan blok /*<studio-meta> ... </studio-meta>*/ valid schemaVersion 5,")
            appendLine("set defaultDurationSeconds = $durationSeconds, dan sertakan konfigurasi audio (ambience + cues SFX yang sinkron dengan adegan).")
            appendLine("Kembalikan HANYA SATU blok kode JavaScript siap render tanpa teks penjelasan tambahan.")
        }

        withContext(Dispatchers.Main) { onStatus("Merancang adegan & animasi video…") }
        val verifiedCode = generateAndAutoHeal(cfg, sysPrompt, userPrompt, onStatus)
        applyCodeToProject(baseProject, verifiedCode, aspect, durationSeconds)
    }

    suspend fun reviseExisting(
        context: Context,
        currentProject: StudioProject,
        revisionPrompt: String,
        onStatus: (String) -> Unit
    ): StudioProject = withContext(Dispatchers.IO) {
        val clean = revisionPrompt.trim()
        require(clean.isNotEmpty()) { "Tulis bagian mana yang ingin diubah atau diperbaiki." }

        val cfg = AiConfigStore.load(context)
        val sysPrompt = buildSystemPrompt(context)
        val userPrompt = buildString {
            appendLine("Berikut adalah kode Code-to-Video Studio yang sedang aktif sekarang:")
            appendLine("```javascript")
            appendLine(currentProject.sourceBody)
            appendLine("```")
            appendLine()
            appendLine("PERMINTAAN REVISI PENGGUNA:")
            appendLine(clean)
            appendLine()
            appendLine("Pertahankan elemen yang sudah bagus, terapkan revisi secara rapi & halus, tetap gunakan /*<studio-meta> ... </studio-meta>*/ valid schemaVersion 5 + audio cues.")
            appendLine("Kembalikan HANYA SATU blok kode JavaScript lengkap siap render.")
        }

        withContext(Dispatchers.Main) { onStatus("Menerapkan revisi ke video…") }
        val verifiedCode = generateAndAutoHeal(cfg, sysPrompt, userPrompt, onStatus)
        applyCodeToProject(
            base = currentProject,
            code = verifiedCode,
            aspect = currentProject.renderSettings.aspect,
            durationSeconds = currentProject.renderSettings.durationSeconds
        )
    }

    private suspend fun generateAndAutoHeal(
        cfg: AiConfig,
        sysPrompt: String,
        initialUserPrompt: String,
        onStatus: (String) -> Unit
    ): String {
        var raw = callProvider(cfg, sysPrompt, initialUserPrompt)
        var code = extractJsCode(raw)

        for (attempt in 1..2) {
            val issue = validateCode(code) ?: return code
            withContext(Dispatchers.Main) { onStatus("Merapikan kode otomatis (Auto-Heal $attempt/2)…") }
            val healPrompt = buildString {
                appendLine("Kode JavaScript yang kamu hasilkan gagal validasi engine Code-to-Video Studio karena:")
                appendLine(issue)
                appendLine()
                appendLine("KODE SEBELUMNYA:")
                appendLine("```javascript")
                appendLine(code)
                appendLine("```")
                appendLine()
                appendLine("Perbaiki error tersebut sepenuhnya tanpa merusak animasi utama. Pastikan blok /*<studio-meta> ... </studio-meta>*/ JSON valid dan 100% deterministik.")
                appendLine("Kembalikan HANYA SATU blok kode JavaScript siap tempel.")
            }
            raw = callProvider(cfg, sysPrompt, healPrompt)
            code = extractJsCode(raw)
        }

        val finalIssue = validateCode(code)
        if (finalIssue != null) {
            throw IllegalStateException("Kode masih bermasalah setelah Auto-Heal: $finalIssue")
        }
        return code
    }

    private fun buildSystemPrompt(context: Context): String {
        val skillDoc = runCatching {
            context.assets.open("docs/skill.md").bufferedReader(Charsets.UTF_8).use { it.readText() }
        }.getOrDefault("").take(15_000)

        return buildString {
            appendLine("Kamu adalah Creative Coder & Motion Graphics Engineer profesional khusus untuk engine Code-to-Video Studio v0.5 (Deterministic Canvas 2D WebWorker Engine).")
            appendLine("FORMAT WAJIB:")
            appendLine("1. Kembalikan HANYA SATU blok kode JavaScript murni siap tempel (tanpa HTML, React, import, export).")
            appendLine("2. WAJIB awali dengan blok metadata persis memakai tag /*<studio-meta> dan </studio-meta>*/ berisi JSON valid schemaVersion 5, title, defaultDurationSeconds, seed, props, dan audio (ambience, ambienceVolume, cues).")
            appendLine("3. DILARANG menggunakan Math.random(), Date.now(), performance.now(), setTimeout, setInterval, requestAnimationFrame, window, document, fetch, atau Image.")
            appendLine("4. Gunakan fungsi bawaan engine (ui, fx, cam, ease, rand, P, ctx, W, H, S, t, D, p, frame, fps) sesuai dokumentasi resmi di bawah, atau Canvas 2D prosedural murni yang ringan.")
            appendLine("5. Hindari ctx.filter dan hindari ctx.shadowBlur di dalam loop agar render HP cepat dan anti-timeout.")
            appendLine("6. Pastikan tidak ada radius/scale negatif atau NaN, semua teks memiliki word-wrap & safe area margin, dan tidak ada adegan diam membeku (zero static holds).")
            if (skillDoc.isNotBlank()) {
                appendLine()
                appendLine("=== DOKUMENTASI RESMI ENGINE (skill.md) ===")
                appendLine(skillDoc)
            }
        }
    }

    private fun extractJsCode(raw: String): String {
        val trimmed = raw.trim()
        val match = Regex("```(?:javascript|js)?\\s*([\\s\\S]*?)```", RegexOption.IGNORE_CASE).find(trimmed)
        return (match?.groupValues?.getOrNull(1) ?: trimmed).trim()
    }

    private fun validateCode(code: String): String? {
        if (code.length < 60) return "Output kode kosong atau terlalu pendek."
        if (code.length > ProjectMetadataParser.MAX_SOURCE_CHARS) return "Kode melebihi batas 256 KiB."
        if (!code.contains("/*<studio-meta>") || !code.contains("</studio-meta>*/")) {
            return "Blok metadata wajib menggunakan tag /*<studio-meta> ... </studio-meta>*/."
        }
        val banned = listOf(
            Regex("\\bMath\\.random\\s*\\(") to "Menggunakan Math.random() yang dilarang (gunakan rand() atau seeded hash).",
            Regex("\\b(window|document)\\s*\\.") to "Mengakses DOM (window/document) yang dilarang di WebWorker.",
            Regex("\\b(setTimeout|setInterval|requestAnimationFrame)\\s*\\(") to "Menggunakan timer non-deterministik.",
            Regex("\\b(fetch|XMLHttpRequest)\\s*\\(") to "Mengakses jaringan di dalam kode render.",
            Regex("\\bimport\\s+.*\\bfrom\\b|\\bexport\\s+default\\b") to "Mengandung import/export module."
        )
        for ((re, msg) in banned) {
            if (re.containsMatchIn(code)) return msg
        }
        return runCatching {
            ProjectMetadataParser.parse(code)
            null
        }.getOrElse { err ->
            "Metadata /*<studio-meta>*/ tidak valid: ${err.message ?: err::class.java.simpleName}"
        }
    }

    private fun applyCodeToProject(
        base: StudioProject,
        code: String,
        aspect: String,
        durationSeconds: Int
    ): StudioProject {
        val meta = runCatching { ProjectMetadataParser.parse(code) }.getOrNull()
        val propsMap = linkedMapOf<String, String>()
        meta?.props?.forEach { prop -> propsMap[prop.key] = prop.defaultValue }
        val finalDuration = (meta?.defaultDurationSeconds ?: durationSeconds).coerceIn(1, 60)
        val safeAspect = if (aspect in setOf("9:16", "16:9", "1:1", "4:5")) aspect else base.renderSettings.aspect

        return base.copy(
            name = (meta?.title?.ifBlank { base.name } ?: base.name).take(80),
            sourceBody = code,
            seed = meta?.seed ?: base.seed,
            propsValues = propsMap,
            renderSettings = base.renderSettings.copy(
                aspect = safeAspect,
                durationSeconds = finalDuration,
                includeAudio = true
            ),
            updatedAtEpochMs = System.currentTimeMillis()
        )
    }

    private fun callProvider(cfg: AiConfig, systemPrompt: String, userPrompt: String): String {
        return when (cfg.mode) {
            AiMode.INSTANT_PROXY -> {
                val url = cfg.proxyUrl.trim()
                if (url.isBlank() || !url.startsWith("http")) {
                    throw IllegalStateException("Alamat Server Mode Instan belum diisi. Buka Pengaturan AI (⚙) untuk isi URL Proxy atau pindah ke Mode Kunci Sendiri (Gratis).")
                }
                val payload = JSONObject().apply {
                    put("systemPrompt", systemPrompt)
                    put("userPrompt", userPrompt)
                }
                val body = httpPostJson(url, payload.toString(), emptyMap())
                val json = JSONObject(body)
                json.optString("text").ifBlank {
                    throw IllegalStateException(json.optString("error").ifBlank { "Server Mode Instan tidak mengembalikan kode." })
                }
            }
            AiMode.BYOK -> when (cfg.provider) {
                ByokProvider.GEMINI -> {
                    val key = cfg.geminiKey.trim()
                    if (key.isBlank()) {
                        throw IllegalStateException("API Key Gemini belum diisi. Ketuk tombol ⚙ AI di kanan atas, pilih Kunci Sendiri, lalu tempel API Key gratis dari Google AI Studio.")
                    }
                    val modelEnc = URLEncoder.encode(cfg.geminiModel.trim().ifBlank { "gemini-2.5-flash" }, "UTF-8")
                    val keyEnc = URLEncoder.encode(key, "UTF-8")
                    val url = "https://generativelanguage.googleapis.com/v1beta/models/$modelEnc:generateContent?key=$keyEnc"

                    val payload = JSONObject().apply {
                        put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", systemPrompt))))
                        put("contents", JSONArray().put(JSONObject().apply {
                            put("role", "user")
                            put("parts", JSONArray().put(JSONObject().put("text", userPrompt)))
                        }))
                        put("generationConfig", JSONObject().put("temperature", 0.52))
                    }
                    val body = httpPostJson(url, payload.toString(), emptyMap())
                    val json = JSONObject(body)
                    val parts = json.optJSONArray("candidates")
                        ?.optJSONObject(0)
                        ?.optJSONObject("content")
                        ?.optJSONArray("parts")
                    val sb = StringBuilder()
                    if (parts != null) {
                        for (i in 0 until parts.length()) {
                            sb.append(parts.optJSONObject(i)?.optString("text").orEmpty())
                        }
                    }
                    sb.toString().ifBlank { throw IllegalStateException("Gemini mengembalikan respons kosong.") }
                }
                ByokProvider.OPENROUTER -> {
                    val key = cfg.openRouterKey.trim()
                    if (key.isBlank()) {
                        throw IllegalStateException("API Key OpenRouter belum diisi. Buka Pengaturan AI (⚙) terlebih dahulu.")
                    }
                    val payload = JSONObject().apply {
                        put("model", cfg.openRouterModel.trim().ifBlank { "google/gemini-2.5-flash" })
                        put("temperature", 0.52)
                        put("messages", JSONArray().apply {
                            put(JSONObject().put("role", "system").put("content", systemPrompt))
                            put(JSONObject().put("role", "user").put("content", userPrompt))
                        })
                    }
                    val headers = mapOf(
                        "Authorization" to "Bearer $key",
                        "HTTP-Referer" to "https://codetovideostudio.app",
                        "X-Title" to "Code-to-Video Studio"
                    )
                    val body = httpPostJson("https://openrouter.ai/api/v1/chat/completions", payload.toString(), headers)
                    val json = JSONObject(body)
                    json.optJSONArray("choices")
                        ?.optJSONObject(0)
                        ?.optJSONObject("message")
                        ?.optString("content")
                        .orEmpty()
                        .ifBlank { throw IllegalStateException("OpenRouter mengembalikan respons kosong.") }
                }
            }
        }
    }

    private fun httpPostJson(urlString: String, jsonBody: String, headers: Map<String, String>): String {
        val conn = (URL(urlString).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 20_000
            readTimeout = 95_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            setRequestProperty("Accept", "application/json")
            headers.forEach { (k, v) -> setRequestProperty(k, v) }
        }
        try {
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(jsonBody) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else (conn.errorStream ?: conn.inputStream)
            val text = if (stream != null) BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() } else ""
            if (code !in 200..299) {
                val parsedErr = runCatching {
                    val j = JSONObject(text)
                    j.optJSONObject("error")?.optString("message")?.ifBlank { null }
                        ?: j.optString("error").ifBlank { null }
                }.getOrNull()
                throw IllegalStateException(parsedErr ?: "Koneksi AI gagal (HTTP $code). Cek koneksi internet atau API Key.")
            }
            return text
        } finally {
            conn.disconnect()
        }
    }
}
