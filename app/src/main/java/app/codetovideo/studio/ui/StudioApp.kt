package app.codetovideo.studio.ui

import android.content.Intent
import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.widget.MediaController
import android.widget.Toast
import android.widget.VideoView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.CreateDocument
import androidx.activity.result.contract.ActivityResultContracts.OpenDocument
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
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
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
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
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
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
import app.codetovideo.studio.render.AudioAuditionPlayer
import app.codetovideo.studio.storage.GalleryRepository
import app.codetovideo.studio.storage.GalleryVideo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlin.math.abs
import kotlin.math.roundToInt

private enum class StudioTab(val label: String) {
    EDITOR("Editor"),
    RENDER("Render"),
    GALLERY("Galeri"),
    PROJECTS("Simpan"),
    DOCS("Docs")
}

private data class GlassPalette(
    val isLight: Boolean,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val accent: Color,
    val iosBlue: Color,
    val iosGreen: Color,
    val panelTop: Color,
    val panelMid: Color,
    val panelBot: Color,
    val borderTop: Color,
    val borderMid: Color,
    val borderBot: Color,
    val wellBg: Color,
    val dockTop: Color,
    val dockBot: Color,
    val dialogBg: Color
)

private fun glassPalette(light: Boolean): GlassPalette = if (light) {
    GlassPalette(
        isLight = true,
        textPrimary = Color(0xFF0E141D),
        textSecondary = Color(0xFF475569),
        textMuted = Color(0xFF748296),
        accent = Color(0xFF0A84FF),
        iosBlue = Color(0xFF007AFF),
        iosGreen = Color(0xFF34C759),
        panelTop = Color(0xDCFFFFFF),
        panelMid = Color(0xB8F7FAFF),
        panelBot = Color(0xCEFFFFFF),
        borderTop = Color(0xFFFFFFFF),
        borderMid = Color(0x381D3557),
        borderBot = Color(0xE0FFFFFF),
        wellBg = Color(0xADFFFFFF),
        dockTop = Color(0xE6F8FBFF),
        dockBot = Color(0xF0EAF1F9),
        dialogBg = Color(0xFFF4F7FC)
    )
} else {
    GlassPalette(
        isLight = false,
        textPrimary = Color(0xFFF6F8FB),
        textSecondary = Color(0xFFA7B3C4),
        textMuted = Color(0xFF727F92),
        accent = Color(0xFFE9EFF6),
        iosBlue = Color(0xFF4AA3FF),
        iosGreen = Color(0xFF32D74B),
        panelTop = Color(0x28FFFFFF),
        panelMid = Color(0x11FFFFFF),
        panelBot = Color(0x1AFFFFFF),
        borderTop = Color(0x70FFFFFF),
        borderMid = Color(0x2892C5FF),
        borderBot = Color(0x42FFFFFF),
        wellBg = Color(0x8805070C),
        dockTop = Color(0xDC1A212E),
        dockBot = Color(0xEE0D1119),
        dialogBg = Color(0xFF151B26)
    )
}

@Composable
private fun LiquidGlassBackdrop(light: Boolean) {
    val modifier = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        Modifier
            .fillMaxSize()
            .graphicsLayer {
                renderEffect = android.graphics.RenderEffect
                    .createBlurEffect(28f, 28f, android.graphics.Shader.TileMode.CLAMP)
                    .asComposeRenderEffect()
            }
    } else {
        Modifier.fillMaxSize()
    }
    Canvas(modifier = modifier) {
        if (light) {
            drawRect(Brush.verticalGradient(listOf(Color(0xFFEEF3FA), Color(0xFFE4ECF6), Color(0xFFEEF2F8))))
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(Color(0x70A4D0FF), Color(0x26CBE4FF), Color.Transparent),
                    center = Offset(size.width * 0.85f, size.height * 0.14f),
                    radius = size.minDimension * 0.88f
                ),
                radius = size.minDimension * 0.88f,
                center = Offset(size.width * 0.85f, size.height * 0.14f)
            )
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(Color(0x55D4C2F8), Color(0x1AEAE4FB), Color.Transparent),
                    center = Offset(size.width * 0.12f, size.height * 0.78f),
                    radius = size.minDimension * 0.85f
                ),
                radius = size.minDimension * 0.85f,
                center = Offset(size.width * 0.12f, size.height * 0.78f)
            )
        } else {
            drawRect(Brush.verticalGradient(listOf(Color(0xFF090C12), Color(0xFF0E141F), Color(0xFF06080D))))
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(Color(0x42D5E4F7), Color(0x147AA4D6), Color.Transparent),
                    center = Offset(size.width * 0.86f, size.height * 0.12f),
                    radius = size.minDimension * 0.86f
                ),
                radius = size.minDimension * 0.86f,
                center = Offset(size.width * 0.86f, size.height * 0.12f)
            )
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(Color(0x327BA6D8), Color(0x0E4A6588), Color.Transparent),
                    center = Offset(size.width * 0.12f, size.height * 0.82f),
                    radius = size.minDimension * 0.82f
                ),
                radius = size.minDimension * 0.82f,
                center = Offset(size.width * 0.12f, size.height * 0.82f)
            )
        }
    }
}

@Composable
private fun GlassPanel(
    pal: GlassPalette,
    modifier: Modifier = Modifier,
    cornerRadius: Int = 26,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(cornerRadius.dp)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Brush.verticalGradient(listOf(pal.panelTop, pal.panelMid, pal.panelBot)))
            .border(
                width = 1.dp,
                brush = Brush.linearGradient(listOf(pal.borderTop, pal.borderMid, pal.borderBot)),
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
    pal: GlassPalette,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val sc by animateFloatAsState(if (pressed) 0.96f else 1f, spring(0.65f, 520f), label = "btn_sc")
    val shape = RoundedCornerShape(50)
    val bg = when {
        !enabled -> Brush.verticalGradient(listOf(Color(0x30888888), Color(0x20888888)))
        pal.isLight -> Brush.verticalGradient(listOf(Color(0xFF1F2733), Color(0xFF0C1016)))
        else -> Brush.verticalGradient(listOf(Color(0xFFFFFFFF), Color(0xFFD6DEE8)))
    }
    Box(
        modifier = modifier
            .height(46.dp)
            .scale(sc)
            .clip(shape)
            .background(bg)
            .border(1.dp, if (pal.isLight) Color(0x44FFFFFF) else Color(0xAAFFFFFF), shape)
            .clickable(interactionSource = interaction, indication = null, enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = when {
                !enabled -> pal.textMuted
                pal.isLight -> Color.White
                else -> Color(0xFF0B0F15)
            },
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp
        )
    }
}

@Composable
private fun GlassSecondaryButton(
    text: String,
    pal: GlassPalette,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val sc by animateFloatAsState(if (pressed) 0.96f else 1f, spring(0.65f, 520f), label = "sec_sc")
    val shape = RoundedCornerShape(50)
    Box(
        modifier = modifier
            .height(44.dp)
            .scale(sc)
            .clip(shape)
            .background(Brush.verticalGradient(listOf(pal.panelTop, pal.panelMid, pal.panelBot)))
            .border(1.dp, Brush.linearGradient(listOf(pal.borderTop, pal.borderMid, pal.borderBot)), shape)
            .clickable(interactionSource = interaction, indication = null, enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = if (enabled) pal.textPrimary else pal.textMuted,
            fontWeight = FontWeight.Medium,
            fontSize = 12.sp
        )
    }
}

