package app.codetovideo.studio.ui

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.MediaController
import android.widget.Toast
import android.widget.VideoView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.CreateDocument
import androidx.activity.result.contract.ActivityResultContracts.OpenDocument
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
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
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
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
import kotlin.math.abs
import kotlin.math.roundToInt

private enum class StudioTab(val label: String) {
    EDITOR("Editor"),
    RENDER("Render"),
    GALLERY("Galeri"),
    PROJECTS("Simpan"),
    DOCS("Docs")
}

// =======================================================
// PALET ADAPTIF iOS 26 LIQUID GLASS (DARK TITANIUM / LIGHT FROSTED)
// =======================================================
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
        textSecondary = Color(0xFF4B586B),
        textMuted = Color(0xFF7B8799),
        accent = Color(0xFF0A84FF),
        iosBlue = Color(0xFF007AFF),
        iosGreen = Color(0xFF34C759),
        panelTop = Color(0xCCFFFFFF),
        panelMid = Color(0x9EF5F8FC),
        panelBot = Color(0xB8FFFFFF),
        borderTop = Color(0xF5FFFFFF),
        borderMid = Color(0x55A7C6EC),
        borderBot = Color(0xCCFFFFFF),
        wellBg = Color(0x2015243A),
        dockTop = Color(0xDCF7FAFE),
        dockBot = Color(0xE8E9EFF7),
        dialogBg = Color(0xFFF3F6FA)
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
        borderMid = Color(0x2692C5FF),
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
            drawRect(Brush.verticalGradient(listOf(Color(0xFFEEF3FA), Color(0xFFE3EAF4), Color(0xFFEDF1F7))))
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(Color(0x66A9D2FF), Color(0x22CBE4FF), Color.Transparent),
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
            .background(if (pal.isLight) Color(0xBBFFFFFF) else Color(0x24FFFFFF))
            .border(1.dp, if (pal.isLight) Color(0xEEFFFFFF) else Color(0x42FFFFFF), shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = pal.textPrimary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}

/** iOS 26 Liquid Glass Toggle Switch — berubah jadi kapsul kaca bening memanjang saat ditekan */
@Composable
private fun LiquidGlassSwitch(
    checked: Boolean,
    pal: GlassPalette,
    onCheckedChange: (Boolean) -> Unit
) {
    val haptic = LocalHapticFeedback.current
    var pressed by remember { mutableStateOf(false) }
    val trackCol by animateColorAsState(
        targetValue = if (checked) pal.iosGreen else (if (pal.isLight) Color(0x30101828) else Color(0x32FFFFFF)),
        animationSpec = tween(220),
        label = "sw_track"
    )
    val thumbOffset by animateDpAsState(
        targetValue = if (checked) 24.dp else 2.dp,
        animationSpec = spring(dampingRatio = 0.68f, stiffness = 460f),
        label = "sw_pos"
    )
    val thumbW by animateDpAsState(
        targetValue = if (pressed) 34.dp else 28.dp,
        animationSpec = spring(dampingRatio = 0.65f, stiffness = 520f),
        label = "sw_w"
    )
    val thumbH by animateDpAsState(
        targetValue = if (pressed) 28.dp else 24.dp,
        animationSpec = spring(dampingRatio = 0.65f, stiffness = 520f),
        label = "sw_h"
    )
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
                    onPress = {
                        pressed = true
                        tryAwaitRelease()
                        pressed = false
                    },
                    onTap = {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onCheckedChange(!checked)
                    }
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
                    if (pressed) {
                        Brush.verticalGradient(listOf(Color(0x99FFFFFF), Color(0x40FFFFFF), Color(0x78FFFFFF)))
                    } else {
                        Brush.verticalGradient(listOf(Color(0xFFFFFFFF), Color(0xFFE8EEF5)))
                    }
                )
                .border(
                    width = 1.dp,
                    brush = Brush.linearGradient(listOf(Color(0xEEFFFFFF), Color(0x55A4D4FF), Color(0xBBFFFFFF))),
                    shape = shape
                )
        )
    }
}

