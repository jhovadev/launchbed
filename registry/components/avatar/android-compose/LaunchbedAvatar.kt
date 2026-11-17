package {{packageName}}.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

enum class LaunchbedAvatarSize { Sm, Md, Lg }

@Composable
fun LaunchbedAvatar(
    initials: String,
    label: String,
    modifier: Modifier = Modifier,
    size: LaunchbedAvatarSize = LaunchbedAvatarSize.Md,
) {
    val diameter = when (size) {
        LaunchbedAvatarSize.Sm -> 28.dp
        LaunchbedAvatarSize.Md -> 40.dp
        LaunchbedAvatarSize.Lg -> 64.dp
    }
    val textStyle = when (size) {
        LaunchbedAvatarSize.Sm -> MaterialTheme.typography.labelSmall
        LaunchbedAvatarSize.Md -> MaterialTheme.typography.titleSmall
        LaunchbedAvatarSize.Lg -> MaterialTheme.typography.headlineSmall
    }
    Box(
        modifier = modifier
            .size(diameter)
            .background(MaterialTheme.colorScheme.primaryContainer, CircleShape)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initials.take(2).uppercase(),
            style = textStyle,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
        )
    }
}
