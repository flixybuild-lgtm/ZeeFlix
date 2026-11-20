plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val sharedAssetsDir = layout.buildDirectory.dir("generated/zeeflixAssets")
val testCatalogDir = layout.buildDirectory.dir("generated/zeeflixTestResources")

val syncZeeFlixAssets by tasks.registering(Copy::class) {
    val webPublic = rootProject.layout.projectDirectory.dir("../public")
    into(sharedAssetsDir)
    from(webPublic.file("catalog.tsv"))
    from(webPublic.dir("art")) {
        into("art")
        include("*.webp")
    }
    from(webPublic.dir("media")) {
        into("media")
        include("*.webm", "*.vtt")
    }
}

// Keeps the local unit tests pinned to the live catalogue without duplicating the file.
val syncTestCatalog by tasks.registering(Copy::class) {
    from(rootProject.layout.projectDirectory.dir("../public/catalog.tsv"))
    into(testCatalogDir)
}

android {
    namespace = "com.zeeflix.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.zeeflix.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 3
        versionName = "1.2.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(sharedAssetsDir)
        }
        getByName("test") {
            resources.srcDir(testCatalogDir)
        }
    }

    androidResources {
        noCompress += listOf("webm", "webp", "vtt")
    }

    lint {
        abortOnError = false
    }
}

tasks.named("preBuild").configure {
    dependsOn(syncZeeFlixAssets, syncTestCatalog)
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.5.1")
    implementation("androidx.media3:media3-exoplayer-dash:1.5.1")
    implementation("androidx.media3:media3-ui:1.5.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    testImplementation("junit:junit:4.13.2")
}
