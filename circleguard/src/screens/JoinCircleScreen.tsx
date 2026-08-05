import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';

export default function JoinCircleScreen() {
  const { colors } = useThemeStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigation = useNavigation<any>();
  const { profile, user } = useAuthStore();
  const { setActiveCircle } = useCircleStore();

  const userId = profile?.id || user?.id;

  const handleJoin = async () => {
    setErrorMsg('');
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Please enter a valid 6-character invite code.');
      return;
    }

    if (!userId) {
      setErrorMsg('User authentication session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      // 1. Find circle by invite code
      const { data: circleData, error: circleError } = await supabase
        .from('circles')
        .select('*')
        .eq('invite_code', cleanCode)
        .single();

      if (circleError || !circleData) {
        throw new Error('Invalid or expired invite code. Please verify code with circle owner.');
      }

      // 2. Check if user is already a member
      const { data: existingMember } = await supabase
        .from('circle_members')
        .select('*')
        .eq('circle_id', circleData.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingMember) {
        // Already a member, just switch active circle
        await useCircleStore.getState().fetchMembers(circleData.id);
        setActiveCircle(circleData as any);
        Alert.alert('Circle Loaded', `Switched to "${circleData.name}".`);
        navigation.goBack();
        return;
      }

      // 3. Join circle
      const { error: joinError } = await supabase
        .from('circle_members')
        .insert([
          {
            circle_id: circleData.id,
            user_id: userId,
            role: 'member'
          }
        ]);

      if (joinError) {
        throw new Error(joinError.message || 'Failed to join circle.');
      }

      // 4. Fetch members and set active circle
      await useCircleStore.getState().fetchMembers(circleData.id);
      setActiveCircle(circleData as any);
      Alert.alert('Joined Circle!', `Successfully joined "${circleData.name}".`);
      navigation.goBack();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join circle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={colors.foreground} />
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.foreground }]}>Join a Circle</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Enter the 6-character private invite code</Text>

      <View style={styles.form}>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <TextInput
          style={[
            styles.input,
            styles.codeInput,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.accentGold }
          ]}
          placeholder="e.g. 8HGTT0"
          placeholderTextColor={colors.textMuted}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          maxLength={6}
        />

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.accentGold }]} 
          onPress={handleJoin} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1A1A1A" />
          ) : (
            <Text style={styles.buttonText}>JOIN CIRCLE</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
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
    marginBottom: 36,
  },
  form: {
    gap: 16,
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
  codeInput: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 6,
  },
  button: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});
