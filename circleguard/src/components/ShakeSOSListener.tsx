import React, { useEffect, useRef } from 'react';
import { Vibration, Platform } from 'react-native';
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
  const shakeHistoryRef = useRef<{ time: number; dir: number }[]>([]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let isMounted = true;

    const startListening = async () => {
      try {
        Accelerometer.setUpdateInterval(100); // 10 samples per second

        let lastDirection = 0;

        subscriptionRef.current = Accelerometer.addListener(({ x, y, z }) => {
          if (!isMounted) return;

          // Calculate magnitude G-force
          const gForce = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();

          // Purge events older than 1200ms
          shakeHistoryRef.current = shakeHistoryRef.current.filter((e) => now - e.time < 1200);

          // Human shake generates alternating positive/negative acceleration along a dominant axis
          // Identify primary axis direction
          const primaryAcc = Math.abs(x) > Math.abs(y) ? x : y;
          const currentDir = primaryAcc > 0 ? 1 : -1;

          if (gForce > 2.6) {
            // Check for directional reversal (human back-and-forth shake gesture)
            if (lastDirection !== 0 && currentDir !== lastDirection) {
              shakeHistoryRef.current.push({ time: now, dir: currentDir });
            }
            lastDirection = currentDir;

            // Require at least 3 distinct directional reversals within 1.2 seconds!
            // Single potholes, bumps, or cup holder rattling only produce 1 unidirectional impulse.
            if (shakeHistoryRef.current.length >= 3) {
              if (now - lastShakeTime.current > SHAKE_COOLDOWN_MS) {
                lastShakeTime.current = now;
                shakeHistoryRef.current = [];
                handleShakeDetected();
              }
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
