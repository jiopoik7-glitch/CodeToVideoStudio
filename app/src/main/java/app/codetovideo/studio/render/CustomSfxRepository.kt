package app.codetovideo.studio.render

import android.content.Context
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Manages user-imported custom SFX (.mp3/.wav/.m4a/.ogg) normalized and saved locally
 * as 44.1 kHz Stereo 16-bit PCM WAV files inside app private storage.
 */
object CustomSfxRepository {
    private fun dir(context: Context): File = File(context.filesDir, "custom_sfx").apply { mkdirs() }

    private fun cleanKey(name: String): String =
        name.trim().lowercase().replace(Regex("[^a-z0-9_]"), "")

    fun getCustomFile(context: Context, slotName: String): File? {
        val key = cleanKey(slotName)
        if (key.isEmpty()) return null
        val file = File(dir(context), "$key.wav")
        return if (file.exists() && file.length() > 44) file else null
    }

    fun listCustomSlots(context: Context): Set<String> =
        dir(context).listFiles { f -> f.isFile && f.extension == "wav" && f.length() > 44 }
            ?.map { it.nameWithoutExtension }
            ?.toSet()
            ?: emptySet()

    fun deleteCustom(context: Context, slotName: String) {
        val key = cleanKey(slotName)
        if (key.isNotEmpty()) {
            File(dir(context), "$key.wav").takeIf { it.exists() }?.delete()
        }
    }

    fun importFromUri(context: Context, uri: Uri, slotName: String): File {
        val key = cleanKey(slotName)
        require(key.isNotEmpty()) { "Nama slot SFX tidak valid." }
        val pcm = ProceduralAudioEngine.decodeAudioUriToNormalizedPcm16(context, uri.toString(), 4.0)
            ?: throw IllegalStateException("File audio tidak bisa didekode. Gunakan MP3, WAV, atau M4A.")
        val target = File(dir(context), "$key.wav")
        writeWavFile(target, pcm, ProceduralAudioEngine.SAMPLE_RATE, ProceduralAudioEngine.CHANNELS)
        return target
    }

    private fun writeWavFile(file: File, pcm16: ByteArray, sampleRate: Int, channels: Int) {
        val dataSize = pcm16.size
        val byteRate = sampleRate * channels * 2
        val blockAlign = (channels * 2).toShort()
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
            put("RIFF".toByteArray(Charsets.US_ASCII))
            putInt(36 + dataSize)
            put("WAVE".toByteArray(Charsets.US_ASCII))
            put("fmt ".toByteArray(Charsets.US_ASCII))
            putInt(16)
            putShort(1)
            putShort(channels.toShort())
            putInt(sampleRate)
            putInt(byteRate)
            putShort(blockAlign)
            putShort(16)
            put("data".toByteArray(Charsets.US_ASCII))
            putInt(dataSize)
        }.array()
        FileOutputStream(file).use { out ->
            out.write(header)
            out.write(pcm16)
            out.fd.sync()
        }
    }
}
