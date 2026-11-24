package app.codetovideo.studio.ui

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.OpenDocument
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.codetovideo.studio.MainActivity
import app.codetovideo.studio.ai.AiConfig
import app.codetovideo.studio.ai.AiConfigStore
import app.codetovideo.studio.ai.AiMode
import app.codetovideo.studio.ai.AiVideoDirector
import app.codetovideo.studio.ai.ByokProvider
import app.codetovideo.studio.core.StudioProject
import kotlinx.coroutines.launch

private data class AiGlassColors(
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val accent: Color,
    val accentSoft: Color,
    val gold: Color,
    val cardTop: Color,
    val cardMid: Color,
    val cardBot: Color,
    val borderTop: Color,
    val borderBot: Color,
    val wellBg: Color,
    val sheetBg: Color,
    val danger: Color
)

private fun aiColors(isLight: Boolean): AiGlassColors = if (isLight) {
    AiGlassColors(
        textPrimary = Color(0xFF0E141D),
        textSecondary = Color(0xFF475569),
        textMuted = Color(0xFF64748B),
        accent = Color(0xFF0A84FF),
        accentSoft = Color(0x1F0A84FF),
        gold = Color(0xFFB7791F),
        cardTop = Color(0xE0FFFFFF),
        cardMid = Color(0xB8F5F8FC),
        cardBot = Color(0xD2FFFFFF),
        borderTop = Color(0xFFFFFFFF),
        borderBot = Color(0x66A7C6EC),
        wellBg = Color(0x160F172A),
        sheetBg = Color(0xF5F4F7FC),
        danger = Color(0xFFD92D20)
    )
} else {
    AiGlassColors(
        textPrimary = Color(0xFFF6F8FB),
        textSecondary = Color(0xFFB3C0D1),
        textMuted = Color(0xFF7B889B),
        accent = Color(0xFF64E3B1),
        accentSoft = Color(0x2664E3B1),
        gold = Color(0xFFF3D38C),
        cardTop = Color(0x26FFFFFF),
        cardMid = Color(0x10FFFFFF),
        cardBot = Color(0x1CFFFFFF),
        borderTop = Color(0x66FFFFFF),
        borderBot = Color(0x2692C5FF),
        wellBg = Color(0x88070B12),
        sheetBg = Color(0xF2121822),
        danger = Color(0xFFFF7B72)
    )
}

@Composable
private fun LiquidGlassCard(
    c: AiGlassColors,
    modifier: Modifier = Modifier,
    cornerRadius: Int = 24,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(cornerRadius.dp)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Brush.verticalGradient(listOf(c.cardTop, c.cardMid, c.cardBot)))
            .border(
                width = 1.dp,
                brush = Brush.verticalGradient(listOf(c.borderTop, c.borderBot)),
                shape = shape
            )
            .padding(16.dp),
        content = content
    )
}

@Composable
private fun LiquidChip(
    label: String,
    selected: Boolean,
    c: AiGlassColors,
    onClick: () -> Unit
) {
    val inter = remember { MutableInteractionSource() }
    val pressed by inter.collectIsPressedAsState()
    val sc by animateFloatAsState(if (pressed) 0.94f else 1f, spring(0.65f, 520f), label = "chip_sc")
    val shape = CircleShape
    Box(
        modifier = Modifier
            .graphicsLayer { scaleX = sc; scaleY = sc }
            .clip(shape)
            .background(if (selected) c.accentSoft else c.wellBg)
            .border(
                1.dp,
                if (selected) c.accent.copy(alpha = 0.72f) else c.borderBot.copy(alpha = 0.45f),
                shape
            )
            .clickable(interactionSource = inter, indication = null, onClick = onClick)
            .padding(horizontal = 13.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            color = if (selected) c.textPrimary else c.textSecondary,
            maxLines = 1
        )
    }
}

