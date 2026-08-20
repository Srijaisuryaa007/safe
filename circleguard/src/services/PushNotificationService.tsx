import { Platform, Vibration } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

/**
 * Dynamic module accessor for expo-notifications.
 * Safely loads expo-notifications for local system pop-up banners and notification channels.
 */
function getNotificationsModule(): any | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-notifications');
  } catch (e) {
    return null;
  }
}

// Configure system notification handler for native mobile pop-up banner presentation
try {
  const Notifications = getNotificationsModule();
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (e) {
  console.warn('[PushService] Notification handler init note:', e);
}

export interface PushMessagePayload {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Creative Zomato/Swiggy-Style Push Notification Templates
 */
export const CREATIVE_NOTIFICATION_TEMPLATES = {
  arrival: (name: string, placeName: string) => ({
    title: `SAFE ARRIVAL CONFIRMED`,
    body: `${name} entered boundary "${placeName}".`,
  }),
  departure: (name: string, placeName: string, speedKmh?: number) => ({
    title: `BOUNDARY DEPARTURE ALERT`,
    body: `${name} departed "${placeName}"${speedKmh ? ` traveling at ${speedKmh} km/h` : ''}. Live route monitoring active.`,
  }),
  sos: (name: string) => ({
    title: `URGENT: CIRCLE DISTRESS SIGNAL`,
    body: `${name} triggered an emergency SOS distress alert. Tap to view live location or contact immediately.`,
  }),
  nightCheckIn: () => ({
    title: `NIGHT SECURITY MONITORING`,
    body: `All circle members are confirmed safe inside registered boundaries.`,
  }),
  ghostMode: (name: string) => ({
    title: `STEALTH PRIVACY MODE`,
    body: `${name} activated Ghost Mode. Location obfuscated.`,
  }),
};

/**
 * Register device for system remote push notifications and save push_token to Supabase profile
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  // Check if app is running inside Expo Go client (SDK 52/53+ disables remote push in Expo Go)
  const isExpoGo = Constants.appOwnership === 'expo' || (Constants as any).executionEnvironment === 'storeClient';

  try {
    // 1. Android Notification Channel setup with MAX importance & Lockscreen Visibility for Emergency Distress
    if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync('emergency-distress-v2', {
        name: 'CircleGuard Emergency Distress',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        lightColor: '#EF4444',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync('default', {
        name: 'CircleGuard General Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF37',
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    // 2. Request System Push Notification Permissions
    if (Notifications.getPermissionsAsync && Notifications.requestPermissionsAsync) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[PushService] Notification permission not granted');
        return null;
      }
    }

    // Remote push token generation skipped in Expo Go SDK 53, works in Standalone builds
    if (isExpoGo) {
      console.log('[PushService] Remote push tokens skipped in Expo Go. Native mobile pop-up system notifications active.');
      return null;
    }

    // 3. Obtain Expo Push Token from Apple APNs / Google FCM
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    const token = tokenData?.data;

    if (token && userId) {
      await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);

      console.log('[PushService] System Push Token saved to Supabase profile:', token);
    }

    return token;
  } catch (err) {
    console.warn('[PushService] Push registration note:', err);
    return null;
  }
}

/**
 * Send real-time System Remote Push Notification via Expo Push API
 */
export async function sendExpoPushNotification(
  targetTokens: string | string[],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<boolean> {
  try {
    const tokens = Array.isArray(targetTokens) ? targetTokens : [targetTokens];
    const validTokens = tokens.filter(t => t && t.startsWith('ExponentPushToken'));

    if (validTokens.length === 0) return false;

    const messages = validTokens.map(token => ({
      to: token,
      sound: 'default',
      priority: 'high',
      channelId: 'emergency-distress-v2',
      _displayInForeground: true,
      title,
      body,
      data,
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('[PushService] System Push notification sent:', result);
    return true;
  } catch (e) {
    console.error('[PushService] Error sending push notification:', e);
    return false;
  }
}

/**
 * Broadcast System Remote Push Notification to all circle members
 */
export async function sendPushAlertToCircleMembers(
  circleId: string,
  senderUserId: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  try {
    // 1. Fetch circle members excluding sender
    const { data: memberRows } = await supabase
      .from('circle_members')
      .select('user_id, profiles(push_token)')
      .eq('circle_id', circleId)
      .neq('user_id', senderUserId);

    if (!memberRows || memberRows.length === 0) return;

    const tokens: string[] = [];
    memberRows.forEach(m => {
      let prof = m.profiles as any;
      if (Array.isArray(prof)) prof = prof[0];
      if (prof?.push_token) {
        tokens.push(prof.push_token);
      }
    });

    if (tokens.length > 0) {
      await sendExpoPushNotification(tokens, title, body, data);
    }
  } catch (e) {
    console.error('[PushService] Error sending circle push alert:', e);
  }
}

/**
 * Trigger Instant Native Mobile Pop-Up System Notification Banner with Sound & Vibration
 */
export async function scheduleLocalNotification(title: string, body: string, data: Record<string, any> = {}) {
  if (Platform.OS === 'web') return;
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    Vibration.vibrate([0, 500, 200, 500]);
    
    // Ensure Android Notification Channel is set to MAX importance for Top Screen Drop-Down Pop-Up Banner
    if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'CircleGuard Emergency Safety',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF37',
        sound: 'default',
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: 'high',
        categoryIdentifier: 'emergency',
        data,
      },
      trigger: null, // Triggers native mobile top pop-up system banner immediately!
    });
  } catch (e) {
    console.warn('[PushService] Local system notification pop-up error:', e);
  }
}