/** iOS 26 Liquid Glass Capsule Slider — thumb kaca lonjong membesar & membiaskan track */
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
        // Track belakang
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(trackShape)
                .background(if (pal.isLight) Color(0x28101828) else Color(0x2EFFFFFF))
        )
        // Track terisi
        Box(
            modifier = Modifier
                .fillMaxWidth(frac.coerceAtLeast(0.02f))
                .height(6.dp)
                .clip(trackShape)
                .background(if (pal.isLight) pal.iosBlue else Color.White)
        )
        // Liquid Glass Capsule Thumb
        val travel = (maxWidth - thumbW).coerceAtLeast(0.dp)
        val xPos = travel * frac
        Box(
            modifier = Modifier
                .offset(x = xPos)
                .width(thumbW)
                .height(thumbH)
                .clip(trackShape)
                .background(
                    if (dragging) {
                        Brush.verticalGradient(listOf(Color(0x90FFFFFF), Color(0x36FFFFFF), Color(0x70FFFFFF)))
                    } else {
                        Brush.verticalGradient(listOf(Color(0xF5FFFFFF), Color(0xD8E7EEF7)))
                    }
                )
                .border(
                    width = 1.dp,
                    brush = Brush.linearGradient(listOf(Color(0xFFFFFFFF), Color(0x6692CCFF), Color(0xCCFFFFFF))),
                    shape = trackShape
                )
        )
    }
}

/** iOS 26 Segmented Control dengan Drag-to-Scrub + Mirror Pill */
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
                .background(pal.wellBg)
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
            val indicatorX by animateDpAsState(
                targetValue = itemW * selectedIdx,
                animationSpec = spring(dampingRatio = 0.72f, stiffness = 430f),
                label = "seg_x"
            )
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
                        if (pal.isLight) {
                            Brush.verticalGradient(listOf(Color(0xFFFFFFFF), Color(0xEBEDF2F8)))
                        } else {
                            Brush.verticalGradient(listOf(Color(0x64FFFFFF), Color(0x28FFFFFF), Color(0x46FFFFFF)))
                        }
                    )
                    .border(
                        1.dp,
                        Brush.linearGradient(listOf(Color(0xDDFFFFFF), Color(0x4891C8FF), Color(0x99FFFFFF))),
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
                                onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    onSelect(opt)
                                }
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

