package app.codetovideo.studio.render

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import app.codetovideo.studio.core.StudioAudioConfig
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
 * Cinema-Grade Offline 44.1 kHz Stereo DSP Audio Engine v0.5.
 * Features: Paul Kellet Pink Noise, Resonant State-Variable Filters (SVF),
 * Acoustic Felt-Pluck & Bell Synthesis, Schroeder Stereo Reverb, & Tape Master Limiter.
 */
object ProceduralAudioEngine {
    private const val SAMPLE_RATE = 44_100
    private const val CHANNELS = 2
    private const val BIT_RATE = 160_000
    private const val TWO_PI = 2.0 * PI

    private class FastRng(seed: Int) {
        private var state = if (seed == 0) 0x9E3779B9.toInt() else seed
        private var b0 = 0f; private var b1 = 0f; private var b2 = 0f
        private var b3 = 0f; private var b4 = 0f; private var b5 = 0f; private var b6 = 0f

        fun nextWhite(): Float {
            var x = state
            x = x xor (x shl 13)
            x = x xor (x ushr 17)
            x = x xor (x shl 5)
            state = x
            return ((x and 0x7FFFFFFF).toFloat() / 0x3FFFFFFF.toFloat()) - 1f
        }

        // Smooth natural pink noise (Paul Kellet's filter) — zero harsh static hiss
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

    // Resonant State-Variable Filter (unconditionally stable for f <= 0.85, q >= 0.25)
    private class SvFilter {
        var low = 0f; var band = 0f; var high = 0f
        fun step(input: Float, freqHz: Double, damp: Float) {
            val f = (2.0 * sin(PI * freqHz.coerceIn(30.0, 9500.0) / SAMPLE_RATE)).toFloat().coerceIn(0.002f, 0.82f)
            val q = damp.coerceIn(0.28f, 1.8f)
            low += f * band
            high = input - low - q * band
            band += f * high
            if (!low.isFinite()) low = 0f
            if (!band.isFinite()) band = 0f
            if (!high.isFinite()) high = 0f
        }
    }

    private class DampedComb(size: Int, private val feedback: Float, private val damp: Float) {
        private val buf = FloatArray(size)
        private var idx = 0
        private var store = 0f
        fun process(input: Float): Float {
            val out = buf[idx]
            store = out * (1f - damp) + store * damp
            buf[idx] = input + store * feedback
            if (++idx >= buf.size) idx = 0
            return out
        }
    }

    private class Allpass(size: Int, private val feedback: Float = 0.5f) {
        private val buf = FloatArray(size)
        private var idx = 0
        fun process(input: Float): Float {
            val bufOut = buf[idx]
            val out = -input + bufOut
            buf[idx] = input + bufOut * feedback
            if (++idx >= buf.size) idx = 0
            return out
        }
    }

