package app.codetovideo.studio.storage

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File
import java.io.FileOutputStream

data class LocalMediaAsset(
    val alias: String,
    val fileName: String,
    val mimeType: String,
    val sizeBytes: Long
)

/**
 * Zero-permission Local Media Asset Manager (uses Photo Picker / OpenDocument).
 * Stores imported PNG/JPG/WebP/SVG files inside app-private storage so the
 * offline WebView runtime can access them deterministically via `assets.drawImage('alias', ...)`.
 */
object MediaAssetRepository {
    private const val MAX_FILE_BYTES = 12 * 1024 * 1024L // 12 MB per image asset

    fun dir(context: Context): File = File(context.filesDir, "media_assets").apply { mkdirs() }

    fun sanitizeAlias(raw: String): String {
        val cleaned = raw.trim().lowercase()
            .substringBeforeLast('.')
            .replace(Regex("[^a-z0-9_]+"), "_")
            .trim('_')
            .take(36)
        return cleaned.ifBlank { "aset_${System.currentTimeMillis() % 10000}" }
    }

    fun importFromUri(context: Context, uri: Uri, customAlias: String? = null): LocalMediaAsset {
        val resolver = context.contentResolver
        val displayName = queryName(resolver, uri) ?: "image.png"
        val mime = resolver.getType(uri) ?: guessMime(displayName)
        val ext = when {
            mime.contains("svg", true) || displayName.endsWith(".svg", true) -> "svg"
            mime.contains("png", true) || displayName.endsWith(".png", true) -> "png"
            mime.contains("webp", true) || displayName.endsWith(".webp", true) -> "webp"
            else -> "jpg"
        }
        val alias = sanitizeAlias(customAlias?.takeIf { it.isNotBlank() } ?: displayName)
        val targetFileName = "${alias}.${ext}"
        val target = File(dir(context), targetFileName)

        // Remove any previous file with the same alias & different extension
        dir(context).listFiles { f -> f.isFile && f.nameWithoutExtension == alias && f.name != targetFileName }
            ?.forEach { it.delete() }

        val bytes = resolver.openInputStream(uri)?.use { input ->
            val buf = input.readBytes()
            require(buf.isNotEmpty()) { "File gambar kosong." }
            require(buf.size <= MAX_FILE_BYTES) { "Ukuran gambar maksimal 12 MB." }
            buf
        } ?: throw IllegalStateException("Gambar tidak bisa dibaca.")

        FileOutputStream(target).use { out ->
            out.write(bytes)
            out.fd.sync()
        }
        return LocalMediaAsset(
            alias = alias,
            fileName = targetFileName,
            mimeType = guessMime(targetFileName),
            sizeBytes = target.length()
        )
    }

    fun listAssets(context: Context): List<LocalMediaAsset> {
        return dir(context).listFiles { f -> f.isFile && f.length() > 0 }
            ?.sortedByDescending { it.lastModified() }
            ?.map { f ->
                LocalMediaAsset(
                    alias = f.nameWithoutExtension,
                    fileName = f.name,
                    mimeType = guessMime(f.name),
                    sizeBytes = f.length()
                )
            }
            ?: emptyList()
    }

    fun resolveFile(context: Context, fileName: String): File? {
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) return null
        val file = File(dir(context), fileName)
        return if (file.exists() && file.isFile) file else null
    }

    fun delete(context: Context, fileName: String) {
        resolveFile(context, fileName)?.delete()
    }

    fun guessMime(fileName: String): String = when (fileName.substringAfterLast('.', "").lowercase()) {
        "png" -> "image/png"
        "webp" -> "image/webp"
        "svg" -> "image/svg+xml"
        "gif" -> "image/gif"
        else -> "image/jpeg"
    }

    private fun queryName(resolver: ContentResolver, uri: Uri): String? = runCatching {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    }.getOrNull() ?: uri.lastPathSegment?.substringAfterLast('/')
}
