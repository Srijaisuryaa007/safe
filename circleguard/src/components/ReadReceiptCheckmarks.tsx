import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ReadReceiptCheckmarksProps {
  isSent: boolean;
  isDelivered?: boolean;
  isReadByAll?: boolean;
  color?: string;
}

export default function ReadReceiptCheckmarks({
  isSent = true,
  isDelivered = true,
  isReadByAll = false,
  color,
}: ReadReceiptCheckmarksProps) {
  // Read by recipient / circle members: Double Checkmarks
  if (isReadByAll) {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-done-sharp" size={14} color="#38BDF8" />
      </View>
    );
  }

  // Delivered (Unread): Grey Double Checkmarks
  if (isDelivered) {
    return (
      <View style={styles.container}>
        <Ionicons name="checkmark-done-sharp" size={14} color={color || 'rgba(255, 255, 255, 0.75)'} />
      </View>
    );
  }

  // Sent: Single Grey Checkmark
  return (
    <View style={styles.container}>
      <Ionicons name="checkmark-sharp" size={13} color={color || 'rgba(255, 255, 255, 0.75)'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
});
