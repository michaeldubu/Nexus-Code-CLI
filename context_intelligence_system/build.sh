#!/bin/bash
# Quick build script with JAVA_HOME set

export JAVA_HOME="/c/Program Files/Microsoft/jdk-21.0.9.10-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"

echo "🔧 Java configured:"
java -version
echo ""

echo "🏗️  Building NEXUS plugin..."
./gradlew buildPlugin "$@"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo "📦 Plugin location: build/distributions/NEXUS-Code-0.1.0-alpha.zip"
else
    echo ""
    echo "❌ Build failed. Check errors above."
    exit 1
fi
