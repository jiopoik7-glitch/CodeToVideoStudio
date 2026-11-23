package app.codetovideo.studio.render

import android.content.ContentValues
import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import app.codetovideo.studio.core.StudioProject
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class RenderController(private val context: Context, private val runtime: WebCanvasRuntime) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val cancelled = AtomicBoolean(false)
    @Volatile private var running = false

    fun isRunning(): Boolean = running

    fun cancel() {
        cancelled.set(true)
        runtime.cancelPending()
    }

    fun render(
        project: StudioProject,
        onProgress: (Int, Int) -> Unit,
        onComplete: (Result<Uri>) -> Unit
    ) {
        if (running) return
        cancelled.set(false)
        running = true
        executor.execute {
            var uri: Uri? = null
            var encoder: MediaCodecSurfaceEncoder? = null
            var fileDescriptor: android.os.ParcelFileDescriptor? = null
            try {
                check(Build.VERSION.SDK_INT >= 29) { "Ekspor langsung ke Galeri memerlukan Android 10+. Di Android 8–9 gunakan jalur Save As melalui SAF." }
                check(runtime.exportSupported) { "Export frame belum tersedia pada Android System WebView ini." }
                val settings = project.renderSettings
                val (width, height) = settings.dimensions()
                val displayName = "CodeToVideo_${System.currentTimeMillis()}.mp4"
                val values = ContentValues().apply {
                    put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
                    put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                    put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/CodeToVideoStudio")
                    put(MediaStore.Video.Media.IS_PENDING, 1)
                }
                val outputUri = context.contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("Android tidak bisa membuat item video di Galeri.")
                uri = outputUri
                val outputDescriptor = context.contentResolver.openFileDescriptor(outputUri, "w")
                    ?: throw IllegalStateException("File tujuan tidak bisa dibuka.")
                fileDescriptor = outputDescriptor
                val activeEncoder = MediaCodecSurfaceEncoder(outputDescriptor.fileDescriptor, width, height, settings.fps, settings.quality)
                encoder = activeEncoder

                val total = settings.totalFrames()
                for (frame in 0 until total) {
                    check(!cancelled.get()) { "Render dibatalkan." }
                    val rgba = runtime.requestExportFrame(project, frame).get(10, TimeUnit.SECONDS)
                    check(rgba.size == width * height * 4) { "Ukuran payload frame $frame tidak valid." }
                    activeEncoder.writeFrame(frame, rgba)
                    val completed = frame + 1
                    main.post { onProgress(completed, total) }
                }
                activeEncoder.finish()
                encoder = null
                outputDescriptor.close()
                fileDescriptor = null
                validateVideo(outputUri)
                val publish = ContentValues().apply { put(MediaStore.Video.Media.IS_PENDING, 0) }
                check(context.contentResolver.update(outputUri, publish, null, null) == 1) { "MP4 dibuat tetapi tidak bisa dipublikasikan ke Galeri." }
                main.post { onComplete(Result.success(outputUri)) }
            } catch (error: Throwable) {
                runtime.cancelPending()
                runCatching { encoder?.release() }
                runCatching { fileDescriptor?.close() }
                uri?.let { runCatching { context.contentResolver.delete(it, null, null) } }
                main.post { onComplete(Result.failure(error)) }
            } finally {
                running = false
            }
        }
    }

    fun shutdown() {
        cancel()
        executor.shutdownNow()
    }

    private fun validateVideo(uri: Uri) {
        val descriptor = context.contentResolver.openFileDescriptor(uri, "r")
            ?: throw IllegalStateException("File MP4 tidak bisa dibaca untuk validasi.")
        descriptor.use { pfd ->
            val extractor = MediaExtractor()
            try {
                extractor.setDataSource(pfd.fileDescriptor)
                check(extractor.trackCount > 0) { "MP4 tidak memiliki track." }
                val hasAvc = (0 until extractor.trackCount).any { index ->
                    val format = extractor.getTrackFormat(index)
                    format.containsKey(MediaFormat.KEY_MIME) && format.getString(MediaFormat.KEY_MIME) == MediaFormat.MIMETYPE_VIDEO_AVC
                }
                check(hasAvc) { "Track H.264/AVC tidak ditemukan pada MP4." }
            } finally {
                extractor.release()
            }
        }
    }
}
