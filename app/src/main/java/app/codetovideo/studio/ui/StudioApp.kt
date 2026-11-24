package app.codetovideo.studio.ui

import android.content.Intent
import android.net.Uri
import android.widget.MediaController
import android.widget.Toast
import android.widget.VideoView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.CreateDocument
import androidx.activity.result.contract.ActivityResultContracts.OpenDocument
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import app.codetovideo.studio.MainActivity
import app.codetovideo.studio.core.ProjectMetadataParser
import app.codetovideo.studio.core.PropType
import app.codetovideo.studio.core.StudioMetadata
import app.codetovideo.studio.core.StudioProject
import app.codetovideo.studio.storage.GalleryRepository
import app.codetovideo.studio.storage.GalleryVideo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

private enum class StudioTab(val label: String) {
    EDITOR("Editor"),
    RENDER("Render"),
    GALLERY("Galeri"),
    PROJECTS("Simpan"),
    DOCS("Docs")
}

// =======================================================
// PALET & KOMPONEN iOS 26 LIQUID GLASS
// =======================================================
private val GlassTextPrimary = Color(0xFFF6F8FB)
private val GlassTextSecondary = Color(0xFFA7B2C2)
private val GlassTextMuted = Color(0xFF748091)
private val GlassSilverAccent = Color(0xFFE7ECF2)
private val GlassMintDot = Color(0xFF5CE1A8)

@Composable
private fun LiquidGlassBackdrop() {
    Canvas(modifier = Modifier.fillMaxSize()) {
        drawRect(
            brush = Brush.verticalGradient(
                colors = listOf(Color(0xFF0A0D13), Color(0xFF0E131C), Color(0xFF07090D))
            )
        )
        // Pendar perak-titanium kanan atas
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(Color(0x36DCE6F2), Color(0x0E9BB0C9), Color.Transparent),
                center = Offset(size.width * 0.88f, size.height * 0.12f),
                radius = size.minDimension * 0.82f
            ),
            radius = size.minDimension * 0.82f,
            center = Offset(size.width * 0.88f, size.height * 0.12f)
        )
        // Pendar dingin kiri bawah
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(Color(0x2890A8C4), Color(0x085A6C82), Color.Transparent),
                center = Offset(size.width * 0.10f, size.height * 0.84f),
                radius = size.minDimension * 0.78f
            ),
            radius = size.minDimension * 0.78f,
            center = Offset(size.width * 0.10f, size.height * 0.84f)
        )
    }
}

@Composable
private fun GlassPanel(
    modifier: Modifier = Modifier,
    cornerRadius: Int = 24,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(cornerRadius.dp)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0x24FFFFFF), Color(0x10FFFFFF), Color(0x16FFFFFF))
                )
            )
            .border(
                width = 1.dp,
                brush = Brush.linearGradient(
                    colors = listOf(Color(0x66FFFFFF), Color(0x18FFFFFF), Color(0x3AFFFFFF))
                ),
                shape = shape
            )
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content
        )
    }
}

@Composable
private fun GlassPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val shape = RoundedCornerShape(50)
    val bg = if (enabled) {
        Brush.verticalGradient(listOf(Color(0xFFFFFFFF), Color(0xFFD9E0E8)))
    } else {
        Brush.verticalGradient(listOf(Color(0x33FFFFFF), Color(0x22FFFFFF)))
    }
    Box(
        modifier = modifier
            .height(46.dp)
            .clip(shape)
            .background(bg)
            .border(1.dp, Color(0x88FFFFFF), shape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = if (enabled) Color(0xFF0C1016) else Color(0x77FFFFFF),
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            letterSpacing = 0.2.sp
        )
    }
}

@Composable
private fun GlassSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val shape = RoundedCornerShape(50)
    Box(
        modifier = modifier
            .height(44.dp)
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    listOf(Color(0x28FFFFFF), Color(0x12FFFFFF), Color(0x1AFFFFFF))
                )
            )
            .border(
                1.dp,
                Brush.linearGradient(listOf(Color(0x55FFFFFF), Color(0x18FFFFFF), Color(0x38FFFFFF))),
                shape
            )
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = if (enabled) GlassTextPrimary else GlassTextMuted,
            fontWeight = FontWeight.Medium,
            fontSize = 12.sp
        )
    }
}

@Composable
private fun GlassMiniPill(label: String, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Box(
        modifier = Modifier
            .clip(shape)
            .background(Color(0x22FFFFFF))
            .border(1.dp, Color(0x3CFFFFFF), shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = GlassTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}

/** iOS Liquid Glass Segmented Control dengan pil cermin meluncur halus */
@Composable
private fun GlassSegmentBar(
    title: String,
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit
) {
    val selectedIdx = options.indexOf(selected).coerceAtLeast(0)
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(title, color = GlassTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        val trackShape = RoundedCornerShape(50)
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .height(40.dp)
                .clip(trackShape)
                .background(Color(0x4506080C))
                .border(1.dp, Color(0x28FFFFFF), trackShape)
                .padding(3.dp)
        ) {
            val itemW = maxWidth / options.size.coerceAtLeast(1)
            val indicatorX by animateDpAsState(
                targetValue = itemW * selectedIdx,
                animationSpec = spring(dampingRatio = 0.74f, stiffness = 420f),
                label = "seg_mirror"
            )
            val pillShape = RoundedCornerShape(50)
            // Pil cermin reflektif yang meluncur
            Box(
                modifier = Modifier
                    .offset(x = indicatorX)
                    .width(itemW)
                    .fillMaxHeight()
                    .clip(pillShape)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color(0x62FFFFFF), Color(0x26FFFFFF), Color(0x42FFFFFF))
                        )
                    )
                    .border(
                        1.dp,
                        Brush.linearGradient(listOf(Color(0xAAFFFFFF), Color(0x22FFFFFF), Color(0x66FFFFFF))),
                        pillShape
                    )
            )
            Row(modifier = Modifier.fillMaxSize()) {
                options.forEachIndexed { idx, opt ->
                    val isSel = idx == selectedIdx
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                onClick = { onSelect(opt) }
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = opt,
                            color = if (isSel) Color.White else GlassTextSecondary,
                            fontSize = 11.sp,
                            fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium,
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                }
            }
        }
    }
}

