package app.codetovideo.studio.render

import android.content.Context
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import app.codetovideo.studio.core.StudioAudioConfig
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.abs
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
 * Hybrid Studio Audio Engine v0.6:
 * 1) Real Studio WAV Samples from assets/sfx/ (pitch-shifted & stereo-panned)
 * 2) External Voiceover / BGM Decoder (MP3/WAV/M4A) with Smooth Auto-Ducking
 * 3) Master Stereo Schroeder Reverb + Warm Tape Limiter -> 160 kbps Stereo AAC
 */
object ProceduralAudioEngine {
    const val SAMPLE_RATE = 44_100
    const val CHANNELS = 2
    private const val BIT_RATE = 160_000
    private const val TWO_PI = 2.0 * PI

    private data class WavSample(val sampleRate: Int, val frames: Int, val stereo: FloatArray)

    private class FastRng(seed: Int) {
        private var state = if (seed == 0) 0x9E3779B9.toInt() else seed
        private var b0 = 0f; private var b1 = 0f; private var b2 = 0f
        private var b3 = 0f; private var b4 = 0f; private var b5 = 0f; private var b6 = 0f
        fun nextWhite(): Float {
            var x = state
            x = x xor (x shl 13); x = x xor (x ushr 17); x = x xor (x shl 5)
            state = x
            return ((x and 0x7FFFFFFF).toFloat() / 0x3FFFFFFF.toFloat()) - 1f
        }
        fun nextPink(): Float {
            val w = nextWhite()
            b0 = 0.99886f * b0 + w * 0.0555179f
            b1 = 0.99332f * b1 + w * 0.0750759f
            b2 = 0.96900f * b2 + w * 0.1538520f
            b3 = 0.86650f * b3 + w * 0.3104856f
            b4 = 0.55000f * b4 + w * 0.5329522f
            b5 = -0.7616f * b5 - w * 0.0168980f
            val pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362f) * 0.18f
            b6 = w * 0.115926f
            return pink.coerceIn(-1f, 1f)
        }
    }

    private class SvFilter {
        var low = 0f; var band = 0f; var high = 0f
        fun step(input: Float, freqHz: Double, damp: Float) {
            val f = (2.0 * sin(PI * freqHz.coerceIn(30.0, 9500.0) / SAMPLE_RATE)).toFloat().coerceIn(0.002f, 0.82f)
            val q = damp.coerceIn(0.28f, 1.8f)
            low += f * band; high = input - low - q * band; band += f * high
            if (!low.isFinite()) low = 0f; if (!band.isFinite()) band = 0f; if (!high.isFinite()) high = 0f
        }
    }

    private class DampedComb(size: Int, private val feedback: Float, private val damp: Float) {
        private val buf = FloatArray(size); private var idx = 0; private var store = 0f
        fun process(input: Float): Float {
            val out = buf[idx]
            store = out * (1f - damp) + store * damp
            buf[idx] = input + store * feedback
            if (++idx >= buf.size) idx = 0
            return out
        }
    }

    private class Allpass(size: Int, private val feedback: Float = 0.5f) {
        private val buf = FloatArray(size); private var idx = 0
        fun process(input: Float): Float {
            val bufOut = buf[idx]; val out = -input + bufOut
            buf[idx] = input + bufOut * feedback
            if (++idx >= buf.size) idx = 0
            return out
        }
    }

    /** Synthesize a single SFX clip to 16-bit Stereo PCM for instant Audition playback */
    fun synthesizeSingleSfxPcm(context: Context, sfx: String, pitch: Float = 1.0f): ByteArray {
        val durFrames = (2.0 * SAMPLE_RATE).toInt()
        val dry = FloatArray(durFrames * CHANNELS)
        val rev = FloatArray(durFrames * CHANNELS)
        val cache = HashMap<String, WavSample?>()
        val wav = loadWavAsset(context, sfx, cache)
        if (wav != null) {
            mixWavSample(dry, rev, durFrames, 0, wav, 0.95f, pitch, 0f, 0.14f)
        } else {
            renderFallbackSfx(dry, rev, durFrames, 0, sfx, 0.9f, pitch, 0f, FastRng(sfx.hashCode()))
        }
        return masterToPcm16(dry, rev, null, durFrames, 1f, false)
    }

    fun synthesizeAndEncode(
        context: Context,
        durationSeconds: Int,
        seed: Int,
        config: StudioAudioConfig,
        sfxMasterGain: Float = 1.0f,
        ambienceMasterGain: Float = 0.85f,
        voiceoverUri: String = "",
        voiceoverGain: Float = 1.0f,
        autoDucking: Boolean = true
    ): EncodedAudioTrack {
        val dur = durationSeconds.coerceIn(1, 60)
        val totalFrames = dur * SAMPLE_RATE
        val ambDry = FloatArray(totalFrames * CHANNELS)
        val sfxDry = FloatArray(totalFrames * CHANNELS)
        val revSend = FloatArray(totalFrames * CHANNELS)
        val rng = FastRng(seed * 31 + 17)
        val wavCache = HashMap<String, WavSample?>()

        // 1. Decode external Voiceover / BGM if selected
        val voiceoverMix = if (voiceoverUri.isNotBlank() && voiceoverGain > 0.01f) {
            runCatching { decodeAudioUri(context, voiceoverUri, totalFrames) }.getOrNull()
        } else null

        // 2. Render Ambience Bed
        val effAmbVol = (config.ambienceVolume * ambienceMasterGain).coerceIn(0f, 1.2f)
        if (config.ambience != "none" && effAmbVol > 0.005f) {
            renderAmbience(ambDry, revSend, totalFrames, dur.toDouble(), config.ambience, effAmbVol, rng)
        }

        // 3. Render Every SFX Cue (Prefer REAL Studio WAV Asset, fallback to DSP)
        if (sfxMasterGain > 0.005f) {
            config.cues.forEachIndexed { idx, cue ->
                val timeSec = if (cue.atProgress != null) cue.atProgress * dur.toDouble() else cue.atSeconds
                val startFrame = (timeSec * SAMPLE_RATE).toInt()
                if (startFrame in 0 until totalFrames) {
                    val pan = ((idx % 3) - 1) * 0.14f
                    val gain = (cue.gain * sfxMasterGain).coerceIn(0f, 1.6f)
                    val wav = loadWavAsset(context, cue.sfx, wavCache)
                    if (wav != null) {
                        mixWavSample(sfxDry, revSend, totalFrames, startFrame, wav, gain, cue.pitch, pan, 0.14f)
                    } else {
                        val cueRng = FastRng(seed * 131 + idx * 977 + cue.sfx.hashCode())
                        renderFallbackSfx(sfxDry, revSend, totalFrames, startFrame, cue.sfx, gain, cue.pitch, pan, cueRng)
                    }
                }
            }
        }

        // 4. Combine Ambience (with smooth Auto-Ducking under Voiceover) + SFX + Reverb + Voiceover
        var duckEnv = 0f
        for (i in 0 until totalFrames) {
            val base = i * CHANNELS
            val duckMult = if (voiceoverMix != null && autoDucking) {
                val voLvl = (abs(voiceoverMix[base]) + abs(voiceoverMix[base + 1])) * 0.5f * voiceoverGain
                val coeff = if (voLvl > duckEnv) 0.006f else 0.00018f
                duckEnv += coeff * (voLvl - duckEnv)
                1f - (duckEnv * 4.2f).coerceIn(0f, 0.72f)
            } else 1f
            ambDry[base] = ambDry[base] * duckMult + sfxDry[base]
            ambDry[base + 1] = ambDry[base + 1] * duckMult + sfxDry[base + 1]
        }

        val pcm = masterToPcm16(ambDry, revSend, voiceoverMix, totalFrames, voiceoverGain, true)
        return encodePcmToAac(pcm)
    }

    private fun loadWavAsset(context: Context, rawName: String, cache: HashMap<String, WavSample?>): WavSample? {
        val key = rawName.trim().lowercase().replace(Regex("[^a-z0-9_]"), "")
        if (cache.containsKey(key)) return cache[key]
        val sample = runCatching {
            val bytes = context.assets.open("sfx/$key.wav").use { it.readBytes() }
            parseWav(bytes)
        }.getOrNull()
        cache[key] = sample
        return sample
    }

    private fun parseWav(bytes: ByteArray): WavSample? {
        if (bytes.size < 44) return null
        fun str4(off: Int) = String(bytes, off, 4, Charsets.US_ASCII)
        fun u16(off: Int) = (bytes[off].toInt() and 0xFF) or ((bytes[off + 1].toInt() and 0xFF) shl 8)
        fun u32(off: Int) = (bytes[off].toInt() and 0xFF) or
            ((bytes[off + 1].toInt() and 0xFF) shl 8) or
            ((bytes[off + 2].toInt() and 0xFF) shl 16) or
            ((bytes[off + 3].toInt() and 0xFF) shl 24)
        if (str4(0) != "RIFF" || str4(8) != "WAVE") return null

        var channels = 2
        var sampleRate = SAMPLE_RATE
        var bits = 16
        var dataOffset = -1
        var dataSize = 0
        var off = 12
        while (off + 8 <= bytes.size) {
            val id = str4(off)
            val sz = u32(off + 4).coerceAtLeast(0)
            val body = off + 8
            if (body + sz > bytes.size && id != "data") break
            if (id == "fmt " && sz >= 16) {
                channels = u16(body + 2).coerceIn(1, 2)
                sampleRate = u32(body + 4).coerceIn(8000, 96000)
                bits = u16(body + 14)
            } else if (id == "data") {
                dataOffset = body
                dataSize = min(sz, bytes.size - body)
                break
            }
            off = body + ((sz + 1) and 1.inv())
        }
        if (dataOffset < 0 || dataSize < 4 || bits != 16) return null
        val bytesPerFrame = channels * 2
        val frames = dataSize / bytesPerFrame
        val stereo = FloatArray(frames * 2)
        var p = dataOffset
        for (i in 0 until frames) {
            val s0 = ((bytes[p].toInt() and 0xFF) or (bytes[p + 1].toInt() shl 8)).toShort() / 32768f
            p += 2
            val s1 = if (channels == 2) {
                val v = ((bytes[p].toInt() and 0xFF) or (bytes[p + 1].toInt() shl 8)).toShort() / 32768f
                p += 2; v
            } else s0
            stereo[i * 2] = s0
            stereo[i * 2 + 1] = s1
        }
        return WavSample(sampleRate, frames, stereo)
    }

    private fun mixWavSample(
        dry: FloatArray,
        rev: FloatArray,
        totalFrames: Int,
        startFrame: Int,
        wav: WavSample,
        gain: Float,
        pitch: Float,
        pan: Float,
        revSendAmt: Float
    ) {
        val gL = gain * (1f - max(0f, pan))
        val gR = gain * (1f + min(0f, pan))
        val step = (wav.sampleRate.toDouble() / SAMPLE_RATE.toDouble()) * pitch.toDouble().coerceIn(0.4, 2.5)
        var pos = 0.0
        var outIdx = startFrame
        val maxPos = (wav.frames - 1).toDouble()
        while (pos < maxPos && outIdx < totalFrames) {
            val i0 = pos.toInt()
            val frac = (pos - i0).toFloat()
            val b0 = i0 * 2
            val b1 = (i0 + 1) * 2
            val l = (wav.stereo[b0] + (wav.stereo[b1] - wav.stereo[b0]) * frac) * gL
            val r = (wav.stereo[b0 + 1] + (wav.stereo[b1 + 1] - wav.stereo[b0 + 1]) * frac) * gR
            addStereo(dry, rev, totalFrames, outIdx, l, r, revSendAmt)
            pos += step
            outIdx++
        }
    }

    /** Streaming decoder for external MP3/WAV/M4A/OGG Voiceover or BGM -> 44.1kHz Stereo FloatArray */
    private fun decodeAudioUri(context: Context, uriString: String, totalFrames: Int): FloatArray? {
        val pfd = context.contentResolver.openFileDescriptor(Uri.parse(uriString), "r") ?: return null
        val outMix = FloatArray(totalFrames * CHANNELS)
        pfd.use { fd ->
            val extractor = MediaExtractor()
            var codec: MediaCodec? = null
            try {
                extractor.setDataSource(fd.fileDescriptor)
                var audioTrack = -1
                var format: MediaFormat? = null
                for (i in 0 until extractor.trackCount) {
                    val f = extractor.getTrackFormat(i)
                    val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
                    if (mime.startsWith("audio/")) {
                        audioTrack = i; format = f; break
                    }
                }
                if (audioTrack < 0 || format == null) return null
                extractor.selectTrack(audioTrack)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: return null
                var srcRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else SAMPLE_RATE
                var srcCh = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 2

                val dec = MediaCodec.createDecoderByType(mime)
                codec = dec
                dec.configure(format, null, null, 0)
                dec.start()

                val info = MediaCodec.BufferInfo()
                var inputDone = false
                var outputDone = false
                var srcIdx = 0L
                var dstIdx = 0
                var readPos = 0.0
                var prevL = 0f
                var prevR = 0f

                while (!outputDone && dstIdx < totalFrames) {
                    if (!inputDone) {
                        val inIdx = dec.dequeueInputBuffer(10_000L)
                        if (inIdx >= 0) {
                            val inBuf = dec.getInputBuffer(inIdx)!!
                            val sampleSize = extractor.readSampleData(inBuf, 0)
                            if (sampleSize < 0) {
                                dec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                inputDone = true
                            } else {
                                dec.queueInputBuffer(inIdx, 0, sampleSize, extractor.sampleTime, 0)
                                extractor.advance()
                            }
                        }
                    }
                    val outIdx = dec.dequeueOutputBuffer(info, 10_000L)
                    when {
                        outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                            val of = dec.outputFormat
                            if (of.containsKey(MediaFormat.KEY_SAMPLE_RATE)) srcRate = of.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                            if (of.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) srcCh = of.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        }
                        outIdx >= 0 -> {
                            val outBuf = dec.getOutputBuffer(outIdx)
                            if (outBuf != null && info.size > 0) {
                                outBuf.position(info.offset)
                                outBuf.limit(info.offset + info.size)
                                val sb = outBuf.order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
                                val step = srcRate.toDouble() / SAMPLE_RATE.toDouble()
                                val chCount = srcCh.coerceAtLeast(1)
                                val framesInChunk = sb.remaining() / chCount
                                for (k in 0 until framesInChunk) {
                                    val cL = sb.get() / 32768f
                                    val cR = if (chCount >= 2) sb.get() / 32768f else cL
                                    for (skip in 2 until chCount) sb.get()
                                    if (srcIdx == 0L) {
                                        prevL = cL; prevR = cR
                                    } else {
                                        while (dstIdx < totalFrames && readPos <= srcIdx.toDouble()) {
                                            val frac = (readPos - (srcIdx - 1L)).toFloat().coerceIn(0f, 1f)
                                            outMix[dstIdx * 2] = prevL + (cL - prevL) * frac
                                            outMix[dstIdx * 2 + 1] = prevR + (cR - prevR) * frac
                                            dstIdx++
                                            readPos += step
                                        }
                                        prevL = cL; prevR = cR
                                    }
                                    srcIdx++
                                    if (dstIdx >= totalFrames) break
                                }
                            }
                            if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outputDone = true
                            dec.releaseOutputBuffer(outIdx, false)
                        }
                    }
                }
                return if (dstIdx > 0) outMix else null
            } finally {
                runCatching { codec?.stop() }
                runCatching { codec?.release() }
                runCatching { extractor.release() }
            }
        }
    }

    private fun masterToPcm16(
        dry: FloatArray,
        revSend: FloatArray,
        voiceover: FloatArray?,
        totalFrames: Int,
        voGain: Float,
        edgeFade: Boolean
    ): ByteArray {
        val combsL = arrayOf(DampedComb(1557, 0.76f, 0.36f), DampedComb(1617, 0.75f, 0.38f), DampedComb(1491, 0.74f, 0.36f), DampedComb(1422, 0.73f, 0.40f))
        val combsR = arrayOf(DampedComb(1580, 0.76f, 0.36f), DampedComb(1640, 0.75f, 0.38f), DampedComb(1514, 0.74f, 0.36f), DampedComb(1445, 0.73f, 0.40f))
        val apL1 = Allpass(225); val apL2 = Allpass(556)
        val apR1 = Allpass(248); val apR2 = Allpass(579)

        val pcm = ByteArray(totalFrames * CHANNELS * 2)
        val fadeInSamp = if (edgeFade) (0.018 * SAMPLE_RATE).toInt() else 1
        val fadeOutSamp = if (edgeFade) (0.040 * SAMPLE_RATE).toInt() else 1
        var dcL = 0f; var dcR = 0f; var prevInL = 0f; var prevInR = 0f
        var byteIdx = 0

        for (i in 0 until totalFrames) {
            val idx2 = i * CHANNELS
            val inL = revSend[idx2]; val inR = revSend[idx2 + 1]
            var wetL = 0f; var wetR = 0f
            for (c in 0 until 4) {
                wetL += combsL[c].process(inL)
                wetR += combsR[c].process(inR)
            }
            wetL = apL2.process(apL1.process(wetL * 0.25f))
            wetR = apR2.process(apR1.process(wetR * 0.25f))

            val env = when {
                edgeFade && i < fadeInSamp -> i.toFloat() / fadeInSamp
                edgeFade && i > totalFrames - fadeOutSamp -> (totalFrames - i).toFloat() / fadeOutSamp
                else -> 1f
            }
            val voL = if (voiceover != null) voiceover[idx2] * voGain else 0f
            val voR = if (voiceover != null) voiceover[idx2 + 1] * voGain else 0f

            val mixL = (dry[idx2] + wetL * 0.28f + voL) * env
            val mixR = (dry[idx2 + 1] + wetR * 0.28f + voR) * env
            dcL = mixL - prevInL + 0.996f * dcL; prevInL = mixL
            dcR = mixR - prevInR + 0.996f * dcR; prevInR = mixR

            val outL = tanh((dcL * 0.94).coerceIn(-4.0, 4.0)).toFloat().coerceIn(-0.98f, 0.98f)
            val outR = tanh((dcR * 0.94).coerceIn(-4.0, 4.0)).toFloat().coerceIn(-0.98f, 0.98f)
            val sL = (outL * 32767f).toInt().toShort()
            val sR = (outR * 32767f).toInt().toShort()
            pcm[byteIdx++] = (sL.toInt() and 0xFF).toByte()
            pcm[byteIdx++] = ((sL.toInt() shr 8) and 0xFF).toByte()
            pcm[byteIdx++] = (sR.toInt() and 0xFF).toByte()
            pcm[byteIdx++] = ((sR.toInt() shr 8) and 0xFF).toByte()
        }
        return pcm
    }

    private fun addStereo(dry: FloatArray, rev: FloatArray, totalFrames: Int, frameIdx: Int, l: Float, r: Float, send: Float) {
        if (frameIdx < 0 || frameIdx >= totalFrames) return
        val base = frameIdx * CHANNELS
        dry[base] += l; dry[base + 1] += r
        if (send > 0.001f) { rev[base] += l * send; rev[base + 1] += r * send }
    }

    private fun warmWave(phase: Double): Float = (sin(phase) + sin(phase * 2.0) * 0.14 + sin(phase * 3.0) * 0.03).toFloat()

    private fun renderAmbience(dry: FloatArray, rev: FloatArray, totalFrames: Int, durSec: Double, type: String, vol: Float, rng: FastRng) {
        val fadeIn = min(0.60, durSec * 0.18)
        val fadeOut = min(0.85, durSec * 0.24)
        val svfL = SvFilter(); val svfR = SvFilter(); val airL = SvFilter(); val airR = SvFilter()
        val chord = when (type) {
            "dark_cinema" -> doubleArrayOf(55.00, 82.41, 110.00, 164.81)
            "forest_air", "botanical_air" -> doubleArrayOf(130.81, 196.00, 246.94, 293.66, 329.63)
            "keynote_pulse", "apple_keynote_minimal" -> doubleArrayOf(146.83, 220.00, 277.18, 329.63)
            "ios_glass_chimes" -> doubleArrayOf(196.00, 246.94, 293.66, 369.99, 440.00)
            else -> doubleArrayOf(130.81, 164.81, 196.00, 246.94)
        }
        val phL = DoubleArray(chord.size); val phR = DoubleArray(chord.size); var subPh = 0.0
        for (i in 0 until totalFrames) {
            val t = i.toDouble() / SAMPLE_RATE
            val eIn = if (t < fadeIn) (t / fadeIn).pow(1.4) else 1.0
            val eOut = if (t > durSec - fadeOut) max(0.0, (durSec - t) / fadeOut).pow(1.4) else 1.0
            val env = (eIn * eOut).toFloat() * vol * 0.80f
            var l = 0f; var r = 0f
            val swell = 0.65f + 0.35f * sin(TWO_PI * 0.16 * t).toFloat()
            for (k in chord.indices) {
                phL[k] += TWO_PI * chord[k] / SAMPLE_RATE
                phR[k] += TWO_PI * chord[k] * (1.0026 + k * 0.0004) / SAMPLE_RATE
                val w = (0.19f / (1f + k * 0.28f)) * swell
                l += warmWave(phL[k]) * w; r += warmWave(phR[k]) * w
            }
            val cut = if (type == "dark_cinema") 260.0 + 120.0 * sin(TWO_PI * 0.11 * t) else 640.0 + 240.0 * sin(TWO_PI * 0.15 * t)
            svfL.step(l, cut, 0.95f); svfR.step(r, cut, 0.95f)
            l = svfL.low; r = svfR.low
            when (type) {
                "botanical_air", "forest_air" -> {
                    val br = 0.45f + 0.55f * sin(TWO_PI * 0.14 * t).toFloat()
                    airL.step(rng.nextPink(), 460.0 + 240.0 * br, 0.85f)
                    airR.step(rng.nextPink(), 490.0 + 240.0 * br, 0.85f)
                    l += airL.band * 0.16f * br; r += airR.band * 0.16f * br
                }
                "keynote_pulse", "apple_keynote_minimal", "minimal_pulse" -> {
                    val bpm = if (type == "minimal_pulse") 108.0 else 112.0
                    val pos = (t * bpm / 60.0) % 1.0
                    val kEnv = exp(-pos * 12.0).toFloat()
                    subPh += TWO_PI * (52.0 + 26.0 * exp(-pos * 26.0)) / SAMPLE_RATE
                    val sub = sin(subPh).toFloat() * kEnv * 0.32f
                    l = l * 0.72f + sub; r = r * 0.72f + sub
                }
                "dark_cinema" -> {
                    subPh += TWO_PI * 41.2 / SAMPLE_RATE
                    val sub = sin(subPh).toFloat() * 0.22f * swell
                    l += sub; r += sub
                }
            }
            addStereo(dry, rev, totalFrames, i, l * env, r * env, 0.55f)
        }
    }

    /** Clean fallback DSP only if a specific WAV asset is missing */
    private fun renderFallbackSfx(dry: FloatArray, rev: FloatArray, totalFrames: Int, start: Int, sfx: String, gain: Float, pitch: Float, pan: Float, rng: FastRng) {
        val gL = gain * (1f - max(0f, pan)); val gR = gain * (1f + min(0f, pan))
        val dur = if (sfx.contains("whoosh") || sfx.contains("whip") || sfx.contains("slide")) 0.40 else 0.28
        val n = (dur * SAMPLE_RATE).toInt()
        val svf = SvFilter()
        for (i in 0 until n) {
            val u = i.toDouble() / n
            val env = sin(u * PI).pow(1.6).toFloat()
            svf.step(rng.nextPink(), (240.0 + 1400.0 * sin(u * PI)) * pitch, 0.75f)
            val s = svf.band * env * 0.85f
            addStereo(dry, rev, totalFrames, start + i, s * gL, s * gR, 0.35f)
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
        var offset = 0; var inputDone = false; var outputDone = false; var lastPtsUs = -1L

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
                    outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> outputFormat = codec.outputFormat
                    outIdx >= 0 -> {
                        val outBuf = codec.getOutputBuffer(outIdx)
                        val isConfig = (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
                        if (!isConfig && info.size > 0 && outBuf != null) {
                            outBuf.position(info.offset); outBuf.limit(info.offset + info.size)
                            val bytes = ByteArray(info.size); outBuf.get(bytes)
                            val safePts = max(lastPtsUs + 1L, info.presentationTimeUs)
                            lastPtsUs = safePts
                            packets += EncodedAudioPacket(bytes, safePts, 0)
                        }
                        if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outputDone = true
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
