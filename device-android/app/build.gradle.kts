plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.hilt)
    id("kotlin-kapt")
}
hilt {
    enableAggregatingTask = false
}

android {
    namespace = "com.hoi.player"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hoi.player"
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildFeatures{
        viewBinding =true
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
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
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

// ExoPlayer (media3) for video with disk cache
    implementation("androidx.media3:media3-exoplayer:1.2.0")
    implementation("androidx.media3:media3-ui:1.2.0")
    implementation("androidx.media3:media3-database:1.2.0")
    implementation("androidx.media3:media3-datasource-okhttp:1.2.0")

// ViewPager2 (uses RecyclerView)
    implementation("androidx.viewpager2:viewpager2:1.1.0")

}