    fun synthesizeAndEncode(
        durationSeconds: Int,
        seed: Int,
        config: StudioAudioConfig
    ): EncodedAudioTrack {
        val dur = durationSeconds.coerceIn(1, 60)
        val totalFrames = dur * SAMPLE_RATE
        val dry = FloatArray(totalFrames * CHANNELS)
        val revSend = FloatArray(totalFrames * CHANNELS)
        val rng = FastRng(seed * 31 + 17)

        if (config.ambience != "none" && config.ambienceVolume > 0.005f) {
            renderAmbience(dry, revSend, totalFrames, dur.toDouble(), config.ambience, config.ambienceVolume, rng)
        }

        config.cues.forEachIndexed { idx, cue ->
            val timeSec = if (cue.atProgress != null) cue.atProgress * dur.toDouble() else cue.atSeconds
            val startFrame = (timeSec * SAMPLE_RATE).toInt()
            if (startFrame in 0 until totalFrames) {
                val cueRng = FastRng(seed * 131 + idx * 977 + cue.sfx.hashCode())
                val pan = ((idx % 3) - 1) * 0.16f
                renderSfx(dry, revSend, totalFrames, startFrame, cue.sfx, cue.gain, cue.pitch, pan, cueRng)
            }
        }

        // Master Stereo Schroeder Algorithmic Reverb + Warm Tape Saturation + Limiter
        val combsL = arrayOf(DampedComb(1557, 0.78f, 0.34f), DampedComb(1617, 0.77f, 0.36f), DampedComb(1491, 0.76f, 0.35f), DampedComb(1422, 0.75f, 0.38f))
        val combsR = arrayOf(DampedComb(1580, 0.78f, 0.34f), DampedComb(1640, 0.77f, 0.36f), DampedComb(1514, 0.76f, 0.35f), DampedComb(1445, 0.75f, 0.38f))
        val apL1 = Allpass(225); val apL2 = Allpass(556)
        val apR1 = Allpass(248); val apR2 = Allpass(579)

        val pcm = ByteArray(totalFrames * CHANNELS * 2)
        val fadeInSamp = (0.02 * SAMPLE_RATE).toInt()
        val fadeOutSamp = (0.045 * SAMPLE_RATE).toInt()
        var dcL = 0f; var dcR = 0f
        var prevInL = 0f; var prevInR = 0f
        var byteIdx = 0

        for (i in 0 until totalFrames) {
            val idx2 = i * CHANNELS
            val inL = revSend[idx2]
            val inR = revSend[idx2 + 1]

            var wetL = 0f; var wetR = 0f
            for (c in 0 until 4) {
                wetL += combsL[c].process(inL)
                wetR += combsR[c].process(inR)
            }
            wetL = apL2.process(apL1.process(wetL * 0.25f))
            wetR = apR2.process(apR1.process(wetR * 0.25f))

            val env = when {
                i < fadeInSamp -> i.toFloat() / fadeInSamp
                i > totalFrames - fadeOutSamp -> (totalFrames - i).toFloat() / fadeOutSamp
                else -> 1f
            }

            // DC blocker + gentle warm saturation
            val mixL = (dry[idx2] + wetL * 0.34f) * env
            val mixR = (dry[idx2 + 1] + wetR * 0.34f) * env
            dcL = mixL - prevInL + 0.996f * dcL; prevInL = mixL
            dcR = mixR - prevInR + 0.996f * dcR; prevInR = mixR

            val outL = tanh((dcL * 0.92).coerceIn(-4.0, 4.0)).toFloat().coerceIn(-0.98f, 0.98f)
            val outR = tanh((dcR * 0.92).coerceIn(-4.0, 4.0)).toFloat().coerceIn(-0.98f, 0.98f)

            val sL = (outL * 32767f).toInt().toShort()
            val sR = (outR * 32767f).toInt().toShort()
            pcm[byteIdx++] = (sL.toInt() and 0xFF).toByte()
            pcm[byteIdx++] = ((sL.toInt() shr 8) and 0xFF).toByte()
            pcm[byteIdx++] = (sR.toInt() and 0xFF).toByte()
            pcm[byteIdx++] = ((sR.toInt() shr 8) and 0xFF).toByte()
        }

        return encodePcmToAac(pcm)
    }

    private fun addStereo(dry: FloatArray, rev: FloatArray, totalFrames: Int, frameIdx: Int, l: Float, r: Float, send: Float) {
        if (frameIdx < 0 || frameIdx >= totalFrames) return
        val base = frameIdx * CHANNELS
        dry[base] += l
        dry[base + 1] += r
        if (send > 0.001f) {
            rev[base] += l * send
            rev[base + 1] += r * send
        }
    }

    // Soft triangle-sine hybrid wave for warm analog pad (never harsh organ buzz)
    private fun warmWave(phase: Double): Float {
        val s1 = sin(phase)
        val s2 = sin(phase * 2.0) * 0.16
        val s3 = sin(phase * 3.0) * 0.04
        return (s1 + s2 + s3).toFloat()
    }

