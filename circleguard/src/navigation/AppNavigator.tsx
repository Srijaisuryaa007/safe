import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';

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

import GlobalSOSModal from '../components/GlobalSOSModal';
import GlobalLocationShareModal from '../components/GlobalLocationShareModal';
import GlobalCircleSwitchLoader from '../components/GlobalCircleSwitchLoader';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleLocalNotification, sendPushNotificationToUser } from '../services/PushNotificationService';

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
  LocationHistory: undefined;
  DrivingReports: undefined;
  Chat: undefined;
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
                  '🎉 Privacy Request Approved!',
                  `Your Circle Leader approved your request to activate ${featureName}!`,
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
              title: '🎉 Ghost Mode Approved!',
              message: 'Your Circle Leader has approved your request. Ghost Mode is now activated and your location is hidden.',
              type: 'success',
            });

            scheduleLocalNotification(
              '🎉 Ghost Mode Approved!',
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
              title: '🎉 Privacy Request Approved!',
              message: 'Your Circle Leader has approved your request. Your online presence is now hidden.',
              type: 'success',
            });

            scheduleLocalNotification(
              '🎉 Privacy Request Approved!',
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

          let title = `💬 ${senderName}`;
          let body = content;

          if (newMsg.message_type === 'CHECKIN' || content.toLowerCase().includes('checked in safely')) {
            title = `✅ Safety Check-In: ${senderName}`;
            body = `${senderName} checked in safely! Status verified with circle.`;
          } else if (newMsg.message_type === 'CHECKIN_REQUEST' || content.toLowerCase().includes('requested an instant safety check-in')) {
            title = `📍 Check-In Request: ${senderName}`;
            body = `${senderName} is requesting everyone in ${activeCircle.name || 'the circle'} to check in!`;
          } else if (content.startsWith('📍 Shared Live Location')) {
            body = `📍 Dropped a live location pin on the map! Tap to view 👀`;
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

import { View, ActivityIndicator } from 'react-native';

export default function AppNavigator() {
  const { session, profile } = useAuthStore();
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    if (profile?.id) {
      registerForPushNotificationsAsync(profile.id);
    }
  }, [profile?.id]);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <BiometricLockGate>
      <NavigationContainer ref={(r) => { if (typeof window !== 'undefined') (window as any).__navigationRef = r; }}>
        <NetworkStatusBanner />
        <GlobalCircleSwitchLoader />
        {session && profile ? (
          <>
            <GlobalSOSModal />
            <GlobalLocationShareModal />
            <ShakeSOSListener />
            <PrivacyPermissionListener />
            <GlobalChatNotificationListener />
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
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </BiometricLockGate>
  );
}