@Composable
private fun LiquidPrimaryButton(
    text: String,
    loading: Boolean,
    enabled: Boolean,
    c: AiGlassColors,
    onClick: () -> Unit
) {
    val inter = remember { MutableInteractionSource() }
    val pressed by inter.collectIsPressedAsState()
    val sc by animateFloatAsState(if (pressed && enabled && !loading) 0.96f else 1f, spring(0.62f, 500f), label = "cta_sc")
    val shape = RoundedCornerShape(18.dp)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer { scaleX = sc; scaleY = sc; alpha = if (enabled) 1f else 0.55f }
            .clip(shape)
            .background(
                Brush.horizontalGradient(
                    listOf(Color(0xFF7CE3B0), Color(0xFFF3D38C))
                )
            )
            .border(1.dp, Color(0xAAFFFFFF), shape)
            .clickable(enabled = enabled && !loading, interactionSource = inter, indication = null, onClick = onClick)
            .padding(vertical = 14.dp, horizontal = 16.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = Color(0xFF0D1D14)
                )
                Spacer(Modifier.width(10.dp))
            }
            Text(
                text = text,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF0D1D14)
            )
        }
    }
}

@Composable
fun LiquidModeSwitcherBar(
    creatorMode: Boolean,
    isLight: Boolean,
    showQuickReviseBtn: Boolean,
    canUndo: Boolean,
    onModeChange: (Boolean) -> Unit,
    onOpenAiSettings: () -> Unit,
    onQuickRevise: () -> Unit,
    onUndo: () -> Unit
) {
    val c = remember(isLight) { aiColors(isLight) }
    val pillShape = CircleShape

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        // Segmented Liquid Glass Mode Pill: Kreator vs Pro
        Row(
            modifier = Modifier
                .clip(pillShape)
                .background(Brush.verticalGradient(listOf(c.cardTop, c.cardBot)))
                .border(1.dp, Brush.verticalGradient(listOf(c.borderTop, c.borderBot)), pillShape)
                .padding(3.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            listOf(true to "✨ Kreator", false to "</> Pro").forEach { (isCr, label) ->
                val active = creatorMode == isCr
                Box(
                    modifier = Modifier
                        .clip(pillShape)
                        .background(if (active) c.accentSoft else Color.Transparent)
                        .border(
                            width = if (active) 1.dp else 0.dp,
                            color = if (active) c.accent.copy(alpha = 0.65f) else Color.Transparent,
                            shape = pillShape
                        )
                        .clickable { onModeChange(isCr) }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = label,
                        fontSize = 12.sp,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                        color = if (active) c.textPrimary else c.textSecondary
                    )
                }
            }
        }

        // Right quick actions (Revisi AI saat di layar Render + Undo + Pengaturan AI)
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (showQuickReviseBtn) {
                Box(
                    modifier = Modifier
                        .clip(pillShape)
                        .background(Brush.horizontalGradient(listOf(Color(0x387CE3B0), Color(0x38F3D38C))))
                        .border(1.dp, c.gold.copy(alpha = 0.65f), pillShape)
                        .clickable(onClick = onQuickRevise)
                        .padding(horizontal = 11.dp, vertical = 6.dp)
                ) {
                    Text("✨ Revisi AI", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = c.textPrimary)
                }
            }
            if (canUndo && showQuickReviseBtn) {
                Box(
                    modifier = Modifier
                        .clip(pillShape)
                        .background(c.wellBg)
                        .border(1.dp, c.borderBot, pillShape)
                        .clickable(onClick = onUndo)
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Text("↩", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = c.textPrimary)
                }
            }
            Box(
                modifier = Modifier
                    .clip(pillShape)
                    .background(Brush.verticalGradient(listOf(c.cardTop, c.cardBot)))
                    .border(1.dp, c.borderTop.copy(alpha = 0.6f), pillShape)
                    .clickable(onClick = onOpenAiSettings)
                    .padding(horizontal = 11.dp, vertical = 6.dp)
            ) {
                Text("⚙ AI", fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = c.textPrimary)
            }
        }
    }
}

