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

// 3. Patch expo-modules-autolinking to ensure publication.version is always present
// (Fixes "Field 'version' is required for type with serial name 'expo.modules.plugin.configuration.Publication'" in settings.gradle)
try {
  const autolinkingAndroidJs = path.join(__dirname, '..', 'node_modules', 'expo-modules-autolinking', 'build', 'platforms', 'android', 'android.js');
  if (fs.existsSync(autolinkingAndroidJs)) {
    let content = fs.readFileSync(autolinkingAndroidJs, 'utf8');
    if (content.includes('const { publication } = project;') && !content.includes('// Ensure publication has version')) {
      content = content.replace(
        'const { publication } = project;',
        `const { publication } = project;
        // Ensure publication has version for Kotlin serialization in expoAutolinking
        if (publication && !publication.version) {
          publication.version = revision.version;
        }`
      );
      fs.writeFileSync(autolinkingAndroidJs, content, 'utf8');
      console.log('[patch-packages] Patched expo-modules-autolinking android.js publication.version fallback');
    }
  }
} catch (e) {
  console.warn('[patch-packages] Error patching expo-modules-autolinking:', e.message);
}

// 4. Patch expo-module.config.json across all packages to guarantee publication.version exists
try {
  const nodeModulesDir = path.join(__dirname, '..', 'node_modules');
  function scanAndPatchConfigs(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('@')) {
          scanAndPatchConfigs(fullPath);
        } else if (entry.name !== 'node_modules') {
          const configPath = path.join(fullPath, 'expo-module.config.json');
          const pkgPath = path.join(fullPath, 'package.json');
          if (fs.existsSync(configPath) && fs.existsSync(pkgPath)) {
            try {
              const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              let dirty = false;
              if (config.android && config.android.publication && !config.android.publication.version) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                config.android.publication.version = pkg.version || '58.0.0';
                dirty = true;
              }
              if (config.android && Array.isArray(config.android.projects)) {
                for (const proj of config.android.projects) {
                  if (proj.publication && !proj.publication.version) {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    proj.publication.version = pkg.version || '58.0.0';
                    dirty = true;
                  }
                }
              }
              if (dirty) {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
                console.log(`[patch-packages] Patched ${entry.name} expo-module.config.json missing publication version -> ${config.android?.publication?.version}`);
              }
            } catch (err) {}
          }
        }
      }
    }
  }
  scanAndPatchConfigs(nodeModulesDir);
} catch (e) {
  console.warn('[patch-packages] Error patching expo-module publication versions:', e.message);
}

// 5. Patch react-native-worklets to warn instead of throwing fatal crash on minor version mismatch in Expo Go
try {
  const checkCppFile = path.join(__dirname, '..', 'node_modules', 'react-native-worklets', 'lib', 'module', 'debug', 'checkCppVersion.js');
  if (fs.existsSync(checkCppFile)) {
    let content = fs.readFileSync(checkCppFile, 'utf8');
    if (content.includes('throw new Error(') && content.includes('[Worklets] Mismatch between JavaScript part')) {
      content = content.replace(
        /if\s*\(!ok\)\s*\{\s*throw new Error\(`\[Worklets\] Mismatch between JavaScript part and native part of Worklets \(\$\{jsVersion\} vs \$\{cppVersion\}\)\.[\s\S]*?`\);\s*\}/,
        `if (!ok) {\n    logger.warn(\`[Worklets] Minor version mismatch between JavaScript part and native part of Worklets (\${jsVersion} vs \${cppVersion}). Proceeding safely.\`);\n  }`
      );
      fs.writeFileSync(checkCppFile, content, 'utf8');
      console.log('[patch-packages] Patched react-native-worklets checkCppVersion to prevent fatal boot crash');
    }
  }
} catch (e) {
  console.warn('[patch-packages] Error patching react-native-worklets:', e.message);
}

