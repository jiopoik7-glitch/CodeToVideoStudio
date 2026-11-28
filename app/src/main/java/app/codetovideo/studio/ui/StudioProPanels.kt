package app.codetovideo.studio.ui

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts.OpenDocument
import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.codetovideo.studio.MainActivity
import app.codetovideo.studio.core.SrtSubtitleParser
import app.codetovideo.studio.core.StudioSubtitleConfig
import app.codetovideo.studio.render.RuntimeErrorInfo
import app.codetovideo.studio.storage.MediaAssetRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Non-destructive TikTok / Instagram Reels Safe Zone Guide overlay drawn on top of the preview canvas.
 */
@Composable
fun TikTokSafeZoneOverlay(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxSize()) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val dash = PathEffect.dashPathEffect(floatArrayOf(10f, 8f), 0f)
            val dangerFill = Color(0x28FF3B5C)
            val guideStroke = Color(0xBBFF6B7A)

            // Top unsafe header zone (~11%)
            drawRect(dangerFill, Offset(0f, 0f), Size(w, h * 0.11f))
            drawLine(guideStroke, Offset(0f, h * 0.11f), Offset(w, h * 0.11f), strokeWidth = 1.5f, pathEffect = dash)

            // Bottom unsafe caption/audio/nav zone (~22%)
            val botTop = h * 0.78f
            drawRect(dangerFill, Offset(0f, botTop), Size(w, h - botTop))
            drawLine(guideStroke, Offset(0f, botTop), Offset(w, botTop), strokeWidth = 1.5f, pathEffect = dash)

            // Right TikTok/Reels action buttons rail (~16% width, 42%..78% height)
            val railLeft = w * 0.84f
            drawRect(dangerFill, Offset(railLeft, h * 0.42f), Size(w - railLeft, h * 0.36f))
            drawRect(
                color = guideStroke,
                topLeft = Offset(railLeft, h * 0.42f),
                size = Size(w - railLeft, h * 0.36f),
                style = Stroke(width = 1.5f, pathEffect = dash)
            )

            // Center vertical & horizontal alignment hairlines
            drawLine(Color(0x44FFFFFF), Offset(w * 0.5f, h * 0.11f), Offset(w * 0.5f, botTop), strokeWidth = 1f, pathEffect = dash)
            drawLine(Color(0x44FFFFFF), Offset(0f, h * 0.5f), Offset(railLeft, h * 0.5f), strokeWidth = 1f, pathEffect = dash)
        }
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(8.dp)
                .clip(RoundedCornerShape(50))
                .background(Color(0xBBFF3B5C))
                .padding(horizontal = 8.dp, vertical = 3.dp)
        ) {
            Text("SAFE ZONE 9:16", color = Color.White, fontSize = 8.5.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
        }
    }
}

/**
 * Subtle frosted glass loading pill shown during cold-start GPU/3D scene initialization.
 * Never displays a red error card while fonts, Three.js, or shaders are compiling.
 */
