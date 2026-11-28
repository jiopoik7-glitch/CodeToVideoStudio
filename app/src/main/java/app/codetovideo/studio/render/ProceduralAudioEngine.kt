package app.codetovideo.studio.render

import android.content.Context
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import app.codetovideo.studio.core.StudioAudioConfig
import java.io.File
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.abs
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
 * Studio Acoustics & Physical Modeling Audio Engine v0.7:
 * - Zero-resonance cascaded air filters + Stereo Doppler pan for silky cinema whooshes
 * - Karplus-Strong physical string modeling for warm felt piano, harp & kalimba accents
 * - Apple Taptic & Leica mechanical micro-foley impulses + Minnaert droplet physics
 * - Evolving multi-chord Ambience Beds (10 beds) with smooth harmonic crossfades
 * - Custom User SFX override support (.mp3/.wav/.m4a) + Voiceover Auto-Ducking
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

    /** Zero-resonance 2-pole cascaded LP + 1-pole HP for silky, natural, non-whistling air */
    private class SilkyAirFilter {
        private var lp1 = 0f
        private var lp2 = 0f
        private var hp = 0f
        private var prevX = 0f

        fun step(input: Float, lpHz: Double, hpHz: Double): Float {
            val aLp = (1.0 - exp(-TWO_PI * lpHz.coerceIn(60.0, 14000.0) / SAMPLE_RATE)).toFloat()
            val aHp = exp(-TWO_PI * hpHz.coerceIn(20.0, 6000.0) / SAMPLE_RATE).toFloat()
            hp = aHp * (hp + input - prevX)
            prevX = input
            lp1 += aLp * (hp - lp1)
            lp2 += aLp * (lp1 - lp2)
            return lp2
        }
    }

    /** Physical Karplus-Strong plucked string with soft felt excitation */
    private class KarplusVoice(freqHz: Double, brightness: Float, private val decay: Float, rng: FastRng) {
        private val len = (SAMPLE_RATE / freqHz.coerceIn(65.0, 3800.0)).toInt().coerceIn(10, 1800)
        private val buf = FloatArray(len)
        private var idx = 0

        init {
            var smooth = 0f
            val lpA = brightness.coerceIn(0.08f, 0.72f)
            for (i in 0 until len) {
                val u = i.toDouble() / len
                // Warm felt hammer burst (no harsh metallic pick snap)
                val exc = (rng.nextPink() * 0.65f + sin(TWO_PI * u).toFloat() * 0.55f)
                smooth += lpA * (exc - smooth)
                buf[i] = smooth
            }
        }

        fun step(): Float {
            val cur = buf[idx]
            val next = buf[(idx + 1) % len]
            val filtered = 0.5f * (cur + next) * decay
            buf[idx] = filtered
            if (++idx >= len) idx = 0
            return cur
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

    fun synthesizeSingleSfxPcm(context: Context, sfx: String, pitch: Float = 1.0f): ByteArray {
        val durFrames = (1.6 * SAMPLE_RATE).toInt()
        val dry = FloatArray(durFrames * CHANNELS)
        val rev = FloatArray(durFrames * CHANNELS)
        val cache = HashMap<String, WavSample?>()
        val customOrAsset = loadExternalSfx(context, sfx, cache)
        if (customOrAsset != null) {
            mixWavSample(dry, rev, durFrames, 0, customOrAsset, 0.92f, pitch, 0f, 0.14f)
        } else {
            renderAcousticSfx(dry, rev, durFrames, 0, sfx, 0.90f, pitch, 0f, FastRng(sfx.hashCode() * 31 + 7))
        }
        return masterToPcm16(dry, rev, null, durFrames, 1f, false)
    }

    fun synthesizeAmbiencePreviewPcm(ambience: String): ByteArray {
        if (ambience == "none") return ByteArray(0)
        val durSec = 3.8
        val totalFrames = (durSec * SAMPLE_RATE).toInt()
        val dry = FloatArray(totalFrames * CHANNELS)
        val rev = FloatArray(totalFrames * CHANNELS)
        renderAmbience(dry, rev, totalFrames, durSec, ambience, 0.58f, FastRng(ambience.hashCode() + 42))
        return masterToPcm16(dry, rev, null, totalFrames, 1f, true)
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

        val voiceoverMix = if (voiceoverUri.isNotBlank() && voiceoverGain > 0.01f) {
            runCatching { decodeAudioUri(context, voiceoverUri, totalFrames) }.getOrNull()
        } else null

        val effAmbVol = (config.ambienceVolume * ambienceMasterGain).coerceIn(0f, 1.2f)
        if (config.ambience != "none" && effAmbVol > 0.005f) {
            renderAmbience(ambDry, revSend, totalFrames, dur.toDouble(), config.ambience, effAmbVol, rng)
        }

        val impactMask = FloatArray(totalFrames)
        if (sfxMasterGain > 0.005f) {
            config.cues.forEachIndexed { idx, cue ->
                val timeSec = if (cue.atProgress != null) cue.atProgress * dur.toDouble() else cue.atSeconds
                val startFrame = (timeSec * SAMPLE_RATE).toInt()
                if (startFrame in 0 until totalFrames) {
                    val pan = ((idx % 3) - 1) * 0.12f
                    val gain = (cue.gain * sfxMasterGain).coerceIn(0f, 1.5f)
                    if (SfxCatalog.isImpactSfx(cue.sfx)) {
                        val duckLen = (0.75 * SAMPLE_RATE).toInt()
                        for (k in 0 until duckLen) {
                            val idxF = startFrame + k
                            if (idxF >= totalFrames) break
                            val u = k.toFloat() / duckLen
                            val env = if (u < 0.06f) u / 0.06f else (1f - (u - 0.06f) / 0.94f)
                            impactMask[idxF] = max(impactMask[idxF], env.coerceIn(0f, 1f) * gain.coerceAtMost(1f))
                        }
                    }
                    val customOrAsset = loadExternalSfx(context, cue.sfx, wavCache)
                    if (customOrAsset != null) {
                        mixWavSample(sfxDry, revSend, totalFrames, startFrame, customOrAsset, gain, cue.pitch, pan, 0.14f)
                    } else {
                        val cueRng = FastRng(seed * 131 + idx * 977 + cue.sfx.hashCode())
                        renderAcousticSfx(sfxDry, revSend, totalFrames, startFrame, cue.sfx, gain, cue.pitch, pan, cueRng)
                    }
                }
            }
        }

        // Combine Ambience with Dual-Trigger Smart Auto-Ducking (Voiceover + Cinema Impact)
        var duckEnv = 0f
        for (i in 0 until totalFrames) {
            val base = i * CHANNELS
            val voTrig = if (voiceoverMix != null && autoDucking) {
                (abs(voiceoverMix[base]) + abs(voiceoverMix[base + 1])) * 0.5f * voiceoverGain
            } else 0f
            val impTrig = if (autoDucking) impactMask[i] * 0.35f else 0f
            val trig = max(voTrig, impTrig)
            val duckMult = if (autoDucking && (voiceoverMix != null || impTrig > 0.001f || duckEnv > 0.001f)) {
                val coeff = if (trig > duckEnv) 0.008f else 0.00022f
                duckEnv += coeff * (trig - duckEnv)
                1f - (duckEnv * 4.2f).coerceIn(0f, 0.74f)
            } else 1f
            ambDry[base] = ambDry[base] * duckMult + sfxDry[base]
            ambDry[base + 1] = ambDry[base + 1] * duckMult + sfxDry[base + 1]
        }

        val pcm = masterToPcm16(ambDry, revSend, voiceoverMix, totalFrames, voiceoverGain, true)
        return encodePcmToAac(pcm)
    }

    /** Generates a lightweight visual waveform energy profile (0f..1f) for the Render Timeline UI. */
    fun computeTimelineWaveform(durationSeconds: Int, config: StudioAudioConfig, bars: Int = 56): List<Float> {
        val dur = durationSeconds.coerceIn(1, 60).toDouble()
        val hasBed = config.ambience != "none" && config.ambienceVolume > 0.01f
        val out = FloatArray(bars)
        for (i in 0 until bars) {
            val u = i.toDouble() / max(1, bars - 1)
            val base = if (hasBed) {
                (0.18 + 0.14 * abs(sin(u * PI * 6.0)) + 0.08 * abs(cos(u * PI * 11.0))) * config.ambienceVolume.coerceIn(0.2f, 1f)
            } else 0.08
            out[i] = base.toFloat()
        }
        config.cues.forEach { cue ->
            val sec = if (cue.atProgress != null) cue.atProgress * dur else cue.atSeconds
            val pos = ((sec / dur) * (bars - 1)).toInt().coerceIn(0, bars - 1)
            val impactBoost = if (SfxCatalog.isImpactSfx(cue.sfx)) 0.95f else 0.68f
            val peak = (impactBoost * cue.gain.coerceIn(0.3f, 1.2f)).coerceIn(0.2f, 1f)
            for (d in -2..2) {
                val idx = pos + d
                if (idx in 0 until bars) {
                    val falloff = 1f - abs(d) * 0.30f
                    out[idx] = max(out[idx], peak * falloff)
                }
            }
        }
        return out.map { it.coerceIn(0.06f, 1f) }
    }

    /** Checks User Custom SFX first, then optional assets/sfx/ WAV override. */
    private fun loadExternalSfx(context: Context, rawName: String, cache: HashMap<String, WavSample?>): WavSample? {
        val key = rawName.trim().lowercase().replace(Regex("[^a-z0-9_]"), "")
        if (cache.containsKey(key)) return cache[key]
        val customFile: File? = CustomSfxRepository.getCustomFile(context, key)
        val sample = if (customFile != null) {
            runCatching { parseWav(customFile.readBytes()) }.getOrNull()
        } else {
            runCatching {
                val bytes = context.assets.open("sfx/$key.wav").use { it.readBytes() }
                parseWav(bytes)
            }.getOrNull()
        }
        cache[key] = sample
        return sample
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

    // =========================================================================
    // PHYSICAL MODELING ACOUSTIC SFX SYNTHESIZER (36 SFX — ZERO ROBOTIC BEEP!)
    // =========================================================================
    private fun renderAcousticSfx(
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

        // 1) Silky Zero-Resonance Doppler Cinema Air Whoosh
        fun writeSilkyWhoosh(
            dur: Double,
            lpMin: Double,
            lpMax: Double,
            hpHz: Double,
            peakAt: Double,
            dopplerSpan: Float,
            chestSubHz: Double = 0.0,
            revSend: Float = 0.42f
        ) {
            val n = (dur * SAMPLE_RATE).toInt()
            val fL = SilkyAirFilter()
            val fR = SilkyAirFilter()
            var subPh = 0.0
            for (i in 0 until n) {
                val u = i.toDouble() / n
                val env = if (u < peakAt) (u / peakAt).pow(1.9) else ((1.0 - u) / (1.0 - peakAt)).pow(2.5)
                val shape = sin(u * PI).pow(1.45)
                val lp = (lpMin + (lpMax - lpMin) * shape) * pitch
                val rawL = fL.step(rng.nextPink(), lp, hpHz)
                val rawR = fR.step(rng.nextPink(), lp * 1.03, hpHz)
                val sweepPan = ((u - 0.5) * 2.0).toFloat() * dopplerSpan
                val pL = 1f - max(0f, sweepPan)
                val pR = 1f + min(0f, sweepPan)
                var sub = 0f
                if (chestSubHz > 0.0) {
                    subPh += TWO_PI * (chestSubHz * (1.0 - 0.30 * u)) / SAMPLE_RATE
                    sub = sin(subPh).toFloat() * 0.24f * sin(u * PI).pow(1.6).toFloat()
                }
                val e = env.toFloat() * 1.25f
                addStereo(dry, rev, totalFrames, start + i, (rawL * pL + sub) * e * gL, (rawR * pR + sub) * e * gR, revSend)
            }
        }

        // 2) Apple Taptic / Leica Tactile Micro-Impulse
        fun writeTapticImpulse(
            dur: Double,
            fStart: Double,
            fEnd: Double,
            bodyDecay: Double,
            clickLp: Double,
            clickHp: Double,
            clickAmp: Float,
            revSend: Float = 0.14f
        ) {
            val n = (dur * SAMPLE_RATE).toInt()
            val air = SilkyAirFilter()
            var ph = 0.0
            for (i in 0 until n) {
                val t = i.toDouble() / SAMPLE_RATE
                val att = min(1.0, t / 0.0018)
                val bEnv = att * exp(-t * bodyDecay)
                val cEnv = exp(-t * 280.0)
                val f = (fEnd + (fStart - fEnd) * exp(-t * 140.0)) * pitch
                ph += TWO_PI * f / SAMPLE_RATE
                val body = sin(ph) * bEnv * 0.68
                val click = air.step(rng.nextWhite(), clickLp * pitch, clickHp * pitch) * cEnv * clickAmp
                val out = (body + click).toFloat()
                addStereo(dry, rev, totalFrames, start + i, out * gL, out * gR, revSend)
            }
        }

        // 3) Karplus-Strong Acoustic Felt Pluck / Harp / Kalimba
        fun writeAcousticPluck(
            notes: DoubleArray,
            dur: Double,
            strumSec: Double,
            brightness: Float,
            stringDecay: Float,
            ampScale: Float,
            revSend: Float = 0.68f
        ) {
            val n = (dur * SAMPLE_RATE).toInt()
            val voices = notes.map { KarplusVoice(it * pitch, brightness, stringDecay, rng) }
            val startOffsets = notes.indices.map { (it * strumSec * SAMPLE_RATE).toInt() }
            val lpL = SilkyAirFilter(); val lpR = SilkyAirFilter()
            for (i in 0 until n) {
                var l = 0f; var r = 0f
                for (k in voices.indices) {
                    val dtSamp = i - startOffsets[k]
                    if (dtSamp < 0) continue
                    val dt = dtSamp.toDouble() / SAMPLE_RATE
                    val att = min(1.0, dt / 0.006)
                    val tail = exp(-dt * 2.4)
                    val s = voices[k].step() * (att * tail).toFloat() * (ampScale / (1f + k * 0.22f))
                    val spread = if (notes.size == 1) 1f else (0.78f + (k.toFloat() / max(1, notes.size - 1)) * 0.44f)
                    l += s * spread
                    r += s * (2f - spread)
                }
                val outL = lpL.step(l, 4200.0, 55.0)
                val outR = lpR.step(r, 4200.0, 55.0)
                addStereo(dry, rev, totalFrames, start + i, outL * gL, outR * gR, revSend)
            }
        }

        // 4) Frosted Quartz Glass Tap / Wood Tap (Modal Resonance, ZERO loud bell!)
        fun writeModalTap(baseHz: Double, ratio2: Double, dur: Double, decay1: Double, decay2: Double, amp: Float, revSend: Float) {
            val n = (dur * SAMPLE_RATE).toInt()
            val tapF = SilkyAirFilter()
            val f1 = baseHz * pitch
            val f2 = baseHz * ratio2 * pitch
            for (i in 0 until n) {
                val t = i.toDouble() / SAMPLE_RATE
                val att = min(1.0, t / 0.0022)
                val m1 = sin(TWO_PI * f1 * t) * exp(-t * decay1) * 0.72
                val m2 = sin(TWO_PI * f2 * t) * exp(-t * decay2) * 0.24
                val hit = tapF.step(rng.nextPink(), 2600.0, 420.0) * exp(-t * 210.0) * 0.35
                val s = ((m1 + m2 + hit) * att).toFloat() * amp
                addStereo(dry, rev, totalFrames, start + i, s * gL, s * gR, revSend)
            }
        }

        when (sfx) {
            // --- TRANSITIONS (SILKY AIR & MOTION SWEEPS) ---
            "air_whoosh" -> writeSilkyWhoosh(0.46, 160.0, 1550.0, 95.0, 0.40, 0.42f, 64.0, 0.46f)
            "whoosh" -> writeSilkyWhoosh(0.42, 180.0, 1850.0, 110.0, 0.38, 0.45f, 70.0, 0.44f)
            "whip" -> writeSilkyWhoosh(0.24, 240.0, 2900.0, 140.0, 0.28, 0.55f, 84.0, 0.32f)
            "swoosh_soft" -> writeSilkyWhoosh(0.48, 140.0, 1050.0, 85.0, 0.44, 0.34f, 56.0, 0.50f)
            "swoosh_deep" -> writeSilkyWhoosh(0.76, 95.0, 680.0, 55.0, 0.38, 0.36f, 48.0, 0.58f)
            "glass_slide" -> {
                writeSilkyWhoosh(0.32, 260.0, 2200.0, 180.0, 0.36, 0.48f, 0.0, 0.42f)
                writeModalTap(980.0, 2.756, 0.14, 28.0, 55.0, 0.22f, 0.48f)
            }
            "liquid_morph" -> {
                writeSilkyWhoosh(0.38, 190.0, 1400.0, 110.0, 0.42, 0.38f, 68.0, 0.48f)
                writeModalTap(460.0, 1.5, 0.18, 22.0, 44.0, 0.26f, 0.46f)
            }
            "paper_slide", "page_flip" -> writeSilkyWhoosh(0.21, 900.0, 4200.0, 620.0, 0.32, 0.30f, 0.0, 0.22f)

            // --- UI, TAPTIC & ORGANIC FOLEY ---
            "taptic_thock", "pop" -> writeTapticImpulse(0.055, 190.0, 68.0, 72.0, 1400.0, 240.0, 0.32f, 0.14f)
            "tactile_tick", "tick" -> writeTapticImpulse(0.028, 320.0, 120.0, 160.0, 3200.0, 900.0, 0.52f, 0.10f)
            "click", "type_key" -> writeTapticImpulse(0.024, 260.0, 95.0, 185.0, 3800.0, 1100.0, 0.60f, 0.08f)
            "glass_tap" -> writeModalTap(880.0, 2.756, 0.085, 42.0, 88.0, 0.46f, 0.30f)
            "wood_tap" -> writeModalTap(420.0, 2.58, 0.075, 46.0, 96.0, 0.56f, 0.24f)
            "snap" -> {
                writeTapticImpulse(0.036, 420.0, 150.0, 130.0, 4600.0, 1400.0, 0.68f, 0.22f)
                writeSilkyWhoosh(0.06, 800.0, 3400.0, 600.0, 0.20, 0.15f, 0.0, 0.18f)
            }
            "shutter", "camera_focus" -> {
                writeTapticImpulse(0.025, 290.0, 110.0, 175.0, 4200.0, 1200.0, 0.65f, 0.12f)
                val off = (0.056 * SAMPLE_RATE).toInt()
                val n = (0.028 * SAMPLE_RATE).toInt()
                val f = SilkyAirFilter()
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val e = exp(-t * 165.0).toFloat()
                    val s = (sin(TWO_PI * 240.0 * pitch * t).toFloat() * 0.35f + f.step(rng.nextWhite(), 3600.0, 950.0) * 0.65f) * e
                    addStereo(dry, rev, totalFrames, start + off + i, s * gL, s * gR, 0.14f)
                }
            }
            "water_drop", "bubble" -> {
                // Authentic single Minnaert droplet (45ms crisp bubble cavity, ZERO splashing sink!)
                val n = (0.065 * SAMPLE_RATE).toInt()
                var ph = 0.0
                val f0 = if (sfx == "bubble") 360.0 else 520.0
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val att = min(1.0, t / 0.0025)
                    val env = att * exp(-t * 54.0)
                    val f = (f0 + f0 * 1.45 * (1.0 - exp(-t * 36.0))) * pitch
                    ph += TWO_PI * f / SAMPLE_RATE
                    val s = sin(ph).toFloat() * env.toFloat() * 0.56f
                    addStereo(dry, rev, totalFrames, start + i, s * gL, s * gR, 0.45f)
                }
            }

            // --- ACOUSTIC MUSICAL ACCENTS (KARPLUS-STRONG FELT & HARP) ---
            "felt_pluck" -> writeAcousticPluck(doubleArrayOf(293.66), 0.72, 0.0, 0.24f, 0.9965f, 0.85f, 0.62f)
            "kalimba_note" -> writeAcousticPluck(doubleArrayOf(440.0), 0.68, 0.0, 0.36f, 0.9958f, 0.78f, 0.58f)
            "ding" -> writeAcousticPluck(doubleArrayOf(587.33, 880.0), 0.95, 0.014, 0.32f, 0.9972f, 0.62f, 0.74f)
            "chime" -> writeAcousticPluck(doubleArrayOf(392.00, 493.88, 587.33, 739.99), 1.35, 0.032, 0.28f, 0.9978f, 0.58f, 0.84f)
            "crystal_bloom", "bloom" -> {
                // Warm Apple-style velvety Cmaj9 harp/pad swell (NEVER a church bell!)
                writeAcousticPluck(doubleArrayOf(261.63, 329.63, 392.00, 493.88, 587.33), 1.50, 0.042, 0.22f, 0.9980f, 0.52f, 0.90f)
                writeSilkyWhoosh(0.75, 180.0, 980.0, 120.0, 0.48, 0.22f, 0.0, 0.65f)
            }
            "glass_shimmer", "sparkle" -> writeAcousticPluck(doubleArrayOf(587.33, 739.99, 880.00, 1174.66), 1.15, 0.048, 0.35f, 0.9968f, 0.46f, 0.86f)

            // --- CINEMA IMPACTS & RISERS ---
            "cinema_boom", "sub_drop", "bass_hit", "thud" -> {
                val dur = if (sfx == "thud") 0.34 else 1.05
                val n = (dur * SAMPLE_RATE).toInt()
                var ph = 0.0
                val air = SilkyAirFilter()
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val att = min(1.0, t / 0.007)
                    val decay = if (sfx == "thud") 8.5 else 3.2
                    val env = att * exp(-t * decay)
                    val f = (36.0 + 68.0 * exp(-t * 16.0)) * pitch
                    ph += TWO_PI * f / SAMPLE_RATE
                    val punch = air.step(rng.nextPink(), 260.0 * exp(-t * 7.0) + 65.0, 32.0) * 0.42
                    val sub = sin(ph) * 0.78 + sin(ph * 2.0) * 0.12
                    val out = ((sub + punch) * env).toFloat()
                    addStereo(dry, rev, totalFrames, start + i, out * gL, out * gR, 0.48f)
                }
            }
            "riser" -> {
                val n = (1.20 * SAMPLE_RATE).toInt()
                val fL = SilkyAirFilter(); val fR = SilkyAirFilter()
                var ph = 0.0
                for (i in 0 until n) {
                    val u = i.toDouble() / n
                    val env = u.pow(2.2) * (if (u > 0.94) (1.0 - u) / 0.06 else 1.0)
                    val lp = (200.0 + 2600.0 * u * u) * pitch
                    val aL = fL.step(rng.nextPink(), lp, 120.0)
                    val aR = fR.step(rng.nextPink(), lp * 1.04, 120.0)
                    ph += TWO_PI * (98.0 + 196.0 * u * u) * pitch / SAMPLE_RATE
                    val tone = sin(ph).toFloat() * 0.16f
                    val e = env.toFloat()
                    addStereo(dry, rev, totalFrames, start + i, (aL + tone) * e * gL, (aR + tone) * e * gR, 0.62f)
                }
            }
            "tape_stop" -> {
                val n = (0.44 * SAMPLE_RATE).toInt()
                var ph = 0.0
                for (i in 0 until n) {
                    val u = i.toDouble() / n
                    val f = (360.0 * (1.0 - u).pow(2.3) + 34.0) * pitch
                    ph += TWO_PI * f / SAMPLE_RATE
                    val env = (1.0 - u).pow(1.5).toFloat() * 0.48f
                    val s = (sin(ph) + sin(ph * 2.0) * 0.16).toFloat() * env
                    addStereo(dry, rev, totalFrames, start + i, s * gL, s * gR, 0.30f)
                }
            }
            // --- v2.0 EXPLAINER & CARTOON POP ---
            "bubble_pop" -> writeTapticImpulse(0.085, 290.0, 760.0, 28.0, 2600.0, 280.0, 0.20f, 0.28f)
            "soft_boing", "boing_high", "boing_low" -> {
                val baseF = when (sfx) { "boing_high" -> 280.0; "boing_low" -> 130.0; else -> 195.0 }
                val n = (0.34 * SAMPLE_RATE).toInt()
                var ph = 0.0
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val f = (baseF + baseF * 0.9 * sin(TWO_PI * 7.5 * t) * exp(-t * 5.0)) * pitch
                    ph += TWO_PI * max(60.0, f) / SAMPLE_RATE
                    val env = min(1.0, t / 0.004) * exp(-t * 7.5)
                    val s = (sin(ph) * 0.85 + sin(ph * 2.0) * 0.15).toFloat() * env.toFloat() * 0.65f
                    addStereo(dry, rev, totalFrames, start + i, s * gL, s * gR, 0.30f)
                }
            }
            "checklist_ding", "step_complete", "badge_unlock" ->
                writeAcousticPluck(doubleArrayOf(659.25, 987.77, 1318.5), 0.78, 0.025, 0.34f, 0.9968f, 0.60f, 0.72f)
            "magnifier_whoosh", "comic_zip", "warp_sweep" ->
                writeSilkyWhoosh(0.32, 320.0, 3400.0, 200.0, 0.35, 0.56f, 82.0, 0.38f)
            "paper_flip", "card_flip", "card_deal", "sticky_note" ->
                writeSilkyWhoosh(0.18, 1050.0, 4800.0, 680.0, 0.28, 0.32f, 0.0, 0.20f)
            "sparkle_chime", "celesta_twinkle", "bell_crystal" ->
                writeAcousticPluck(doubleArrayOf(1046.5, 1318.5, 1568.0, 2093.0), 1.05, 0.036, 0.38f, 0.9972f, 0.48f, 0.86f)
            "bulb_idea", "bell_soft" -> writeModalTap(1046.5, 2.0, 0.52, 8.5, 18.0, 0.44f, 0.64f)
            "pencil_sketch", "chalk_write", "marker_swipe", "fabric_brush", "frosted_brush" ->
                writeSilkyWhoosh(0.24, 1400.0, 5200.0, 900.0, 0.45, 0.20f, 0.0, 0.14f)
            "counter_tick", "dial_notch", "clock_tick", "haptic_tick" ->
                writeTapticImpulse(0.024, 520.0, 180.0, 195.0, 4200.0, 1100.0, 0.58f, 0.09f)
            "chart_rise", "power_up", "toggle_on" -> writeTapticImpulse(0.14, 240.0, 680.0, 18.0, 2400.0, 320.0, 0.24f, 0.32f)
            "power_down", "toggle_off" -> writeTapticImpulse(0.16, 620.0, 200.0, 18.0, 2200.0, 260.0, 0.24f, 0.30f)
            "stamp_hit", "metal_slam", "trailer_hit" -> {
                writeTapticImpulse(0.22, 180.0, 48.0, 16.0, 1800.0, 120.0, 0.65f, 0.38f)
                writeModalTap(260.0, 2.42, 0.38, 12.0, 26.0, 0.42f, 0.45f)
            }
            "marimba_up" -> writeAcousticPluck(doubleArrayOf(523.25, 659.25), 0.55, 0.055, 0.26f, 0.994f, 0.72f, 0.46f)
            "marimba_down" -> writeAcousticPluck(doubleArrayOf(659.25, 523.25), 0.55, 0.055, 0.26f, 0.994f, 0.72f, 0.46f)

            // --- v2.0 LIQUID GLASS & MICRO-UI ---
            "glass_clink", "prism_ping", "ice_chime", "ceramic_clink" ->
                writeModalTap(1760.0, 1.505, 0.56, 8.2, 16.5, 0.42f, 0.62f)
            "crystal_tap" -> writeModalTap(1396.9, 2.0, 0.34, 14.0, 28.0, 0.44f, 0.48f)
            "mech_key_click" -> writeTapticImpulse(0.032, 420.0, 130.0, 150.0, 4600.0, 1250.0, 0.72f, 0.11f)
            "lens_focus", "drawer_open", "drawer_close" ->
                writeSilkyWhoosh(0.28, 380.0, 2400.0, 240.0, 0.36, 0.35f, 90.0, 0.32f)

            // --- v2.0 CINEMA, FOLEY & ACOUSTIC ---
            "silk_swoosh" -> writeSilkyWhoosh(0.54, 150.0, 1650.0, 95.0, 0.42, 0.48f, 62.0, 0.52f)
            "whip_pan" -> writeSilkyWhoosh(0.26, 260.0, 3200.0, 150.0, 0.28, 0.62f, 88.0, 0.34f)
            "tension_riser", "reverse_cymbal" -> writeSilkyWhoosh(1.25, 220.0, 4400.0, 180.0, 0.90, 0.32f, 52.0, 0.68f)
            "impact_thud", "braam_low", "heartbeat_sub" -> {
                val n = (0.72 * SAMPLE_RATE).toInt()
                var ph = 0.0
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val f = (38.0 + 72.0 * exp(-t * 14.0)) * pitch
                    ph += TWO_PI * f / SAMPLE_RATE
                    val env = min(1.0, t / 0.005) * exp(-t * 3.8)
                    val s = (sin(ph) * 0.85 + sin(ph * 1.5) * 0.25).toFloat() * env.toFloat() * 0.85f
                    addStereo(dry, rev, totalFrames, start + i, s * gL, s * gR, 0.50f)
                }
            }
            "glitch_burst", "zipper_fast", "match_strike", "fire_crackle" -> {
                val n = (0.18 * SAMPLE_RATE).toInt()
                val f = SilkyAirFilter()
                for (i in 0 until n) {
                    val t = i.toDouble() / SAMPLE_RATE
                    val gate = if (((i / 380) % 2) == 0) 1f else 0.18f
                    val env = exp(-t * 14.0).toFloat() * gate
                    val s = f.step(rng.nextWhite(), 4600.0 * pitch, 650.0) * env * 0.72f
                    addStereo(dry, rev, totalFrames, start + i, s * gL, s * gR, 0.22f)
                }
            }
            "soil_crunch", "leaf_rustle", "footstep_gravel", "soft_wind_gust" ->
                writeSilkyWhoosh(0.36, 480.0, 2900.0, 280.0, 0.34, 0.26f, 0.0, 0.24f)
            "stone_clack", "footstep_wood", "coin_spin" ->
                writeModalTap(if (sfx == "coin_spin") 2480.0 else 580.0, 2.34, 0.24, 16.0, 34.0, 0.48f, 0.30f)
            "rain_plip", "stream_splash" ->
                writeTapticImpulse(0.11, 480.0, 1320.0, 26.0, 3200.0, 420.0, 0.35f, 0.42f)
            "harp_gliss", "piano_warm", "piano_high", "cello_swell", "guitar_harmonic", "chord_resolve" -> {
                val chord = when (sfx) {
                    "piano_high" -> doubleArrayOf(523.25, 659.25, 783.99, 1046.5)
                    "cello_swell" -> doubleArrayOf(130.81, 196.00, 261.63)
                    "guitar_harmonic" -> doubleArrayOf(440.0, 659.25, 880.0)
                    else -> doubleArrayOf(261.63, 329.63, 392.00, 523.25, 659.25)
                }
                writeAcousticPluck(chord, 1.35, 0.035, 0.28f, 0.9975f, 0.56f, 0.80f)
            }
            else -> writeTapticImpulse(0.055, 190.0, 68.0, 72.0, 1400.0, 240.0, 0.32f, 0.14f)
        }
    }

    // =========================================================================
    // EVOLVING MUSICAL AMBIENCE BEDS (15 BEDS — SMOOTH 4-CHORD PROGRESSIONS)
    // =========================================================================
    private fun renderAmbience(
        dry: FloatArray,
        rev: FloatArray,
        totalFrames: Int,
        durSec: Double,
        type: String,
        vol: Float,
        rng: FastRng
    ) {
        val fadeIn = min(0.55, durSec * 0.16)
        val fadeOut = min(0.80, durSec * 0.22)
        val padLpL = SilkyAirFilter(); val padLpR = SilkyAirFilter()
        val airL = SilkyAirFilter(); val airR = SilkyAirFilter()

        // 4-chord progressions (each bar = 2.4s with smooth 0.55s overlap crossfade)
        val prog: Array<DoubleArray> = when (type) {
            "dark_cinema", "deep_space" -> arrayOf(
                doubleArrayOf(55.00, 82.41, 110.00, 164.81),
                doubleArrayOf(49.00, 73.42, 98.00, 146.83),
                doubleArrayOf(43.65, 65.41, 87.31, 130.81),
                doubleArrayOf(49.00, 73.42, 98.00, 164.81)
            )
            "lofi_garden", "acoustic_studio" -> arrayOf(
                doubleArrayOf(130.81, 164.81, 196.00, 246.94),
                doubleArrayOf(110.00, 164.81, 196.00, 261.63),
                doubleArrayOf(87.31, 130.81, 164.81, 220.00),
                doubleArrayOf(98.00, 146.83, 196.00, 246.94)
            )
            "documentary_pulse", "tech_minimal" -> arrayOf(
                doubleArrayOf(146.83, 220.00, 293.66, 329.63),
                doubleArrayOf(123.47, 185.00, 246.94, 293.66),
                doubleArrayOf(98.00, 146.83, 196.00, 246.94),
                doubleArrayOf(110.00, 164.81, 220.00, 277.18)
            )
            "ios_glass_chimes", "warm_editorial_hum" -> arrayOf(
                doubleArrayOf(196.00, 246.94, 293.66, 369.99),
                doubleArrayOf(164.81, 246.94, 293.66, 392.00),
                doubleArrayOf(130.81, 196.00, 246.94, 293.66),
                doubleArrayOf(146.83, 220.00, 293.66, 369.99)
            )
            "room_tone", "soft_wind", "soil_nature", "night_rain" -> arrayOf(
                doubleArrayOf(65.41, 98.00, 130.81, 196.00),
                doubleArrayOf(65.41, 98.00, 146.83, 196.00),
                doubleArrayOf(65.41, 98.00, 130.81, 164.81),
                doubleArrayOf(65.41, 98.00, 130.81, 196.00)
            )
            else -> arrayOf(
                doubleArrayOf(130.81, 196.00, 246.94, 293.66),
                doubleArrayOf(110.00, 164.81, 246.94, 261.63),
                doubleArrayOf(87.31, 130.81, 196.00, 220.00),
                doubleArrayOf(98.00, 146.83, 196.00, 246.94)
            )
        }

        val barSec = 2.4
        var subPh = 0.0

        if (type == "documentary_pulse" || type == "lofi_garden" || type == "tech_minimal" || type == "acoustic_studio") {
            val bpm = if (type == "documentary_pulse") 106.0 else 86.0
            val stepSec = 60.0 / bpm / 2.0
            var stepT = 0.15
            var stepIdx = 0
            while (stepT < durSec - 0.5) {
                val bar = ((stepT / barSec).toInt()) % prog.size
                val chord = prog[bar]
                val noteHz = chord[stepIdx % chord.size] * (if (type == "documentary_pulse") 2.0 else 1.0)
                val sf = (stepT * SAMPLE_RATE).toInt()
                val noteRng = FastRng(stepIdx * 97 + type.hashCode())
                val voice = KarplusVoice(noteHz, if (type == "documentary_pulse") 0.22f else 0.18f, 0.994f, noteRng)
                val noteFrames = (0.38 * SAMPLE_RATE).toInt()
                val noteGain = vol * (if (stepIdx % 2 == 0) 0.26f else 0.16f)
                val panSide = if (stepIdx % 2 == 0) 0.85f else 1.15f
                for (k in 0 until noteFrames) {
                    val dt = k.toDouble() / SAMPLE_RATE
                    val env = min(1.0, dt / 0.008) * exp(-dt * 6.5)
                    val s = voice.step() * env.toFloat() * noteGain
                    addStereo(dry, rev, totalFrames, sf + k, s * panSide, s * (2f - panSide), 0.52f)
                }
                stepT += stepSec
                stepIdx++
            }
        }

        for (i in 0 until totalFrames) {
            val t = i.toDouble() / SAMPLE_RATE
            val eIn = if (t < fadeIn) (t / fadeIn).pow(1.4) else 1.0
            val eOut = if (t > durSec - fadeOut) max(0.0, (durSec - t) / fadeOut).pow(1.4) else 1.0
            val env = (eIn * eOut).toFloat() * vol * 0.72f

            val barFloat = t / barSec
            val barIdx = barFloat.toInt() % prog.size
            val nextIdx = (barIdx + 1) % prog.size
            val barPos = barFloat - barFloat.toInt()
            val xfade = if (barPos > 0.76) ((barPos - 0.76) / 0.24).coerceIn(0.0, 1.0) else 0.0
            val wA = cos(xfade * PI * 0.5).toFloat()
            val wB = sin(xfade * PI * 0.5).toFloat()

            var l = 0f; var r = 0f
            val cA = prog[barIdx]; val cB = prog[nextIdx]
            for (k in cA.indices) {
                val wk = 0.22f / (1f + k * 0.25f)
                val fA = cA[k]; val fB = cB[k]
                val sAL = (sin(TWO_PI * fA * t) + sin(TWO_PI * fA * 2.0 * t) * 0.12).toFloat()
                val sAR = (sin(TWO_PI * fA * 1.0024 * t + 0.5) + sin(TWO_PI * fA * 2.0048 * t) * 0.12).toFloat()
                val sBL = if (xfade > 0.001) (sin(TWO_PI * fB * t) + sin(TWO_PI * fB * 2.0 * t) * 0.12).toFloat() else 0f
                val sBR = if (xfade > 0.001) (sin(TWO_PI * fB * 1.0024 * t + 0.5) + sin(TWO_PI * fB * 2.0048 * t) * 0.12).toFloat() else 0f
                l += (sAL * wA + sBL * wB) * wk
                r += (sAR * wA + sBR * wB) * wk
            }

            val cut = when (type) {
                "dark_cinema" -> 260.0 + 110.0 * sin(TWO_PI * 0.12 * t)
                "ios_glass_chimes" -> 1100.0 + 320.0 * sin(TWO_PI * 0.16 * t)
                else -> 640.0 + 220.0 * sin(TWO_PI * 0.14 * t)
            }
            l = padLpL.step(l, cut, 40.0)
            r = padLpR.step(r, cut, 40.0)

            when (type) {
                "botanical_air", "forest_air" -> {
                    val br = 0.45f + 0.55f * sin(TWO_PI * 0.14 * t).toFloat()
                    l += airL.step(rng.nextPink(), 540.0 + 240.0 * br, 160.0) * 0.20f * br
                    r += airR.step(rng.nextPink(), 580.0 + 240.0 * br, 160.0) * 0.20f * br
                }
                "lofi_garden" -> {
                    val dust = airL.step(rng.nextPink(), 2600.0, 900.0) * 0.035f
                    l += dust; r += dust
                }
                "keynote_pulse", "apple_keynote_minimal", "minimal_pulse" -> {
                    val bpm = if (type == "minimal_pulse") 108.0 else 112.0
                    val pos = (t * bpm / 60.0) % 1.0
                    val kEnv = exp(-pos * 13.0).toFloat()
                    subPh += TWO_PI * (50.0 + 24.0 * exp(-pos * 28.0)) / SAMPLE_RATE
                    val sub = sin(subPh).toFloat() * kEnv * 0.28f
                    l = l * 0.74f + sub; r = r * 0.74f + sub
                }
                "dark_cinema" -> {
                    subPh += TWO_PI * 41.2 / SAMPLE_RATE
                    val sub = sin(subPh).toFloat() * 0.22f
                    l += sub; r += sub
                }
            }
            addStereo(dry, rev, totalFrames, i, l * env, r * env, 0.58f)
        }
    }

    // =========================================================================
    // WAV PARSER, EXTERNAL AUDIO DECODER & MASTERING BUS
    // =========================================================================
    private fun parseWav(bytes: ByteArray): WavSample? {
        if (bytes.size < 44) return null
        fun str4(off: Int) = String(bytes, off, 4, Charsets.US_ASCII)
        fun u16(off: Int) = (bytes[off].toInt() and 0xFF) or ((bytes[off + 1].toInt() and 0xFF) shl 8)
        fun u32(off: Int) = (bytes[off].toInt() and 0xFF) or
            ((bytes[off + 1].toInt() and 0xFF) shl 8) or
            ((bytes[off + 2].toInt() and 0xFF) shl 16) or
            ((bytes[off + 3].toInt() and 0xFF) shl 24)
        if (str4(0) != "RIFF" || str4(8) != "WAVE") return null

        var channels = 2; var sampleRate = SAMPLE_RATE; var bits = 16
        var dataOffset = -1; var dataSize = 0; var off = 12
        while (off + 8 <= bytes.size) {
            val id = str4(off); val sz = u32(off + 4).coerceAtLeast(0); val body = off + 8
            if (body + sz > bytes.size && id != "data") break
            if (id == "fmt " && sz >= 16) {
                channels = u16(body + 2).coerceIn(1, 2)
                sampleRate = u32(body + 4).coerceIn(8000, 96000)
                bits = u16(body + 14)
            } else if (id == "data") {
                dataOffset = body; dataSize = min(sz, bytes.size - body); break
            }
            off = body + ((sz + 1) and 1.inv())
        }
        if (dataOffset < 0 || dataSize < 4 || bits != 16) return null
        val frames = dataSize / (channels * 2)
        val stereo = FloatArray(frames * 2)
        var p = dataOffset
        for (i in 0 until frames) {
            val s0 = ((bytes[p].toInt() and 0xFF) or (bytes[p + 1].toInt() shl 8)).toShort() / 32768f; p += 2
            val s1 = if (channels == 2) {
                val v = ((bytes[p].toInt() and 0xFF) or (bytes[p + 1].toInt() shl 8)).toShort() / 32768f; p += 2; v
            } else s0
            stereo[i * 2] = s0; stereo[i * 2 + 1] = s1
        }
        return WavSample(sampleRate, frames, stereo)
    }

    private fun mixWavSample(
        dry: FloatArray, rev: FloatArray, totalFrames: Int, startFrame: Int,
        wav: WavSample, gain: Float, pitch: Float, pan: Float, revSendAmt: Float
    ) {
        val gL = gain * (1f - max(0f, pan)); val gR = gain * (1f + min(0f, pan))
        val step = (wav.sampleRate.toDouble() / SAMPLE_RATE.toDouble()) * pitch.toDouble().coerceIn(0.4, 2.5)
        var pos = 0.0; var outIdx = startFrame; val maxPos = (wav.frames - 1).toDouble()
        while (pos < maxPos && outIdx < totalFrames) {
            val i0 = pos.toInt(); val frac = (pos - i0).toFloat()
            val b0 = i0 * 2; val b1 = (i0 + 1) * 2
            val l = (wav.stereo[b0] + (wav.stereo[b1] - wav.stereo[b0]) * frac) * gL
            val r = (wav.stereo[b0 + 1] + (wav.stereo[b1 + 1] - wav.stereo[b0 + 1]) * frac) * gR
            addStereo(dry, rev, totalFrames, outIdx, l, r, revSendAmt)
            pos += step; outIdx++
        }
    }

    /** Decodes any user audio file (MP3/WAV/M4A/OGG), trims silence & normalizes to 16-bit Stereo PCM */
    fun decodeAudioUriToNormalizedPcm16(context: Context, uriString: String, maxSeconds: Double = 4.0): ByteArray? {
        val maxFrames = (maxSeconds * SAMPLE_RATE).toInt()
        val raw = decodeAudioUri(context, uriString, maxFrames) ?: return null
        val total = raw.size / 2
        var first = 0
        while (first < total && max(abs(raw[first * 2]), abs(raw[first * 2 + 1])) < 0.008f) first++
        var last = total - 1
        while (last > first && max(abs(raw[last * 2]), abs(raw[last * 2 + 1])) < 0.004f) last--
        val trimmedFrames = (last - first + 1).coerceAtLeast(1)
        if (trimmedFrames < 400) return null

        var peak = 0.001f
        for (i in first..last) {
            peak = max(peak, max(abs(raw[i * 2]), abs(raw[i * 2 + 1])))
        }
        val norm = (0.86f / peak).coerceAtMost(4.0f)
        val fadeIn = min(220, trimmedFrames / 6)
        val fadeOut = min(1100, trimmedFrames / 4)
        val pcm = ByteArray(trimmedFrames * 4)
        var bIdx = 0
        for (k in 0 until trimmedFrames) {
            val env = when {
                k < fadeIn -> k.toFloat() / fadeIn
                k > trimmedFrames - fadeOut -> (trimmedFrames - k).toFloat() / fadeOut
                else -> 1f
            }
            val src = (first + k) * 2
            val sL = (raw[src] * norm * env).coerceIn(-0.98f, 0.98f)
            val sR = (raw[src + 1] * norm * env).coerceIn(-0.98f, 0.98f)
            val vL = (sL * 32767f).toInt().toShort()
            val vR = (sR * 32767f).toInt().toShort()
            pcm[bIdx++] = (vL.toInt() and 0xFF).toByte()
            pcm[bIdx++] = ((vL.toInt() shr 8) and 0xFF).toByte()
            pcm[bIdx++] = (vR.toInt() and 0xFF).toByte()
            pcm[bIdx++] = ((vR.toInt() shr 8) and 0xFF).toByte()
        }
        return pcm
    }

    private fun decodeAudioUri(context: Context, uriString: String, totalFrames: Int): FloatArray? {
        val pfd = context.contentResolver.openFileDescriptor(Uri.parse(uriString), "r") ?: return null
        val outMix = FloatArray(totalFrames * CHANNELS)
        pfd.use { fd ->
            val extractor = MediaExtractor()
            var codec: MediaCodec? = null
            try {
                extractor.setDataSource(fd.fileDescriptor)
                var audioTrack = -1; var format: MediaFormat? = null
                for (i in 0 until extractor.trackCount) {
                    val f = extractor.getTrackFormat(i)
                    val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
                    if (mime.startsWith("audio/")) { audioTrack = i; format = f; break }
                }
                if (audioTrack < 0 || format == null) return null
                extractor.selectTrack(audioTrack)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: return null
                var srcRate = if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) format.getInteger(MediaFormat.KEY_SAMPLE_RATE) else SAMPLE_RATE
                var srcCh = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 2

                val dec = MediaCodec.createDecoderByType(mime)
                codec = dec; dec.configure(format, null, null, 0); dec.start()

                val info = MediaCodec.BufferInfo()
                var inputDone = false; var outputDone = false
                var srcIdx = 0L; var dstIdx = 0; var readPos = 0.0; var prevL = 0f; var prevR = 0f

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
                                outBuf.position(info.offset); outBuf.limit(info.offset + info.size)
                                val sb = outBuf.order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
                                val step = srcRate.toDouble() / SAMPLE_RATE.toDouble()
                                val chCount = srcCh.coerceAtLeast(1)
                                val framesInChunk = sb.remaining() / chCount
                                for (k in 0 until framesInChunk) {
                                    val cL = sb.get() / 32768f
                                    val cR = if (chCount >= 2) sb.get() / 32768f else cL
                                    for (skip in 2 until chCount) sb.get()
                                    if (srcIdx == 0L) { prevL = cL; prevR = cR }
                                    else {
                                        while (dstIdx < totalFrames && readPos <= srcIdx.toDouble()) {
                                            val frac = (readPos - (srcIdx - 1L)).toFloat().coerceIn(0f, 1f)
                                            outMix[dstIdx * 2] = prevL + (cL - prevL) * frac
                                            outMix[dstIdx * 2 + 1] = prevR + (cR - prevR) * frac
                                            dstIdx++; readPos += step
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
        dry: FloatArray, revSend: FloatArray, voiceover: FloatArray?,
        totalFrames: Int, voGain: Float, edgeFade: Boolean
    ): ByteArray {
        val combsL = arrayOf(DampedComb(1557, 0.77f, 0.38f), DampedComb(1617, 0.76f, 0.40f), DampedComb(1491, 0.75f, 0.38f), DampedComb(1422, 0.74f, 0.42f))
        val combsR = arrayOf(DampedComb(1580, 0.77f, 0.38f), DampedComb(1640, 0.76f, 0.40f), DampedComb(1514, 0.75f, 0.38f), DampedComb(1445, 0.74f, 0.42f))
        val apL1 = Allpass(225); val apL2 = Allpass(556)
        val apR1 = Allpass(248); val apR2 = Allpass(579)

        val pcm = ByteArray(totalFrames * CHANNELS * 2)
        val fadeInSamp = if (edgeFade) (0.018 * SAMPLE_RATE).toInt() else 1
        val fadeOutSamp = if (edgeFade) (0.045 * SAMPLE_RATE).toInt() else 1
        var dcL = 0f; var dcR = 0f; var prevInL = 0f; var prevInR = 0f
        var byteIdx = 0

        for (i in 0 until totalFrames) {
            val idx2 = i * CHANNELS
            val inL = revSend[idx2]; val inR = revSend[idx2 + 1]
            var wetL = 0f; var wetR = 0f
            for (c in 0 until 4) {
                wetL += combsL[c].process(inL); wetR += combsR[c].process(inR)
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

            val mixL = (dry[idx2] + wetL * 0.30f + voL) * env
            val mixR = (dry[idx2 + 1] + wetR * 0.30f + voR) * env
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
