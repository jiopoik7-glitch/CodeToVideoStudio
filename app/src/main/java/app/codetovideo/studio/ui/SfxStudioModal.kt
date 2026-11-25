package app.codetovideo.studio.ui

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.OpenDocument
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.codetovideo.studio.MainActivity
import app.codetovideo.studio.core.AudioCue
import app.codetovideo.studio.render.AudioAuditionPlayer
import app.codetovideo.studio.render.CustomSfxRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

private data class SfxEntry(val id: String, val desc: String)

private enum class SfxCat(val title: String) {
    TRANSITIONS("Transisi"),
    UI_FOLEY("UI & Foley"),
    ACOUSTIC("Akustik"),
    CINEMA("Cinema"),
    AMBIENCE("Ambience")
}

private val SFX_CATALOG: Map<SfxCat, List<SfxEntry>> = mapOf(
    SfxCat.TRANSITIONS to listOf(
        SfxEntry("air_whoosh", "Angin sinematik halus (Doppler)"),
        SfxEntry("swoosh_soft", "Hembusan transisi super lembut"),
        SfxEntry("whip", "Whip-pan cepat & tajam"),
        SfxEntry("glass_slide", "Geseran kaca halus"),
        SfxEntry("paper_slide", "Geseran kertas editorial"),
        SfxEntry("swoosh_deep", "Transisi udara rendah & dalam"),
        SfxEntry("liquid_morph", "Transisi cair lembut"),
        SfxEntry("page_flip", "Balik halaman singkat")
    ),
    SfxCat.UI_FOLEY to listOf(
        SfxEntry("taptic_thock", "Pop bulat lembut ala iOS Taptic"),
        SfxEntry("tactile_tick", "Detik mekanik dial halus"),
        SfxEntry("glass_tap", "Ketukan kaca frosted singkat"),
        SfxEntry("wood_tap", "Ketukan kayu akustik hangat"),
        SfxEntry("water_drop", "Satu tetes embun bersih"),
        SfxEntry("bubble", "Gelembung air organik"),
        SfxEntry("click", "Klik antarmuka rapat"),
        SfxEntry("snap", "Jentikan fokus tajam"),
        SfxEntry("shutter", "Rana kamera klasik"),
        SfxEntry("type_key", "Ketikan mikro lembut")
    ),
    SfxCat.ACOUSTIC to listOf(
        SfxEntry("felt_pluck", "Petikan piano felt hangat"),
        SfxEntry("kalimba_note", "Nada kalimba organik"),
        SfxEntry("chime", "Akor harpa penutup halus"),
        SfxEntry("crystal_bloom", "Swell Cmaj9 lebar & hangat"),
        SfxEntry("glass_shimmer", "Kilau harmonik lembut"),
        SfxEntry("ding", "Aksen dua nada bersih")
    ),
    SfxCat.CINEMA to listOf(
        SfxEntry("cinema_boom", "Dentuman sub sinematik"),
        SfxEntry("sub_drop", "Jatuhan bass dalam"),
        SfxEntry("thud", "Hentakan berat singkat"),
        SfxEntry("riser", "Sapuan naik menuju klimaks"),
        SfxEntry("tape_stop", "Efek pita berhenti")
    ),
    SfxCat.AMBIENCE to listOf(
        SfxEntry("keynote_pulse", "Akor hangat berjalan + denyut lembut"),
        SfxEntry("documentary_pulse", "Petikan ritmis ala Vox / edukasi"),
        SfxEntry("botanical_air", "Angin halus + harmoni organik"),
        SfxEntry("lofi_garden", "Rhodes santai + tekstur hangat"),
        SfxEntry("ios_glass_chimes", "Pad kaca kristalin ala Keynote"),
        SfxEntry("warm_pad", "Pad Cmaj9 hangat serbaguna"),
        SfxEntry("dark_cinema", "Sub drone gelap sinematik")
    )
)