@Composable
private fun GlassMiniPill(label: String, pal: GlassPalette, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Box(
        modifier = Modifier
            .clip(shape)
            .background(if (pal.isLight) Color(0xD8FFFFFF) else Color(0x24FFFFFF))
            .border(1.dp, if (pal.isLight) Color(0x401D3557) else Color(0x42FFFFFF), shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = pal.textPrimary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun LiquidGlassSwitch(
    checked: Boolean,
    pal: GlassPalette,
    onCheckedChange: (Boolean) -> Unit
) {
    val haptic = LocalHapticFeedback.current
    var pressed by remember { mutableStateOf(false) }
    val trackCol by animateColorAsState(
        targetValue = if (checked) pal.iosGreen else (if (pal.isLight) Color(0x2A101828) else Color(0x32FFFFFF)),
        animationSpec = tween(220),
        label = "sw_track"
    )
    val thumbOffset by animateDpAsState(
        targetValue = if (checked) 24.dp else 2.dp,
        animationSpec = spring(dampingRatio = 0.68f, stiffness = 460f),
        label = "sw_pos"
    )
    val thumbW by animateDpAsState(if (pressed) 34.dp else 28.dp, spring(0.65f, 520f), label = "sw_w")
    val thumbH by animateDpAsState(if (pressed) 28.dp else 24.dp, spring(0.65f, 520f), label = "sw_h")
    val shape = RoundedCornerShape(50)

    Box(
        modifier = Modifier
            .width(56.dp)
            .height(30.dp)
            .clip(shape)
            .background(trackCol)
            .border(1.dp, if (checked) Color(0x66FFFFFF) else pal.borderMid, shape)
            .pointerInput(checked) {
                detectTapGestures(
                    onPress = { pressed = true; tryAwaitRelease(); pressed = false },
                    onTap = { haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove); onCheckedChange(!checked) }
                )
            },
        contentAlignment = Alignment.CenterStart
    ) {
        val adjX = if (pressed && checked) (thumbOffset - 6.dp).coerceAtLeast(2.dp) else thumbOffset
        Box(
            modifier = Modifier
                .offset(x = adjX)
                .width(thumbW)
                .height(thumbH)
                .clip(shape)
                .background(
                    if (pressed) Brush.verticalGradient(listOf(Color(0x99FFFFFF), Color(0x40FFFFFF), Color(0x78FFFFFF)))
                    else Brush.verticalGradient(listOf(Color(0xFFFFFFFF), Color(0xFFE8EEF5)))
                )
                .border(1.dp, Brush.linearGradient(listOf(Color(0xEEFFFFFF), Color(0x55A4D4FF), Color(0xBBFFFFFF))), shape)
        )
    }
}

@Composable
private fun LiquidGlassSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    valueRange: ClosedFloatingPointRange<Float>,
    pal: GlassPalette,
    modifier: Modifier = Modifier
) {
    val latestOnChange by rememberUpdatedState(onValueChange)
    val span = (valueRange.endInclusive - valueRange.start).coerceAtLeast(0.0001f)
    val frac = ((value - valueRange.start) / span).coerceIn(0f, 1f)
    var dragging by remember { mutableStateOf(false) }

    val thumbW by animateDpAsState(if (dragging) 38.dp else 30.dp, spring(0.65f, 460f), label = "sl_w")
    val thumbH by animateDpAsState(if (dragging) 24.dp else 20.dp, spring(0.65f, 460f), label = "sl_h")

    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .height(34.dp)
            .pointerInput(valueRange) {
                detectTapGestures { pos ->
                    val u = (pos.x / size.width.coerceAtLeast(1)).coerceIn(0f, 1f)
                    latestOnChange(valueRange.start + u * span)
                }
            }
            .pointerInput(valueRange) {
                detectHorizontalDragGestures(
                    onDragStart = { pos ->
                        dragging = true
                        val u = (pos.x / size.width.coerceAtLeast(1)).coerceIn(0f, 1f)
                        latestOnChange(valueRange.start + u * span)
                    },
                    onDragEnd = { dragging = false },
                    onDragCancel = { dragging = false },
                    onHorizontalDrag = { change, _ ->
                        change.consume()
                        val u = (change.position.x / size.width.coerceAtLeast(1)).coerceIn(0f, 1f)
                        latestOnChange(valueRange.start + u * span)
                    }
                )
            },
        contentAlignment = Alignment.CenterStart
    ) {
        val trackShape = RoundedCornerShape(50)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(trackShape)
                .background(if (pal.isLight) Color(0x28101828) else Color(0x2EFFFFFF))
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(frac.coerceAtLeast(0.02f))
                .height(6.dp)
                .clip(trackShape)
                .background(if (pal.isLight) pal.iosBlue else Color.White)
        )
        val travel = (maxWidth - thumbW).coerceAtLeast(0.dp)
        val xPos = travel * frac
        Box(
            modifier = Modifier
                .offset(x = xPos)
                .width(thumbW)
                .height(thumbH)
                .clip(trackShape)
                .background(
                    if (dragging) Brush.verticalGradient(listOf(Color(0x90FFFFFF), Color(0x36FFFFFF), Color(0x70FFFFFF)))
                    else Brush.verticalGradient(listOf(Color(0xF5FFFFFF), Color(0xD8E7EEF7)))
                )
                .border(1.dp, Brush.linearGradient(listOf(Color(0xFFFFFFFF), Color(0x6692CCFF), Color(0xCCFFFFFF))), trackShape)
        )
    }
}

@Composable
private fun GlassSegmentBar(
    title: String,
    options: List<String>,
    selected: String,
    pal: GlassPalette,
    onSelect: (String) -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val latestSelect by rememberUpdatedState(onSelect)
    val selectedIdx = options.indexOf(selected).coerceAtLeast(0)
    var dragging by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(title, color = pal.textSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        val trackShape = RoundedCornerShape(50)
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .height(40.dp)
                .clip(trackShape)
                .background(if (pal.isLight) Color(0x1E15243A) else pal.wellBg)
                .border(1.dp, pal.borderMid, trackShape)
                .padding(3.dp)
                .pointerInput(options) {
                    detectHorizontalDragGestures(
                        onDragStart = { dragging = true },
                        onDragEnd = { dragging = false },
                        onDragCancel = { dragging = false },
                        onHorizontalDrag = { change, _ ->
                            change.consume()
                            val idx = ((change.position.x / size.width.coerceAtLeast(1)) * options.size)
                                .toInt().coerceIn(0, options.lastIndex)
                            if (options[idx] != selected) {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                latestSelect(options[idx])
                            }
                        }
                    )
                }
        ) {
            val itemW = maxWidth / options.size.coerceAtLeast(1)
            val indicatorX by animateDpAsState(itemW * selectedIdx, spring(0.72f, 430f), label = "seg_x")
            val lensScale by animateFloatAsState(if (dragging) 1.04f else 1f, spring(0.6f, 420f), label = "seg_sc")
            val pillShape = RoundedCornerShape(50)

            Box(
                modifier = Modifier
                    .offset(x = indicatorX)
                    .width(itemW)
                    .fillMaxHeight()
                    .scale(lensScale)
                    .clip(pillShape)
                    .background(
                        if (pal.isLight) Brush.verticalGradient(listOf(Color(0xFFFFFFFF), Color(0xF2F3F7FC)))
                        else Brush.verticalGradient(listOf(Color(0x64FFFFFF), Color(0x28FFFFFF), Color(0x46FFFFFF)))
                    )
                    .border(1.dp, Brush.linearGradient(listOf(Color(0xDDFFFFFF), Color(0x4891C8FF), Color(0x99FFFFFF))), pillShape)
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
                                onClick = { haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove); onSelect(opt) }
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = opt,
                            color = if (isSel) pal.textPrimary else pal.textSecondary,
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

@Composable
private fun AppBrandLogo(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier = modifier
            .size(38.dp)
            .clip(shape)
            .background(Brush.linearGradient(listOf(Color(0xFFECEFF3), Color(0xFFA7B0BA), Color(0xFF4F5762))))
            .border(1.dp, Color(0xBBFFFFFF), shape),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(26.dp)) {
            val w = size.width; val h = size.height
            val leaf = Path().apply {
                moveTo(w * 0.52f, h * 0.24f)
                cubicTo(w * 0.51f, h * 0.12f, w * 0.62f, h * 0.04f, w * 0.72f, h * 0.04f)
                cubicTo(w * 0.73f, h * 0.15f, w * 0.63f, h * 0.24f, w * 0.52f, h * 0.24f)
                close()
            }
            drawPath(leaf, color = Color.White)
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
            drawPath(apple, brush = Brush.verticalGradient(listOf(Color.White, Color(0xFFD5DCE4))))
            val play = Path().apply {
                moveTo(w * 0.45f, h * 0.54f); lineTo(w * 0.61f, h * 0.63f); lineTo(w * 0.45f, h * 0.72f); close()
            }
            drawPath(play, color = Color(0xFF47505C))
        }
    }
}

