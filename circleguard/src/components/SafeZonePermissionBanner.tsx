import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  Modal,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

export default function SafeZonePermissionBanner() {
  const { isDark } = useThemeStore();
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState<boolean>(true);
  const [showAndroidHelpModal, setShowAndroidHelpModal] = useState<boolean>(false);

  const checkPermissions = async () => {
    if (Platform.OS === 'web') return;
    try {
      const bg = await Location.getBackgroundPermissionsAsync();
      setHasBackgroundPermission(bg.status === 'granted');
    } catch {
      setHasBackgroundPermission(true);
    }
  };

  useEffect(() => {
    checkPermissions();
    const interval = setInterval(checkPermissions, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestAlwaysPermission = async () => {
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        Linking.openSettings();
        return;
      }

      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status === 'granted') {
        setHasBackgroundPermission(true);
      } else {
        Linking.openSettings();
      }
    } catch {
      Linking.openSettings();
    }
  };

  if (hasBackgroundPermission) {
    return null;
  }

  return (
    <>
      <View
        style={[
          styles.bannerContainer,
          isDark ? styles.bannerDark : styles.bannerLight,
        ]}
      >
        <View style={styles.bannerHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-half" size={18} color="#F59E0B" />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, isDark ? styles.textLight : styles.textDark]}>
              Safe Zone Alerts Suspended
            </Text>
            <Text style={[styles.description, isDark ? styles.subtextDark : styles.subtextLight]}>
              CircleGuard needs "Always Allow" background location to alert your circle when you leave safe zones while the app is closed.
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleRequestAlwaysPermission}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Enable "Always Allow"</Text>
          </TouchableOpacity>

          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowAndroidHelpModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="battery-charging-outline" size={14} color="#3ADFAB" />
              <Text style={styles.secondaryButtonText}>Battery Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Android Battery Optimization Guide Modal */}
      <Modal
        visible={showAndroidHelpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAndroidHelpModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isDark ? styles.cardDark : styles.cardLight]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="hardware-chip-outline" size={24} color="#3ADFAB" />
              </View>
              <Text style={[styles.modalTitle, isDark ? styles.textLight : styles.textDark]}>
                Android Background Reliability
              </Text>
              <TouchableOpacity
                onPress={() => setShowAndroidHelpModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalSubtitle, isDark ? styles.subtextDark : styles.subtextLight]}>
                Android device manufacturers (Samsung, Xiaomi, OnePlus, Vivo) aggressively freeze background apps after 10-30 minutes of screen-off time. To guarantee instant safe zone departure alerts:
              </Text>

              <View style={styles.stepBox}>
                <Text style={styles.stepNum}>1</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, isDark ? styles.textLight : styles.textDark]}>
                    Set Battery Usage to "Unrestricted"
                  </Text>
                  <Text style={[styles.stepDesc, isDark ? styles.subtextDark : styles.subtextLight]}>
                    In App Info → Battery → choose "Unrestricted" instead of "Optimized".
                  </Text>
                </View>
              </View>

              <View style={styles.stepBox}>
                <Text style={styles.stepNum}>2</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, isDark ? styles.textLight : styles.textDark]}>
                    Disable Auto-Freeze / Sleep
                  </Text>
                  <Text style={[styles.stepDesc, isDark ? styles.subtextDark : styles.subtextLight]}>
                    Ensure CircleGuard is added to "Never Sleeping Apps" in your device settings.
                  </Text>
                </View>
              </View>

              <View style={styles.stepBox}>
                <Text style={styles.stepNum}>3</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, isDark ? styles.textLight : styles.textDark]}>
                    Allow Location "All the time"
                  </Text>
                  <Text style={[styles.stepDesc, isDark ? styles.subtextDark : styles.subtextLight]}>
                    In App Permissions → Location → choose "Allow all the time".
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.openSettingsBtn}
                onPress={() => {
                  setShowAndroidHelpModal(false);
                  Linking.openSettings();
                }}
              >
                <Text style={styles.openSettingsBtnText}>Open App Info Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  bannerDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  bannerLight: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingLeft: 42,
  },
  primaryButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3ADFAB',
  },
  secondaryButtonText: {
    color: '#3ADFAB',
    fontSize: 12,
    fontWeight: '600',
  },
  textLight: {
    color: '#F9FAFB',
  },
  textDark: {
    color: '#111827',
  },
  subtextDark: {
    color: '#D1D5DB',
  },
  subtextLight: {
    color: '#4B5563',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#2C2C2E',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(58, 223, 171, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginLeft: 10,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalScroll: {
    marginBottom: 16,
  },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3ADFAB',
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 24,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  modalActions: {
    marginTop: 8,
  },
  openSettingsBtn: {
    backgroundColor: '#3ADFAB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSettingsBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});
