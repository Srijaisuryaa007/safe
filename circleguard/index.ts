import 'react-native-url-polyfill/auto';
// Ensure globalThis.expo and core emitter/module classes are installed before any module runs
if (typeof globalThis !== 'undefined' && (!globalThis.expo || !globalThis.expo.EventEmitter)) {
  try {
    const { installExpoGlobalPolyfill } = require('expo-modules-core/build/polyfill/dangerous-internal');
    installExpoGlobalPolyfill();
  } catch (_) {}
}

import { registerRootComponent } from 'expo';

// Module-scope background task definitions for OS-level geofencing & location updates
import './src/tasks/backgroundTasks';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

