package app.codetovideo.studio.render

import android.content.Context
import android.graphics.Color
import android.net.Uri
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
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.CompletableFuture

/** Local, offline-only Canvas worker runtime. User code never receives the native bridge. */
class WebCanvasRuntime(private val context: Context) {
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var webView: WebView? = null
    @Volatile var ready: Boolean = false
        private set
    @Volatile var exportSupported: Boolean = false
        private set

    private data class PendingFrame(
        val frame: Int,
        val token: String,
        val future: CompletableFuture<ByteArray>,
        var metadataReceived: Boolean = false
    )
    @Volatile private var pending: PendingFrame? = null

    fun createWebView(): WebView {
        webView?.let { (it.parent as? android.view.ViewGroup)?.removeView(it); return it }
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", SecureStudioAssetHandler(context))
            .build()
        return WebView(context).apply {
            setBackgroundColor(Color.rgb(9, 13, 25))
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
                    loader.shouldInterceptRequest(request.url) ?: WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", emptyMap(), java.io.ByteArrayInputStream(ByteArray(0)))

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean =
                    request.url.host != WebViewAssetLoader.DEFAULT_DOMAIN

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    ready = true
                    evaluateJavascript("window.studioRuntimeStatus ? JSON.stringify(window.studioRuntimeStatus()) : '{}' ") { raw ->
                        val normalized = raw?.trim('"')?.replace("\\\"", "\"") ?: "{}"
                        val supported = runCatching { JSONObject(normalized).optBoolean("exportSupported", false) }.getOrDefault(false)
                        exportSupported = supported && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
                            WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)
                    }
                }

                override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
                    ready = false
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
        val settings = project.renderSettings
        val (width, height) = settings.dimensions()
        val payload = runCatching { framePayload(project, frame, width, height, "preview", "preview") }
            .getOrElse { error ->
                val message = JSONObject.quote(error.message ?: "Metadata proyek tidak valid.")
                main.post { if (ready) view.evaluateJavascript("window.showHostError && window.showHostError($message)", null) }
                return
            }
        val script = "window.renderPreview && window.renderPreview(${payload})"
        main.post { if (ready) view.evaluateJavascript(script, null) }
    }

    fun requestExportFrame(project: StudioProject, frame: Int): CompletableFuture<ByteArray> {
        val result = CompletableFuture<ByteArray>()
        val view = webView
        if (!ready || !exportSupported || view == null) {
            result.completeExceptionally(IllegalStateException("WebView/OffscreenCanvas/ArrayBuffer belum didukung. Perbarui Android System WebView."))
            return result
        }
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
        val payload = framePayload(project, frame, width, height, "export", token)
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
        main.post { webView?.evaluateJavascript("window.abortWorker && window.abortWorker()", null) }
    }

    fun destroy() {
        ready = false
        exportSupported = false
        cancelPending()
        main.post {
            webView?.stopLoading()
            webView?.destroy()
            webView = null
        }
    }

    private fun handleNativeMessage(message: WebMessageCompat) {
        val current = synchronized(this) { pending } ?: return
        when (message.type) {
            WebMessageCompat.TYPE_STRING -> {
                val text = message.data ?: return
                val json = runCatching { JSONObject(text) }.getOrNull() ?: return
                when (json.optString("type")) {
                    "frame" -> {
                        val matches = json.optInt("frame", -1) == current.frame && json.optString("token") == current.token
                        if (!matches) clearPending(IllegalStateException("Frame index atau job token tidak cocok."))
                        else current.metadataReceived = true
                    }
                    "error" -> clearPending(IllegalStateException(json.optString("message", "Worker gagal menggambar frame.")))
                }
            }
            WebMessageCompat.TYPE_ARRAY_BUFFER -> {
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

    private fun framePayload(project: StudioProject, frame: Int, width: Int, height: Int, mode: String, token: String): String {
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
        }.toString()
    }
}

private class SecureStudioAssetHandler(private val context: Context) : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse? {
        val safePath = path.replace("\\", "/")
        if (safePath.contains("..") || safePath.startsWith("/")) return null
        val mime = when {
            safePath.endsWith(".html") -> "text/html"
            safePath.endsWith(".js") -> "application/javascript"
            safePath.endsWith(".css") -> "text/css"
            else -> "application/octet-stream"
        }
        val csp = if (safePath == "renderer-worker.js") {
            "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'; object-src 'none'; base-uri 'none'"
        } else {
            "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; worker-src 'self'"
        }
        val headers = mapOf(
            "Content-Security-Policy" to csp,
            "X-Content-Type-Options" to "nosniff",
            "Cache-Control" to "no-store"
        )
        return try {
            WebResourceResponse(mime, "UTF-8", 200, "OK", headers, context.assets.open("web/$safePath"))
        } catch (_: Exception) {
            null
        }
    }
}
