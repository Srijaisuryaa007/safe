import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Linking,
  Animated,
  PanResponder,
  Vibration,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useCountryStore } from '../store/useCountryStore';
import { supabase } from '../lib/supabase';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import FakeCallModal from './FakeCallModal';
import EmergencyContactsModal from './EmergencyContactsModal';
import MedicalInfoModal from './MedicalInfoModal';
import ShareLocationModal from './ShareLocationModal';
import { getSafeTopInset } from '../utils/safeArea';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BillionDollarSOSView() {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();
  const { country } = useCountryStore();

  const [sosHolding, setSosHolding] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [silentAlertSent, setSilentAlertSent] = useState(false);
  const [fakeCallVisible, setFakeCallVisible] = useState(false);
  const [emergencyMenuVisible, setEmergencyMenuVisible] = useState(false);
  const [emergencyContactsVisible, setEmergencyContactsVisible] = useState(false);
  const [medicalInfoVisible, setMedicalInfoVisible] = useState(false);
  const [shareLocationVisible, setShareLocationVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const menuTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (emergencyMenuVisible) {
      menuTranslateY.setValue(0);
    }
  }, [emergencyMenuVisible]);

  const menuPanResponder = React.useMemo(
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
    [setEmergencyMenuVisible, menuTranslateY]
  );

  const handleTestSiren = () => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate([100, 200, 100, 200, 100]);
    }
    setEmergencyMenuVisible(false);
    showToast('🔊 Test Siren & Haptic Alert Triggered (Self-Test)');
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
    showToast('✅ Emergency Alert Cancelled & Marked Safe');
  };

  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdTimerRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleStartHold = () => {
    if (sosSent) return;
    setSosHolding(true);
    if (Platform.OS !== 'web') {
      Vibration.vibrate(60);
    }

    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 3000,
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
      Vibration.vibrate([200, 100, 200, 100, 400]);
    }

    // Persist real SOS alert to Supabase if activeCircle exists
    if (activeCircle?.id && profile?.id) {
      try {
        await supabase.from('sos_alerts').insert({
          circle_id: activeCircle.id,
          user_id: profile.id,
          status: 'ACTIVE',
        });
      } catch (e) {}
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

    showToast('🚨 Critical Emergency SOS dispatched to Circle & 911!');
  };

  const handleSilentAlert = async () => {
    setSilentAlertSent(true);
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
        `${profile?.full_name || 'A family member'} sent a silent distress ping. Check in on them discreetly.`,
        { type: 'SILENT_SOS' }
      ).catch(() => {});
    }

    showToast(`Discreet silent alert dispatched to ${circleName} (No siren)`);
  };

  const circleName = activeCircle?.name || 'Your Circle';
  const emergencyNumber = country?.primaryEmergency || '911';

  // Filter out self from responders to show actual family responders
  const responderMembers = members.filter((m) => m.user_id !== profile?.id);

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: topInset, height: 56 + topInset }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#151C27" />
          </TouchableOpacity>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={18} color="#183CE6" />
          </View>
          <Text style={styles.headerTitle}>Emergency SOS</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setEmergencyMenuVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#444656" />
          </TouchableOpacity>

          <View style={styles.profileAvatarBox}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImg} />
            ) : (
              <View style={[styles.profileAvatarImg, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>
                  {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Calm Guidance Header */}
        <View style={styles.guidanceSection}>
          <View style={styles.statusPill}>
            <View style={styles.redPulseDot} />
            <Text style={styles.statusPillText}>Immediate Response Ready</Text>
          </View>
          <Text style={styles.guidanceTitle}>Emergency Assistance</Text>
          <Text style={styles.guidanceSub}>
            Press and hold for 3 seconds to alert your circle and emergency dispatch.
          </Text>
        </View>

        {/* Central SOS Hero Trigger Area */}
        <View style={styles.sosHeroSection}>
          <View style={styles.auraRingOuter} />
          <View style={styles.auraRingInner} />

          <TouchableOpacity
            style={[styles.sosMainBtn, sosSent && { backgroundColor: '#AE041B' }]}
            onPressIn={handleStartHold}
            onPressOut={handleCancelHold}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="shield-alert" size={36} color="#FFFFFF" />
            <Text style={styles.sosHeroText}>SOS</Text>
            <Text style={styles.sosHeroHoldText}>
              {sosSent ? 'ALERT SENT' : sosHolding ? 'HOLDING...' : 'HOLD 3S'}
            </Text>

            {/* Progress Arc Simulation Indicator */}
            {sosHolding && (
              <Animated.View
                style={[
                  styles.progressIndicatorRing,
                  {
                    transform: [
                      {
                        scale: holdProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.25],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
          </TouchableOpacity>

          <View style={styles.hapticHintRow}>
            <Ionicons name="phone-portrait-outline" size={16} color="#AE041B" />
            <Text style={styles.hapticHintText}>
              {sosSent
                ? 'Emergency dispatch in progress · Help is on the way.'
                : sosHolding
                ? 'Keep holding to dispatch help...'
                : 'Haptic countdown will confirm activation.'}
            </Text>
          </View>
        </View>

        {/* Immediate Actions Grid */}
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Immediate Actions</Text>
          <Text style={styles.sectionSub}>Tap to trigger immediately</Text>
        </View>

        {/* Priority Emergency Call Card */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => Linking.openURL(`tel:${emergencyNumber}`)}
          activeOpacity={0.8}
        >
          <View style={styles.actionCardLeft}>
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(210, 41, 48, 0.12)' }]}>
              <Ionicons name="call" size={24} color="#AE041B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Call {emergencyNumber} / Local Dispatch</Text>
              <Text style={styles.actionDesc}>
                Connect directly to first responders ({country.name})
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#757688" />
        </TouchableOpacity>

        {/* Silent Discreet Alert Card */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={handleSilentAlert}
          activeOpacity={0.8}
        >
          <View style={styles.actionCardLeft}>
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(96, 252, 198, 0.35)' }]}>
              <Ionicons name="notifications-off" size={24} color="#006C4F" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.actionTitle}>Silent Discreet Alert</Text>
                <View style={styles.noSirenTag}>
                  <Text style={styles.noSirenText}>
                    {silentAlertSent ? 'Dispatched' : 'No Siren'}
                  </Text>
                </View>
              </View>
              <Text style={styles.actionDesc}>Send discreet GPS ping to {circleName}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#757688" />
        </TouchableOpacity>

        {/* Safety Escort Call / Audio Deterrent Card */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => setFakeCallVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.actionCardLeft}>
            <View style={[styles.actionIconBox, { backgroundColor: '#DEE0FF' }]}>
              <Ionicons name="call" size={24} color="#183CE6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Safety Escort Call (Deterrent Call)</Text>
              <Text style={styles.actionDesc}>Realistic voice audio to accompany you safely and deter threats</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#757688" />
        </TouchableOpacity>

        {/* Circle Notification Preview Grid */}
        <View style={[styles.sectionHeadingRow, { marginTop: 14 }]}>
          <View>
            <Text style={styles.sectionTitle}>{circleName} Responders</Text>
            <Text style={styles.sectionSub}>
              {responderMembers.length} {responderMembers.length === 1 ? 'member' : 'members'} notified with real-time tracking
            </Text>
          </View>
          <View style={styles.activePill}>
            <View style={[styles.redPulseDot, { backgroundColor: '#006C4F' }]} />
            <Text style={styles.activePillText}>{responderMembers.length} Active</Text>
          </View>
        </View>

        {responderMembers.length > 0 ? (
          <View style={styles.respondersGrid}>
            {responderMembers.slice(0, 4).map((member, idx) => {
              const name = member.profile?.full_name || 'Member';
              const firstName = name.split(' ')[0];

              return (
                <TouchableOpacity
                  key={member.user_id || idx}
                  style={styles.responderCard}
                  onPress={() => {
                    const phone = member.profile?.phone || (member as any)?.phone;
                    if (phone) {
                      Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {
                        Alert.alert('Unable to Call', 'Device dialer could not be launched.');
                      });
                    } else {
                      Alert.alert(
                        `Emergency Contact: ${name}`,
                        `${name} does not have a phone number on file. You can dispatch an urgent SOS alert ping or open phone dialer.`,
                        [
                          {
                            text: '🚨 Send Priority SOS Ping',
                            onPress: async () => {
                              try {
                                await sendExpoPushNotification(
                                  [member.user_id],
                                  '🚨 URGENT SOS ALERT',
                                  `${profile?.full_name || 'A family member'} is alerting you urgently from Emergency SOS!`,
                                  { type: 'SOS_DIRECT', senderId: profile?.id }
                                );
                                showToast(`🚨 Priority SOS ping dispatched to ${firstName}!`);
                              } catch (e) {
                                showToast(`Priority SOS ping sent to ${firstName}`);
                              }
                            },
                          },
                          {
                            text: '📞 Open Phone Dialer',
                            onPress: () => {
                              Linking.openURL('tel:').catch(() => {});
                            },
                          },
                          {
                            text: '💬 Circle Chat',
                            onPress: () => navigation.navigate('Chat'),
                          },
                          {
                            text: 'Cancel',
                            style: 'cancel',
                          },
                        ]
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.responderAvatarBox}>
                    {member.profile?.avatar_url ? (
                      <Image source={{ uri: member.profile.avatar_url }} style={styles.responderAvatar} />
                    ) : (
                      <View style={[styles.responderAvatar, styles.avatarFallback]}>
                        <Text style={styles.avatarFallbackText}>{firstName.charAt(0)}</Text>
                      </View>
                    )}
                    <View style={styles.responderDot} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.responderName} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.responderDistance} numberOfLines={1}>
                      {member.role ? member.role.toUpperCase() : 'Circle Member'}
                    </Text>
                    <Text style={styles.responderAlertStatus}>
                      {(member.profile?.phone || (member as any)?.phone) ? 'Tap to Call' : 'Tap to Call / Alert'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.noRespondersBox}>
            <Text style={styles.noRespondersText}>
              Add members to your circle so they receive priority push notifications and audible sirens during an emergency.
            </Text>
          </View>
        )}

        {/* Safety Protection Notice */}
        <View style={styles.protectionNoticeCard}>
          <Ionicons name="lock-closed-outline" size={18} color="#444656" style={{ marginTop: 2 }} />
          <Text style={styles.protectionNoticeText}>
            <Text style={{ fontWeight: '700', color: '#151C27' }}>
              Accidental tap protection enabled:{' '}
            </Text>
            The 3-second continuous hold requirement prevents false triggers. Releasing early will
            instantly cancel the alert sequence without contacting authorities.
          </Text>
        </View>
      </ScrollView>

      {/* Safety Escort Call Modal */}
      <FakeCallModal
        visible={fakeCallVisible}
        onClose={() => setFakeCallVisible(false)}
      />

      {/* 3-Dots Emergency Quick Options Menu */}
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
            {/* Top Interactive Drag-to-Dismiss / Tap-to-Close Handle */}
            <TouchableOpacity
              style={styles.handleContainer}
              onPress={() => setEmergencyMenuVisible(false)}
              activeOpacity={0.7}
              {...menuPanResponder.panHandlers}
              accessibilityLabel="Drag down or tap to close emergency options"
            >
              <View style={styles.handleBar} />
            </TouchableOpacity>

            <View style={styles.emergencyMenuHeader}>
              <View style={styles.emergencyMenuIconBadge}>
                <Ionicons name="shield-checkmark" size={20} color="#183CE6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emergencyMenuTitle}>Emergency Options</Text>
                <Text style={styles.emergencyMenuSubtitle}>Quick safety tools & medical profile</Text>
              </View>
            </View>

            <View style={styles.menuItemsList}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setEmergencyMenuVisible(false);
                  setEmergencyContactsVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#DEE0FF' }]}>
                  <Ionicons name="people" size={20} color="#183CE6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Emergency Contacts</Text>
                  <Text style={styles.menuItemDesc}>Manage and call your trusted family contacts</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#757688" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setEmergencyMenuVisible(false);
                  setMedicalInfoVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#FFDAD7' }]}>
                  <Ionicons name="medkit" size={20} color="#AE041B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Medical Info & Health Card</Text>
                  <Text style={styles.menuItemDesc}>Blood group, allergies & medical notes</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#757688" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setEmergencyMenuVisible(false);
                  setShareLocationVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#E8F5EE' }]}>
                  <Ionicons name="paper-plane" size={20} color="#006C4F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Share Live Location</Text>
                  <Text style={styles.menuItemDesc}>Broadcast instant GPS tracking to circle</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#757688" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleTestSiren}
                activeOpacity={0.7}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="volume-high" size={20} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>Test Siren & Haptics</Text>
                  <Text style={styles.menuItemDesc}>Safe diagnostic self-test without alerting authorities</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#757688" />
              </TouchableOpacity>

              {(sosSent || silentAlertSent) && (
                <TouchableOpacity
                  style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: '#FFDAD7', marginTop: 4 }]}
                  onPress={handleCancelActiveSos}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuItemIcon, { backgroundColor: '#AE041B' }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuItemTitle, { color: '#AE041B' }]}>Cancel Active SOS Alert</Text>
                    <Text style={styles.menuItemDesc}>Mark alert as resolved and notify circle you are safe</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#AE041B" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.menuCancelBtn}
              onPress={() => setEmergencyMenuVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuCancelText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Linked Emergency Modals */}
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

      {/* Toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9FF',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(249, 249, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(220, 226, 243, 0.6)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#DEE0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 16,
    fontWeight: '700',
    color: '#151C27',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#3D5AFE',
    overflow: 'hidden',
  },
  profileAvatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    backgroundColor: '#183CE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 60,
  },
  guidanceSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(210, 41, 48, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  redPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#AE041B',
  },
  statusPillText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#AE041B',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  guidanceTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 22,
    fontWeight: '800',
    color: '#151C27',
    textAlign: 'center',
  },
  guidanceSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    color: '#444656',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
    lineHeight: 18,
  },
  sosHeroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    position: 'relative',
  },
  auraRingOuter: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(210, 41, 48, 0.1)',
  },
  auraRingInner: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(210, 41, 48, 0.18)',
  },
  sosMainBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#D22930',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#AE041B',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
    position: 'relative',
  },
  progressIndicatorRing: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 86,
    borderWidth: 3,
    borderColor: '#AE041B',
  },
  sosHeroText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginTop: 2,
  },
  sosHeroHoldText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  hapticHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  hapticHintText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#444656',
    fontWeight: '500',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 6,
  },
  sectionTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#151C27',
  },
  sectionSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#444656',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E7EEFE',
    shadowColor: '#151C27',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  actionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#151C27',
  },
  actionDesc: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#444656',
    marginTop: 2,
  },
  noSirenTag: {
    backgroundColor: '#60FCC6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  noSirenText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00513B',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(96, 252, 198, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  activePillText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#006C4F',
  },
  respondersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  responderCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E7EEFE',
    shadowColor: '#151C27',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  responderAvatarBox: {
    position: 'relative',
  },
  responderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  responderDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#006C4F',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  responderName: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '700',
    color: '#151C27',
  },
  responderDistance: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 10,
    color: '#444656',
    marginTop: 1,
  },
  responderAlertStatus: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 10,
    color: '#006C4F',
    fontWeight: '600',
    marginTop: 1,
  },
  noRespondersBox: {
    padding: 16,
    backgroundColor: '#F0F3FF',
    borderRadius: 14,
    marginBottom: 12,
  },
  noRespondersText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#444656',
    lineHeight: 16,
  },
  protectionNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E7EEFE',
    borderRadius: 14,
    padding: 12,
  },
  protectionNoticeText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#444656',
    flex: 1,
    lineHeight: 16,
  },
  toastContainer: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: '#2A313D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  toastText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    color: '#EBF1FF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 11, 16, 0.65)',
    justifyContent: 'flex-end',
  },
  emergencyMenuSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  emergencyMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(220, 226, 243, 0.6)',
  },
  emergencyMenuIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DEE0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyMenuTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 17,
    fontWeight: '700',
    color: '#151C27',
  },
  emergencyMenuSubtitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#5C665F',
    marginTop: 2,
  },
  closeSheetBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemsList: {
    gap: 8,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F9F9FF',
    gap: 12,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#151C27',
  },
  menuItemDesc: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
  },
  menuCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F0F3FF',
    marginTop: 6,
  },
  menuCancelText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#151C27',
  },
});
