import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  Easing,
  PanResponder,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { humanizeUserAlert } from '../lib/errorHandler';

const SANS_FONT = Platform.OS === 'web' ? 'sans-serif' : undefined;

export type AlertType = 'success' | 'warning' | 'error' | 'info';

export interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  tag?: string;
  buttonText?: string;
  secondaryButtonText?: string;
  onPress?: () => void;
  onSecondaryPress?: () => void;
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

export interface InAppMessageOptions {
  title?: string;
  message: string;
  type?: AlertType;
  actionText?: string;
  onAction?: () => void;
  duration?: number;
}

interface LuxuryAlertContextType {
  showAlert: (options: AlertOptions) => void;
  showConfirm: (options: ConfirmOptions) => void;
  showPrivacyRequest: (options: PrivacyRequestOptions) => void;
  showToast: (message: string, type?: AlertType, title?: string) => void;
  showInAppMessage: (options: InAppMessageOptions) => void;
  hideAlert: () => void;
  hideToast: () => void;
}

const LuxuryAlertContext = createContext<LuxuryAlertContextType>({
  showAlert: () => {},
  showConfirm: () => {},
  showPrivacyRequest: () => {},
  showToast: () => {},
  showInAppMessage: () => {},
  hideAlert: () => {},
  hideToast: () => {},
});

export const useLuxuryAlert = () => useContext(LuxuryAlertContext);