/** Logo Apple Perak-Putih Khas + Play-Code untuk Header */
@Composable
private fun AppBrandLogo(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier = modifier
            .size(38.dp)
            .clip(shape)
            .background(
                Brush.linearGradient(listOf(Color(0xFFECEFF3), Color(0xFFA7B0BA), Color(0xFF4F5762)))
            )
            .border(1.dp, Color(0xAAFFFFFF), shape),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(26.dp)) {
            val w = size.width
            val h = size.height
            // Daun apel
            val leaf = Path().apply {
                moveTo(w * 0.52f, h * 0.24f)
                cubicTo(w * 0.51f, h * 0.12f, w * 0.62f, h * 0.04f, w * 0.72f, h * 0.04f)
                cubicTo(w * 0.73f, h * 0.15f, w * 0.63f, h * 0.24f, w * 0.52f, h * 0.24f)
                close()
            }
            drawPath(leaf, color = Color.White)
            // Siluet apel putih-perak
            val apple = Path().apply {
                moveTo(w * 0.76f, h * 0.55f)
                cubicTo(w * 0.76f, h * 0.44f, w * 0.85f, h * 0.39f, w * 0.86f, h * 0.38f)
                cubicTo(w * 0.80f, h * 0.30f, w * 0.71f, h * 0.29f, w * 0.68f, h * 0.29f)
                cubicTo(w * 0.60f, h * 0.28f, w * 0.53f, h * 0.33f, w * 0.50f, h * 0.33f)
                cubicTo(w * 0.46f, h * 0.33f, w * 0.41f, h * 0.29f, w * 0.35f, h * 0.29f)
                cubicTo(w * 0.27f, h * 0.29f, w * 0.20f, h * 0.34f, w * 0.16f, h * 0.41f)
                cubicTo(w * 0.08f, h * 0.55f, w * 0.14f, h * 0.76f, w * 0.22f, h * 0.87f)
                cubicTo(w * 0.26f, h * 0.93f, w * 0.31f, h * 0.98f, w * 0.37f, h * 0.98f)
                cubicTo(w * 0.43f, h * 0.98f, w * 0.45f, h * 0.94f, w * 0.52f, h * 0.94f)
                cubicTo(w * 0.59f, h * 0.94f, w * 0.61f, h * 0.98f, w * 0.68f, h * 0.98f)
                cubicTo(w * 0.74f, h * 0.98f, w * 0.79f, h * 0.92f, w * 0.83f, h * 0.87f)
                cubicTo(w * 0.88f, h * 0.80f, w * 0.90f, h * 0.74f, w * 0.90f, h * 0.73f)
                cubicTo(w * 0.90f, h * 0.73f, w * 0.76f, h * 0.68f, w * 0.76f, h * 0.55f)
                close()
            }
            drawPath(
                apple,
                brush = Brush.verticalGradient(listOf(Color.White, Color(0xFFD5DCE4)))
            )
            // Ikon play mini di dalam apel
            val play = Path().apply {
                moveTo(w * 0.45f, h * 0.54f)
                lineTo(w * 0.61f, h * 0.63f)
                lineTo(w * 0.45f, h * 0.72f)
                close()
            }
            drawPath(play, color = Color(0xFF47505C))
        }
    }
}

/** Ikon vektor tipis ala iOS SF Symbols tanpa library tambahan */
@Composable
private fun IosTabIcon(tab: StudioTab, active: Boolean) {
    val tint = if (active) Color.White else GlassTextSecondary
    Canvas(modifier = Modifier.size(20.dp)) {
        val w = size.width
        val h = size.height
        val sw = if (active) 2.1.dp.toPx() else 1.7.dp.toPx()
        val stroke = Stroke(width = sw, cap = StrokeCap.Round, join = StrokeJoin.Round)
        when (tab) {
            StudioTab.EDITOR -> {
                val left = Path().apply {
                    moveTo(w * 0.36f, h * 0.24f); lineTo(w * 0.14f, h * 0.50f); lineTo(w * 0.36f, h * 0.76f)
                }
                val right = Path().apply {
                    moveTo(w * 0.64f, h * 0.24f); lineTo(w * 0.86f, h * 0.50f); lineTo(w * 0.64f, h * 0.76f)
                }
                drawPath(left, tint, style = stroke)
                drawPath(right, tint, style = stroke)
                drawLine(tint, Offset(w * 0.56f, h * 0.20f), Offset(w * 0.44f, h * 0.80f), strokeWidth = sw, cap = StrokeCap.Round)
            }
            StudioTab.RENDER -> {
                drawCircle(tint, radius = w * 0.42f, style = stroke)
                val tri = Path().apply {
                    moveTo(w * 0.42f, h * 0.34f); lineTo(w * 0.68f, h * 0.50f); lineTo(w * 0.42f, h * 0.66f); close()
                }
                drawPath(tri, tint)
            }
            StudioTab.GALLERY -> {
                val r = CornerRadius(3.5.dp.toPx())
                drawRoundRect(tint, Offset(w * 0.12f, h * 0.14f), Size(w * 0.76f, h * 0.72f), r, style = stroke)
                val hill = Path().apply {
                    moveTo(w * 0.18f, h * 0.72f); lineTo(w * 0.42f, h * 0.46f); lineTo(w * 0.60f, h * 0.64f)
                    lineTo(w * 0.72f, h * 0.52f); lineTo(w * 0.84f, h * 0.72f)
                }
                drawPath(hill, tint, style = stroke)
                drawCircle(tint, radius = w * 0.06f, center = Offset(w * 0.68f, h * 0.34f))
            }
            StudioTab.PROJECTS -> {
                val folder = Path().apply {
                    moveTo(w * 0.12f, h * 0.26f)
                    lineTo(w * 0.40f, h * 0.26f)
                    lineTo(w * 0.50f, h * 0.36f)
                    lineTo(w * 0.88f, h * 0.36f)
                    lineTo(w * 0.88f, h * 0.78f)
                    lineTo(w * 0.12f, h * 0.78f)
                    close()
                }
                drawPath(folder, tint, style = stroke)
            }
            StudioTab.DOCS -> {
                val r = CornerRadius(3.dp.toPx())
                drawRoundRect(tint, Offset(w * 0.18f, h * 0.12f), Size(w * 0.64f, h * 0.76f), r, style = stroke)
                drawLine(tint, Offset(w * 0.32f, h * 0.36f), Offset(w * 0.68f, h * 0.36f), strokeWidth = sw, cap = StrokeCap.Round)
                drawLine(tint, Offset(w * 0.32f, h * 0.54f), Offset(w * 0.68f, h * 0.54f), strokeWidth = sw, cap = StrokeCap.Round)
                drawLine(tint, Offset(w * 0.32f, h * 0.72f), Offset(w * 0.56f, h * 0.72f), strokeWidth = sw, cap = StrokeCap.Round)
            }
        }
    }
}