@Composable
private fun IosTabIcon(tab: StudioTab, active: Boolean, pal: GlassPalette) {
    val tint = if (active) (if (pal.isLight) pal.iosBlue else Color.White) else pal.textSecondary
    val iconScale by animateFloatAsState(if (active) 1.12f else 0.96f, spring(0.55f, 420f), label = "ic_sc")
    Canvas(modifier = Modifier.size(20.dp).scale(iconScale)) {
        val w = size.width; val h = size.height
        val sw = if (active) 2.15.dp.toPx() else 1.65.dp.toPx()
        val stroke = Stroke(width = sw, cap = StrokeCap.Round, join = StrokeJoin.Round)
        when (tab) {
            StudioTab.EDITOR -> {
                val left = Path().apply { moveTo(w * 0.36f, h * 0.24f); lineTo(w * 0.14f, h * 0.50f); lineTo(w * 0.36f, h * 0.76f) }
                val right = Path().apply { moveTo(w * 0.64f, h * 0.24f); lineTo(w * 0.86f, h * 0.50f); lineTo(w * 0.64f, h * 0.76f) }
                drawPath(left, tint, style = stroke); drawPath(right, tint, style = stroke)
                drawLine(tint, Offset(w * 0.56f, h * 0.20f), Offset(w * 0.44f, h * 0.80f), strokeWidth = sw, cap = StrokeCap.Round)
            }
            StudioTab.RENDER -> {
                drawCircle(tint, radius = w * 0.42f, style = stroke)
                val tri = Path().apply { moveTo(w * 0.42f, h * 0.34f); lineTo(w * 0.68f, h * 0.50f); lineTo(w * 0.42f, h * 0.66f); close() }
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
                    moveTo(w * 0.12f, h * 0.26f); lineTo(w * 0.40f, h * 0.26f); lineTo(w * 0.50f, h * 0.36f)
                    lineTo(w * 0.88f, h * 0.36f); lineTo(w * 0.88f, h * 0.78f); lineTo(w * 0.12f, h * 0.78f); close()
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

@Composable
private fun FloatingLiquidGlassDockRow(
    selectedTab: StudioTab,
    pal: GlassPalette,
    onSelect: (StudioTab) -> Unit,
    onOrbClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val tabs = StudioTab.entries
    val selectedIdx = tabs.indexOf(selectedTab).coerceAtLeast(0)
    val haptic = LocalHapticFeedback.current
    val density = LocalDensity.current
    val latestSelect by rememberUpdatedState(onSelect)

    var isDragging by remember { mutableStateOf(false) }
    var dragFrac by remember { mutableFloatStateOf(selectedIdx.toFloat()) }
    var dragVel by remember { mutableFloatStateOf(0f) }

    val animatedFrac by animateFloatAsState(
        targetValue = if (isDragging) dragFrac else selectedIdx.toFloat(),
        animationSpec = if (isDragging) spring(0.85f, 900f) else spring(0.64f, 350f),
        label = "dock_frac"
    )
    val lensInflate by animateFloatAsState(if (isDragging) 1.12f else 1.0f, spring(0.58f, 400f), label = "dock_inflate")
    val stretchX by animateFloatAsState(if (isDragging) (1f + (abs(dragVel) * 0.008f).coerceAtMost(0.16f)) else 1f, spring(0.62f, 460f), label = "dock_stretch")
    val dockShape = RoundedCornerShape(34.dp)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .weight(1f)
                .height(64.dp)
                .clip(dockShape)
                .background(Brush.verticalGradient(listOf(pal.dockTop, pal.dockBot)))
                .border(1.dp, Brush.linearGradient(listOf(pal.borderTop, pal.borderMid, pal.borderBot)), dockShape)
                .padding(5.dp)
                .pointerInput(tabs.size) {
                    detectHorizontalDragGestures(
                        onDragStart = { pos ->
                            isDragging = true
                            val raw = ((pos.x / size.width.coerceAtLeast(1)) * tabs.size - 0.5f).coerceIn(0f, (tabs.size - 1).toFloat())
                            dragFrac = raw
                            val nearest = raw.roundToInt().coerceIn(0, tabs.lastIndex)
                            if (tabs[nearest] != selectedTab) {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                latestSelect(tabs[nearest])
                            }
                        },
                        onDragEnd = {
                            isDragging = false; dragVel = 0f
                            latestSelect(tabs[dragFrac.roundToInt().coerceIn(0, tabs.lastIndex)])
                        },
                        onDragCancel = { isDragging = false; dragVel = 0f },
                        onHorizontalDrag = { change, dragAmount ->
                            change.consume(); dragVel = dragAmount
                            val raw = ((change.position.x / size.width.coerceAtLeast(1)) * tabs.size - 0.5f).coerceIn(0f, (tabs.size - 1).toFloat())
                            dragFrac = raw
                            val nearest = raw.roundToInt().coerceIn(0, tabs.lastIndex)
                            if (tabs[nearest] != selectedTab) {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                latestSelect(tabs[nearest])
                            }
                        }
                    )
                }
        ) {
            val tabWidth = maxWidth / tabs.size
            val xOffsetDp = with(density) { (tabWidth.toPx() * animatedFrac).toDp() }
            val pillShape = RoundedCornerShape(28.dp)

            Box(
                modifier = Modifier
                    .offset(x = xOffsetDp)
                    .width(tabWidth)
                    .fillMaxHeight()
                    .graphicsLayer {
                        scaleX = lensInflate * stretchX
                        scaleY = lensInflate / (1f + (stretchX - 1f) * 0.45f)
                    }
                    .clip(pillShape)
                    .background(
                        if (pal.isLight) Brush.verticalGradient(listOf(Color(0xF8FFFFFF), Color(0xCEF0F6FD), Color(0xF0FFFFFF)))
                        else Brush.verticalGradient(listOf(Color(0x66FFFFFF), Color(0x20FFFFFF), Color(0x46FFFFFF)))
                    )
                    .border(
                        width = if (isDragging) 1.5.dp else 1.dp,
                        brush = Brush.linearGradient(listOf(Color(0xF0FFFFFF), Color(0x7882C6FF), Color(0x44FFB8DC), Color(0xBBFFFFFF))),
                        shape = pillShape
                    )
            )

            Row(modifier = Modifier.fillMaxSize()) {
                tabs.forEachIndexed { idx, tab ->
                    val isNear = abs(animatedFrac - idx) < 0.5f
                    val magScale = if (isDragging && isNear) 1.12f else if (tab == selectedTab) 1.03f else 0.95f
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .scale(magScale)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                onClick = { haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove); onSelect(tab) }
                            ),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        IosTabIcon(tab = tab, active = isNear, pal = pal)
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = tab.label,
                            color = if (isNear) (if (pal.isLight) pal.iosBlue else Color.White) else pal.textSecondary,
                            fontSize = 9.5.sp,
                            fontWeight = if (isNear) FontWeight.SemiBold else FontWeight.Normal,
                            maxLines = 1
                        )
                    }
                }
            }
        }

        val orbInteraction = remember { MutableInteractionSource() }
        val orbPressed by orbInteraction.collectIsPressedAsState()
        val orbScale by animateFloatAsState(if (orbPressed) 0.88f else 1f, spring(0.55f, 480f), label = "orb_sc")
        Box(
            modifier = Modifier
                .size(58.dp)
                .scale(orbScale)
                .clip(CircleShape)
                .background(Brush.verticalGradient(listOf(pal.dockTop, pal.dockBot)))
                .border(1.2.dp, Brush.linearGradient(listOf(Color(0xEEFFFFFF), Color(0x668CC6FF), Color(0x99FFFFFF))), CircleShape)
                .clickable(interactionSource = orbInteraction, indication = null) {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress); onOrbClick()
                },
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.size(22.dp)) {
                val w = size.width; val h = size.height
                val tint = if (pal.isLight) pal.iosBlue else Color.White
                if (selectedTab == StudioTab.RENDER) {
                    drawArc(tint, -60f, 290f, false, style = Stroke(2.2.dp.toPx(), cap = StrokeCap.Round))
                    val tip = Path().apply { moveTo(w * 0.78f, h * 0.14f); lineTo(w * 0.92f, h * 0.34f); lineTo(w * 0.66f, h * 0.34f); close() }
                    drawPath(tip, tint)
                } else {
                    val tri = Path().apply { moveTo(w * 0.30f, h * 0.18f); lineTo(w * 0.84f, h * 0.50f); lineTo(w * 0.30f, h * 0.82f); close() }
                    drawPath(tri, tint)
                }
            }
        }
    }
}

