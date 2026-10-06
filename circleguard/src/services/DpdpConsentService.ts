import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export type ConsentType = 'background_location' | 'motion_telematics' | 'emergency_contacts' | 'data_retention';

export interface ConsentRecord {
  consentType: ConsentType;
  version: string;
  status: 'granted' | 'withdrawn' | 'refused';
  purposeDisclosure: string;
  grantedAt?: string;
  withdrawnAt?: string;
}

const CONSENT_CACHE_PREFIX = '@circleguard_dpdp_consent_';

class DpdpConsentService {
  /**
   * Record explicit legal consent compliant with DPDP Act 2023 & GDPR.
   * Logs timestamp, purpose specification, and consent version.
   */
  async grantConsent(
    consentType: ConsentType,
    purposeDisclosure: string,
    version: string = '1.0'
  ): Promise<boolean> {
    try {
      const user = useAuthStore.getState().user;
      const nowIso = new Date().toISOString();

      // Cache locally for instant offline authorization
      await AsyncStorage.setItem(
        `${CONSENT_CACHE_PREFIX}${consentType}`,
        JSON.stringify({ status: 'granted', version, grantedAt: nowIso })
      );

      if (user?.id) {
        await supabase.from('user_consents').insert({
          user_id: user.id,
          consent_type: consentType,
          version,
          status: 'granted',
          purpose_disclosure: purposeDisclosure,
          granted_at: nowIso,
        });
      }

      return true;
    } catch (e) {
      console.warn('[DpdpConsent] Failed to record consent:', e);
      return false;
    }
  }

  /**
   * Withdraw consent at any time as mandated by DPDP Act 2023.
   */
  async withdrawConsent(consentType: ConsentType): Promise<boolean> {
    try {
      const user = useAuthStore.getState().user;
      const nowIso = new Date().toISOString();

      await AsyncStorage.setItem(
        `${CONSENT_CACHE_PREFIX}${consentType}`,
        JSON.stringify({ status: 'withdrawn', withdrawnAt: nowIso })
      );

      if (user?.id) {
        await supabase
          .from('user_consents')
          .update({ status: 'withdrawn', withdrawn_at: nowIso })
          .eq('user_id', user.id)
          .eq('consent_type', consentType);
      }

      return true;
    } catch (e) {
      console.warn('[DpdpConsent] Failed to withdraw consent:', e);
      return false;
    }
  }

  /**
   * Check if user has active consent for a specific category.
   */
  async hasConsent(consentType: ConsentType): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(`${CONSENT_CACHE_PREFIX}${consentType}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.status === 'granted';
      }
    } catch (_) {}
    return false;
  }

  /**
   * Execute "Delete My Data" (Right to be Forgotten).
   * Permanently erases all location history, telematics, requests, and place events.
   */
  async executeRightToBeForgotten(): Promise<{ success: boolean; error?: string }> {
    try {
      const user = useAuthStore.getState().user;
      if (!user?.id) {
        return { success: false, error: 'User session not found' };
      }

      // Call database secure RPC
      const { data, error } = await supabase.rpc('delete_user_telemetry_data', {
        target_user_id: user.id,
      });

      if (error) throw error;

      // Clear local telemetry storage caches
      await AsyncStorage.removeItem('@circleguard_location_offline_queue_v1');
      await AsyncStorage.removeItem('@circleguard_active_session_cache');

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Data erasure failed' };
    }
  }

  /**
   * Granular Sharing: Pause location sharing for a specified duration or indefinitely.
   */
  async setPauseSharing(
    targetId: string,
    targetType: 'circle' | 'user',
    durationHours?: number
  ): Promise<boolean> {
    try {
      const user = useAuthStore.getState().user;
      if (!user?.id) return false;

      const pausedUntil = durationHours 
        ? new Date(Date.now() + durationHours * 3600000).toISOString()
        : null;

      const isEnabled = durationHours !== 0; // 0 = stopped indefinitely

      await supabase.from('location_sharing_permissions').upsert(
        {
          user_id: user.id,
          target_id: targetId,
          target_type: targetType,
          is_enabled: isEnabled,
          paused_until: pausedUntil,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,target_id,target_type' }
      );

      return true;
    } catch (e) {
      console.warn('[DpdpConsent] Failed to update sharing permission:', e);
      return false;
    }
  }

  /**
   * Granular Sharing: Resume location sharing.
   */
  async resumeSharing(targetId: string, targetType: 'circle' | 'user'): Promise<boolean> {
    try {
      const user = useAuthStore.getState().user;
      if (!user?.id) return false;

      await supabase.from('location_sharing_permissions').upsert(
        {
          user_id: user.id,
          target_id: targetId,
          target_type: targetType,
          is_enabled: true,
          paused_until: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,target_id,target_type' }
      );

      return true;
    } catch (e) {
      console.warn('[DpdpConsent] Failed to resume sharing:', e);
      return false;
    }
  }
}

export const dpdpConsentService = new DpdpConsentService();
