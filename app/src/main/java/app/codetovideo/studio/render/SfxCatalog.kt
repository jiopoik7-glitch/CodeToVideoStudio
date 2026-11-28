package app.codetovideo.studio.render

enum class SfxCategory(val title: String) {
    EXPLAINER_POP("Explainer & Pop"),
    LIQUID_GLASS("Liquid Glass & UI"),
    CINEMA_TRANSITION("Cinema & Transisi"),
    FOLEY_NATURE("Foley & Alam"),
    ACOUSTIC_MELODIC("Akustik & Nada"),
    AMBIENCE_BEDS("Ambience Beds")
}

data class SfxEntry(
    val id: String,
    val desc: String,
    val category: SfxCategory,
    val isImpact: Boolean = false,
    val isAmbience: Boolean = false
)

/**
 * Studio Sound Engine v2.0 Catalog: 108 Studio SFX + 15 Ambience Beds (123 total).
 * All IDs work 100% offline via bundled core WAVs + physical-modeling DSP,
 * and every slot supports user MP3/WAV custom overrides.
 */
object SfxCatalog {
    val ALL: List<SfxEntry> = listOf(
        // --- 1. EXPLAINER & CARTOON POP (26) ---
        SfxEntry("bubble_pop", "Gelembung pop bersih untuk ikon/bullet", SfxCategory.EXPLAINER_POP),
        SfxEntry("soft_boing", "Pantulan elastis lembut (squash & stretch)", SfxCategory.EXPLAINER_POP),
        SfxEntry("checklist_ding", "Centang selesai dua nada cerah", SfxCategory.EXPLAINER_POP),
        SfxEntry("magnifier_whoosh", "Sapuan kaca pembesar zoom-in", SfxCategory.EXPLAINER_POP),
        SfxEntry("paper_flip", "Balik kartu/kertas explainer cepat", SfxCategory.EXPLAINER_POP),
        SfxEntry("sparkle_chime", "Kilau magis penekanan poin penting", SfxCategory.EXPLAINER_POP),
        SfxEntry("pop", "Pop bulat serbaguna", SfxCategory.EXPLAINER_POP),
        SfxEntry("bubble", "Gelembung air organik", SfxCategory.EXPLAINER_POP),
        SfxEntry("boing_high", "Pantulan karakter ceria nada tinggi", SfxCategory.EXPLAINER_POP),
        SfxEntry("boing_low", "Pantulan objek berat nada rendah", SfxCategory.EXPLAINER_POP),
        SfxEntry("comic_zip", "Geseran cepat teks/karakter masuk", SfxCategory.EXPLAINER_POP),
        SfxEntry("bulb_idea", "Lampu ide menyala hangat", SfxCategory.EXPLAINER_POP),
        SfxEntry("pencil_sketch", "Goresan pensil sketsa singkat", SfxCategory.EXPLAINER_POP),
        SfxEntry("marker_swipe", "Sapuan stabilo/highlighter", SfxCategory.EXPLAINER_POP),
        SfxEntry("badge_unlock", "Lencana prestasi terbuka", SfxCategory.EXPLAINER_POP),
        SfxEntry("step_complete", "Langkah checklist selesai", SfxCategory.EXPLAINER_POP),
        SfxEntry("counter_tick", "Detik cepat angka counter naik", SfxCategory.EXPLAINER_POP),
        SfxEntry("chart_rise", "Grafik naik halus", SfxCategory.EXPLAINER_POP),
        SfxEntry("card_flip", "Kartu berbalik mulus", SfxCategory.EXPLAINER_POP),
        SfxEntry("card_deal", "Membagikan kartu cepat", SfxCategory.EXPLAINER_POP),
        SfxEntry("sticky_note", "Menempel catatan kertas", SfxCategory.EXPLAINER_POP),
        SfxEntry("stamp_hit", "Cap stempel tegas", SfxCategory.EXPLAINER_POP, isImpact = true),
        SfxEntry("chalk_write", "Goresan kapur papan tulis", SfxCategory.EXPLAINER_POP),
        SfxEntry("bell_soft", "Lonceng tipis ramah", SfxCategory.EXPLAINER_POP),
        SfxEntry("marimba_up", "Dua nada marimba naik", SfxCategory.EXPLAINER_POP),
        SfxEntry("marimba_down", "Dua nada marimba turun", SfxCategory.EXPLAINER_POP),

        // --- 2. LIQUID GLASS & MICRO-UI (24) ---
        SfxEntry("glass_clink", "Dentingan kaca optik jernih", SfxCategory.LIQUID_GLASS),
        SfxEntry("crystal_tap", "Ketukan kristal halus", SfxCategory.LIQUID_GLASS),
        SfxEntry("mech_key_click", "Klik tombol keyboard mekanik taktil", SfxCategory.LIQUID_GLASS),
        SfxEntry("haptic_tick", "Detik haptic mikro presisi", SfxCategory.LIQUID_GLASS),
        SfxEntry("glass_slide", "Geseran panel kaca buram", SfxCategory.LIQUID_GLASS),
        SfxEntry("taptic_thock", "Pop bulat lembut ala iOS Taptic", SfxCategory.LIQUID_GLASS),
        SfxEntry("tactile_tick", "Detik dial mekanik halus", SfxCategory.LIQUID_GLASS),
        SfxEntry("glass_tap", "Ketukan kaca frosted singkat", SfxCategory.LIQUID_GLASS),
        SfxEntry("click", "Klik antarmuka rapat", SfxCategory.LIQUID_GLASS),
        SfxEntry("type_key", "Ketikan mikro lembut", SfxCategory.LIQUID_GLASS),
        SfxEntry("snap", "Jentikan fokus tajam", SfxCategory.LIQUID_GLASS),
        SfxEntry("glass_shimmer", "Kilau harmonik kaca", SfxCategory.LIQUID_GLASS),
        SfxEntry("crystal_bloom", "Swell Cmaj9 lebar & kristalin", SfxCategory.LIQUID_GLASS),
        SfxEntry("prism_ping", "Ping prisma refraksi halus", SfxCategory.LIQUID_GLASS),
        SfxEntry("ice_chime", "Dentingan kristal es lembut", SfxCategory.LIQUID_GLASS),
        SfxEntry("lens_focus", "Motor fokus lensa optik", SfxCategory.LIQUID_GLASS),
        SfxEntry("shutter", "Rana kamera klasik", SfxCategory.LIQUID_GLASS),
        SfxEntry("camera_focus", "Kunci fokus kamera cepat", SfxCategory.LIQUID_GLASS),
        SfxEntry("dial_notch", "Putaran klik dial presisi", SfxCategory.LIQUID_GLASS),
        SfxEntry("toggle_on", "Saklar aktif naik", SfxCategory.LIQUID_GLASS),
        SfxEntry("toggle_off", "Saklar nonaktif turun", SfxCategory.LIQUID_GLASS),
        SfxEntry("drawer_open", "Panel meluncur terbuka", SfxCategory.LIQUID_GLASS),
        SfxEntry("drawer_close", "Panel meluncur tertutup", SfxCategory.LIQUID_GLASS),
        SfxEntry("frosted_brush", "Sapuan kaca es lembut", SfxCategory.LIQUID_GLASS),

        // --- 3. CINEMA & TRANSITION (24) ---
        SfxEntry("sub_drop", "Jatuhan bass sub sinematik dalam", SfxCategory.CINEMA_TRANSITION, isImpact = true),
        SfxEntry("silk_swoosh", "Sapuan udara sutra sinematik", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("whip_pan", "Transisi kamera whip-pan cepat", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("tension_riser", "Riser ketegangan menuju klimaks", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("impact_thud", "Hentakan berat teredam tajam", SfxCategory.CINEMA_TRANSITION, isImpact = true),
        SfxEntry("tape_stop", "Efek pita berhenti dramatis", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("glitch_burst", "Ledakan glitch digital singkat", SfxCategory.CINEMA_TRANSITION, isImpact = true),
        SfxEntry("cinema_boom", "Dentuman sub trailer bioskop", SfxCategory.CINEMA_TRANSITION, isImpact = true),
        SfxEntry("air_whoosh", "Angin sinematik Doppler", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("whoosh", "Transisi udara standar", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("whip", "Whip-pan tajam", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("swoosh_soft", "Hembusan transisi super lembut", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("swoosh_deep", "Transisi udara rendah & dalam", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("liquid_morph", "Transisi cair organik", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("bass_hit", "Pukulan bass punchy", SfxCategory.CINEMA_TRANSITION, isImpact = true),
        SfxEntry("thud", "Hentakan singkat tegas", SfxCategory.CINEMA_TRANSITION, isImpact = true),
        SfxEntry("riser", "Sapuan naik halus", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("braam_low", "Horn bass trailer rendah", SfxCategory.CINEMA_TRANSITION, isImpact = true),
        SfxEntry("reverse_cymbal", "Simbal terbalik menuju drop", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("trailer_hit", "Benturan dramatis pembuka", SfxCategory.CINEMA_TRANSITION, isImpact = true),
        SfxEntry("metal_slam", "Hentakan logam berat", SfxCategory.CINEMA_TRANSITION, isImpact = true),
        SfxEntry("power_down", "Energi turun perlahan", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("power_up", "Energi menyala cepat", SfxCategory.CINEMA_TRANSITION),
        SfxEntry("warp_sweep", "Sapuan dimensi cepat", SfxCategory.CINEMA_TRANSITION),

        // --- 4. FOLEY & ORGANIC TEXTURES (20) ---
        SfxEntry("water_drop", "Satu tetes embun bersih", SfxCategory.FOLEY_NATURE),
        SfxEntry("soil_crunch", "Tekstur tanah & pasir digali", SfxCategory.FOLEY_NATURE),
        SfxEntry("soft_wind_gust", "Hembusan angin alami lembut", SfxCategory.FOLEY_NATURE),
        SfxEntry("wood_tap", "Ketukan kayu akustik hangat", SfxCategory.FOLEY_NATURE),
        SfxEntry("paper_slide", "Geseran kertas editorial", SfxCategory.FOLEY_NATURE),
        SfxEntry("page_flip", "Balik halaman buku singkat", SfxCategory.FOLEY_NATURE),
        SfxEntry("leaf_rustle", "Gemerisik dedaunan segar", SfxCategory.FOLEY_NATURE),
        SfxEntry("stone_clack", "Benturan batu kecil organik", SfxCategory.FOLEY_NATURE),
        SfxEntry("footstep_gravel", "Langkah kaki di kerikil", SfxCategory.FOLEY_NATURE),
        SfxEntry("footstep_wood", "Langkah kaki di lantai kayu", SfxCategory.FOLEY_NATURE),
        SfxEntry("rain_plip", "Tetes hujan di permukaan air", SfxCategory.FOLEY_NATURE),
        SfxEntry("stream_splash", "Cipratan air jernih singkat", SfxCategory.FOLEY_NATURE),
        SfxEntry("ceramic_clink", "Sentuhan keramik halus", SfxCategory.FOLEY_NATURE),
        SfxEntry("fabric_brush", "Gesekan kain lembut", SfxCategory.FOLEY_NATURE),
        SfxEntry("zipper_fast", "Tarikan ritsleting cepat", SfxCategory.FOLEY_NATURE),
        SfxEntry("coin_spin", "Putaran koin metalik halus", SfxCategory.FOLEY_NATURE),
        SfxEntry("match_strike", "Goresan korek api", SfxCategory.FOLEY_NATURE),
        SfxEntry("fire_crackle", "Letupan kecil api unggun", SfxCategory.FOLEY_NATURE),
        SfxEntry("heartbeat_sub", "Detak jantung rendah dramatis", SfxCategory.FOLEY_NATURE, isImpact = true),
        SfxEntry("clock_tick", "Detak jam dinding akurat", SfxCategory.FOLEY_NATURE),

        // --- 5. ACOUSTIC & MUSICAL ACCENTS (14) ---
        SfxEntry("felt_pluck", "Petikan piano felt hangat", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("kalimba_note", "Nada kalimba organik", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("chime", "Akor harpa penutup halus", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("ding", "Aksen dua nada bersih", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("bloom", "Swell harmoni hangat", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("sparkle", "Arpeggio berkilau tinggi", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("harp_gliss", "Glissando harpa naik elegan", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("piano_warm", "Akor piano hangat sinematik", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("piano_high", "Nada piano atas jernih", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("cello_swell", "Gesekan cello rendah ekspresif", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("guitar_harmonic", "Harmonik gitar akustik bersih", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("celesta_twinkle", "Kilauan celesta dongeng", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("bell_crystal", "Lonceng kristal murni", SfxCategory.ACOUSTIC_MELODIC),
        SfxEntry("chord_resolve", "Akor penutup resolusi mayor", SfxCategory.ACOUSTIC_MELODIC),

        // --- 6. AMBIENCE & MUSIC BEDS (15) ---
        SfxEntry("keynote_pulse", "Akor hangat berjalan + denyut lembut", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("documentary_pulse", "Petikan ritmis ala Vox / edukasi", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("botanical_air", "Angin halus + harmoni organik", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("lofi_garden", "Rhodes santai + tekstur hangat", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("ios_glass_chimes", "Pad kaca kristalin ala Keynote", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("warm_pad", "Pad Cmaj9 hangat serbaguna", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("dark_cinema", "Sub drone gelap sinematik", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("warm_editorial_hum", "Hum editorial hangat untuk narasi", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("room_tone", "Room tone studio natural halus", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("soft_wind", "Angin alam lembut & luas", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("soil_nature", "Tekstur alam bawah tanah & hutan", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("night_rain", "Hujan malam tenang teredam", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("deep_space", "Drone kosmik atmosfer dalam", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("tech_minimal", "Denyut teknologi minimalis bersih", SfxCategory.AMBIENCE_BEDS, isAmbience = true),
        SfxEntry("acoustic_studio", "Harmoni akustik hangat organik", SfxCategory.AMBIENCE_BEDS, isAmbience = true)
    )

    val SFX_ONLY: List<SfxEntry> = ALL.filter { !it.isAmbience }
    val AMBIENCE_ONLY: List<SfxEntry> = ALL.filter { it.isAmbience }
    private val IMPACT_IDS: Set<String> = ALL.filter { it.isImpact }.map { it.id }.toSet()

    fun byCategory(category: SfxCategory): List<SfxEntry> = ALL.filter { it.category == category }

    fun isImpactSfx(sfxId: String): Boolean = sfxId.trim().lowercase() in IMPACT_IDS

    fun compactPromptList(): String = buildString {
        SfxCategory.entries.forEach { cat ->
            val ids = byCategory(cat).joinToString(", ") { it.id }
            appendLine("- **${cat.title}**: $ids")
        }
    }
}
