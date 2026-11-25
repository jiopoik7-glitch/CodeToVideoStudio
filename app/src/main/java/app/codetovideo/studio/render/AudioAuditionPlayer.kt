package app.codetovideo.studio.render

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import java.util.concurrent.Executors

/** Plays real studio SFX WAV previews instantly in-app on a background thread. */
object AudioAuditionPlayer {
    private val executor = Executors.newSingleThreadExecutor()
    @Volatile private var activeTrack: AudioTrack? = null

    fun play(context: Context, sfx: String, pitch: Float = 1.0f) {
        runCatching { activeTrack?.stop(); activeTrack?.release(); activeTrack = null }
        executor.execute {
            runCatching {
                val pcm = ProceduralAudioEngine.synthesizeSingleSfxPcm(context, sfx, pitch)
                val track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
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
}
