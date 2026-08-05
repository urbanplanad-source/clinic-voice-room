plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val releaseKeystorePath = providers.environmentVariable("CVR_ANDROID_KEYSTORE").orNull
val releaseKeystorePassword = providers.environmentVariable("CVR_ANDROID_KEYSTORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("CVR_ANDROID_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("CVR_ANDROID_KEY_PASSWORD").orNull
val appVersionName = "0.3.37"
val brandedFieldApkName = "medivoice-$appVersionName-field.apk"
val brandedReleaseBundleName = "medivoice-$appVersionName-release.aab"
val hasReleaseSigning = listOf(
    releaseKeystorePath,
    releaseKeystorePassword,
    releaseKeyAlias,
    releaseKeyPassword
).all { !it.isNullOrBlank() }

if (!hasReleaseSigning) {
    logger.warn("MediVoice field/release signing env vars are missing; field APK will use the debug fallback key.")
}

android {
    namespace = "com.clinicvoiceroom.staff"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.clinicvoiceroom.staff"
        minSdk = 26
        targetSdk = 35
        versionCode = 49
        versionName = appVersionName
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseKeystorePath!!)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            isShrinkResources = false
        }

        create("field") {
            initWith(getByName("release"))
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = if (hasReleaseSigning) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            matchingFallbacks += listOf("release", "debug")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }

        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.zxing:core:3.5.3")
    testImplementation("junit:junit:4.13.2")

    debugImplementation("androidx.compose.ui:ui-tooling")
}

tasks.register("copyBrandedFieldApk") {
    group = "build"
    description = "Copies the field APK to the MediVoice install filename."
    val fieldApk = layout.buildDirectory.file("outputs/apk/field/app-field.apk")
    val brandedFieldApk = layout.buildDirectory.file("outputs/apk/field/$brandedFieldApkName")
    inputs.file(fieldApk)
    outputs.file(brandedFieldApk)
    dependsOn("assembleField")
    doLast {
        copy {
            from(fieldApk)
            into(brandedFieldApk.get().asFile.parentFile)
            rename { brandedFieldApkName }
        }
    }
}

tasks.register("copyBrandedReleaseBundle") {
    group = "build"
    description = "Copies the release app bundle to the MediVoice Play upload filename."
    val releaseBundle = layout.buildDirectory.file("outputs/bundle/release/app-release.aab")
    val brandedReleaseBundle = layout.buildDirectory.file("outputs/bundle/release/$brandedReleaseBundleName")
    inputs.file(releaseBundle)
    outputs.file(brandedReleaseBundle)
    dependsOn("bundleRelease")
    doLast {
        copy {
            from(releaseBundle)
            into(brandedReleaseBundle.get().asFile.parentFile)
            rename { brandedReleaseBundleName }
        }
    }
}