@Composable
fun AiCreatorScreen(
    activity: MainActivity,
    project: StudioProject,
    isLight: Boolean,
    canUndo: Boolean,
    onApplyGenerated: (StudioProject) -> Unit,
    onUndo: () -> Unit,
    onOpenSettings: () -> Unit,
    onSwitchToPro: () -> Unit,
    onGoRender: () -> Unit
) {
    val c = remember(isLight) { aiColors(isLight) }
    val scope = rememberCoroutineScope()
    val scroll = rememberScrollState()

    var storyPrompt by remember { mutableStateOf("") }
    var revisionPrompt by remember { mutableStateOf("") }
    var selectedAspect by remember { mutableStateOf(project.renderSettings.aspect) }
    var selectedDuration by remember { mutableIntStateOf(if (project.renderSettings.durationSeconds in listOf(5, 15, 30, 60)) project.renderSettings.durationSeconds else 30) }
    var selectedStyle by remember { mutableStateOf("Cinematic Storytelling") }
    var isBusy by remember { mutableStateOf(false) }
    var statusMsg by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }

    val cfg = AiConfigStore.load(activity)
    val modeLabel = if (cfg.mode == AiMode.INSTANT_PROXY) "⚡ Mode Instan" else "🔑 Kunci Sendiri (${if (cfg.provider == ByokProvider.GEMINI) "Gemini" else "OpenRouter"})"

    val importScript = rememberLauncherForActivityResult(OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            runCatching {
                activity.contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
                    ?: throw IllegalStateException("File naskah tidak dapat dibaca.")
            }.onSuccess { text ->
                storyPrompt = text.take(10_000)
                statusMsg = "Naskah berhasil dimuat (${storyPrompt.length} karakter). Langsung ketuk Buat Video!"
                isError = false
            }.onFailure { err ->
                statusMsg = err.message ?: "Gagal membaca file naskah."
                isError = true
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scroll)
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Card 1: Ceritakan / Tempel Naskah Video
        LiquidGlassCard(c = c) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("AI Video Studio", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = c.textPrimary)
                    Text(
                        "Cukup jelaskan ceritanya — tanpa perlu nulis kode.",
                        fontSize = 12.sp,
                        color = c.textSecondary
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(c.accentSoft)
                        .border(1.dp, c.accent.copy(alpha = 0.55f), CircleShape)
                        .clickable(onClick = onOpenSettings)
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Text(modeLabel, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = c.textPrimary, maxLines = 1)
                }
            }

            Spacer(Modifier.height(12.dp))

            // Text Input Area
            val boxShape = RoundedCornerShape(16.dp)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 112.dp, max = 210.dp)
                    .clip(boxShape)
                    .background(c.wellBg)
                    .border(1.dp, c.borderBot.copy(alpha = 0.55f), boxShape)
                    .padding(12.dp)
            ) {
                if (storyPrompt.isEmpty()) {
                    Text(
                        "Contoh: Buat video 30 detik tentang kebun dapur 1 meter persegi. Mulai dari pot kosong, denah 3 zona, proses tumbuh hari 1-21, sampai panen sayur masuk ke dapur...",
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                        color = c.textMuted
                    )
                }
                BasicTextField(
                    value = storyPrompt,
                    onValueChange = { storyPrompt = it },
                    textStyle = TextStyle(
                        color = c.textPrimary,
                        fontSize = 13.5.sp,
                        lineHeight = 20.sp
                    ),
                    cursorBrush = SolidColor(c.accent),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(Modifier.height(10.dp))

            // Impor Naskah & Contoh Ide 1-Tap
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                LiquidChip("📄 Impor .txt/.md", false, c) {
                    importScript.launch(arrayOf("text/plain", "text/markdown", "text/*"))
                }
                LiquidChip("🌱 Cerita Berkebun", false, c) {
                    storyPrompt = "Buat video storytelling hangat 30 detik tentang sebuah kehidupan yang dimulai dari satu benih kecil di tanah gelap, disiram air pagi, tumbuh menjadi tunas dan kebun rumah yang hijau, lalu diakhiri panen tomat dan teks LET'S GROW A BETTER LIFE."
                }
                LiquidChip("📐 Edukasi Blueprint", false, c) {
                    storyPrompt = "Buat video bergaya Swiss Archival Blueprint 15 detik menjelaskan 3 langkah merawat tanaman hias di kamar: cahaya tidak langsung, media tanam poros, dan jadwal siram terukur."
                }
                if (storyPrompt.isNotEmpty()) {
                    LiquidChip("✕ Bersihkan", false, c) { storyPrompt = "" }
                }
            }

            Spacer(Modifier.height(14.dp))
            Text("RASIO & DURASI", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = c.textMuted, letterSpacing = 0.8.sp)
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                listOf("9:16", "16:9", "1:1", "4:5").forEach { a ->
                    LiquidChip(a, selectedAspect == a, c) { selectedAspect = a }
                }
                listOf(5, 15, 30, 60).forEach { d ->
                    LiquidChip("${d}s", selectedDuration == d, c) { selectedDuration = d }
                }
            }

            Spacer(Modifier.height(12.dp))
            Text("GAYA VISUAL", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = c.textMuted, letterSpacing = 0.8.sp)
            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                listOf(
                    "Cinematic Storytelling",
                    "Swiss Archival Blueprint",
                    "iOS 26 Liquid Glass",
                    "Minimalist Kinetic",
                    "3D Botanical Dark"
                ).forEach { style ->
                    LiquidChip(style, selectedStyle == style, c) { selectedStyle = style }
                }
            }

            Spacer(Modifier.height(16.dp))
            LiquidPrimaryButton(
                text = if (isBusy) statusMsg.ifBlank { "Sedang meracik video…" } else "✨ Buat Video & Preview",
                loading = isBusy,
                enabled = !isBusy,
                c = c,
                onClick = {
                    scope.launch {
                        isBusy = true
                        isError = false
                        statusMsg = "Menghubungi AI Director…"
                        runCatching {
                            AiVideoDirector.generateNew(
                                context = activity,
                                baseProject = project,
                                storyPrompt = storyPrompt,
                                aspect = selectedAspect,
                                durationSeconds = selectedDuration,
                                stylePreset = selectedStyle,
                                onStatus = { statusMsg = it }
                            )
                        }.onSuccess { updated ->
                            isBusy = false
                            statusMsg = "Video berhasil dibuat! Membuka Live Preview…"
                            Toast.makeText(activity, "Video siap diputar & dirender!", Toast.LENGTH_SHORT).show()
                            onApplyGenerated(updated)
                        }.onFailure { err ->
                            isBusy = false
                            isError = true
                            statusMsg = err.message ?: "Gagal membuat video."
                        }
                    }
                }
            )

            if (statusMsg.isNotBlank()) {
                Spacer(Modifier.height(10.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (isError) c.danger.copy(alpha = 0.14f) else c.accentSoft)
                        .border(1.dp, (if (isError) c.danger else c.accent).copy(alpha = 0.45f), RoundedCornerShape(14.dp))
                        .padding(11.dp)
                ) {
                    Text(
                        text = statusMsg,
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        color = if (isError) c.danger else c.textPrimary
                    )
                }
            }
        }

        // Card 2: Revisi Langsung Video Aktif
        LiquidGlassCard(c = c) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Revisi Video Aktif", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = c.textPrimary)
                    Text(
                        "Proyek aktif: ${project.name}",
                        fontSize = 11.5.sp,
                        color = c.textSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                if (canUndo) {
                    LiquidChip("↩ Undo", false, c, onClick = onUndo)
                }
            }

            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(c.wellBg)
                        .border(1.dp, c.borderBot.copy(alpha = 0.55f), RoundedCornerShape(14.dp))
                        .padding(horizontal = 12.dp, vertical = 11.dp)
                ) {
                    if (revisionPrompt.isEmpty()) {
                        Text("Misal: perbesar teks, warna lebih hangat…", fontSize = 12.5.sp, color = c.textMuted, maxLines = 1)
                    }
                    BasicTextField(
                        value = revisionPrompt,
                        onValueChange = { revisionPrompt = it },
                        singleLine = true,
                        textStyle = TextStyle(color = c.textPrimary, fontSize = 13.sp),
                        cursorBrush = SolidColor(c.accent),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .background(c.accentSoft)
                        .border(1.dp, c.accent.copy(alpha = 0.65f), RoundedCornerShape(14.dp))
                        .clickable(enabled = !isBusy) {
                            scope.launch {
                                isBusy = true
                                isError = false
                                statusMsg = "Menerapkan revisi…"
                                runCatching {
                                    AiVideoDirector.reviseExisting(
                                        context = activity,
                                        currentProject = project,
                                        revisionPrompt = revisionPrompt,
                                        onStatus = { statusMsg = it }
                                    )
                                }.onSuccess { updated ->
                                    isBusy = false
                                    revisionPrompt = ""
                                    statusMsg = "Revisi selesai! Membuka Live Preview…"
                                    Toast.makeText(activity, "Revisi diterapkan!", Toast.LENGTH_SHORT).show()
                                    onApplyGenerated(updated)
                                }.onFailure { err ->
                                    isBusy = false
                                    isError = true
                                    statusMsg = err.message ?: "Gagal merevisi video."
                                }
                            }
                        }
                        .padding(horizontal = 14.dp, vertical = 11.dp)
                ) {
                    Text("Kirim", fontSize = 12.5.sp, fontWeight = FontWeight.Bold, color = c.textPrimary)
                }
            }

            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                LiquidChip("🎬 Buka Preview & Render", false, c, onClick = onGoRender)
                LiquidChip("</> Lihat Kode Pro", false, c, onClick = onSwitchToPro)
            }
        }

        // Ruang aman agar tidak tertutup Floating Liquid Glass Dock di bawah
        Spacer(Modifier.height(108.dp))
    }
}

