import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from 'react-native';
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

  // Global Alert.alert polyfill: intercepts any raw Alert.alert calls across the app
  useEffect(() => {
    const originalAlert = Alert.alert;
    Alert.alert = (title: string, message?: string, buttons?: any[]) => {
      if (buttons && buttons.length >= 2) {
        const cancelBtn = buttons.find(b => b.style === 'cancel') || buttons[0];
        const confirmBtn = buttons.find(b => b.style !== 'cancel') || buttons[1];
        showConfirm({
          title: title || 'Notice',
          message: message || '',
          cancelText: cancelBtn?.text || 'Cancel',
          confirmText: confirmBtn?.text || 'Confirm',
          isDestructive: confirmBtn?.style === 'destructive',
          onCancel: cancelBtn?.onPress,
          onConfirm: confirmBtn?.onPress,
        });
      } else {
        const singleBtn = buttons && buttons.length === 1 ? buttons[0] : null;
        const lowTitle = (title || '').toLowerCase();
        let alertType: AlertType = 'info';
        if (lowTitle.includes('error') || lowTitle.includes('failed') || lowTitle.includes('denied')) {
          alertType = 'error';
        } else if (lowTitle.includes('warning') || lowTitle.includes('caution')) {
          alertType = 'warning';
        } else if (lowTitle.includes('created') || lowTitle.includes('success') || lowTitle.includes('joined') || lowTitle.includes('saved') || lowTitle.includes('copied')) {
          alertType = 'success';
        }

        showAlert({
          title: title || 'Notice',
          message: message || '',
          type: alertType,
          buttonText: singleBtn?.text || 'OK',
          onPress: singleBtn?.onPress,
        });
      }
    };

    return () => {
      Alert.alert = originalAlert;
    };
  }, []);

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
        return { name: 'checkmark-circle' as const, color: '#10B981', bg: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)' };
      case 'warning':
        return { name: 'alert-circle' as const, color: '#F59E0B', bg: isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.12)' };
      case 'error':
        return { name: 'close-circle' as const, color: '#EF4444', bg: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)' };
      default:
        return { name: 'information-circle' as const, color: '#38BDF8', bg: isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.12)' };
    }
  };

  const iconInfo = getAlertIcon();

  return (
    <LuxuryAlertContext.Provider value={{ showAlert, showConfirm, showPrivacyRequest, hideAlert }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={hideAlert}>
        <View style={styles.overlay}>
          {modalMode === 'alert' ? (
            /* Modern Enterprise Alert Dialog */
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#141619' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                },
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: iconInfo.bg }]}>
                <Ionicons name={iconInfo.name} size={32} color={iconInfo.color} />
              </View>

              <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                {alertConfig.title}
              </Text>
              <Text style={[styles.message, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {alertConfig.message}
              </Text>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: isDark ? '#F8FAFC' : '#0F172A' },
                ]}
                onPress={handleAlertPress}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryBtnText, { color: isDark ? '#0F172A' : '#FFFFFF' }]}>
                  {alertConfig.buttonText || 'OK'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : modalMode === 'confirm' ? (
            /* Modern Enterprise Confirmation Dialog */
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#141619' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                },
              ]}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: confirmConfig.isDestructive
                      ? (isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)')
                      : (isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.12)'),
                  },
                ]}
              >
                <Ionicons
                  name={confirmConfig.isDestructive ? 'trash-outline' : 'help-circle-outline'}
                  size={32}
                  color={confirmConfig.isDestructive ? '#EF4444' : '#38BDF8'}
                />
              </View>

              <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                {confirmConfig.title}
              </Text>
              <Text style={[styles.message, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {confirmConfig.message}
              </Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                    },
                  ]}
                  onPress={handleCancelPress}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelBtnText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                    {confirmConfig.cancelText || 'Cancel'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: confirmConfig.isDestructive ? '#EF4444' : (isDark ? '#F8FAFC' : '#0F172A') },
                  ]}
                  onPress={handleConfirmPress}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.confirmBtnText, { color: confirmConfig.isDestructive ? '#FFFFFF' : (isDark ? '#0F172A' : '#FFFFFF') }]}>
                    {confirmConfig.confirmText || 'Confirm'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Modern Enterprise Privacy Request Modal */
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? '#141619' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                },
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.12)' }]}>
                <Ionicons name="shield-half" size={32} color="#38BDF8" />
              </View>

              <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                Privacy Request
              </Text>
              <Text style={[styles.message, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {privacyConfig.requesterName} requested permission to enable {privacyConfig.featureName}. As Circle Leader, do you authorize this?
              </Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2' },
                  ]}
                  onPress={handlePrivacyDecline}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelBtnText, { color: '#EF4444' }]}>DECLINE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#10B981' }]}
                  onPress={handlePrivacyApprove}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmBtnText}>AUTHORIZE</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 330,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 14,
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