@Composable
fun SfxStudioManagerDialog(
    activity: MainActivity,
    isLight: Boolean,
    onDismiss: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    var selectedCat by remember { mutableStateOf(SfxCat.TRANSITIONS) }
    var importTargetSlot by remember { mutableStateOf<String?>(null) }
    var customRefresh by remember { mutableIntStateOf(0) }
    val customSlots = remember(customRefresh) { CustomSfxRepository.listCustomSlots(activity) }

    val bgDialog = if (isLight) Color(0xFFF4F7FC) else Color(0xFF141A25)
    val cardBg = if (isLight) Color(0xD8FFFFFF) else Color(0x1EFFFFFF)
    val borderCol = if (isLight) Color(0x341D3557) else Color(0x34FFFFFF)
    val txtPrimary = if (isLight) Color(0xFF0E141D) else Color(0xFFF6F8FB)
    val txtSecondary = if (isLight) Color(0xFF516075) else Color(0xFFA2B0C4)
    val accentBlue = if (isLight) Color(0xFF007AFF) else Color(0xFF4AA3FF)
    val accentGreen = if (isLight) Color(0xFF28A745) else Color(0xFF32D74B)

    val pickCustomSfx = rememberLauncherForActivityResult(OpenDocument()) { uri: Uri? ->
        val slot = importTargetSlot
        importTargetSlot = null
        if (uri != null && slot != null) {
            scope.launch {
                val res = withContext(Dispatchers.IO) { runCatching { CustomSfxRepository.importFromUri(activity, uri, slot) } }
                res.onSuccess {
                    customRefresh++
                    Toast.makeText(activity, "SFX '$slot' diganti dengan audio kamu!", Toast.LENGTH_SHORT).show()
                    AudioAuditionPlayer.play(activity, slot)
                }.onFailure { err ->
                    Toast.makeText(activity, err.message ?: "Gagal impor SFX", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = {
            AudioAuditionPlayer.stop()
            onDismiss()
        },
        containerColor = bgDialog,
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("SFX Studio Manager v0.7", color = txtPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(
                    "Mesin akustik baru + bisa impor MP3/WAV sendiri per slot",
                    color = txtSecondary, fontSize = 11.sp
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Category Tabs
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    SfxCat.entries.forEach { cat ->
                        val active = cat == selectedCat
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (active) accentBlue else cardBg)
                                .border(1.dp, if (active) accentBlue else borderCol, RoundedCornerShape(50))
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    selectedCat = cat
                                }
                                .padding(horizontal = 11.dp, vertical = 6.dp)
                        ) {
                            Text(
                                cat.title,
                                color = if (active) Color.White else txtPrimary,
                                fontSize = 11.sp,
                                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium
                            )
                        }
                    }
                }

                // List of SFX or Ambience
                Column(
                    modifier = Modifier.height(330.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    val items = SFX_CATALOG[selectedCat].orEmpty()
                    items.forEach { entry ->
                        val isCustom = selectedCat != SfxCat.AMBIENCE && customSlots.contains(entry.id)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(cardBg)
                                .border(1.dp, if (isCustom) accentGreen else borderCol, RoundedCornerShape(14.dp))
                                .padding(horizontal = 11.dp, vertical = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Play Button
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(accentBlue.copy(alpha = 0.16f))
                                    .border(1.dp, accentBlue.copy(alpha = 0.45f), RoundedCornerShape(50))
                                    .clickable {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        if (selectedCat == SfxCat.AMBIENCE) AudioAuditionPlayer.playAmbience(entry.id)
                                        else AudioAuditionPlayer.play(activity, entry.id)
                                    }
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text("▶", color = accentBlue, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }

                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Text(entry.id, color = txtPrimary, fontSize = 11.5.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    if (isCustom) {
                                        Text("CUSTOM", color = accentGreen, fontSize = 8.5.sp, fontWeight = FontWeight.ExtraBold)
                                    }
                                }
                                Text(entry.desc, color = txtSecondary, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }

                            if (selectedCat != SfxCat.AMBIENCE) {
                                if (isCustom) {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(50))
                                            .background(Color(0x22FF453A))
                                            .clickable {
                                                CustomSfxRepository.deleteCustom(activity, entry.id)
                                                customRefresh++
                                                Toast.makeText(activity, "Kembali ke bawaan studio", Toast.LENGTH_SHORT).show()
                                            }
                                            .padding(horizontal = 8.dp, vertical = 5.dp)
                                    ) {
                                        Text("Reset", color = Color(0xFFFF5E57), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                } else {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(50))
                                            .background(cardBg)
                                            .border(1.dp, borderCol, RoundedCornerShape(50))
                                            .clickable {
                                                importTargetSlot = entry.id
                                                pickCustomSfx.launch(arrayOf("audio/*"))
                                            }
                                            .padding(horizontal = 8.dp, vertical = 5.dp)
                                    ) {
                                        Text("+ Impor", color = txtPrimary, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TextButton(onClick = { AudioAuditionPlayer.stop() }) {
                    Text("Stop", color = txtSecondary)
                }
                TextButton(onClick = { AudioAuditionPlayer.stop(); onDismiss() }) {
                    Text("Selesai", color = accentBlue, fontWeight = FontWeight.Bold)
                }
            }
        }
    )
}

@Composable
fun AudioCueTimelineStrip(
    activity: MainActivity,
    cues: List<AudioCue>,
    durationSeconds: Int,
    isLight: Boolean
) {
    val haptic = LocalHapticFeedback.current
    val wellBg = if (isLight) Color(0xADFFFFFF) else Color(0x6605070C)
    val borderCol = if (isLight) Color(0x341D3557) else Color(0x2892C5FF)
    val txtPrimary = if (isLight) Color(0xFF0E141D) else Color(0xFFF6F8FB)
    val txtSecondary = if (isLight) Color(0xFF516075) else Color(0xFF9AA8BC)
    val accentBlue = if (isLight) Color(0xFF007AFF) else Color(0xFF4AA3FF)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(wellBg)
            .border(1.dp, borderCol, RoundedCornerShape(14.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(
            "TIMELINE CUE PROYEK (${cues.size}) · KETUK UNTUK TES",
            color = txtSecondary,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.6.sp
        )
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            cues.forEach { cue ->
                val sec = if (cue.atProgress != null) cue.atProgress * durationSeconds.toDouble() else cue.atSeconds
                val timeLabel = String.format(Locale.US, "%.2fs", sec)
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(accentBlue.copy(alpha = 0.12f))
                        .border(1.dp, accentBlue.copy(alpha = 0.35f), RoundedCornerShape(50))
                        .clickable {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            AudioAuditionPlayer.play(activity, cue.sfx, cue.pitch)
                        }
                        .padding(horizontal = 9.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("▶ ", color = accentBlue, fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
                    Text(timeLabel, color = accentBlue, fontSize = 9.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.width(5.dp))
                    Text(cue.sfx, color = txtPrimary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                }
            }
        }
    }
}
