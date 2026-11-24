package app.codetovideo.studio.render

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import app.codetovideo.studio.core.StudioAudioConfig
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.tanh

data class EncodedAudioPacket(
    val data: ByteArray,
    val presentationTimeUs: Long,
    val flags: Int
)

data class EncodedAudioTrack(
    val format: MediaFormat,
    val packets: List<EncodedAudioPacket>
)

/**
 * Offline 44.1 kHz Stereo Procedural SFX & Ambience Engine + AAC Encoder.
 * 100% deterministic, royalty-free, zero external audio assets required.
 */
object ProceduralAudioEngine {
    private const val SAMPLE_RATE = 44_100
    private const val CHANNELS = 2
    private const val BIT_RATE = 128_000
    private const val TWO_PI = 2.0 * PI

    private class FastRng(seed: Int) {
        private var state = if (seed == 0) 0x9E3779B9.toInt() else seed
        fun nextFloat(): Float {
            var x = state
            x = x xor (x shl 13)
            x = x xor (x ushr 17)
            x = x xor (x shl 5)
            state = x
            return ((x and 0x7FFFFFFF).toFloat() / 0x3FFFFFFF.toFloat()) - 1f
        }
    }

    fun synthesizeAndEncode(
        durationSeconds: Int,
        seed: Int,
        config: StudioAudioConfig
    ): EncodedAudioTrack {
        val dur = durationSeconds.coerceIn(1, 60)
        val totalFrames = dur * SAMPLE_RATE
        val mix = FloatArray(totalFrames * CHANNELS)
        val rng = FastRng(seed * 31 + 17)

        // 1. Render Ambient Bed
        if (config.ambience != "none" && config.ambienceVolume > 0.005f) {
            renderAmbience(mix, totalFrames, dur.toDouble(), config.ambience, config.ambienceVolume, rng)
        }

        // 2. Render Every SFX Cue on Timeline
        config.cues.forEachIndexed { idx, cue ->
            val timeSec = if (cue.atProgress != null) cue.atProgress * dur.toDouble() else cue.atSeconds
            val startFrame = (timeSec * SAMPLE_RATE).toInt()
            if (startFrame in 0 until totalFrames) {
                val cueRng = FastRng(seed * 131 + idx * 977 + cue.sfx.hashCode())
                val pan = ((idx % 3) - 1) * 0.14f // subtle stereo width
                renderSfx(mix, totalFrames, startFrame, cue.sfx, cue.gain, cue.pitch, pan, cueRng)
            }
        }

        // 3. Master Soft Limiter + Fade Safety + 16-bit Little Endian PCM
        val pcm = ByteArray(totalFrames * CHANNELS * 2)
        val fadeSamples = (0.025 * SAMPLE_RATE).toInt()
        var byteIdx = 0
        for (i in 0 until totalFrames) {
            val edgeEnv = when {
                i < fadeSamples -> i.toFloat() / fadeSamples
                i > totalFrames - fadeSamples -> (totalFrames - i).toFloat() / fadeSamples
                else -> 1f
            }
            for (ch in 0 until CHANNELS) {
                val raw = mix[i * CHANNELS + ch] * edgeEnv * 0.90f
                val limited = tanh(raw.toDouble()).toFloat().coerceIn(-0.99f, 0.99f)
                val s16 = (limited * 32767f).toInt().toShort()
                pcm[byteIdx++] = (s16.toInt() and 0xFF).toByte()
                pcm[byteIdx++] = ((s16.toInt() shr 8) and 0xFF).toByte()
            }
        }

        return encodePcmToAac(pcm)
    }

    private fun addSample(mix: FloatArray, totalFrames: Int, frameIdx: Int, left: Float, right: Float) {
        if (frameIdx < 0 || frameIdx >= totalFrames) return
        val base = frameIdx * CHANNELS
        mix[base] += left
        mix[base + 1] += right
    }