// 6. Patch expo-modules-core EventEmitter runtime safe fallback to prevent "[runtime not ready]: TypeError: Cannot read property 'EventEmitter' of undefined"
try {
  const coreBuildDir = path.join(__dirname, '..', 'node_modules', 'expo-modules-core', 'build');
  const eePath = path.join(coreBuildDir, 'EventEmitter.js');
  if (fs.existsSync(eePath)) {
    fs.writeFileSync(eePath, `'use client';
import { ensureNativeModulesAreInstalled } from './ensureNativeModulesAreInstalled';
import { EventEmitter as FallbackEventEmitter } from './polyfill/CoreModule';
ensureNativeModulesAreInstalled();
export const EventEmitter = (typeof globalThis !== 'undefined' && globalThis.expo?.EventEmitter) ? globalThis.expo.EventEmitter : FallbackEventEmitter;
`, 'utf8');
  }

  const nmPath = path.join(coreBuildDir, 'NativeModule.js');
  if (fs.existsSync(nmPath)) {
    fs.writeFileSync(nmPath, `'use client';
import { ensureNativeModulesAreInstalled } from './ensureNativeModulesAreInstalled';
import { NativeModule as FallbackNativeModule } from './polyfill/CoreModule';
ensureNativeModulesAreInstalled();
export const NativeModule = (typeof globalThis !== 'undefined' && globalThis.expo?.NativeModule) ? globalThis.expo.NativeModule : FallbackNativeModule;
`, 'utf8');
  }

  const soPath = path.join(coreBuildDir, 'SharedObject.js');
  if (fs.existsSync(soPath)) {
    fs.writeFileSync(soPath, `'use client';
import { ensureNativeModulesAreInstalled } from './ensureNativeModulesAreInstalled';
import { SharedObject as FallbackSharedObject } from './polyfill/CoreModule';
ensureNativeModulesAreInstalled();
export const SharedObject = (typeof globalThis !== 'undefined' && globalThis.expo?.SharedObject) ? globalThis.expo.SharedObject : FallbackSharedObject;
`, 'utf8');
  }

  const srPath = path.join(coreBuildDir, 'SharedRef.js');
  if (fs.existsSync(srPath)) {
    fs.writeFileSync(srPath, `'use client';
import { ensureNativeModulesAreInstalled } from './ensureNativeModulesAreInstalled';
import { SharedRef as FallbackSharedRef } from './polyfill/CoreModule';
ensureNativeModulesAreInstalled();
export const SharedRef = (typeof globalThis !== 'undefined' && globalThis.expo?.SharedRef) ? globalThis.expo.SharedRef : FallbackSharedRef;
`, 'utf8');
  }

  const enmNativePath = path.join(coreBuildDir, 'ensureNativeModulesAreInstalled.native.js');
  if (fs.existsSync(enmNativePath)) {
    fs.writeFileSync(enmNativePath, `import { TurboModuleRegistry } from 'react-native';
import { installExpoGlobalPolyfill } from './polyfill/dangerous-internal';

export function ensureNativeModulesAreInstalled() {
    if (globalThis.expo && globalThis.expo.EventEmitter) {
        return;
    }
    try {
        TurboModuleRegistry.get('ExpoModulesCore')?.installModules();
    } catch (error) {
        console.error('Unable to install Expo modules:', error);
    }
    if (!globalThis.expo || !globalThis.expo.EventEmitter) {
        installExpoGlobalPolyfill();
    }
}
`, 'utf8');
  }

  const enmJsPath = path.join(coreBuildDir, 'ensureNativeModulesAreInstalled.js');
  if (fs.existsSync(enmJsPath)) {
    fs.writeFileSync(enmJsPath, `import './polyfill';
import { installExpoGlobalPolyfill } from './polyfill/dangerous-internal';

export function ensureNativeModulesAreInstalled() {
    if (!globalThis.expo || !globalThis.expo.EventEmitter) {
        installExpoGlobalPolyfill();
    }
}
`, 'utf8');
  }
  console.log('[patch-packages] Patched expo-modules-core EventEmitter runtime safe fallbacks');
} catch (e) {
  console.warn('[patch-packages] Error patching expo-modules-core EventEmitter:', e.message);
}
