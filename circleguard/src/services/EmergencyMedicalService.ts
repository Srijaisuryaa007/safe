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

export function generateContactUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const EmergencyMedicalService = {
  /**
   * Fetch medical info from Supabase with multi-tier fallback:
   * 1. Relational medical_info table
   * 2. profiles.medical_info JSONB column
   * 3. Local AsyncStorage cache
   */
  async fetchMedicalInfo(userId: string): Promise<{ data: MedicalInfo | null; fromCache: boolean; pendingSync?: boolean; error?: string }> {
    const resolvedUserId = userId || useAuthStore.getState().profile?.id || useAuthStore.getState().user?.id || useAuthStore.getState().session?.user?.id;
    if (!resolvedUserId) return { data: null, fromCache: false };

    const isMeaningful = (m: any) =>
      m && typeof m === 'object' && (
        Boolean(m.blood_type && m.blood_type !== 'O+') ||
        Boolean(m.allergies && String(m.allergies).trim()) ||
        Boolean(m.conditions && String(m.conditions).trim()) ||
        Boolean(m.medications && String(m.medications).trim()) ||
        Boolean(m.notes && String(m.notes).trim())
      );

    let resolvedData: MedicalInfo | null = null;
    let hasFetchedRemote = false;

    // 1. Try relational medical_info table
    try {
      const { data, error } = await supabase
        .from('medical_info')
        .select('*')
        .eq('user_id', resolvedUserId)
        .maybeSingle();

      if (!error && data) {
        resolvedData = data;
        hasFetchedRemote = true;
      }
    } catch (_) {}

    // 2. Fallback to profiles.medical_info JSONB column
    if (!resolvedData || !isMeaningful(resolvedData)) {
      try {
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('medical_info')
          .eq('id', resolvedUserId)
          .maybeSingle();

        if (!error && prof?.medical_info && isMeaningful(prof.medical_info)) {
          resolvedData = {
            user_id: resolvedUserId,
            blood_type: prof.medical_info.blood_type || 'O+',
            allergies: prof.medical_info.allergies || '',
            conditions: prof.medical_info.conditions || '',
            medications: prof.medical_info.medications || '',
            notes: prof.medical_info.notes || '',
            updated_at: prof.medical_info.updated_at || new Date().toISOString(),
          };
          hasFetchedRemote = true;
        }
      } catch (_) {}
    }

    // 3. If fetched from server, update local storage cache & zustand store
    if (resolvedData) {
      try {
        await AsyncStorage.setItem(getMedicalStorageKey(resolvedUserId), JSON.stringify(resolvedData));
        const pendingQueue = await AsyncStorage.getItem(getMedicalQueueKey(resolvedUserId));
        useAuthStore.getState().updateProfileFields({ medical_info: resolvedData });
        return { data: resolvedData, fromCache: !hasFetchedRemote, pendingSync: Boolean(pendingQueue) };
      } catch (_) {}
    }

    // 4. Fallback to local storage cache
    try {
      const cached = await AsyncStorage.getItem(getMedicalStorageKey(resolvedUserId));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          const pendingQueue = await AsyncStorage.getItem(getMedicalQueueKey(resolvedUserId));
          useAuthStore.getState().updateProfileFields({ medical_info: parsed });
          return { data: parsed, fromCache: true, pendingSync: Boolean(pendingQueue) };
        }
      }
    } catch (_) {}

    // 5. Fallback to in-memory store if previously loaded
    const storeMedical = useAuthStore.getState().profile?.medical_info;
    if (storeMedical && isMeaningful(storeMedical)) {
      return { data: storeMedical, fromCache: true };
    }

    return { data: null, fromCache: false };
  },

  /**
   * Save medical info with resilient Dual-Write (medical_info table + profiles.medical_info column + local cache)
   */
  async saveMedicalInfo(userId: string, data: Partial<MedicalInfo>): Promise<SaveResult<MedicalInfo>> {
    const resolvedUserId = userId || useAuthStore.getState().profile?.id || useAuthStore.getState().user?.id || useAuthStore.getState().session?.user?.id;
    if (!resolvedUserId) return { success: false, error: 'User ID is required' };

    const payload: MedicalInfo = {
      user_id: resolvedUserId,
      blood_type: data.blood_type || 'O+',
      allergies: (data.allergies ?? '').trim(),
      conditions: (data.conditions ?? '').trim(),
      medications: (data.medications ?? '').trim(),
      notes: (data.notes ?? '').trim(),
      updated_at: new Date().toISOString(),
    };

    let savedRemote = false;

    // 1. Try dedicated relational medical_info table
    try {
      const { data: returnedRow, error } = await supabase
        .from('medical_info')
        .upsert(payload, { onConflict: 'user_id' })
        .select('*')
        .single();

      if (!error && returnedRow) {
        savedRemote = true;
      }
    } catch (err: any) {
      console.warn('[EmergencyMedicalService] medical_info table upsert notice:', err?.message || err);
    }

    // 2. Dual-Write to profiles.medical_info JSONB column
    try {
      const { error: profError } = await supabase
        .from('profiles')
        .update({ medical_info: payload })
        .eq('id', resolvedUserId);

      if (!profError) {
        savedRemote = true;
      }
    } catch (profErr) {
      console.warn('[EmergencyMedicalService] profiles medical_info update notice:', profErr);
    }

    // 3. Always update user-scoped local storage & Zustand store
    try {
      await AsyncStorage.setItem(getMedicalStorageKey(resolvedUserId), JSON.stringify(payload));
      useAuthStore.getState().updateProfileFields({ medical_info: payload });
    } catch (cacheErr) {
      console.warn('[EmergencyMedicalService] Local medical cache update notice:', cacheErr);
    }

    // 4. Return success if remote write succeeded
    if (savedRemote) {
      await AsyncStorage.removeItem(getMedicalQueueKey(resolvedUserId)).catch(() => {});
      return { success: true, data: payload };
    }

    // 5. Offline / Network Failure: Queue in AsyncStorage for background sync
    try {
      await AsyncStorage.setItem(getMedicalQueueKey(resolvedUserId), JSON.stringify(payload));
      return { success: true, pendingSync: true, data: payload, error: 'Saved offline. Pending sync.' };
    } catch (queueErr: any) {
      return { success: false, error: 'Failed to save medical info offline.' };
    }
  },

  /**
   * Fetch emergency contacts from Supabase with user-scoped cache fallback
   */
  async fetchEmergencyContacts(userId: string): Promise<{ data: EmergencyContactItem[]; fromCache: boolean; pendingSync?: boolean; error?: string }> {
    const resolvedUserId = userId || useAuthStore.getState().profile?.id || useAuthStore.getState().user?.id || useAuthStore.getState().session?.user?.id;
    if (!resolvedUserId) return { data: [], fromCache: false };

    let fetchedContacts: EmergencyContactItem[] = [];
    let hasFetched = false;

    // 1. Try relational emergency_contacts table
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', resolvedUserId)
        .order('sort_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        fetchedContacts = data;
        hasFetched = true;
      }
    } catch (_) {}

    // 2. Fallback to profiles.emergency_contacts JSONB column
    if (!hasFetched) {
      try {
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('emergency_contacts')
          .eq('id', resolvedUserId)
          .maybeSingle();

        if (!error && prof?.emergency_contacts && Array.isArray(prof.emergency_contacts) && prof.emergency_contacts.length > 0) {
          fetchedContacts = prof.emergency_contacts;
          hasFetched = true;
        }
      } catch (_) {}
    }

    // 3. If fetched from server, update local storage & zustand
    if (hasFetched && fetchedContacts.length > 0) {
      try {
        await AsyncStorage.setItem(getContactsStorageKey(resolvedUserId), JSON.stringify(fetchedContacts));
        await AsyncStorage.setItem(getPrimaryContactStorageKey(resolvedUserId), JSON.stringify({ name: fetchedContacts[0].name, phone: fetchedContacts[0].phone }));
        useAuthStore.getState().updateProfileFields({ emergency_contacts: fetchedContacts });
        return { data: fetchedContacts, fromCache: false };
      } catch (_) {}
    }

    // 4. Fallback to local storage cache across all key variants
    const contactStorageKeys = [
      getContactsStorageKey(resolvedUserId),
      `@circleguard_emergency_contacts_${resolvedUserId}`,
      '@circleguard_emergency_contacts',
      '@circleguard_cached_emergency_contacts',
    ];
    for (const ck of contactStorageKeys) {
      try {
        const cached = await AsyncStorage.getItem(ck);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalized = parsed.map((item: any, idx: number) => ({
              id: item.id || generateContactUUID(),
              user_id: resolvedUserId,
              name: item.name || 'Emergency Contact',
              phone: item.phone,
              relationship: item.relationship || 'Emergency Contact',
              sort_order: item.sort_order ?? idx,
              updated_at: item.updated_at || new Date().toISOString(),
            }));
            useAuthStore.getState().updateProfileFields({ emergency_contacts: normalized });
            return { data: normalized, fromCache: true };
          }
        }
      } catch (_) {}
    }

    // 5. Fallback to in-memory store profile.emergency_contacts
    const storeContacts = useAuthStore.getState().profile?.emergency_contacts;
    if (Array.isArray(storeContacts) && storeContacts.length > 0) {
      const normalizedStore = storeContacts.map((item: any, idx: number) => ({
        id: item.id || generateContactUUID(),
        user_id: resolvedUserId,
        name: item.name || 'Emergency Contact',
        phone: item.phone,
        relationship: item.relationship || 'Emergency Contact',
        sort_order: item.sort_order ?? idx,
        updated_at: item.updated_at || new Date().toISOString(),
      }));
      await AsyncStorage.setItem(getContactsStorageKey(resolvedUserId), JSON.stringify(normalizedStore)).catch(() => {});
      return { data: normalizedStore, fromCache: true };
    }

    // 6. Fallback to primary contact storage (which ProfileScreen uses)
    try {
      const primaryKeys = [
        getPrimaryContactStorageKey(resolvedUserId),
        `@circleguard_primary_emergency_contact_${resolvedUserId}`,
        '@circleguard_primary_emergency_contact',
        `@circleguard_primary_contact_${resolvedUserId}`,
      ];
      for (const pk of primaryKeys) {
        const savedPrimary = await AsyncStorage.getItem(pk);
        if (savedPrimary) {
          const parsed = JSON.parse(savedPrimary);
          if (parsed && parsed.name && parsed.phone) {
            const synthesized: EmergencyContactItem = {
              id: generateContactUUID(),
              user_id: resolvedUserId,
              name: parsed.name,
              phone: parsed.phone,
              relationship: 'Primary Contact',
              sort_order: 0,
              updated_at: new Date().toISOString(),
            };
            const list = [synthesized];
            await AsyncStorage.setItem(getContactsStorageKey(resolvedUserId), JSON.stringify(list)).catch(() => {});
            await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(list)).catch(() => {});
            useAuthStore.getState().updateProfileFields({ emergency_contacts: list });
            return { data: list, fromCache: true };
          }
        }
      }
    } catch (_) {}

    return { data: [], fromCache: false };
  },

  /**
   * Insert a new emergency contact (Resilient Dual-Write with Offline Queue)
   */
  async addEmergencyContact(
    userId: string,
    contact: { id?: string; name: string; phone: string; relationship: string; sort_order?: number }
  ): Promise<SaveResult<EmergencyContactItem>> {
    const resolvedUserId = userId || useAuthStore.getState().profile?.id || useAuthStore.getState().user?.id || useAuthStore.getState().session?.user?.id;
    if (!resolvedUserId) return { success: false, error: 'User ID is required' };
    if (!contact.name.trim() || !contact.phone.trim()) {
      return { success: false, error: 'Contact name and phone number are required.' };
    }

    const contactId = contact.id || generateContactUUID();
    const payload: EmergencyContactItem = {
      id: contactId,
      user_id: resolvedUserId,
      name: contact.name.trim(),
      phone: contact.phone.trim(),
      relationship: contact.relationship.trim() || 'Guardian',
      sort_order: contact.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    };

    let savedRemote = false;

    // 1. Try dedicated emergency_contacts relational table
    try {
      const { data: newRow, error } = await supabase
        .from('emergency_contacts')
        .insert([payload])
        .select('*')
        .single();

      if (!error && newRow) {
        savedRemote = true;
      } else if (error) {
        console.warn('[EmergencyMedicalService] emergency_contacts table insert notice:', error.message);
      }
    } catch (err: any) {
      console.warn('[EmergencyMedicalService] emergency_contacts table insert skipped:', err?.message || err);
    }

    // 2. Safe array management: fetch current contacts list from store and cache
    let safeCurrent: EmergencyContactItem[] = [];
    const rawCurrent = useAuthStore.getState().profile?.emergency_contacts;
    if (Array.isArray(rawCurrent) && rawCurrent.length > 0) {
      safeCurrent = [...rawCurrent];
    } else {
      try {
        const cached = await AsyncStorage.getItem(getContactsStorageKey(resolvedUserId));
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            safeCurrent = parsed;
          }
        }
      } catch (_) {}
    }

    const payloadDigits = payload.phone.replace(/\D/g, '');
    const filtered = safeCurrent.filter(c => c.id !== payload.id && c.phone.replace(/\D/g, '') !== payloadDigits);
    const updatedList = [...filtered, payload];

    // 3. Fallback / Dual-Write: Update profiles.emergency_contacts JSONB column
    try {
      const { error: profError } = await supabase
        .from('profiles')
        .update({ emergency_contacts: updatedList })
        .eq('id', resolvedUserId);

      if (!profError) {
        savedRemote = true;
      }
    } catch (profErr) {
      console.warn('[EmergencyMedicalService] profiles emergency_contacts update notice:', profErr);
    }

    // 4. Always update local storage & Zustand store across all key variants
    try {
      await AsyncStorage.setItem(getContactsStorageKey(resolvedUserId), JSON.stringify(updatedList));
      await AsyncStorage.setItem('@circleguard_emergency_contacts', JSON.stringify(updatedList)).catch(() => {});
      useAuthStore.getState().updateProfileFields({ emergency_contacts: updatedList });

      // Update primary contact storage
      const primaryData = { name: payload.name, phone: payload.phone };
      await AsyncStorage.setItem(getPrimaryContactStorageKey(resolvedUserId), JSON.stringify(primaryData)).catch(() => {});
      await AsyncStorage.setItem(`@circleguard_primary_emergency_contact_${resolvedUserId}`, JSON.stringify(primaryData)).catch(() => {});
      await AsyncStorage.setItem('@circleguard_primary_emergency_contact', JSON.stringify(primaryData)).catch(() => {});

      // Sync into OfflineSmsSosService cache for immediate 1-tap SMS readiness
      const smsCacheList = updatedList.map(c => ({ name: c.name, phone: c.phone }));
      await AsyncStorage.setItem('@circleguard_cached_emergency_contacts', JSON.stringify(smsCacheList));
    } catch (storageErr) {
      console.warn('[EmergencyMedicalService] Local storage update notice:', storageErr);
    }

    // 5. If remote write succeeded (either table or profiles column), return success
    if (savedRemote) {
      return { success: true, data: payload };
    }

    // 6. If completely offline, queue for background sync and return success with pendingSync
    await this._queueContactAction(resolvedUserId, { type: 'ADD', contact: payload, tempId: contactId });
    return { success: true, pendingSync: true, data: payload, error: 'Saved offline. Pending sync.' };
  },

  /**
   * Update an existing emergency contact
   */
  async updateEmergencyContact(
    userId: string,
    contactId: string,
    updates: Partial<{ name: string; phone: string; relationship: string; sort_order: number }>
  ): Promise<SaveResult<EmergencyContactItem>> {
    const resolvedUserId = userId || useAuthStore.getState().profile?.id || useAuthStore.getState().user?.id || useAuthStore.getState().session?.user?.id;
    if (!resolvedUserId || !contactId) return { success: false, error: 'User ID and Contact ID required' };

    const rawCurrent = useAuthStore.getState().profile?.emergency_contacts;
    const safeCurrent: EmergencyContactItem[] = Array.isArray(rawCurrent) ? [...rawCurrent] : [];
    const existing = safeCurrent.find(c => c.id === contactId);
    const updatedItem: EmergencyContactItem = {
      ...(existing || { id: contactId, user_id: resolvedUserId, name: '', phone: '', relationship: 'Guardian' }),
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const updatedList = safeCurrent.map(c => (c.id === contactId ? updatedItem : c));

    // Update local cache & store
    try {
      await AsyncStorage.setItem(getContactsStorageKey(resolvedUserId), JSON.stringify(updatedList));
      useAuthStore.getState().updateProfileFields({ emergency_contacts: updatedList });
      const smsCacheList = updatedList.map(c => ({ name: c.name, phone: c.phone }));
      await AsyncStorage.setItem('@circleguard_cached_emergency_contacts', JSON.stringify(smsCacheList));
    } catch (_) {}

    // Dual update
    try {
      await supabase
        .from('emergency_contacts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', contactId)
        .eq('user_id', resolvedUserId);
    } catch (_) {}

    try {
      await supabase
        .from('profiles')
        .update({ emergency_contacts: updatedList })
        .eq('id', resolvedUserId);
    } catch (_) {}

    return { success: true, data: updatedItem };
  },

  /**
   * Delete an emergency contact
   */
  async deleteEmergencyContact(userId: string, contactId: string): Promise<SaveResult<boolean>> {
    const resolvedUserId = userId || useAuthStore.getState().profile?.id || useAuthStore.getState().user?.id || useAuthStore.getState().session?.user?.id;
    if (!resolvedUserId || !contactId) return { success: false, error: 'User ID and Contact ID required' };

    // Update local cache & store first so UI is immediately responsive
    const rawCurrent = useAuthStore.getState().profile?.emergency_contacts;
    const safeCurrent: EmergencyContactItem[] = Array.isArray(rawCurrent) ? [...rawCurrent] : [];
    const updatedList = safeCurrent.filter((c) => c.id !== contactId);

    try {
      await AsyncStorage.setItem(getContactsStorageKey(resolvedUserId), JSON.stringify(updatedList));
      useAuthStore.getState().updateProfileFields({ emergency_contacts: updatedList });

      // Sync with OfflineSmsSosService cache
      const smsCacheList = updatedList.map(c => ({ name: c.name, phone: c.phone }));
      await AsyncStorage.setItem('@circleguard_cached_emergency_contacts', JSON.stringify(smsCacheList));
    } catch (_) {}

    // Dual-delete from DB
    try {
      await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', contactId)
        .eq('user_id', resolvedUserId);
    } catch (_) {}

    try {
      await supabase
        .from('profiles')
        .update({ emergency_contacts: updatedList })
        .eq('id', resolvedUserId);
    } catch (_) {}

    return { success: true, data: true };
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
        await Promise.allSettled([
          supabase.from('medical_info').upsert(payload, { onConflict: 'user_id' }),
          supabase.from('profiles').update({ medical_info: payload }).eq('id', userId),
        ]);
        await AsyncStorage.removeItem(getMedicalQueueKey(userId));
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
