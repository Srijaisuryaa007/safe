import React from 'react';
import { View, StyleSheet } from 'react-native';
import BillionDollarTimelineView from '../components/BillionDollarTimelineView';

export default function ActivityScreen() {
  return (
    <View style={styles.container}>
      <BillionDollarTimelineView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