private fun queryDisplayName(activity: MainActivity, uri: Uri): String {
    return runCatching {
        activity.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    }.getOrNull() ?: uri.lastPathSegment?.substringAfterLast('/') ?: "Voiceover Audio"
}

@Composable
fun StudioApp(activity: MainActivity) {
    val repository = activity.projects
    var project by remember { mutableStateOf(repository.loadOrCreate()) }
    var selectedTab by remember { mutableStateOf(StudioTab.EDITOR) }
    var isLightGlass by remember { mutableStateOf(false) }
    var savedLabel by remember { mutableStateOf("Tersimpan") }
    var renderReady by remember { mutableStateOf(false) }
    var exportSupported by remember { mutableStateOf(false) }
    var isRendering by remember { mutableStateOf(false) }
    var renderDone by remember { mutableIntStateOf(0) }
    var renderTotal by remember { mutableIntStateOf(0) }
    var renderStartMs by remember { mutableLongStateOf(0L) }
    var liveRenderBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var renderMessage by remember { mutableStateOf("") }
    var refreshProjects by remember { mutableIntStateOf(0) }
    var refreshGallery by remember { mutableIntStateOf(0) }
    var previewTick by remember { mutableIntStateOf(0) }
    var creatorMode by remember { mutableStateOf(true) }
    var showAiSettings by remember { mutableStateOf(false) }
    var showQuickRevise by remember { mutableStateOf(false) }
    val aiHistory = remember { androidx.compose.runtime.mutableStateListOf<StudioProject>() }

    val pal = remember(isLightGlass) { glassPalette(isLightGlass) }

    LaunchedEffect(project.projectId, project.name, project.sourceBody, project.propsValues, project.renderSettings) {
        delay(650)
        runCatching { repository.save(project) }
            .onSuccess { savedLabel = "Tersimpan lokal"; refreshProjects++ }
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
    val pickVoiceover = rememberLauncherForActivityResult(OpenDocument()) { uri: Uri? ->
        if (uri != null) {
            runCatching { activity.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
            val name = queryDisplayName(activity, uri).take(60)
            project = project.copy(renderSettings = project.renderSettings.copy(voiceoverUri = uri.toString(), voiceoverName = name, includeAudio = true))
            Toast.makeText(activity, "Audio dipilih: $name", Toast.LENGTH_SHORT).show()
        }
    }
    val saveDocs = rememberLauncherForActivityResult(CreateDocument("text/markdown")) { uri: Uri? ->
        if (uri != null) runCatching {
            activity.assets.open("docs/skill.md").use { input ->
                activity.contentResolver.openOutputStream(uri, "wt")?.use { output -> input.copyTo(output) }
                    ?: throw IllegalStateException("File tujuan tidak bisa dibuka.")
            }
        }.onSuccess { Toast.makeText(activity, "Dokumentasi v1.0 disimpan", Toast.LENGTH_SHORT).show() }
            .onFailure { Toast.makeText(activity, it.message ?: "Gagal menyimpan Docs", Toast.LENGTH_LONG).show() }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LiquidGlassBackdrop(light = isLightGlass)

        Box(modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
            Column(modifier = Modifier.fillMaxSize()) {
                TopGlassHeader(
                    projectName = project.name,
                    status = savedLabel,
                    webReady = renderReady,
                    pal = pal,
                    onToggleTheme = { isLightGlass = !isLightGlass }
                )
                LiquidModeSwitcherBar(
                    creatorMode = creatorMode,
                    isLight = isLightGlass,
                    showQuickReviseBtn = (selectedTab == StudioTab.RENDER && !isRendering),
                    canUndo = aiHistory.isNotEmpty(),
                    onModeChange = { isCreator ->
                        creatorMode = isCreator
                        if (isCreator && selectedTab != StudioTab.EDITOR && selectedTab != StudioTab.RENDER) {
                            selectedTab = StudioTab.EDITOR
                        }
                    },
                    onOpenAiSettings = { showAiSettings = true },
                    onQuickRevise = { showQuickRevise = true },
                    onUndo = {
                        if (aiHistory.isNotEmpty()) {
                            project = aiHistory.removeAt(aiHistory.lastIndex)
                            previewTick++
                            Toast.makeText(activity, "Kembali ke versi sebelumnya", Toast.LENGTH_SHORT).show()
                        }
                    }
                )
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    AnimatedContent(
                        targetState = selectedTab,
                        transitionSpec = { fadeIn(tween(180, delayMillis = 60)) togetherWith fadeOut(tween(110)) },
                        label = "tab_content"
                    ) { tab ->
                        when (tab) {
                            StudioTab.EDITOR -> if (creatorMode) {
                                AiCreatorScreen(
                                    activity = activity,
                                    project = project,
                                    isLight = isLightGlass,
                                    canUndo = aiHistory.isNotEmpty(),
                                    onApplyGenerated = { newProject ->
                                        aiHistory.add(project)
                                        if (aiHistory.size > 10) aiHistory.removeAt(0)
                                        project = newProject
                                        selectedTab = StudioTab.RENDER
                                        previewTick++
                                    },
                                    onUndo = {
                                        if (aiHistory.isNotEmpty()) {
                                            project = aiHistory.removeAt(aiHistory.lastIndex)
                                            previewTick++
                                            Toast.makeText(activity, "Kembali ke versi sebelumnya", Toast.LENGTH_SHORT).show()
                                        }
                                    },
                                    onOpenSettings = { showAiSettings = true },
                                    onSwitchToPro = { creatorMode = false },
                                    onGoRender = { selectedTab = StudioTab.RENDER; previewTick++ }
                                )
                            } else {
                                EditorScreen(
                                    activity = activity,
                                    project = project,
                                    pal = pal,
                                    onProjectChange = { project = it },
                                    onImport = { importProject.launch(arrayOf("application/json", "text/json")) },
                                    onExport = { exportProject.launch("${project.name.replace(Regex("[^A-Za-z0-9_-]"), "_")}.json") }
                                )
                            }
                            StudioTab.RENDER -> RenderScreen(
                                activity = activity,
                                project = project,
                                pal = pal,
                                onProjectChange = { project = it },
                                runtime = activity.canvasRuntime,
                                ready = renderReady,
                                exportSupported = exportSupported,
                                isRendering = isRendering,
                                renderDone = renderDone,
                                renderTotal = renderTotal,
                                renderStartMs = renderStartMs,
                                liveBitmap = liveRenderBitmap,
                                renderMessage = renderMessage,
                                externalRefreshTick = previewTick,
                                onPickVoiceover = { pickVoiceover.launch(arrayOf("audio/*")) },
                                onPreview = { activity.canvasRuntime.preview(project, it) },
                                onRender = {
                                    renderMessage = "Memuat 36 Studio SFX & Voiceover, menyiapkan encoder MP4…"
                                    isRendering = true
                                    renderDone = 0
                                    renderTotal = project.renderSettings.totalFrames()
                                    renderStartMs = System.currentTimeMillis()
                                    liveRenderBitmap = null
                                    activity.renderController.render(
                                        project,
                                        onProgress = { done, total ->
                                            renderDone = done
                                            renderTotal = total
                                            renderMessage = "Merender frame $done dari $total"
                                        },
                                        onLiveFrame = { bmp -> liveRenderBitmap = bmp },
                                        onComplete = { result ->
                                            isRendering = false
                                            liveRenderBitmap = null
                                            result.onSuccess {
                                                renderMessage = "MP4 selesai divalidasi & disimpan ke Movies/CodeToVideoStudio"
                                                refreshGallery++
                                                Toast.makeText(activity, "Video tersimpan di Galeri", Toast.LENGTH_LONG).show()
                                            }.onFailure { error ->
                                                renderMessage = error.message?.takeIf { it.isNotBlank() } ?: "${error::class.java.simpleName}: Render gagal."
                                                Toast.makeText(activity, renderMessage, Toast.LENGTH_LONG).show()
                                            }
                                        }
                                    )
                                },
                                onCancel = { activity.renderController.cancel(); liveRenderBitmap = null; renderMessage = "Permintaan pembatalan dikirim." }
                            )
                            StudioTab.GALLERY -> GalleryScreen(
                                activity = activity,
                                pal = pal,
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
                                pal = pal,
                                keyRefresh = refreshProjects,
                                currentProjectId = project.projectId,
                                onOpen = { opened -> project = opened; selectedTab = StudioTab.EDITOR },
                                onNew = { project = repository.save(StudioProject(name = "New Liquid Motion")); selectedTab = StudioTab.EDITOR },
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
                            StudioTab.DOCS -> DocsScreen(activity = activity, pal = pal, onSave = { saveDocs.launch("render-video-code-skill-v1.0.md") })
                        }
                    }
                }
            }

            FloatingLiquidGlassDockRow(
                selectedTab = selectedTab,
                pal = pal,
                onSelect = { selectedTab = it },
                onOrbClick = {
                    if (selectedTab != StudioTab.RENDER) selectedTab = StudioTab.RENDER
                    else if (!isRendering) previewTick++
                },
                modifier = Modifier.align(Alignment.BottomCenter)
            )

            if (showQuickRevise) {
                AiQuickReviseOverlay(
                    activity = activity,
                    project = project,
                    isLight = isLightGlass,
                    onDismiss = { showQuickRevise = false },
                    onOpenSettings = { showQuickRevise = false; showAiSettings = true },
                    onRevised = { updated ->
                        aiHistory.add(project)
                        if (aiHistory.size > 10) aiHistory.removeAt(0)
                        project = updated
                        previewTick++
                        showQuickRevise = false
                    }
                )
            }
            if (showAiSettings) {
                AiSettingsOverlay(
                    activity = activity,
                    isLight = isLightGlass,
                    onDismiss = { showAiSettings = false }
                )
            }
        }
    }
}

@Composable
private fun TopGlassHeader(
    projectName: String,
    status: String,
    webReady: Boolean,
    pal: GlassPalette,
    onToggleTheme: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AppBrandLogo()
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text("Render Video Code", color = pal.textPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp, letterSpacing = (-0.2).sp)
            Text(projectName, color = pal.textSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(Brush.verticalGradient(listOf(pal.panelTop, pal.panelBot)))
                .border(1.dp, pal.borderTop, CircleShape)
                .clickable(onClick = onToggleTheme),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.size(16.dp)) {
                val c = pal.textPrimary
                if (pal.isLight) {
                    drawCircle(c, radius = size.minDimension * 0.40f)
                    drawCircle(pal.panelTop, radius = size.minDimension * 0.32f, center = Offset(size.width * 0.66f, size.height * 0.34f))
                } else {
                    drawCircle(c, radius = size.minDimension * 0.24f)
                    for (i in 0 until 8) {
                        val a = i * (Math.PI / 4.0)
                        val sx = center.x + (kotlin.math.cos(a) * size.minDimension * 0.34f).toFloat()
                        val sy = center.y + (kotlin.math.sin(a) * size.minDimension * 0.34f).toFloat()
                        val ex = center.x + (kotlin.math.cos(a) * size.minDimension * 0.46f).toFloat()
                        val ey = center.y + (kotlin.math.sin(a) * size.minDimension * 0.46f).toFloat()
                        drawLine(c, Offset(sx, sy), Offset(ex, ey), strokeWidth = 1.6.dp.toPx(), cap = StrokeCap.Round)
                    }
                }
            }
        }
        Spacer(Modifier.width(8.dp))
        val pillShape = RoundedCornerShape(50)
        Column(horizontalAlignment = Alignment.End) {
            Row(
                modifier = Modifier
                    .clip(pillShape)
                    .background(Brush.verticalGradient(listOf(pal.panelTop, pal.panelBot)))
                    .border(1.dp, pal.borderMid, pillShape)
                    .padding(horizontal = 9.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(Modifier.size(6.dp).background(if (webReady) pal.iosGreen else Color(0xFFFFC966), CircleShape))
                Spacer(Modifier.width(5.dp))
                Text("v1.0", color = pal.textPrimary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Text(status, color = pal.textMuted, fontSize = 8.5.sp)
        }
    }
}

@Composable
private fun PageColumn(
    scrollState: androidx.compose.foundation.ScrollState = rememberScrollState(),
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        content = content
    )
}

@Composable
private fun SectionHeader(title: String, subtitle: String, pal: GlassPalette) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, color = pal.textPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)
        Text(subtitle, color = pal.textSecondary, fontSize = 12.sp)
    }
}

