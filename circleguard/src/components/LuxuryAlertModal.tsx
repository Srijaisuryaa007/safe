import React, { createContext, useContext, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

export type AlertType = 'success' | 'warning' | 'error' | 'info';

export interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  buttonText?: string;
  onPress?: () => void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface PrivacyRequestOptions {
  requesterName: string;
  featureName: string;
  requesterId: string;
  circleId: string;
  onApprove?: () => void;
  onDecline?: () => void;
}

interface LuxuryAlertContextType {
  showAlert: (options: AlertOptions) => void;
  showConfirm: (options: ConfirmOptions) => void;
  showPrivacyRequest: (options: PrivacyRequestOptions) => void;
  hideAlert: () => void;
}

const LuxuryAlertContext = createContext<LuxuryAlertContextType>({
  showAlert: () => {},
  showConfirm: () => {},
  showPrivacyRequest: () => {},
  hideAlert: () => {},
});

export const useLuxuryAlert = () => useContext(LuxuryAlertContext);

export function LuxuryAlertProvider({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useThemeStore();
  const [visible, setVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'alert' | 'confirm' | 'privacy'>('alert');

  const [alertConfig, setAlertConfig] = useState<AlertOptions>({
    title: '',
    message: '',
    type: 'info',
    buttonText: 'OK',
  });

  const [confirmConfig, setConfirmConfig] = useState<ConfirmOptions>({
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDestructive: false,
  });

  const [privacyConfig, setPrivacyConfig] = useState<PrivacyRequestOptions>({
    requesterName: '',
    featureName: '',
    requesterId: '',
    circleId: '',
  });

  const showAlert = (options: AlertOptions) => {
    setModalMode('alert');
    setAlertConfig({
      type: 'info',
      buttonText: 'OK',
      ...options,
    });
    setVisible(true);
  };

  const showConfirm = (options: ConfirmOptions) => {
    setModalMode('confirm');
    setConfirmConfig({
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      isDestructive: false,
      ...options,
    });
    setVisible(true);
  };

  const showPrivacyRequest = (options: PrivacyRequestOptions) => {
    setModalMode('privacy');
    setPrivacyConfig(options);
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
  };

  const handleAlertPress = () => {
    hideAlert();
    if (alertConfig.onPress) alertConfig.onPress();
  };

  const handleConfirmPress = () => {
    hideAlert();
    if (confirmConfig.onConfirm) confirmConfig.onConfirm();
  };

  const handleCancelPress = () => {
    hideAlert();
    if (confirmConfig.onCancel) confirmConfig.onCancel();
  };

  const handlePrivacyApprove = () => {
    hideAlert();
    if (privacyConfig.onApprove) privacyConfig.onApprove();
  };

  const handlePrivacyDecline = () => {
    hideAlert();
    if (privacyConfig.onDecline) privacyConfig.onDecline();
  };

  const getAlertIcon = () => {
    switch (alertConfig.type) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: '#30D158', bg: isDark ? 'rgba(48, 209, 88, 0.15)' : '#DCFCE7' };
      case 'warning':
        return { name: 'alert-circle' as const, color: '#FF9F0A', bg: isDark ? 'rgba(255, 159, 10, 0.15)' : '#FEF3C7' };
      case 'error':
        return { name: 'close-circle' as const, color: '#FF453A', bg: isDark ? 'rgba(255, 69, 58, 0.15)' : '#FEE2E2' };
      default:
        return { name: 'information-circle' as const, color: '#0A84FF', bg: isDark ? 'rgba(10, 132, 255, 0.15)' : '#DBEAFE' };
    }
  };

  const iconInfo = getAlertIcon();

  return (
    <LuxuryAlertContext.Provider value={{ showAlert, showConfirm, showPrivacyRequest, hideAlert }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={hideAlert}>
        <View style={styles.overlay}>
          {modalMode === 'alert' ? (
            /* Apple HIG Informational Dialog */
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                },
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: iconInfo.bg }]}>
                <Ionicons name={iconInfo.name} size={30} color={iconInfo.color} />
              </View>

              <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {alertConfig.title}
              </Text>
              <Text style={[styles.message, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {alertConfig.message}
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.accentGold || '#D4AF37' }]}
                onPress={handleAlertPress}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>{alertConfig.buttonText || 'OK'}</Text>
              </TouchableOpacity>
            </View>
          ) : modalMode === 'confirm' ? (
            /* Apple HIG Confirmation Dialog */
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                },
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: confirmConfig.isDestructive
                      ? (isDark ? 'rgba(255, 69, 58, 0.15)' : '#FEE2E2')
                      : (isDark ? 'rgba(10, 132, 255, 0.15)' : '#DBEAFE'),
                  },
                ]}
              >
                <Ionicons
                  name={confirmConfig.isDestructive ? 'trash-outline' : 'help-circle-outline'}
                  size={30}
                  color={confirmConfig.isDestructive ? '#FF453A' : '#0A84FF'}
                />
              </View>

              <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                {confirmConfig.title}
              </Text>
              <Text style={[styles.message, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {confirmConfig.message}
              </Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    { backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6' },
                  ]}
                  onPress={handleCancelPress}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelBtnText, { color: isDark ? '#FFFFFF' : '#374151' }]}>
                    {confirmConfig.cancelText || 'Cancel'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: confirmConfig.isDestructive ? '#FF453A' : (colors.accentGold || '#0A84FF') },
                  ]}
                  onPress={handleConfirmPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>
                    {confirmConfig.confirmText || 'Confirm'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Apple HIG Privacy Request Modal */
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
                },
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(10, 132, 255, 0.15)' : '#DBEAFE' }]}>
                <Ionicons name="shield-half" size={30} color="#0A84FF" />
              </View>

              <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                Privacy Request
              </Text>
              <Text style={[styles.message, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {privacyConfig.requesterName} requested permission to enable {privacyConfig.featureName}. As Circle Leader, do you authorize this?
              </Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    { backgroundColor: isDark ? '#2C2C2E' : '#FEE2E2' },
                  ]}
                  onPress={handlePrivacyDecline}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelBtnText, { color: '#FF453A' }]}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#30D158' }]}
                  onPress={handlePrivacyApprove}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>Authorize</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </LuxuryAlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  primaryBtn: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
