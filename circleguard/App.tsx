import './global.css';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from './src/lib/supabase';
import { useAuthStore } from './src/store/useAuthStore';
import { useCircleStore } from './src/store/useCircleStore';
import AppNavigator from './src/navigation/AppNavigator';
import { startBatteryOptimizedBackgroundLocation } from './src/services/LocationBackgroundService';
import { registerForPushNotificationsAsync } from './src/services/PushNotificationService';
import { useThemeStore } from './src/store/useThemeStore';

import { LuxuryAlertProvider } from './src/components/LuxuryAlertModal';

function App() {
  const { setSession, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    // 0. Initialize visual theme
    useThemeStore.getState().initTheme();

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no row returned, which is fine if profile isn't setup yet
        console.error('Error fetching profile:', error);
      }

      setProfile(data || null);
      if (data) {
        useCircleStore.getState().fetchActiveCircle(userId);
        startBatteryOptimizedBackgroundLocation();
        registerForPushNotificationsAsync(userId);
      }
    } catch (err) {
      console.error('Fetch profile err:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <LuxuryAlertProvider>
        <AppNavigator />
      </LuxuryAlertProvider>
    </SafeAreaProvider>
  );
}

export default App;