@Composable
fun AiQuickReviseOverlay(
    activity: MainActivity,
    project: StudioProject,
    isLight: Boolean,
    onDismiss: () -> Unit,
    onOpenSettings: () -> Unit,
    onRevised: (StudioProject) -> Unit
) {
    val c = remember(isLight) { aiColors(isLight) }
    val scope = rememberCoroutineScope()
    var revText by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("") }
    var isErr by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0x9906090F))
            .clickable(enabled = !busy, onClick = onDismiss),
        contentAlignment = Alignment.BottomCenter
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 18.dp)
                .clip(RoundedCornerShape(28.dp))
                .background(c.sheetBg)
                .border(1.dp, Brush.verticalGradient(listOf(c.borderTop, c.borderBot)), RoundedCornerShape(28.dp))
                .clickable(enabled = false) {}
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("✨ Revisi Langsung Video", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = c.textPrimary)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LiquidChip("⚙ AI", false, c, onClick = onOpenSettings)
                    LiquidChip("✕", false, c) { if (!busy) onDismiss() }
                }
            }

            Spacer(Modifier.height(8.dp))
            Text(
                "Jelaskan bagian yang masih aneh atau ingin kamu ubah. Adegan yang sudah bagus akan tetap dipertahankan.",
                fontSize = 12.sp,
                color = c.textSecondary
            )

            Spacer(Modifier.height(10.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 84.dp, max = 160.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(c.wellBg)
                    .border(1.dp, c.borderBot.copy(alpha = 0.6f), RoundedCornerShape(16.dp))
                    .padding(12.dp)
            ) {
                if (revText.isEmpty()) {
                    Text("Contoh: gerakan tangannya rapikan, font subtitle diperbesar, tambah kilau cahaya pagi…", fontSize = 12.5.sp, color = c.textMuted)
                }
                BasicTextField(
                    value = revText,
                    onValueChange = { revText = it },
                    textStyle = TextStyle(color = c.textPrimary, fontSize = 13.sp, lineHeight = 19.sp),
                    cursorBrush = SolidColor(c.accent),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(Modifier.height(12.dp))
            LiquidPrimaryButton(
                text = if (busy) status.ifBlank { "Menerapkan revisi…" } else "✨ Terapkan Revisi & Muat Ulang Preview",
                loading = busy,
                enabled = !busy,
                c = c,
                onClick = {
                    scope.launch {
                        busy = true
                        isErr = false
                        status = "Mengirim instruksi revisi…"
                        runCatching {
                            AiVideoDirector.reviseExisting(
                                context = activity,
                                currentProject = project,
                                revisionPrompt = revText,
                                onStatus = { status = it }
                            )
                        }.onSuccess { updated ->
                            busy = false
                            Toast.makeText(activity, "Revisi selesai! Preview diperbarui.", Toast.LENGTH_SHORT).show()
                            onRevised(updated)
                        }.onFailure { err ->
                            busy = false
                            isErr = true
                            status = err.message ?: "Gagal merevisi."
                        }
                    }
                }
            )

            if (status.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(status, fontSize = 12.sp, color = if (isErr) c.danger else c.accent)
            }
        }
    }
}

