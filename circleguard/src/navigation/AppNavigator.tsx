import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';

// Screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CreateCircleScreen from '../screens/CreateCircleScreen';
import JoinCircleScreen from '../screens/JoinCircleScreen';

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ProfileSetup: undefined;
  Dashboard: undefined;
  CreateCircle: undefined;
  JoinCircle: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { session, profile, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer>
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
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="CreateCircle" component={CreateCircleScreen} />
            <Stack.Screen name="JoinCircle" component={JoinCircleScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