/** Floating Mirror Liquid Glass Bottom Bar ala iOS 26 */
@Composable
private fun LiquidGlassMirrorNavBar(
    selectedTab: StudioTab,
    onSelect: (StudioTab) -> Unit
) {
    val tabs = StudioTab.entries
    val selectedIdx = tabs.indexOf(selectedTab).coerceAtLeast(0)
    val dockShape = RoundedCornerShape(32.dp)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 10.dp)
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .clip(dockShape)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color(0xD6181F2A), Color(0xE80D1118))
                    )
                )
                .border(
                    width = 1.dp,
                    brush = Brush.linearGradient(
                        colors = listOf(Color(0x70FFFFFF), Color(0x1AFFFFFF), Color(0x48FFFFFF))
                    ),
                    shape = dockShape
                )
                .padding(5.dp)
        ) {
            val tabWidth = maxWidth / tabs.size
            val mirrorX by animateDpAsState(
                targetValue = tabWidth * selectedIdx,
                animationSpec = spring(dampingRatio = 0.70f, stiffness = 360f),
                label = "nav_mirror_pill"
            )
            val pillShape = RoundedCornerShape(26.dp)

            // Lensa cermin Liquid Glass yang meluncur lembut ke tab aktif
            Box(
                modifier = Modifier
                    .offset(x = mirrorX)
                    .width(tabWidth)
                    .fillMaxHeight()
                    .clip(pillShape)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color(0x52FFFFFF), Color(0x1CFFFFFF), Color(0x38FFFFFF))
                        )
                    )
                    .border(
                        width = 1.dp,
                        brush = Brush.linearGradient(
                            colors = listOf(Color(0xCCFFFFFF), Color(0x28FFFFFF), Color(0x80FFFFFF))
                        ),
                        shape = pillShape
                    )
            )

            Row(modifier = Modifier.fillMaxSize()) {
                tabs.forEach { tab ->
                    val isActive = tab == selectedTab
                    val scaleVal by animateFloatAsState(
                        targetValue = if (isActive) 1.04f else 0.96f,
                        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
                        label = "tab_scale"
                    )
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .scale(scaleVal)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                onClick = { onSelect(tab) }
                            ),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        IosTabIcon(tab = tab, active = isActive)
                        Spacer(Modifier.height(3.dp))
                        Text(
                            text = tab.label,
                            color = if (isActive) Color.White else GlassTextSecondary,
                            fontSize = 10.sp,
                            fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal,
                            maxLines = 1
                        )
                    }
                }
            }
        }
    }
}

