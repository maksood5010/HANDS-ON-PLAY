import java.io.FileInputStream
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.hilt)
    alias(libs.plugins.google.services)
    id("kotlin-kapt")
}

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        load(FileInputStream(keystorePropertiesFile))
    }
}
hilt {
    enableAggregatingTask = false
}

fun escapeForBuildConfig(value: String): String =
    "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

val mqttUsername: String = (project.findProperty("MQTT_USERNAME") as String?) ?: ""
val mqttPassword: String = (project.findProperty("MQTT_PASSWORD") as String?) ?: ""

android {
    namespace = "com.hoi.player"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hoi.player"
        minSdk = 28
        targetSdk = 36
        versionCode = 7
        versionName = "1.7"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "MQTT_USERNAME", escapeForBuildConfig(mqttUsername))
        buildConfigField("String", "MQTT_PASSWORD", escapeForBuildConfig(mqttPassword))
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    signingConfigs {
        create("release") {
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }

    // HiveMQ → Netty: multiple jars ship the same META-INF files
    packaging {
        resources {
            excludes += setOf(
                "META-INF/INDEX.LIST",
                "META-INF/io.netty.versions.properties",
                "META-INF/DEPENDENCIES",
            )
        }
    }
}
val lifecycle_version = "2.2.0"
dependencies {

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    implementation (libs.kotlinx.coroutines.android)

    androidTestImplementation(libs.androidx.espresso.core)

    implementation(libs.hilt.android)
    kapt(libs.hilt.compiler)
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-analytics")
    implementation(libs.firebase.messaging)

    implementation("com.squareup.retrofit2:retrofit:2.0.2")
    implementation("com.squareup.retrofit2:converter-gson:2.0.2")
    implementation("com.squareup.okhttp3:logging-interceptor:4.3.1")
    implementation("com.squareup.retrofit2:converter-jackson:2.7.1")
    implementation("com.squareup.okhttp3:okhttp:4.3.1")
    implementation ("com.google.code.gson:gson:2.8.7")
    implementation("androidx.fragment:fragment-ktx:1.6.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:$lifecycle_version")
// ViewModel
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:${lifecycle_version}")
// LiveData
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:${lifecycle_version}")
    implementation("android.arch.lifecycle:extensions:1.1.1")

    // Glide for images (built-in disk cache)
    implementation("com.github.bumptech.glide:glide:4.16.0")

// ExoPlayer (media3) — progressive MP4 + disk cache
    val media3 = "1.4.1"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-ui:$media3")
    implementation("androidx.media3:media3-session:$media3")
    implementation("androidx.media3:media3-database:$media3")
    implementation("androidx.media3:media3-datasource-okhttp:$media3")
    implementation("androidx.media3:media3-transformer:$media3")
    implementation("androidx.media3:media3-effect:$media3")

// ViewPager2 (uses RecyclerView)
    implementation("androidx.viewpager2:viewpager2:1.1.0")

    implementation("com.hivemq:hivemq-mqtt-client:1.3.3")
    implementation("androidx.lifecycle:lifecycle-process:${lifecycle_version}")

}