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
import { LuxuryAlertProvider, useLuxuryAlert } from '../components/LuxuryAlertModal';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';

function PrivacyPermissionListener() {
  const { profile } = useAuthStore();
  const { showPrivacyRequest, showAlert } = useLuxuryAlert();

  React.useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('public:circle_messages_privacy')
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

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

          const title = `${senderName} (Circle Chat)`;
          const body = content.length > 90 ? `${content.substring(0, 90)}...` : content;

          const { scheduleLocalNotification } = require('../services/PushNotificationService');
          scheduleLocalNotification(title, body);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, activeCircle?.id]);

  return null;
}

export default function AppNavigator() {
  const { session, profile, isLoading } = useAuthStore();
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    if (profile?.id) {
      registerForPushNotificationsAsync(profile.id);
    }
  }, [profile?.id]);

  if (isLoading || showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <LuxuryAlertProvider>
      <NavigationContainer>
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
            // Unauthenticated Flow
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="SignUp" component={SignUpScreen} />
            </>
          ) : !profile ? (
            // Profile Setup Flow
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          ) : (
            // Authenticated Flow
            <>
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
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
    </LuxuryAlertProvider>
  );
}
