import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val copyWww by tasks.registering(Copy::class) {
    from("../../www")
    into(layout.buildDirectory.dir("www_assets/www"))
}

android {
    namespace = "com.vigora.fit"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.vigora.fit"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
    sourceSets { getByName("main") { assets.srcDir(layout.buildDirectory.dir("www_assets")) } }
    buildTypes { release { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("debug") } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    lint { abortOnError = false; checkReleaseBuilds = false }
}
kotlin { compilerOptions { jvmTarget.set(JvmTarget.JVM_17) } }
tasks.matching { it.name.startsWith("merge") && it.name.endsWith("Assets") }.configureEach { dependsOn(copyWww) }
tasks.matching { it.name.startsWith("lintVital") || it.name.startsWith("generate") && it.name.endsWith("LintReportModel") }.configureEach { dependsOn(copyWww) }
