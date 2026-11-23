package app.codetovideo.studio.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val StudioColors = darkColorScheme(
    primary = Color(0xFF66E3D1),
    onPrimary = Color(0xFF06211F),
    secondary = Color(0xFF9EAFFF),
    onSecondary = Color(0xFF141D46),
    background = Color(0xFF090D19),
    onBackground = Color(0xFFF3F5FB),
    surface = Color(0xFF111827),
    onSurface = Color(0xFFF3F5FB),
    surfaceVariant = Color(0xFF202B3D),
    onSurfaceVariant = Color(0xFFBAC5D8),
    error = Color(0xFFFF8B9A)
)

@Composable
fun StudioTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = StudioColors, content = content)
}
