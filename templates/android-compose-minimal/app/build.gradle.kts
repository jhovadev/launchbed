plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.compose.compiler)
    // @initializr-slot app-plugins
}

android {
    namespace = "{{namespace}}"
    compileSdk = {{compileSdk}}

    defaultConfig {
        applicationId = "{{applicationId}}"
        minSdk = {{minSdk}}
        targetSdk = {{targetSdk}}
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            // AGP 9.3+: enables R8 and optimized resource shrinking for release.
            optimization {
                enable = true
            }
            proguardFiles("proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }
    // @initializr-slot app-room-config
}

dependencies {
    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)

    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)

    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
    // @initializr-slot app-dependencies
}
