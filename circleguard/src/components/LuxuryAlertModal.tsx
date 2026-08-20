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
    buttonText: 'CONTINUE',
  });

  const [confirmConfig, setConfirmConfig] = useState<ConfirmOptions>({
    title: '',
    message: '',
    confirmText: 'CONFIRM',
    cancelText: 'CANCEL',
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
      buttonText: 'GOT IT',
      ...options,
    });
    setVisible(true);
  };

  const showConfirm = (options: ConfirmOptions) => {
    setModalMode('confirm');
    setConfirmConfig({
      confirmText: 'CONFIRM',
      cancelText: 'CANCEL',
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
    if (alertConfig.onPress) {
      alertConfig.onPress();
    }
  };

  const handleConfirmPress = () => {
    hideAlert();
    if (confirmConfig.onConfirm) {
      confirmConfig.onConfirm();
    }
  };

  const handleCancelPress = () => {
    hideAlert();
    if (confirmConfig.onCancel) {
      confirmConfig.onCancel();
    }
  };

  const handlePrivacyApprove = () => {
    hideAlert();
    if (privacyConfig.onApprove) {
      privacyConfig.onApprove();
    }
  };

  const handlePrivacyDecline = () => {
    hideAlert();
    if (privacyConfig.onDecline) {
      privacyConfig.onDecline();
    }
  };

  const getAlertIcon = () => {
    switch (alertConfig.type) {
      case 'success':
        return { name: 'checkmark-circle-outline' as const, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981' };
      case 'warning':
        return { name: 'pause-circle-outline' as const, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: '#F59E0B' };
      case 'error':
        return { name: 'alert-circle-outline' as const, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#EF4444' };
      default:
        return { name: 'information-circle-outline' as const, color: colors.accentGold, bg: 'rgba(212, 175, 55, 0.15)', border: colors.accentGold };
    }
  };

  const iconInfo = getAlertIcon();

  return (
    <LuxuryAlertContext.Provider value={{ showAlert, showConfirm, showPrivacyRequest, hideAlert }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={hideAlert}>
        <View style={styles.overlay}>
          {modalMode === 'alert' ? (
            /* Informational Alert Modal */
            <View style={[styles.card, { backgroundColor: '#12131A', borderColor: iconInfo.border }]}>
              <View style={[styles.topAccentBar, { backgroundColor: iconInfo.border }]} />

              <View style={[styles.iconCircle, { backgroundColor: iconInfo.bg }]}>
                <Ionicons name={iconInfo.name} size={32} color={iconInfo.color} />
              </View>

              <Text style={[styles.overline, { color: colors.accentGold }]}>CIRCLEGUARD SYSTEM NOTICE</Text>
              <Text style={styles.title}>{alertConfig.title.toUpperCase()}</Text>
              <Text style={styles.message}>{alertConfig.message}</Text>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#D4AF37' }]}
                onPress={handleAlertPress}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryBtnText, { color: '#0D0E12', fontWeight: '800' }]}>{alertConfig.buttonText || 'GOT IT'}</Text>
              </TouchableOpacity>
            </View>
          ) : modalMode === 'confirm' ? (
            /* Confirmation Dialog Modal */
            <View style={[styles.card, { backgroundColor: '#12131A', borderColor: confirmConfig.isDestructive ? '#EF4444' : colors.accentGold }]}>
              <View style={[styles.topAccentBar, { backgroundColor: confirmConfig.isDestructive ? '#EF4444' : colors.accentGold }]} />

              <View style={[styles.iconCircle, { backgroundColor: confirmConfig.isDestructive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(212, 175, 55, 0.15)' }]}>
                <Ionicons
                  name={confirmConfig.isDestructive ? 'trash-outline' : 'help-circle-outline'}
                  size={32}
                  color={confirmConfig.isDestructive ? '#EF4444' : colors.accentGold}
                />
              </View>

              <Text style={[styles.overline, { color: confirmConfig.isDestructive ? '#F87171' : colors.accentGold }]}>
                {confirmConfig.isDestructive ? 'CONFIRM PERMANENT ACTION' : 'CONFIRM ACTION'}
              </Text>
              <Text style={styles.title}>{confirmConfig.title.toUpperCase()}</Text>
              <Text style={styles.message}>{confirmConfig.message}</Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: confirmConfig.isDestructive ? '#DC2626' : colors.accentGold }]}
                  onPress={handleConfirmPress}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.confirmBtnText, { color: confirmConfig.isDestructive ? '#FFFFFF' : '#1A1A1A' }]}>
                    {confirmConfig.confirmText || 'CONFIRM'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: 'rgba(255, 255, 255, 0.2)' }]}
                  onPress={handleCancelPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>{confirmConfig.cancelText || 'CANCEL'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* User 1 <- User 2 Custom Privacy Permission Approval Modal */
            <View style={[styles.card, { backgroundColor: '#12131A', borderColor: '#F59E0B' }]}>
              <View style={[styles.topAccentBar, { backgroundColor: '#F59E0B' }]} />

              <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="shield-half" size={32} color="#F59E0B" />
              </View>

              <Text style={[styles.overline, { color: '#F59E0B' }]}>MEMBER PRIVACY PERMISSION REQUEST</Text>
              <Text style={styles.title}>PERMISSION REQUESTED BY {privacyConfig.requesterName.toUpperCase()}</Text>
              <Text style={styles.message}>
                {privacyConfig.requesterName} requested Circle Leader approval to activate <Text style={{ color: '#F59E0B', fontWeight: 'bold' }}>{privacyConfig.featureName}</Text>. As Circle Leader, do you authorize this privacy override?
              </Text>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#10B981' }]}
                  onPress={handlePrivacyApprove}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={[styles.confirmBtnText, { color: '#FFFFFF' }]}>APPROVE PERMISSION</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: '#EF4444' }]}
                  onPress={handlePrivacyDecline}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={[styles.cancelBtnText, { color: '#EF4444' }]}>DECLINE REQUEST</Text>
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
    backgroundColor: 'rgba(5, 5, 8, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 26,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 30,
    right: 30,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 6,
  },
  overline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 23,
    marginBottom: 10,
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
    color: '#D1D5DB',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 26,
    paddingHorizontal: 4,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  btnRow: {
    width: '100%',
    flexDirection: 'column',
    gap: 10,
  },
  confirmBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
