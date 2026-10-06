import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import MainTabNavigator from './MainTabNavigator';
import CreateCircleScreen from '../screens/CreateCircleScreen';
import JoinCircleScreen from '../screens/JoinCircleScreen';
import SOSAlertScreen from '../screens/SOSAlertScreen';
import SafePlacesScreen from '../screens/SafePlacesScreen';
import ActivityScreen from '../screens/ActivityScreen';
import LocationHistoryScreen from '../screens/LocationHistoryScreen';
import DrivingReportsScreen from '../screens/DrivingReportsScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';

import GlobalSOSModal from '../components/GlobalSOSModal';
import GlobalLocationShareModal from '../components/GlobalLocationShareModal';
import GlobalCircleSwitchLoader from '../components/GlobalCircleSwitchLoader';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import PasswordResetModal from '../components/PasswordResetModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleLocalNotification, sendPushNotificationToUser } from '../services/PushNotificationService';
import { addInAppGeofenceBreachListener } from '../services/GeofenceEngine';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ProfileSetup: undefined;
  MainTabs: undefined;
  CreateCircle: undefined;
  JoinCircle: undefined;
  SOSAlert: undefined;
  SafePlaces: undefined;
  Activity: undefined;
  LocationHistory: { member?: any; memberId?: string; circleId?: string } | undefined;
  DrivingReports: { member?: any; memberId?: string; circleId?: string } | undefined;
  Chat: {
    member?: any;
    memberId?: string;
    memberName?: string;
    taggedMember?: any;
    initialText?: string;
    filterMemberId?: string;
    onlyFilter?: boolean;
    circle_id?: string;
  } | undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

import SplashScreen from '../screens/SplashScreen';
import { registerForPushNotificationsAsync } from '../services/PushNotificationService';
import ShakeSOSListener from '../components/ShakeSOSListener';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';
import BiometricLockGate from '../components/BiometricLockGate';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';

