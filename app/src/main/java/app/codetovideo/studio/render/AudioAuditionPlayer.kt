package app.codetovideo.studio.render

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import java.util.concurrent.Executors

/** Thread-safe in-app SFX & Ambience audition player. */
object AudioAuditionPlayer {
    private val executor = Executors.newSingleThreadExecutor()
    @Volatile private var activeTrack: AudioTrack? = null

    fun stop() {
        executor.execute {
            runCatching {
                activeTrack?.stop()
                activeTrack?.release()
                activeTrack = null
            }
        }
    }

    fun play(context: Context, sfx: String, pitch: Float = 1.0f) {
        val appCtx = context.applicationContext
        executor.execute {
            playPcmInternal(ProceduralAudioEngine.synthesizeSingleSfxPcm(appCtx, sfx, pitch))
        }
    }

    fun playAmbience(ambience: String) {
        executor.execute {
            playPcmInternal(ProceduralAudioEngine.synthesizeAmbiencePreviewPcm(ambience))
        }
    }

    private fun playPcmInternal(pcm: ByteArray) {
        runCatching {
            activeTrack?.stop()
            activeTrack?.release()
            activeTrack = null
        }
        if (pcm.isEmpty()) return
        runCatching {
            val track = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(ProceduralAudioEngine.SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                        .build()
                )
                .setBufferSizeInBytes(pcm.size.coerceAtLeast(4096))
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()
            activeTrack = track
            track.write(pcm, 0, pcm.size)
            track.play()
        }
    }
}
