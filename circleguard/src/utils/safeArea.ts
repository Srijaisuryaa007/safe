import { Platform, StatusBar } from 'react-native';

/**
 * Calculates a guaranteed safe top inset that accounts for:
 * 1. Android physical camera punch holes and notches (minimum 48dp on Android, or StatusBar.currentHeight + 10 if larger)
 * 2. Android notification bar / phone tower / battery / clock tray
 * 3. iOS Dynamic Island (54-59dp), iOS Notch (44-48dp), iOS classic (20dp)
 * 4. Responsive insets from react-native-safe-area-context
 */
export function getSafeTopInset(insetsTop: number = 0): number {
  if (Platform.OS === 'android') {
    const androidStatusHeight = StatusBar.currentHeight || 0;
    // Android punch-holes and status bar trays require at least 48dp, or status bar height + extra breathing room
    return Math.max(insetsTop, androidStatusHeight + 10, 48);
  }
  if (Platform.OS === 'ios') {
    // Dynamic island is ~54-59dp, notch is ~44-48dp, classic is 20dp
    return insetsTop > 0 ? insetsTop : 44;
  }
  return Math.max(insetsTop, 20);
}
