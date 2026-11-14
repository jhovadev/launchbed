package {{packageName}}.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class GreetingTest {
    @Test
    fun `zero taps shows the initial message`() {
        assertEquals("Ready to build.", greetingMessage(0))
    }

    @Test
    fun `one tap is reported in singular`() {
        assertEquals("You tapped once.", greetingMessage(1))
    }

    @Test
    fun `many taps are reported with the count`() {
        assertEquals("You tapped 7 times.", greetingMessage(7))
    }

    @Test
    fun `negative values are treated as zero`() {
        assertEquals("Ready to build.", greetingMessage(-3))
    }
}
