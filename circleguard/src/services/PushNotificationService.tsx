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

// Configure system notification handler for native mobile pop-up banner presentation with Apple-like minimalism
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
 * Professional Security & Location Telemetry Notification Templates
 * Precise, restrained, and executive security product microcopy.
 */
export const CREATIVE_NOTIFICATION_TEMPLATES = {
  arrival: (name: string, placeName: string) => {
    const templates = [
      {
        title: `${name} arrived at ${placeName}`,
        body: `Location confirmed within designated geofence perimeter.`,
      },
      {
        title: `Geofence Entry: ${placeName}`,
        body: `${name} has checked into ${placeName}. Tap to view live telemetry.`,
      },
      {
        title: `Perimeter Check: ${name}`,
        body: `Safely arrived at ${placeName}. Status and battery level verified.`,
      },
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  },

  departure: (name: string, placeName: string, speedKmh?: number) => {
    const templates = [
      {
        title: `${name} departed ${placeName}`,
        body: speedKmh && speedKmh > 20
          ? `In transit at ${speedKmh} km/h. Tap to monitor live route.`
          : `Departed ${placeName}. Tap to monitor live location on map.`,
      },
      {
        title: `Geofence Exit: ${placeName}`,
        body: `${name} has left ${placeName}. Real-time tracking is active.`,
      },
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  },

  lowBattery: (name: string, batteryPct: number) => ({
    title: `Low Battery Advisory: ${name}`,
    body: `Device battery is at ${batteryPct}%. Advise connecting to a charger to maintain location telemetry.`,
  }),

  speeding: (name: string, speedKmh: number) => ({
    title: `Speed Advisory: ${name}`,
    body: `Speed telemetry recorded at ${speedKmh} km/h. Tap to review driving analytics.`,
  }),

  sos: (name: string) => ({
    title: `CRITICAL DISTRESS ALERT: ${name}`,
    body: `Emergency SOS triggered. Open immediately for real-time coordinates and emergency response.`,
  }),

  curiosityPing: (name: string) => ({
    title: `Location Update: ${name}`,
    body: `Active movement recorded. Tap to view current location and route.`,
  }),

  nightCheckIn: () => ({
    title: `Perimeter Security Check`,
    body: `All circle members accounted for. Tap to review status and battery telemetry.`,
  }),

  ghostMode: (name: string) => ({
    title: `Privacy Mode Active: ${name}`,
    body: `Location precision has been set to privacy mode by the user.`,
  }),
};

/**
 * Register device for system remote push notifications and save push_token to Supabase profile
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  const isExpoGo = 
    Constants.appOwnership === 'expo' || 
    (Constants as any).executionEnvironment === 'storeClient' ||
    Boolean((Constants as any).expoVersion);

  try {
    // 1. Android Notification Channel setup with Apple-Minimalist colors (#1C1C1E / #0D0E12)
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
        name: 'CircleGuard Member Radar',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1C1C1E', // Minimalist Apple-style dark monochrome
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

    if (isExpoGo) {
      console.log('[PushService] Remote push tokens skipped in Expo Go (Expo SDK 53+ requirement). Push works in preview/development builds.');
      return null;
    }

    // 3. Obtain Expo Push Token (wrapped safely against SDK 53 Expo Go limitations)
    try {
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
    } catch (pushErr: any) {
      console.log('[PushService] Remote push token note:', pushErr?.message);
      return null;
    }
  } catch (err) {
    console.warn('[PushService] Push registration note:', err);
    return null;
  }
}

/**
 * Send real-time System Remote Push Notification via Expo Push API
 */
/**
 * Send real-time System Remote Push Notification via Expo Push API
 * Supports raw Expo push tokens, user UUIDs, or an array of either.
 */
export async function sendExpoPushNotification(
  targetTokensOrUserIds: string | string[],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<boolean> {
  try {
    const inputs = Array.isArray(targetTokensOrUserIds) ? targetTokensOrUserIds : [targetTokensOrUserIds];
    const resolvedTokens: string[] = [];

    // Separate tokens from user IDs that need resolution
    const userIdsToLookup: string[] = [];
    inputs.forEach(item => {
      if (!item) return;
      if (item.startsWith('ExponentPushToken')) {
        resolvedTokens.push(item);
      } else {
        // Likely a user UUID
        userIdsToLookup.push(item);
      }
    });

    if (userIdsToLookup.length > 0) {
      try {
        const { data: profs } = await supabase
          .from('profiles')
          .select('push_token')
          .in('id', userIdsToLookup);

        if (profs) {
          profs.forEach(p => {
            if (p?.push_token && p.push_token.startsWith('ExponentPushToken')) {
              resolvedTokens.push(p.push_token);
            }
          });
        }
      } catch (err) {
        console.warn('[PushService] Failed looking up push tokens for user IDs:', err);
      }
    }

    if (resolvedTokens.length === 0) {
      console.log('[PushService] No valid push tokens found for push targets');
      return false;
    }

    const messages = resolvedTokens.map(token => ({
      to: token,
      sound: 'default',
      priority: 'high',
      channelId: data?.isEmergency ? 'emergency-distress-v2' : 'default',
      color: '#1C1C1E', // Apple Minimalist Dark Monochrome
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
 * Send push notification directly to a specific user by their User ID
 */
export async function sendPushNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<boolean> {
  return sendExpoPushNotification(userId, title, body, data);
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
 * Uses Apple-minimalist styling with custom funny emojis
 */
export async function scheduleLocalNotification(title: string, body: string, data: Record<string, any> = {}) {
  if (Platform.OS === 'web') return;
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    Vibration.vibrate([0, 200, 100, 200]);
    
    // Ensure Android Notification Channel is set to Apple Minimalist Dark Monochrome
    if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'CircleGuard Radar',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#1C1C1E',
        sound: 'default',
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: 'high',
        categoryIdentifier: 'radar',
        color: '#1C1C1E', // Minimalist Apple-like dark color
        data,
      },
      trigger: null, // Triggers native mobile top pop-up system banner immediately!
    });
  } catch (e) {
    console.warn('[PushService] Local system notification pop-up error:', e);
  }
}
