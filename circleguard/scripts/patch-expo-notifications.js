const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'TopicSubscriptionModule.android.js');

if (fs.existsSync(targetFile)) {
  const content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes("requireNativeModule('ExpoTopicSubscriptionModule')")) {
    const patchedContent = `import { requireOptionalNativeModule } from 'expo';

const nativeModule = requireOptionalNativeModule('ExpoTopicSubscriptionModule');

const fallback = {
  addListener: () => {},
  removeListeners: () => {},
  subscribeToTopicAsync: () => Promise.resolve(null),
  unsubscribeFromTopicAsync: () => Promise.resolve(null),
};

export default nativeModule || fallback;
`;
    fs.writeFileSync(targetFile, patchedContent, 'utf8');
    console.log('[patch-expo-notifications] Successfully patched TopicSubscriptionModule.android.js for Expo Go');
  }
}