    private fun renderAmbience(
        dry: FloatArray,
        rev: FloatArray,
        totalFrames: Int,
        durSec: Double,
        type: String,
        vol: Float,
        rng: FastRng
    ) {
        val fadeIn = min(0.60, durSec * 0.18)
        val fadeOut = min(0.85, durSec * 0.24)
        val svfL = SvFilter(); val svfR = SvFilter()
        val airSvfL = SvFilter(); val airSvfR = SvFilter()

        val chord = when (type) {
            "dark_cinema" -> doubleArrayOf(55.00, 82.41, 110.00, 164.81) // A1 minor fifth drone
            "forest_air", "botanical_air" -> doubleArrayOf(130.81, 196.00, 246.94, 293.66, 329.63) // Cmaj9 airy
            "keynote_pulse", "apple_keynote_minimal" -> doubleArrayOf(146.83, 220.00, 277.18, 329.63) // Dmaj9 modern
            "ios_glass_chimes" -> doubleArrayOf(196.00, 246.94, 293.66, 369.99, 440.00) // Gmaj9 crystalline
            else -> doubleArrayOf(130.81, 164.81, 196.00, 246.94) // warm_pad Cmaj7
        }

        val phasesL = DoubleArray(chord.size)
        val phasesR = DoubleArray(chord.size)
        var subPhase = 0.0

        for (i in 0 until totalFrames) {
            val t = i.toDouble() / SAMPLE_RATE
            val eIn = if (t < fadeIn) (t / fadeIn).pow(1.4) else 1.0
            val eOut = if (t > durSec - fadeOut) max(0.0, (durSec - t) / fadeOut).pow(1.4) else 1.0
            val env = (eIn * eOut).toFloat() * vol * 0.85f

            var l = 0f; var r = 0f
            var revAmt = 0.55f

            // Filtered warm unison pad backbone
            val swell = 0.65f + 0.35f * sin(TWO_PI * 0.16 * t).toFloat()
            for (k in chord.indices) {
                val detune = 1.0028 + k * 0.0004
                phasesL[k] += TWO_PI * chord[k] / SAMPLE_RATE
                phasesR[k] += TWO_PI * chord[k] * detune / SAMPLE_RATE
                val weight = (0.20f / (1f + k * 0.28f)) * swell
                l += warmWave(phasesL[k]) * weight
                r += warmWave(phasesR[k]) * weight
            }

            // Smooth lowpass breathing on pad so it sits effortlessly behind SFX
            val cutHz = when (type) {
                "dark_cinema" -> 280.0 + 140.0 * sin(TWO_PI * 0.11 * t)
                "ios_glass_chimes" -> 1150.0 + 380.0 * sin(TWO_PI * 0.19 * t)
                else -> 680.0 + 260.0 * sin(TWO_PI * 0.15 * t)
            }
            svfL.step(l, cutHz, 0.95f)
            svfR.step(r, cutHz, 0.95f)
            l = svfL.low; r = svfR.low

            when (type) {
                "botanical_air", "forest_air" -> {
                    val breeze = 0.45f + 0.55f * sin(TWO_PI * 0.14 * t).toFloat()
                    airSvfL.step(rng.nextPink(), 480.0 + 260.0 * breeze, 0.85f)
                    airSvfR.step(rng.nextPink(), 510.0 + 260.0 * breeze, 0.85f)
                    l += airSvfL.band * 0.18f * breeze
                    r += airSvfR.band * 0.18f * breeze
                    revAmt = 0.72f
                }
                "keynote_pulse", "apple_keynote_minimal", "minimal_pulse" -> {
                    val bpm = if (type == "minimal_pulse") 108.0 else 112.0
                    val beat = t * bpm / 60.0
                    val pos = beat % 1.0
                    // Deep felt-muted sub pulse (warm heartbeat, NOT cheesy marimba beep!)
                    val kickEnv = exp(-pos * 11.5).toFloat()
                    val kickFreq = 54.0 + 28.0 * exp(-pos * 26.0)
                    subPhase += TWO_PI * kickFreq / SAMPLE_RATE
                    val subKick = sin(subPhase).toFloat() * kickEnv * 0.34f
                    // Soft ghost shaker on offbeat
                    val offPos = (beat + 0.5) % 1.0
                    val shEnv = exp(-offPos * 28.0).toFloat()
                    airSvfL.step(rng.nextPink(), 3200.0, 0.9f)
                    val ghost = airSvfL.high * shEnv * 0.08f
                    l = l * 0.75f + subKick + ghost * 0.8f
                    r = r * 0.75f + subKick + ghost * 1.2f
                    revAmt = 0.42f
                }
                "ios_glass_chimes" -> {
                    val stepSec = 1.6
                    val pos = (t % stepSec) / stepSec
                    val noteIdx = (t / stepSec).toInt() % chord.size
                    val bellF = chord[noteIdx] * 2.0
                    val bellEnv = min(1.0, (pos * stepSec) / 0.015) * exp(-pos * 4.6)
                    val bell = (sin(TWO_PI * bellF * t) * 0.65 + sin(TWO_PI * bellF * 2.756 * t) * 0.12).toFloat() * bellEnv.toFloat() * 0.14f
                    l += bell * 0.75f
                    r += bell * 1.25f
                    revAmt = 0.80f
                }
                "dark_cinema" -> {
                    subPhase += TWO_PI * 41.20 / SAMPLE_RATE
                    val sub = sin(subPhase).toFloat() * 0.24f * swell
                    l += sub; r += sub
                    revAmt = 0.75f
                }
            }
            addStereo(dry, rev, totalFrames, i, l * env, r * env, revAmt)
        }
    }

