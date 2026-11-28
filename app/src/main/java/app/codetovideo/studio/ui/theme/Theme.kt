package app.codetovideo.studio.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.codetovideo.studio.R

val DisplayFontFamily = FontFamily(
    Font(R.font.plus_jakarta_sans, FontWeight.Normal),
    Font(R.font.plus_jakarta_sans, FontWeight.SemiBold),
    Font(R.font.plus_jakarta_sans, FontWeight.Bold),
    Font(R.font.plus_jakarta_sans, FontWeight.ExtraBold)
)

val BodyFontFamily = FontFamily(
    Font(R.font.inter, FontWeight.Normal),
    Font(R.font.inter, FontWeight.Medium),
    Font(R.font.inter, FontWeight.SemiBold),
    Font(R.font.inter, FontWeight.Bold)
)

val EditorialFontFamily = FontFamily(
    Font(R.font.playfair_display, FontWeight.Normal),
    Font(R.font.playfair_display, FontWeight.Bold)
)

val CodeFontFamily = FontFamily(
    Font(R.font.jetbrains_mono, FontWeight.Normal),
    Font(R.font.jetbrains_mono, FontWeight.Medium),
    Font(R.font.jetbrains_mono, FontWeight.Bold)
)

private val StudioTypography = Typography(
    displaySmall = TextStyle(fontFamily = DisplayFontFamily, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 32.sp),
    headlineMedium = TextStyle(fontFamily = DisplayFontFamily, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 28.sp),
    titleLarge = TextStyle(fontFamily = DisplayFontFamily, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontFamily = DisplayFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = BodyFontFamily, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp),
    bodyMedium = TextStyle(fontFamily = BodyFontFamily, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = BodyFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = CodeFontFamily, fontWeight = FontWeight.Medium, fontSize = 10.sp, lineHeight = 14.sp)
)

private val LiquidGlassColors = darkColorScheme(
    primary = Color(0xFFF2F5F9),
    onPrimary = Color(0xFF0E1218),
    secondary = Color(0xFFB5C0CE),
    onSecondary = Color(0xFF12171F),
    background = Color(0xFF0A0D12),
    onBackground = Color(0xFFF5F7FA),
    surface = Color(0xFF141922),
    onSurface = Color(0xFFF5F7FA),
    surfaceVariant = Color(0xFF1E2532),
    onSurfaceVariant = Color(0xFFA9B4C3),
    outline = Color(0x40FFFFFF),
    error = Color(0xFFFF6B7A)
)

@Composable
fun StudioTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LiquidGlassColors,
        typography = StudioTypography,
        content = content
    )
}
