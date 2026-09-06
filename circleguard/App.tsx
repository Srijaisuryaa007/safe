import './global.css';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from './src/lib/supabase';
import { useAuthStore } from './src/store/useAuthStore';
import { useCircleStore } from './src/store/useCircleStore';
import AppNavigator from './src/navigation/AppNavigator';
import { startBatteryOptimizedBackgroundLocation, stopBatteryOptimizedBackgroundLocation } from './src/services/LocationBackgroundService';
import { registerForPushNotificationsAsync } from './src/services/PushNotificationService';
import { useThemeStore } from './src/store/useThemeStore';
import { useCountryStore } from './src/store/useCountryStore';
import { RevenueCatService } from './src/services/RevenueCatService';

import { LuxuryAlertProvider } from './src/components/LuxuryAlertModal';

function App() {
  const { setSession, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    // 0. Initialize visual theme & country regional preferences
    useThemeStore.getState().initTheme().catch(() => { });
    useCountryStore.getState().initCountry().catch(() => { });

    // Safety fallback timer to prevent infinite loading if Supabase connection lags
    const authTimeout = setTimeout(() => {
      setLoading(false);
    }, 2500);

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        useThemeStore.getState().initTheme(session.user.id).catch(() => {});
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        useThemeStore.getState().initTheme(session.user.id).catch(() => {});
        fetchProfile(session.user.id);
      } else {
        stopBatteryOptimizedBackgroundLocation().catch(() => {});
        useAuthStore.getState().resetAuthStore();
        useCircleStore.getState().resetCircleStore();
        useThemeStore.getState().resetThemeToDefault();
      }
    });

    return () => {
      clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      useAuthStore.getState().setProfileFetching(true);
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!data) {
        // Auto-create profile for new Google / OAuth users
        const session = useAuthStore.getState().session;
        const user = session?.user;
        if (user && user.id === userId) {
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Circle Member';
          const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

          const { data: createdProfile } = await supabase
            .from('profiles')
            .upsert([
              {
                id: userId,
                full_name: fullName,
                avatar_url: avatarUrl,
                phone: user.phone || null,
              }
            ])
            .select()
            .single();

          if (createdProfile) {
            data = createdProfile;
          }
        }
      }

      setProfile(data || null);
      if (data) {
        useCircleStore.getState().fetchActiveCircle(userId).then((circle) => {
          if (circle) {
            startBatteryOptimizedBackgroundLocation();
          }
        }).catch(() => {});
        registerForPushNotificationsAsync(userId);
        RevenueCatService.initialize(userId);
      } else {
        RevenueCatService.initialize();
      }
    } catch (err) {
      console.error('Fetch profile err:', err);
    } finally {
      useAuthStore.getState().setProfileFetching(false);
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