/** Logo Apple Perak-Putih Khas + Play-Code */
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
            val w = size.width
            val h = size.height
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
    val iconScale by animateFloatAsState(
        targetValue = if (active) 1.12f else 0.96f,
        animationSpec = spring(dampingRatio = 0.55f, stiffness = 420f),
        label = "ic_sc"
    )
    Canvas(modifier = Modifier.size(20.dp).scale(iconScale)) {
        val w = size.width
        val h = size.height
        val sw = if (active) 2.15.dp.toPx() else 1.65.dp.toPx()
        val stroke = Stroke(width = sw, cap = StrokeCap.Round, join = StrokeJoin.Round)
        when (tab) {
            StudioTab.EDITOR -> {
                val left = Path().apply { moveTo(w * 0.36f, h * 0.24f); lineTo(w * 0.14f, h * 0.50f); lineTo(w * 0.36f, h * 0.76f) }
                val right = Path().apply { moveTo(w * 0.64f, h * 0.24f); lineTo(w * 0.86f, h * 0.50f); lineTo(w * 0.64f, h * 0.76f) }
                drawPath(left, tint, style = stroke)
                drawPath(right, tint, style = stroke)
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

/**
 * Floating iOS 26 Liquid Glass Dock dengan Drag-to-Scrub, Elastic Jelly Stretch,
 * Chromatic Specular Lens + Detached Floating Orb di sisi kanan!
 */
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
    val lensInflate by animateFloatAsState(
        targetValue = if (isDragging) 1.12f else 1.0f,
        animationSpec = spring(0.58f, 400f),
        label = "dock_inflate"
    )
    val stretchX by animateFloatAsState(
        targetValue = if (isDragging) (1f + (abs(dragVel) * 0.008f).coerceAtMost(0.16f)) else 1f,
        animationSpec = spring(0.62f, 460f),
        label = "dock_stretch"
    )

    val dockShape = RoundedCornerShape(34.dp)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // KAPSUL DOCK UTAMA (5 TAB + DRAG TO SCRUB)
        BoxWithConstraints(
            modifier = Modifier
                .weight(1f)
                .height(64.dp)
                .clip(dockShape)
                .background(Brush.verticalGradient(listOf(pal.dockTop, pal.dockBot)))
                .border(
                    width = 1.dp,
                    brush = Brush.linearGradient(listOf(pal.borderTop, pal.borderMid, pal.borderBot)),
                    shape = dockShape
                )
                .padding(5.dp)
                .pointerInput(tabs.size) {
                    detectHorizontalDragGestures(
                        onDragStart = { pos ->
                            isDragging = true
                            val raw = ((pos.x / size.width.coerceAtLeast(1)) * tabs.size - 0.5f)
                                .coerceIn(0f, (tabs.size - 1).toFloat())
                            dragFrac = raw
                            val nearest = raw.roundToInt().coerceIn(0, tabs.lastIndex)
                            if (tabs[nearest] != selectedTab) {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                latestSelect(tabs[nearest])
                            }
                        },
                        onDragEnd = {
                            isDragging = false
                            dragVel = 0f
                            val nearest = dragFrac.roundToInt().coerceIn(0, tabs.lastIndex)
                            latestSelect(tabs[nearest])
                        },
                        onDragCancel = {
                            isDragging = false
                            dragVel = 0f
                        },
                        onHorizontalDrag = { change, dragAmount ->
                            change.consume()
                            dragVel = dragAmount
                            val raw = ((change.position.x / size.width.coerceAtLeast(1)) * tabs.size - 0.5f)
                                .coerceIn(0f, (tabs.size - 1).toFloat())
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

            // Lensa Liquid Glass Cair yang meluncur, membesar & melar saat digeser
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
                        if (pal.isLight) {
                            Brush.verticalGradient(listOf(Color(0xF5FFFFFF), Color(0xB8F0F6FD), Color(0xE8FFFFFF)))
                        } else {
                            Brush.verticalGradient(listOf(Color(0x66FFFFFF), Color(0x20FFFFFF), Color(0x46FFFFFF)))
                        }
                    )
                    .border(
                        width = if (isDragging) 1.5.dp else 1.dp,
                        brush = Brush.linearGradient(
                            listOf(Color(0xF0FFFFFF), Color(0x7882C6FF), Color(0x44FFB8DC), Color(0xBBFFFFFF))
                        ),
                        shape = pillShape
                    )
            )

            Row(modifier = Modifier.fillMaxSize()) {
                tabs.forEachIndexed { idx, tab ->
                    val dist = abs(animatedFrac - idx)
                    val isNear = dist < 0.5f
                    val magScale = if (isDragging && isNear) 1.12f else if (tab == selectedTab) 1.03f else 0.95f
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .scale(magScale)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    onSelect(tab)
                                }
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

        // DETACHED FLOATING LIQUID GLASS ORB (Kanan Dock — Quick Render / Refresh!)
        val orbInteraction = remember { MutableInteractionSource() }
        val orbPressed by orbInteraction.collectIsPressedAsState()
        val orbScale by animateFloatAsState(if (orbPressed) 0.88f else 1f, spring(0.55f, 480f), label = "orb_sc")

        Box(
            modifier = Modifier
                .size(58.dp)
                .scale(orbScale)
                .clip(CircleShape)
                .background(Brush.verticalGradient(listOf(pal.dockTop, pal.dockBot)))
                .border(
                    width = 1.2.dp,
                    brush = Brush.linearGradient(listOf(Color(0xEEFFFFFF), Color(0x668CC6FF), Color(0x99FFFFFF))),
                    shape = CircleShape
                )
                .clickable(interactionSource = orbInteraction, indication = null) {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onOrbClick()
                },
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.size(22.dp)) {
                val w = size.width
                val h = size.height
                val tint = if (pal.isLight) pal.iosBlue else Color.White
                if (selectedTab == StudioTab.RENDER) {
                    // Ikon refresh melingkar saat sudah di tab Render
                    drawArc(
                        color = tint, startAngle = -60f, sweepAngle = 290f, useCenter = false,
                        style = Stroke(width = 2.2.dp.toPx(), cap = StrokeCap.Round)
                    )
                    val tip = Path().apply {
                        moveTo(w * 0.78f, h * 0.14f); lineTo(w * 0.92f, h * 0.34f); lineTo(w * 0.66f, h * 0.34f); close()
                    }
                    drawPath(tip, tint)
                } else {
                    // Ikon play-spark untuk lompat cepat ke Render Studio
                    val tri = Path().apply {
                        moveTo(w * 0.30f, h * 0.18f); lineTo(w * 0.84f, h * 0.50f); lineTo(w * 0.30f, h * 0.82f); close()
                    }
                    drawPath(tri, tint)
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
    var isLightGlass by remember { mutableStateOf(false) }
    var savedLabel by remember { mutableStateOf("Tersimpan") }
    var renderReady by remember { mutableStateOf(false) }
    var exportSupported by remember { mutableStateOf(false) }
    var isRendering by remember { mutableStateOf(false) }
    var renderDone by remember { mutableIntStateOf(0) }
    var renderTotal by remember { mutableIntStateOf(0) }
    var renderMessage by remember { mutableStateOf("") }
    var refreshProjects by remember { mutableIntStateOf(0) }
    var refreshGallery by remember { mutableIntStateOf(0) }
    var previewTick by remember { mutableIntStateOf(0) }

    val pal = remember(isLightGlass) { glassPalette(isLightGlass) }

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
        }.onSuccess { Toast.makeText(activity, "Dokumentasi v0.4 disimpan", Toast.LENGTH_SHORT).show() }
            .onFailure { Toast.makeText(activity, it.message ?: "Gagal menyimpan Docs", Toast.LENGTH_LONG).show() }
    }

    // OVERLAY LAYOUT: Konten bergulir penuh melewati BELAKANG Floating Liquid Glass Dock!
    Box(modifier = Modifier.fillMaxSize()) {
        LiquidGlassBackdrop(light = isLightGlass)

        Box(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                TopGlassHeader(
                    projectName = project.name,
                    status = savedLabel,
                    webReady = renderReady,
                    pal = pal,
                    onToggleTheme = { isLightGlass = !isLightGlass }
                )
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    AnimatedContent(
                        targetState = selectedTab,
                        transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(150)) },
                        label = "tab_content"
                    ) { tab ->
                        when (tab) {
                            StudioTab.EDITOR -> EditorScreen(
                                project = project,
                                pal = pal,
                                onProjectChange = { project = it },
                                onImport = { importProject.launch(arrayOf("application/json", "text/json")) },
                                onExport = { exportProject.launch("${project.name.replace(Regex("[^A-Za-z0-9_-]"), "_")}.json") }
                            )
                            StudioTab.RENDER -> RenderScreen(
                                project = project,
                                pal = pal,
                                onProjectChange = { project = it },
                                runtime = activity.canvasRuntime,
                                ready = renderReady,
                                exportSupported = exportSupported,
                                isRendering = isRendering,
                                renderDone = renderDone,
                                renderTotal = renderTotal,
                                renderMessage = renderMessage,
                                externalRefreshTick = previewTick,
                                onPreview = { activity.canvasRuntime.preview(project, it) },
                                onRender = {
                                    renderMessage = "Mensintesis audio 26 SFX & menyiapkan encoder MP4…"
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
                                onCancel = { activity.renderController.cancel(); renderMessage = "Permintaan pembatalan dikirim." }
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
                            StudioTab.DOCS -> DocsScreen(activity = activity, pal = pal, onSave = { saveDocs.launch("render-video-code-skill-v0.4.md") })
                        }
                    }
                }
            }

            // Floating Dock & Detached Orb mengambang di atas konten!
            FloatingLiquidGlassDockRow(
                selectedTab = selectedTab,
                pal = pal,
                onSelect = { selectedTab = it },
                onOrbClick = {
                    if (selectedTab != StudioTab.RENDER) {
                        selectedTab = StudioTab.RENDER
                    } else {
                        previewTick++
                    }
                },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
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
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AppBrandLogo()
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text("Render Video Code", color = pal.textPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp, letterSpacing = (-0.2).sp)
            Text(projectName, color = pal.textSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        // Tombol Bulat Ganti Tema Dark / Light Liquid Glass
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
                    // Bulan sabit (klik untuk Dark Glass)
                    drawCircle(c, radius = size.minDimension * 0.40f)
                    drawCircle(pal.panelTop, radius = size.minDimension * 0.32f, center = Offset(size.width * 0.66f, size.height * 0.34f))
                } else {
                    // Matahari (klik untuk Light Glass)
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
                Text("v0.4", color = pal.textPrimary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Text(status, color = pal.textMuted, fontSize = 8.5.sp)
        }
    }
}

@Composable
private fun PageColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
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
private fun EditorScreen(
    project: StudioProject,
    pal: GlassPalette,
    onProjectChange: (StudioProject) -> Unit,
    onImport: () -> Unit,
    onExport: () -> Unit
) {
    val parsed = remember(project.sourceBody) { runCatching { ProjectMetadataParser.parse(project.sourceBody) } }
    var showTemplates by remember { mutableStateOf(false) }

    PageColumn {
        SectionHeader("Editor", "Engine v0.4 · Motion Director, Liquid Glass, 3D & 26 SFX.", pal)
        GlassPanel(pal) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("SOURCE.JS", color = pal.textPrimary, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, letterSpacing = 0.8.sp)
                    Text("${project.sourceBody.length} / 262.144 karakter", color = pal.textMuted, fontSize = 10.sp)
                }
                GlassMiniPill("Templates", pal) { showTemplates = true }
                GlassMiniPill("Reset", pal) {
                    onProjectChange(project.copy(sourceBody = app.codetovideo.studio.core.DEFAULT_SOURCE, propsValues = emptyMap()))
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
                        Text("AUDIO & SFX READY", color = pal.textPrimary, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, letterSpacing = 0.8.sp)
                    }
                    Text(
                        "Bed: ${metadata.audio.ambience} · ${metadata.audio.cues.size} SFX cues sinkron otomatis ke AAC MP4.",
                        color = pal.textSecondary, fontSize = 12.sp
                    )
                }
            }
            PropsPanel(metadata = metadata, values = project.propsValues, pal = pal, onChange = { onProjectChange(project.copy(propsValues = it)) })
        }
    }

    if (showTemplates) {
        AlertDialog(
            onDismissRequest = { showTemplates = false },
            containerColor = pal.dialogBg,
            title = { Text("Template v0.4 Motion Director", color = pal.textPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassSecondaryButton("iOS 26 Liquid Glass Hero (5s)", pal, onClick = {
                        onProjectChange(project.copy(name = "iOS 26 Liquid Glass Hero", sourceBody = app.codetovideo.studio.core.DEFAULT_SOURCE, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 5)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                    GlassSecondaryButton("Kinetic Data Storytelling · Spline + Counter (10s)", pal, onClick = {
                        onProjectChange(project.copy(name = "Kinetic Data Storytelling", sourceBody = DATA_STORY_TEMPLATE, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 10)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                    GlassSecondaryButton("3D Botanical Orbit · Micro 3D Engine (10s)", pal, onClick = {
                        onProjectChange(project.copy(name = "3D Botanical Orbit", sourceBody = BOTANICAL_3D_TEMPLATE, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 10)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                    GlassSecondaryButton("Cute Garden Story · Stagger + Confetti (10s)", pal, onClick = {
                        onProjectChange(project.copy(name = "Cute Garden Story", sourceBody = CUTE_STORY_TEMPLATE, propsValues = emptyMap(), renderSettings = project.renderSettings.copy(durationSeconds = 10)))
                        showTemplates = false
                    }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = { TextButton(onClick = { showTemplates = false }) { Text("Tutup", color = pal.iosBlue) } }
        )
    }
}

private val DATA_STORY_TEMPLATE = """/*<studio-meta>
{
  "schemaVersion": 4,
  "title": "Kinetic Data Storytelling",
  "defaultDurationSeconds": 10,
  "seed": 44,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"metric","label":"Label Grafik","type":"text","default":"PERTUMBUHAN TANAMAN"},
    {"key":"accent","label":"Warna Aksen","type":"color","default":"#32D74B"}
  ],
  "audio": {
    "ambience": "apple_keynote_minimal",
    "ambienceVolume": 0.22,
    "cues": [
      {"p": 0.02, "sfx": "liquid_morph", "gain": 0.78},
      {"p": 0.22, "sfx": "tick", "gain": 0.68, "pitch": 1.05},
      {"p": 0.46, "sfx": "glass_slide", "gain": 0.90},
      {"p": 0.62, "sfx": "water_drop", "gain": 0.76},
      {"p": 0.84, "sfx": "glass_shimmer", "gain": 0.88}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#32D74B");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;

function drawSceneA(sp) {
  ui.drawMeshBg(ctx, W, H, "#070B10", [
    { x: 0.84, y: 0.16, r: 0.75, col: accent, a: 0.28 },
    { x: 0.16, y: 0.82, r: 0.70, col: "#4AA3FF", a: 0.22 }
  ], t);
  ctx.save();
  cam.apply(ctx, { x: 0, y: interpolate(sp, [0, 1], [-18 * S, 18 * S]), zoom: interpolate(sp, [0, 0.3], [1.1, 1.0], { easing: ease.snap }), rot: 0 }, 1.0);
  ui.drawPill(ctx, pad, H * 0.14, String(P.metric || "PERTUMBUHAN TANAMAN"), "rgba(255,255,255,0.12)", accent, Math.max(12, Math.round(21 * S)));
  const countVal = interpolate(sp, [0.06, 0.78], [12, 98], { easing: ease.apple });
  fx.text.counterRoll(ctx, countVal, pad, H * 0.21, Math.round(148 * S), "#FFFFFF", "%", "left");

  const cardY = H * 0.44;
  const cardH = 380 * S;
  ui.drawLiquidGlass(ctx, pad, cardY, innerW, cardH, 30 * S, { light: false, sweep: sp });
  fx.chart.spline(ctx, [18, 26, 24, 42, 58, 54, 78, 96], pad + 34 * S, cardY + 64 * S, innerW - 68 * S, cardH - 120 * S, accent, ui.seg(sp, 0.12, 0.88));
  ctx.restore();
}

function drawSceneB(sp) {
  ui.drawMeshBg(ctx, W, H, "#F2F5FA", [
    { x: 0.80, y: 0.18, r: 0.72, col: accent, a: 0.24 },
    { x: 0.18, y: 0.84, r: 0.68, col: "#A6C8FF", a: 0.28 }
  ], t);
  ctx.save();
  cam.apply(ctx, { x: 0, y: 0, zoom: interpolate(sp, [0, 1], [1.06, 1.0], { easing: ease.apple }), rot: 0 }, 1.0);
  const fS = Math.round(76 * S);
  const used = ui.drawRichText(ctx, [
    { text: "Hasil nyata dari perawatan" },
    { text: "konsisten.", italic: true, color: accent }
  ], pad, H * 0.18, innerW, fS, fS * 1.18, "#0E141D", ui.seg(sp, 0.04, 0.46), "left");

  const cardY = H * 0.18 + used + 56 * S;
  const cardH = 360 * S;
  ui.drawLiquidGlass(ctx, pad, cardY, innerW, cardH, 30 * S, { light: true, sweep: sp });
  fx.chart.bars(ctx, [
    { value: 0.42, label: "W1", color: "#9EB2C8" },
    { value: 0.66, label: "W2", color: "#72B5E8" },
    { value: 0.84, label: "W3", color: "#4AD08A" },
    { value: 0.98, label: "W4", color: accent }
  ], pad + 42 * S, cardY + 52 * S, innerW - 84 * S, cardH - 120 * S, Math.round(fps * 5.0));

  fx.text.kineticMask(ctx, String(P.brand || "Seflorner") + ".", W * 0.5, cardY + cardH + 64 * S, Math.round(58 * S), "#0E141D", ui.seg(sp, 0.42, 0.86), "center");
  ctx.restore();
}

if (p < 0.46) drawSceneA(ui.seg(p, 0.0, 0.54));
else if (p < 0.56) fx.transition.glassSlide(ctx, ui.seg(p, 0.46, 0.56), () => drawSceneA(ui.seg(p, 0.0, 0.54)), () => drawSceneB(ui.seg(p, 0.46, 1.0)));
else drawSceneB(ui.seg(p, 0.46, 1.0));
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, accent, "rgba(120,140,160,0.22)");
"""

private val BOTANICAL_3D_TEMPLATE = """/*<studio-meta>
{
  "schemaVersion": 4,
  "title": "3D Botanical Orbit",
  "defaultDurationSeconds": 10,
  "seed": 77,
  "props": [
    {"key":"brand","label":"Brand","type":"text","default":"Seflorner"},
    {"key":"roseColor","label":"Warna Mawar","type":"color","default":"#E03A58"},
    {"key":"leafColor","label":"Warna Daun","type":"color","default":"#2B9B5E"}
  ],
  "audio": {
    "ambience": "forest_air",
    "ambienceVolume": 0.24,
    "cues": [
      {"p": 0.02, "sfx": "swoosh_deep", "gain": 0.78},
      {"p": 0.28, "sfx": "bloom", "gain": 0.86},
      {"p": 0.65, "sfx": "sparkle", "gain": 0.78},
      {"p": 0.86, "sfx": "chime", "gain": 0.88}
    ]
  }
}
</studio-meta>*/

const roseCol = String(P.roseColor || "#E03A58");
const leafCol = String(P.leafColor || "#2B9B5E");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;

ui.drawMeshBg(ctx, W, H, "#050B08", [
  { x: 0.5, y: 0.42, r: 0.68, col: roseCol, a: 0.24 },
  { x: 0.2, y: 0.82, r: 0.62, col: leafCol, a: 0.20 }
], t);

const az = -0.4 + p * Math.PI * 2.2;
const elev = 0.28 + Math.sin(p * Math.PI) * 0.34;
const dist = (W > H ? 5.2 : 6.6) - Math.sin(p * Math.PI) * 1.1;
const eye = [dist * Math.cos(elev) * Math.sin(az), 0.35 + dist * Math.sin(elev), dist * Math.cos(elev) * Math.cos(az)];
const sc = d3.createScene(eye, [0, 0.35, 0], 0.72, W, H, 0.44);

// 28 kelopak mawar 3D menggunakan Micro 3D Engine v0.4
const bloom = ease.apple(ui.seg(p, 0.05, 0.62));
const golden = 2.399963229728653;
for (let i = 0; i < 28; i++) {
  const lay = i / 27;
  const ang = i * golden;
  const pb = ease.snap(ui.seg(bloom, (1 - lay) * 0.3, 0.7 + (1 - lay) * 0.3));
  const rad = ui.lerp(0.08, 0.48, lay);
  const pH = ui.lerp(0.45, 0.95, lay);
  const pW = ui.lerp(0.28, 0.72, lay);
  const pitch = ui.lerp(0.15, 0.95 * lay + 0.2, pb);
  const pts = [
    [-pW * 0.25, 0, 0], [pW * 0.25, 0, 0], [pW * 0.52, pH * 0.62, -0.12],
    [0, pH, 0.08 * pb], [-pW * 0.52, pH * 0.62, -0.12]
  ].map((pt) => {
    let q = d3.rotX(pt, pitch);
    q = [q[0], q[1] + (1 - lay) * 0.26, q[2] + rad];
    return d3.rotY(q, ang);
  });
  sc.poly(pts, roseCol, { col2: "#FF9EB2", twoSided: true, spec: 24, zBias: -lay * 0.02 });
}

// 4 daun hijau 3D
for (let i = 0; i < 4; i++) {
  const a = i * Math.PI * 0.5 + 0.4;
  const pts = [[0, -0.1, 0], [0.42, -0.15, -0.25], [1.1, -0.35, 0], [0.42, -0.15, 0.25]].map((pt) => d3.rotY(pt, a));
  sc.poly(pts, leafCol, { col2: "#62D492", twoSided: true, spec: 20 });
}

// Orbit partikel emas 3D
for (let i = 0; i < 16; i++) {
  const oa = rand(300 + i) * Math.PI * 2 + t * 0.4;
  const rr = 1.4 + rand(320 + i) * 1.4;
  sc.orb([Math.cos(oa) * rr, (rand(340 + i) - 0.3) * 2.2, Math.sin(oa) * rr], 0.04, "#FFE08A", 0.85);
}

sc.render(ctx, S);
fx.particles.petals(ctx, 10, roseCol, 0.25);

const footY = H - pad - 210 * S;
ui.drawLiquidGlass(ctx, pad, footY, innerW, 155 * S, 26 * S, { light: false, sweep: p });
fx.text.wordStagger(ctx, String(P.brand || "Seflorner") + " · 3D Rosa", pad + 30 * S, footY + 34 * S, innerW - 60 * S, Math.round(44 * S), "#FFFFFF", 6, "left");
fx.text.typewriter(ctx, "GOLDEN ANGLE 137.5° · Z-BUFFER ENGINE", pad + 30 * S, footY + 98 * S, Math.round(21 * S), "#A8DEC0", ui.seg(p, 0.15, 0.72), true);
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, roseCol, "rgba(255,255,255,0.14)");
"""

private val CUTE_STORY_TEMPLATE = """/*<studio-meta>
{
  "schemaVersion": 4,
  "title": "Cute Garden Story",
  "defaultDurationSeconds": 10,
  "seed": 55,
  "props": [
    {"key":"line1","label":"Kalimat 1","type":"text","default":"Mulai dari satu pot mungil di rumah."},
    {"key":"line2","label":"Kalimat 2","type":"text","default":"Siram sabar setiap pagi sampai mekar!"},
    {"key":"accent","label":"Warna Hijau","type":"color","default":"#2EA864"}
  ],
  "audio": {
    "ambience": "warm_pad",
    "ambienceVolume": 0.22,
    "cues": [
      {"p": 0.02, "sfx": "pop", "gain": 0.78},
      {"p": 0.24, "sfx": "water_drop", "gain": 0.82, "pitch": 1.05},
      {"p": 0.50, "sfx": "liquid_morph", "gain": 0.84},
      {"p": 0.78, "sfx": "sparkle", "gain": 0.86}
    ]
  }
}
</studio-meta>*/

const accent = String(P.accent || "#2EA864");
const pad = Math.min(W, H) * 0.068;
const innerW = W - pad * 2;

function drawPart1(sp) {
  ui.drawMeshBg(ctx, W, H, "#FFF7EA", [
    { x: 0.82, y: 0.16, r: 0.68, col: "#FFD166", a: 0.34 },
    { x: 0.18, y: 0.84, r: 0.64, col: accent, a: 0.22 }
  ], t);
  ui.drawLiquidGlass(ctx, pad, pad + 40 * S, innerW, 220 * S, 28 * S, { light: true, sweep: sp });
  fx.text.wordStagger(ctx, String(P.line1 || "Mulai dari satu pot mungil di rumah."), pad + 32 * S, pad + 78 * S, innerW - 64 * S, Math.round(48 * S), "#1D2C22", 2, "left");
  const dropY = interpolate(sp, [0.15, 0.85], [H * 0.42, H * 0.66], { easing: ease.apple });
  ui.drawWaterDrop(ctx, W * 0.5, dropY, 76 * S, "#64C8F5");
}

function drawPart2(sp) {
  ui.drawMeshBg(ctx, W, H, "#F1FBF3", [
    { x: 0.5, y: 0.5, r: 0.75, col: accent, a: 0.26 },
    { x: 0.8, y: 0.2, r: 0.55, col: "#FF8FA3", a: 0.24 }
  ], t);
  ui.drawLiquidGlass(ctx, pad, pad + 40 * S, innerW, 220 * S, 28 * S, { light: true, sweep: sp });
  fx.text.wordStagger(ctx, String(P.line2 || "Siram sabar setiap pagi sampai mekar!"), pad + 32 * S, pad + 78 * S, innerW - 64 * S, Math.round(48 * S), "#1D2C22", Math.round(fps * 4.8), "left");
  fx.text.highlightSweep(ctx, "MEKAR PENUH!", W * 0.5, H * 0.54, Math.round(64 * S), accent, "#FFFFFF", ui.seg(sp, 0.20, 0.62), "center");
  fx.particles.confetti(ctx, 22, ["#FF6B6B", "#FFD166", accent, "#56CFE1"], ui.seg(sp, 0.25, 0.55));
}

if (p < 0.46) drawPart1(ui.seg(p, 0.0, 0.54));
else if (p < 0.56) fx.transition.liquidWipe(ctx, ui.seg(p, 0.46, 0.56), () => drawPart1(ui.seg(p, 0.0, 0.54)), () => drawPart2(ui.seg(p, 0.46, 1.0)));
else drawPart2(ui.seg(p, 0.46, 1.0));
ui.drawProgressBar(ctx, pad, H - pad - 8 * S, innerW, 8 * S, p, accent, "rgba(29,44,34,0.14)");
"""

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
    project: StudioProject,
    pal: GlassPalette,
    onProjectChange: (StudioProject) -> Unit,
    runtime: app.codetovideo.studio.render.WebCanvasRuntime,
    ready: Boolean,
    exportSupported: Boolean,
    isRendering: Boolean,
    renderDone: Int,
    renderTotal: Int,
    renderMessage: String,
    externalRefreshTick: Int,
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
    LaunchedEffect(project.projectId, project.sourceBody, project.propsValues, project.renderSettings, previewFrame, ready, externalRefreshTick) {
        if (ready) onPreview(previewFrame)
    }

    PageColumn {
        SectionHeader("Render Studio", "H.264 + 26 SFX AAC / MP4 · pemrosesan lokal offline", pal)
        GlassPanel(pal) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("LIVE CANVAS PREVIEW", color = pal.textPrimary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp)
                Spacer(Modifier.weight(1f))
                Text(if (ready) "READY" else "LOADING", color = if (ready) pal.iosGreen else Color(0xFFFFC966), fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(265.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Color(0xFF06080D))
                    .border(1.dp, pal.borderMid, RoundedCornerShape(18.dp)),
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
                Text("Frame ${previewFrame + 1} / ${project.renderSettings.totalFrames()}", color = pal.textSecondary, fontSize = 11.sp)
                Spacer(Modifier.weight(1f))
                Text("%.2fs".format(previewFrame.toFloat() / project.renderSettings.fps.coerceAtLeast(1)), color = pal.textMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            }
            LiquidGlassSlider(
                value = previewFrame.toFloat(),
                onValueChange = { previewFrame = it.roundToInt() },
                valueRange = 0f..(project.renderSettings.totalFrames() - 1).coerceAtLeast(1).toFloat(),
                pal = pal
            )
            GlassSecondaryButton("Refresh Preview", pal, onClick = { onPreview(previewFrame) }, enabled = ready, modifier = Modifier.fillMaxWidth())
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

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(pal.wellBg)
                    .border(1.dp, pal.borderMid, RoundedCornerShape(18.dp))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text("Audio & SFX (AAC)", color = pal.textPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        if (hasAudioInCode) "$cueCount SFX · bed: $ambienceName"
                        else "Tambahkan blok audio di studio-meta",
                        color = if (hasAudioInCode) pal.iosGreen else pal.textMuted,
                        fontSize = 10.sp
                    )
                }
                LiquidGlassSwitch(
                    checked = project.renderSettings.includeAudio,
                    pal = pal,
                    onCheckedChange = { onProjectChange(project.copy(renderSettings = project.renderSettings.copy(includeAudio = it))) }
                )
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
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(50)),
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
                    ) {
                        Text("▶", color = pal.textPrimary, fontSize = 16.sp)
                    }
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
    val clipboard = androidx.compose.ui.platform.LocalClipboardManager.current
    PageColumn {
        SectionHeader("Docs v0.4", "Kitab Motion Director, Liquid Glass, 3D & 26 SFX.", pal)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GlassPrimaryButton("Salin Docs", pal, onClick = {
                clipboard.setText(androidx.compose.ui.text.AnnotatedString(content))
                Toast.makeText(activity, "Docs v0.4 disalin", Toast.LENGTH_SHORT).show()
            }, modifier = Modifier.weight(1f))
            GlassSecondaryButton("Unduh .md", pal, onClick = onSave, modifier = Modifier.weight(1f))
        }
        GlassPanel(pal) {
            Text(content, color = pal.textPrimary, fontFamily = FontFamily.Monospace, fontSize = 10.sp, lineHeight = 15.sp)
        }
    }
}
