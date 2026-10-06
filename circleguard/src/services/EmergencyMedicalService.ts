import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore, MedicalInfo, EmergencyContactItem } from '../store/useAuthStore';

// User-scoped storage keys
export const getMedicalStorageKey = (userId: string) => `@circleguard_medical_info_${userId}`;
export const getContactsStorageKey = (userId: string) => `@circleguard_emergency_contacts_${userId}`;
export const getPrimaryContactStorageKey = (userId: string) => `@circleguard_primary_contact_${userId}`;
export const getMedicalQueueKey = (userId: string) => `@circleguard_pending_medical_${userId}`;
export const getContactsQueueKey = (userId: string) => `@circleguard_pending_contacts_${userId}`;

export interface SaveResult<T> {
  success: boolean;
  data?: T;
  pendingSync?: boolean;
  error?: string;
}

export const EmergencyMedicalService = {
  /**
   * Fetch medical info from Supabase with read-only AsyncStorage fallback
   */
  async fetchMedicalInfo(userId: string): Promise<{ data: MedicalInfo | null; fromCache: boolean; pendingSync?: boolean; error?: string }> {
    if (!userId) return { data: null, fromCache: false };

    try {
      const { data, error } = await supabase
        .from('medical_info')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[EmergencyMedicalService] fetchMedicalInfo db warning:', error.message);
        throw error;
      }

      if (data) {
        // Fresh Supabase data replaces the cache
        await AsyncStorage.setItem(getMedicalStorageKey(userId), JSON.stringify(data));
        
        // Check if there is an un-synced pending update in queue
        const pendingQueue = await AsyncStorage.getItem(getMedicalQueueKey(userId));
        const hasPending = Boolean(pendingQueue);

        // Update auth store field
        useAuthStore.getState().updateProfileFields({ medical_info: data });
        return { data, fromCache: false, pendingSync: hasPending };
      }

      // No record in DB: try local cache (read-only)
      const cached = await AsyncStorage.getItem(getMedicalStorageKey(userId));
      if (cached) {
        const parsed = JSON.parse(cached);
        return { data: parsed, fromCache: true };
      }

      return { data: null, fromCache: false };
    } catch (err: any) {
      // Offline fallback: read from user-isolated cache only
      try {
        const cached = await AsyncStorage.getItem(getMedicalStorageKey(userId));
        if (cached) {
          const parsed = JSON.parse(cached);
          const pendingQueue = await AsyncStorage.getItem(getMedicalQueueKey(userId));
          return { data: parsed, fromCache: true, pendingSync: Boolean(pendingQueue) };
        }
      } catch (_) {}

      return { data: null, fromCache: false, error: err?.message || 'Failed to fetch medical profile' };
    }
  },

  /**
   * Save medical info to Supabase safely via explicit upsert with onConflict: 'user_id'
   */
  async saveMedicalInfo(userId: string, data: Partial<MedicalInfo>): Promise<SaveResult<MedicalInfo>> {
    if (!userId) return { success: false, error: 'User ID is required' };

    const payload: MedicalInfo = {
      user_id: userId,
      blood_type: data.blood_type || 'O+',
      allergies: (data.allergies ?? '').trim(),
      conditions: (data.conditions ?? '').trim(),
      medications: (data.medications ?? '').trim(),
      notes: (data.notes ?? '').trim(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: returnedRow, error } = await supabase
        .from('medical_info')
        .upsert(payload, { onConflict: 'user_id' })
        .select('*')
        .single();

      if (error) {
        console.warn('[EmergencyMedicalService] saveMedicalInfo error:', error.message);
        throw error;
      }

      if (!returnedRow) {
        throw new Error('Supabase did not return updated medical info row.');
      }

      // Success: write to cache and clear any pending offline queue
      await AsyncStorage.setItem(getMedicalStorageKey(userId), JSON.stringify(returnedRow));
      await AsyncStorage.removeItem(getMedicalQueueKey(userId));

      // Update store state field-by-field
      useAuthStore.getState().updateProfileFields({ medical_info: returnedRow });

      return { success: true, data: returnedRow };
    } catch (err: any) {
      // Offline / Network Failure: Queue in AsyncStorage for background retry
      console.warn('[EmergencyMedicalService] Network save failed; caching in offline queue:', err);
      try {
        await AsyncStorage.setItem(getMedicalStorageKey(userId), JSON.stringify(payload));
        await AsyncStorage.setItem(getMedicalQueueKey(userId), JSON.stringify(payload));
        useAuthStore.getState().updateProfileFields({ medical_info: payload });
        return { success: false, pendingSync: true, data: payload, error: err?.message || 'Saved offline. Pending sync.' };
      } catch (cacheErr: any) {
        return { success: false, error: 'Failed to save medical info offline.' };
      }
    }
  },

  /**
   * Fetch emergency contacts from Supabase with user-scoped cache fallback
   */
  async fetchEmergencyContacts(userId: string): Promise<{ data: EmergencyContactItem[]; fromCache: boolean; pendingSync?: boolean; error?: string }> {
    if (!userId) return { data: [], fromCache: false };

    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('[EmergencyMedicalService] fetchEmergencyContacts db warning:', error.message);
        throw error;
      }

      if (Array.isArray(data)) {
        await AsyncStorage.setItem(getContactsStorageKey(userId), JSON.stringify(data));
        if (data.length > 0) {
          await AsyncStorage.setItem(getPrimaryContactStorageKey(userId), JSON.stringify(data[0]));
        }

        const pendingQueue = await AsyncStorage.getItem(getContactsQueueKey(userId));
        const hasPending = Boolean(pendingQueue);

        useAuthStore.getState().updateProfileFields({ emergency_contacts: data });
        return { data, fromCache: false, pendingSync: hasPending };
      }

      return { data: [], fromCache: false };
    } catch (err: any) {
      // Offline fallback: read-only from user-scoped storage
      try {
        const cached = await AsyncStorage.getItem(getContactsStorageKey(userId));
        if (cached) {
          const parsed = JSON.parse(cached);
          const pendingQueue = await AsyncStorage.getItem(getContactsQueueKey(userId));
          return { data: Array.isArray(parsed) ? parsed : [], fromCache: true, pendingSync: Boolean(pendingQueue) };
        }
      } catch (_) {}

      return { data: [], fromCache: false, error: err?.message || 'Failed to fetch contacts' };
    }
  },

  /**
   * Insert a new emergency contact
   */
  async addEmergencyContact(
    userId: string,
    contact: { name: string; phone: string; relationship: string; sort_order?: number }
  ): Promise<SaveResult<EmergencyContactItem>> {
    if (!userId) return { success: false, error: 'User ID is required' };
    if (!contact.name.trim() || !contact.phone.trim()) {
      return { success: false, error: 'Contact name and phone number are required.' };
    }

    const payload = {
      user_id: userId,
      name: contact.name.trim(),
      phone: contact.phone.trim(),
      relationship: contact.relationship.trim() || 'Guardian',
      sort_order: contact.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: newRow, error } = await supabase
        .from('emergency_contacts')
        .insert([payload])
        .select('*')
        .single();

      if (error) throw error;
      if (!newRow) throw new Error('Supabase did not return inserted emergency contact.');

      // Update local cache and zustand store
      const current = useAuthStore.getState().profile?.emergency_contacts || [];
      const updated = [...current, newRow];
      await AsyncStorage.setItem(getContactsStorageKey(userId), JSON.stringify(updated));
      useAuthStore.getState().updateProfileFields({ emergency_contacts: updated });

      return { success: true, data: newRow };
    } catch (err: any) {
      console.warn('[EmergencyMedicalService] Add contact network failure; queuing offline:', err);
      // Queue offline
      const tempId = `temp_${Date.now()}`;
      const tempRow: EmergencyContactItem = { id: tempId, ...payload };
      try {
        const current = useAuthStore.getState().profile?.emergency_contacts || [];
        const updated = [...current, tempRow];
        await AsyncStorage.setItem(getContactsStorageKey(userId), JSON.stringify(updated));
        await this._queueContactAction(userId, { type: 'ADD', contact: payload, tempId });
        useAuthStore.getState().updateProfileFields({ emergency_contacts: updated });
        return { success: false, pendingSync: true, data: tempRow, error: 'Saved offline. Pending sync.' };
      } catch (cacheErr) {
        return { success: false, error: 'Failed to add emergency contact.' };
      }
    }
  },

  /**
   * Update an existing emergency contact
   */
  async updateEmergencyContact(
    userId: string,
    contactId: string,
    updates: Partial<{ name: string; phone: string; relationship: string; sort_order: number }>
  ): Promise<SaveResult<EmergencyContactItem>> {
    if (!userId || !contactId) return { success: false, error: 'User ID and Contact ID required' };

    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: updatedRow, error } = await supabase
        .from('emergency_contacts')
        .update(payload)
        .eq('id', contactId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) throw error;
      if (!updatedRow) throw new Error('Contact update failed or row not found.');

      // Update cache & store
      const current = useAuthStore.getState().profile?.emergency_contacts || [];
      const updatedList = current.map((c) => (c.id === contactId ? updatedRow : c));
      await AsyncStorage.setItem(getContactsStorageKey(userId), JSON.stringify(updatedList));
      useAuthStore.getState().updateProfileFields({ emergency_contacts: updatedList });

      return { success: true, data: updatedRow };
    } catch (err: any) {
      console.warn('[EmergencyMedicalService] Update contact network error:', err);
      return { success: false, error: err?.message || 'Failed to update contact' };
    }
  },

  /**
   * Delete an emergency contact
   */
  async deleteEmergencyContact(userId: string, contactId: string): Promise<SaveResult<boolean>> {
    if (!userId || !contactId) return { success: false, error: 'User ID and Contact ID required' };

    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', contactId)
        .eq('user_id', userId);

      if (error) throw error;

      // Update cache & store
      const current = useAuthStore.getState().profile?.emergency_contacts || [];
      const updatedList = current.filter((c) => c.id !== contactId);
      await AsyncStorage.setItem(getContactsStorageKey(userId), JSON.stringify(updatedList));
      useAuthStore.getState().updateProfileFields({ emergency_contacts: updatedList });

      return { success: true, data: true };
    } catch (err: any) {
      console.warn('[EmergencyMedicalService] Delete contact network error:', err);
      // Still remove locally to keep UI responsive
      const current = useAuthStore.getState().profile?.emergency_contacts || [];
      const updatedList = current.filter((c) => c.id !== contactId);
      await AsyncStorage.setItem(getContactsStorageKey(userId), JSON.stringify(updatedList));
      useAuthStore.getState().updateProfileFields({ emergency_contacts: updatedList });
      await this._queueContactAction(userId, { type: 'DELETE', contactId });

      return { success: false, pendingSync: true, data: true, error: 'Removed offline. Pending sync.' };
    }
  },

  /**
   * Internal helper to queue actions for offline retry
   */
  async _queueContactAction(userId: string, action: any) {
    try {
      const key = getContactsQueueKey(userId);
      const existing = await AsyncStorage.getItem(key);
      const queue = existing ? JSON.parse(existing) : [];
      queue.push(action);
      await AsyncStorage.setItem(key, JSON.stringify(queue));
    } catch (_) {}
  },

  /**
   * Process offline queue when network becomes available
   */
  async syncPendingQueues(userId: string): Promise<void> {
    if (!userId) return;

    // 1. Sync pending medical info
    try {
      const pendingMedical = await AsyncStorage.getItem(getMedicalQueueKey(userId));
      if (pendingMedical) {
        const payload: MedicalInfo = JSON.parse(pendingMedical);
        const { error } = await supabase
          .from('medical_info')
          .upsert(payload, { onConflict: 'user_id' });

        if (!error) {
          await AsyncStorage.removeItem(getMedicalQueueKey(userId));
        }
      }
    } catch (err) {
      console.warn('[EmergencyMedicalService] syncPendingMedical error:', err);
    }

    // 2. Sync pending emergency contacts
    try {
      const pendingContacts = await AsyncStorage.getItem(getContactsQueueKey(userId));
      if (pendingContacts) {
        const queue: any[] = JSON.parse(pendingContacts);
        const remaining: any[] = [];

        for (const item of queue) {
          try {
            if (item.type === 'ADD') {
              const { error } = await supabase
                .from('emergency_contacts')
                .insert([item.contact]);
              if (error) remaining.push(item);
            } else if (item.type === 'DELETE') {
              const { error } = await supabase
                .from('emergency_contacts')
                .delete()
                .eq('id', item.contactId)
                .eq('user_id', userId);
              if (error) remaining.push(item);
            }
          } catch (_) {
            remaining.push(item);
          }
        }

        if (remaining.length === 0) {
          await AsyncStorage.removeItem(getContactsQueueKey(userId));
          // Refresh list from remote
          await this.fetchEmergencyContacts(userId);
        } else {
          await AsyncStorage.setItem(getContactsQueueKey(userId), JSON.stringify(remaining));
        }
      }
    } catch (err) {
      console.warn('[EmergencyMedicalService] syncPendingContacts error:', err);
    }
  },

  /**
   * Clean up user cache on logout (avoids cross-user leaks)
   */
  async clearUserCache(userId: string) {
    if (!userId) return;
    try {
      await AsyncStorage.multiRemove([
        getMedicalStorageKey(userId),
        getContactsStorageKey(userId),
        getPrimaryContactStorageKey(userId),
        getMedicalQueueKey(userId),
        getContactsQueueKey(userId),
        // Legacy keys
        '@circleguard_emergency_contacts',
        '@circleguard_primary_emergency_contact',
        '@circleguard_medical_info_active',
        '@circleguard_medical_info_guest',
      ]);
    } catch (_) {}
  }
};
