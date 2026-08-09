package com.clinicvoiceroom.staff

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

internal val Ink = Color(0xFF191F28)
internal val Mist = Color(0xFFF7F8FA)
internal val Trust = Color(0xFF3182F6)
internal val TrustText = Color(0xFF1666C5)
internal val Mint = Color(0xFF00A881)
internal val Coral = Color(0xFFF04452)
internal val SlateText = Color(0xFF64748B)
internal val Line = Color(0xFFE2E8F0)
internal val Panel = Color(0xFFF8FAFC)
internal val BlueTint = Color(0xFFEFF6FF)
internal val GreenTint = Color(0xFFEFFCF7)
internal val RoseTint = Color(0xFFFFF1F2)

internal val MediVoiceLightColorScheme = lightColorScheme(
    primary = Trust,
    onPrimary = Color.White,
    primaryContainer = BlueTint,
    onPrimaryContainer = Ink,
    inversePrimary = Color(0xFFA8C7FA),
    secondary = Mint,
    onSecondary = Color.White,
    secondaryContainer = GreenTint,
    onSecondaryContainer = Ink,
    tertiary = Color(0xFFB45309),
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFFF7ED),
    onTertiaryContainer = Color(0xFF7C2D12),
    background = Mist,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Panel,
    onSurfaceVariant = SlateText,
    surfaceTint = Trust,
    inverseSurface = Ink,
    inverseOnSurface = Color.White,
    error = Coral,
    onError = Color.White,
    errorContainer = RoseTint,
    onErrorContainer = Color(0xFF881337),
    outline = Color(0xFF94A3B8),
    outlineVariant = Line,
    scrim = Color.Black,
    surfaceBright = Color.White,
    surfaceDim = Color(0xFFE8EAED),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFFBFCFD),
    surfaceContainer = Panel,
    surfaceContainerHigh = Color(0xFFF1F5F9),
    surfaceContainerHighest = Color(0xFFE8EDF3)
)

@Composable
internal fun MediVoiceTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = MediVoiceLightColorScheme,
        content = content
    )
}