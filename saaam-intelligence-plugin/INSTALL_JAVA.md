# Installing Java 21 for NEXUS Plugin Build

## Quick Install Options

### Option 1: Microsoft Build of OpenJDK (Recommended for Windows)
**Direct Download**: https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.msi

1. Download the MSI installer
2. Run it (installs to `C:\Program Files\Microsoft\jdk-21.x.x`)
3. Installer sets JAVA_HOME automatically
4. Restart terminal
5. Test: `java -version`

### Option 2: Oracle JDK 21
**Download**: https://www.oracle.com/java/technologies/downloads/#java21

1. Download Windows x64 Installer
2. Run installer
3. Set JAVA_HOME manually (see below)

### Option 3: Amazon Corretto 21
**Download**: https://corretto.aws/downloads/latest/amazon-corretto-21-x64-windows-jdk.msi

1. Download MSI
2. Run installer
3. Set JAVA_HOME manually (see below)

### Option 4: Chocolatey (if you have it)
```bash
choco install microsoft-openjdk21
```

## Setting JAVA_HOME (if needed)

### For Current Session (Quick Test)
```bash
export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.5.11-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
```

### Permanently (Windows Environment Variables)

#### Method 1: GUI
1. Search for "Environment Variables" in Windows
2. Click "Edit the system environment variables"
3. Click "Environment Variables" button
4. Under "System variables", click "New"
5. Variable name: `JAVA_HOME`
6. Variable value: `C:\Program Files\Microsoft\jdk-21.0.5.11-hotspot` (or your install path)
7. Click OK
8. Find "Path" in System variables, click "Edit"
9. Click "New" and add: `%JAVA_HOME%\bin`
10. Click OK on everything
11. **Restart your terminal**

#### Method 2: PowerShell (Admin)
```powershell
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Microsoft\jdk-21.0.5.11-hotspot", "Machine")
$path = [Environment]::GetEnvironmentVariable("Path", "Machine")
[Environment]::SetEnvironmentVariable("Path", "$path;%JAVA_HOME%\bin", "Machine")
```

#### Method 3: Command Prompt (Admin)
```cmd
setx JAVA_HOME "C:\Program Files\Microsoft\jdk-21.0.5.11-hotspot" /M
setx PATH "%PATH%;%JAVA_HOME%\bin" /M
```

## Verify Installation

```bash
# Check Java version (should show 21.x.x)
java -version

# Check JAVA_HOME
echo $JAVA_HOME

# Check javac (compiler)
javac -version
```

Expected output:
```
openjdk version "21.0.x" 2024-xx-xx
OpenJDK Runtime Environment Microsoft-xxxxxxx (build 21.0.x+xx)
OpenJDK 64-Bit Server VM Microsoft-xxxxxxx (build 21.0.x+xx, mixed mode, sharing)
```

## After Java is Installed

### Build the Plugin
```bash
cd context_intelligence_system
./gradlew buildPlugin
```

### Or Build and Run Test IDE
```bash
./gradlew runIde
```

### Build Output Location
```
build/distributions/NEXUS-Code-0.1.0-alpha.zip
```

## Troubleshooting

### "gradle: command not found"
✅ Don't worry! Gradle is included via `gradlew` wrapper.
Use `./gradlew` (not just `gradle`)

### "Permission denied: ./gradlew"
```bash
chmod +x gradlew
./gradlew buildPlugin
```

### Wrong Java Version
```bash
# Check what you have
java -version

# If it shows Java 8, 11, 17, etc.
# Install Java 21 and update JAVA_HOME
```

### JAVA_HOME still not set after install
**Restart your terminal!** Environment variable changes require a new shell session.

### "Could not find tools.jar"
You might have installed JRE instead of JDK. Download the **JDK** (Development Kit), not JRE (Runtime).

## Quick Setup Script (Git Bash/MSYS2)

```bash
# Download Microsoft OpenJDK 21
curl -L "https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.msi" -o jdk21.msi

# Install (will open GUI)
msiexec /i jdk21.msi

# After install completes, set JAVA_HOME for current session
export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.5.11-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"

# Verify
java -version

# Build plugin
cd context_intelligence_system
./gradlew buildPlugin
```

## Alternative: Use IntelliJ's Bundled JDK

If you already have IntelliJ installed, it comes with Java!

### Find IntelliJ's JDK
Typically at:
```
C:\Program Files\JetBrains\IntelliJ IDEA 2024.3\jbr
```

### Set it temporarily
```bash
export JAVA_HOME="/c/Program Files/JetBrains/IntelliJ IDEA 2024.3/jbr"
export PATH="$JAVA_HOME/bin:$PATH"
./gradlew buildPlugin
```

## After Successful Build

You'll see:
```
BUILD SUCCESSFUL in Xs
```

Output file:
```
build/distributions/NEXUS-Code-0.1.0-alpha.zip
```

Install in IntelliJ:
1. Settings → Plugins
2. Click gear icon → Install Plugin from Disk
3. Select the `.zip` file
4. Restart IntelliJ
5. Plugin is ready!

---

**Need Help?**
Check: https://docs.gradle.org/current/userguide/installation.html#sec:prerequisites
