buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        // AGP 9 ships built-in Kotlin support. This upgrades the Kotlin toolchain
        // used by AGP and by the Compose compiler to the pinned project version.
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:{{kotlinVersion}}")
    }
}

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.compose.compiler) apply false
    // @initializr-slot root-plugins
}
