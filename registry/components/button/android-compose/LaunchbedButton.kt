package {{packageName}}.ui.components

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import {{packageName}}.ui.theme.Spacing

enum class LaunchbedButtonVariant { Filled, Outlined, Text }
enum class LaunchbedButtonSize { Sm, Md, Lg }

@Composable
fun LaunchbedButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: LaunchbedButtonVariant = LaunchbedButtonVariant.Filled,
    size: LaunchbedButtonSize = LaunchbedButtonSize.Md,
    enabled: Boolean = true,
) {
    val padding = when (size) {
        LaunchbedButtonSize.Sm -> PaddingValues(horizontal = Spacing.sm, vertical = 6.dp)
        LaunchbedButtonSize.Md -> PaddingValues(horizontal = Spacing.md, vertical = Spacing.sm)
        LaunchbedButtonSize.Lg -> PaddingValues(horizontal = Spacing.lg, vertical = Spacing.sm)
    }
    val semantics = modifier.semantics { contentDescription = label }
    when (variant) {
        LaunchbedButtonVariant.Filled -> Button(onClick = onClick, modifier = semantics, enabled = enabled, contentPadding = padding) { Text(label) }
        LaunchbedButtonVariant.Outlined -> OutlinedButton(onClick = onClick, modifier = semantics, enabled = enabled, contentPadding = padding) { Text(label) }
        LaunchbedButtonVariant.Text -> TextButton(onClick = onClick, modifier = semantics, enabled = enabled, contentPadding = padding) { Text(label) }
    }
}
