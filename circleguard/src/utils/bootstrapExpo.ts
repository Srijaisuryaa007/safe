// circleguard/src/utils/bootstrapExpo.ts
// Guarantees globalThis.expo and core polyfills are installed before any module runs

import 'react-native-url-polyfill/auto';

if (typeof globalThis !== 'undefined') {
  if (!globalThis.expo) {
    (globalThis as any).expo = {};
  }

  // Standalone zero-dependency EventEmitter to prevent "[runtime not ready]: TypeError: Cannot read property 'EventEmitter' of undefined"
  class PureEventEmitter {
    private _listeners = new Map<string, Set<Function>>();

    addListener(eventName: string, listener: Function) {
      if (!this._listeners.has(eventName)) {
        this._listeners.set(eventName, new Set());
      }
      this._listeners.get(eventName)!.add(listener);
      return {
        remove: () => {
          this.removeListener(eventName, listener);
        },
      };
    }

    removeListener(eventName: string, listener: Function) {
      this._listeners.get(eventName)?.delete(listener);
    }

    removeAllListeners(eventName?: string) {
      if (eventName) {
        this._listeners.get(eventName)?.clear();
      } else {
        this._listeners.clear();
      }
    }

    emit(eventName: string, ...args: any[]) {
      const listeners = this._listeners.get(eventName);
      if (listeners) {
        listeners.forEach((fn) => {
          try {
            fn(...args);
          } catch (e) {
            console.error(e);
          }
        });
      }
    }

    listenerCount(eventName: string): number {
      return this._listeners.get(eventName)?.size ?? 0;
    }

    startObserving(_eventName: string) {}
    stopObserving(_eventName: string) {}
  }

  class PureNativeModule extends PureEventEmitter {
    [key: string]: any;
  }

  class PureSharedObject extends PureEventEmitter {
    release() {}
  }

  class PureSharedRef extends PureSharedObject {
    nativeRefType = 'unknown';
  }

  if (!globalThis.expo.EventEmitter) {
    globalThis.expo.EventEmitter = PureEventEmitter as any;
  }
  if (!globalThis.expo.NativeModule) {
    globalThis.expo.NativeModule = PureNativeModule as any;
  }
  if (!globalThis.expo.SharedObject) {
    globalThis.expo.SharedObject = PureSharedObject as any;
  }
  if (!globalThis.expo.SharedRef) {
    globalThis.expo.SharedRef = PureSharedRef as any;
  }
  if (!globalThis.expo.modules) {
    globalThis.expo.modules = (globalThis as any).ExpoDomWebView?.expoModulesProxy ?? {};
  }

  // Try to load official polyfill to enhance if available
  try {
    const { installExpoGlobalPolyfill } = require('expo-modules-core/src/polyfill/dangerous-internal');
    installExpoGlobalPolyfill();
  } catch (_) {
    try {
      const { installExpoGlobalPolyfill: fallbackInstall } = require('expo-modules-core/build/polyfill/dangerous-internal');
      fallbackInstall();
    } catch (__) {}
  }
}
