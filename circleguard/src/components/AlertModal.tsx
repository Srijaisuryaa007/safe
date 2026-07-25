import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  type: 'sos' | 'place';
  onClose: () => void;
}

export default function AlertModal({ visible, title, message, type, onClose }: AlertModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && type === 'sos') {
      // Vibrate repeatedly
      Vibration.vibrate([500, 500, 500, 500], true);

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      Vibration.cancel();
    }

    return () => {
      Vibration.cancel();
      pulseAnim.stopAnimation();
    };
  }, [visible, type]);

  if (!visible) return null;

  const isSOS = type === 'sos';
  const bgColor = isSOS ? 'rgba(255, 0, 0, 0.9)' : 'rgba(0, 102, 204, 0.9)';
  const iconName = isSOS ? 'warning' : 'location';

  return (
    <Modal transparent={true} visible={visible} animationType="fade">
      <View style={[styles.overlay, { backgroundColor: bgColor }]}>
        <Animated.View style={[styles.modalBox, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name={iconName} size={64} color={isSOS ? '#ff3333' : '#0066cc'} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: isSOS ? '#cc0000' : '#005bb5' }]} 
            onPress={onClose}
          >
            <Text style={styles.buttonText}>{isSOS ? 'Acknowledge' : 'Dismiss'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