// =======================================================
// APLIKASI UTAMA
// =======================================================
@Composable
fun StudioApp(activity: MainActivity) {
    val repository = activity.projects
    var project by remember { mutableStateOf(repository.loadOrCreate()) }
    var selectedTab by remember { mutableStateOf(StudioTab.EDITOR) }
    var savedLabel by remember { mutableStateOf("Tersimpan") }
    var renderReady by remember { mutableStateOf(false) }
    var exportSupported by remember { mutableStateOf(false) }
    var isRendering by remember { mutableStateOf(false) }
    var renderDone by remember { mutableIntStateOf(0) }
    var renderTotal by remember { mutableIntStateOf(0) }
    var renderMessage by remember { mutableStateOf("") }
    var refreshProjects by remember { mutableIntStateOf(0) }
    var refreshGallery by remember { mutableIntStateOf(0) }

    LaunchedEffect(project.projectId, project.name, project.sourceBody, project.propsValues, project.renderSettings) {
        delay(650)
        runCatching { repository.save(project) }
            .onSuccess {
                savedLabel = "Tersimpan lokal"
                refreshProjects++
            }
            .onFailure { savedLabel = "Gagal menyimpan" }
    }
    LaunchedEffect(Unit) {
        while (true) {
            renderReady = activity.canvasRuntime.ready
            exportSupported = activity.canvasRuntime.exportSupported
            delay(500)
        }
    }

    val importProject = rememberLauncherForActivityResult(OpenDocument()) { uri: Uri? ->
        if (uri != null) runCatching {
            project = repository.importFrom(activity.contentResolver, uri)
            selectedTab = StudioTab.EDITOR
            Toast.makeText(activity, "Proyek berhasil diimpor", Toast.LENGTH_SHORT).show()
        }.onFailure { Toast.makeText(activity, it.message ?: "Import gagal", Toast.LENGTH_LONG).show() }
    }
    val exportProject = rememberLauncherForActivityResult(CreateDocument("application/json")) { uri: Uri? ->
        if (uri != null) runCatching { repository.exportTo(activity.contentResolver, uri, project) }
            .onSuccess { Toast.makeText(activity, "File proyek diekspor", Toast.LENGTH_SHORT).show() }
            .onFailure { Toast.makeText(activity, it.message ?: "Export proyek gagal", Toast.LENGTH_LONG).show() }
    }
    val saveDocs = rememberLauncherForActivityResult(CreateDocument("text/markdown")) { uri: Uri? ->
        if (uri != null) runCatching {
            activity.assets.open("docs/skill.md").use { input ->
                activity.contentResolver.openOutputStream(uri, "wt")?.use { output -> input.copyTo(output) }
                    ?: throw IllegalStateException("File tujuan tidak bisa dibuka.")
            }
        }.onSuccess { Toast.makeText(activity, "Dokumentasi v0.3 disimpan", Toast.LENGTH_SHORT).show() }
            .onFailure { Toast.makeText(activity, it.message ?: "Gagal menyimpan Docs", Toast.LENGTH_LONG).show() }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LiquidGlassBackdrop()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
        ) {
            TopGlassHeader(project.name, savedLabel, renderReady)
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                AnimatedContent(
                    targetState = selectedTab,
                    transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(160)) },
                    label = "tab_content"
                ) { tab ->
                    when (tab) {
                        StudioTab.EDITOR -> EditorScreen(
                            project = project,
                            onProjectChange = { project = it },
                            onImport = { importProject.launch(arrayOf("application/json", "text/json")) },
                            onExport = { exportProject.launch("${project.name.replace(Regex("[^A-Za-z0-9_-]"), "_")}.json") }
                        )
                        StudioTab.RENDER -> RenderScreen(
                            project = project,
                            onProjectChange = { project = it },
                            runtime = activity.canvasRuntime,
                            ready = renderReady,
                            exportSupported = exportSupported,
                            isRendering = isRendering,
                            renderDone = renderDone,
                            renderTotal = renderTotal,
                            renderMessage = renderMessage,
                            onPreview = { activity.canvasRuntime.preview(project, it) },
                            onRender = {
                                renderMessage = "Mensintesis audio SFX & menyiapkan encoder MP4…"
                                isRendering = true
                                renderDone = 0
                                activity.renderController.render(
                                    project,
                                    onProgress = { done, total ->
                                        renderDone = done
                                        renderTotal = total
                                        renderMessage = "Merender frame $done dari $total"
                                    },
                                    onComplete = { result ->
                                        isRendering = false
                                        result.onSuccess {
                                            renderMessage = "MP4 selesai divalidasi dan disimpan ke Movies/CodeToVideoStudio"
                                            refreshGallery++
                                            Toast.makeText(activity, "Video tersimpan di Galeri", Toast.LENGTH_LONG).show()
                                        }.onFailure { error ->
                                            renderMessage = error.message?.takeIf { it.isNotBlank() } ?: "${error::class.java.simpleName}: Render gagal."
                                            Toast.makeText(activity, renderMessage, Toast.LENGTH_LONG).show()
                                        }
                                    }
                                )
                            },
                            onCancel = { activity.renderController.cancel(); renderMessage = "Permintaan pembatalan dikirim." }
                        )
                        StudioTab.GALLERY -> GalleryScreen(
                            activity = activity,
                            keyRefresh = refreshGallery,
                            onShare = { video ->
                                val intent = Intent(Intent.ACTION_SEND).apply {
                                    type = "video/mp4"
                                    putExtra(Intent.EXTRA_STREAM, video.uri)
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                                activity.startActivity(Intent.createChooser(intent, "Bagikan video"))
                            },
                            onDelete = { video ->
                                runCatching { GalleryRepository(activity).delete(video.uri); refreshGallery++ }
                                    .onFailure { Toast.makeText(activity, it.message ?: "Hapus gagal", Toast.LENGTH_LONG).show() }
                            }
                        )
                        StudioTab.PROJECTS -> ProjectsScreen(
                            activity = activity,
                            keyRefresh = refreshProjects,
                            currentProjectId = project.projectId,
                            onOpen = { opened -> project = opened; selectedTab = StudioTab.EDITOR },
                            onNew = { project = repository.save(StudioProject(name = "New Glass Motion")); selectedTab = StudioTab.EDITOR },
                            onDuplicate = { item -> repository.duplicate(item); refreshProjects++ },
                            onRename = { item, name ->
                                val updated = repository.save(item.copy(name = name.take(80)))
                                if (item.projectId == project.projectId) project = updated
                                refreshProjects++
                            },
                            onDelete = { item ->
                                repository.delete(item.projectId)
                                if (item.projectId == project.projectId) project = repository.loadOrCreate()
                                refreshProjects++
                            },
                            onImport = { importProject.launch(arrayOf("application/json", "text/json")) },
                            onExportCurrent = { exportProject.launch("${project.name.replace(Regex("[^A-Za-z0-9_-]"), "_")}.json") }
                        )
                        StudioTab.DOCS -> DocsScreen(activity = activity, onSave = { saveDocs.launch("render-video-code-skill-v0.3.md") })
                    }
                }
            }
            LiquidGlassMirrorNavBar(selectedTab = selectedTab, onSelect = { selectedTab = it })
        }
    }
}

@Composable
private fun TopGlassHeader(projectName: String, status: String, webReady: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AppBrandLogo()
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = "Render Video Code",
                color = GlassTextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                letterSpacing = (-0.2).sp
            )
            Text(
                text = projectName,
                color = GlassTextSecondary,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        val pillShape = RoundedCornerShape(50)
        Column(horizontalAlignment = Alignment.End) {
            Row(
                modifier = Modifier
                    .clip(pillShape)
                    .background(Color(0x1EFFFFFF))
                    .border(1.dp, Color(0x36FFFFFF), pillShape)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(Modifier.size(6.dp).background(if (webReady) GlassMintDot else Color(0xFFFFC966), CircleShape))
                Spacer(Modifier.width(6.dp))
                Text("v0.3 · GLASS", color = GlassSilverAccent, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
            }
            Spacer(Modifier.height(2.dp))
            Text(status, color = GlassTextMuted, fontSize = 9.sp)
        }
    }
}

@Composable
private fun PageColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        content = content
    )
}

@Composable
private fun SectionHeader(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, color = GlassTextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)
        Text(subtitle, color = GlassTextSecondary, fontSize = 12.sp)
    }
}

