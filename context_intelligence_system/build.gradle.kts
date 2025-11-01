import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.intellij.platform.gradle.extensions.intellijPlatform

plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.0.21"
    id("org.jetbrains.intellij.platform")
    kotlin("plugin.serialization") version "2.0.21"
}

group = "nexus.saaamllc"
version = "0.1.0-alpha"

dependencies {
    // IntelliJ Platform dependency (required by new plugin)
    intellijPlatform {
        intellijIdeaCommunity("2024.3")
        bundledPlugins(
            "com.intellij.java",
            "org.jetbrains.kotlin"
        )

        // Plugin verification and tools
        pluginVerifier()
    }

    // Serialization (coroutines and stdlib are provided by IntelliJ Platform)
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-core:1.8.1")

    // Ktor Server (WebSocket)
    implementation("io.ktor:ktor-server-core-jvm:3.0.2")
    implementation("io.ktor:ktor-server-cio-jvm:3.0.2")
    implementation("io.ktor:ktor-server-websockets-jvm:3.0.2")

    // Ktor Client
    implementation("io.ktor:ktor-client-core-jvm:3.0.2")
    implementation("io.ktor:ktor-client-cio-jvm:3.0.2")

    // Logging
    implementation("io.github.oshai:kotlin-logging-jvm:7.0.0")
    implementation("org.slf4j:slf4j-api:2.0.16")

    // Testing
    testImplementation("org.jetbrains.kotlin:kotlin-test")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")
}

intellijPlatform {
    pluginConfiguration {
        version.set(provider { project.version.toString() })
        name.set("NEXUS Code")
        ideaVersion {
            sinceBuild.set("243")
            untilBuild.set("243.*")
        }
    }

    signing {
        certificateChain.set(System.getenv("CERTIFICATE_CHAIN"))
        privateKey.set(System.getenv("PRIVATE_KEY"))
        password.set(System.getenv("PRIVATE_KEY_PASSWORD"))
    }

    publishing {
        token.set(System.getenv("PUBLISH_TOKEN"))
    }

    pluginVerification {
        ides {
            recommended()
        }
    }
}

tasks {
    withType<JavaCompile> {
        sourceCompatibility = "21"
        targetCompatibility = "21"
    }

    withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_21)
        }
    }

    patchPluginXml {
        sinceBuild.set("243")
        untilBuild.set("243.*")
    }
}

kotlin {
    jvmToolchain(21)
}