    private fun renderAmbience(
        mix: FloatArray,
        totalFrames: Int,
        durSec: Double,
        type: String,
        vol: Float,
        rng: FastRng
    ) {
        val fadeIn = min(0.45, durSec * 0.15)
        val fadeOut = min(0.65, durSec * 0.2)
        var lpL = 0f
        var lpR = 0f
        val chord = when (type) {
            "dark_cinema" -> doubleArrayOf(65.41, 98.00, 130.81, 196.00) // C2, G2, C3, G3
            "forest_air" -> doubleArrayOf(174.61, 220.00, 261.63, 329.63) // Fmaj7 airy
            "minimal_pulse" -> doubleArrayOf(130.81, 196.00, 246.94, 293.66) // Cmaj9
            else -> doubleArrayOf(130.81, 164.81, 196.00, 246.94, 293.66) // warm_pad Cmaj9
        }

        for (i in 0 until totalFrames) {
            val t = i.toDouble() / SAMPLE_RATE
            val envIn = if (t < fadeIn) (t / fadeIn) else 1.0
            val envOut = if (t > durSec - fadeOut) max(0.0, (durSec - t) / fadeOut) else 1.0
            val env = (envIn * envOut).toFloat() * vol

            var l = 0f
            var r = 0f

            when (type) {
                "forest_air" -> {
                    val breeze = 0.55f + 0.45f * sin(TWO_PI * 0.18 * t).toFloat()
                    lpL += 0.022f * (rng.nextFloat() - lpL)
                    lpR += 0.024f * (rng.nextFloat() - lpR)
                    l += lpL * 0.35f * breeze
                    r += lpR * 0.35f * breeze
                    for (k in chord.indices) {
                        val f = chord[k]
                        val drift = 0.5f + 0.5f * sin(TWO_PI * (0.12 + k * 0.05) * t + k).toFloat()
                        l += sin(TWO_PI * f * t).toFloat() * 0.14f * drift
                        r += sin(TWO_PI * (f * 1.003) * t + 0.4).toFloat() * 0.14f * drift
                    }
                }
                "minimal_pulse" -> {
                    val bpm = 108.0
                    val beatPos = (t * bpm / 60.0) % 1.0
                    val pulseEnv = exp(-beatPos * 7.5).toFloat()
                    val sub = sin(TWO_PI * 65.41 * t).toFloat() * pulseEnv * 0.38f
                    val step = ((t * bpm / 60.0).toInt()) % chord.size
                    val pluck = sin(TWO_PI * chord[step] * 2.0 * t).toFloat() * exp(-beatPos * 10.0).toFloat() * 0.24f
                    val pad = (sin(TWO_PI * chord[0] * t) + sin(TWO_PI * chord[1] * t) * 0.7).toFloat() * 0.16f
                    l = sub + pad + pluck * 0.85f
                    r = sub + pad + pluck * 1.15f
                }
                "dark_cinema" -> {
                    val swell = 0.65f + 0.35f * sin(TWO_PI * 0.14 * t).toFloat()
                    for (k in chord.indices) {
                        val f = chord[k]
                        val w = 0.28f / (k + 1)
                        l += sin(TWO_PI * f * t).toFloat() * w * swell
                        r += sin(TWO_PI * (f * 1.004) * t + 0.7).toFloat() * w * swell
                    }
                    lpL += 0.012f * (rng.nextFloat() - lpL)
                    l += lpL * 0.14f
                    r += lpL * 0.14f
                }
                else -> {
                    // warm_pad
                    val swell = 0.7f + 0.3f * sin(TWO_PI * 0.22 * t).toFloat()
                    for (k in chord.indices) {
                        val f = chord[k]
                        val w = 0.18f / (1f + k * 0.25f)
                        l += sin(TWO_PI * f * t + k * 0.4).toFloat() * w * swell
                        r += sin(TWO_PI * (f * 1.0035) * t + k * 0.8).toFloat() * w * swell
                    }
                }
            }
            addSample(mix, totalFrames, i, l * env, r * env)
        }
    }