@Composable
fun PreviewInitLoadingPill(
    stageMessage: String,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "preview_init_shimmer")
    val pulseAlpha by transition.animateFloat(
        initialValue = 0.42f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 900),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_alpha"
    )
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(Color(0xC80E1524))
            .border(1.dp, Color(0x4892C5FF), RoundedCornerShape(50))
            .padding(horizontal = 14.dp, vertical = 9.dp)
            .testTag("preview_init_loading_pill"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(Color(0xFF60B8FF).copy(alpha = pulseAlpha))
        )
        Text(
            text = stageMessage.ifBlank { "Menyiapkan Scene 3D…" },
            color = Color(0xFFEAF3FF).copy(alpha = 0.72f + pulseAlpha * 0.28f),
            fontSize = 11.5.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

/**
 * Slim Liquid Glass error pill shown below preview/editor ONLY when user JS code has a real syntax/runtime error.
 * Tapping expands a clean detail dialog with Indonesian explanation, code snippet, and 1-tap AI error copy.
 */
@Composable
fun CompactErrorPill(
    activity: MainActivity,
    error: RuntimeErrorInfo,
    isLight: Boolean,
    onDismiss: () -> Unit
) {
    val clipboard = LocalClipboardManager.current
    var showDetail by remember(error.timestampMs) { mutableStateOf(false) }

    val pillBg = if (isLight) Color(0xD8FFFFFF) else Color(0xCC161B28)
    val pillBorder = Color(0x55FF6B7A)
    val accentCoral = Color(0xFFFF6B7A)
    val txtPrimary = if (isLight) Color(0xFF1A1F2C) else Color(0xFFF3F6FB)
    val txtSecondary = if (isLight) Color(0xFF5A6475) else Color(0xFFA7B3C6)
    val label = buildString {
        if (error.lineNumber != null) append("Baris ${error.lineNumber} · ")
        append(error.indonesianExplanation)
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(pillBg)
            .border(1.dp, pillBorder, RoundedCornerShape(16.dp))
            .clickable { showDetail = true }
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .testTag("compact_error_pill"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(accentCoral)
        )
        Text(
            text = label,
            color = txtPrimary,
            fontSize = 11.5.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(accentCoral.copy(alpha = 0.16f))
                .padding(horizontal = 9.dp, vertical = 4.dp)
        ) {
            Text("Detail ›", color = accentCoral, fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
        }
    }

    if (showDetail) {
        val dialogBg = if (isLight) Color(0xFFF6F8FC) else Color(0xFF131823)
        val codeBg = if (isLight) Color(0x141A1F2C) else Color(0x88080B12)
        AlertDialog(
            onDismissRequest = { showDetail = false },
            containerColor = dialogBg,
            title = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.size(8.dp).background(accentCoral, CircleShape))
                    Text(
                        buildString {
                            append("Diagnostik Skrip JS")
                            if (error.lineNumber != null) append(" · Baris ${error.lineNumber}")
                        },
                        color = txtPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        error.indonesianExplanation,
                        color = txtPrimary,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        lineHeight = 18.sp
                    )
                    Text(
                        error.rawMessage,
                        color = txtSecondary,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        lineHeight = 15.sp
                    )
                    if (error.codeSnippet.isNotBlank()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(codeBg)
                                .padding(10.dp)
                        ) {
                            Text(
                                error.codeSnippet,
                                color = txtPrimary,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                lineHeight = 14.sp
                            )
                        }
                    }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(50))
                            .background(Color(0xFF0A84FF))
                            .clickable {
                                val promptText = buildString {
                                    appendLine("Tolong perbaiki error JavaScript pada skrip CodeToVideoStudio v2.1 ini:")
                                    if (error.lineNumber != null) appendLine("- Baris error: Baris ${error.lineNumber}")
                                    appendLine("- Pesan error: ${error.rawMessage}")
                                    appendLine("- Diagnosis: ${error.indonesianExplanation}")
                                    if (error.codeSnippet.isNotBlank()) {
                                        appendLine("- Potongan kode bermasalah:")
                                        appendLine("```javascript")
                                        appendLine(error.codeSnippet)
                                        appendLine("```")
                                    }
                                    appendLine("Kembalikan kode JavaScript lengkap yang sudah diperbaiki agar 100% deterministik dan bebas error.")
                                }
                                clipboard.setText(AnnotatedString(promptText))
                                Toast.makeText(activity, "Detail error + cuplikan kode disalin untuk AI!", Toast.LENGTH_SHORT).show()
                            }
                            .padding(vertical = 11.dp)
                            .testTag("copy_error_for_ai_button"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Salin Error untuk Diperbaiki AI", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showDetail = false }) {
                    Text("Tutup", color = txtPrimary, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDetail = false; onDismiss() }) {
                    Text("Sembunyikan", color = txtSecondary)
                }
            }
        )
    }
}

/**
 * Smart Error Debugger Card: shows exact line number, plain Indonesian explanation,
 * offending code lines, and 1-tap "Salin Error untuk Diperbaiki AI" button.
 */
