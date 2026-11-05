// circleguard/src/utils/bootstrapExpo.ts
// Guarantees globalThis.expo and core polyfills are installed before any module runs

import 'react-native-url-polyfill/auto';

if (typeof globalThis !== 'undefined') {
  if (!globalThis.expo) {
    (globalThis as any).expo = {};
  }

  // Ensure EventEmitter and core polyfills exist immediately
  if (!globalThis.expo.EventEmitter) {
    try {
      const { installExpoGlobalPolyfill } = require('expo-modules-core/src/polyfill/dangerous-internal');
      installExpoGlobalPolyfill();
    } catch (_) {
      try {
        const { installExpoGlobalPolyfill: fallbackInstall } = require('expo-modules-core/build/polyfill/dangerous-internal');
        fallbackInstall();
      } catch (__) {
        try {
          const { EventEmitter } = require('expo-modules-core/src/polyfill/CoreModule');
          globalThis.expo.EventEmitter = EventEmitter;
        } catch (___) {}
      }
    }
  }
}