@Composable
private fun SfxAuditionDialog(
    activity: MainActivity,
    pal: GlassPalette,
    onDismiss: () -> Unit
) {
    SfxStudioManagerDialog(activity = activity, isLight = pal.isLight, onDismiss = onDismiss)
}

@Composable
private fun EditorScreen(
    activity: MainActivity,
    project: StudioProject,
    pal: GlassPalette,
    onProjectChange: (StudioProject) -> Unit,
    onImport: () -> Unit,
    onExport: () -> Unit
) {
    val parsed = remember(project.sourceBody) { runCatching { ProjectMetadataParser.parse(project.sourceBody) } }
    val clipboard = LocalClipboardManager.current
    var showTemplates by remember { mutableStateOf(false) }
    var showAudition by remember { mutableStateOf(false) }

    PageColumn {
        SectionHeader("Editor Pro", "Engine v1.0 · Cinema 3D PBR · 36 Studio Acoustic SFX, Live Render & Voiceover.", pal)
        GlassPanel(pal) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("SOURCE.JS", color = pal.textPrimary, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, letterSpacing = 0.8.sp)
                    Text("${project.sourceBody.length} / 262.144 karakter", color = pal.textMuted, fontSize = 10.sp)
                }
                GlassMiniPill("Templates", pal) { showTemplates = true }
                GlassMiniPill("Reset", pal) {
                    onProjectChange(project.copy(sourceBody = app.codetovideo.studio.core.DEFAULT_SOURCE, propsValues = emptyMap()))
                }
            }
            // Bar aksi cepat Tempel / Salin / Hapus (praktis untuk kode panjang)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassMiniPill("Tempel", pal) {
                    val clip = clipboard.getText()?.text.orEmpty()
                    if (clip.isNotBlank()) {
                        onProjectChange(project.copy(sourceBody = clip.take(ProjectMetadataParser.MAX_SOURCE_CHARS)))
                        Toast.makeText(activity, "Kode ditempel (${clip.length} karakter)", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(activity, "Clipboard kosong", Toast.LENGTH_SHORT).show()
                    }
                }
                GlassMiniPill("Salin", pal) {
                    clipboard.setText(AnnotatedString(project.sourceBody))
                    Toast.makeText(activity, "SOURCE.JS disalin", Toast.LENGTH_SHORT).show()
                }
                GlassMiniPill("Hapus", pal) {
                    onProjectChange(project.copy(sourceBody = ""))
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(310.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(pal.wellBg)
                    .border(1.dp, pal.borderMid, RoundedCornerShape(16.dp))
                    .padding(14.dp)
            ) {
                BasicTextField(
                    value = project.sourceBody,
                    onValueChange = { value -> if (value.length <= ProjectMetadataParser.MAX_SOURCE_CHARS) onProjectChange(project.copy(sourceBody = value)) },
                    modifier = Modifier.fillMaxSize(),
                    textStyle = TextStyle(color = pal.textPrimary, fontFamily = FontFamily.Monospace, fontSize = 11.sp, lineHeight = 16.sp),
                    cursorBrush = SolidColor(pal.iosBlue)
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GlassSecondaryButton("Import JSON", pal, onClick = onImport, modifier = Modifier.weight(1f))
                GlassSecondaryButton("Export JSON", pal, onClick = onExport, modifier = Modifier.weight(1f))
            }
        }
        if (parsed.isFailure) {
            GlassPanel(pal) {
                Text("Metadata Error", color = Color(0xFFFF6B7A), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text(parsed.exceptionOrNull()?.message ?: "Metadata tidak valid.", color = pal.textSecondary, fontSize = 12.sp)
            }
        } else {
            val metadata = parsed.getOrThrow()
            if (metadata.audio.cues.isNotEmpty() || metadata.audio.ambience != "none") {
                GlassPanel(pal) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(8.dp).background(pal.iosGreen, CircleShape))
                        Spacer(Modifier.width(8.dp))
                        Text("REAL STUDIO SFX READY", color = pal.textPrimary, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, letterSpacing = 0.8.sp)
                        Spacer(Modifier.weight(1f))
                        GlassMiniPill("▶ Studio SFX", pal) { showAudition = true }
                    }
                    Text(
                        "Bed: ${metadata.audio.ambience} · ${metadata.audio.cues.size} cues WAV asli sinkron otomatis ke AAC MP4.",
                        color = pal.textSecondary, fontSize = 12.sp
                    )
                }
            }
            PropsPanel(metadata = metadata, values = project.propsValues, pal = pal, onChange = { onProjectChange(project.copy(propsValues = it)) })
        }
    }

    if (showAudition) SfxAuditionDialog(activity = activity, pal = pal, onDismiss = { showAudition = false })

    if (showTemplates) {
        AlertDialog(
            onDismissRequest = { showTemplates = false },
            containerColor = pal.dialogBg,
            title = { Text("Template v1.0 Cinema 3D Motion Director", color = pal.textPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassSecondaryButton("iOS 26 Liquid Glass Hero (5s)", pal, onClick = {
                        onProjectChange(project.copy(name = "iOS 26 Liquid Glass Hero", sourceBody = app.codetovideo.studio.core.DEFAULT_SOURCE, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 5)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                    GlassSecondaryButton("Swiss Data Editorial · Spline + Counter (10s)", pal, onClick = {
                        onProjectChange(project.copy(name = "Swiss Data Editorial", sourceBody = app.codetovideo.studio.core.StudioTemplates.DATA_STORY, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 10)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                    GlassSecondaryButton("3D Character Story · Little Botanist (15s)", pal, onClick = {
                        onProjectChange(project.copy(name = "3D Character Story", sourceBody = app.codetovideo.studio.core.StudioTemplates.CHARACTER_STORY_3D, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 15)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                    GlassSecondaryButton("3D GPU Chrome Monolith · WebGL (10s)", pal, onClick = {
                        onProjectChange(project.copy(name = "3D GPU Chrome Monolith", sourceBody = app.codetovideo.studio.core.StudioTemplates.CHROME_3D_GPU, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 10)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                    GlassSecondaryButton("3D GPU Velvet Rose · WebGL (10s)", pal, onClick = {
                        onProjectChange(project.copy(name = "3D Velvet Rose Cinema", sourceBody = app.codetovideo.studio.core.StudioTemplates.BOTANICAL_3D, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 10)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                    GlassSecondaryButton("Illustrated Botanical Story (10s)", pal, onClick = {
                        onProjectChange(project.copy(name = "Illustrated Botanical Story", sourceBody = app.codetovideo.studio.core.StudioTemplates.CUTE_STORY, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 10)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = { TextButton(onClick = { showTemplates = false }) { Text("Tutup", color = pal.iosBlue) } }
        )
    }
}

@Composable
private fun PropsPanel(
    metadata: StudioMetadata,
    values: Map<String, String>,
    pal: GlassPalette,
    onChange: (Map<String, String>) -> Unit
) {
    GlassPanel(pal) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("PROPS", color = pal.textPrimary, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp, fontSize = 11.sp)
            Spacer(Modifier.weight(1f))
            Text("${metadata.props.size} controls", color = pal.textMuted, fontSize = 10.sp)
        }
        if (metadata.props.isEmpty()) Text("Tambahkan blok studio-meta di awal source untuk membuat kontrol Props.", color = pal.textSecondary, fontSize = 12.sp)
        metadata.props.forEach { prop ->
            val value = values[prop.key] ?: prop.defaultValue
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(prop.label, color = pal.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                when (prop.type) {
                    PropType.TEXT, PropType.COLOR -> OutlinedTextField(
                        value = value,
                        onValueChange = { next -> onChange(values + (prop.key to next.take(256))) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = pal.iosBlue,
                            unfocusedBorderColor = pal.borderMid,
                            focusedTextColor = pal.textPrimary,
                            unfocusedTextColor = pal.textPrimary,
                            focusedContainerColor = pal.wellBg,
                            unfocusedContainerColor = pal.wellBg
                        ),
                        textStyle = TextStyle(fontSize = 12.sp, fontFamily = FontFamily.Monospace),
                        label = { Text(if (prop.type == PropType.COLOR) "Warna HEX" else "Teks", fontSize = 10.sp, color = pal.textSecondary) }
                    )
                    PropType.RANGE -> {
                        val number = value.toFloatOrNull()?.coerceIn(prop.min, prop.max) ?: prop.min
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            LiquidGlassSlider(
                                value = number,
                                onValueChange = { next -> onChange(values + (prop.key to next.toString())) },
                                valueRange = prop.min..prop.max,
                                pal = pal,
                                modifier = Modifier.weight(1f)
                            )
                            Text("%.2f".format(number), color = pal.textPrimary, fontSize = 11.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.width(42.dp))
                        }
                    }
                    PropType.BOOLEAN -> Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (value.equals("true", true)) "Aktif" else "Nonaktif", color = pal.textSecondary, fontSize = 11.sp, modifier = Modifier.weight(1f))
                        LiquidGlassSwitch(checked = value.equals("true", true), pal = pal) { onChange(values + (prop.key to it.toString())) }
                    }
                }
            }
        }
    }
}

@Composable
private fun RenderScreen(
    activity: MainActivity,
    project: StudioProject,
    pal: GlassPalette,
    onProjectChange: (StudioProject) -> Unit,
    runtime: app.codetovideo.studio.render.WebCanvasRuntime,
    ready: Boolean,
    exportSupported: Boolean,
    isRendering: Boolean,
    renderDone: Int,
    renderTotal: Int,
    renderStartMs: Long,
    liveBitmap: Bitmap?,
    renderMessage: String,
    externalRefreshTick: Int,
    onPickVoiceover: () -> Unit,
    onPreview: (Int) -> Unit,
    onRender: () -> Unit,
    onCancel: () -> Unit
) {
    var previewFrame by remember(project.projectId) {
        mutableIntStateOf(project.renderSettings.fps.coerceIn(0, (project.renderSettings.totalFrames() - 1).coerceAtLeast(0)))
    }
    val renderScroll = rememberScrollState()
    LaunchedEffect(isRendering) {
        if (isRendering) renderScroll.animateScrollTo(0)
        else if (ready) onPreview(previewFrame)
    }
    var previewExpanded by remember { mutableStateOf(false) }
    var showAudition by remember { mutableStateOf(false) }
    val previewHeight by animateDpAsState(if (previewExpanded) 480.dp else 270.dp, spring(0.75f, 380f), label = "prev_h")

    val parsedMeta = remember(project.sourceBody) { runCatching { ProjectMetadataParser.parse(project.sourceBody) }.getOrNull() }
    val cueCount = parsedMeta?.audio?.cues?.size ?: 0
    val ambienceName = parsedMeta?.audio?.ambience ?: "none"
    val hasVoiceover = project.renderSettings.voiceoverUri.isNotBlank()
    val hasAudioInCode = cueCount > 0 || ambienceName != "none" || hasVoiceover

    LaunchedEffect(project.renderSettings.totalFrames()) {
        previewFrame = previewFrame.coerceIn(0, (project.renderSettings.totalFrames() - 1).coerceAtLeast(0))
    }
    LaunchedEffect(project.projectId, project.sourceBody, project.propsValues, project.renderSettings, previewFrame, ready, externalRefreshTick) {
        if (ready && !isRendering) onPreview(previewFrame)
    }

    // Telemetry kalkulasi live FPS & ETA selama rendering
    val pct = if (renderTotal > 0) ((renderDone * 100) / renderTotal).coerceIn(0, 100) else 0
    val elapsedSec = if (isRendering && renderStartMs > 0L) ((System.currentTimeMillis() - renderStartMs).coerceAtLeast(100L) / 1000.0) else 0.0
    val speedFps = if (isRendering && renderDone > 1 && elapsedSec > 0.2) (renderDone / elapsedSec) else 0.0
    val etaSec = if (speedFps > 0.1 && renderTotal > renderDone) ((renderTotal - renderDone) / speedFps).roundToInt() else 0

    PageColumn(scrollState = renderScroll) {
        SectionHeader("Render Studio", "Live Preview · Real Studio SFX + Voiceover AAC MP4", pal)

        GlassPanel(pal) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    if (isRendering) "LIVE RENDER MONITOR" else "LIVE CANVAS PREVIEW",
                    color = pal.textPrimary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp
                )
                Spacer(Modifier.weight(1f))
                GlassMiniPill(if (previewExpanded) "Perkecil" else "Perbesar", pal) { previewExpanded = !previewExpanded }
                Text(if (ready) "READY" else "LOADING", color = if (ready) pal.iosGreen else Color(0xFFFFC966), fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(previewHeight)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Color(0xFF06080D))
                    .border(1.dp, pal.borderMid, RoundedCornerShape(18.dp)),
                contentAlignment = Alignment.Center
            ) {
                AndroidView(
                    factory = { runtime.createWebView() },
                    modifier = Modifier.fillMaxSize(),
                    update = {}
                )
                if (isRendering && liveBitmap != null) {
                    Image(
                        bitmap = liveBitmap.asImageBitmap(),
                        contentDescription = "Live Render Frame",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize().background(Color(0xFF06080D))
                    )
                }
                if (!ready) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(26.dp), strokeWidth = 2.dp)

                // LIVE TELEMETRY HUD melayang di atas preview saat rendering!
                if (isRendering) {
                    Row(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(10.dp)
                            .clip(RoundedCornerShape(50))
                            .background(Color(0xCC0A0F18))
                            .border(1.dp, Color(0x55FFFFFF), RoundedCornerShape(50))
                            .padding(horizontal = 11.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(Modifier.size(7.dp).background(Color(0xFFFF453A), CircleShape))
                        Spacer(Modifier.width(6.dp))
                        val fpsTxt = String.format(java.util.Locale.US, "%.1f", speedFps)
                        val hudTxt = if (speedFps > 0.1) "LIVE · $pct% · $fpsTxt fps · ETA ${etaSec}s" else "LIVE · $pct%"
                        Text(hudTxt, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                    }
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(10.dp)
                            .clip(RoundedCornerShape(50))
                            .background(Color(0xB80A0F18))
                            .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(50))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text("F $renderDone / $renderTotal", color = Color(0xFFE4ECF7), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    }
                }
            }
            val displayFrame = if (isRendering) renderDone else (previewFrame + 1)
            val totalF = project.renderSettings.totalFrames()
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Frame $displayFrame / $totalF", color = pal.textSecondary, fontSize = 11.sp)
                Spacer(Modifier.weight(1f))
                Text("%.2fs".format((displayFrame - 1).coerceAtLeast(0).toFloat() / project.renderSettings.fps.coerceAtLeast(1)), color = pal.textMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            }
            LiquidGlassSlider(
                value = if (isRendering) renderDone.toFloat() else previewFrame.toFloat(),
                onValueChange = { if (!isRendering) previewFrame = it.roundToInt() },
                valueRange = 0f..(totalF - 1).coerceAtLeast(1).toFloat(),
                pal = pal
            )
            GlassSecondaryButton("Refresh Preview", pal, onClick = { onPreview(previewFrame) }, enabled = ready && !isRendering, modifier = Modifier.fillMaxWidth())
        }

        // KARTU AUDIO MIXER, REAL SFX AUDITION & IMPORT VOICEOVER
        GlassPanel(pal) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("AUDIO MIXER & VOICEOVER", color = pal.textPrimary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
                    Text(
                        if (hasAudioInCode) "$cueCount Real SFX · bed: $ambienceName" else "Tambahkan blok audio atau pilih voiceover",
                        color = if (hasAudioInCode) pal.iosGreen else pal.textMuted, fontSize = 10.sp
                    )
                }
                GlassMiniPill("▶ Studio SFX", pal) { showAudition = true }
                Spacer(Modifier.width(8.dp))
                LiquidGlassSwitch(
                    checked = project.renderSettings.includeAudio,
                    pal = pal,
                    onCheckedChange = { onProjectChange(project.copy(renderSettings = project.renderSettings.copy(includeAudio = it))) }
                )
            }

            if (project.renderSettings.includeAudio) {
                // Bar Voiceover / BGM
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(pal.wellBg)
                        .border(1.dp, pal.borderMid, RoundedCornerShape(16.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Voiceover / BGM (MP3/WAV/M4A)", color = pal.textPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        Text(
                            if (hasVoiceover) project.renderSettings.voiceoverName else "Opsional · campur otomatis ke MP4",
                            color = if (hasVoiceover) pal.iosBlue else pal.textMuted,
                            fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis
                        )
                    }
                    GlassMiniPill(if (hasVoiceover) "Ganti" else "Pilih", pal) { onPickVoiceover() }
                    if (hasVoiceover) {
                        GlassMiniPill("Hapus", pal) {
                            onProjectChange(project.copy(renderSettings = project.renderSettings.copy(voiceoverUri = "", voiceoverName = "")))
                        }
                    }
                }

                // 3-Channel Volume Sliders
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row {
                        Text("Volume SFX Studio", color = pal.textSecondary, fontSize = 11.sp)
                        Spacer(Modifier.weight(1f))
                        Text("${(project.renderSettings.sfxVolume * 100).roundToInt()}%", color = pal.textPrimary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }
                    LiquidGlassSlider(
                        value = project.renderSettings.sfxVolume,
                        onValueChange = { onProjectChange(project.copy(renderSettings = project.renderSettings.copy(sfxVolume = it))) },
                        valueRange = 0f..1.5f,
                        pal = pal
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row {
                        Text("Volume Ambience Bed", color = pal.textSecondary, fontSize = 11.sp)
                        Spacer(Modifier.weight(1f))
                        Text("${(project.renderSettings.ambienceVolume * 100).roundToInt()}%", color = pal.textPrimary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }
                    LiquidGlassSlider(
                        value = project.renderSettings.ambienceVolume,
                        onValueChange = { onProjectChange(project.copy(renderSettings = project.renderSettings.copy(ambienceVolume = it))) },
                        valueRange = 0f..1.5f,
                        pal = pal
                    )
                }

                if (hasVoiceover) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Row {
                            Text("Volume Voiceover / BGM", color = pal.textSecondary, fontSize = 11.sp)
                            Spacer(Modifier.weight(1f))
                            Text("${(project.renderSettings.voiceoverVolume * 100).roundToInt()}%", color = pal.textPrimary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                        LiquidGlassSlider(
                            value = project.renderSettings.voiceoverVolume,
                            onValueChange = { onProjectChange(project.copy(renderSettings = project.renderSettings.copy(voiceoverVolume = it))) },
                            valueRange = 0f..1.5f,
                            pal = pal
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Auto-Ducking Ambience", color = pal.textPrimary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                            Text("Kecilkan musik latar otomatis saat suara narasi masuk", color = pal.textMuted, fontSize = 9.5.sp)
                        }
                        LiquidGlassSwitch(
                            checked = project.renderSettings.autoDucking,
                            pal = pal,
                            onCheckedChange = { onProjectChange(project.copy(renderSettings = project.renderSettings.copy(autoDucking = it))) }
                        )
                    }
                }
                val detectedCues = parsedMeta?.audio?.cues.orEmpty()
                if (detectedCues.isNotEmpty()) {
                    AudioCueTimelineStrip(
                        activity = activity,
                        cues = detectedCues,
                        durationSeconds = project.renderSettings.durationSeconds,
                        isLight = pal.isLight
                    )
                }
            }
        }

        GlassPanel(pal) {
            Text("OUTPUT SETTINGS", color = pal.textPrimary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
            GlassSegmentBar("Resolusi sisi panjang", listOf("480", "720", "1080", "1440", "2160"), project.renderSettings.longEdge.toString(), pal) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(longEdge = it.toInt())))
            }
            GlassSegmentBar("Aspect ratio", listOf("9:16", "16:9", "1:1", "4:5"), project.renderSettings.aspect, pal) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(aspect = it)))
            }
            GlassSegmentBar("Frame rate (FPS)", listOf("24", "30", "60"), project.renderSettings.fps.toString(), pal) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(fps = it.toInt())))
            }
            GlassSegmentBar("Quality", listOf("low", "medium", "high", "ultra"), project.renderSettings.quality, pal) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(quality = it)))
            }
            GlassSegmentBar("Durasi video", listOf("3s", "5s", "10s", "15s", "30s", "60s"), "${project.renderSettings.durationSeconds}s", pal) {
                onProjectChange(project.copy(renderSettings = project.renderSettings.copy(durationSeconds = it.removeSuffix("s").toInt())))
            }
            val (w, h) = project.renderSettings.dimensions()
            val codecLabel = if (project.renderSettings.includeAudio && hasAudioInCode) "H.264 + AAC / MP4" else "H.264 / MP4"
            Text("Output: ${w}×${h} px · ${project.renderSettings.totalFrames()} frames · $codecLabel", color = pal.textMuted, fontSize = 10.sp)
        }

        GlassPanel(pal) {
            Text("EXPORT", color = pal.textPrimary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
            if (isRendering) {
                LinearProgressIndicator(
                    progress = { if (renderTotal > 0) renderDone.toFloat() / renderTotal else 0f },
                    modifier = Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(50)),
                    color = pal.iosBlue,
                    trackColor = pal.wellBg
                )
                Text(renderMessage, color = pal.textSecondary, fontSize = 11.sp)
                GlassSecondaryButton("Cancel Render", pal, onClick = onCancel, modifier = Modifier.fillMaxWidth())
            } else {
                GlassPrimaryButton("Render MP4", pal, onClick = onRender, enabled = ready && exportSupported, modifier = Modifier.fillMaxWidth())
                if (renderMessage.isNotBlank()) Text(renderMessage, color = pal.textSecondary, fontSize = 11.sp)
            }
        }
    }

    if (showAudition) SfxAuditionDialog(activity = activity, pal = pal, onDismiss = { showAudition = false })
}

