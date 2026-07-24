import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function ProfileSetupScreen() {
  const { user, setProfile } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSaveProfile = async () => {
    setErrorMsg('');
    if (!fullName.trim()) {
      setErrorMsg('Full name is required.');
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([
          { 
            id: user.id, 
            full_name: fullName, 
            phone: phone || null 
          }
        ])
        .select()
        .single();

      if (error) {
        setErrorMsg(error.message);
      } else if (data) {
        setProfile(data); // This will update the store and navigate to Dashboard
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>Let your family know who you are</Text>

      <View style={styles.form}>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number (Optional)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <TouchableOpacity style={styles.button} onPress={handleSaveProfile} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save Profile</Text>
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
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 48,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
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
