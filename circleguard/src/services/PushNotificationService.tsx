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
 * Engaging, Humorous & Apple-Minimalist Push Notification Templates
 * Designed to spark curiosity and encourage circle members to open the app and view live locations!
 */
export const CREATIVE_NOTIFICATION_TEMPLATES = {
  arrival: (name: string, placeName: string) => {
    const templates = [
      {
        title: `🎯 ${name} just landed at ${placeName}!`,
        body: `Wonder what they're up to? 👀 Tap to inspect their live spot on CircleGuard!`,
      },
      {
        title: `🍕 Radar Alert: ${name} @ ${placeName}`,
        body: `Are they grabbing snacks without you? 📍 Tap to check their live radar coordinates!`,
      },
      {
        title: `🚀 Touchdown: ${name} arrived at ${placeName}`,
        body: `Safe and sound inside the perimeter! 🗺️ Tap to view their live circle pin.`,
      },
      {
        title: `🏡 Look who just arrived: ${name}!`,
        body: `Checked into ${placeName}. 📍 Tap to see their battery & distance!`,
      },
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  },

  departure: (name: string, placeName: string, speedKmh?: number) => {
    const templates = [
      {
        title: `🏎️ Zoom! ${name} is on the move from ${placeName}`,
        body: speedKmh && speedKmh > 20
          ? `Cruising at ${speedKmh} km/h 💨 Where are they heading next? 🧭 Tap to track live route!`
          : `Just stepped outside ${placeName}! 💨 Tap to follow their live breadcrumb trail!`,
      },
      {
        title: `🕵️‍♂️ Stealth Exit: ${name} left ${placeName}`,
        body: `On a secret mission? 👀 Tap to see their live direction & GPS heading!`,
      },
      {
        title: `💨 ${name} just broke perimeter at ${placeName}`,
        body: `Catch them on the map before they get too far! 📍 Tap to open live radar.`,
      },
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  },

  lowBattery: (name: string, batteryPct: number) => ({
    title: `🪫 Code Red: ${name}'s phone is at ${batteryPct}%!`,
    body: `Their battery is on life support! ⚡ Remind them to charge before they vanish into the void 🔌`,
  }),

  speeding: (name: string, speedKmh: number) => ({
    title: `🚀 Fast & Furious: ${name} @ ${speedKmh} km/h!`,
    body: `Speeding alert! 🏎️💨 Tap to check their live telemetry, road route & driving score.`,
  }),

  sos: (name: string) => ({
    title: `🚨 CRITICAL DISTRESS: ${name} NEEDS HELP!`,
    body: `Emergency SOS triggered! ⚠️ Tap immediately for real-time GPS coordinates and hotline dispatch.`,
  }),

  curiosityPing: (name: string) => ({
    title: `👀 Psst... Where in the world is ${name}?`,
    body: `Someone's exploring the city right now 🗺️ Tap to reveal their real-time location radar!`,
  }),

  nightCheckIn: () => ({
    title: `🌙 Late Night Perimeter Sweep`,
    body: `Everyone accounted for? 🛡️ Tap to check your circle's midnight status & battery levels.`,
  }),

  ghostMode: (name: string) => ({
    title: `👻 Ninja Mode: ${name} vanished into thin air!`,
    body: `Ghost Mode activated 💨 Their GPS signal is now mysteriously obfuscated.`,
  }),
};

/**
 * Register device for system remote push notifications and save push_token to Supabase profile
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  const isExpoGo = Constants.appOwnership === 'expo' || (Constants as any).executionEnvironment === 'storeClient';

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
      console.log('[PushService] Remote push tokens skipped in Expo Go. Native mobile pop-up system notifications active.');
      return null;
    }

    // 3. Obtain Expo Push Token
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
