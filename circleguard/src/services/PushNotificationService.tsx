import { Platform, Vibration } from 'react-native';

export interface PushMessagePayload {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Clean stub for device push registration (Remote push disabled)
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  return null;
}

/**
 * Clean stub for remote push dispatch (Replaced with 100% Supabase Realtime Triggers)
 */
export async function sendExpoPushNotification(
  targetTokens: string | string[],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<boolean> {
  return true;
}

/**
 * Schedule instant local vibration and alert trigger on the device
 */
export async function scheduleLocalNotification(title: string, body: string, data: Record<string, any> = {}) {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate([0, 500, 200, 500]);
  } catch (e) {}
}