@Composable
private fun GalleryScreen(
    activity: MainActivity,
    pal: GlassPalette,
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
        SectionHeader("Galeri", "Hasil render MP4 di Movies/CodeToVideoStudio", pal)
        if (loading) {
            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = pal.iosBlue, strokeWidth = 2.dp)
            }
        } else if (videos.isEmpty()) {
            GlassPanel(pal) {
                Text("Belum ada video", color = pal.textPrimary, fontWeight = FontWeight.SemiBold)
                Text("Hasil render MP4 akan muncul di sini setelah divalidasi.", color = pal.textSecondary, fontSize = 12.sp)
            }
        }
        videos.forEach { video ->
            GlassPanel(pal) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(pal.wellBg)
                            .border(1.dp, pal.borderMid, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center
                    ) { Text("▶", color = pal.textPrimary, fontSize = 16.sp) }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(video.name, color = pal.textPrimary, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${video.durationLabel()} · ${GalleryRepository(activity).sizeLabel(video.sizeBytes)}", color = pal.textSecondary, fontSize = 10.sp)
                        Text(video.dateLabel(), color = pal.textMuted, fontSize = 9.sp)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    GlassPrimaryButton("Putar", pal, onClick = { selectedVideo = video }, modifier = Modifier.weight(1f))
                    GlassSecondaryButton("Bagikan", pal, onClick = { onShare(video) }, modifier = Modifier.weight(1f))
                    GlassMiniPill("Hapus", pal) { onDelete(video) }
                }
            }
        }
    }

    selectedVideo?.let { video ->
        AlertDialog(
            onDismissRequest = { selectedVideo = null },
            containerColor = pal.dialogBg,
            title = { Text(video.name, color = pal.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 14.sp) },
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
            confirmButton = { TextButton(onClick = { selectedVideo = null }) { Text("Tutup", color = pal.iosBlue) } }
        )
    }
}

