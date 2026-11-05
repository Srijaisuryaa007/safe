import { Platform, NativeModules, TurboModuleRegistry } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Safely checks if the native RNGoogleSignin module is actually compiled into the running binary.
 * In Expo Go, custom native binary modules are not supported, so this will safely return false
 * without triggering an Invariant Violation from TurboModuleRegistry.getEnforcing.
 */
export const isNativeGoogleSigninSupported = (): boolean => {
  if (Platform.OS === 'web') return false;

  // In Expo Go, custom native binary modules are not supported.
  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    (Constants.executionEnvironment as string) === 'storeClient';

  if (isExpoGo) return false;

  try {
    // Safely check TurboModule without triggering getEnforcing
    if (TurboModuleRegistry && typeof TurboModuleRegistry.get === 'function') {
      const turboModule = TurboModuleRegistry.get('RNGoogleSignin');
      if (turboModule) return true;
    }
  } catch {
    // Ignore and fallback
  }

  try {
    // Safely check legacy bridge module
    if (
      NativeModules &&
      NativeModules.RNGoogleSignin &&
      typeof NativeModules.RNGoogleSignin.signIn === 'function'
    ) {
      return true;
    }
  } catch {
    // Ignore
  }

  return false;
};

/**
 * Safely disconnects Google Sign-in session if the native module is present.
 */
export const safeGoogleSignOut = async (): Promise<void> => {
  if (!isNativeGoogleSigninSupported()) return;
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // Graceful fallback
  }
};

/**
 * Safely performs native Google Sign-in if supported by the binary.
 * Returns idToken string on success, 'CANCELLED' if user cancelled, or null if native is unavailable.
 */
export const safeNativeGoogleSignIn = async (webClientId: string): Promise<string | null> => {
  if (!isNativeGoogleSigninSupported()) return null;

  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      webClientId,
      offlineAccess: true,
    });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore signOut errors before sign in
    }

    const response = await GoogleSignin.signIn();
    const idToken =
      response?.data?.idToken ||
      response?.idToken ||
      (response as any)?.data?.idToken ||
      (response as any)?.idToken;

    return idToken || null;
  } catch (err: any) {
    const isCancelled =
      err?.code === '13' ||
      err?.code === 'SIGN_IN_CANCELLED' ||
      err?.message?.toLowerCase()?.includes('cancel');

    if (isCancelled) {
      return 'CANCELLED';
    }

    console.log('Native Google sign in skipped/fallback:', err?.message);
    return null;
  }
};
