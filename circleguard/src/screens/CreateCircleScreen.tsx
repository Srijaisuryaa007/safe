import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';

import { generateInviteCode } from '../lib/utils';

export default function CreateCircleScreen() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { setActiveCircle } = useCircleStore();

  const handleCreate = async () => {
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('Please enter a circle name.');
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const inviteCode = generateInviteCode();
      
      // 1. Create the circle
      const { data: circleData, error: circleError } = await supabase
        .from('circles')
        .insert([
          { 
            name: name,
            owner_id: user.id,
            invite_code: inviteCode
          }
        ])
        .select()
        .single();

      if (circleError) throw circleError;

      // 2. Add creator as member
      const { error: memberError } = await supabase
        .from('circle_members')
        .insert([
          {
            circle_id: circleData.id,
            user_id: user.id,
            role: 'owner'
          }
        ]);

      if (memberError) throw memberError;

      setActiveCircle(circleData as any);
      navigation.goBack();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create circle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Cancel</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Create a New Circle</Text>
      <Text style={styles.subtitle}>Family, Friends, or Coworkers</Text>

      <View style={styles.form}>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        
        <TextInput
          style={styles.input}
          placeholder="Circle Name (e.g. My Family)"
          value={name}
          onChangeText={setName}
        />

        <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Circle</Text>
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
    overflow: 'hidden'
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#333',
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
