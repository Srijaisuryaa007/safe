import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { supabase } from '../lib/supabase';

export const LOCATION_BACKGROUND_TASK = 'CIRCLEGUARD_BACKGROUND_LOCATION_TASK';

TaskManager.defineTask(LOCATION_BACKGROUND_TASK, async ({ data, error }) => {
  if (error || !data) {
    return;
  }
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const latest = locations[locations.length - 1];
  const { latitude, longitude, speed } = latest.coords;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    let batteryPct = 100;
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (level >= 0) batteryPct = Math.round(level * 100);
    } catch (e) {}

    const isDriving = (speed || 0) > 4.5;
    const point = `POINT(${longitude} ${latitude})`;

    await supabase.from('locations').upsert({
      user_id: userId,
      latitude,
      longitude,
      battery_pct: batteryPct,
      is_driving: isDriving,
      geom: point,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Background location update error:', err);
  }
});

export const startBatteryOptimizedBackgroundLocation = async (): Promise<boolean> => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') return false;

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('Background location permission optional/pending');
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_BACKGROUND_TASK);
    if (!isRegistered) {
      await Location.startLocationUpdatesAsync(LOCATION_BACKGROUND_TASK, {
        accuracy: Location.Accuracy.Balanced, // Low battery consumption mode
        distanceInterval: 15, // Only triggers GPS update if moved 15+ meters (saves 90% battery while stationary)
        timeInterval: 15000, // 15s interval
        deferredUpdatesDistance: 15,
        deferredUpdatesInterval: 15000,
        showsBackgroundLocationIndicator: false,
        pausesUpdatesAutomatically: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
      });
    }
    return true;
  } catch (err) {
    console.error('Error starting background location service:', err);
    return false;
  }
};

export const stopBackgroundLocation = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_BACKGROUND_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_BACKGROUND_TASK);
    }
  } catch (err) {
    console.error('Error stopping background location service:', err);
  }
};