@Composable
private fun EditorScreen(
    project: StudioProject,
    onProjectChange: (StudioProject) -> Unit,
    onImport: () -> Unit,
    onExport: () -> Unit
) {
    val parsed = remember(project.sourceBody) { runCatching { ProjectMetadataParser.parse(project.sourceBody) } }
    var showTemplates by remember { mutableStateOf(false) }

    PageColumn {
        SectionHeader("Editor", "Engine v0.3 · Liquid Glass UI, 3D helper & 20 SFX offline.")
        GlassPanel {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("SOURCE.JS", color = GlassSilverAccent, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, letterSpacing = 0.8.sp)
                    Text("${project.sourceBody.length} / 262.144 karakter", color = GlassTextMuted, fontSize = 10.sp)
                }
                GlassMiniPill("Templates") { showTemplates = true }
                GlassMiniPill("Reset") {
                    onProjectChange(project.copy(sourceBody = app.codetovideo.studio.core.DEFAULT_SOURCE, propsValues = emptyMap()))
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(320.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0x9906080D))
                    .border(1.dp, Color(0x22FFFFFF), RoundedCornerShape(16.dp))
                    .padding(14.dp)
            ) {
                BasicTextField(
                    value = project.sourceBody,
                    onValueChange = { value -> if (value.length <= ProjectMetadataParser.MAX_SOURCE_CHARS) onProjectChange(project.copy(sourceBody = value)) },
                    modifier = Modifier.fillMaxSize(),
                    textStyle = TextStyle(color = Color(0xFFE3EAF4), fontFamily = FontFamily.Monospace, fontSize = 11.sp, lineHeight = 16.sp),
                    cursorBrush = SolidColor(Color.White)
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GlassSecondaryButton("Import JSON", onClick = onImport, modifier = Modifier.weight(1f))
                GlassSecondaryButton("Export JSON", onClick = onExport, modifier = Modifier.weight(1f))
            }
        }
        if (parsed.isFailure) {
            GlassPanel {
                Text("Metadata Error", color = Color(0xFFFF7D8A), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text(parsed.exceptionOrNull()?.message ?: "Metadata tidak valid.", color = Color(0xFFFFC5CC), fontSize = 12.sp)
            }
        } else {
            val metadata = parsed.getOrThrow()
            if (metadata.audio.cues.isNotEmpty() || metadata.audio.ambience != "none") {
                GlassPanel {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(8.dp).background(GlassMintDot, CircleShape))
                        Spacer(Modifier.width(8.dp))
                        Text("AUDIO & SFX READY", color = GlassSilverAccent, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, letterSpacing = 0.8.sp)
                    }
                    Text(
                        "Bed: ${metadata.audio.ambience} · ${metadata.audio.cues.size} SFX cues otomatis di-mux ke AAC MP4.",
                        color = GlassTextSecondary,
                        fontSize = 12.sp
                    )
                }
            }
            PropsPanel(metadata = metadata, values = project.propsValues, onChange = { onProjectChange(project.copy(propsValues = it)) })
        }
        Spacer(Modifier.height(6.dp))
    }

    if (showTemplates) {
        AlertDialog(
            onDismissRequest = { showTemplates = false },
            containerColor = Color(0xFF151B25),
            title = { Text("Template v0.3 Liquid Glass", color = GlassTextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassSecondaryButton("Liquid Glass Studio · Chimes + Tap (5s)", onClick = {
                        onProjectChange(project.copy(name = "Liquid Glass Studio", sourceBody = app.codetovideo.studio.core.DEFAULT_SOURCE, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 5)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                    GlassSecondaryButton("Editorial Whip Cards · Keynote + SFX (10s)", onClick = {
                        onProjectChange(project.copy(name = "Editorial Whip Cards", sourceBody = EDITORIAL_TEMPLATE, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 10)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                    GlassSecondaryButton("Data Counter Studio · Tick + Chime (5s)", onClick = {
                        onProjectChange(project.copy(name = "Data Counter Studio", sourceBody = COUNTER_TEMPLATE, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 5)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = { TextButton(onClick = { showTemplates = false }) { Text("Tutup", color = GlassSilverAccent) } }
        )
    }
}

private val EDITORIAL_TEMPLATE = """/*<studio-meta>
{
  "schemaVersion": 3,
  "title": "Editorial Whip Cards",
  "defaultDurationSeconds": 10,
  "seed": 42,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"headline","label":"Headline","type":"text","default":"Rawat pelan, tumbuh"},
    {"key":"accentWord","label":"Kata Aksen","type":"text","default":"maksimal."},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#239B56"}
  ],
  "audio": {
    "ambience": "forest_air",
    "ambienceVolume": 0.24,
    "cues": [
      {"p": 0.02, "sfx": "glass_slide", "gain": 0.78},
      {"p": 0.14, "sfx": "glass_tap", "gain": 0.72, "pitch": 1.0},
      {"p": 0.22, "sfx": "glass_tap", "gain": 0.72, "pitch": 1.14},
      {"p": 0.48, "sfx": "whip", "gain": 0.90},
      {"p": 0.62, "sfx": "sparkle", "gain": 0.75},
      {"p": 0.80, "sfx": "bloom", "gain": 0.88}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#239B56");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;
const whip = ease.whip(ui.seg(p, 0.46, 0.56));

function drawLightScene(sp, outU) {
  const cState = { x: outU * W * 1.04, y: interpolate(sp, [0, 1], [-16 * S, 16 * S]), zoom: interpolate(sp, [0, 0.3], [1.1, 1.0], { easing: ease.snap }), rot: -outU * 0.03 };
  ui.drawMeshBg(ctx, W, H, "#F5F6F2", [
    { x: 0.85, y: 0.16, r: 0.68, col: accent, a: 0.24 },
    { x: 0.14, y: 0.85, r: 0.62, col: "#F2C14E", a: 0.24 }
  ], t);
  ctx.save();
  cam.apply(ctx, cState, 1.0);
  const fSize = Math.round(76 * S);
  const used = ui.drawRichText(ctx, [
    { text: String(P.headline || "Rawat pelan, tumbuh") },
    { text: String(P.accentWord || "maksimal."), italic: true, color: accent }
  ], pad, H * 0.16, innerW, fSize, fSize * 1.15, "#111814", ui.seg(sp, 0.04, 0.42), "left");

  const items = [
    { t: "Cahaya & sirkulasi udara", v: 0.92, l: "92%" },
    { t: "Nutrisi akar seimbang", v: 0.86, l: "86%" }
  ];
  const cH = 175 * S;
  const startY = H * 0.16 + used + 70 * S;
  for (let i = 0; i < items.length; i++) {
    const spCard = fx.stagger(frame, i + 3, Math.round(fps * 0.35));
    const cy = startY + i * (cH + 26 * S);
    ctx.save();
    ctx.globalAlpha = ui.clamp(spCard * 1.3, 0, 1);
    ctx.translate((1 - spCard) * 110 * S, 0);
    ui.drawGlassCard(ctx, pad, cy, innerW, cH, 26 * S, { light: true });
    ctx.fillStyle = "#111814";
    ctx.font = "800 " + Math.max(15, Math.round(33 * S)) + "px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(items[i].t, pad + 32 * S, cy + cH * 0.5, innerW - 170 * S);
    ui.drawRing(ctx, pad + innerW - 76 * S, cy + cH * 0.5, 44 * S, items[i].v * ease.apple(ui.seg(sp, 0.25 + i * 0.12, 0.85)), accent, items[i].l, "rgba(17,24,20,0.08)", "#111814");
    ctx.restore();
  }
  ctx.restore();
}

function drawDarkFinale(sp, inU) {
  const cState = { x: -(1 - inU) * W * 1.04, y: 0, zoom: interpolate(sp, [0, 1], [1.08, 1.0], { easing: ease.apple }), rot: (1 - inU) * 0.03 };
  ui.drawMeshBg(ctx, W, H, "#06130C", [{ x: 0.5, y: 0.44, r: 0.68, col: accent, a: 0.28 }], t);
  ctx.save();
  cam.apply(ctx, cState, 1.0);
  const ringP = ease.snap(ui.seg(sp, 0.06, 0.65));
  ui.drawRing(ctx, W * 0.5, H * 0.40, 108 * S, ringP, accent, Math.round(ringP * 100) + "%", "rgba(255,255,255,0.10)", "#F5FAF7", 10 * S);
  const bSize = Math.round(86 * S);
  ui.drawRichText(ctx, [
    { text: String(P.brand || "Seflorner") },
    { text: ".", color: accent }
  ], W * 0.5, H * 0.57, innerW, bSize, bSize * 1.15, "#F5FAF7", ui.seg(sp, 0.25, 0.72), "center");
  ctx.restore();
}

if (p < 0.46) {
  drawLightScene(ui.seg(p, 0.0, 0.56), 0);
} else if (p < 0.56) {
  drawLightScene(ui.seg(p, 0.0, 0.56), whip);
  ctx.save();
  ctx.beginPath();
  ctx.rect(W * (1 - whip), 0, W * whip + 2, H);
  ctx.clip();
  drawDarkFinale(ui.seg(p, 0.46, 1.0), whip);
  ctx.restore();
  ctx.fillStyle = accent;
  ctx.fillRect(W * (1 - whip) - 3 * S, 0, 6 * S, H);
} else {
  drawDarkFinale(ui.seg(p, 0.46, 1.0), 1);
}
ctx.fillStyle = accent;
ctx.fillRect(0, H - Math.max(4, 6 * S), W * p, Math.max(4, 6 * S));
"""

private val COUNTER_TEMPLATE = """/*<studio-meta>
{
  "schemaVersion": 3,
  "title": "Data Counter Studio",
  "defaultDurationSeconds": 5,
  "seed": 31,
  "props": [
    {"key":"label","label":"Label","type":"text","default":"GROWTH INDEX"},
    {"key":"accent","label":"Accent","type":"color","default":"#DCE5F0"}
  ],
  "audio": {
    "ambience": "minimal_pulse",
    "ambienceVolume": 0.20,
    "cues": [
      {"p": 0.04, "sfx": "glass_slide", "gain": 0.72},
      {"p": 0.20, "sfx": "tick", "gain": 0.6, "pitch": 0.95},
      {"p": 0.40, "sfx": "tick", "gain": 0.65, "pitch": 1.05},
      {"p": 0.60, "sfx": "tick", "gain": 0.7, "pitch": 1.15},
      {"p": 0.82, "sfx": "chime", "gain": 0.9}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#DCE5F0");
const intro = spring({ frame, fps, config: { damping: 14, stiffness: 130 } });
ui.drawMeshBg(ctx, W, H, "#090D14", [{ x: 0.5, y: 0.46, r: 0.68, col: accent, a: 0.24 }], t);

ctx.save();
cam.apply(ctx, { x: 0, y: 0, zoom: interpolate(intro, [0, 1], [1.16, 1.0]) + p * 0.05, rot: 0 }, 1.0);
const prog = ease.ios(ui.seg(p, 0.06, 0.86));
const val = Math.round(prog * 100);
ui.drawRing(ctx, W * 0.5, H * 0.45, 220 * S, prog, accent, "", "rgba(255,255,255,0.10)", "#FFFFFF", 16 * S);

ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillStyle = "#F5F7FA";
ctx.font = "800 " + Math.max(64, Math.round(168 * S)) + "px sans-serif";
ctx.fillText(String(val).padStart(2, "0") + "%", W * 0.5, H * 0.45);

ctx.fillStyle = "#A9B5C6";
ctx.font = "700 " + Math.max(15, Math.round(28 * S)) + "px monospace, sans-serif";
ctx.fillText(String(P.label || "GROWTH INDEX").toUpperCase(), W * 0.5, H * 0.72);
ctx.restore();

ctx.fillStyle = accent;
ctx.fillRect(0, H - Math.max(4, 6 * S), W * p, Math.max(4, 6 * S));
"""

@Composable
private fun PropsPanel(metadata: StudioMetadata, values: Map<String, String>, onChange: (Map<String, String>) -> Unit) {
    GlassPanel {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("PROPS", color = GlassSilverAccent, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp, fontSize = 11.sp)
            Spacer(Modifier.weight(1f))
            Text("${metadata.props.size} controls", color = GlassTextMuted, fontSize = 10.sp)
        }
        if (metadata.props.isEmpty()) Text("Tambahkan blok studio-meta di awal source untuk membuat kontrol Props.", color = GlassTextSecondary, fontSize = 12.sp)
        metadata.props.forEach { prop ->
            val value = values[prop.key] ?: prop.defaultValue
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(prop.label, color = GlassTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                when (prop.type) {
                    PropType.TEXT, PropType.COLOR -> OutlinedTextField(
                        value = value,
                        onValueChange = { next -> onChange(values + (prop.key to next.take(256))) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color(0x88FFFFFF),
                            unfocusedBorderColor = Color(0x2EFFFFFF),
                            focusedTextColor = GlassTextPrimary,
                            unfocusedTextColor = GlassTextPrimary,
                            focusedContainerColor = Color(0x55070A10),
                            unfocusedContainerColor = Color(0x44070A10)
                        ),
                        textStyle = TextStyle(fontSize = 12.sp, fontFamily = FontFamily.Monospace),
                        label = { Text(if (prop.type == PropType.COLOR) "Warna HEX" else "Teks", fontSize = 10.sp, color = GlassTextSecondary) }
                    )
                    PropType.RANGE -> {
                        val number = value.toFloatOrNull()?.coerceIn(prop.min, prop.max) ?: prop.min
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Slider(
                                value = number,
                                onValueChange = { next -> onChange(values + (prop.key to next.toString())) },
                                valueRange = prop.min..prop.max,
                                colors = SliderDefaults.colors(thumbColor = Color.White, activeTrackColor = Color.White, inactiveTrackColor = Color(0x33FFFFFF)),
                                modifier = Modifier.weight(1f)
                            )
                            Text("%.2f".format(number), color = GlassSilverAccent, fontSize = 11.sp, modifier = Modifier.width(44.dp))
                        }
                    }
                    PropType.BOOLEAN -> Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (value.equals("true", true)) "Aktif" else "Nonaktif", color = GlassTextSecondary, fontSize = 11.sp, modifier = Modifier.weight(1f))
                        Switch(
                            checked = value.equals("true", true),
                            onCheckedChange = { onChange(values + (prop.key to it.toString())) },
                            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = GlassMintDot, uncheckedTrackColor = Color(0x30FFFFFF))
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RenderScreen(
    project: StudioProject,
    onProjectChange: (StudioProject) -> Unit,
    runtime: app.codetovideo.studio.render.WebCanvasRuntime,
    ready: Boolean,
    exportSupported: Boolean,
    isRendering: Boolean,
    renderDone: Int,
    renderTotal: Int,
    renderMessage: String,
    onPreview: (Int) -> Unit,
    onRender: () -> Unit,
    onCancel: () -> Unit
) {
    var previewFrame by remember { mutableIntStateOf(0) }
    val parsedMeta = remember(project.sourceBody) { runCatching { ProjectMetadataParser.parse(project.sourceBody) }.getOrNull() }
    val cueCount = parsedMeta?.audio?.cues?.size ?: 0
    val ambienceName = parsedMeta?.audio?.ambience ?: "none"
    val hasAudioInCode = cueCount > 0 || ambienceName != "none"

    LaunchedEffect(project.renderSettings.totalFrames()) {
        previewFrame = previewFrame.coerceIn(0, (project.renderSettings.totalFrames() - 1).coerceAtLeast(0))
    }
    LaunchedEffect(project.projectId, project.sourceBody, project.propsValues, project.renderSettings, previewFrame, ready) {
        if (ready) onPreview(previewFrame)
    }

    PageColumn {
        SectionHeader("Render Studio", "H.264 + AAC SFX / MP4 · pemrosesan lokal offline")
        GlassPanel {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("LIVE CANVAS PREVIEW", color = GlassSilverAccent, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
                Spacer(Modifier.weight(1f))
                Text(if (ready) "READY" else "LOADING", color = if (ready) GlassMintDot else Color(0xFFFFC966), fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(265.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFF06080D))
                    .border(1.dp, Color(0x28FFFFFF), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                AndroidView(
                    factory = { runtime.createWebView() },
                    modifier = Modifier.fillMaxSize(),
                    update = { if (ready) runtime.preview(project, previewFrame) }
                )
                if (!ready) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(26.dp), strokeWidth = 2.dp)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Frame ${previewFrame + 1} / ${project.renderSettings.totalFrames()}", color = GlassTextSecondary, fontSize = 11.sp)
                Spacer(Modifier.weight(1f))
                Text("%.2fs".format(previewFrame.toFloat() / project.renderSettings.fps.coerceAtLeast(1)), color = GlassTextMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            }
            Slider(
                value = previewFrame.toFloat(),
                onValueChange = { previewFrame = it.toInt() },
                valueRange = 0f..(project.renderSettings.totalFrames() - 1).coerceAtLeast(1).toFloat(),
                colors = SliderDefaults.colors(thumbColor = Color.White, activeTrackColor = Color.White, inactiveTrackColor = Color(0x30FFFFFF))
            )
            GlassSecondaryButton("Refresh Preview", onClick = { onPreview(previewFrame) }, enabled = ready, modifier = Modifier.fillMaxWidth())
        }

        GlassPanel {
            Text("OUTPUT SETTINGS", color = GlassSilverAccent, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
            GlassSegmentBar("Resolusi sisi panjang", listOf("480", "720", "1080", "1440", "2160"), project.renderSettings.longEdge.toString()) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(longEdge = it.toInt())))
            }
            GlassSegmentBar("Aspect ratio", listOf("9:16", "16:9", "1:1", "4:5"), project.renderSettings.aspect) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(aspect = it)))
            }
            GlassSegmentBar("Frame rate (FPS)", listOf("24", "30", "60"), project.renderSettings.fps.toString()) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(fps = it.toInt())))
            }
            GlassSegmentBar("Quality", listOf("low", "medium", "high", "ultra"), project.renderSettings.quality) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(quality = it)))
            }
            GlassSegmentBar("Durasi video", listOf("3s", "5s", "10s", "15s", "30s", "60s"), "${project.renderSettings.durationSeconds}s") {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(durationSeconds = it.removeSuffix("s").toInt())))
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0x3506080D))
                    .border(1.dp, Color(0x22FFFFFF), RoundedCornerShape(16.dp))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Audio & SFX (AAC)", color = GlassTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        if (hasAudioInCode) "$cueCount SFX · bed: $ambienceName"
                        else "Tambahkan blok audio di studio-meta",
                        color = if (hasAudioInCode) GlassMintDot else GlassTextMuted,
                        fontSize = 10.sp
                    )
                }
                Switch(
                    checked = project.renderSettings.includeAudio,
                    onCheckedChange = { onProjectChange(project.copy(renderSettings = project.renderSettings.copy(includeAudio = it))) },
                    colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = GlassMintDot, uncheckedTrackColor = Color(0x30FFFFFF))
                )
            }
            val (w, h) = project.renderSettings.dimensions()
            val codecLabel = if (project.renderSettings.includeAudio && hasAudioInCode) "H.264 + AAC / MP4" else "H.264 / MP4"
            Text("Output: ${w}×${h} px · ${project.renderSettings.totalFrames()} frames · $codecLabel", color = GlassTextMuted, fontSize = 10.sp)
        }

        GlassPanel {
            Text("EXPORT", color = GlassSilverAccent, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
            if (isRendering) {
                LinearProgressIndicator(
                    progress = { if (renderTotal > 0) renderDone.toFloat() / renderTotal else 0f },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(50)),
                    color = Color.White,
                    trackColor = Color(0x28FFFFFF)
                )
                Text(renderMessage, color = GlassTextSecondary, fontSize = 11.sp)
                GlassSecondaryButton("Cancel Render", onClick = onCancel, modifier = Modifier.fillMaxWidth())
            } else {
                GlassPrimaryButton("Render MP4", onClick = onRender, enabled = ready && exportSupported, modifier = Modifier.fillMaxWidth())
                if (renderMessage.isNotBlank()) Text(renderMessage, color = GlassTextSecondary, fontSize = 11.sp)
            }
        }
        Spacer(Modifier.height(6.dp))
    }
}