@Composable
fun AiSettingsOverlay(
    activity: MainActivity,
    isLight: Boolean,
    onDismiss: () -> Unit
) {
    val c = remember(isLight) { aiColors(isLight) }
    val initial = remember { AiConfigStore.load(activity) }

    var mode by remember { mutableStateOf(initial.mode) }
    var proxyUrl by remember { mutableStateOf(initial.proxyUrl) }
    var provider by remember { mutableStateOf(initial.provider) }
    var geminiKey by remember { mutableStateOf(initial.geminiKey) }
    var geminiModel by remember { mutableStateOf(initial.geminiModel) }
    var orKey by remember { mutableStateOf(initial.openRouterKey) }
    var orModel by remember { mutableStateOf(initial.openRouterModel) }
    var showSecret by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xA606090F))
            .clickable(onClick = onDismiss),
        contentAlignment = Alignment.BottomCenter
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 16.dp)
                .clip(RoundedCornerShape(28.dp))
                .background(c.sheetBg)
                .border(1.dp, Brush.verticalGradient(listOf(c.borderTop, c.borderBot)), RoundedCornerShape(28.dp))
                .clickable(enabled = false) {}
                .verticalScroll(rememberScrollState())
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Pengaturan Otak AI", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = c.textPrimary)
                    Text("Pilih cara koneksi yang paling nyaman buatmu", fontSize = 12.sp, color = c.textSecondary)
                }
                LiquidChip("✕", false, c, onClick = onDismiss)
            }

            Spacer(Modifier.height(14.dp))

            // Dual Architecture Selector Cards (User Friendly)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                val pActive = mode == AiMode.INSTANT_PROXY
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(18.dp))
                        .background(if (pActive) c.accentSoft else c.wellBg)
                        .border(1.2.dp, if (pActive) c.accent else c.borderBot.copy(alpha = 0.45f), RoundedCornerShape(18.dp))
                        .clickable { mode = AiMode.INSTANT_PROXY }
                        .padding(12.dp)
                ) {
                    Text("⚡ Mode Instan", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = c.textPrimary)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Pakai server proxy tanpa daftar akun AI. Praktis tinggal pakai.",
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        color = c.textSecondary
                    )
                }

                val bActive = mode == AiMode.BYOK
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(18.dp))
                        .background(if (bActive) c.accentSoft else c.wellBg)
                        .border(1.2.dp, if (bActive) c.accent else c.borderBot.copy(alpha = 0.45f), RoundedCornerShape(18.dp))
                        .clickable { mode = AiMode.BYOK }
                        .padding(12.dp)
                ) {
                    Text("🔑 Kunci Sendiri", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = c.textPrimary)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Pakai API Key gratis Google AI Studio / OpenRouter. Kuota lega & privat.",
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        color = c.textSecondary
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            if (mode == AiMode.INSTANT_PROXY) {
                Text("ALAMAT SERVER PROXY (CLOUDFLARE WORKER)", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = c.textMuted)
                Spacer(Modifier.height(6.dp))
                AiInputField(
                    value = proxyUrl,
                    onValueChange = { proxyUrl = it },
                    placeholder = "https://ctv-ai-proxy.namamu.workers.dev/generate",
                    c = c
                )
                Spacer(Modifier.height(10.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x1A64B5F6))
                        .border(1.dp, Color(0x4564B5F6), RoundedCornerShape(14.dp))
                        .padding(11.dp)
                ) {
                    Text(
                        "Tips: Kalau kamu belum punya server proxy sendiri, langsung pindah ke '🔑 Kunci Sendiri' — gratis pakai API Key Gemini dalam 30 detik.",
                        fontSize = 11.5.sp,
                        lineHeight = 16.sp,
                        color = c.textSecondary
                    )
                }
            } else {
                Text("PENYEDIA AI", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = c.textMuted)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LiquidChip("Google Gemini (Gratis)", provider == ByokProvider.GEMINI, c) { provider = ByokProvider.GEMINI }
                    LiquidChip("OpenRouter", provider == ByokProvider.OPENROUTER, c) { provider = ByokProvider.OPENROUTER }
                }

                Spacer(Modifier.height(12.dp))
                if (provider == ByokProvider.GEMINI) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("GEMINI API KEY", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = c.textMuted)
                        Text(
                            if (showSecret) "Sembunyikan" else "Lihat",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = c.accent,
                            modifier = Modifier.clickable { showSecret = !showSecret }
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    AiInputField(
                        value = geminiKey,
                        onValueChange = { geminiKey = it },
                        placeholder = "Tempel API Key (AIzaSy...)",
                        secret = !showSecret,
                        c = c
                    )

                    Spacer(Modifier.height(10.dp))
                    Text("MODEL GEMINI", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = c.textMuted)
                    Spacer(Modifier.height(6.dp))
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash").forEach { m ->
                            LiquidChip(m, geminiModel == m, c) { geminiModel = m }
                        }
                    }

                    Spacer(Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0x1A64B5F6))
                            .border(1.dp, Color(0x4564B5F6), RoundedCornerShape(14.dp))
                            .padding(11.dp)
                    ) {
                        Text(
                            "Cara dapat API Key gratis (30 detik):\n1. Buka aistudio.google.com/apikey di browser.\n2. Login Google → ketuk Create API Key.\n3. Salin & tempel di kolom atas (hanya disimpan lokal di HP-mu).",
                            fontSize = 11.5.sp,
                            lineHeight = 16.5.sp,
                            color = c.textSecondary
                        )
                    }
                } else {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("OPENROUTER API KEY", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = c.textMuted)
                        Text(
                            if (showSecret) "Sembunyikan" else "Lihat",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = c.accent,
                            modifier = Modifier.clickable { showSecret = !showSecret }
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    AiInputField(
                        value = orKey,
                        onValueChange = { orKey = it },
                        placeholder = "Tempel API Key (sk-or-...)",
                        secret = !showSecret,
                        c = c
                    )
                    Spacer(Modifier.height(10.dp))
                    Text("NAMA MODEL OPENROUTER", fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = c.textMuted)
                    Spacer(Modifier.height(6.dp))
                    AiInputField(
                        value = orModel,
                        onValueChange = { orModel = it },
                        placeholder = "google/gemini-2.5-flash",
                        c = c
                    )
                }
            }

            Spacer(Modifier.height(16.dp))
            LiquidPrimaryButton(
                text = "✓ Simpan Pengaturan AI",
                loading = false,
                enabled = true,
                c = c,
                onClick = {
                    AiConfigStore.save(
                        activity,
                        AiConfig(
                            mode = mode,
                            proxyUrl = proxyUrl,
                            provider = provider,
                            geminiKey = geminiKey,
                            geminiModel = geminiModel,
                            openRouterKey = orKey,
                            openRouterModel = orModel
                        )
                    )
                    Toast.makeText(activity, "Pengaturan AI tersimpan", Toast.LENGTH_SHORT).show()
                    onDismiss()
                }
            )
        }
    }
}

@Composable
private fun AiInputField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    c: AiGlassColors,
    secret: Boolean = false
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(c.wellBg)
            .border(1.dp, c.borderBot.copy(alpha = 0.6f), RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 11.dp)
    ) {
        if (value.isEmpty()) {
            Text(placeholder, fontSize = 12.5.sp, color = c.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
            textStyle = TextStyle(color = c.textPrimary, fontSize = 13.sp, fontFamily = FontFamily.Monospace),
            cursorBrush = SolidColor(c.accent),
            modifier = Modifier.fillMaxWidth()
        )
    }
}
