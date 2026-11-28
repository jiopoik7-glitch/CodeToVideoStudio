package app.codetovideo.studio.render

import android.content.Context
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import app.codetovideo.studio.core.ProjectMetadataParser
import app.codetovideo.studio.core.StudioProject
import app.codetovideo.studio.storage.MediaAssetRepository
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.FileInputStream
import java.util.UUID
import java.util.concurrent.CompletableFuture

import kotlin.math.roundToInt

data class RuntimeErrorInfo(
    val rawMessage: String,
    val indonesianExplanation: String,
    val lineNumber: Int? = null,
    val columnNumber: Int? = null,
    val codeSnippet: String = "",
    val timestampMs: Long = System.currentTimeMillis()
)

/** Local, offline-only Main WebView hardware Canvas + WebGL2 Three.js runtime with Adaptive Preview & Clean Error Diagnostics. */
class WebCanvasRuntime(private val context: Context) {
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var webView: WebView? = null
    @Volatile var ready: Boolean = false
        private set
    @Volatile var engineInitializing: Boolean = true
        private set
    @Volatile var initStageMessage: String = "Menyiapkan Engine 3D…"
        private set
    @Volatile var exportSupported: Boolean = false
        private set
    @Volatile var fontsPreloaded: Boolean = false
        private set
    @Volatile var threeLoaded: Boolean = false
        private set
    @Volatile var isSoftwareGpu: Boolean = false
        private set
    @Volatile var lastRenderMs: Double = 0.0
        private set
    @Volatile var lastPreviewWidth: Int = 0
        private set
    @Volatile var lastPreviewHeight: Int = 0
        private set
    @Volatile var lastPreviewScale: Float = 0.5f
        private set
    @Volatile var lastError: RuntimeErrorInfo? = null
        private set

    @Volatile private var lastSourceBody: String = ""

    private data class PendingFrame(
        val frame: Int,
        val token: String,
        val future: CompletableFuture<ByteArray>,
        var metadataReceived: Boolean = false
    )
    @Volatile private var pending: PendingFrame? = null

    fun clearError() {
        lastError = null
    }

