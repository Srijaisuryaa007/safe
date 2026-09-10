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

    let isMounted = true;

    // 1. Instantly hydrate cached session & profile from AsyncStorage for instant cold-boot readiness
    useAuthStore.getState().initAuth().then(async ({ cachedSession, cachedProfile }) => {
      if (!isMounted) return;

      if (cachedSession?.user) {
        useThemeStore.getState().initTheme(cachedSession.user.id).catch(() => {});
        // Silently sync latest profile in background
        fetchProfile(cachedSession.user.id);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.warn('[Auth] initAuth error:', err);
      if (isMounted) setLoading(false);
    });

    // 2. Fetch live session from Supabase (handles autoRefreshToken / AsyncStorage validation)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (session?.user) {
        setSession(session);
        useThemeStore.getState().initTheme(session.user.id).catch(() => {});
        fetchProfile(session.user.id);
      } else {
        // Mark loading false
        setLoading(false);
      }
    }).catch((err) => {
      console.warn('[Auth] getSession error:', err);
      if (isMounted) {
        setLoading(false);
      }
    });

    // 3. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          setSession(session);
          if (session.user) {
            useThemeStore.getState().initTheme(session.user.id).catch(() => {});
            fetchProfile(session.user.id);
          }
        }
      } else if (event === 'INITIAL_SESSION') {
        if (session) {
          setSession(session);
          if (session.user) {
            useThemeStore.getState().initTheme(session.user.id).catch(() => {});
            fetchProfile(session.user.id);
          }
        } else {
          setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        // ONLY reset state and tear down on explicit SIGNED_OUT
        stopBatteryOptimizedBackgroundLocation().catch(() => {});
        useAuthStore.getState().resetAuthStore();
        useCircleStore.getState().resetCircleStore();
        useThemeStore.getState().resetThemeToDefault();
      } else if (event === 'USER_UPDATED') {
        if (session) {
          setSession(session);
        }
      }
    });

    // Safety fallback timer to prevent infinite loading if everything stalls
    const authTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
        useAuthStore.getState().setProfileFetching(false);
      }
    }, 500);

    return () => {
      isMounted = false;
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
        // Auto-create profile for new users if not found in database
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user || useAuthStore.getState().user;
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

      if (data) {
        setProfile(data);
        useCircleStore.getState().fetchActiveCircle(userId).then((circle) => {
          if (circle) {
            startBatteryOptimizedBackgroundLocation();
          }
        }).catch(() => {});
        registerForPushNotificationsAsync(userId);
        RevenueCatService.initialize(userId);
      } else {
        // Network/DB returned empty or error:
        // DO NOT wipe existing cached profile!
        const existingProfile = useAuthStore.getState().profile;
        if (existingProfile) {
          useCircleStore.getState().fetchActiveCircle(userId).catch(() => {});
        }
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
