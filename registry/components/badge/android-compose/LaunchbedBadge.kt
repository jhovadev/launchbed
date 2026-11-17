package {{packageName}}.ui.components

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import {{packageName}}.ui.theme.Spacing

enum class LaunchbedBadgeVariant { Neutral, Accent }

@Composable
fun LaunchbedBadge(
    label: String,
    modifier: Modifier = Modifier,
    variant: LaunchbedBadgeVariant = LaunchbedBadgeVariant.Neutral,
) {
    val colors = MaterialTheme.colorScheme
    val container = if (variant == LaunchbedBadgeVariant.Accent) colors.primary else colors.surfaceVariant
    val content = if (variant == LaunchbedBadgeVariant.Accent) colors.onPrimary else colors.onSurfaceVariant
    Surface(
        modifier = modifier.semantics { contentDescription = label },
        color = container,
        contentColor = content,
        shape = MaterialTheme.shapes.small,
    ) {
        Text(label, modifier = Modifier.padding(horizontal = Spacing.sm, vertical = 2.dp), style = MaterialTheme.typography.labelSmall)
    }
}
