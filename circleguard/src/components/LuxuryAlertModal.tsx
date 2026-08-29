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
  const { colors } = useThemeStore();
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
        return { name: 'checkmark-circle' as const, color: '#30D158' };
      case 'warning':
        return { name: 'alert-circle' as const, color: '#FF9F0A' };
      case 'error':
        return { name: 'close-circle' as const, color: '#FF453A' };
      default:
        return { name: 'information-circle' as const, color: '#0A84FF' };
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
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name={iconInfo.name} size={36} color={iconInfo.color} />
              </View>

              <Text style={styles.title}>{alertConfig.title}</Text>
              <Text style={styles.message}>{alertConfig.message}</Text>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#0A84FF' }]}
                onPress={handleAlertPress}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>{alertConfig.buttonText || 'OK'}</Text>
              </TouchableOpacity>
            </View>
          ) : modalMode === 'confirm' ? (
            /* Apple HIG Confirmation Dialog */
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons
                  name={confirmConfig.isDestructive ? 'trash' : 'help-circle'}
                  size={36}
                  color={confirmConfig.isDestructive ? '#FF453A' : '#0A84FF'}
                />
              </View>

              <Text style={styles.title}>{confirmConfig.title}</Text>
              <Text style={styles.message}>{confirmConfig.message}</Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn]}
                  onPress={handleCancelPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>{confirmConfig.cancelText || 'Cancel'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: confirmConfig.isDestructive ? '#FF453A' : '#0A84FF' },
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
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons name="shield-half" size={36} color="#0A84FF" />
              </View>

              <Text style={styles.title}>Privacy Request</Text>
              <Text style={styles.message}>
                {privacyConfig.requesterName} requested permission to enable {privacyConfig.featureName}. As Circle Leader, do you authorize this?
              </Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: '#FF453A' }]}
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