    private fun renderSfx(
        mix: FloatArray,
        totalFrames: Int,
        start: Int,
        sfx: String,
        gain: Float,
        pitch: Float,
        pan: Float,
        rng: FastRng
    ) {
        val gL = gain * (1f - max(0f, pan))
        val gR = gain * (1f + min(0f, pan))

        fun writeSweepNoise(dur: Double, minCut: Float, maxCut: Float, peakAt: Double, toneHz: Double = 0.0) {
            val n = (dur * SAMPLE_RATE).toInt()
            var lp = 0f
            var hp = 0f
            var prev = 0f
            var phase = 0.0
            for (i in 0 until n) {
                val u = i.toDouble() / n
                val env = if (u < peakAt) (u / peakAt).pow(1.4) else ((1.0 - u) / (1.0 - peakAt)).pow(2.0)
                val sweep = sin(u * PI).toFloat()
                val cut = (minCut + (maxCut - minCut) * sweep).coerceIn(0.01f, 0.85f)
                val noise = rng.nextFloat()
                lp += cut * (noise - lp)
                hp = 0.92f * (hp + lp - prev)
                prev = lp
                var sig = hp * 0.95f
                if (toneHz > 0.0) {
                    val f = toneHz * pitch * (0.65 + 0.9 * sweep)
                    phase += TWO_PI * f / SAMPLE_RATE
                    sig += sin(phase).toFloat() * 0.28f
                }
                val out = sig * env.toFloat()
                addSample(mix, totalFrames, start + i, out * gL, out * gR)
            }
        }

        fun writePitchTone(dur: Double, fStart: Double, fEnd: Double, decay: Double, harmonic: Float = 0.25f) {
            val n = (dur * SAMPLE_RATE).toInt()
            var phase = 0.0
            for (i in 0 until n) {
                val t = i.toDouble() / SAMPLE_RATE
                val u = i.toDouble() / n
                val attack = min(1.0, t / 0.004)
                val env = attack * exp(-u * decay)
                val f = (fStart + (fEnd - fStart) * u.pow(0.65)) * pitch
                phase += TWO_PI * f / SAMPLE_RATE
                val s = (sin(phase) + sin(phase * 2.0) * harmonic).toFloat() * env.toFloat() * 0.72f
                addSample(mix, totalFrames, start + i, s * gL, s * gR)
            }
        }

        when (sfx) {
            "whoosh" -> writeSweepNoise(0.46, 0.04f, 0.36f, 0.42, 160.0)
            "whip" -> writeSweepNoise(0.26, 0.08f, 0.62f, 0.32, 240.0)
            "swoosh_soft" -> writeSweepNoise(0.38, 0.03f, 0.22f, 0.45, 0.0)
            "pop" -> writePitchTone(0.11, 210.0, 720.0, 7.2, 0.22f)
            "bubble" -> writePitchTone(0.15, 290.0, 920.0, 6.0, 0.32f)
            "click" -> {
                writePitchTone(0.038, 1850.0, 720.0, 12.0, 0.35f)
                writeSweepNoise(0.032, 0.25f, 0.72f, 0.15, 0.0)
            }
            "tick" -> writePitchTone(0.055, 1320.0, 1180.0, 10.5, 0.15f)
            "snap" -> {
                writeSweepNoise(0.075, 0.35f, 0.78f, 0.18, 0.0)
                writePitchTone(0.06, 980.0, 320.0, 10.0, 0.2f)
            }
            "shutter" -> {
                writeSweepNoise(0.045, 0.25f, 0.72f, 0.2, 1100.0)
                val secondOffset = (0.058 * SAMPLE_RATE).toInt()
                val n = (0.04 * SAMPLE_RATE).toInt()
                for (i in 0 until n) {
                    val u = i.toDouble() / n
                    val env = exp(-u * 10.0).toFloat()
                    val s = (rng.nextFloat() * 0.45f + sin(TWO_PI * 1400.0 * pitch * i / SAMPLE_RATE).toFloat() * 0.35f) * env
                    addSample(mix, totalFrames, start + secondOffset + i, s * gL, s * gR)
                }
            }
            "thud" -> {
                writePitchTone(0.32, 128.0, 40.0, 6.8, 0.18f)
                writeSweepNoise(0.16, 0.03f, 0.16f, 0.12, 0.0)
            }
            "sub_drop" -> writePitchTone(0.88, 102.0, 32.0, 3.8, 0.12f)
            "riser" -> {
                val n = (1.05 * SAMPLE_RATE).toInt()
                var lp = 0f
                var phase = 0.0
                for (i in 0 until n) {
                    val u = i.toDouble() / n
                    val env = u.pow(2.1) * (if (u > 0.94) (1.0 - u) / 0.06 else 1.0)
                    lp += (0.03f + 0.45f * u.toFloat()) * (rng.nextFloat() - lp)
                    val f = (220.0 + 760.0 * u * u) * pitch
                    phase += TWO_PI * f / SAMPLE_RATE
                    val s = (lp * 0.55f + sin(phase).toFloat() * 0.38f) * env.toFloat()
                    addSample(mix, totalFrames, start + i, s * gL, s * gR)
                }
            }
            "chime", "ding" -> {
                val freqs = if (sfx == "ding") doubleArrayOf(880.0, 1760.0) else doubleArrayOf(523.25, 659.25, 783.99, 1046.50, 1174.66)
                val dur = if (sfx == "ding") 0.58 else 0.92
                val n = (dur * SAMPLE_RATE).toInt()
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    var l = 0f
                    var r = 0f
                    for (k in freqs.indices) {
                        val dt = t - k * 0.022
                        if (dt < 0) continue
                        val env = min(1.0, dt / 0.006) * exp(-dt * (3.8 + k * 0.55))
                        val f = freqs[k] * pitch
                        val amp = 0.30f / (1f + k * 0.25f)
                        l += sin(TWO_PI * f * dt).toFloat() * env.toFloat() * amp
                        r += sin(TWO_PI * (f * 1.0025) * dt + 0.3).toFloat() * env.toFloat() * amp
                    }
                    addSample(mix, totalFrames, start + i, l * gL, r * gR)
                }
            }
            "sparkle" -> {
                val notes = doubleArrayOf(1046.5, 1318.5, 1568.0, 2093.0, 2637.0)
                val n = (0.78 * SAMPLE_RATE).toInt()
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    var l = 0f
                    var r = 0f
                    for (k in notes.indices) {
                        val dt = t - k * 0.065
                        if (dt < 0) continue
                        val env = min(1.0, dt / 0.005) * exp(-dt * 7.2)
                        val f = notes[k] * pitch
                        val sig = sin(TWO_PI * f * dt).toFloat() * env.toFloat() * 0.22f
                        val side = if (k % 2 == 0) 0.75f else 1.25f
                        l += sig * side
                        r += sig * (2f - side)
                    }
                    addSample(mix, totalFrames, start + i, l * gL, r * gR)
                }
            }
            "bloom" -> {
                val chord = doubleArrayOf(261.63, 329.63, 392.00, 493.88, 587.33)
                val n = (1.25 * SAMPLE_RATE).toInt()
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val u = i.toDouble() / n
                    val env = sin(u * PI).pow(1.4).toFloat() * 0.24f
                    var l = 0f
                    var r = 0f
                    for (k in chord.indices) {
                        val f = chord[k] * pitch
                        l += sin(TWO_PI * f * t + k * 0.5).toFloat() * env
                        r += sin(TWO_PI * (f * 1.003) * t + k * 0.9).toFloat() * env
                    }
                    addSample(mix, totalFrames, start + i, l * gL, r * gR)
                }
            }
            else -> writePitchTone(0.11, 210.0, 720.0, 7.2, 0.22f)
        }
    }

    private fun encodePcmToAac(pcm: ByteArray): EncodedAudioTrack {
        val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, SAMPLE_RATE, CHANNELS).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16_384)
        }
        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        codec.start()

        val packets = mutableListOf<EncodedAudioPacket>()
        var outputFormat: MediaFormat? = null
        val info = MediaCodec.BufferInfo()
        var offset = 0
        var inputDone = false
        var outputDone = false
        var lastPtsUs = -1L

        try {
            while (!outputDone) {
                if (!inputDone) {
                    val inIdx = codec.dequeueInputBuffer(10_000L)
                    if (inIdx >= 0) {
                        val inBuf = codec.getInputBuffer(inIdx)!!
                        inBuf.clear()
                        if (offset >= pcm.size) {
                            val eosPts = (offset.toLong() / (CHANNELS * 2)) * 1_000_000L / SAMPLE_RATE
                            codec.queueInputBuffer(inIdx, 0, 0, eosPts, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                        } else {
                            val chunk = min(inBuf.remaining(), pcm.size - offset)
                            inBuf.put(pcm, offset, chunk)
                            val ptsUs = (offset.toLong() / (CHANNELS * 2)) * 1_000_000L / SAMPLE_RATE
                            offset += chunk
                            codec.queueInputBuffer(inIdx, 0, chunk, ptsUs, 0)
                        }
                    }
                }

                val outIdx = codec.dequeueOutputBuffer(info, 10_000L)
                when {
                    outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        outputFormat = codec.outputFormat
                    }
                    outIdx >= 0 -> {
                        val outBuf = codec.getOutputBuffer(outIdx)
                        val isConfig = (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
                        if (!isConfig && info.size > 0 && outBuf != null) {
                            outBuf.position(info.offset)
                            outBuf.limit(info.offset + info.size)
                            val bytes = ByteArray(info.size)
                            outBuf.get(bytes)
                            val safePts = max(lastPtsUs + 1L, info.presentationTimeUs)
                            lastPtsUs = safePts
                            packets += EncodedAudioPacket(bytes, safePts, 0)
                        }
                        if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                            outputDone = true
                        }
                        codec.releaseOutputBuffer(outIdx, false)
                    }
                }
            }
        } finally {
            runCatching { codec.stop() }
            runCatching { codec.release() }
        }

        val finalFormat = outputFormat ?: throw IllegalStateException("Encoder AAC tidak menghasilkan format audio.")
        return EncodedAudioTrack(finalFormat, packets)
    }
}
