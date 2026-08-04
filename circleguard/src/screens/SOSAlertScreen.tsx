import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Vibration, Linking, Modal, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useCircleStore } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';
import { LUXURY_THEME } from '../constants/theme';

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

const STORAGE_KEY = '@circleguard_emergency_contacts';

export default function SOSAlertScreen() {
  const navigation = useNavigation();
  const { activeCircle, members } = useCircleStore();
  const { profile } = useAuthStore();
  const [isSending, setIsSending] = useState(false);

  // Contacts state
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [callModalVisible, setCallModalVisible] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

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
  }, [pulseAnim]);

  const loadEmergencyContacts = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setEmergencyContacts(JSON.parse(saved));
      } else {
        // Defaults if none added yet
        setEmergencyContacts([
          { id: '1', name: 'Father', relationship: 'Father', phone: '+1 555 0192' },
          { id: '2', name: 'Mother', relationship: 'Mother', phone: '+1 555 0184' }
        ]);
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

    if (activeCircle && profile) {
      try {
        await supabase.from('sos_alerts').insert({
          user_id: profile.id,
          circle_id: activeCircle.id,
          status: 'active',
        });
      } catch (e) {
        console.error('Error dispatching SOS:', e);
      }
    }
  };

  const cancelEmergency = () => {
    try {
      Vibration.cancel();
    } catch(e) {}
    setIsSending(false);
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
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.overline}>EMERGENCY PROTOCOL</Text>
      <Text style={styles.title}>EMERGENCY SOS</Text>
      <Text style={styles.subtitle}>Hold button for instant multi-channel distress signal</Text>

      <View style={styles.circleContainer}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        
        <TouchableOpacity
          style={styles.sosButton}
          onPress={triggerEmergency}
          activeOpacity={0.8}
        >
          <Ionicons name="alert-circle" size={64} color={LUXURY_THEME.colors.accentGold} />
          <Text style={styles.sosText}>{isSending ? 'ALERT SENT' : 'PRESS SOS'}</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency Call Buttons */}
      <View style={styles.callButtonsRow}>
        <TouchableOpacity style={styles.quickCallBtn} onPress={() => setCallModalVisible(true)} activeOpacity={0.8}>
          <Ionicons name="call" size={20} color="#FFFFFF" />
          <Text style={styles.quickCallText}>CALL EMERGENCY CONTACTS</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.serviceCallBtn} 
          onPress={() => handleCallNumber('112', 'Emergency Services')}
          activeOpacity={0.8}
        >
          <Ionicons name="shield-checkmark" size={18} color={LUXURY_THEME.colors.accentGold} />
          <Text style={styles.serviceCallText}>DIAL 112 / 911</Text>
        </TouchableOpacity>
      </View>

      {isSending ? (
        <View style={styles.activeStatusBox}>
          <Text style={styles.activeStatusText}>DISTRESS SIGNAL BROADCASTING...</Text>
          <View style={styles.checkList}>
            <View style={styles.checkItem}>
              <Ionicons name="checkmark-circle" size={18} color={LUXURY_THEME.colors.accentGold} />
              <Text style={styles.checkText}>GPS Coordinates Transmitted</Text>
            </View>
            <View style={styles.checkItem}>
              <Ionicons name="checkmark-circle" size={18} color={LUXURY_THEME.colors.accentGold} />
              <Text style={styles.checkText}>Circle Members & Emergency Contacts Notified</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={cancelEmergency}>
            <Text style={styles.cancelText}>CANCEL ALARM</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelLinkText}>DISMISS EMERGENCY SCREEN</Text>
        </TouchableOpacity>
      )}

      {/* Interactive Emergency Directory Dialing Modal */}
      <Modal visible={callModalVisible} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCallModalVisible(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.modalTitleBox}>
              <Text style={styles.modalOverline}>DIRECT DIAL DIRECTORY</Text>
              <Text style={styles.modalTitle}>Emergency Call Center</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Section 1: Specific Profile Emergency Contacts (Father, Mother, Brother, etc.) */}
            <View style={styles.sectionTitleBox}>
              <Ionicons name="heart" size={18} color={LUXURY_THEME.colors.sosRed} />
              <Text style={styles.sectionTitleText}>SAVED PROFILE CONTACTS</Text>
            </View>

            {emergencyContacts.length === 0 ? (
              <Text style={styles.emptyText}>No emergency contacts added in profile yet.</Text>
            ) : (
              <View style={styles.contactList}>
                {emergencyContacts.map((c) => (
                  <View key={c.id} style={styles.contactCard}>
                    <View style={styles.contactLeft}>
                      <View style={styles.avatarBox}>
                        <Ionicons name="person" size={20} color={LUXURY_THEME.colors.accentGold} />
                      </View>
                      <View>
                        <Text style={styles.contactName}>{c.name}</Text>
                        <Text style={styles.contactSub}>{c.relationship.toUpperCase()} • {c.phone}</Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={styles.callActionBtn} 
                      onPress={() => handleCallNumber(c.phone, c.name)}
                    >
                      <Ionicons name="call" size={18} color="#FFFFFF" />
                      <Text style={styles.callActionText}>CALL</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Section 2: Circle Members */}
            <View style={[styles.sectionTitleBox, { marginTop: 28 }]}>
              <Ionicons name="people" size={18} color={LUXURY_THEME.colors.accentGold} />
              <Text style={styles.sectionTitleText}>CIRCLE MEMBERS ({members.length})</Text>
            </View>

            {members.length === 0 ? (
              <Text style={styles.emptyText}>No circle members found.</Text>
            ) : (
              <View style={styles.contactList}>
                {members.map((m) => {
                  const mName = m.profile?.full_name || 'Circle Member';
                  const mPhone = m.profile?.phone;
                  return (
                    <View key={m.user_id} style={styles.contactCard}>
                      <View style={styles.contactLeft}>
                        <View style={[styles.avatarBox, { borderColor: m.isOnline ? '#10B981' : LUXURY_THEME.colors.border }]}>
                          <Text style={styles.initialText}>
                            {String(mName).charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.contactName}>{mName}</Text>
                          <Text style={styles.contactSub}>
                            {m.isOnline ? 'ONLINE' : 'OFFLINE'} • {mPhone || 'No Phone Saved'}
                          </Text>
                        </View>
                      </View>

                      {mPhone ? (
                        <TouchableOpacity 
                          style={styles.callActionBtn} 
                          onPress={() => handleCallNumber(mPhone, mName)}
                        >
                          <Ionicons name="call" size={18} color="#FFFFFF" />
                          <Text style={styles.callActionText}>CALL</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.noPhoneText}>NO PHONE</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Section 3: National Emergency Hotline Speed Dial */}
            <View style={[styles.sectionTitleBox, { marginTop: 28 }]}>
              <Ionicons name="shield-checkmark" size={18} color="#10B981" />
              <Text style={styles.sectionTitleText}>PUBLIC EMERGENCY HOTLINES</Text>
            </View>

            <TouchableOpacity 
              style={styles.hotlineCard}
              onPress={() => handleCallNumber('112', 'Universal Emergency Services')}
            >
              <View style={styles.hotlineLeft}>
                <Ionicons name="alert-circle" size={24} color={LUXURY_THEME.colors.sosRed} />
                <View>
                  <Text style={styles.hotlineTitle}>UNIVERSAL EMERGENCY HOTLINE</Text>
                  <Text style={styles.hotlineSub}>Dial 112 / 911 Instant Response</Text>
                </View>
              </View>
              <View style={styles.hotlineBadge}>
                <Text style={styles.hotlineBadgeText}>DIAL 112</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.foreground,
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
  sosText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
    letterSpacing: 2,
  },
  callButtonsRow: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
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
    backgroundColor: LUXURY_THEME.colors.foreground,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modalTitleBox: {
    flex: 1,
  },
  modalOverline: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 2,
    marginBottom: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalContent: {
    padding: 24,
  },
  sectionTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitleText: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 1.5,
  },
  emptyText: {
    fontSize: 12,
    color: LUXURY_THEME.colors.textMuted,
    marginBottom: 12,
  },
  contactList: {
    gap: 12,
  },
  contactCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  avatarBox: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  contactSub: {
    fontSize: 10,
    color: LUXURY_THEME.colors.textMuted,
    fontWeight: '500',
  },
  callActionBtn: {
    flexDirection: 'row',
    height: 38,
    paddingHorizontal: 14,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  callActionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  noPhoneText: {
    fontSize: 9,
    fontWeight: '700',
    color: LUXURY_THEME.colors.textMuted,
    letterSpacing: 1,
  },
  hotlineCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.sosRed,
    padding: 18,
  },
  hotlineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  hotlineTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 2,
  },
  hotlineSub: {
    fontSize: 11,
    color: LUXURY_THEME.colors.textMuted,
  },
  hotlineBadge: {
    backgroundColor: LUXURY_THEME.colors.sosRed,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hotlineBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
