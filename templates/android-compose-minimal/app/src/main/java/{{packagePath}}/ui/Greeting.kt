package {{packageName}}.ui

/**
 * Pure UI logic kept outside Compose so it can be verified with local unit tests.
 */
fun greetingMessage(taps: Int): String = when {
    taps <= 0 -> "Ready to build."
    taps == 1 -> "You tapped once."
    else -> "You tapped $taps times."
}