    private fun renderSfx(
        dry: FloatArray,
        rev: FloatArray,
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

        // Breathable cinema air whoosh using Pink Noise + Resonant SVF (zero cartoon whistle!)
        fun writeAirWhoosh(dur: Double, fLo: Double, fHi: Double, peakAt: Double, subHz: Double = 0.0, revSend: Float = 0.55f) {
            val n = (dur * SAMPLE_RATE).toInt()
            val svfL = SvFilter(); val svfR = SvFilter()
            var subPhase = 0.0
            for (i in 0 until n) {
                val u = i.toDouble() / n
                val env = if (u < peakAt) (u / peakAt).pow(1.8) else ((1.0 - u) / (1.0 - peakAt)).pow(2.4)
                val shape = sin(u * PI).pow(1.2)
                val f = (fLo + (fHi - fLo) * shape) * pitch
                svfL.step(rng.nextPink(), f, 0.72f)
                svfR.step(rng.nextPink(), f * 1.04, 0.72f)
                var l = svfL.band * 1.15f
                var r = svfR.band * 1.15f
                if (subHz > 0.0) {
                    subPhase += TWO_PI * (subHz * (1.0 - 0.35 * u)) / SAMPLE_RATE
                    val sub = sin(subPhase).toFloat() * 0.34f * sin(u * PI).toFloat()
                    l += sub; r += sub
                }
                val e = env.toFloat()
                addStereo(dry, rev, totalFrames, start + i, l * e * gL, r * e * gR, revSend)
            }
        }

        // Acoustic felt-piano / marimba wood pluck (warm, organic, expensive!)
        fun writeFeltPluck(dur: Double, freqHz: Double, bright: Float = 0.35f, revSend: Float = 0.65f) {
            val n = (dur * SAMPLE_RATE).toInt()
            val f0 = freqHz * pitch
            val svf = SvFilter()
            for (i in 0 until n) {
                val t = i.toDouble() / SAMPLE_RATE
                val att = min(1.0, t / 0.005)
                val body = sin(TWO_PI * f0 * t) * exp(-t * 5.2)
                val over2 = sin(TWO_PI * f0 * 2.0 * t) * exp(-t * 9.5) * (0.28 * bright)
                val over3 = sin(TWO_PI * f0 * 3.01 * t) * exp(-t * 14.0) * (0.10 * bright)
                val feltThump = rng.nextPink() * exp(-t * 85.0) * 0.22
                val raw = ((body + over2 + over3 + feltThump) * att).toFloat() * 0.72f
                svf.step(raw, 1400.0 + 1800.0 * exp(-t * 12.0), 0.9f)
                addStereo(dry, rev, totalFrames, start + i, svf.low * gL, svf.low * gR, revSend)
            }
        }

        // Crisp tactile mechanical micro-click (Apple Taptic Engine / Leica dial feel)
        fun writeTactileClick(bodyHz: Double, clickHz: Double, dur: Double = 0.042, revSend: Float = 0.18f) {
            val n = (dur * SAMPLE_RATE).toInt()
            val svf = SvFilter()
            for (i in 0 until n) {
                val t = i.toDouble() / SAMPLE_RATE
                val envBody = exp(-t * 110.0)
                val envTick = exp(-t * 240.0)
                val thump = sin(TWO_PI * (bodyHz * pitch * (0.65 + 0.35 * envBody)) * t) * envBody * 0.68
                svf.step(rng.nextWhite(), clickHz * pitch, 0.55f)
                val snap = svf.band * envTick * 0.55
                val out = (thump + snap).toFloat()
                addStereo(dry, rev, totalFrames, start + i, out * gL, out * gR, revSend)
            }
        }

        // Lush crystal chord / glass bloom with stereo shimmer & natural decay
        fun writeCrystalChord(notes: DoubleArray, dur: Double, staggerSec: Double, decayRate: Double, revSend: Float = 0.85f) {
            val n = (dur * SAMPLE_RATE).toInt()
            for (i in 0 until n) {
                val t = i.toDouble() / SAMPLE_RATE
                var l = 0f; var r = 0f
                for (k in notes.indices) {
                    val dt = t - k * staggerSec
                    if (dt < 0) continue
                    val att = min(1.0, dt / 0.012).pow(1.3)
                    val env = att * exp(-dt * (decayRate + k * 0.32))
                    val f = notes[k] * pitch
                    // Pure fundamental + soft glass harmonic
                    val sig = (sin(TWO_PI * f * dt) * 0.74 + sin(TWO_PI * f * 2.0 * dt) * 0.16 * exp(-dt * 4.0) + sin(TWO_PI * f * 3.0 * dt) * 0.04 * exp(-dt * 8.0)).toFloat()
                    val amp = (0.28f / (1f + k * 0.18f)) * env.toFloat()
                    val panK = if (k % 2 == 0) 0.82f else 1.18f
                    l += sig * amp * panK
                    r += sig * amp * (2f - panK)
                }
                addStereo(dry, rev, totalFrames, start + i, l * gL, r * gR, revSend)
            }
        }

        when (sfx) {
            // --- FLAGSHIP v0.5 CINEMA SFX ---
            "air_whoosh", "whoosh" -> writeAirWhoosh(0.46, 180.0, 1450.0, 0.38, 72.0, 0.60f)
            "whip", "glass_slide" -> writeAirWhoosh(0.28, 320.0, 2600.0, 0.30, 95.0, 0.48f)
            "swoosh_soft" -> writeAirWhoosh(0.42, 160.0, 920.0, 0.44, 0.0, 0.65f)
            "swoosh_deep" -> writeAirWhoosh(0.72, 90.0, 680.0, 0.38, 62.0, 0.72f)
            "liquid_morph" -> {
                writeAirWhoosh(0.36, 240.0, 1550.0, 0.40, 88.0, 0.65f)
                writeFeltPluck(0.32, 392.0, 0.45f, 0.72f)
            }
            "felt_pluck" -> writeFeltPluck(0.58, 329.63, 0.42f, 0.70f)
            "tactile_tick", "tick" -> writeTactileClick(260.0, 2400.0, 0.036, 0.16f)
            "click", "type_key" -> writeTactileClick(190.0, 3100.0, 0.028, 0.12f)
            "glass_tap" -> {
                writeTactileClick(340.0, 2800.0, 0.035, 0.22f)
                writeFeltPluck(0.22, 1046.5, 0.55f, 0.55f)
            }
            "pop" -> writeFeltPluck(0.16, 280.0, 0.30f, 0.30f)
            "bubble", "water_drop" -> {
                // Realistic organic water droplet (short resonant woody-glass impulse, NOT laser!)
                val n = (0.14 * SAMPLE_RATE).toInt()
                var phase = 0.0
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val env = min(1.0, t / 0.004) * exp(-t * 28.0)
                    val f = (540.0 + 480.0 * (1.0 - exp(-t * 22.0))) * pitch
                    phase += TWO_PI * f / SAMPLE_RATE
                    val s = sin(phase).toFloat() * env.toFloat() * 0.58f
                    addStereo(dry, rev, totalFrames, start + i, s * gL, s * gR, 0.62f)
                }
            }
            "snap" -> {
                writeTactileClick(420.0, 3400.0, 0.045, 0.28f)
                writeAirWhoosh(0.08, 600.0, 2800.0, 0.20, 0.0, 0.25f)
            }
            "shutter", "camera_focus" -> {
                writeTactileClick(240.0, 3200.0, 0.035, 0.18f)
                val off = (0.062 * SAMPLE_RATE).toInt()
                val n = (0.04 * SAMPLE_RATE).toInt()
                val svf = SvFilter()
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val e = exp(-t * 120.0).toFloat()
                    svf.step(rng.nextWhite(), 2600.0 * pitch, 0.6f)
                    val s = (sin(TWO_PI * 320.0 * pitch * t).toFloat() * 0.45f + svf.band * 0.45f) * e
                    addStereo(dry, rev, totalFrames, start + off + i, s * gL, s * gR, 0.20f)
                }
            }
            "page_flip" -> writeAirWhoosh(0.24, 480.0, 2800.0, 0.28, 0.0, 0.35f)
            "cinema_boom", "sub_drop", "bass_hit", "thud" -> {
                val dur = if (sfx == "thud") 0.38 else 0.95
                val n = (dur * SAMPLE_RATE).toInt()
                var ph = 0.0
                val svf = SvFilter()
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val att = min(1.0, t / 0.008)
                    val env = att * exp(-t * (if (sfx == "thud") 7.5 else 3.4))
                    val f = (38.0 + 72.0 * exp(-t * 14.0)) * pitch
                    ph += TWO_PI * f / SAMPLE_RATE
                    svf.step(rng.nextPink(), 260.0 * exp(-t * 6.0) + 70.0, 0.85f)
                    val hit = (sin(ph) * 0.78 + sin(ph * 2.0) * 0.14 + svf.low * 0.35).toFloat() * env.toFloat()
                    addStereo(dry, rev, totalFrames, start + i, hit * gL, hit * gR, 0.62f)
                }
            }
            "riser" -> {
                val n = (1.15 * SAMPLE_RATE).toInt()
                val svfL = SvFilter(); val svfR = SvFilter()
                var ph = 0.0
                for (i in 0 until n) {
                    val u = i.toDouble() / n
                    val env = u.pow(2.2) * (if (u > 0.94) (1.0 - u) / 0.06 else 1.0)
                    val f = (180.0 + 2400.0 * u * u) * pitch
                    svfL.step(rng.nextPink(), f, 0.52f)
                    svfR.step(rng.nextPink(), f * 1.05, 0.52f)
                    ph += TWO_PI * (110.0 + 330.0 * u * u) * pitch / SAMPLE_RATE
                    val tone = sin(ph).toFloat() * 0.22f
                    val e = env.toFloat()
                    addStereo(dry, rev, totalFrames, start + i, (svfL.band * 0.75f + tone) * e * gL, (svfR.band * 0.75f + tone) * e * gR, 0.68f)
                }
            }
            "tape_stop" -> {
                val n = (0.42 * SAMPLE_RATE).toInt()
                var ph = 0.0
                for (i in 0 until n) {
                    val u = i.toDouble() / n
                    val f = (440.0 * (1.0 - u).pow(2.2) + 38.0) * pitch
                    ph += TWO_PI * f / SAMPLE_RATE
                    val env = (1.0 - u).pow(1.4).toFloat() * 0.55f
                    val s = warmWave(ph) * env
                    addStereo(dry, rev, totalFrames, start + i, s * gL, s * gR, 0.35f)
                }
            }
            "crystal_bloom", "bloom" -> writeCrystalChord(doubleArrayOf(261.63, 329.63, 392.00, 493.88, 587.33, 783.99), 1.45, 0.045, 2.2, 0.92f)
            "chime" -> writeCrystalChord(doubleArrayOf(392.00, 493.88, 587.33, 783.99, 987.77), 1.15, 0.032, 3.0, 0.85f)
            "glass_shimmer", "sparkle" -> writeCrystalChord(doubleArrayOf(659.25, 783.99, 987.77, 1318.5, 1567.98), 1.05, 0.052, 3.6, 0.90f)
            "ding" -> writeCrystalChord(doubleArrayOf(587.33, 1174.66), 0.75, 0.008, 4.2, 0.72f)
            else -> writeFeltPluck(0.24, 392.0, 0.38f, 0.55f)
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
                    outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> outputFormat = codec.outputFormat
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
