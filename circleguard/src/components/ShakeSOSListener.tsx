import React, { useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';

const SHAKE_KEY = '@circleguard_shake_sos';
const SHAKE_THRESHOLD = 2.4; // Acceleration G-force threshold
const SHAKE_COOLDOWN_MS = 5000; // Cooldown to prevent duplicate triggers

export default function ShakeSOSListener() {
  const { profile } = useAuthStore();
  const { activeCircle } = useCircleStore();
  const navigation = useNavigation<any>();
  const lastShakeTime = useRef<number>(0);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const startListening = async () => {
      try {
        Accelerometer.setUpdateInterval(100); // 10 samples per second

        subscriptionRef.current = Accelerometer.addListener(({ x, y, z }) => {
          if (!isMounted) return;

          // Calculate magnitude G-force
          const gForce = Math.sqrt(x * x + y * y + z * z);

          if (gForce > SHAKE_THRESHOLD) {
            const now = Date.now();
            if (now - lastShakeTime.current > SHAKE_COOLDOWN_MS) {
              lastShakeTime.current = now;
              handleShakeDetected();
            }
          }
        });
      } catch (e) {
        console.warn('[ShakeSOS] Accelerometer error:', e);
      }
    };

    startListening();

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [activeCircle?.id, profile?.id]);

  const handleShakeDetected = async () => {
    if (!profile?.id || !activeCircle?.id) return;

    // Default is OFF! Only activate if user explicitly enabled it ('true')
    const shakeVal = await AsyncStorage.getItem(SHAKE_KEY);
    if (shakeVal !== 'true') {
      console.log('[ShakeSOS] Shake gesture detected but Shake SOS is OFF by default.');
      return;
    }

    // 1. Immediate double vibration feedback
    Vibration.vibrate([0, 400, 100, 400]);

    try {
      // 2. Dispatch SOS Emergency alert to Supabase
      await supabase.from('sos_alerts').insert({
        user_id: profile.id,
        circle_id: activeCircle.id,
        status: 'active',
      });

      // 3. Immediately open Full-Screen SOS Emergency Screen on sender phone!
      navigation.navigate('SOSAlert');
    } catch (err) {
      console.error('[ShakeSOS] Error sending shake SOS:', err);
    }
  };

  return null;
}