@Composable
fun SmartErrorDebuggerCard(
    activity: MainActivity,
    error: RuntimeErrorInfo,
    isLight: Boolean,
    onDismiss: () -> Unit
) {
    val clipboard = LocalClipboardManager.current
    val bg = if (isLight) Color(0xFFFFF1F2) else Color(0xFF281219)
    val border = Color(0x99FF5E6C)
    val txtPrimary = if (isLight) Color(0xFF2E0B12) else Color(0xFFFFE5E8)
    val txtSecondary = if (isLight) Color(0xFF6B2130) else Color(0xFFF5B7C0)
    val codeBg = if (isLight) Color(0x182E0B12) else Color(0x880B070A)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(20.dp))
            .padding(14.dp)
            .testTag("smart_error_debugger_card"),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(8.dp).background(Color(0xFFFF453A), CircleShape))
            Text(
                buildString {
                    append("SMART DEBUGGER")
                    if (error.lineNumber != null) append(" · BARIS ${error.lineNumber}")
                },
                color = Color(0xFFFF5E6C),
                fontWeight = FontWeight.ExtraBold,
                fontSize = 11.sp,
                letterSpacing = 0.7.sp,
                modifier = Modifier.weight(1f)
            )
            Text(
                "Tutup",
                color = txtSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable(onClick = onDismiss).padding(horizontal = 4.dp)
            )
        }

        Text(error.indonesianExplanation, color = txtPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, lineHeight = 17.sp)
        Text(error.rawMessage, color = txtSecondary, fontSize = 10.5.sp, fontFamily = FontFamily.Monospace)

        if (error.codeSnippet.isNotBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(codeBg)
                    .padding(10.dp)
            ) {
                Text(error.codeSnippet, color = txtPrimary, fontSize = 10.sp, fontFamily = FontFamily.Monospace, lineHeight = 14.sp)
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(50))
                .background(Color(0xFFFF453A))
                .clickable {
                    val promptText = buildString {
                        appendLine("Tolong perbaiki error JavaScript pada skrip CodeToVideoStudio v2.1 ini:")
                        if (error.lineNumber != null) appendLine("- Baris error: Baris ${error.lineNumber}")
                        appendLine("- Pesan error: ${error.rawMessage}")
                        appendLine("- Diagnosis: ${error.indonesianExplanation}")
                        if (error.codeSnippet.isNotBlank()) {
                            appendLine("- Potongan kode bermasalah:")
                            appendLine("```javascript")
                            appendLine(error.codeSnippet)
                            appendLine("```")
                        }
                        appendLine("Kembalikan kode JavaScript lengkap yang sudah diperbaiki agar 100% deterministik dan bebas error.")
                    }
                    clipboard.setText(AnnotatedString(promptText))
                    Toast.makeText(activity, "Detail error + cuplikan kode disalin untuk AI!", Toast.LENGTH_SHORT).show()
                }
                .padding(vertical = 10.dp)
                .testTag("copy_error_for_ai_button"),
            contentAlignment = Alignment.Center
        ) {
            Text("Salin Error untuk Diperbaiki AI", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/**
 * Local Media Asset Manager Dialog (Zero-Permission Photo Picker + SVG OpenDocument).
 */
@Composable
fun MediaAssetManagerDialog(
    activity: MainActivity,
    isLight: Boolean,
    onAssetsChanged: () -> Unit,
    onDismiss: () -> Unit
) {
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    var aliasInput by remember { mutableStateOf("") }
    var refreshTick by remember { mutableIntStateOf(0) }
    val assets = remember(refreshTick) { MediaAssetRepository.listAssets(activity) }

    fun importUri(uri: Uri?) {
        if (uri == null) return
        val desiredAlias = aliasInput.trim().ifBlank { null }
        scope.launch {
            val res = withContext(Dispatchers.IO) {
                runCatching { MediaAssetRepository.importFromUri(activity, uri, desiredAlias) }
            }
            res.onSuccess { imported ->
                aliasInput = ""
                refreshTick++
                onAssetsChanged()
                Toast.makeText(activity, "Aset '${imported.alias}' siap dipakai!", Toast.LENGTH_SHORT).show()
            }.onFailure { err ->
                Toast.makeText(activity, err.message ?: "Gagal impor gambar", Toast.LENGTH_LONG).show()
            }
        }
    }

    val photoPicker = rememberLauncherForActivityResult(PickVisualMedia()) { uri -> importUri(uri) }
    val svgPicker = rememberLauncherForActivityResult(OpenDocument()) { uri -> importUri(uri) }

    val bgDialog = if (isLight) Color(0xFFF4F7FC) else Color(0xFF131823)
    val cardBg = if (isLight) Color(0xE8FFFFFF) else Color(0xFF1D2434)
    val borderCol = if (isLight) Color(0x301D3557) else Color(0x2EFFFFFF)
    val txtPrimary = if (isLight) Color(0xFF0E141D) else Color(0xFFF6F8FB)
    val txtSecondary = if (isLight) Color(0xFF516075) else Color(0xFF9AA8BC)
    val accentBlue = if (isLight) Color(0xFF007AFF) else Color(0xFF4AA3FF)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = bgDialog,
        title = {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Media Asset Manager", color = txtPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text("Impor Foto/PNG/SVG lokal lalu panggil via assets.drawImage(ctx, 'alias', ...)", color = txtSecondary, fontSize = 11.sp)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = aliasInput,
                    onValueChange = { aliasInput = it.take(32) },
                    singleLine = true,
                    label = { Text("Nama alias opsional (mis. logo, produk)", fontSize = 10.sp, color = txtSecondary) },
                    modifier = Modifier.fillMaxWidth().testTag("media_alias_input"),
                    shape = RoundedCornerShape(14.dp),
                    textStyle = TextStyle(color = txtPrimary, fontSize = 12.sp, fontFamily = FontFamily.Monospace),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = accentBlue,
                        unfocusedBorderColor = borderCol,
                        focusedContainerColor = cardBg,
                        unfocusedContainerColor = cardBg
                    )
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(50))
                            .background(accentBlue)
                            .clickable {
                                photoPicker.launch(PickVisualMediaRequest(PickVisualMedia.ImageOnly))
                            }
                            .padding(vertical = 10.dp)
                            .testTag("import_photo_button"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("+ Foto / PNG", color = Color.White, fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(50))
                            .background(cardBg)
                            .border(1.dp, borderCol, RoundedCornerShape(50))
                            .clickable {
                                svgPicker.launch(arrayOf("image/svg+xml", "image/png", "image/jpeg", "image/webp"))
                            }
                            .padding(vertical = 10.dp)
                            .testTag("import_svg_button"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("+ File SVG/PNG", color = txtPrimary, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                Column(
                    modifier = Modifier.fillMaxWidth().height(230.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    if (assets.isEmpty()) {
                        Text("Belum ada aset gambar lokal. Impor logo/foto produk agar bisa dipakai 100% offline.", color = txtSecondary, fontSize = 11.sp)
                    }
                    assets.forEach { asset ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(cardBg)
                                .border(1.dp, borderCol, RoundedCornerShape(14.dp))
                                .padding(horizontal = 11.dp, vertical = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(asset.alias, color = txtPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                                Text("${asset.fileName} · ${asset.sizeBytes / 1024} KB", color = txtSecondary, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(accentBlue.copy(alpha = 0.16f))
                                    .clickable {
                                        val snippet = "assets.drawImage(ctx, \"${asset.alias}\", pad, H * 0.35, 360 * S, 360 * S, { radius: 28 * S, fit: \"cover\", shadow: true, popIn: ui.seg(p, 0.1, 0.25) });"
                                        clipboard.setText(AnnotatedString(snippet))
                                        Toast.makeText(activity, "Snippet '${asset.alias}' disalin", Toast.LENGTH_SHORT).show()
                                    }
                                    .padding(horizontal = 9.dp, vertical = 5.dp)
                            ) {
                                Text("Salin Kode", color = accentBlue, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(Color(0x22FF5E57))
                                    .clickable {
                                        MediaAssetRepository.delete(activity, asset.fileName)
                                        refreshTick++
                                        onAssetsChanged()
                                    }
                                    .padding(horizontal = 8.dp, vertical = 5.dp)
                            ) {
                                Text("×", color = Color(0xFFFF5E57), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Tutup", color = accentBlue, fontWeight = FontWeight.Bold) }
        }
    )
}

/**
 * Viral Subtitle / Karaoke UI Panel (supports .srt paste or quick timestamp lines,
 * 3 viral presets: pill_highlight | universe_bold | editorial_glass, and 1-tap Write to Code).
 */
@Composable
fun ViralSubtitlePanel(
    config: StudioSubtitleConfig,
    isLight: Boolean,
    onConfigChange: (StudioSubtitleConfig) -> Unit,
    onWriteBackToCode: () -> Unit
) {
    val txtPrimary = if (isLight) Color(0xFF0E141D) else Color(0xFFF6F8FB)
    val txtSecondary = if (isLight) Color(0xFF516075) else Color(0xFF9AA8BC)
    val wellBg = if (isLight) Color(0xADFFFFFF) else Color(0x6605070C)
    val borderCol = if (isLight) Color(0x341D3557) else Color(0x2892C5FF)
    val accentBlue = if (isLight) Color(0xFF007AFF) else Color(0xFF4AA3FF)
    val accentGreen = if (isLight) Color(0xFF28A745) else Color(0xFF32D74B)

    var expanded by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f)) {
                Text("VIRAL SUBTITLE / KARAOKE", color = txtPrimary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
                Text(
                    if (config.enabled && config.cues.isNotEmpty()) "${config.cues.size} baris aktif · gaya ${config.preset}"
                    else "Tempel .SRT atau daftar detik · 3 preset viral",
                    color = if (config.enabled && config.cues.isNotEmpty()) accentGreen else txtSecondary,
                    fontSize = 10.sp
                )
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(if (expanded) accentBlue else accentBlue.copy(alpha = 0.14f))
                    .clickable { expanded = !expanded }
                    .padding(horizontal = 10.dp, vertical = 6.dp)
                    .testTag("toggle_subtitle_editor_button")
            ) {
                Text(if (expanded) "Tutup" else "Atur SRT", color = if (expanded) Color.White else accentBlue, fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(if (config.enabled) accentGreen else borderCol)
                    .clickable { onConfigChange(config.copy(enabled = !config.enabled)) }
                    .padding(horizontal = 10.dp, vertical = 6.dp)
                    .testTag("subtitle_enable_toggle")
            ) {
                Text(if (config.enabled) "ON" else "OFF", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }

        if (expanded) {
            // 3 Viral Presets
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                val presets = listOf(
                    "pill_highlight" to "Pill Highlight",
                    "universe_bold" to "Universe Bold",
                    "editorial_glass" to "Editorial Glass"
                )
                presets.forEach { (id, label) ->
                    val sel = config.preset == id
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (sel) accentBlue else wellBg)
                            .border(1.dp, if (sel) accentBlue else borderCol, RoundedCornerShape(12.dp))
                            .clickable { onConfigChange(config.copy(preset = id, enabled = true)) }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(label, color = if (sel) Color.White else txtPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                    }
                }
            }

            // Quick accent color swatches
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Warna Aksen:", color = txtSecondary, fontSize = 10.5.sp)
                listOf("#FF3B5C", "#FFE600", "#32D74B", "#4AA3FF", "#C084FC").forEach { hex ->
                    val parsedCol = Color(android.graphics.Color.parseColor(hex))
                    val active = config.accentColor.equals(hex, true)
                    Box(
                        modifier = Modifier
                            .size(if (active) 24.dp else 20.dp)
                            .clip(CircleShape)
                            .background(parsedCol)
                            .border(if (active) 2.dp else 1.dp, Color.White, CircleShape)
                            .clickable { onConfigChange(config.copy(accentColor = hex)) }
                    )
                }
            }

            OutlinedTextField(
                value = config.rawSrt,
                onValueChange = { raw ->
                    val cues = SrtSubtitleParser.parse(raw)
                    onConfigChange(config.copy(rawSrt = raw, cues = cues, enabled = cues.isNotEmpty() || config.enabled))
                },
                modifier = Modifier.fillMaxWidth().height(126.dp).testTag("subtitle_srt_input"),
                shape = RoundedCornerShape(14.dp),
                textStyle = TextStyle(color = txtPrimary, fontSize = 11.sp, fontFamily = FontFamily.Monospace, lineHeight = 15.sp),
                placeholder = {
                    Text(
                        "Format .SRT atau cepat:\n0.2 - 2.4 : Render video sinematik offline!\n2.5 - 5.0 : Langsung 60 FPS di HP Android.",
                        fontSize = 10.5.sp, color = txtSecondary
                    )
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = accentBlue,
                    unfocusedBorderColor = borderCol,
                    focusedContainerColor = wellBg,
                    unfocusedContainerColor = wellBg
                )
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(50))
                        .background(wellBg)
                        .border(1.dp, borderCol, RoundedCornerShape(50))
                        .clickable {
                            val sample = "1\n00:00:00,200 --> 00:00:02,400\nRender video sinematik langsung dari HP!\n\n2\n00:00:02,500 --> 00:00:05,200\nWebGL2 3D, Liquid Glass & 108 Studio SFX!"
                            val parsed = SrtSubtitleParser.parse(sample)
                            onConfigChange(config.copy(rawSrt = sample, cues = parsed, enabled = true))
                        }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Isi Contoh SRT", color = txtPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(50))
                        .background(accentGreen.copy(alpha = 0.2f))
                        .border(1.dp, accentGreen.copy(alpha = 0.6f), RoundedCornerShape(50))
                        .clickable { onWriteBackToCode() }
                        .padding(vertical = 8.dp)
                        .testTag("write_subtitles_to_code_button"),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Tulis ke Kode", color = accentGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
