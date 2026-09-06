import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Vibration, Linking, Modal, ScrollView, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { LUXURY_THEME, getThemeCardStyles, getThemeButtonStyles, getThemeBorderStyles } from '../constants/theme';
import SpringTouchable from '../components/SpringTouchable';
import JellySqueezeButton from '../components/JellySqueezeButton';
import { useCountryStore } from '../store/useCountryStore';
import CountrySelectorModal from '../components/CountrySelectorModal';

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

const STORAGE_KEY = '@circleguard_emergency_contacts';

export default function SOSAlertScreen() {
  const { colors, themeMode, isDark } = useThemeStore();
  const { country, countryCode } = useCountryStore();
  const navigation = useNavigation();
  const { activeCircle, members } = useCircleStore();
  const { profile } = useAuthStore();
  const [isSending, setIsSending] = useState(false);

  // Contacts and Country state
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const getStorageKey = () => profile?.id ? `@circleguard_emergency_contacts_${profile.id}` : '@circleguard_emergency_contacts';

  useEffect(() => {
    loadEmergencyContacts();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim, profile?.id]);

  const loadEmergencyContacts = async () => {
    try {
      const cloudContacts = (profile as any)?.emergency_contacts;
      if (Array.isArray(cloudContacts) && cloudContacts.length > 0) {
        setEmergencyContacts(cloudContacts);
        return;
      }

      const saved = await AsyncStorage.getItem(getStorageKey());
      if (saved) {
        setEmergencyContacts(JSON.parse(saved));
      } else {
        const fallbackSaved = await AsyncStorage.getItem('@circleguard_emergency_contacts');
        if (fallbackSaved) {
          setEmergencyContacts(JSON.parse(fallbackSaved));
        } else {
          setEmergencyContacts([]);
        }
      }
    } catch (e) {
      console.error('Error loading emergency contacts on SOS:', e);
    }
  };

  const triggerEmergency = async () => {
    setIsSending(true);
    try {
      Vibration.vibrate([0, 400, 200, 400], true);
    } catch(e) {}

    const userId = profile?.id || (useAuthStore.getState() as any).user?.id;

    if (activeCircle && userId) {
      try {
        // Insert into sos_alerts for guaranteed 0ms Supabase Realtime trigger across all circle members
        await supabase.from('sos_alerts').insert({
          user_id: userId,
          circle_id: activeCircle.id,
          status: 'active',
        });
      } catch (e) {
        console.error('Error dispatching SOS:', e);
      }
    }
  };

  const cancelEmergency = async () => {
    try {
      Vibration.cancel();
    } catch(e) {}
    setIsSending(false);

    if (activeCircle?.id && profile?.id) {
      try {
        await supabase
          .from('sos_alerts')
          .update({ status: 'resolved' })
          .eq('circle_id', activeCircle.id)
          .eq('user_id', profile.id)
          .eq('status', 'active');
      } catch (e) {}
    }

    navigation.goBack();
  };

  const handleCallNumber = (phone: string, name: string) => {
    if (!phone) {
      Alert.alert('No Phone Number', `No phone number available for ${name}.`);
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={28} color={colors.foreground} />
      </TouchableOpacity>

      <Text 
        style={[styles.overline, { color: themeMode === 'brand_green' ? '#3DBE6C' : colors.accentGold }]}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.8}
        numberOfLines={1}
      >
        EMERGENCY PROTOCOL
      </Text>
      <Text 
        style={[styles.title, { color: colors.foreground }]}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.75}
        numberOfLines={1}
      >
        EMERGENCY SOS
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Hold button for instant multi-channel distress signal
      </Text>

      <View style={styles.circleContainer}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              borderColor: colors.sosRed || '#EF4444',
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        
        <JellySqueezeButton
          style={[
            styles.sosButton,
            {
              backgroundColor: '#DC2626',
              borderColor: '#EF4444',
              shadowColor: '#DC2626',
            },
          ]}
          contentStyle={styles.sosButtonContent}
          onPress={triggerEmergency}
          glowColor="#DC2626"
        >
          <Text style={styles.sosTextLarge}>SOS</Text>
          <Text style={styles.sosSubPrompt}>
            {isSending ? 'ALERT SENT' : 'PRESS & HOLD'}
          </Text>
        </JellySqueezeButton>
      </View>

      <Text style={[styles.dispatchSubLabel, { color: colors.textMuted }]}>
        1-Tap Emergency Dispatch • Live Location Broadcasting
      </Text>

      {/* Stitch 2-Card Emergency Dispatch Grid */}
      <View style={styles.stitchDispatchGrid}>
        <TouchableOpacity
          style={[
            styles.stitchDispatchCard,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: isDark ? '#2C2C2E' : '#E2E8F0',
            },
          ]}
          onPress={() => {
            const policeNum = country.services?.find(s => s.category === 'police')?.number || country.primaryEmergency || '911';
            handleCallNumber(policeNum, `${country.name} Police`);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.dispatchIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <Ionicons name="shield" size={20} color="#3B82F6" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.dispatchCardTitle, { color: colors.foreground }]}>Police</Text>
            <Text style={[styles.dispatchCardSub, { color: colors.textMuted }]}>
              {country.services?.find(s => s.category === 'police')?.number || country.primaryEmergency || '911'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.stitchDispatchCard,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: isDark ? '#2C2C2E' : '#E2E8F0',
            },
          ]}
          onPress={() => {
            const medNum = country.services?.find(s => s.category === 'medical')?.number || country.primaryEmergency || '911';
            handleCallNumber(medNum, `${country.name} Ambulance`);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.dispatchIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Ionicons name="medical" size={20} color="#EF4444" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.dispatchCardTitle, { color: colors.foreground }]}>Ambulance</Text>
            <Text style={[styles.dispatchCardSub, { color: colors.textMuted }]}>
              {country.services?.find(s => s.category === 'medical')?.number || country.primaryEmergency || '911'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Emergency Contacts Button */}
      <SpringTouchable
        style={[
          styles.quickCallBtn,
          { backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9', borderColor: colors.border, marginTop: 12 },
        ]}
        onPress={() => setCallModalVisible(true)}
        scaleTo={0.96}
      >
        <Ionicons name="call-outline" size={18} color={colors.foreground} />
        <Text style={[styles.quickCallText, { color: colors.foreground }]}>
          CALL EMERGENCY CONTACTS ({emergencyContacts.length})
        </Text>
      </SpringTouchable>

      {isSending ? (
        <View style={[styles.activeStatusBox, getThemeCardStyles(themeMode), { backgroundColor: colors.surface, borderColor: colors.sosRed }]}>
          <Text 
            style={[styles.activeStatusText, { color: colors.sosRed }]}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}
            numberOfLines={1}
          >
            DISTRESS SIGNAL BROADCASTING...
          </Text>
          <View style={styles.checkList}>
            <View style={styles.checkItem}>
              <Ionicons name="checkmark-circle" size={18} color={themeMode === 'brand_green' ? '#3DBE6C' : colors.accentGold} />
              <Text style={[styles.checkText, { color: colors.foreground }]}>GPS Coordinates Transmitted</Text>
            </View>
            <View style={styles.checkItem}>
              <Ionicons name="checkmark-circle" size={18} color={themeMode === 'brand_green' ? '#3DBE6C' : colors.accentGold} />
              <Text style={[styles.checkText, { color: colors.foreground }]}>Circle Members & Emergency Contacts Notified</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} onPress={cancelEmergency}>
            <Text 
              style={[styles.cancelText, { color: colors.foreground }]}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
              numberOfLines={1}
            >
              CANCEL ALARM
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
          <Text 
            style={[styles.cancelLinkText, { color: colors.textMuted }]}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}
            numberOfLines={1}
          >
            DISMISS EMERGENCY SCREEN
          </Text>
        </TouchableOpacity>
      )}

      {/* Interactive Emergency Directory Dialing Modal */}
      <Modal visible={callModalVisible} animationType="slide" transparent={false}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity 
              onPress={() => setCallModalVisible(false)} 
              style={[
                styles.modalCloseBtn,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <View style={styles.modalTitleBox}>
              <Text style={[styles.modalOverline, { color: themeMode === 'brand_green' ? '#3DBE6C' : colors.accentGold }]}>DIRECT DIAL DIRECTORY</Text>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Emergency Call Center</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Section 1: Specific Profile Emergency Contacts */}
            <View style={styles.sectionTitleBox}>
              <Ionicons name="heart" size={17} color={LUXURY_THEME.colors.sosRed} />
              <Text style={styles.sectionTitleText}>SAVED PROFILE CONTACTS</Text>
            </View>

            {emergencyContacts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No emergency contacts added in profile yet.</Text>
            ) : (
              <View style={styles.contactList}>
                {emergencyContacts.map((c) => (
                  <View 
                    key={c.id} 
                    style={[
                      styles.contactCard,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                      }
                    ]}
                  >
                    <View style={styles.contactLeft}>
                      <View style={[styles.avatarBox, { backgroundColor: isDark ? 'rgba(233, 195, 73, 0.12)' : 'rgba(212, 175, 55, 0.12)', borderColor: colors.accentGold }]}>
                        <Ionicons name="person" size={18} color={colors.accentGold} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.contactName, { color: colors.foreground }]} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={[styles.contactSub, { color: colors.textMuted }]} numberOfLines={1}>
                          {c.relationship.toUpperCase()} • {c.phone}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={styles.callActionBtn} 
                      onPress={() => handleCallNumber(c.phone, c.name)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="call" size={15} color="#FFFFFF" />
                      <Text style={styles.callActionText}>CALL</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Section 2: Circle Members */}
            <View style={[styles.sectionTitleBox, { marginTop: 28 }]}>
              <Ionicons name="people" size={17} color={colors.accentGold} />
              <Text style={styles.sectionTitleText}>CIRCLE MEMBERS ({members.length})</Text>
            </View>

            {members.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No circle members found.</Text>
            ) : (
              <View style={styles.contactList}>
                {members.map((m) => {
                  const mName = m.profile?.full_name || 'Circle Member';
                  const mPhone = m.profile?.phone;
                  return (
                    <View 
                      key={m.user_id} 
                      style={[
                        styles.contactCard,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        }
                      ]}
                    >
                      <View style={styles.contactLeft}>
                        <View style={[styles.avatarBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9', borderColor: m.isOnline ? '#10B981' : colors.border }]}>
                          <Text style={[styles.initialText, { color: colors.foreground }]}>
                            {String(mName).charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.contactName, { color: colors.foreground }]} numberOfLines={1}>
                            {mName}
                          </Text>
                          <Text style={[styles.contactSub, { color: colors.textMuted }]} numberOfLines={1}>
                            {m.isOnline ? 'ONLINE' : 'OFFLINE'} • {mPhone || 'No Phone Saved'}
                          </Text>
                        </View>
                      </View>

                      {mPhone ? (
                        <TouchableOpacity 
                          style={styles.callActionBtn} 
                          onPress={() => handleCallNumber(mPhone, mName)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="call" size={15} color="#FFFFFF" />
                          <Text style={styles.callActionText}>CALL</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.noPhoneText, { color: colors.textMuted }]}>NO PHONE</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Section 3: National Emergency Hotline Speed Dial */}
            <View style={[styles.sectionTitleBox, { marginTop: 28, justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="shield-checkmark" size={17} color="#10B981" />
                <Text style={styles.sectionTitleText}>{country.name.toUpperCase()} EMERGENCY HOTLINES</Text>
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.1)' }}
                onPress={() => setCountryModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13 }}>{country.flag}</Text>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.accentGold }}>CHANGE</Text>
              </TouchableOpacity>
            </View>

            {country.services.map((srv) => {
              const badgeBg = srv.category === 'police' 
                ? 'rgba(59, 130, 246, 0.15)' 
                : (srv.category === 'medical' ? 'rgba(16, 185, 129, 0.15)' : (srv.category === 'fire' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(212, 175, 55, 0.15)'));
              const badgeText = srv.category === 'police' 
                ? '#3B82F6' 
                : (srv.category === 'medical' ? '#10B981' : (srv.category === 'fire' ? '#EF4444' : colors.accentGold));

              return (
                <TouchableOpacity 
                  key={srv.id}
                  style={[
                    styles.hotlineCard, 
                    { 
                      marginBottom: 10,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    }
                  ]}
                  onPress={() => handleCallNumber(srv.number, `${srv.name} (${srv.number})`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.hotlineLeft}>
                    <Ionicons 
                      name={(srv.icon || 'alert-circle') as any} 
                      size={20} 
                      color={badgeText} 
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.hotlineTitle, { color: colors.foreground }]}>{srv.name.toUpperCase()}</Text>
                      <Text style={[styles.hotlineSub, { color: colors.textMuted }]}>{srv.description}</Text>
                    </View>
                  </View>
                  <View style={[styles.hotlineBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.hotlineBadgeText, { color: badgeText }]}>DIAL {srv.number}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <CountrySelectorModal
        visible={countryModalVisible}
        onClose={() => setCountryModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0E12',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overline: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: LUXURY_THEME.colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  circleContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: LUXURY_THEME.colors.sosRed,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  sosButton: {
    width: 155,
    height: 155,
    borderRadius: 78,
    backgroundColor: LUXURY_THEME.colors.sosRed,
    borderWidth: 3,
    borderColor: LUXURY_THEME.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: LUXURY_THEME.colors.sosRed,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  sosButtonContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  sosTextLarge: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    includeFontPadding: false,
  },
  sosSubPrompt: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 2,
  },
  dispatchSubLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  stitchDispatchGrid: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  stitchDispatchCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dispatchIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  dispatchCardSub: {
    fontSize: 11,
    marginTop: 1,
  },
  quickCallBtn: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  quickCallText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  serviceCallBtn: {
    flexDirection: 'row',
    height: 44,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  serviceCallText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  activeStatusBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    padding: 20,
    alignItems: 'center',
  },
  activeStatusText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 16,
  },
  checkList: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkText: {
    color: '#E5E7EB',
    fontSize: 13,
  },
  cancelBtn: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  cancelLink: {
    padding: 8,
  },
  cancelLinkText: {
    color: LUXURY_THEME.colors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
  },

  /* Modal Styling */
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 42,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modalTitleBox: {
    flex: 1,
  },
  modalOverline: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitleText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#D4AF37',
  },
  emptyText: {
    fontSize: 12,
    marginBottom: 12,
  },
  contactList: {
    gap: 10,
  },
  contactCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  initialText: {
    fontSize: 16,
    fontWeight: '800',
  },
  contactName: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  contactSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  callActionBtn: {
    flexDirection: 'row',
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  callActionText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  noPhoneText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  hotlineCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  hotlineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  hotlineTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  hotlineSub: {
    fontSize: 11,
  },
  hotlineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  hotlineBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