function PrivacyPermissionListener() {
  const { profile } = useAuthStore();
  const { activeCircle } = useCircleStore();
  const { showPrivacyRequest, showAlert } = useLuxuryAlert();

  React.useEffect(() => {
    if (!profile?.id) return;

    // 1. Leader listener: incoming requests to approve or decline
    const msgChannel = supabase
      .channel(`public:circle_messages_privacy_${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'circle_messages' },
        async (payload) => {
          const content = payload.new?.content || '';
          if (content.startsWith('PERMISSION REQUEST:')) {
            const senderId = payload.new.sender_id;
            if (senderId === profile.id) return; // Don't show request to self

            const { data: senderProf } = await supabase.from('profiles').select('full_name').eq('id', senderId).single();
            const senderName = senderProf?.full_name || 'Circle Member';
            const featureName = content.replace('PERMISSION REQUEST: Requesting Circle Leader authorization to enable ', '').replace('.', '');

            showPrivacyRequest({
              requesterName: senderName,
              featureName: featureName,
              requesterId: senderId,
              circleId: payload.new.circle_id,
              onApprove: async () => {
                const featureLower = content.toLowerCase();
                let updateField: any = {};
                if (featureLower.includes('ghost')) updateField.is_ghost_mode = true;
                if (featureLower.includes('online')) updateField.hide_online_presence = true;

                await supabase.from('profiles').update(updateField).eq('id', senderId);

                await supabase.from('circle_messages').insert({
                  circle_id: payload.new.circle_id,
                  sender_id: profile.id,
                  content: `PERMISSION AUTHORIZED: Approved ${featureName} for ${senderName}.`,
                });

                // Dispatch push notification outside the app to requested member
                await sendPushNotificationToUser(
                  senderId,
                  'Privacy Request Approved',
                  `Your Circle Leader approved your request to activate ${featureName}.`,
                  { type: 'privacy_approved', feature: featureName }
                );

                showAlert({
                  title: 'PERMISSION AUTHORIZED',
                  message: `You authorized ${senderName}'s ${featureName} privacy request.`,
                  type: 'success',
                });
              },
              onDecline: async () => {
                await supabase.from('circle_messages').insert({
                  circle_id: payload.new.circle_id,
                  sender_id: profile.id,
                  content: `PERMISSION DECLINED: Circle Leader declined ${featureName} request for ${senderName}.`,
                });

                // Dispatch push notification to requested member
                await sendPushNotificationToUser(
                  senderId,
                  'Privacy Request Maintained',
                  `Circle Leader maintained 24/7 Safety Mode for ${featureName}.`,
                  { type: 'privacy_declined', feature: featureName }
                );

                showAlert({
                  title: 'REQUEST DECLINED',
                  message: `You declined ${senderName}'s request to maintain 24/7 Safety Mode.`,
                  type: 'info',
                });
              },
            });
          }
        }
      )
      .subscribe();

    // 2. Member listener: real-time in-app notification when Leader approves requests
    const profileChannel = supabase
      .channel(`public:profile_privacy_approved_${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
        async (payload) => {
          const newRec = payload.new as any;
          const oldRec = payload.old as any;

          // Check if Ghost Mode was approved and activated
          if (newRec?.is_ghost_mode && !oldRec?.is_ghost_mode) {
            await AsyncStorage.setItem('@circleguard_ghost_mode', 'true');
            useAuthStore.getState().setProfile({ ...useAuthStore.getState().profile!, is_ghost_mode: true });
            if (activeCircle?.id) {
              useCircleStore.getState().fetchMembers(activeCircle.id).catch(() => {});
            }

            showAlert({
              title: 'Ghost Mode Approved',
              message: 'Your Circle Leader has approved your request. Ghost Mode is now activated and your location is hidden.',
              type: 'success',
            });

            scheduleLocalNotification(
              'Ghost Mode Approved',
              'Circle Leader has approved your request to activate Ghost Mode.',
              { type: 'privacy_approved' }
            );
          }

          // Check if Hide Online Presence was approved and activated
          if (newRec?.hide_online_presence && !oldRec?.hide_online_presence) {
            await AsyncStorage.setItem('@circleguard_hide_online', 'true');
            useAuthStore.getState().setProfile({ ...useAuthStore.getState().profile!, hide_online_presence: true });
            if (activeCircle?.id) {
              useCircleStore.getState().fetchMembers(activeCircle.id).catch(() => {});
            }

            showAlert({
              title: 'Privacy Request Approved',
              message: 'Your Circle Leader has approved your request. Your online presence is now hidden.',
              type: 'success',
            });

            scheduleLocalNotification(
              'Privacy Request Approved',
              'Circle Leader has approved your request to hide online presence.',
              { type: 'privacy_approved' }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [profile?.id, activeCircle?.id]);

  return null;
}

function GlobalChatNotificationListener() {
  const { profile } = useAuthStore();
  const { activeCircle } = useCircleStore();

  React.useEffect(() => {
    if (!profile?.id || !activeCircle?.id) return;

    const channel = supabase
      .channel(`public:global_chat_notif_${activeCircle.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'circle_messages', filter: `circle_id=eq.${activeCircle.id}` },
        async (payload) => {
          const newMsg = payload.new;
          if (!newMsg || newMsg.sender_id === profile.id) return;

          const content = newMsg.content || '';
          if (content.startsWith('PERMISSION REQUEST:') || content.startsWith('PERMISSION AUTHORIZED:') || content.startsWith('PERMISSION DECLINED:')) {
            return;
          }

          const { data: senderProf } = await supabase.from('profiles').select('full_name').eq('id', newMsg.sender_id).single();
          const senderName = senderProf?.full_name || 'Circle Member';

          let title = senderName;
          let body = content;

          if (newMsg.message_type === 'CHECKIN' || content.toLowerCase().includes('checked in safely')) {
            title = `Safety Check-In: ${senderName}`;
            body = `${senderName} checked in safely. Status verified with circle.`;
          } else if (newMsg.message_type === 'CHECKIN_REQUEST' || content.toLowerCase().includes('requested an instant safety check-in')) {
            title = `Check-In Request: ${senderName}`;
            body = `${senderName} is requesting everyone in ${activeCircle.name || 'the circle'} to check in.`;
          } else if (content.startsWith('📍 Shared Live Location') || content.includes('Shared Live Location')) {
            title = `Location Shared: ${senderName}`;
            body = `${senderName} shared their live location on the map. Tap to view.`;
          } else if (content.length > 90) {
            body = `${content.substring(0, 90)}...`;
          }

          scheduleLocalNotification(title, body, { screen: newMsg.message_type === 'CHECKIN' ? 'Timeline' : 'Chat' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, activeCircle?.id]);

  return null;
}

function GlobalGeofenceNotificationListener() {
  const { showToast } = useLuxuryAlert();
  const { activeCircle } = useCircleStore();
  const { profile } = useAuthStore();

  // 1. In-app breach listener (for local engine evaluations)
  React.useEffect(() => {
    const unsubscribe = addInAppGeofenceBreachListener((breach) => {
      // If MapScreen is active, MapScreen displays its own rich interactive breach modal
      if (typeof window !== 'undefined' && (window as any).__isMapScreenActive) {
        return;
      }
      const isExit = breach.type === 'exit';
      showToast(
        isExit
          ? `🚶 ${breach.userName} departed ${breach.placeName}`
          : `📍 ${breach.userName} arrived at ${breach.placeName}`,
        isExit ? 'warning' : 'success'
      );
    });

    return unsubscribe;
  }, [showToast]);

  // 2. Realtime subscription to `place_events` across all circle members
  React.useEffect(() => {
    if (!activeCircle?.id) return;

    const handledEvents = new Set<string>();
    const channelUid = Math.random().toString(36).substring(2, 8);

    const channel = supabase
      .channel(`global_geofence_rt_${activeCircle.id}_${channelUid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'zone_events', filter: `circle_id=eq.${activeCircle.id}` },
        async (payload: any) => {
          const newEv = payload?.new;
          if (!newEv || !newEv.id) return;
          const evId = String(newEv.id);
          if (handledEvents.has(evId)) return;
          handledEvents.add(evId);

          const currentMembers = useCircleStore.getState().members || [];
          const currentPlaces = useCircleStore.getState().places || [];

          const member = currentMembers.find((m) => m.user_id === newEv.member_id);
          let memberName = member?.profile?.full_name;
          if (!memberName) {
            try {
              const { data: pData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', newEv.member_id)
                .single();
              memberName = pData?.full_name || 'Circle Member';
            } catch (_) {
              memberName = 'Circle Member';
            }
          }

          const place = currentPlaces.find((p) => p.id === newEv.zone_id);
          let placeName = place?.name || 'Safe Zone';

          const eventDate = newEv.occurred_at ? new Date(newEv.occurred_at) : new Date();
          const isLiveNow = !isNaN(eventDate.getTime()) && Math.abs(Date.now() - eventDate.getTime()) < 180000;
          const shortTimeStr = !isNaN(eventDate.getTime())
            ? eventDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
            : 'Just now';

          const isExit = newEv.type === 'EXIT';
          const isSelf = profile?.id === newEv.member_id;

          const title = isExit
            ? (isSelf ? `You left ${placeName} • ${shortTimeStr}` : `${memberName} left ${placeName} • ${shortTimeStr}`)
            : (isSelf ? `You arrived at ${placeName} • ${shortTimeStr}` : `${memberName} arrived at ${placeName} • ${shortTimeStr}`);

          // Refresh circle members in store
          useCircleStore.getState().fetchMembers(activeCircle.id);

          if (isLiveNow) {
            showToast(
              isExit ? `🚶 ${title}` : `📍 ${title}`,
              isExit ? 'warning' : 'success'
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'place_events' },
        async (payload: any) => {
          const newEv = payload?.new;
          if (!newEv || !newEv.id) return;
          const evId = String(newEv.id);
          if (handledEvents.has(evId)) return;
          handledEvents.add(evId);

          const currentMembers = useCircleStore.getState().members || [];
          const currentPlaces = useCircleStore.getState().places || [];

          const isMember = currentMembers.some((m) => m.user_id === newEv.user_id);
          const isPlace = currentPlaces.some((p) => p.id === newEv.place_id);

          // If event does not belong to active circle, ignore
          if (!isMember && !isPlace) return;

          const member = currentMembers.find((m) => m.user_id === newEv.user_id);
          let memberName = member?.profile?.full_name;
          if (!memberName) {
            try {
              const { data: pData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', newEv.user_id)
                .single();
              memberName = pData?.full_name || 'Circle Member';
            } catch (_) {
              memberName = 'Circle Member';
            }
          }

          const place = currentPlaces.find((p) => p.id === newEv.place_id);
          let placeName = place?.name;
          if (!placeName) {
            try {
              const { data: plData } = await supabase
                .from('places')
                .select('name')
                .eq('id', newEv.place_id)
                .single();
              placeName = plData?.name || 'Safe Zone';
            } catch (_) {
              placeName = 'Safe Zone';
            }
          }

          const eventDate = newEv.occurred_at ? new Date(newEv.occurred_at) : new Date();
          const isLiveNow = !isNaN(eventDate.getTime()) && Math.abs(Date.now() - eventDate.getTime()) < 180000;
          const preciseTimeStr = !isNaN(eventDate.getTime())
            ? eventDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
            : 'Just now';
          const shortTimeStr = !isNaN(eventDate.getTime())
            ? eventDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
            : 'Just now';

          const isExit = newEv.event_type === 'departure';
          const isSelf = profile?.id === newEv.user_id;

          const title = isExit
            ? (isSelf ? `You left ${placeName} • ${shortTimeStr}` : `${memberName} left ${placeName} • ${shortTimeStr}`)
            : (isSelf ? `You arrived at ${placeName} • ${shortTimeStr}` : `${memberName} arrived at ${placeName} • ${shortTimeStr}`);

          const body = isExit
            ? `${isSelf ? 'You departed' : `${memberName} departed`} ${placeName} safe boundary at ${preciseTimeStr}. Tap to view activity.`
            : `${isSelf ? 'You safely entered' : `${memberName} safely entered`} ${placeName} at ${preciseTimeStr}.`;

          // A. Native OS Notification Banner with sound and vibration (only for live events)
          if (isLiveNow) {
            try {
              const notifEnabled = await AsyncStorage.getItem('@circleguard_notif_geofence');
              if (notifEnabled !== 'false') {
                await scheduleLocalNotification(title, body, {
                  screen: 'Activity',
                  type: 'GEOFENCE',
                  eventType: newEv.event_type,
                  placeId: newEv.place_id,
                  userId: newEv.user_id,
                  preciseTime: preciseTimeStr,
                });
              }
            } catch (e) {
              console.warn('[GlobalGeofence] scheduleLocalNotification note:', e);
            }

            // B. Show in-app toast banner (only for live events)
            showToast(
              isExit ? `🚶 ${title}` : `📍 ${title}`,
              isExit ? 'warning' : 'success'
            );
          }

          // C. Notify in-app breach listeners (for Map animations)
          try {
            const { notifyInAppGeofenceBreach } = require('../services/GeofenceEngine');
            notifyInAppGeofenceBreach({
              id: evId,
              type: isExit ? 'exit' : 'entry',
              placeId: newEv.place_id,
              placeName,
              userId: newEv.user_id,
              userName: memberName,
              distanceMeters: place?.radius_m || 150,
              formattedDistance: `${place?.radius_m || 150}m`,
              timestamp: newEv.occurred_at || new Date().toISOString(),
              latitude: place?.latitude || 0,
              longitude: place?.longitude || 0,
            });
          } catch (_) {}

          // D. Cache in local storage for instant Activity timeline rendering
          try {
            const { saveLocalActivityEvent } = require('../services/ActivityService');
            saveLocalActivityEvent(activeCircle.id, {
              id: evId,
              type: 'GEOFENCE',
              eventType: isExit ? 'departure' : 'arrival',
              title,
              message: body,
              time: shortTimeStr,
              preciseTime: preciseTimeStr,
              icon: isExit ? 'walk-outline' : 'location',
              color: isExit ? '#F59E0B' : '#2E7D5B',
              memberName,
              avatarUrl: member?.profile?.avatar_url,
              phone: member?.profile?.phone,
              userId: newEv.user_id,
              timestamp: new Date(newEv.occurred_at || Date.now()).getTime(),
              placeName,
              placeId: newEv.place_id,
              radiusMeters: place?.radius_m || 150,
              occurredAtIso: newEv.occurred_at || new Date().toISOString(),
              latitude: place?.latitude,
              longitude: place?.longitude,
              batteryPct: member?.batteryPct,
            });
          } catch (_) {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCircle?.id, profile?.id, showToast]);

  return null;
}

import { View, ActivityIndicator } from 'react-native';

export default function AppNavigator() {
  const { session, profile, isPasswordRecovery, setPasswordRecovery } = useAuthStore();
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    if (profile?.id) {
      registerForPushNotificationsAsync(profile.id);
    }
  }, [profile?.id]);

  // Handle OS Notification taps to route directly into target screens (Activity / Timeline)
  React.useEffect(() => {
    let subscription: any;
    try {
      const Notifications = require('expo-notifications');
      if (Notifications && Notifications.addNotificationResponseReceivedListener) {
        subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
          const data = response?.notification?.request?.content?.data;
          const targetScreen =
            data?.screen ||
            (data?.type === 'zone_exit' || data?.type === 'zone_enter' || data?.type === 'GEOFENCE'
              ? 'Activity'
              : undefined);
          if (targetScreen) {
            try {
              if (navigationRef.isReady()) {
                (navigationRef as any).navigate(targetScreen, data);
              }
            } catch (err) {
              console.warn('[NotificationTap] Navigation error:', err);
            }
          }
        });
      }
    } catch (_) {}

    return () => {
      subscription?.remove?.();
    };
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <BiometricLockGate>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          if (typeof window !== 'undefined') {
            (window as any).__navigationRef = navigationRef.isReady() ? navigationRef : null;
          }
        }}
      >
        <NetworkStatusBanner />
        <GlobalCircleSwitchLoader />
        <PasswordResetModal
          visible={isPasswordRecovery}
          isRecoverySessionActive={true}
          onClose={() => setPasswordRecovery(false)}
          onSuccess={() => setPasswordRecovery(false)}
        />
        {session && profile ? (
          <>
            <GlobalSOSModal />
            <GlobalLocationShareModal />
            <ShakeSOSListener />
            <PrivacyPermissionListener />
            <GlobalChatNotificationListener />
            <GlobalGeofenceNotificationListener />
          </>
        ) : null}
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!session ? (
            // Unauthenticated Flow (Direct to Login/SignUp)
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="SignUp" component={SignUpScreen} />
            </>
          ) : (
            // Authenticated Flow (Direct to MainTabs flagship experience)
            <>
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
              <Stack.Screen name="CreateCircle" component={CreateCircleScreen} />
              <Stack.Screen name="JoinCircle" component={JoinCircleScreen} />
              <Stack.Screen 
                name="SOSAlert" 
                component={SOSAlertScreen} 
                options={{ presentation: 'fullScreenModal', animation: 'fade' }}
              />
              <Stack.Screen name="SafePlaces" component={SafePlacesScreen} />
              <Stack.Screen name="Activity" component={ActivityScreen} />
              <Stack.Screen name="LocationHistory" component={LocationHistoryScreen} />
              <Stack.Screen name="DrivingReports" component={DrivingReportsScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen 
                name="Profile" 
                component={ProfileScreen} 
                options={{ animation: 'slide_from_right' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </BiometricLockGate>
  );
}
