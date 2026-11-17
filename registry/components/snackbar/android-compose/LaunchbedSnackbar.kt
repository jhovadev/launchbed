package {{packageName}}.ui.components

import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics

/**
 * Static snackbar surface. For timed messages, prefer SnackbarHostState.showSnackbar()
 * in a Scaffold; this composable keeps the Launchbed look for custom hosts.
 */
@Composable
fun LaunchbedSnackbar(
    message: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val actionSlot: (@Composable () -> Unit)? = if (actionLabel != null && onAction != null) {
        { TextButton(onClick = onAction) { Text(actionLabel) } }
    } else {
        null
    }
    Snackbar(
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        action = actionSlot,
    ) {
        Text(text = message)
    }
}
