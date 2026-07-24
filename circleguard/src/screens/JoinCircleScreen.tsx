import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';

export default function JoinCircleScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { setActiveCircle } = useCircleStore();

  const handleJoin = async () => {
    setErrorMsg('');
    if (!code.trim() || code.length !== 6) {
      setErrorMsg('Please enter a valid 6-character invite code.');
      return;
    }

    if (!user) return;

    if (user.id === 'test-user') {
      const mockCircle = { id: 'mock-id-234', name: 'Mocked Family Circle', owner_id: 'some-other-id', invite_code: code.toUpperCase(), created_at: new Date().toISOString() };
      setActiveCircle(mockCircle as any);
      navigation.goBack();
      return;
    }

    setLoading(true);
    try {
      // 1. Find circle by code
      const { data: circleData, error: circleError } = await supabase
        .from('circles')
        .select('*')
        .eq('invite_code', code.toUpperCase())
        .single();

      if (circleError || !circleData) {
        throw new Error('Invalid or expired invite code.');
      }

      // 2. Check if already a member
      const { data: existingMember } = await supabase
        .from('circle_members')
        .select('*')
        .eq('circle_id', circleData.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        throw new Error('You are already a member of this circle.');
      }

      // 3. Join circle
      const { error: joinError } = await supabase
        .from('circle_members')
        .insert([
          {
            circle_id: circleData.id,
            user_id: user.id,
            role: 'member'
          }
        ]);

      if (joinError) throw joinError;

      setActiveCircle(circleData as any);
      navigation.goBack();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join circle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Cancel</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Join a Circle</Text>
      <Text style={styles.subtitle}>Enter the 6-character invite code</Text>

      <View style={styles.form}>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="e.g. A1B2C3"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          maxLength={6}
        />

        <TouchableOpacity style={styles.button} onPress={handleJoin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Join Circle</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
  },
  backBtn: {
    marginBottom: 24,
  },
  backText: {
    color: '#0066cc',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
  },
  form: {
    gap: 16,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: '#ffe6e6',
    padding: 12,
    borderRadius: 8,
    overflow: 'hidden',
    textAlign: 'center'
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#333',
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 4,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