@Composable
private fun ProjectsScreen(
    activity: MainActivity,
    pal: GlassPalette,
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
        SectionHeader("Simpan", "Proyek JSON tersimpan lokal di perangkat.", pal)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GlassPrimaryButton("+ New Project", pal, onClick = onNew, modifier = Modifier.weight(1f))
            GlassSecondaryButton("Import JSON", pal, onClick = onImport, modifier = Modifier.weight(1f))
        }
        GlassSecondaryButton("Export proyek aktif sebagai JSON", pal, onClick = onExportCurrent, modifier = Modifier.fillMaxWidth())
        if (projects.isEmpty()) GlassPanel(pal) { Text("Belum ada proyek tersimpan.", color = pal.textSecondary, fontSize = 12.sp) }
        projects.forEach { item ->
            GlassPanel(pal) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(item.name, color = pal.textPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text(
                            if (item.projectId == currentProjectId) "PROYEK AKTIF" else "${item.renderSettings.aspect} · ${item.renderSettings.fps} FPS",
                            color = if (item.projectId == currentProjectId) pal.iosGreen else pal.textMuted,
                            fontSize = 10.sp
                        )
                    }
                    GlassMiniPill("Open", pal) { onOpen(item) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassMiniPill("Duplicate", pal) { onDuplicate(item) }
                    GlassMiniPill("Rename", pal) { renameTarget = item; renameValue = item.name }
                    GlassMiniPill("Delete", pal) { onDelete(item) }
                }
            }
        }
    }

    renameTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            containerColor = pal.dialogBg,
            title = { Text("Rename Project", color = pal.textPrimary) },
            text = { OutlinedTextField(value = renameValue, onValueChange = { renameValue = it.take(80) }, singleLine = true, shape = RoundedCornerShape(14.dp)) },
            confirmButton = {
                TextButton(onClick = { if (renameValue.isNotBlank()) onRename(target, renameValue.trim()); renameTarget = null }) {
                    Text("Save", color = pal.iosBlue)
                }
            },
            dismissButton = { TextButton(onClick = { renameTarget = null }) { Text("Cancel", color = pal.textSecondary) } }
        )
    }
}

@Composable
private fun DocsScreen(activity: MainActivity, pal: GlassPalette, onSave: () -> Unit) {
    val content = remember { activity.assets.open("docs/skill.md").bufferedReader().use { it.readText() } }
    val clipboard = LocalClipboardManager.current
    PageColumn {
        SectionHeader("Docs v1.0", "Kitab Shadow-Mapped 3D PBR, Character Rigging & Motion Director.", pal)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GlassPrimaryButton("Salin Docs", pal, onClick = {
                clipboard.setText(AnnotatedString(content))
                Toast.makeText(activity, "Docs v1.0 disalin", Toast.LENGTH_SHORT).show()
            }, modifier = Modifier.weight(1f))
            GlassSecondaryButton("Unduh .md", pal, onClick = onSave, modifier = Modifier.weight(1f))
        }
        GlassPanel(pal) {
            Text(content, color = pal.textPrimary, fontFamily = FontFamily.Monospace, fontSize = 10.sp, lineHeight = 15.sp)
        }
    }
}
