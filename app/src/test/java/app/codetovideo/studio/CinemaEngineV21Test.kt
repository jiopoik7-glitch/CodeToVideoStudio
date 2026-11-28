package app.codetovideo.studio

import app.codetovideo.studio.ai.MasterPromptV21
import app.codetovideo.studio.core.AudioCue
import app.codetovideo.studio.core.RenderSettings
import app.codetovideo.studio.core.SrtSubtitleParser
import app.codetovideo.studio.core.StudioAudioConfig
import app.codetovideo.studio.core.StudioMetadata
import app.codetovideo.studio.core.StudioProject
import app.codetovideo.studio.core.StudioSubtitleConfig
import app.codetovideo.studio.core.StudioTemplates
import app.codetovideo.studio.core.StudioTemplatesV21
import app.codetovideo.studio.core.SubtitleCue
import app.codetovideo.studio.render.ProceduralAudioEngine
import app.codetovideo.studio.render.SfxCatalog
import app.codetovideo.studio.render.WebCanvasRuntime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CinemaEngineV21Test {

    @Test
    fun sfxCatalog_containsAtLeast100SfxAnd15AmbienceBeds() {
        val sfxList = SfxCatalog.ALL.filter { !it.isAmbience }
        val ambienceList = SfxCatalog.ALL.filter { it.isAmbience }
        assertTrue("Expected >= 100 SFX presets, got ${sfxList.size}", sfxList.size >= 100)
        assertTrue("Expected >= 15 ambience beds, got ${ambienceList.size}", ambienceList.size >= 15)
        assertEquals(sfxList.size + ambienceList.size, SfxCatalog.ALL.size)
        // Unique IDs
        assertEquals(SfxCatalog.ALL.size, SfxCatalog.ALL.map { it.id }.toSet().size)
        // Impact detection for auto-ducking
        assertTrue(SfxCatalog.isImpactSfx("cinema_boom"))
        assertTrue(SfxCatalog.isImpactSfx("bass_hit"))
        assertTrue(SfxCatalog.isImpactSfx("impact_thud"))
        assertFalse(SfxCatalog.isImpactSfx("ui_click"))
    }

    @Test
    fun srtSubtitleParser_parsesStandardSrtAndQuickLinesAndRoundTrips() {
        val srt = """
            1
            00:00:00,250 --> 00:00:02,500
            Selamat datang di Cinema Engine Pro

            2
            00:00:02,600 --> 00:00:05,000
            Render 3D dan Liquid Glass 100% offline!
        """.trimIndent()
        val parsed = SrtSubtitleParser.parse(srt)
        assertEquals(2, parsed.size)
        assertEquals(0.25, parsed[0].start, 0.01)
        assertEquals(2.50, parsed[0].end, 0.01)
        assertEquals("Selamat datang di Cinema Engine Pro", parsed[0].text)

        val formatted = SrtSubtitleParser.formatToSrt(parsed)
        val reparsed = SrtSubtitleParser.parse(formatted)
        assertEquals(parsed.size, reparsed.size)
        assertEquals(parsed[1].text, reparsed[1].text)

        val quick = """
            0.2 - 1.8 : Baris pertama cepat
            2.0 - 4.5 : Baris kedua cepat
        """.trimIndent()
        val quickParsed = SrtSubtitleParser.parse(quick)
        assertEquals(2, quickParsed.size)
        assertEquals(0.2, quickParsed[0].start, 0.01)
        assertEquals("Baris kedua cepat", quickParsed[1].text)
    }

    @Test
    fun proceduralWaveform_computesNormalizedBars() {
        val cfg = StudioAudioConfig(
            ambience = "cinematic_drone",
            ambienceVolume = 0.2f,
            cues = listOf(
                AudioCue(atSeconds = 1.0, atProgress = null, sfx = "cinema_boom", gain = 0.9f),
                AudioCue(atSeconds = 3.5, atProgress = null, sfx = "glass_shimmer", gain = 0.7f)
            )
        )
        val bars = ProceduralAudioEngine.computeTimelineWaveform(durationSeconds = 5, config = cfg, bars = 48)
        assertEquals(48, bars.size)
        assertTrue(bars.all { it in 0f..1f })
        assertTrue("Expected waveform peaks above 0.5", bars.maxOrNull()!! > 0.5f)
    }

    @Test
    fun studioProject_effectiveOverridesAndRenderDimensionsWork() {
        val settings = RenderSettings(longEdge = 1080, aspect = "9:16", fps = 60, durationSeconds = 5, motionBlurSamples = 4, showSafeZone = true)
        assertEquals(608 to 1080, settings.dimensions())
        assertEquals(300, settings.totalFrames())

        val baseMeta = StudioMetadata(
            title = "Test",
            defaultDurationSeconds = 5,
            seed = 1,
            props = emptyList(),
            audio = StudioAudioConfig(ambience = "soft_lofi_pad", cues = listOf(AudioCue(0.5, null, "ui_click"))),
            subtitles = StudioSubtitleConfig(enabled = false, preset = "pill_highlight", cues = emptyList())
        )
        val overrideCues = listOf(AudioCue(1.2, null, "cinema_boom", 0.9f))
        val overrideSubs = StudioSubtitleConfig(
            enabled = true,
            preset = "universe_bold",
            cues = listOf(SubtitleCue(0.0, 2.0, "Hook Viral"))
        )
        val proj = StudioProject(
            renderSettings = settings,
            audioCueOverrides = overrideCues,
            subtitleConfig = overrideSubs
        )
        val effAudio = proj.effectiveAudioConfig(baseMeta)
        assertEquals("soft_lofi_pad", effAudio.ambience)
        assertEquals(1, effAudio.cues.size)
        assertEquals("cinema_boom", effAudio.cues[0].sfx)

        val effSub = proj.effectiveSubtitles(baseMeta)
        assertTrue(effSub.enabled)
        assertEquals("universe_bold", effSub.preset)
        assertEquals(1, effSub.cues.size)
    }

    @Test
    fun smartErrorDebugger_producesIndonesianExplanationAndSnippet() {
        val source = """
            line1();
            const r = -10;
            ctx.arc(100, 100, r, 0, Math.PI * 2);
            line4();
        """.trimIndent()
        val info = WebCanvasRuntime.buildSmartError(
            rawMessage = "IndexSizeError: Failed to execute 'arc' on 'CanvasRenderingContext2D': The radius provided (-10) is negative.",
            line = 3,
            col = 5,
            sourceBody = source
        )
        assertEquals(3, info.lineNumber)
        assertTrue(info.indonesianExplanation.contains("radius", ignoreCase = true))
        assertTrue(info.codeSnippet.contains(">>> 3:"))
    }

    @Test
    fun showcaseTemplatesV21AndV11_andMasterPromptContainRequiredBlocks() {
        val v21Templates = listOf(
            StudioTemplatesV21.EXPLAINER_2D_PRODUCT,
            StudioTemplatesV21.CUTAWAY_2D_SWARM,
            StudioTemplatesV21.DIORAMA_3D_ARCHITECTURE,
            StudioTemplatesV21.LIQUID_GLASS_REFRACTION
        )
        v21Templates.forEach { tpl ->
            assertTrue(tpl.contains("/*<studio-meta>"))
            assertTrue(tpl.contains("</studio-meta>*/"))
            assertTrue(tpl.contains("\"schemaVersion\": 21"))
        }
        // v1.1 templates remain intact
        assertTrue(StudioTemplates.PIXAR_GARDEN_3D.contains("/*<studio-meta>"))
        assertTrue(StudioTemplates.LIQUID_GLASS_SHADER.contains("/*<studio-meta>"))

        val prompt = MasterPromptV21.buildCopyablePrompt()
        listOf("studio3D", "cam3D", "fx.glass", "fx.shader", "rig2D", "world2D", "fx.swarm", "ui.captions", "assets.drawImage", "Plus Jakarta Sans").forEach { token ->
            assertTrue("Master prompt missing $token", prompt.contains(token))
        }
    }

    @Test
    fun adaptivePreviewDimensions_scalesEvenlyAndPreservesAspectRatio() {
        val cases = listOf(
            RenderSettings(longEdge = 1080, aspect = "9:16"),
            RenderSettings(longEdge = 1080, aspect = "16:9"),
            RenderSettings(longEdge = 1080, aspect = "1:1"),
            RenderSettings(longEdge = 1080, aspect = "4:5"),
            RenderSettings(longEdge = 720, aspect = "9:16")
        )
        cases.forEach { settings ->
            val (fullW, fullH) = settings.dimensions()
            val (pw, ph) = WebCanvasRuntime.computePreviewDimensions(fullW, fullH)
            assertTrue("Preview width $pw must be even", pw % 2 == 0)
            assertTrue("Preview height $ph must be even", ph % 2 == 0)
            assertTrue("Preview width $pw must be <= 540", pw <= 540)
            assertTrue("Preview width $pw must be >= 64", pw >= 64)
            assertTrue("Preview height $ph must be >= 64", ph >= 64)
            val fullRatio = fullW.toDouble() / fullH.toDouble()
            val prevRatio = pw.toDouble() / ph.toDouble()
            assertEquals("Aspect ratio drifted for ${settings.aspect}", fullRatio, prevRatio, 0.02)
        }

        val timeoutErr = WebCanvasRuntime.buildSmartError("Render timeout", null, null, "")
        assertFalse(timeoutErr.indonesianExplanation.contains("4.5"))
    }
}