    fun createWebView(): WebView {
        webView?.let { (it.parent as? android.view.ViewGroup)?.removeView(it); return it }
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", SecureStudioAssetHandler(context, "web"))
            .addPathHandler("/libs/", SecureStudioAssetHandler(context, "libs"))
            .addPathHandler("/fonts/", SecureStudioAssetHandler(context, "fonts"))
            .addPathHandler("/media/", LocalMediaAssetHandler(context))
            .build()
        return WebView(context).apply {
            setBackgroundColor(Color.rgb(8, 11, 18))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.allowFileAccessFromFileURLs = false
            settings.allowUniversalAccessFromFileURLs = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.blockNetworkLoads = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webChromeClient = android.webkit.WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest): WebResourceResponse? =
                    loader.shouldInterceptRequest(request.url) ?: WebResourceResponse(
                        "text/plain", "UTF-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0))
                    )

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean =
                    request.url.host != WebViewAssetLoader.DEFAULT_DOMAIN

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    ready = true
                    val bridgeSupported = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
                        WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)
                    exportSupported = bridgeSupported
                    evaluateJavascript("window.studioRuntimeStatus ? JSON.stringify(window.studioRuntimeStatus()) : '{}' ") { raw ->
                        val normalized = raw?.trim('"')?.replace("\\\"", "\"") ?: "{}"
                        val obj = runCatching { JSONObject(normalized) }.getOrNull()
                        val engineReady = obj?.optBoolean("engineReady", false) ?: false
                        engineInitializing = !engineReady
                        fontsPreloaded = obj?.optBoolean("fontsLoaded", false) ?: false
                        threeLoaded = obj?.optBoolean("threeLoaded", false) ?: false
                        isSoftwareGpu = obj?.optBoolean("softwareGpu", false) ?: false
                        exportSupported = bridgeSupported && (obj?.optBoolean("exportSupported", true) ?: true)
                    }
                }

                override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
                    ready = false
                    engineInitializing = true
                    initStageMessage = "Menyiapkan ulang Engine…"
                    exportSupported = false
                    pending?.future?.completeExceptionally(IllegalStateException("WebView renderer berhenti. Buka ulang tab Render."))
                    pending = null
                    return true
                }
            }

            val supported = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
                WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)
            if (supported) {
                WebViewCompat.addWebMessageListener(this, "studioNative", setOf("https://${WebViewAssetLoader.DEFAULT_DOMAIN}")) { _, message, sourceOrigin, isMainFrame, _ ->
                    if (!isMainFrame || sourceOrigin.host != WebViewAssetLoader.DEFAULT_DOMAIN) return@addWebMessageListener
                    handleNativeMessage(message)
                }
            }
            webView = this
            loadUrl("https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/index.html")
        }
    }

    fun preview(project: StudioProject, frame: Int = 0) {
        val view = webView ?: return
        lastSourceBody = project.sourceBody
        val settings = project.renderSettings
        val (fullWidth, fullHeight) = settings.dimensions()
        val (pw, ph) = computePreviewDimensions(fullWidth, fullHeight)
        lastPreviewWidth = pw
        lastPreviewHeight = ph
        lastPreviewScale = (pw.toFloat() / fullWidth.coerceAtLeast(1).toFloat()).coerceIn(0.1f, 1f)
        val payload = runCatching { framePayload(project, frame, pw, ph, "preview", "preview", false) }
            .getOrElse { error ->
                val msg = error.message ?: "Metadata proyek tidak valid."
                lastError = buildSmartError(msg, null, null, project.sourceBody)
                return
            }
        val script = "window.renderPreview && window.renderPreview(${payload})"
        main.post { if (ready) view.evaluateJavascript(script, null) }
    }

    fun requestExportFrame(project: StudioProject, frame: Int, livePreview: Boolean = false): CompletableFuture<ByteArray> {
        val result = CompletableFuture<ByteArray>()
        val view = webView
        if (!ready || !exportSupported || view == null) {
            result.completeExceptionally(IllegalStateException("WebView ArrayBuffer bridge belum didukung pada perangkat ini."))
            return result
        }
        lastSourceBody = project.sourceBody
        val settings = project.renderSettings
        val (width, height) = settings.dimensions()
        val token = UUID.randomUUID().toString()
        synchronized(this) {
            if (pending != null) {
                result.completeExceptionally(IllegalStateException("Masih ada frame yang belum selesai."))
                return result
            }
            pending = PendingFrame(frame, token, result)
        }
        val payload = framePayload(project, frame, width, height, "export", token, livePreview)
        main.post {
            if (!ready) {
                clearPending(IllegalStateException("Web runtime belum siap."))
            } else {
                view.evaluateJavascript("window.renderExportFrame && window.renderExportFrame(${payload})", null)
            }
        }
        result.whenComplete { _, _ -> synchronized(this) { if (pending?.future === result) pending = null } }
        return result
    }

    fun cancelPending() {
        val current = synchronized(this) { pending.also { pending = null } }
        current?.future?.completeExceptionally(InterruptedException("Render dibatalkan."))
        main.post { webView?.evaluateJavascript("window.cancelStudioRender && window.cancelStudioRender()", null) }
    }

    fun destroy() {
        ready = false
        engineInitializing = true
        exportSupported = false
        cancelPending()
        main.post {
            webView?.stopLoading()
            webView?.destroy()
            webView = null
        }
    }

    private fun handleNativeMessage(message: WebMessageCompat) {
        when (message.type) {
            WebMessageCompat.TYPE_STRING -> {
                val text = message.data ?: return
                val json = runCatching { JSONObject(text) }.getOrNull() ?: return
                when (json.optString("type")) {
                    "initProgress" -> {
                        engineInitializing = true
                        val stage = json.optString("stage", "").trim()
                        if (stage.isNotEmpty()) initStageMessage = stage
                    }
                    "ready", "status" -> {
                        engineInitializing = false
                        fontsPreloaded = json.optBoolean("fontsLoaded", fontsPreloaded)
                        threeLoaded = json.optBoolean("threeLoaded", threeLoaded)
                        isSoftwareGpu = json.optBoolean("softwareGpu", isSoftwareGpu)
                    }
                    "previewOk" -> {
                        engineInitializing = false
                        lastRenderMs = json.optDouble("renderMs", 0.0)
                        fontsPreloaded = json.optBoolean("fontsLoaded", fontsPreloaded)
                        threeLoaded = json.optBoolean("threeLoaded", threeLoaded)
                        isSoftwareGpu = json.optBoolean("softwareGpu", isSoftwareGpu)
                        val w = json.optInt("width", 0)
                        val h = json.optInt("height", 0)
                        if (w > 0 && h > 0) {
                            lastPreviewWidth = w
                            lastPreviewHeight = h
                        }
                        lastError = null
                    }
                    "frame" -> {
                        val current = synchronized(this) { pending } ?: return
                        val matches = json.optInt("frame", -1) == current.frame && json.optString("token") == current.token
                        if (!matches) clearPending(IllegalStateException("Frame index atau job token tidak cocok."))
                        else {
                            current.metadataReceived = true
                            lastRenderMs = json.optDouble("renderMs", lastRenderMs)
                            lastError = null
                        }
                    }
                    "userError", "error" -> {
                        engineInitializing = false
                        val errMsg = json.optString("message", "Skrip gagal menggambar frame.")
                        val line = if (json.has("line") && !json.isNull("line")) json.optInt("line", -1).takeIf { it > 0 } else null
                        val col = if (json.has("column") && !json.isNull("column")) json.optInt("column", -1).takeIf { it > 0 } else null
                        lastError = buildSmartError(errMsg, line, col, lastSourceBody)
                        val current = synchronized(this) { pending }
                        if (current != null) {
                            clearPending(IllegalStateException(errMsg))
                        }
                    }
                }
            }
            WebMessageCompat.TYPE_ARRAY_BUFFER -> {
                val current = synchronized(this) { pending } ?: return
                if (!current.metadataReceived) {
                    clearPending(IllegalStateException("Data frame diterima tanpa metadata frame."))
                    return
                }
                val bytes = message.arrayBuffer
                current.future.complete(bytes)
            }
        }
    }

    private fun clearPending(error: Throwable) {
        val current = synchronized(this) { pending.also { pending = null } }
        current?.future?.completeExceptionally(error)
    }

    private fun framePayload(project: StudioProject, frame: Int, width: Int, height: Int, mode: String, token: String, livePreview: Boolean): String {
        val meta = ProjectMetadataParser.parse(project.sourceBody)
        val props = JSONObject()
        meta.props.forEach { prop ->
            val raw = project.propsValues[prop.key] ?: prop.defaultValue
            val value: Any = when (prop.type) {
                app.codetovideo.studio.core.PropType.RANGE -> raw.toFloatOrNull()?.coerceIn(prop.min, prop.max) ?: prop.min
                app.codetovideo.studio.core.PropType.BOOLEAN -> raw.equals("true", true)
                else -> raw.take(256)
            }
            props.put(prop.key, value)
        }
        val mediaArr = JSONArray()
        MediaAssetRepository.listAssets(context).forEach { asset ->
            mediaArr.put(JSONObject().apply {
                put("alias", asset.alias)
                put("url", "https://${WebViewAssetLoader.DEFAULT_DOMAIN}/media/${asset.fileName}")
            })
        }
        val effectiveSub = project.effectiveSubtitles(meta)
        return JSONObject().apply {
            put("sourceBody", project.sourceBody)
            put("W", width)
            put("H", height)
            put("frame", frame)
            put("fps", project.renderSettings.fps)
            put("D", project.renderSettings.durationSeconds)
            put("totalFrames", project.renderSettings.totalFrames())
            put("seed", project.seed)
            put("props", props)
            put("mode", mode)
            put("token", token)
            put("livePreview", livePreview)
            put("motionBlurSamples", if (mode == "export") project.renderSettings.motionBlurSamples else 1)
            put("mediaAssets", mediaArr)
            put("subtitles", effectiveSub.toJson())
        }.toString()
    }

    companion object {
        /**
         * Adaptive Live Preview sizing: renders at <= 0.5x resolution (capped at 540px width),
         * rounded to even integers >= 64 while preserving aspect ratio. Final MP4 Export always uses 100% Full HD.
         */
        fun computePreviewDimensions(fullWidth: Int, fullHeight: Int): Pair<Int, Int> {
            val safeW = fullWidth.coerceAtLeast(2)
            val safeH = fullHeight.coerceAtLeast(2)
            val scale = minOf(0.5f, 540f / safeW.toFloat()).coerceAtMost(1f)
            val evenW = (((safeW * scale) / 2f).roundToInt() * 2).coerceIn(64, 540)
            val evenH = (((safeH * scale) / 2f).roundToInt() * 2).coerceAtLeast(64)
            return evenW to evenH
        }

        fun buildSmartError(rawMessage: String, line: Int?, col: Int?, sourceBody: String): RuntimeErrorInfo {
            val lower = rawMessage.lowercase()
            val explanation = when {
                "is not defined" in lower -> "Variabel atau fungsi belum dideklarasikan (mungkin salah ketik nama API v2.1 seperti studio3D, rig2D, world2D, fx.glass, atau assets)."
                "is not a function" in lower -> "Anda memanggil properti yang bukan fungsi. Periksa ejaan method di dokumentasi v2.1."
                "unexpected token" in lower || "syntaxerror" in lower -> "Kesalahan penulisan sintaks JavaScript (kurung kurawal {}, tanda kurung (), atau koma yang tidak lengkap)."
                "cannot read propert" in lower || "null" in lower || "undefined" in lower -> "Ada objek bernilai kosong (null/undefined) yang diakses propertinya."
                "radius" in lower || "indexsizeerror" in lower || "negative" in lower -> "Nilai radius lingkaran/gradien negatif atau NaN. Pastikan menggunakan Math.max(0.1, ...)."
                "timeout" in lower -> "Frame membutuhkan waktu render terlalu lama. Kurangi jumlah loop/partikel atau hindari ctx.shadowBlur berat di dalam loop."
                "studio-meta" in lower || "metadata" in lower || "json" in lower -> "Format JSON di dalam blok /*<studio-meta> ... </studio-meta>*/ tidak valid. Periksa tanda kutip ganda dan koma terakhir."
                else -> "Terjadi kesalahan saat mengeksekusi skrip animasi JavaScript pada frame ini."
            }
            val lines = sourceBody.lines()
            val snippet = if (line != null && line in 1..lines.size) {
                val from = (line - 2).coerceAtLeast(1)
                val to = (line + 2).coerceAtMost(lines.size)
                (from..to).joinToString("\n") { ln ->
                    val prefix = if (ln == line) ">>> " else "    "
                    "$prefix$ln: ${lines[ln - 1]}"
                }
            } else {
                ""
            }
            return RuntimeErrorInfo(
                rawMessage = rawMessage,
                indonesianExplanation = explanation,
                lineNumber = line,
                columnNumber = col,
                codeSnippet = snippet
            )
        }
    }
}

