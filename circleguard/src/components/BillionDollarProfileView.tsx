import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { getSafeTopInset } from '../utils/safeArea';

interface BillionDollarProfileViewProps {
  profile: any;
  userPhone: string;
  userEmail: string;
  userDob: string;
  uploading: boolean;
  imageError: boolean;
  setImageError: (val: boolean) => void;
  emergencyContact: { name: string; phone: string } | null;
  country: { name: string; flag: string; primaryEmergency: string };
  refreshing: boolean;
  onRefresh: () => void;
  onPickAvatar: () => void;
  onEditProfile: () => void;
  onOpenContacts: () => void;
  onPickContactFromPhone: () => void;
  onDeleteContact: () => void;
  onOpenMedical: () => void;
  onOpenCountry: () => void;
  onOpenAppearance: () => void;
  onOpenNotifications: () => void;
  onOpenPrivacy: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenLogout: () => void;
  onOpenDeleteAccount: () => void;
  showToast?: (msg: string) => void;
}

export default function BillionDollarProfileView({
  profile,
  userPhone,
  userEmail,
  userDob,
  uploading,
  imageError,
  setImageError,
  emergencyContact,
  country,
  refreshing,
  onRefresh,
  onPickAvatar,
  onEditProfile,
  onOpenContacts,
  onPickContactFromPhone,
  onDeleteContact,
  onOpenMedical,
  onOpenCountry,
  onOpenAppearance,
  onOpenNotifications,
  onOpenPrivacy,
  onOpenSettings,
  onOpenAbout,
  onOpenLogout,
  onOpenDeleteAccount,
  showToast,
}: BillionDollarProfileViewProps) {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);
  const { activeCircle, members } = useCircleStore();
  const { isDark } = useThemeStore();
  const navigation = useNavigation<any>();

  const [toastText, setToastText] = useState<string | null>(null);

  const displayToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => setToastText(null), 2500);
    if (showToast) showToast(msg);
  };

  const circleName = activeCircle?.name || 'My Circle';
  const inviteCode = activeCircle?.invite_code || '------';
  const isLeader = activeCircle?.owner_id === profile?.id;
  const initial = String(profile?.full_name || 'U').charAt(0).toUpperCase();

  const handleCopyCode = async () => {
    if (!inviteCode || inviteCode === '------') return;
    await Clipboard.setStringAsync(inviteCode);
    displayToast(`Circle invite code copied`);
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(10); } catch (_) {}
    }
    if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      const parent = navigation.getParent?.();
      if (parent && typeof parent.navigate === 'function') {
        parent.navigate('MainTabs', { screen: 'Circle' });
      } else if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate('MainTabs', { screen: 'Circle' });
      }
    }
  };

  // Color tokens
  const bgScreen = isDark ? '#000000' : '#F2F2F7';
  const bgCard = isDark ? '#101114' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#E5E5EA';
  const textPrimary = isDark ? '#FFFFFF' : '#000000';
  const textSecondary = isDark ? '#94A3B8' : '#8E8E93';
  const chevronColor = isDark ? '#475569' : '#C7C7CC';

  return (
    <View style={[styles.container, { backgroundColor: bgScreen }]}>
      {/* Navigation Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topInset,
            height: 52 + topInset,
            backgroundColor: bgScreen,
            borderBottomColor: borderColor,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#007AFF'} />
          <Text style={[styles.headerBackText, { color: isDark ? '#FFFFFF' : '#007AFF' }]}>Back</Text>
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: textPrimary }]}>Profile</Text>

        <TouchableOpacity
          style={styles.headerRightAction}
          onPress={onEditProfile}
          activeOpacity={0.7}
        >
          <Text style={[styles.headerActionText, { color: isDark ? '#30D158' : '#007AFF' }]}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#30D158' : '#007AFF'}
          />
        }
      >
        {/* Profile Identity Card */}
        <View style={[styles.accountCard, { backgroundColor: bgCard, borderColor }]}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={onPickAvatar}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {profile?.avatar_url && !imageError ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatarImg}
                onError={() => setImageError(true)}
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#1E2028' : '#E5E7EB' }]}>
                <Text style={[styles.avatarInitial, { color: isDark ? '#30D158' : '#10B981' }]}>
                  {initial}
                </Text>
              </View>
            )}

            <View style={[styles.cameraBadge, { backgroundColor: isDark ? '#30D158' : '#007AFF' }]}>
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={11} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.accountInfo}>
            <Text style={[styles.accountName, { color: textPrimary }]} numberOfLines={1}>
              {profile?.full_name || 'Family Member'}
            </Text>
            <Text style={[styles.accountContact, { color: textSecondary }]} numberOfLines={1}>
              {userPhone || userEmail}
            </Text>
            <View style={styles.roleBadgeRow}>
              <View style={[styles.rolePill, { backgroundColor: isDark ? 'rgba(48, 209, 88, 0.12)' : '#E8F5EE' }]}>
                <Text style={[styles.rolePillText, { color: isDark ? '#30D158' : '#059669' }]}>
                  {isLeader ? 'Circle Leader' : 'Circle Member'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editBtnChevron}
            onPress={onEditProfile}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={18} color={chevronColor} />
          </TouchableOpacity>
        </View>

        {/* Section 1: Safety & Emergency */}
        <Text style={[styles.sectionHeader, { color: textSecondary }]}>SAFETY & EMERGENCY</Text>
        <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
          {/* Emergency Contacts */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenContacts}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: '#FF3B30' }]}>
              <Ionicons name="call" size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>Emergency Contacts</Text>
            <Text style={[styles.rowDetail, { color: textSecondary }]} numberOfLines={1}>
              {emergencyContact ? emergencyContact.name : 'Not Set'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          {/* Regional Emergency Hotlines */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenCountry}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: '#007AFF' }]}>
              <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>Emergency Services</Text>
            <Text style={[styles.rowDetail, { color: textSecondary }]}>{country.name}</Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          {/* Medical Information */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenMedical}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: '#FF9500' }]}>
              <Ionicons name="medical" size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>Medical ID</Text>
            <Text style={[styles.rowDetail, { color: textSecondary }]}>Health Profile</Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>
        </View>

        {/* Section 2: Preferences */}
        <Text style={[styles.sectionHeader, { color: textSecondary }]}>PREFERENCES</Text>
        <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
          {/* Appearance */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenAppearance}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: '#AF52DE' }]}>
              <Ionicons name="color-palette" size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>Appearance</Text>
            <Text style={[styles.rowDetail, { color: textSecondary }]}>
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          {/* Notifications */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenNotifications}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: '#FF2D55' }]}>
              <Ionicons name="notifications" size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>Notifications & Alerts</Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          {/* Privacy & Security */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenPrivacy}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: '#34C759' }]}>
              <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>Privacy & Ghost Mode</Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          {/* App Settings */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenSettings}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: '#8E8E93' }]}>
              <Ionicons name="settings" size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>Settings</Text>
            <Text style={[styles.rowDetail, { color: textSecondary }]}>Units & GPS</Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>
        </View>

        {/* Section 3: Family Circle */}
        <Text style={[styles.sectionHeader, { color: textSecondary }]}>FAMILY CIRCLE</Text>
        <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
          <TouchableOpacity
            style={styles.tableRow}
            onPress={handleCopyCode}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: '#5856D6' }]}>
              <Ionicons name="people" size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>{circleName}</Text>
            <Text style={[styles.rowDetail, { color: isDark ? '#30D158' : '#007AFF' }]}>
              Code: {inviteCode}
            </Text>
            <Ionicons name="copy-outline" size={15} color={chevronColor} />
          </TouchableOpacity>
        </View>

        {/* Section 4: Application Info */}
        <Text style={[styles.sectionHeader, { color: textSecondary }]}>ABOUT</Text>
        <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenAbout}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: '#64748B' }]}>
              <Ionicons name="information-circle" size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>About CircleGuard</Text>
            <Text style={[styles.rowDetail, { color: textSecondary }]}>Version 1.2.0</Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>
        </View>

        {/* Section 5: Account Actions */}
        <Text style={[styles.sectionHeader, { color: textSecondary }]}>ACCOUNT</Text>
        <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenLogout}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: isDark ? '#27272A' : '#E4E4E7' }]}>
              <Ionicons name="log-out-outline" size={16} color={isDark ? '#F4F4F5' : '#18181B'} />
            </View>
            <Text style={[styles.rowTitle, { color: textPrimary }]}>Log Out</Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenDeleteAccount}
            activeOpacity={0.65}
          >
            <View style={[styles.rowIconSquircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </View>
            <Text style={[styles.rowTitle, { color: '#EF4444' }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Floating In-App Toast */}
      {toastText && (
        <View style={[styles.toastContainer, { backgroundColor: isDark ? '#1C1D22' : '#1F2937' }]}>
          <Ionicons name="checkmark-circle" size={16} color="#30D158" style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>{toastText}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '400',
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  headerRightAction: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  headerActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Account Card
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '700',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  accountContact: {
    fontSize: 13,
    marginTop: 2,
  },
  roleBadgeRow: {
    marginTop: 6,
    flexDirection: 'row',
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  editBtnChevron: {
    paddingLeft: 8,
  },

  // Grouped Table
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginLeft: 12,
    marginBottom: 6,
  },
  groupedTable: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowIconSquircle: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  rowDetail: {
    fontSize: 14,
    marginRight: 6,
    maxWidth: 140,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },

  // Toast
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