export function LuxuryAlertProvider({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useThemeStore();
  const rawInsets = useSafeAreaInsets();
  const insets = rawInsets || { top: 0, bottom: 0, left: 0, right: 0 };
  const [visible, setVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'alert' | 'confirm' | 'privacy'>('alert');

  // Animation values for bottom sheet
  const slideAnim = useRef(new Animated.Value(340)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Floating in-app message & toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTitle, setToastTitle] = useState<string | null>(null);
  const [toastType, setToastType] = useState<AlertType>('info');
  const [toastAction, setToastAction] = useState<{ text: string; onAction: () => void } | null>(null);

  const toastAnim = useRef(new Animated.Value(-120)).current;
  const toastFade = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<any>(null);

  const [alertConfig, setAlertConfig] = useState<AlertOptions>({
    title: '',
    message: '',
    type: 'info',
    buttonText: 'Understood',
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

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(340);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 68,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const hideToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    Animated.parallel([
      Animated.timing(toastAnim, {
        toValue: -120,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(toastFade, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastMessage(null);
      setToastTitle(null);
      setToastAction(null);
    });
  };

  const showInAppMessage = (options: InAppMessageOptions) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const humanized = humanizeUserAlert(options.title, options.message, options.type);
    setToastTitle(options.title ? humanized.title : null);
    setToastMessage(humanized.message);
    setToastType(options.type || 'info');
    setToastAction(options.actionText && options.onAction ? { text: options.actionText, onAction: options.onAction } : null);

    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(40);
      } catch (_) {}
    }

    toastAnim.setValue(-100);
    toastFade.setValue(0);

    Animated.parallel([
      Animated.spring(toastAnim, {
        toValue: 0,
        tension: 72,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(toastFade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    const duration = options.duration || (options.title ? 4200 : 3500);
    toastTimerRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  };

  const showToast = (message: string, type: AlertType = 'info', title?: string) => {
    showInAppMessage({ message, type, title });
  };

  const showAlert = (options: AlertOptions) => {
    setModalMode('alert');
    const humanized = humanizeUserAlert(options.title, options.message, options.type);
    setAlertConfig({
      type: 'info',
      buttonText: humanized.isStorageIssue ? 'Got It' : 'Understood',
      ...options,
      title: humanized.title,
      message: humanized.message,
      tag: options.tag || humanized.tag,
    });
    setVisible(true);
  };

  const showConfirm = (options: ConfirmOptions) => {
    setModalMode('confirm');
    const humanized = humanizeUserAlert(options.title, options.message);
    setConfirmConfig({
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      isDestructive: false,
      ...options,
      title: humanized.title,
      message: humanized.message,
    });
    setVisible(true);
  };

  const showPrivacyRequest = (options: PrivacyRequestOptions) => {
    setModalMode('privacy');
    setPrivacyConfig(options);
    setVisible(true);
  };

  const hideAlert = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 340,
        duration: 180,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  // Intercept standard Alert.alert across the app
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
        const lowMsg = (message || '').toLowerCase();
        let alertType: AlertType = 'info';

        if (lowTitle.includes('error') || lowTitle.includes('failed') || lowTitle.includes('denied') || lowMsg.includes('error') || lowMsg.includes('failed')) {
          alertType = 'error';
        } else if (lowTitle.includes('warning') || lowTitle.includes('caution') || lowTitle.includes('limit') || lowMsg.includes('limit') || lowMsg.includes('free tier')) {
          alertType = 'warning';
        } else if (lowTitle.includes('created') || lowTitle.includes('success') || lowTitle.includes('joined') || lowTitle.includes('saved') || lowTitle.includes('copied')) {
          alertType = 'success';
        }

        showAlert({
          title: title || 'CircleGuard Notice',
          message: message || '',
          type: alertType,
          buttonText: singleBtn?.text || 'Understood',
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

  const handleAlertSecondaryPress = () => {
    hideAlert();
    if (alertConfig.onSecondaryPress) alertConfig.onSecondaryPress();
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

  // Plan Limit Detection
  const isPlanLimit =
    (alertConfig.message || '').toLowerCase().includes('free tier') ||
    (alertConfig.message || '').toLowerCase().includes('limit') ||
    (alertConfig.title || '').toLowerCase().includes('limit') ||
    (alertConfig.message || '').toLowerCase().includes('circle guard plus');

  const getAlertIcon = () => {
    if (isPlanLimit) {
      return {
        name: 'star' as const,
        color: isDark ? '#FBBF24' : '#D97706',
        bg: isDark ? 'rgba(251, 191, 36, 0.16)' : '#FEF3C7',
        tag: '• PLAN LIMIT',
      };
    }

    switch (alertConfig.type) {
      case 'success':
        return {
          name: 'checkmark-circle-outline' as const,
          color: isDark ? '#F8FAFC' : '#0F172A',
          bg: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
          tag: '• VERIFIED SUCCESS',
        };
      case 'warning':
        return {
          name: 'warning-outline' as const,
          color: isDark ? '#FBBF24' : '#D97706',
          bg: isDark ? 'rgba(251, 191, 36, 0.15)' : '#FEF3C7',
          tag: '• ATTENTION',
        };
      case 'error':
        return {
          name: 'shield-outline' as const,
          color: isDark ? '#F87171' : '#DC2626',
          bg: isDark ? 'rgba(248, 113, 113, 0.15)' : '#FEE2E2',
          tag: '• HELPFUL NOTICE',
        };
      case 'info':
      default:
        return {
          name: 'information-circle-outline' as const,
          color: isDark ? '#38BDF8' : '#0284C7',
          bg: isDark ? 'rgba(56, 189, 248, 0.15)' : '#E0F2FE',
          tag: '• CIRCLE NOTICE',
        };
    }
  };

  const iconInfo = getAlertIcon();

  const primaryBtnColor = () => {
    return isDark ? '#FFFFFF' : '#0F172A';
  };

  const getToastIconInfo = (type: AlertType) => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle' as const, color: isDark ? '#FFFFFF' : '#0F172A', bg: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' };
      case 'error':
        return { name: 'alert-circle' as const, color: '#EF4444', bg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2' };
      case 'warning':
        return { name: 'warning' as const, color: '#F59E0B', bg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7' };
      case 'info':
      default:
        return { name: 'information-circle' as const, color: '#38BDF8', bg: isDark ? 'rgba(56, 189, 248, 0.16)' : '#E0F2FE' };
    }
  };

  const toastIconMeta = getToastIconInfo(toastType);
  console.log('[LuxuryAlertProvider] render, children type:', typeof children);

  return (
    <LuxuryAlertContext.Provider
      value={{ showAlert, showConfirm, showPrivacyRequest, showToast, showInAppMessage, hideAlert, hideToast }}
    >
      {children}

      {/* Floating In-App Dynamic Island Notification Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.floatingToast,
            {
              top: Math.max(insets.top, 14) + 6,
              opacity: toastFade,
              transform: [{ translateY: toastAnim }],
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#EDEBE6',
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.toastInner}
            onPress={() => {
              if (toastAction) {
                toastAction.onAction();
              }
              hideToast();
            }}
            activeOpacity={0.9}
          >
            {/* Left Squircle Icon */}
            <View style={[styles.toastIconSquircle, { backgroundColor: toastIconMeta.bg }]}>
              <Ionicons name={toastIconMeta.name} size={18} color={toastIconMeta.color} />
            </View>

            {/* Middle Content */}
            <View style={{ flex: 1, marginRight: 8 }}>
              {toastTitle ? (
                <Text style={[styles.toastTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                  {toastTitle}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.toastMessageText,
                  {
                    color: toastTitle ? (isDark ? '#94A3B8' : '#64748B') : (isDark ? '#FFFFFF' : '#0F172A'),
                    fontWeight: toastTitle ? '500' : '700',
                  },
                ]}
                numberOfLines={2}
              >
                {toastMessage}
              </Text>
            </View>

            {/* Action Chip or Close */}
            {toastAction ? (
              <TouchableOpacity
                style={[styles.toastActionChip, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]}
                onPress={() => {
                  toastAction.onAction();
                  hideToast();
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.toastActionChipText, { color: isDark ? '#0F172A' : '#FFFFFF' }]}>{toastAction.text}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity onPress={hideToast} style={styles.toastCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color={isDark ? '#88988E' : '#9EACA3'} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Native Bottom Sheet Alert Dialog */}
      {visible && (
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={hideAlert}>
        <View style={styles.overlay}>
          {/* Backdrop Tap to Dismiss */}
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={hideAlert} activeOpacity={1} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheetCard,
              {
                backgroundColor: isDark ? '#11141A' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                transform: [{ translateY: slideAnim }],
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              },
            ]}
          >
            {/* Pill Drag Handle */}
            <View style={[styles.dragHandle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#CBD5E1' }]} />

            {modalMode === 'alert' ? (
              /* Authentic Alert View */
              <View style={styles.contentWrap}>
                {/* Header Row: Icon Squircle + Tag */}
                <View style={styles.headerRow}>
                  <View style={[styles.iconSquircle, { backgroundColor: iconInfo.bg }]}>
                    <Ionicons name={iconInfo.name} size={24} color={iconInfo.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.categoryTag, { color: iconInfo.color }]}>
                      {alertConfig.tag || iconInfo.tag}
                    </Text>
                    <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={2}>
                      {alertConfig.title}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={hideAlert}
                    style={[styles.closeCircleBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={17} color={isDark ? '#FFFFFF' : '#64748B'} />
                  </TouchableOpacity>
                </View>

                {/* Message Body Box */}
                <View
                  style={[
                    styles.messageBox,
                    alertConfig.type === 'error'
                      ? {
                          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
                          borderColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FECACA',
                        }
                      : alertConfig.type === 'warning' || isPlanLimit
                      ? {
                          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB',
                          borderColor: isDark ? 'rgba(245, 158, 11, 0.22)' : '#FDE68A',
                        }
                      : alertConfig.type === 'info'
                      ? {
                          backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : '#F0F9FF',
                          borderColor: isDark ? 'rgba(56, 189, 248, 0.22)' : '#BAE6FD',
                        }
                      : {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      alertConfig.type === 'error'
                        ? { color: isDark ? '#FCA5A5' : '#991B1B' }
                        : alertConfig.type === 'warning' || isPlanLimit
                        ? { color: isDark ? '#FCD34D' : '#92400E' }
                        : alertConfig.type === 'info'
                        ? { color: isDark ? '#7DD3FC' : '#0369A1' }
                        : { color: isDark ? '#CBD5E1' : '#475569' },
                    ]}
                  >
                    {alertConfig.message}
                  </Text>
                </View>

                {/* Action Buttons */}
                {isPlanLimit || alertConfig.secondaryButtonText ? (
                  <View style={styles.actionBtnRow}>
                    <TouchableOpacity
                      style={[
                        styles.secondaryActionBtn,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                        },
                      ]}
                      onPress={handleAlertSecondaryPress}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.secondaryActionBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {alertConfig.secondaryButtonText || 'Dismiss'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.confirmActionBtn, { backgroundColor: primaryBtnColor() }]}
                      onPress={handleAlertPress}
                      activeOpacity={0.84}
                    >
                      <Text style={[styles.primaryActionBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                        {alertConfig.buttonText || (isPlanLimit ? 'Explore Plus' : 'Understood')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: primaryBtnColor() }]}
                    onPress={handleAlertPress}
                    activeOpacity={0.84}
                  >
                    <Text style={[styles.primaryActionBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>{alertConfig.buttonText || 'Understood'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : modalMode === 'confirm' ? (
              /* Authentic Confirmation View */
              <View style={styles.contentWrap}>
                <View style={styles.headerRow}>
                  <View
                    style={[
                      styles.iconSquircle,
                      {
                        backgroundColor: confirmConfig.isDestructive
                          ? (isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEE2E2')
                          : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9'),
                        borderColor: confirmConfig.isDestructive
                          ? (isDark ? 'rgba(239, 68, 68, 0.28)' : '#FECACA')
                          : 'transparent',
                        borderWidth: confirmConfig.isDestructive ? 1 : 0,
                      },
                    ]}
                  >
                    <Ionicons
                      name={confirmConfig.isDestructive ? 'trash-outline' : 'help-circle-outline'}
                      size={24}
                      color={confirmConfig.isDestructive ? '#DC2626' : (isDark ? '#F8FAFC' : '#0F172A')}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.categoryTag,
                        { color: confirmConfig.isDestructive ? '#DC2626' : (isDark ? '#94A3B8' : '#64748B') },
                      ]}
                    >
                      {confirmConfig.isDestructive ? '• ACTION REQUIRED' : '• CONFIRMATION'}
                    </Text>
                    <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={2}>
                      {confirmConfig.title}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleCancelPress}
                    style={[styles.closeCircleBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={17} color={isDark ? '#FFFFFF' : '#64748B'} />
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.messageBox,
                    confirmConfig.isDestructive
                      ? {
                          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
                          borderColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#FECACA',
                        }
                      : {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      confirmConfig.isDestructive
                        ? { color: isDark ? '#FCA5A5' : '#991B1B' }
                        : { color: isDark ? '#CBD5E1' : '#475569' },
                    ]}
                  >
                    {confirmConfig.message}
                  </Text>
                </View>

                <View style={styles.actionBtnRow}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryActionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                      },
                    ]}
                    onPress={handleCancelPress}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.secondaryActionBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {confirmConfig.cancelText || 'Cancel'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.confirmActionBtn,
                      {
                        backgroundColor: confirmConfig.isDestructive
                          ? '#DC2626'
                          : (isDark ? '#FFFFFF' : '#0F172A'),
                      },
                    ]}
                    onPress={handleConfirmPress}
                    activeOpacity={0.84}
                  >
                    <Text style={[styles.primaryActionBtnText, { color: confirmConfig.isDestructive ? '#FFFFFF' : (isDark ? '#000000' : '#FFFFFF') }]}>{confirmConfig.confirmText || 'Confirm'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Authentic Privacy Request View */
              <View style={styles.contentWrap}>
                <View style={styles.headerRow}>
                  <View style={[styles.iconSquircle, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.16)' : '#E0F2FE' }]}>
                    <Ionicons name="shield-checkmark-outline" size={24} color={isDark ? '#38BDF8' : '#0284C7'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.categoryTag, { color: '#0284C7' }]}>• PRIVACY PERMISSION</Text>
                    <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Authorization Request</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handlePrivacyDecline}
                    style={[styles.closeCircleBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={17} color={isDark ? '#FFFFFF' : '#64748B'} />
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.messageBox,
                    {
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.08)' : '#F0F9FF',
                      borderColor: isDark ? 'rgba(56, 189, 248, 0.22)' : '#BAE6FD',
                    },
                  ]}
                >
                  <Text style={[styles.messageText, { color: isDark ? '#E0F2FE' : '#0369A1' }]}>
                    <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      {privacyConfig.requesterName}
                    </Text>{' '}
                    requested authorization to activate{' '}
                    <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      {privacyConfig.featureName}
                    </Text>
                    . As Circle Leader, do you authorize this permission?
                  </Text>
                </View>

                <View style={styles.actionBtnRow}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryActionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2',
                        borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA',
                      },
                    ]}
                    onPress={handlePrivacyDecline}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.secondaryActionBtnText, { color: '#DC2626' }]}>Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmActionBtn, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]}
                    onPress={handlePrivacyApprove}
                    activeOpacity={0.84}
                  >
                    <Text style={[styles.primaryActionBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>Authorize</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>
      )}
    </LuxuryAlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 999999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  sheetCard: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 22,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 24,
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  contentWrap: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconSquircle: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTag: {
    fontFamily: SANS_FONT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  title: {
    fontFamily: SANS_FONT,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  messageText: {
    fontFamily: SANS_FONT,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
  },
  primaryActionBtn: {
    width: '100%',
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryActionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontFamily: SANS_FONT,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  confirmActionBtn: {
    flex: 1.2,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  floatingToast: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999999,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 14,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  toastIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  toastTitleText: {
    fontFamily: SANS_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.1,
    marginBottom: 1,
  },
  toastMessageText: {
    fontFamily: SANS_FONT,
    fontSize: 13,
    lineHeight: 18,
  },
  toastActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 8,
  },
  toastActionChipText: {
    fontFamily: SANS_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  toastCloseBtn: {
    padding: 4,
    marginLeft: 4,
  },
});
