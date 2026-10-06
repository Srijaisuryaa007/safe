import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore } from '../store/useCircleStore';
import { dpdpConsentService } from '../services/DpdpConsentService';
import { useLuxuryAlert } from './LuxuryAlertModal';

interface GranularLocationSharingModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function GranularLocationSharingModal({
  visible,
  onClose,
}: GranularLocationSharingModalProps) {
  const { isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { showAlert, showConfirm } = useLuxuryAlert();

  const members = useCircleStore((s) => s.members);
  const activeCircle = useCircleStore((s) => s.activeCircle);

  const [pausedHours, setPausedHours] = useState<number | null>(null);
  const [isSharingStopped, setIsSharingStopped] = useState(false);
  const [memberOverrides, setMemberOverrides] = useState<Record<string, boolean>>({});
  const [erasing, setErasing] = useState(false);

  const handleSetPauseDuration = async (hours: number | null) => {
    setPausedHours(hours);
    setIsSharingStopped(hours === 0);

    if (activeCircle?.id) {
      if (hours === null) {
        await dpdpConsentService.resumeSharing(activeCircle.id, 'circle');
        showAlert({
          title: 'Location Sharing Resumed',
          message: 'Your live location is now streaming to your circle.',
          type: 'success',
        });
      } else {
        await dpdpConsentService.setPauseSharing(activeCircle.id, 'circle', hours);
        const label = hours === 0 ? 'Indefinitely' : `for ${hours} hours`;
        showAlert({
          title: 'Location Sharing Paused',
          message: `Live location stream paused ${label}. Safe zone arrival alerts are suspended during this period.`,
          type: 'info',
        });
      }
    }
  };

  const handleToggleMember = async (userId: string, currentVal: boolean) => {
    const newVal = !currentVal;
    setMemberOverrides(prev => ({ ...prev, [userId]: newVal }));

    if (newVal) {
      await dpdpConsentService.resumeSharing(userId, 'user');
    } else {
      await dpdpConsentService.setPauseSharing(userId, 'user', 0); // 0 = blocked
    }
  };

  const handleDeleteAllData = () => {
    showConfirm({
      title: 'Delete My Location Data?',
      message:
        'Under India DPDP Act and GDPR compliance, this permanently purges all your historical GPS trails, safe zone check-ins, and driving logs. This action is irreversible.',
      confirmText: 'PERMANENTLY PURGE',
      cancelText: 'CANCEL',
      isDestructive: true,
      onConfirm: async () => {
        setErasing(true);
        const res = await dpdpConsentService.executeRightToBeForgotten();
        setErasing(false);
        if (res.success) {
          showAlert({
            title: 'Telemetry Erased',
            message: 'All your historical location data has been permanently deleted from our servers.',
            type: 'success',
          });
        } else {
          showAlert({
            title: 'Erasure Error',
            message: res.error || 'Failed to delete data. Please try again.',
            type: 'error',
          });
        }
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDark ? '#121714' : '#FFFFFF',
              borderColor: isDark ? '#233028' : '#E6EBE8',
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerBar}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111814' }]}>
                Location Privacy & Sharing
              </Text>
              <Text style={[styles.subtitle, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                Granular control over who sees your location
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={isDark ? '#8A9E92' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Quick Pause Section */}
            <View style={styles.sectionHeadingRow}>
              <Ionicons name="pause-circle-outline" size={16} color={isDark ? '#3ADFAB' : '#059669'} />
              <Text style={[styles.sectionHeading, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                PAUSE LIVE SHARING
              </Text>
            </View>

            <View style={styles.pausePillsRow}>
              {[
                { label: 'Resume', hours: null, icon: 'play' },
                { label: '1 Hour', hours: 1, icon: 'time-outline' },
                { label: '8 Hours', hours: 8, icon: 'bed-outline' },
                { label: 'Stop', hours: 0, icon: 'hand-left' },
              ].map(opt => {
                const isActive = pausedHours === opt.hours;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[
                      styles.pausePill,
                      {
                        backgroundColor: isActive
                          ? (isDark ? 'rgba(58, 223, 171, 0.22)' : '#E0F5EB')
                          : (isDark ? '#18241D' : '#F6FAF7'),
                        borderColor: isActive
                          ? (isDark ? '#3ADFAB' : '#006C4F')
                          : (isDark ? '#26372E' : '#E2ECE6'),
                      },
                    ]}
                    onPress={() => handleSetPauseDuration(opt.hours)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={14}
                      color={isActive ? (isDark ? '#3ADFAB' : '#006C4F') : (isDark ? '#8A9E92' : '#64748B')}
                    />
                    <Text
                      style={[
                        styles.pausePillText,
                        {
                          color: isActive
                            ? (isDark ? '#3ADFAB' : '#006C4F')
                            : (isDark ? '#CAD8D0' : '#475C50'),
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Granular Per-Contact Overrides */}
            <View style={[styles.sectionHeadingRow, { marginTop: 18 }]}>
              <Ionicons name="people-outline" size={16} color={isDark ? '#3ADFAB' : '#059669'} />
              <Text style={[styles.sectionHeading, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                CIRCLE MEMBER ACCESS
              </Text>
            </View>

            <View
              style={[
                styles.groupedList,
                {
                  backgroundColor: isDark ? '#18241D' : '#F6FAF7',
                  borderColor: isDark ? '#26372E' : '#E2ECE6',
                },
              ]}
            >
              {members.map((m, idx) => {
                const isEnabled = memberOverrides[m.user_id] !== false && !isSharingStopped;
                return (
                  <React.Fragment key={m.user_id}>
                    <View style={styles.memberRow}>
                      <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: isDark ? '#FFFFFF' : '#141E18' }]}>
                          {m.profile?.full_name || 'Circle Member'}
                        </Text>
                        <Text style={[styles.memberRole, { color: isDark ? '#8A9E92' : '#6A7D71' }]}>
                          {m.role === 'owner' ? 'Leader' : m.role} • {isEnabled ? 'Can see location' : 'Sharing paused'}
                        </Text>
                      </View>
                      <Switch
                        value={isEnabled}
                        onValueChange={() => handleToggleMember(m.user_id, isEnabled)}
                        trackColor={{ false: '#475569', true: isDark ? '#2E7D5B' : '#3ADFAB' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                    {idx < members.length - 1 && (
                      <View
                        style={[
                          styles.divider,
                          { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
                        ]}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </View>

            {/* DPDP Compliance & Right to be Forgotten */}
            <View style={[styles.sectionHeadingRow, { marginTop: 18 }]}>
              <Ionicons name="shield-outline" size={16} color="#EF4444" />
              <Text style={[styles.sectionHeading, { color: '#EF4444' }]}>
                DPDP ACT & DATA PRIVACY RIGHTS
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.deleteCard,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.10)' : '#FFF5F5',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.30)' : '#FECACA',
                },
              ]}
              onPress={handleDeleteAllData}
              disabled={erasing}
              activeOpacity={0.7}
            >
              <View style={styles.deleteCardLeft}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.deleteCardTitle}>Delete My Location Data</Text>
                  <Text style={[styles.deleteCardSub, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
                    Permanently purge all 30-day location breadcrumbs & logs
                  </Text>
                </View>
              </View>
              {erasing ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <Ionicons name="chevron-forward" size={16} color="#EF4444" />
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    paddingTop: 16,
    paddingHorizontal: 18,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pausePillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pausePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  pausePillText: {
    fontSize: 12,
  },
  groupedList: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 11,
  },
  divider: {
    height: 1,
    marginLeft: 14,
  },
  deleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  deleteCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deleteCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#EF4444',
  },
  deleteCardSub: {
    fontSize: 11,
    marginTop: 1,
  },
});
