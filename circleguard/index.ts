import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';

// Module-scope background task definitions for OS-level geofencing & location updates
import './src/tasks/backgroundTasks';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

