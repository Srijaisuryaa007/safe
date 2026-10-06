import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';

export interface LocationPingResult {
  success: boolean;
  isLive: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  timestamp: string | null;
  label: string;
  error?: string;
}

/**
 * Service to manage server-triggered location requests (Ping Location)
 * with 30-second timeout, rate limiting, and instant Realtime resolution.
 */
class LocationRequestService {
  private activeSubscriptions: Map<string, any> = new Map();

  /**
   * Request real-time location from a circle member.
   * If member doesn't respond within 30 seconds, gracefully returns the last known location.
   */
  async requestMemberLocation(targetUserId: string, circleId?: string): Promise<LocationPingResult> {
    const callerUser = useAuthStore.getState().user;
    if (!callerUser) {
      return {
        success: false,
        isLive: false,
        latitude: null,
        longitude: null,
        timestamp: null,
        label: 'Authentication required',
        error: 'Not logged in',
      };
    }

    try {
      // 1. Invoke Supabase Edge Function to rate-limit, create location_request, and send high-priority push
      const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('request-location', {
        body: { targetUserId, circleId },
      });

      if (edgeErr || !edgeRes?.success) {
        const errorMsg = edgeRes?.error || edgeErr?.message || 'Failed to ping member device';
        
        // If rate limited or privacy paused, return meaningful feedback
        if (edgeRes?.lastKnownLocation) {
          const lk = edgeRes.lastKnownLocation;
          return {
            success: false,
            isLive: false,
            latitude: lk.latitude,
            longitude: lk.longitude,
            timestamp: lk.updatedAt,
            label: lk.label || 'Last known location',
            error: errorMsg,
          };
        }

        return {
          success: false,
          isLive: false,
          latitude: null,
          longitude: null,
          timestamp: null,
          label: 'Request failed',
          error: errorMsg,
        };
      }

      const { requestId, lastKnownLocation } = edgeRes;

      // 2. Wait for target device to wake up and fulfill within 30 seconds (Race Promise)
      return await new Promise<LocationPingResult>((resolve) => {
        let isResolved = false;

        const cleanup = () => {
          if (this.activeSubscriptions.has(requestId)) {
            const channel = this.activeSubscriptions.get(requestId);
            supabase.removeChannel(channel);
            this.activeSubscriptions.delete(requestId);
          }
        };

        // 30-second timeout timer
        const timeoutTimer = setTimeout(() => {
          if (isResolved) return;
          isResolved = true;
          cleanup();

          // Mark request as timed out in database
          supabase
            .from('location_requests')
            .update({ status: 'timed_out', failure_reason: 'Device response timed out after 30s' })
            .eq('id', requestId)
            .then(() => {}, () => {});

          // Gracefully return last known location with relative age
          resolve({
            success: true,
            isLive: false,
            latitude: lastKnownLocation?.latitude ?? null,
            longitude: lastKnownLocation?.longitude ?? null,
            timestamp: lastKnownLocation?.updatedAt ?? null,
            label: lastKnownLocation?.label || 'Last updated recently',
          });
        }, 30000);

        // Supabase Realtime listener on location_requests table for instant fulfillment (< 5s)
        const channel = supabase
          .channel(`ping_${requestId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'location_requests',
              filter: `id=eq.${requestId}`,
            },
            (payload: any) => {
              const updated = payload.new;
              if (updated && (updated.status === 'fulfilled' || updated.fulfilled_at)) {
                if (isResolved) return;
                isResolved = true;
                clearTimeout(timeoutTimer);
                cleanup();

                // Directly patch member marker in active circle store for 0ms rendering
                useCircleStore.getState().updateMemberLocationDirect({
                  user_id: targetUserId,
                  latitude: updated.fulfilled_latitude,
                  longitude: updated.fulfilled_longitude,
                  speed_mps: 0,
                  updated_at: updated.fulfilled_at,
                  accuracy: updated.fulfilled_accuracy,
                });

                resolve({
                  success: true,
                  isLive: true,
                  latitude: updated.fulfilled_latitude,
                  longitude: updated.fulfilled_longitude,
                  accuracy: updated.fulfilled_accuracy,
                  timestamp: updated.fulfilled_at,
                  label: 'Live GPS fix received now',
                });
              }
            }
          )
          .subscribe();

        this.activeSubscriptions.set(requestId, channel);
      });
    } catch (err: any) {
      return {
        success: false,
        isLive: false,
        latitude: null,
        longitude: null,
        timestamp: null,
        label: 'Ping failed',
        error: err.message,
      };
    }
  }

  /**
   * Executed on the TARGET device when silent FCM/APNs push arrives.
   * Wakes up the app, obtains fresh high-accuracy GPS fix, and uploads to database.
   */
  async handleIncomingLocationPing(data: { requestId: string; requesterId: string }) {
    if (!data?.requestId) return;

    try {
      console.log('[LocationPing] Processing incoming location request:', data.requestId);

      // Check foreground or background location permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        await supabase
          .from('location_requests')
          .update({ status: 'failed', failure_reason: 'Location permission denied by user' })
          .eq('id', data.requestId);
        return;
      }

      // Obtain fresh high-accuracy position fix
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude, accuracy, speed } = pos.coords;
      const nowIso = new Date().toISOString();
      const currentUserId = useAuthStore.getState().user?.id;

      // 1. Update public.locations table
      if (currentUserId) {
        await supabase.from('locations').upsert(
          {
            user_id: currentUserId,
            latitude,
            longitude,
            speed_mps: speed ?? 0,
            activity_state: 'Active',
            geom: `POINT(${longitude} ${latitude})`,
            updated_at: nowIso,
          },
          { onConflict: 'user_id' }
        );
      }

      // 2. Fulfill the specific location_requests record
      await supabase
        .from('location_requests')
        .update({
          status: 'fulfilled',
          fulfilled_at: nowIso,
          fulfilled_latitude: latitude,
          fulfilled_longitude: longitude,
          fulfilled_accuracy: accuracy,
        })
        .eq('id', data.requestId);

      console.log('[LocationPing] Successfully fulfilled location request:', data.requestId);
    } catch (err: any) {
      console.warn('[LocationPing] Failed to fulfill location request:', err);
      try {
        await supabase
          .from('location_requests')
          .update({ status: 'failed', failure_reason: err.message })
          .eq('id', data.requestId);
      } catch (_) {}
    }
  }
}

export const locationRequestService = new LocationRequestService();
