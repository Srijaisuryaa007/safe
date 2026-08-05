import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { generateInviteCode } from '../lib/utils';

export default function CreateCircleScreen() {
  const { colors } = useThemeStore();
  const [name, setName] = useState('');
  const [trackingMode, setTrackingMode] = useState<'continuous' | 'privacy'>('continuous');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigation = useNavigation<any>();
  const { profile, user } = useAuthStore();
  const { setActiveCircle } = useCircleStore();

  const userId = profile?.id || user?.id;

  const handleCreate = async () => {
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('Please enter a circle name.');
      return;
    }

    if (!userId) {
      setErrorMsg('User authentication session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const inviteCode = generateInviteCode();
      
      // 1. Create the circle with chosen tracking_mode
      const { data: circleData, error: circleError } = await supabase
        .from('circles')
        .insert([
          { 
            name: name.trim(),
            owner_id: userId,
            invite_code: inviteCode,
            tracking_mode: trackingMode,
          }
        ])
        .select()
        .single();

      if (circleError) throw circleError;

      // 2. Add creator as owner member
      const { error: memberError } = await supabase
        .from('circle_members')
        .insert([
          {
            circle_id: circleData.id,
            user_id: userId,
            role: 'owner'
          }
        ]);

      if (memberError) throw memberError;

      // 3. Fetch circle members and set active circle
      await useCircleStore.getState().fetchMembers(circleData.id);
      setActiveCircle(circleData as any);
      Alert.alert(
        'Circle Created',
        `Your circle "${circleData.name}" is ready with ${trackingMode === 'continuous' ? 'Continuous 24/7 Safety Tracking' : 'Privacy-First Disconnect'} mode!`
      );
      navigation.goBack();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create circle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.foreground} />
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.foreground }]}>Create a New Circle</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Family, Private Group, or Friends</Text>

      <View style={styles.form}>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        
        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>CIRCLE NAME</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          placeholder="e.g. My Family Circle"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>LOCATION TRACKING BEHAVIOR</Text>

        <TouchableOpacity
          style={[
            styles.modeCard,
            { backgroundColor: colors.surface, borderColor: trackingMode === 'continuous' ? colors.accentGold : colors.border }
          ]}
          onPress={() => setTrackingMode('continuous')}
          activeOpacity={0.8}
        >
          <View style={styles.modeCardHeader}>
            <Ionicons name="pulse" size={20} color={colors.accentGold} />
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>OPTION B: CONTINUOUS 24/7 TRACKING</Text>
            {trackingMode === 'continuous' ? <Ionicons name="checkmark-circle" size={18} color={colors.accentGold} /> : null}
          </View>
          <Text style={[styles.modeSubtext, { color: colors.textMuted }]}>
            Location sharing & geofence alerts continue running in the background even when members close or swipe away the app. Best for family & child safety tracking.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeCard,
            { backgroundColor: colors.surface, borderColor: trackingMode === 'privacy' ? colors.accentGold : colors.border }
          ]}
          onPress={() => setTrackingMode('privacy')}
          activeOpacity={0.8}
        >
          <View style={styles.modeCardHeader}>
            <Ionicons name="power-outline" size={20} color="#F59E0B" />
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>OPTION A: PRIVACY-FIRST DISCONNECT</Text>
            {trackingMode === 'privacy' ? <Ionicons name="checkmark-circle" size={18} color={colors.accentGold} /> : null}
          </View>
          <Text style={[styles.modeSubtext, { color: colors.textMuted }]}>
            Location tracking automatically disconnects and stops sharing when members close or swipe away the app. Shows member status as Offline when app is closed.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.accentGold }]} 
          onPress={handleCreate} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1A1A1A" />
          ) : (
            <Text style={styles.buttonText}>CREATE CIRCLE</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backBtn: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 28,
  },
  form: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  input: {
    padding: 16,
    borderWidth: 1,
    fontSize: 16,
  },
  modeCard: {
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    flex: 1,
  },
  modeSubtext: {
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
