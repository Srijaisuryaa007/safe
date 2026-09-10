import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import LeaderApprovalModal from './LeaderApprovalModal';
import { useLuxuryAlert } from './LuxuryAlertModal';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import TermsOfServiceModal from './TermsOfServiceModal';
import DeleteAccountModal from './DeleteAccountModal';

interface PrivacySecurityModalProps {
  visible: boolean;
  onClose: () => void;
}

const KEYS = {
  GHOST_MODE: '@circleguard_ghost_mode',
  HIDE_ONLINE: '@circleguard_hide_online',
  APP_LOCK: '@circleguard_app_lock',
  SHAKE_SOS: '@circleguard_shake_sos',
};

export default function PrivacySecurityModal({ visible, onClose }: PrivacySecurityModalProps) {
  const { profile } = useAuthStore();
  const { showAlert, showConfirm } = useLuxuryAlert();

  const [ghostMode, setGhostMode] = useState(false);
  const [hideOnline, setHideOnline] = useState(false);
  const [appLock, setAppLock] = useState(false);
  const [shakeSos, setShakeSos] = useState(false);
  const [purging, setPurging] = useState(false);

  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalFeature, setApprovalFeature] = useState<'ghost_mode' | 'hide_online' | 'location_off'>('ghost_mode');
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  useEffect(() => {
    if (visible && profile?.id) {
      loadSettings();

      const channel = supabase
        .channel(`public:profiles:${profile.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
          (payload) => {
            if (payload.new) {
              useAuthStore.getState().setProfile(payload.new as any);
              setGhostMode(!!payload.new.is_ghost_mode);
              setHideOnline(!!payload.new.hide_online_presence);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [visible, profile?.id]);

  const loadSettings = async () => {
    try {
      const g = await AsyncStorage.getItem(KEYS.GHOST_MODE);
      const h = await AsyncStorage.getItem(KEYS.HIDE_ONLINE);
      const l = await AsyncStorage.getItem(KEYS.APP_LOCK);
      const s = await AsyncStorage.getItem(KEYS.SHAKE_SOS);

      if (profile) {
        setGhostMode(profile.is_ghost_mode ?? (g === 'true'));
        setHideOnline(profile.hide_online_presence ?? (h === 'true'));
      } else {
        if (g !== null) setGhostMode(g === 'true');
        if (h !== null) setHideOnline(h === 'true');
      }

      if (l !== null) setAppLock(l === 'true');
      if (s !== null) setShakeSos(s === 'true');
    } catch (e) {
      console.error('Error loading privacy settings:', e);
    }
  };

  const isUserCircleLeader = () => {
    const { activeCircle } = useCircleStore.getState();
    return activeCircle?.owner_id === profile?.id;
  };

  const toggleSetting = async (key: string, value: boolean, setter: (val: boolean) => void) => {
    const isLeader = isUserCircleLeader();

    if ((key === KEYS.GHOST_MODE || key === KEYS.HIDE_ONLINE) && value && !isLeader) {
      const featureKey = key === KEYS.GHOST_MODE ? 'ghost_mode' : 'hide_online';
      setApprovalFeature(featureKey);
      setApprovalModalVisible(true);
      return;
    }

    setter(value);
    await AsyncStorage.setItem(key, value.toString());

    if (key === KEYS.GHOST_MODE && profile?.id) {
      try {
        await supabase.from('profiles').update({ is_ghost_mode: value }).eq('id', profile.id);
        useAuthStore.getState().setProfile({ ...profile, is_ghost_mode: value });
      } catch (err) {
        console.warn('Failed to sync ghost mode to cloud:', err);
      }
    }

    if (key === KEYS.HIDE_ONLINE && profile?.id) {
      try {
        await supabase.from('profiles').update({ hide_online_presence: value }).eq('id', profile.id);
        useAuthStore.getState().setProfile({ ...profile, hide_online_presence: value });
      } catch (err) {
        console.warn('Failed to sync hide online presence to cloud:', err);
      }
    }
  };

  const handlePurgeLocationHistory = async () => {
    if (!profile?.id) return;

    showConfirm({
      title: 'Purge Location Trails',
      message:
        'This will permanently delete your historical breadcrumb records and location trail points. This action cannot be undone.',
      confirmText: 'PURGE DATA',
      cancelText: 'CANCEL',
      isDestructive: true,
      onConfirm: async () => {
        setPurging(true);
        try {
          const { error } = await supabase.from('locations').delete().eq('user_id', profile.id);
          if (error) throw error;

          showAlert({
            title: 'Location History Purged',
            message: 'All your historical location telemetry points have been permanently erased.',
            type: 'success',
            buttonText: 'DONE',
          });
        } catch (err: any) {
          showAlert({
            title: 'Purge Failed',
            message: err.message || 'Could not complete deletion.',
            type: 'error',
          });
        } finally {
          setPurging(false);
        }
      },
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={20} color="#1F2A24" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.overline}>SECURITY SUITE</Text>
            <Text style={styles.title}>Privacy & Security</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Manage how your location privacy, online presence, and security encryption protocols function.
          </Text>

          {/* Section: Location & Presence Privacy */}
          <Text style={styles.sectionTitle}>LOCATION & PRESENCE</Text>

          <View style={styles.cardGroup}>
            {/* Ghost Mode Toggle */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="eye-off-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={styles.textWrapper}>
                  <Text style={styles.rowTitle}>Ghost Privacy Mode</Text>
                  <Text style={styles.rowDesc}>
                    Fuzzes your GPS to an approximate ~500m radius for circle members
                  </Text>
                </View>
              </View>
              <Switch
                value={ghostMode}
                onValueChange={(val) => toggleSetting(KEYS.GHOST_MODE, val, setGhostMode)}
                trackColor={{ false: '#E2E4E9', true: '#2E7D5B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Hide Online Status Toggle */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#F0EFEA' }]}>
                  <Ionicons name="radio-outline" size={18} color="#1F2A24" />
                </View>
                <View style={styles.textWrapper}>
                  <Text style={styles.rowTitle}>Hide Online Presence</Text>
                  <Text style={styles.rowDesc}>
                    Conceal active status indicator and live timestamps
                  </Text>
                </View>
              </View>
              <Switch
                value={hideOnline}
                onValueChange={(val) => toggleSetting(KEYS.HIDE_ONLINE, val, setHideOnline)}
                trackColor={{ false: '#E2E4E9', true: '#2E7D5B' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Section: Device Security */}
          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>DEVICE SECURITY</Text>

          <View style={styles.cardGroup}>
            {/* Biometric App Lock */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="finger-print-outline" size={18} color="#2E7D5B" />
                </View>
                <View style={styles.textWrapper}>
                  <Text style={styles.rowTitle}>Biometric App Lock</Text>
                  <Text style={styles.rowDesc}>
                    Require FaceID / TouchID to unlock CircleGuard on launch
                  </Text>
                </View>
              </View>
              <Switch
                value={appLock}
                onValueChange={(val) => toggleSetting(KEYS.APP_LOCK, val, setAppLock)}
                trackColor={{ false: '#E2E4E9', true: '#2E7D5B' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Shake SOS Trigger */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconSquircle, { backgroundColor: '#FFF3EB' }]}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#E07A5F" />
                </View>
                <View style={styles.textWrapper}>
                  <Text style={styles.rowTitle}>Shake Phone for SOS</Text>
                  <Text style={styles.rowDesc}>
                    Vigorously shaking device instantly dispatches distress signal
                  </Text>
                </View>
              </View>
              <Switch
                value={shakeSos}
                onValueChange={(val) => toggleSetting(KEYS.SHAKE_SOS, val, setShakeSos)}
                trackColor={{ false: '#E2E4E9', true: '#E07A5F' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Section: Legal & Compliance */}
          <Text style={[styles.sectionTitle, { marginTop: 22 }]}>LEGAL & COMPLIANCE</Text>

          <View style={styles.cardGroup}>
            <TouchableOpacity
              style={styles.policyRow}
              onPress={() => setPolicyModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconSquircle, { backgroundColor: '#E8F5EE' }]}>
                <Ionicons name="document-text-outline" size={18} color="#2E7D5B" />
              </View>
              <Text style={styles.policyTitle}>Read Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={16} color="#8E9992" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.policyRow}
              onPress={() => setTermsModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconSquircle, { backgroundColor: '#E8F5EE' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#2E7D5B" />
              </View>
              <Text style={styles.policyTitle}>Read Terms of Service</Text>
              <Ionicons name="chevron-forward" size={16} color="#8E9992" />
            </TouchableOpacity>
          </View>

          {/* Section: Danger Zone */}
          <Text style={[styles.sectionTitle, { color: '#DC2626', marginTop: 26 }]}>DANGER ZONE</Text>

          <TouchableOpacity
            style={styles.dangerCardBtn}
            onPress={handlePurgeLocationHistory}
            disabled={purging}
            activeOpacity={0.8}
          >
            <View style={[styles.iconSquircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="trash-bin-outline" size={18} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dangerBtnTitle, { color: '#DC2626' }]}>Purge Location Trails</Text>
              <Text style={styles.dangerBtnDesc}>
                Permanently delete all historical GPS route points from database
              </Text>
            </View>
            {purging ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#DC2626" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerCardBtn, { marginTop: 10 }]}
            onPress={() => setDeleteModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconSquircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="person-remove-outline" size={18} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dangerBtnTitle, { color: '#DC2626' }]}>Permanently Delete Account</Text>
              <Text style={styles.dangerBtnDesc}>
                Erase your identity profile, circle memberships, and all safety data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#DC2626" />
          </TouchableOpacity>
        </ScrollView>

        <LeaderApprovalModal
          visible={approvalModalVisible}
          onClose={() => setApprovalModalVisible(false)}
          requestedFeature={approvalFeature}
        />

        <PrivacyPolicyModal
          visible={policyModalVisible}
          onClose={() => setPolicyModalVisible(false)}
        />

        <TermsOfServiceModal
          visible={termsModalVisible}
          onClose={() => setTermsModalVisible(false)}
        />

        <DeleteAccountModal
          visible={deleteModalVisible}
          onClose={() => {
            setDeleteModalVisible(false);
            if (!useAuthStore.getState().session) {
              onClose();
            }
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 42,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F0EFEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitleBox: {
    flex: 1,
  },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D5B',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  subtitle: {
    fontSize: 13,
    color: '#5C665F',
    lineHeight: 19,
    marginBottom: 16,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C665F',
    letterSpacing: 0.6,
    marginBottom: 8,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    overflow: 'hidden',
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  iconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrapper: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  rowDesc: {
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
    lineHeight: 15,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EFEA',
    marginLeft: 62,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  policyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2A24',
    flex: 1,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  dangerCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FFD7C7',
    padding: 14,
    gap: 12,
  },
  dangerBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
  dangerBtnDesc: {
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
  },
});
