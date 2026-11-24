package app.codetovideo.studio.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

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
    MaterialTheme(colorScheme = LiquidGlassColors, content = content)
}