private class SecureStudioAssetHandler(
    private val context: Context,
    private val assetSubDir: String
) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse? {
        val safePath = path.replace("\\", "/")
        if (safePath.contains("..") || safePath.startsWith("/")) return null
        val mime = when {
            safePath.endsWith(".html") -> "text/html"
            safePath.endsWith(".js") -> "application/javascript"
            safePath.endsWith(".css") -> "text/css"
            safePath.endsWith(".ttf") -> "font/ttf"
            safePath.endsWith(".woff2") -> "font/woff2"
            safePath.endsWith(".png") -> "image/png"
            safePath.endsWith(".svg") -> "image/svg+xml"
            else -> "application/octet-stream"
        }
        val csp = if (safePath == "renderer-worker.js") {
            "default-src 'none'; script-src 'self' 'unsafe-eval'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'"
        } else {
            "default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; worker-src 'self'"
        }
        val headers = mapOf(
            "Content-Security-Policy" to csp,
            "X-Content-Type-Options" to "nosniff",
            "Cache-Control" to "no-store",
            "Access-Control-Allow-Origin" to "https://${WebViewAssetLoader.DEFAULT_DOMAIN}"
        )
        return try {
            WebResourceResponse(mime, "UTF-8", 200, "OK", headers, context.assets.open("$assetSubDir/$safePath"))
        } catch (_: Exception) {
            null
        }
    }
}

private class LocalMediaAssetHandler(private val context: Context) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse? {
        val safeName = path.replace("\\", "/").substringAfterLast('/')
        val file = MediaAssetRepository.resolveFile(context, safeName) ?: return null
        val mime = MediaAssetRepository.guessMime(file.name)
        val headers = mapOf(
            "X-Content-Type-Options" to "nosniff",
            "Cache-Control" to "no-store",
            "Access-Control-Allow-Origin" to "https://${WebViewAssetLoader.DEFAULT_DOMAIN}"
        )
        return runCatching {
            WebResourceResponse(mime, null, 200, "OK", headers, FileInputStream(file))
        }.getOrNull()
    }
}