@Composable
private fun GalleryScreen(
    activity: MainActivity,
    keyRefresh: Int,
    onShare: (GalleryVideo) -> Unit,
    onDelete: (GalleryVideo) -> Unit
) {
    var videos by remember { mutableStateOf<List<GalleryVideo>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var selectedVideo by remember { mutableStateOf<GalleryVideo?>(null) }

    LaunchedEffect(keyRefresh) {
        loading = true
        videos = withContext(Dispatchers.IO) { runCatching { GalleryRepository(activity).videos() }.getOrDefault(emptyList()) }
        loading = false
    }

    PageColumn {
        SectionHeader("Galeri", "Hasil render MP4 di Movies/CodeToVideoStudio")
        if (loading) {
            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp)
            }
        } else if (videos.isEmpty()) {
            GlassPanel {
                Text("Belum ada video", color = GlassTextPrimary, fontWeight = FontWeight.SemiBold)
                Text("Hasil render MP4 akan muncul di sini setelah divalidasi.", color = GlassTextSecondary, fontSize = 12.sp)
            }
        }
        videos.forEach { video ->
            GlassPanel {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0x26FFFFFF))
                            .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("▶", color = Color.White, fontSize = 16.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(video.name, color = GlassTextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${video.durationLabel()} · ${GalleryRepository(activity).sizeLabel(video.sizeBytes)}", color = GlassTextSecondary, fontSize = 10.sp)
                        Text(video.dateLabel(), color = GlassTextMuted, fontSize = 9.sp)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassPrimaryButton("Putar", onClick = { selectedVideo = video }, modifier = Modifier.weight(1f))
                    GlassSecondaryButton("Bagikan", onClick = { onShare(video) }, modifier = Modifier.weight(1f))
                    GlassMiniPill("Hapus") { onDelete(video) }
                }
            }
        }
        Spacer(Modifier.height(6.dp))
    }

    selectedVideo?.let { video ->
        AlertDialog(
            onDismissRequest = { selectedVideo = null },
            containerColor = Color(0xFF141923),
            title = { Text(video.name, color = GlassTextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 14.sp) },
            text = {
                AndroidView(
                    factory = { ctx ->
                        VideoView(ctx).apply {
                            setMediaController(MediaController(ctx))
                            setVideoURI(video.uri)
                            setOnPreparedListener { player -> player.isLooping = false; start() }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(230.dp).clip(RoundedCornerShape(14.dp))
                )
            },
            confirmButton = { TextButton(onClick = { selectedVideo = null }) { Text("Tutup", color = GlassSilverAccent) } }
        )
    }
}

@Composable
private fun ProjectsScreen(
    activity: MainActivity,
    keyRefresh: Int,
    currentProjectId: String,
    onOpen: (StudioProject) -> Unit,
    onNew: () -> Unit,
    onDuplicate: (StudioProject) -> Unit,
    onRename: (StudioProject, String) -> Unit,
    onDelete: (StudioProject) -> Unit,
    onImport: () -> Unit,
    onExportCurrent: () -> Unit
) {
    var projects by remember { mutableStateOf<List<StudioProject>>(emptyList()) }
    var renameTarget by remember { mutableStateOf<StudioProject?>(null) }
    var renameValue by remember { mutableStateOf("") }
    LaunchedEffect(keyRefresh) { projects = withContext(Dispatchers.IO) { activity.projects.list() } }

    PageColumn {
        SectionHeader("Simpan", "Proyek JSON tersimpan lokal di perangkat.")
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GlassPrimaryButton("+ New Project", onClick = onNew, modifier = Modifier.weight(1f))
            GlassSecondaryButton("Import JSON", onClick = onImport, modifier = Modifier.weight(1f))
        }
        GlassSecondaryButton("Export proyek aktif sebagai JSON", onClick = onExportCurrent, modifier = Modifier.fillMaxWidth())
        if (projects.isEmpty()) GlassPanel { Text("Belum ada proyek tersimpan.", color = GlassTextSecondary, fontSize = 12.sp) }
        projects.forEach { item ->
            GlassPanel {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(item.name, color = GlassTextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text(
                            if (item.projectId == currentProjectId) "PROYEK AKTIF" else "${item.renderSettings.aspect} · ${item.renderSettings.fps} FPS",
                            color = if (item.projectId == currentProjectId) GlassMintDot else GlassTextMuted,
                            fontSize = 10.sp
                        )
                    }
                    GlassMiniPill("Open") { onOpen(item) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassMiniPill("Duplicate") { onDuplicate(item) }
                    GlassMiniPill("Rename") { renameTarget = item; renameValue = item.name }
                    GlassMiniPill("Delete") { onDelete(item) }
                }
            }
        }
        Spacer(Modifier.height(6.dp))
    }

    renameTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            containerColor = Color(0xFF151B25),
            title = { Text("Rename Project", color = GlassTextPrimary) },
            text = {
                OutlinedTextField(
                    value = renameValue,
                    onValueChange = { renameValue = it.take(80) },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp)
                )
            },
            confirmButton = {
                TextButton(onClick = { if (renameValue.isNotBlank()) onRename(target, renameValue.trim()); renameTarget = null }) {
                    Text("Save", color = Color.White)
                }
            },
            dismissButton = { TextButton(onClick = { renameTarget = null }) { Text("Cancel", color = GlassTextSecondary) } }
        )
    }
}

@Composable
private fun DocsScreen(activity: MainActivity, onSave: () -> Unit) {
    val content = remember { activity.assets.open("docs/skill.md").bufferedReader().use { it.readText() } }
    val clipboard = androidx.compose.ui.platform.LocalClipboardManager.current
    PageColumn {
        SectionHeader("Docs v0.3", "Kitab Motion Director, Liquid Glass, 3D & 20 SFX.")
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GlassPrimaryButton("Salin Docs", onClick = {
                clipboard.setText(androidx.compose.ui.text.AnnotatedString(content))
                Toast.makeText(activity, "Docs v0.3 disalin", Toast.LENGTH_SHORT).show()
            }, modifier = Modifier.weight(1f))
            GlassSecondaryButton("Unduh .md", onClick = onSave, modifier = Modifier.weight(1f))
        }
        GlassPanel {
            Text(content, color = Color(0xFFD8E0EC), fontFamily = FontFamily.Monospace, fontSize = 10.sp, lineHeight = 15.sp)
        }
        Spacer(Modifier.height(6.dp))
    }
}
