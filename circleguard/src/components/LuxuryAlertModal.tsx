import React, { createContext, useContext, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
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

interface LuxuryAlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const LuxuryAlertContext = createContext<LuxuryAlertContextType>({
  showAlert: () => {},
  hideAlert: () => {},
});

export const useLuxuryAlert = () => useContext(LuxuryAlertContext);

export function LuxuryAlertProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useThemeStore();
  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertOptions>({
    title: '',
    message: '',
    type: 'info',
    buttonText: 'CONTINUE',
  });

  const showAlert = (options: AlertOptions) => {
    setAlertConfig({
      type: 'info',
      buttonText: 'GOT IT',
      ...options,
    });
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
    if (alertConfig.onPress) {
      alertConfig.onPress();
    }
  };

  const getAlertIcon = () => {
    switch (alertConfig.type) {
      case 'success':
        return { name: 'checkmark-circle-outline' as const, color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'warning':
        return { name: 'pause-circle-outline' as const, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'error':
        return { name: 'alert-circle-outline' as const, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      default:
        return { name: 'information-circle-outline' as const, color: colors.accentGold, bg: 'rgba(212, 175, 55, 0.15)' };
    }
  };

  const iconInfo = getAlertIcon();

  return (
    <LuxuryAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.goldLine} />

            <View style={styles.headerContainer}>
              <View style={[styles.iconCircle, { backgroundColor: iconInfo.bg }]}>
                <Ionicons name={iconInfo.name} size={32} color={iconInfo.color} />
              </View>

              <Text style={[styles.overline, { color: colors.textMuted }]}>
                {alertConfig.type === 'error' ? 'CRITICAL SYSTEM NOTICE' : alertConfig.type === 'warning' ? 'SYSTEM STATUS NOTICE' : 'CIRCLEGUARD NOTICE'}
              </Text>

              <Text style={[styles.title, { color: colors.foreground }]}>
                {alertConfig.title}
              </Text>
            </View>

            <Text style={[styles.message, { color: colors.textMuted }]}>
              {alertConfig.message}
            </Text>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accentGold }]}
              onPress={hideAlert}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>{alertConfig.buttonText || 'GOT IT'}</Text>
            </TouchableOpacity>
          </View>
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
    maxWidth: 380,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  goldLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#D4AF37',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  overline: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 26,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
