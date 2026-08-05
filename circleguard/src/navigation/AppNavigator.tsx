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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

import SplashScreen from '../screens/SplashScreen';

import { registerForPushNotificationsAsync } from '../services/PushNotificationService';

import ShakeSOSListener from '../components/ShakeSOSListener';

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
    <NavigationContainer>
      {session && profile ? (
        <>
          <GlobalSOSModal />
          <GlobalLocationShareModal />
          <ShakeSOSListener />
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
