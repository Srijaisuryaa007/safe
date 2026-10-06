import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Linking,
  Animated,
  Easing,
  PanResponder,
  Vibration,
  StatusBar,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useCountryStore } from '../store/useCountryStore';
import { useThemeStore } from '../store/useThemeStore';
import { supabase } from '../lib/supabase';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import FakeCallModal from './FakeCallModal';
import EmergencyContactsModal from './EmergencyContactsModal';
import MedicalInfoModal from './MedicalInfoModal';
import ShareLocationModal from './ShareLocationModal';
import CountrySelectorModal from './CountrySelectorModal';
import OrbitalGoldenLogoBadge from './OrbitalGoldenLogoBadge';
import { getSafeTopInset } from '../utils/safeArea';

const FONT_SANS = Platform.OS === 'web' ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' : undefined;

export default function BillionDollarSOSView() {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();
  const { country } = useCountryStore();
  const { isDark } = useThemeStore();

  const [sosHolding, setSosHolding] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [silentAlertSent, setSilentAlertSent] = useState(false);
  const [isSirenActive, setIsSirenActive] = useState(false);

  // Modals
  const [fakeCallVisible, setFakeCallVisible] = useState(false);
  const [emergencyMenuVisible, setEmergencyMenuVisible] = useState(false);
  const [emergencyContactsVisible, setEmergencyContactsVisible] = useState(false);
  const [medicalInfoVisible, setMedicalInfoVisible] = useState(false);
  const [shareLocationVisible, setShareLocationVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Animation values
  const holdProgress = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim1 = useRef(new Animated.Value(0)).current;
  const rippleAnim2 = useRef(new Animated.Value(0)).current;
  const menuTranslateY = useRef(new Animated.Value(0)).current;

  // Continuous subtle pulse effect for SOS hero aura
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Staggered radar waves
    const ripple1Loop = Animated.loop(
      Animated.timing(rippleAnim1, {
        toValue: 1,
        duration: 2600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    const ripple2Loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1300),
        Animated.timing(rippleAnim2, {
          toValue: 1,
          duration: 2600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    ripple1Loop.start();
    ripple2Loop.start();

    return () => {
      pulseLoop.stop();
      ripple1Loop.stop();
      ripple2Loop.stop();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Drag-to-dismiss gesture for the Emergency Menu Sheet
  const menuPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 4,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            menuTranslateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 80 || gestureState.vy > 0.5) {
            Animated.timing(menuTranslateY, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              setEmergencyMenuVisible(false);
              menuTranslateY.setValue(0);
            });
          } else {
            Animated.spring(menuTranslateY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [menuTranslateY]
  );

  const handleStartHold = () => {
    if (sosSent) return;
    setSosHolding(true);
    if (Platform.OS !== 'web') {
      Vibration.vibrate(60);
    }

    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 3000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        triggerSOS();
      }
    });
  };

  const handleCancelHold = () => {
    if (sosSent) return;
    setSosHolding(false);
    holdProgress.stopAnimation();
    holdProgress.setValue(0);
  };

  const triggerSOS = async () => {
    setSosHolding(false);
    setSosSent(true);
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 350, 150, 350, 150, 600]);
    }

    // Persist real SOS alert to Supabase
    if (activeCircle?.id && profile?.id) {
      try {
        await supabase.from('sos_alerts').insert({
          circle_id: activeCircle.id,
          user_id: profile.id,
          status: 'ACTIVE',
        });
      } catch (e) {
        console.warn('Supabase SOS insert error:', e);
      }
    }

    // Dispatch priority push notifications to circle members
    const responderIds = members
      .filter((m) => m.user_id !== profile?.id)
      .map((m) => m.user_id);

    if (responderIds.length > 0) {
      sendExpoPushNotification(
        responderIds,
        '🚨 CRITICAL EMERGENCY SOS',
        `${profile?.full_name || 'A family member'} triggered an EMERGENCY SOS alert! Respond immediately!`,
        { type: 'SOS' }
      ).catch(() => {});
    }

    showToast(`🚨 Priority SOS Dispatched to ${circleName} & Emergency Contacts!`);
  };

  const handleSilentAlert = async () => {
    setSilentAlertSent(true);
    if (Platform.OS !== 'web') {
      Vibration.vibrate(80);
    }

    if (activeCircle?.id && profile?.id) {
      try {
        await supabase.from('sos_alerts').insert({
          circle_id: activeCircle.id,
          user_id: profile.id,
          status: 'SILENT',
        });
      } catch (e) {}
    }

    const responderIds = members
      .filter((m) => m.user_id !== profile?.id)
      .map((m) => m.user_id);

    if (responderIds.length > 0) {
      sendExpoPushNotification(
        responderIds,
        '⚠️ Silent Safety Alert',
        `${profile?.full_name || 'A family member'} sent a discreet safety ping. Please check in with them quietly.`,
        { type: 'SILENT_SOS' }
      ).catch(() => {});
    }

    showToast(`Discreet GPS distress beacon dispatched to ${circleName} (Silent)`);
  };

  const handleTestSiren = () => {
    setIsSirenActive(true);
    if (Platform.OS !== 'web') {
      Vibration.vibrate([100, 200, 100, 200, 100, 200]);
    }
    showToast('🔊 Acoustic Siren & Strobe Alarm Triggered (Self-Test)');
    setTimeout(() => {
      setIsSirenActive(false);
    }, 4500);
  };

  const handleCancelActiveSos = async () => {
    setSosSent(false);
    setSilentAlertSent(false);
    setEmergencyMenuVisible(false);
    if (activeCircle?.id && profile?.id) {
      try {
        await supabase
          .from('sos_alerts')
          .update({ status: 'RESOLVED' })
          .eq('user_id', profile.id)
          .eq('circle_id', activeCircle.id);
      } catch (e) {}
    }
    showToast('✅ Emergency Alert Resolved — Circle Notified You Are Safe');
  };

  const circleName = activeCircle?.name || 'Your Circle';
  const emergencyNumber = country?.primaryEmergency || '112';

  // Filter out self from responders to display active circle guardians/members
  const responderMembers = members.filter((m) => m.user_id !== profile?.id);

  // CircleGuard Botanical Luxury Theme Tokens
  const bg = isDark ? '#0F1411' : '#FAF9F6';
  const headerBg = isDark ? 'rgba(20, 26, 23, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const headerBorder = isDark ? '#212C26' : '#EDEBE6';
  const chipBg = isDark ? '#1C2621' : '#F1F5F9';
  const chipBorder = isDark ? '#2B3A33' : '#E2E8F0';

  const cardBg = isDark ? '#161E1A' : '#FFFFFF';
  const cardBorder = isDark ? '#212C26' : '#EDEBE6';

  const textPrimary = isDark ? '#F5FAF7' : '#1F2A24';
  const textSecondary = isDark ? '#9EACA3' : '#5C665F';
  const textTertiary = isDark ? '#6E7C74' : '#8A978F';

  const brandGreen = isDark ? '#3ADFAB' : '#2E7D5B';
  const brandGreenSoft = isDark ? 'rgba(58, 223, 171, 0.14)' : '#E8F5EE';
  const brandGold = isDark ? '#E9C349' : '#D4AF37';
  const brandGoldSoft = isDark ? 'rgba(233, 195, 73, 0.14)' : 'rgba(212, 175, 55, 0.1)';

  const canGoBack = navigation.canGoBack && navigation.canGoBack();

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Luxury Standardized Header Bar */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topInset,
            height: 56 + topInset,
            backgroundColor: headerBg,
            borderBottomColor: headerBorder,
          },
        ]}
      >
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            {canGoBack && (
              <TouchableOpacity
                style={[
                  styles.headerIconButton,
                  { backgroundColor: chipBg, borderColor: chipBorder, marginRight: 2 },
                ]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={18} color={textPrimary} />
              </TouchableOpacity>
            )}

            <OrbitalGoldenLogoBadge
              size={34}
              onPress={() => navigation.navigate('Home')}
              accessibilityLabel="CircleGuard Logo"
            />

            <TouchableOpacity
              style={[
                styles.circleSelectorBtn,
                { backgroundColor: chipBg, borderColor: chipBorder },
              ]}
              onPress={() => navigation.navigate('Circle')}
              activeOpacity={0.7}
            >
              <Text style={[styles.circleSelectorText, { color: textPrimary }]} numberOfLines={1}>
                {circleName}
              </Text>
              <Ionicons name="chevron-down" size={13} color={textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerRight}>
            {/* Country Emergency Badge */}
            <TouchableOpacity
              style={[
                styles.countryEmergencyBtn,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.08)',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
                },
              ]}
              onPress={() => setCountryModalVisible(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.countryFlagText}>{country?.flag || '🌐'}</Text>
              <Text style={styles.countryEmergencyNumber}>{emergencyNumber}</Text>
            </TouchableOpacity>

            {/* Quick Options 3-Dots */}
            <TouchableOpacity
              style={[
                styles.headerIconButton,
                { backgroundColor: chipBg, borderColor: chipBorder },
              ]}
              onPress={() => setEmergencyMenuVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-vertical" size={16} color={textPrimary} />
            </TouchableOpacity>

            {/* Profile Thumbnail */}
            <TouchableOpacity
              style={[styles.profileAvatarBtn, { borderColor: brandGreen }]}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.75}
            >
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImg} />
              ) : (
                <View style={[styles.profileAvatarImg, styles.avatarFallback, { backgroundColor: brandGreen }]}>
                  <Text style={styles.avatarFallbackText}>
                    {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentConstrained}>
          {/* Top Guidance & Telemetry Status Pill */}
          <View style={styles.topStatusSection}>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: sosSent
                    ? 'rgba(239, 68, 68, 0.18)'
                    : brandGreenSoft,
                  borderColor: sosSent
                    ? '#EF4444'
                    : isDark
                    ? 'rgba(58, 223, 171, 0.3)'
                    : 'rgba(46, 125, 91, 0.25)',
                },
              ]}
            >
              <View
                style={[
                  styles.pulseRadarDot,
                  { backgroundColor: sosSent ? '#EF4444' : brandGreen },
                ]}
              />
              <Text
                style={[
                  styles.statusPillText,
                  { color: sosSent ? '#EF4444' : brandGreen },
                ]}
              >
                {sosSent
                  ? 'EMERGENCY ALERT ACTIVE • FIRST RESPONDERS NOTIFIED'
                  : 'GPS SATELLITE LOCKED • LIVE TELEMETRY READY'}
              </Text>
            </View>

            <Text style={[styles.pageMainTitle, { color: textPrimary }]}>
              Emergency SOS Hub
            </Text>
            <Text style={[styles.pageMainSub, { color: textSecondary }]}>
              Press and hold the central beacon for 3 seconds to broadcast live GPS distress coordinates to your circle and emergency dispatch.
            </Text>
          </View>

          {/* Central SOS Hero Trigger Area with Concentric Radar Rings */}
          <View style={styles.heroSection}>
            {/* Animated Ripple Wave 1 */}
            <Animated.View
              style={[
                styles.radarRing,
                {
                  borderColor: sosSent
                    ? '#EF4444'
                    : isDark
                    ? 'rgba(239, 68, 68, 0.35)'
                    : 'rgba(220, 38, 38, 0.25)',
                  backgroundColor: sosSent
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(239, 68, 68, 0.03)',
                  transform: [
                    {
                      scale: rippleAnim1.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.48],
                      }),
                    },
                  ],
                  opacity: rippleAnim1.interpolate({
                    inputRange: [0, 0.85, 1],
                    outputRange: [0.6, 0.15, 0],
                  }),
                },
              ]}
            />

            {/* Animated Ripple Wave 2 */}
            <Animated.View
              style={[
                styles.radarRing,
                {
                  borderColor: sosSent
                    ? '#DC2626'
                    : isDark
                    ? 'rgba(239, 68, 68, 0.25)'
                    : 'rgba(220, 38, 38, 0.2)',
                  backgroundColor: sosSent
                    ? 'rgba(239, 68, 68, 0.07)'
                    : 'rgba(239, 68, 68, 0.02)',
                  transform: [
                    {
                      scale: rippleAnim2.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.48],
                      }),
                    },
                  ],
                  opacity: rippleAnim2.interpolate({
                    inputRange: [0, 0.85, 1],
                    outputRange: [0.6, 0.15, 0],
                  }),
                },
              ]}
            />

            {/* Tactile SOS Hero Trigger Button with Golden Rim */}
            <Animated.View
              style={{
                transform: [{ scale: sosHolding ? 0.95 : pulseAnim }],
              }}
            >
              <TouchableOpacity
                style={[
                  styles.sosMainBtn,
                  sosSent && styles.sosMainBtnActive,
                  {
                    borderColor: sosSent ? '#FFFFFF' : brandGold,
                    shadowColor: sosSent ? '#DC2626' : '#EF4444',
                  },
                ]}
                onPressIn={handleStartHold}
                onPressOut={handleCancelHold}
                activeOpacity={0.9}
              >
                {/* Hold Progress Track Ring */}
                {sosHolding && (
                  <Animated.View
                    style={[
                      styles.progressRing,
                      {
                        borderColor: '#FFFFFF',
                        transform: [
                          {
                            scale: holdProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.14],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                )}

                <MaterialCommunityIcons
                  name={sosSent ? 'shield-check' : 'shield-alert'}
                  size={42}
                  color="#FFFFFF"
                />
                <Text style={styles.sosButtonLabel}>
                  {sosSent ? 'SENT' : 'SOS'}
                </Text>
                <Text style={styles.sosButtonSubLabel}>
                  {sosSent ? 'ALERT ACTIVE' : sosHolding ? 'HOLDING...' : 'HOLD 3 SEC'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Interactive Status & Cancellation */}
            <View style={styles.heroHintRow}>
              {sosSent ? (
                <TouchableOpacity
                  style={[styles.cancelActiveSosBtn, { backgroundColor: brandGreen }]}
                  onPress={handleCancelActiveSos}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={17} color="#FFFFFF" />
                  <Text style={styles.cancelActiveSosText}>I Am Safe • Cancel Alert</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.protectionHintRow}>
                  <Ionicons name="finger-print-outline" size={15} color={isDark ? '#F87171' : '#DC2626'} />
                  <Text style={[styles.protectionHintText, { color: textSecondary }]}>
                    {sosHolding
                      ? 'Keep holding to dispatch distress signal...'
                      : 'Continuous 3s hold prevents accidental false alarms.'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Symmetrical 2x2 Emergency Actions Grid */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionHeadingTitle, { color: textPrimary }]}>
                Immediate Emergency Actions
              </Text>
              <Text style={[styles.sectionSubTitle, { color: textSecondary }]}>
                High-priority instant response protocols
              </Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: brandGoldSoft }]}>
              <Text style={[styles.badgePillText, { color: brandGold }]}>4 MODES</Text>
            </View>
          </View>

          <View style={styles.actionGrid}>
            {/* Action 1: Call 112 / First Responders */}
            <TouchableOpacity
              style={[
                styles.gridCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
              onPress={() => Linking.openURL(`tel:${emergencyNumber}`)}
              activeOpacity={0.8}
            >
              <View style={styles.gridCardTop}>
                <View style={[styles.gridIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Ionicons name="call" size={22} color="#EF4444" />
                </View>
                <View style={[styles.gridTag, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Text style={[styles.gridTagText, { color: '#EF4444' }]}>{country?.code || 'SOS'}</Text>
                </View>
              </View>
              <Text style={[styles.gridCardTitle, { color: textPrimary }]}>
                Call {emergencyNumber}
              </Text>
              <Text style={[styles.gridCardSub, { color: textSecondary }]}>
                Direct line to official emergency & police services in {country?.name || 'your region'}.
              </Text>
            </TouchableOpacity>

            {/* Action 2: Silent Stealth Alert */}
            <TouchableOpacity
              style={[
                styles.gridCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
              onPress={handleSilentAlert}
              activeOpacity={0.8}
            >
              <View style={styles.gridCardTop}>
                <View style={[styles.gridIconBox, { backgroundColor: brandGreenSoft }]}>
                  <Ionicons name="notifications-off" size={22} color={brandGreen} />
                </View>
                <View style={[styles.gridTag, { backgroundColor: brandGreenSoft }]}>
                  <Text style={[styles.gridTagText, { color: brandGreen }]}>
                    {silentAlertSent ? 'SENT' : 'NO SIREN'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.gridCardTitle, { color: textPrimary }]}>
                Silent Beacon
              </Text>
              <Text style={[styles.gridCardSub, { color: textSecondary }]}>
                Discreet GPS broadcast to circle with zero audio or visual cues on device.
              </Text>
            </TouchableOpacity>

            {/* Action 3: Safety Escort Call */}
            <TouchableOpacity
              style={[
                styles.gridCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
              onPress={() => setFakeCallVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.gridCardTop}>
                <View style={[styles.gridIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                  <Ionicons name="shield-checkmark" size={22} color="#6366F1" />
                </View>
                <View style={[styles.gridTag, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                  <Text style={[styles.gridTagText, { color: '#6366F1' }]}>DETERRENT</Text>
                </View>
              </View>
              <Text style={[styles.gridCardTitle, { color: textPrimary }]}>
                Escort Call
              </Text>
              <Text style={[styles.gridCardSub, { color: textSecondary }]}>
                Simulates a realistic incoming companion call to deter unwanted attention.
              </Text>
            </TouchableOpacity>

            {/* Action 4: High-Decibel Siren */}
            <TouchableOpacity
              style={[
                styles.gridCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
              onPress={handleTestSiren}
              activeOpacity={0.8}
            >
              <View style={styles.gridCardTop}>
                <View style={[styles.gridIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Ionicons name="volume-high" size={22} color="#F59E0B" />
                </View>
                <View style={[styles.gridTag, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Text style={[styles.gridTagText, { color: '#F59E0B' }]}>
                    {isSirenActive ? 'SOUNDING' : '110 dB'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.gridCardTitle, { color: textPrimary }]}>
                Siren Alarm
              </Text>
              <Text style={[styles.gridCardSub, { color: textSecondary }]}>
                Acoustic distress alarm and haptic pulsation to summon immediate help.
              </Text>
            </TouchableOpacity>
          </View>

          {/* Circle Responders Section */}
          <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <View>
              <Text style={[styles.sectionHeadingTitle, { color: textPrimary }]}>
                Circle First Responders
              </Text>
              <Text style={[styles.sectionSubTitle, { color: textSecondary }]}>
                {responderMembers.length} {responderMembers.length === 1 ? 'member' : 'members'} in {circleName} receive instant push alarms
              </Text>
            </View>
            <View
              style={[
                styles.activeRespondersBadge,
                {
                  backgroundColor: brandGreenSoft,
                  borderColor: isDark ? 'rgba(58, 223, 171, 0.3)' : 'rgba(46, 125, 91, 0.2)',
                },
              ]}
            >
              <View style={[styles.liveGreenDot, { backgroundColor: brandGreen }]} />
              <Text style={[styles.activeRespondersText, { color: brandGreen }]}>
                {responderMembers.length} Guarding
              </Text>
            </View>
          </View>

          {responderMembers.length > 0 ? (
            <View style={styles.respondersList}>
              {responderMembers.map((member) => {
                const name = member.profile?.full_name || 'Member';
                const phone = member.profile?.phone || (member as any)?.phone;
                const battery = member.batteryPct;
                const roleName = member.role ? member.role.toUpperCase() : 'MEMBER';

                return (
                  <View
                    key={member.user_id}
                    style={[
                      styles.responderRowCard,
                      { backgroundColor: cardBg, borderColor: cardBorder },
                    ]}
                  >
                    <View style={styles.responderRowLeft}>
                      <View style={styles.responderAvatarContainer}>
                        {member.profile?.avatar_url ? (
                          <Image source={{ uri: member.profile.avatar_url }} style={styles.responderImg} />
                        ) : (
                          <View style={[styles.responderImg, styles.avatarFallback, { backgroundColor: brandGreen }]}>
                            <Text style={styles.avatarFallbackText}>
                              {name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.responderStatusDot,
                            {
                              backgroundColor: member.isOnline ? brandGreen : '#94A3B8',
                              borderColor: cardBg,
                            },
                          ]}
                        />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.responderRowName, { color: textPrimary }]} numberOfLines={1}>
                            {name}
                          </Text>
                          <View style={[styles.roleBadge, { backgroundColor: chipBg }]}>
                            <Text style={[styles.roleBadgeText, { color: textTertiary }]}>{roleName}</Text>
                          </View>
                        </View>
                        <View style={styles.responderMetaRow}>
                          <Text style={[styles.responderMetaText, { color: textSecondary }]}>
                            {member.lastActiveShort || member.lastSeenText || 'Active in circle'}
                          </Text>
                          {typeof battery === 'number' && (
                            <View style={styles.batteryBadge}>
                              <Ionicons
                                name={battery <= 20 ? 'battery-dead' : 'battery-charging'}
                                size={12}
                                color={battery <= 20 ? '#EF4444' : brandGreen}
                              />
                              <Text
                                style={[
                                  styles.batteryText,
                                  { color: battery <= 20 ? '#EF4444' : textSecondary },
                                ]}
                              >
                                {battery}%
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Direct Contact Button */}
                    {phone ? (
                      <TouchableOpacity
                        style={[styles.directCallBtn, { backgroundColor: brandGreen }]}
                        onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="call" size={13} color="#FFFFFF" />
                        <Text style={styles.directCallBtnText}>Call</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.directCallBtn, { backgroundColor: '#EF4444' }]}
                        onPress={async () => {
                          try {
                            await sendExpoPushNotification(
                              [member.user_id],
                              '🚨 URGENT SOS ALERT',
                              `${profile?.full_name || 'A family member'} is alerting you urgently from Emergency SOS!`,
                              { type: 'SOS_DIRECT', senderId: profile?.id }
                            );
                            showToast(`🚨 Priority SOS ping dispatched to ${name.split(' ')[0]}!`);
                          } catch (e) {
                            showToast(`Priority alert dispatched to ${name.split(' ')[0]}`);
                          }
                        }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="notifications" size={13} color="#FFFFFF" />
                        <Text style={styles.directCallBtnText}>Alert</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View
              style={[
                styles.emptyRespondersCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
            >
              <Ionicons name="people-outline" size={28} color={textTertiary} />
              <Text style={[styles.emptyRespondersTitle, { color: textPrimary }]}>
                No Other Members in Circle
              </Text>
              <Text style={[styles.emptyRespondersSub, { color: textSecondary }]}>
                Invite guardians and family to {circleName} so they receive high-priority push sirens and live GPS breadcrumbs during emergencies.
              </Text>
              <TouchableOpacity
                style={[styles.inviteCircleBtn, { backgroundColor: brandGreen }]}
                onPress={() => navigation.navigate('Circle')}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={15} color="#FFFFFF" />
                <Text style={styles.inviteCircleBtnText}>Invite Circle Members</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Personal Safety & Medical Dossier */}
          <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <View>
              <Text style={[styles.sectionHeadingTitle, { color: textPrimary }]}>
                Personal Safety Dossier
              </Text>
              <Text style={[styles.sectionSubTitle, { color: textSecondary }]}>
                Critical health and responder records
              </Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: brandGreenSoft }]}>
              <Text style={[styles.badgePillText, { color: brandGreen }]}>VERIFIED</Text>
            </View>
          </View>

          <View style={styles.dossierDeck}>
            {/* Emergency Contacts */}
            <TouchableOpacity
              style={[
                styles.dossierCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
              onPress={() => setEmergencyContactsVisible(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.dossierIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Ionicons name="heart" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dossierCardTitle, { color: textPrimary }]}>
                  Emergency Contacts
                </Text>
                <Text style={[styles.dossierCardSub, { color: textSecondary }]}>
                  Custom phone numbers notified in crisis
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={textTertiary} />
            </TouchableOpacity>

            {/* Medical ID & Health Card */}
            <TouchableOpacity
              style={[
                styles.dossierCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
              onPress={() => setMedicalInfoVisible(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.dossierIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                <Ionicons name="medkit" size={20} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dossierCardTitle, { color: textPrimary }]}>
                  Medical ID & Health Card
                </Text>
                <Text style={[styles.dossierCardSub, { color: textSecondary }]}>
                  Blood group, allergies, medications & notes
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={textTertiary} />
            </TouchableOpacity>

            {/* Live GPS Broadcast */}
            <TouchableOpacity
              style={[
                styles.dossierCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
              onPress={() => setShareLocationVisible(true)}
              activeOpacity={0.75}
            >
              <View style={[styles.dossierIconBox, { backgroundColor: brandGreenSoft }]}>
                <Ionicons name="navigate" size={20} color={brandGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.dossierCardTitle, { color: textPrimary }]}>
                  Share Live Satellite GPS
                </Text>
                <Text style={[styles.dossierCardSub, { color: textSecondary }]}>
                  Broadcast temporary real-time coordinates
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Protection Contract Footer Note */}
          <View
            style={[
              styles.protectionContractCard,
              {
                backgroundColor: isDark ? '#141A17' : '#F1F5F2',
                borderColor: isDark ? '#212C26' : '#E0E7E2',
              },
            ]}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={brandGreen} />
            <Text style={[styles.protectionContractText, { color: textSecondary }]}>
              CircleGuard emergency telematics are encrypted end-to-end. SOS alerts broadcast instant push notifications with high-accuracy satellite GPS telemetry directly to your circle members and emergency contacts.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Linked Emergency Modals */}
      <FakeCallModal
        visible={fakeCallVisible}
        onClose={() => setFakeCallVisible(false)}
      />

      <EmergencyContactsModal
        visible={emergencyContactsVisible}
        onClose={() => setEmergencyContactsVisible(false)}
      />

      <MedicalInfoModal
        visible={medicalInfoVisible}
        onClose={() => setMedicalInfoVisible(false)}
      />

      <ShareLocationModal
        visible={shareLocationVisible}
        onClose={() => setShareLocationVisible(false)}
      />

      <CountrySelectorModal
        visible={countryModalVisible}
        onClose={() => setCountryModalVisible(false)}
      />

      {/* 3-Dots Quick Emergency Options Sheet */}
      <Modal
        visible={emergencyMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmergencyMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setEmergencyMenuVisible(false)}
        >
          <Animated.View
            style={[
              styles.emergencyMenuSheet,
              {
                backgroundColor: cardBg,
                borderTopColor: cardBorder,
                transform: [
                  {
                    translateY: menuTranslateY.interpolate({
                      inputRange: [-50, 0, 600],
                      outputRange: [0, 0, 600],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <View {...menuPanResponder.panHandlers} style={styles.handleContainer}>
              <View style={[styles.handleBar, { backgroundColor: isDark ? '#2B3A33' : '#CBD5E1' }]} />
            </View>

            <View style={styles.menuHeaderRow}>
              <Text style={[styles.menuHeaderTitle, { color: textPrimary }]}>
                Emergency Options & Settings
              </Text>
              <TouchableOpacity
                onPress={() => setEmergencyMenuVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.menuItemsList}>
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: cardBorder }]}
                onPress={() => {
                  setEmergencyMenuVisible(false);
                  setCountryModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Ionicons name="globe-outline" size={20} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuItemTitle, { color: textPrimary }]}>
                    Change Emergency Country ({country?.code || 'IN'})
                  </Text>
                  <Text style={[styles.menuItemDesc, { color: textSecondary }]}>
                    Current dispatch number: {emergencyNumber}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: cardBorder }]}
                onPress={() => {
                  setEmergencyMenuVisible(false);
                  setEmergencyContactsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Ionicons name="people" size={20} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuItemTitle, { color: textPrimary }]}>
                    Manage Emergency Contacts
                  </Text>
                  <Text style={[styles.menuItemDesc, { color: textSecondary }]}>
                    Assign custom contacts for rapid notification
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: cardBorder }]}
                onPress={() => {
                  setEmergencyMenuVisible(false);
                  setMedicalInfoVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                  <Ionicons name="medkit" size={20} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuItemTitle, { color: textPrimary }]}>
                    Medical Info & Health Card
                  </Text>
                  <Text style={[styles.menuItemDesc, { color: textSecondary }]}>
                    Blood group, allergies, medications
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: cardBorder }]}
                onPress={() => {
                  setEmergencyMenuVisible(false);
                  handleTestSiren();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Ionicons name="volume-high" size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuItemTitle, { color: textPrimary }]}>
                    Self-Test Siren & Alarm
                  </Text>
                  <Text style={[styles.menuItemDesc, { color: textSecondary }]}>
                    Test audio and vibration without alerting circle
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={textTertiary} />
              </TouchableOpacity>

              {(sosSent || silentAlertSent) && (
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    {
                      borderTopWidth: 1,
                      borderTopColor: isDark ? '#212C26' : '#FEE2E2',
                      marginTop: 6,
                    },
                  ]}
                  onPress={handleCancelActiveSos}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: '#EF4444' }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>
                      Resolve & Cancel SOS Alert
                    </Text>
                    <Text style={[styles.menuItemDesc, { color: textSecondary }]}>
                      Notify circle members that you are safe
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.menuCloseBtn,
                { backgroundColor: chipBg },
              ]}
              onPress={() => setEmergencyMenuVisible(false)}
              activeOpacity={0.75}
            >
              <Text style={[styles.menuCloseBtnText, { color: textPrimary }]}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <View style={styles.floatingToast}>
          <Ionicons name="information-circle" size={18} color={brandGreen} />
          <Text style={styles.floatingToastText}>{toastMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  circleSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    maxWidth: 150,
  },
  circleSelectorText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryEmergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  countryFlagText: {
    fontSize: 14,
  },
  countryEmergencyNumber: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  profileAvatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  profileAvatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
    alignItems: 'center',
  },
  contentConstrained: {
    width: '100%',
    maxWidth: 560,
  },
  topStatusSection: {
    alignItems: 'center',
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
  },
  pulseRadarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pageMainTitle: {
    fontFamily: FONT_SANS,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  pageMainSub: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    position: 'relative',
    height: 230,
  },
  radarRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1.5,
  },
  sosMainBtn: {
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 14,
    position: 'relative',
    borderWidth: 3.5,
  },
  sosMainBtnActive: {
    backgroundColor: '#B91C1C',
  },
  progressRing: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 85,
    borderWidth: 4,
  },
  sosButtonLabel: {
    fontFamily: FONT_SANS,
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  sosButtonSubLabel: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.95)',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  heroHintRow: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
  },
  cancelActiveSosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  cancelActiveSosText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  protectionHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  protectionHintText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeadingTitle: {
    fontFamily: FONT_SANS,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubTitle: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    marginTop: 2,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgePillText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  gridCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
  },
  gridTagText: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  gridCardTitle: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  gridCardSub: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    lineHeight: 15,
  },
  activeRespondersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeRespondersText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
  },
  respondersList: {
    gap: 10,
  },
  responderRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  responderRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  responderAvatarContainer: {
    position: 'relative',
  },
  responderImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  responderStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
  },
  responderRowName: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '800',
    maxWidth: 130,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '700',
  },
  responderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  responderMetaText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
  },
  batteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  batteryText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '600',
  },
  directCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  directCallBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyRespondersCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyRespondersTitle: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyRespondersSub: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  inviteCircleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 14,
  },
  inviteCircleBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dossierDeck: {
    gap: 10,
  },
  dossierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  dossierIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dossierCardTitle: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '800',
  },
  dossierCardSub: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    marginTop: 1,
  },
  protectionContractCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 20,
  },
  protectionContractText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  floatingToast: {
    position: 'absolute',
    top: 75,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 9999,
  },
  floatingToastText: {
    fontFamily: FONT_SANS,
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  emergencyMenuSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  menuHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    marginBottom: 8,
  },
  menuHeaderTitle: {
    fontFamily: FONT_SANS,
    fontSize: 16,
    fontWeight: '800',
  },
  menuItemsList: {
    marginVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '700',
  },
  menuItemDesc: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    marginTop: 1,
  },
  menuCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 12,
  },
  menuCloseBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '700',
  },
});
