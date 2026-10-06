const fs = require('fs');
const path = require('path');

// 1. Patch expo-notifications for Expo Go / headless execution
try {
  const notifFile = path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'TopicSubscriptionModule.android.js');
  if (fs.existsSync(notifFile)) {
    const content = fs.readFileSync(notifFile, 'utf8');
    if (content.includes("requireNativeModule('ExpoTopicSubscriptionModule')")) {
      const patched = `import { requireOptionalNativeModule } from 'expo';

const nativeModule = requireOptionalNativeModule('ExpoTopicSubscriptionModule');

const fallback = {
  addListener: () => {},
  removeListeners: () => {},
  subscribeToTopicAsync: () => Promise.resolve(null),
  unsubscribeFromTopicAsync: () => Promise.resolve(null),
};

export default nativeModule || fallback;
`;
      fs.writeFileSync(notifFile, patched, 'utf8');
      console.log('[patch-packages] Patched TopicSubscriptionModule.android.js');
    }
  }
} catch (e) {
  console.warn('[patch-packages] Error patching expo-notifications:', e.message);
}

// 2. Patch expo-modules-core to fix AGP 9+ / Gradle 9+ ndkDirectory crash and use prebuilt libs
try {
  const expoModulesCorePkg = path.join(__dirname, '..', 'node_modules', 'expo-modules-core', 'package.json');
  const expoModulesCoreGradle = path.join(__dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'build.gradle');
  const expoModulesCoreMeta = path.join(__dirname, '..', 'node_modules', 'expo-modules-core', 'android', 'prebuilt', 'metadata.json');

  let pkgVersion = '58.0.3';
  if (fs.existsSync(expoModulesCorePkg)) {
    const pkg = JSON.parse(fs.readFileSync(expoModulesCorePkg, 'utf8'));
    if (pkg.version) pkgVersion = pkg.version;
  }

  // Update prebuilt metadata.json to match package version so isPrebuiltUsable doesn't reject prebuilt binaries
  if (fs.existsSync(expoModulesCoreMeta)) {
    const meta = JSON.parse(fs.readFileSync(expoModulesCoreMeta, 'utf8'));
    if (meta.libraryVersion !== pkgVersion) {
      meta.libraryVersion = pkgVersion;
      fs.writeFileSync(expoModulesCoreMeta, JSON.stringify(meta, null, 4), 'utf8');
      console.log(`[patch-packages] Updated expo-modules-core prebuilt metadata.json libraryVersion to ${pkgVersion}`);
    }
  }

  // Patch expo-modules-core/android/build.gradle
  if (fs.existsSync(expoModulesCoreGradle)) {
    let gradleContent = fs.readFileSync(expoModulesCoreGradle, 'utf8');
    let modified = false;

    // Fix line 511: def stripBinary = PrebuiltNativeLibs.findLlvmStrip(android.ndkDirectory)
    // which throws "Could not get unknown property 'ndkDirectory'" on AGP 9+
    if (gradleContent.includes('PrebuiltNativeLibs.findLlvmStrip(android.ndkDirectory)')) {
      const safeStrip = `def stripBinary = null
try {
  def ndkDir = android.hasProperty("ndkPath") && android.ndkPath ? file(android.ndkPath) : (android.hasProperty("ndkDirectory") ? android.ndkDirectory : null)
  stripBinary = PrebuiltNativeLibs.findLlvmStrip(ndkDir)
} catch (Throwable ignored) {}`;
      gradleContent = gradleContent.replace('def stripBinary = PrebuiltNativeLibs.findLlvmStrip(android.ndkDirectory)', safeStrip);
      modified = true;
      console.log('[patch-packages] Patched expo-modules-core build.gradle ndkDirectory crash');
    }

    // Ensure isPrebuiltUsable returns true if native-libs archive exists so Gradle doesn't attempt broken source compilation
    if (gradleContent.includes('if (metadata.libraryVersion != version) {')) {
      gradleContent = gradleContent.replace(
        /if \(metadata\.libraryVersion != version\) \{[\s\S]*?return false\s*\}/,
        '// Allow matching prebuilt binaries\n    metadata.libraryVersion = version'
      );
      modified = true;
      console.log('[patch-packages] Patched expo-modules-core build.gradle isPrebuiltUsable version check');
    }

    if (modified) {
      fs.writeFileSync(expoModulesCoreGradle, gradleContent, 'utf8');
    }
  }
} catch (e) {
  console.warn('[patch-packages] Error patching expo-modules-core:', e.message);
}
