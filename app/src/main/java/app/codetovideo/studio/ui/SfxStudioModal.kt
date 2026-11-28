package app.codetovideo.studio.ui

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.OpenDocument
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.codetovideo.studio.MainActivity
import app.codetovideo.studio.core.AudioCue
import app.codetovideo.studio.core.StudioAudioConfig
import app.codetovideo.studio.render.AudioAuditionPlayer
import app.codetovideo.studio.render.CustomSfxRepository
import app.codetovideo.studio.render.ProceduralAudioEngine
import app.codetovideo.studio.render.SfxCatalog
import app.codetovideo.studio.render.SfxCategory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale
import kotlin.math.roundToInt

@Composable
fun SfxStudioManagerDialog(
    activity: MainActivity,
    isLight: Boolean,
    onDismiss: () -> Unit,
    onPickSfxId: ((String) -> Unit)? = null
) {
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    var selectedCat by remember { mutableStateOf(SfxCategory.EXPLAINER_POP) }
    var searchQuery by remember { mutableStateOf("") }
    var customTick by remember { mutableIntStateOf(0) }
    var importTargetSlot by remember { mutableStateOf<String?>(null) }
    var importing by remember { mutableStateOf(false) }

    val customSlots = remember(customTick) { CustomSfxRepository.listCustomSlots(activity) }

    val pickCustomSfx = rememberLauncherForActivityResult(OpenDocument()) { uri: Uri? ->
        val slot = importTargetSlot
        importTargetSlot = null
        if (uri != null && slot != null) {
            importing = true
            scope.launch {
                val res = withContext(Dispatchers.IO) {
                    runCatching { CustomSfxRepository.importFromUri(activity, uri, slot) }
                }
                importing = false
                res.onSuccess {
                    customTick++
                    Toast.makeText(activity, "SFX '$slot' diganti dengan audio kustom!", Toast.LENGTH_SHORT).show()
                    AudioAuditionPlayer.play(activity, slot)
                }.onFailure { err ->
                    Toast.makeText(activity, err.message ?: "Gagal impor SFX", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    val bgDialog = if (isLight) Color(0xFFF4F7FC) else Color(0xFF131823)
    val cardBg = if (isLight) Color(0xE8FFFFFF) else Color(0xFF1D2434)
    val borderCol = if (isLight) Color(0x301D3557) else Color(0x2EFFFFFF)
    val txtPrimary = if (isLight) Color(0xFF0E141D) else Color(0xFFF6F8FB)
    val txtSecondary = if (isLight) Color(0xFF516075) else Color(0xFF9AA8BC)
    val accentBlue = if (isLight) Color(0xFF007AFF) else Color(0xFF4AA3FF)
    val accentGreen = if (isLight) Color(0xFF28A745) else Color(0xFF32D74B)

    val filteredEntries = remember(selectedCat, searchQuery, onPickSfxId) {
        val q = searchQuery.trim().lowercase()
        val base = if (onPickSfxId != null) {
            if (q.isNotEmpty()) SfxCatalog.SFX_ONLY else SfxCatalog.byCategory(selectedCat).filter { !it.isAmbience }
        } else {
            if (q.isNotEmpty()) SfxCatalog.ALL else SfxCatalog.byCategory(selectedCat)
        }
        if (q.isEmpty()) base else base.filter { it.id.contains(q) || it.desc.lowercase().contains(q) }
    }

    AlertDialog(
        onDismissRequest = { AudioAuditionPlayer.stop(); onDismiss() },
        containerColor = bgDialog,
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    if (onPickSfxId != null) "Pilih SFX (108 Studio SFX)" else "Studio Sound Engine v2.0",
                    color = txtPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp
                )
                Text(
                    "${SfxCatalog.SFX_ONLY.size} SFX + ${SfxCatalog.AMBIENCE_ONLY.size} Ambience Beds · Offline & Impor MP3/WAV",
                    color = txtSecondary, fontSize = 11.sp
                )
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it.take(40) },
                    singleLine = true,
                    placeholder = { Text("Cari SFX (mis. glass, boing, boom)...", fontSize = 11.sp, color = txtSecondary) },
                    modifier = Modifier.fillMaxWidth().testTag("sfx_search_input"),
                    shape = RoundedCornerShape(14.dp),
                    textStyle = TextStyle(color = txtPrimary, fontSize = 12.sp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = accentBlue,
                        unfocusedBorderColor = borderCol,
                        focusedContainerColor = cardBg,
                        unfocusedContainerColor = cardBg
                    )
                )

                val cats = if (onPickSfxId != null) SfxCategory.entries.filter { it != SfxCategory.AMBIENCE_BEDS } else SfxCategory.entries
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    cats.forEach { cat ->
                        val active = cat == selectedCat && searchQuery.isBlank()
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (active) accentBlue else cardBg)
                                .border(1.dp, if (active) accentBlue else borderCol, RoundedCornerShape(50))
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    searchQuery = ""
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

                if (importing) {
                    Text("Mengonversi & menormalisasi audio ke 44.1 kHz WAV…", color = accentBlue, fontSize = 11.sp)
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(320.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    filteredEntries.forEach { entry ->
                        val isCustom = !entry.isAmbience && customSlots.contains(entry.id)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(cardBg)
                                .border(1.dp, if (isCustom) accentGreen.copy(alpha = 0.6f) else borderCol, RoundedCornerShape(14.dp))
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    if (entry.isAmbience) AudioAuditionPlayer.playAmbience(entry.id)
                                    else AudioAuditionPlayer.play(activity, entry.id)
                                }
                                .padding(horizontal = 11.dp, vertical = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(accentBlue.copy(alpha = 0.16f))
                                    .padding(horizontal = 8.dp, vertical = 5.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("▶", color = accentBlue, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }

                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Text(
                                        entry.id,
                                        color = txtPrimary,
                                        fontSize = 11.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    if (entry.isImpact) {
                                        Text("DUCK", color = Color(0xFFFF9F0A), fontSize = 8.5.sp, fontWeight = FontWeight.Bold)
                                    }
                                    if (isCustom) {
                                        Text("CUSTOM", color = accentGreen, fontSize = 8.5.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                                Text(entry.desc, color = txtSecondary, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }

                            if (onPickSfxId != null && !entry.isAmbience) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(50))
                                        .background(accentBlue)
                                        .clickable {
                                            AudioAuditionPlayer.stop()
                                            onPickSfxId(entry.id)
                                        }
                                        .padding(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Text("Pilih", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            } else if (!entry.isAmbience) {
                                if (isCustom) {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(50))
                                            .background(Color(0x22FF5E57))
                                            .border(1.dp, Color(0x66FF5E57), RoundedCornerShape(50))
                                            .clickable {
                                                CustomSfxRepository.deleteCustom(activity, entry.id)
                                                customTick++
                                                Toast.makeText(activity, "Slot '${entry.id}' dikembalikan ke studio", Toast.LENGTH_SHORT).show()
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

/**
 * Interactive Cue & Waveform Timeline (v2.1):
 * - Renders audio energy waveform profile
 * - Displays interactive SFX pin markers along the timeline
 * - Tap pin to audition & select; drag pin or nudge +/- 0.1s; swap SFX ID; add/delete pin
 * - 1-tap "Tulis ke Kode" sync button writes cues cleanly back into /*<studio-meta>*/
 */
@Composable
fun AudioCueTimelineStrip(
    activity: MainActivity,
    audioConfig: StudioAudioConfig,
    durationSeconds: Int,
    currentPlayheadSec: Double,
    hasUnsyncedOverrides: Boolean,
    isLight: Boolean,
    onCuesChanged: (List<AudioCue>) -> Unit,
    onWriteBackToCode: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val wellBg = if (isLight) Color(0xADFFFFFF) else Color(0x6605070C)
    val borderCol = if (isLight) Color(0x341D3557) else Color(0x2892C5FF)
    val txtPrimary = if (isLight) Color(0xFF0E141D) else Color(0xFFF6F8FB)
    val txtSecondary = if (isLight) Color(0xFF516075) else Color(0xFF9AA8BC)
    val accentBlue = if (isLight) Color(0xFF007AFF) else Color(0xFF4AA3FF)
    val accentAmber = Color(0xFFFF9F0A)
    val accentGreen = if (isLight) Color(0xFF28A745) else Color(0xFF32D74B)

    val cues = audioConfig.cues
    val dur = durationSeconds.coerceAtLeast(1).toDouble()
    var selectedIdx by remember(cues.size) { mutableIntStateOf(if (cues.isNotEmpty()) 0 else -1) }
    var showSfxPickerForIdx by remember { mutableStateOf<Int?>(null) }
    val waveform = remember(durationSeconds, audioConfig) {
        ProceduralAudioEngine.computeTimelineWaveform(durationSeconds, audioConfig, 54)
    }

    fun cueSec(cue: AudioCue): Double =
        (if (cue.atProgress != null) cue.atProgress * dur else cue.atSeconds).coerceIn(0.0, dur)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(wellBg)
            .border(1.dp, borderCol, RoundedCornerShape(16.dp))
            .padding(11.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "TIMELINE WAVEFORM & PIN SFX (${cues.size})",
                color = txtSecondary,
                fontSize = 9.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
                modifier = Modifier.weight(1f)
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(accentBlue.copy(alpha = 0.16f))
                    .clickable {
                        val added = cues + AudioCue(
                            atSeconds = (kotlin.math.round(currentPlayheadSec * 10.0) / 10.0).coerceIn(0.0, dur),
                            atProgress = null,
                            sfx = "bubble_pop",
                            gain = 0.65f
                        )
                        onCuesChanged(added)
                        selectedIdx = added.lastIndex
                        AudioAuditionPlayer.play(activity, "bubble_pop")
                    }
                    .padding(horizontal = 8.dp, vertical = 4.dp)
                    .testTag("add_sfx_pin_button")
            ) {
                Text("+ Pin", color = accentBlue, fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
            }
            if (hasUnsyncedOverrides) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(accentGreen.copy(alpha = 0.2f))
                        .border(1.dp, accentGreen.copy(alpha = 0.6f), RoundedCornerShape(50))
                        .clickable { onWriteBackToCode() }
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                        .testTag("write_cues_to_code_button")
                ) {
                    Text("Tulis ke Kode", color = accentGreen, fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Interactive Waveform Bar + Draggable Pin Markers
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .height(62.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(if (isLight) Color(0x160E141D) else Color(0x90030509))
                .border(1.dp, borderCol, RoundedCornerShape(12.dp))
                .padding(horizontal = 8.dp, vertical = 6.dp)
        ) {
            val trackW = maxWidth
            Canvas(modifier = Modifier.matchParentSize()) {
                val n = waveform.size.coerceAtLeast(1)
                val barW = (size.width / n) * 0.56f
                val step = size.width / n
                val midY = size.height * 0.54f
                for (i in 0 until n) {
                    val h = (waveform[i] * size.height * 0.72f).coerceAtLeast(4f)
                    val x = i * step + (step - barW) * 0.5f
                    drawRoundRect(
                        color = accentBlue.copy(alpha = 0.36f + waveform[i] * 0.35f),
                        topLeft = Offset(x, midY - h * 0.5f),
                        size = Size(barW, h),
                        cornerRadius = CornerRadius(barW * 0.5f, barW * 0.5f)
                    )
                }
                // Playhead vertical line
                val phX = ((currentPlayheadSec / dur).coerceIn(0.0, 1.0) * size.width).toFloat()
                drawLine(Color.White.copy(alpha = 0.85f), Offset(phX, 0f), Offset(phX, size.height), strokeWidth = 2f)
            }

            cues.forEachIndexed { idx, cue ->
                val frac = (cueSec(cue) / dur).toFloat().coerceIn(0f, 1f)
                val isSel = idx == selectedIdx
                val pinColor = if (SfxCatalog.isImpactSfx(cue.sfx)) accentAmber else accentBlue
                val xOff = ((trackW - 18.dp) * frac).coerceAtLeast(0.dp)
                Box(
                    modifier = Modifier
                        .offset(x = xOff, y = 2.dp)
                        .size(width = 18.dp, height = 46.dp)
                        .pointerInput(idx, cues.size, dur) {
                            detectHorizontalDragGestures(
                                onDragStart = { selectedIdx = idx },
                                onHorizontalDrag = { change, dragAmount ->
                                    change.consume()
                                    val pxWidth = trackW.toPx().coerceAtLeast(1f)
                                    val curSec = cueSec(cues[idx])
                                    val deltaSec = (dragAmount / pxWidth) * dur
                                    val nextSec = (kotlin.math.round((curSec + deltaSec).coerceIn(0.0, dur) * 20.0) / 20.0)
                                    val updated = cues.toMutableList()
                                    updated[idx] = cues[idx].copy(atSeconds = nextSec, atProgress = null)
                                    onCuesChanged(updated)
                                }
                            )
                        }
                        .clickable {
                            selectedIdx = idx
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            AudioAuditionPlayer.play(activity, cue.sfx, cue.pitch)
                        },
                    contentAlignment = Alignment.TopCenter
                ) {
                    Box(
                        modifier = Modifier
                            .size(if (isSel) 14.dp else 10.dp)
                            .clip(CircleShape)
                            .background(if (isSel) Color.White else pinColor)
                            .border(2.dp, pinColor, CircleShape)
                    )
                }
            }
        }

        // Scrollable cue pills
        if (cues.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                cues.forEachIndexed { idx, cue ->
                    val isSel = idx == selectedIdx
                    val timeLabel = String.format(Locale.US, "%.2fs", cueSec(cue))
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(if (isSel) accentBlue else accentBlue.copy(alpha = 0.12f))
                            .border(1.dp, accentBlue.copy(alpha = if (isSel) 1f else 0.35f), RoundedCornerShape(50))
                            .clickable {
                                selectedIdx = idx
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                AudioAuditionPlayer.play(activity, cue.sfx, cue.pitch)
                            }
                            .padding(horizontal = 9.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("▶ ", color = if (isSel) Color.White else accentBlue, fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
                        Text(timeLabel, color = if (isSel) Color.White else accentBlue, fontSize = 9.5.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(5.dp))
                        Text(cue.sfx, color = if (isSel) Color.White else txtPrimary, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    }
                }
            }
        }

        // Inspector bar for the selected SFX pin
        if (selectedIdx in cues.indices) {
            val sel = cues[selectedIdx]
            val sec = cueSec(sel)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (isLight) Color(0x140E141D) else Color(0x36FFFFFF))
                    .padding(horizontal = 9.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Column(Modifier.weight(1f)) {
                    Text(sel.sfx, color = txtPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("Waktu: ${String.format(Locale.US, "%.2fs", sec)} · geser pin di atas", color = txtSecondary, fontSize = 9.5.sp)
                }
                PinActionChip("-0.1s", txtPrimary, borderCol) {
                    val next = (kotlin.math.round((sec - 0.1).coerceAtLeast(0.0) * 100.0) / 100.0)
                    val list = cues.toMutableList()
                    list[selectedIdx] = sel.copy(atSeconds = next, atProgress = null)
                    onCuesChanged(list)
                }
                PinActionChip("+0.1s", txtPrimary, borderCol) {
                    val next = (kotlin.math.round((sec + 0.1).coerceAtMost(dur) * 100.0) / 100.0)
                    val list = cues.toMutableList()
                    list[selectedIdx] = sel.copy(atSeconds = next, atProgress = null)
                    onCuesChanged(list)
                }
                PinActionChip("Ganti", accentBlue, accentBlue.copy(alpha = 0.5f)) {
                    showSfxPickerForIdx = selectedIdx
                }
                PinActionChip("×", Color(0xFFFF5E57), Color(0x66FF5E57)) {
                    val list = cues.toMutableList()
                    list.removeAt(selectedIdx)
                    selectedIdx = (selectedIdx - 1).coerceAtLeast(if (list.isEmpty()) -1 else 0)
                    onCuesChanged(list)
                }
            }
        }
    }

    showSfxPickerForIdx?.let { targetIdx ->
        SfxStudioManagerDialog(
            activity = activity,
            isLight = isLight,
            onDismiss = { showSfxPickerForIdx = null },
            onPickSfxId = { pickedId ->
                if (targetIdx in cues.indices) {
                    val list = cues.toMutableList()
                    list[targetIdx] = list[targetIdx].copy(sfx = pickedId)
                    onCuesChanged(list)
                    AudioAuditionPlayer.play(activity, pickedId, list[targetIdx].pitch)
                }
                showSfxPickerForIdx = null
            }
        )
    }
}

@Composable
private fun PinActionChip(label: String, color: Color, border: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .border(1.dp, border, RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = color, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}
