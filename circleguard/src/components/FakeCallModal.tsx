import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LUXURY_THEME } from '../constants/theme';

interface FakeCallModalProps {
  visible: boolean;
  onClose: () => void;
  callerName?: string;
}

export default function FakeCallModal({ visible, onClose, callerName = 'CIRCLEGUARD ESCORT' }: FakeCallModalProps) {
  const [callActive, setCallActive] = useState(false);
  const [timer, setTimer] = useState(0);

  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    if (visible && !callActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [visible, callActive]);

  useEffect(() => {
    let interval: any;
    if (callActive) {
      interval = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const handleAnswer = () => {
    setCallActive(true);
  };

  const handleEndCall = () => {
    setCallActive(false);
    onClose();
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.topInfo}>
          <Text style={styles.overline}>INCOMING ESCORT SAFETY CALL</Text>
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callStatus}>
            {callActive ? formatTimer(timer) : 'CircleGuard Auto Check-in Protocol'}
          </Text>
        </View>

        <View style={styles.avatarCenter}>
          <Animated.View style={[styles.avatarCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="shield-checkmark" size={64} color={LUXURY_THEME.colors.accentGold} />
          </Animated.View>
        </View>

        {callActive ? (
          <View style={styles.connectedBox}>
            <Ionicons name="pulse-outline" size={24} color={LUXURY_THEME.colors.accentGold} />
            <Text style={styles.connectedText}>"Security dispatch active. Your live location is monitored by your circle."</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {!callActive ? (
            <>
              <TouchableOpacity style={[styles.callBtn, styles.declineBtn]} onPress={handleEndCall}>
                <Ionicons name="call-outline" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={styles.btnLabel}>DECLINE</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.callBtn, styles.acceptBtn]} onPress={handleAnswer}>
                <Ionicons name="call" size={28} color="#FFFFFF" />
                <Text style={styles.btnLabel}>ANSWER</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.callBtn, styles.declineBtn, { width: 220 }]} onPress={handleEndCall}>
              <Ionicons name="call-outline" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.btnLabel}>END ESCORT CALL</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    padding: 32,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topInfo: {
    alignItems: 'center',
    marginTop: 60,
  },
  overline: {
    fontSize: 10,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 2,
    marginBottom: 8,
  },
  callerName: {
    fontSize: 28,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  callStatus: {
    fontSize: 14,
    color: LUXURY_THEME.colors.surfaceMuted,
  },
  avatarCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 140,
    height: 140,
    backgroundColor: '#262626',
    borderWidth: 2,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    padding: 16,
    marginHorizontal: 20,
  },
  connectedText: {
    color: '#FFFFFF',
    fontSize: 13,
    flex: 1,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 60,
    width: '100%',
  },
  callBtn: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  declineBtn: {
    backgroundColor: '#DC2626',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  btnLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 4,
  },
});
