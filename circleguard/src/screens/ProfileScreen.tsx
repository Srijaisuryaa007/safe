import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { LUXURY_THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';

// Modals
import EmergencyContactsModal from '../components/EmergencyContactsModal';
import MedicalInfoModal from '../components/MedicalInfoModal';
import AppearanceModal from '../components/AppearanceModal';
import PrivacySecurityModal from '../components/PrivacySecurityModal';
import NotificationsModal from '../components/NotificationsModal';
import SettingsModal from '../components/SettingsModal';
import AboutCircleGuardModal from '../components/AboutCircleGuardModal';
import LogoutModal from '../components/LogoutModal';

import SpringTouchable from '../components/SpringTouchable';

export default function ProfileScreen() {
  const { colors, isDark } = useThemeStore();
  const { profile, setProfile } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (profile?.id) {
      setRefreshing(true);
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
        if (data) setProfile(data);
      } catch(e) {}
      setRefreshing(false);
    }
  };

  // Modal Visibility State
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [medicalModalVisible, setMedicalModalVisible] = useState(false);
  const [appearanceModalVisible, setAppearanceModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handlePickAvatar = async () => {
    if (!profile) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Permission to access media library is required to update profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      setUploading(true);
      const uri = result.assets[0].uri;
      
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileName = `${profile.id}/${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: avatarUrl });
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      Alert.alert('Error', err.message || 'Failed to update profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const handleMenuPress = (label: string) => {
    switch (label) {
      case 'Emergency Contacts':
        setContactsModalVisible(true);
        break;
      case 'Medical Information':
        setMedicalModalVisible(true);
        break;
      case 'Appearance':
        setAppearanceModalVisible(true);
        break;
      case 'Phone & Notifications':
        setNotifModalVisible(true);
        break;
      case 'Settings':
        setSettingsModalVisible(true);
        break;
      case 'Privacy & Security':
        setPrivacyModalVisible(true);
        break;
      case 'About CircleGuard':
        setAboutModalVisible(true);
        break;
      default:
        Alert.alert(label, `${label} settings are up to date.`);
        break;
    }
  };

  const initial = String(profile?.full_name || 'U').charAt(0).toUpperCase();

  const menuItems = [
    { icon: 'call-outline', label: 'Emergency Contacts' },
    { icon: 'medical-outline', label: 'Medical Information' },
    { icon: 'notifications-outline', label: 'Phone & Notifications' },
    { icon: 'settings-outline', label: 'Settings' },
    { icon: 'lock-closed-outline', label: 'Privacy & Security' },
    { icon: 'color-palette-outline', label: 'Appearance' },
    { icon: 'information-circle-outline', label: 'About CircleGuard' },
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accentGold]} tintColor={colors.accentGold} />
      }
    >
      {/* Profile Header Card */}
      <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 20 }]}>
        <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickAvatar} disabled={uploading}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.foreground }]}>
              <Text style={[styles.avatarText, { color: colors.background }]}>{initial}</Text>
            </View>
          )}
          <View style={[styles.cameraBadge, { backgroundColor: colors.accentGold }]}>
            {uploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        <Text style={[styles.name, { color: colors.foreground }]}>{profile?.full_name || 'User Profile'}</Text>
        {profile?.phone ? <Text style={[styles.phoneText, { color: colors.textMuted }]}>{profile.phone}</Text> : null}
        
        <View style={styles.goldBadge}>
          <Ionicons name="star" size={12} color={colors.accentGold} />
          <Text style={[styles.goldBadgeText, { color: colors.accentGold }]}>CIRCLEGUARD BLACK</Text>
        </View>
      </View>

      {/* Settings Menu List */}
      <View style={[styles.menuContainer, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16 }]}>
        {menuItems.map((item, index) => (
          <SpringTouchable 
            key={index} 
            style={[styles.menuItem, { borderBottomColor: index === menuItems.length - 1 ? 'transparent' : colors.border }]} 
            onPress={() => handleMenuPress(item.label)}
            scaleTo={0.97}
          >
            <View style={styles.menuLeft}>
              <Ionicons name={item.icon as any} size={20} color={colors.foreground} />
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </SpringTouchable>
        ))}
      </View>

      {/* Session & Account Security Action Cards */}
      <View style={styles.actionSectionContainer}>
        <Text style={[styles.actionSectionTitle, { color: colors.textMuted }]}>
          SESSION & ACCOUNT SECURITY
        </Text>

        <View style={styles.actionButtonsCol}>
          {/* Disconnect GPS Session Button */}
          <SpringTouchable
            style={[
              styles.actionBoxBtn,
              {
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
              },
            ]}
            onPress={() => setPrivacyModalVisible(true)}
            scaleTo={0.96}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.18)' }]}>
              <Ionicons name="radio-outline" size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionBtnTitle, { color: isDark ? '#FBBF24' : '#D97706' }]}>
                DISCONNECT GPS SESSION
              </Text>
              <Text style={[styles.actionBtnSub, { color: colors.textMuted }]}>
                Pause active live circle location broadcast
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
          </SpringTouchable>

          {/* Logout Account Button */}
          <SpringTouchable
            style={[
              styles.actionBoxBtn,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
              },
            ]}
            onPress={() => setLogoutModalVisible(true)}
            scaleTo={0.96}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.18)' }]}>
              <Ionicons name="power" size={20} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionBtnTitle, { color: '#EF4444' }]}>
                LOGOUT OF ACCOUNT
              </Text>
              <Text style={[styles.actionBtnSub, { color: colors.textMuted }]}>
                Sign out of Supabase profile session
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#EF4444" />
          </SpringTouchable>
        </View>
      </View>

      {/* Interactive Modals */}
      <EmergencyContactsModal 
        visible={contactsModalVisible} 
        onClose={() => setContactsModalVisible(false)} 
      />

      <MedicalInfoModal 
        visible={medicalModalVisible} 
        onClose={() => setMedicalModalVisible(false)} 
      />

      <AppearanceModal 
        visible={appearanceModalVisible} 
        onClose={() => setAppearanceModalVisible(false)} 
      />

      <PrivacySecurityModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
      />

      <NotificationsModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
      />

      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
      />

      <AboutCircleGuardModal
        visible={aboutModalVisible}
        onClose={() => setAboutModalVisible(false)}
      />

      <LogoutModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.background,
  },
  content: {
    padding: 20,
    paddingTop: 54,
    paddingBottom: 40,
  },
  headerCard: {
    alignItems: 'center',
    marginBottom: 24,
    borderRadius: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderWidth: 2,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LUXURY_THEME.colors.foreground,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 34,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 22,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
    color: LUXURY_THEME.colors.foreground,
    marginBottom: 4,
  },
  phoneText: {
    fontSize: 13,
    color: LUXURY_THEME.colors.textMuted,
    marginBottom: 12,
  },
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  goldBadgeText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  menuContainer: {
    backgroundColor: LUXURY_THEME.colors.surface,
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: LUXURY_THEME.colors.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: LUXURY_THEME.colors.foreground,
  },
  actionSectionContainer: {
    gap: 10,
    marginBottom: 20,
  },
  actionSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginLeft: 4,
  },
  actionButtonsCol: {
    gap: 10,
  },
  actionBoxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actionBtnSub: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 2,
  },
});
