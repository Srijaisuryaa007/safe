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
    displayToast(`Circle code copied to clipboard`);
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

  // Ultra-clean design tokens
  const bgScreen = isDark ? '#000000' : '#F6F7F9';
  const bgCard = isDark ? '#0F1014' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const dividerColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#F0F2F5';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#6B7280';
  const textMuted = isDark ? '#64748B' : '#9CA3AF';
  const accentColor = isDark ? '#30D158' : '#059669';
  const chevronColor = isDark ? '#475569' : '#9CA3AF';

  return (
    <View style={[styles.container, { backgroundColor: bgScreen }]}>
      {/* Sleek Minimal Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topInset,
            height: 54 + topInset,
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
          <Text style={[styles.headerBackArrow, { color: textPrimary }]}>‹</Text>
          <Text style={[styles.headerBackText, { color: textPrimary }]}>Back</Text>
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: textPrimary }]}>Profile</Text>

        <TouchableOpacity
          style={styles.headerRightAction}
          onPress={onEditProfile}
          activeOpacity={0.7}
        >
          <Text style={[styles.headerActionText, { color: accentColor }]}>Edit</Text>
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
            tintColor={accentColor}
          />
        }
      >
        {/* User Monogram & Account Card */}
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
              <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#1C1E26' : '#E5E7EB' }]}>
                <Text style={[styles.avatarInitial, { color: accentColor }]}>
                  {initial}
                </Text>
              </View>
            )}

            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.accountInfo}>
            <Text style={[styles.accountName, { color: textPrimary }]} numberOfLines={1}>
              {profile?.full_name || 'Family Member'}
            </Text>
            <Text style={[styles.accountContact, { color: textSecondary }]} numberOfLines={1}>
              {userPhone || userEmail}
            </Text>
            <View style={styles.roleBadgeRow}>
              <View style={[styles.rolePill, { backgroundColor: isDark ? 'rgba(48, 209, 88, 0.12)' : '#ECFDF5' }]}>
                <Text style={[styles.rolePillText, { color: accentColor }]}>
                  {isLeader ? 'Circle Leader' : 'Verified Member'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.editPillBtn, { borderColor }]}
            onPress={onEditProfile}
            activeOpacity={0.7}
          >
            <Text style={[styles.editPillText, { color: textPrimary }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Section: Safety & Medical */}
        <Text style={[styles.sectionHeader, { color: textMuted }]}>SAFETY & MEDICAL</Text>
        <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
          {/* Emergency Contacts */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenContacts}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Emergency Contacts</Text>
              <Text style={[styles.rowSub, { color: textSecondary }]}>Designated family responders</Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.rowDetail, { color: textSecondary }]} numberOfLines={1}>
                {emergencyContact ? emergencyContact.name : 'Not set'}
              </Text>
              <Text style={[styles.chevronArrow, { color: chevronColor }]}>›</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          {/* Regional Emergency Services */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenCountry}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Emergency Services</Text>
              <Text style={[styles.rowSub, { color: textSecondary }]}>Local police, ambulance & fire</Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.rowDetail, { color: textSecondary }]}>{country.name}</Text>
              <Text style={[styles.chevronArrow, { color: chevronColor }]}>›</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          {/* Medical Information */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenMedical}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Medical Information</Text>
              <Text style={[styles.rowSub, { color: textSecondary }]}>Blood type, allergies & first response</Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.rowDetail, { color: textSecondary }]}>Medical ID</Text>
              <Text style={[styles.chevronArrow, { color: chevronColor }]}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Section: Preferences */}
        <Text style={[styles.sectionHeader, { color: textMuted }]}>PREFERENCES</Text>
        <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
          {/* Appearance */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenAppearance}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Appearance</Text>
              <Text style={[styles.rowSub, { color: textSecondary }]}>Theme, map style & display</Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.rowDetail, { color: textSecondary }]}>
                {isDark ? 'Dark' : 'Light'}
              </Text>
              <Text style={[styles.chevronArrow, { color: chevronColor }]}>›</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          {/* Notifications */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenNotifications}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Notifications</Text>
              <Text style={[styles.rowSub, { color: textSecondary }]}>Geofence alerts, arrival chimes & SOS</Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.rowDetail, { color: textSecondary }]}>Active</Text>
              <Text style={[styles.chevronArrow, { color: chevronColor }]}>›</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          {/* Privacy & Ghost Mode */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenPrivacy}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Privacy & Security</Text>
              <Text style={[styles.rowSub, { color: textSecondary }]}>Ghost Mode, telemetry & app lock</Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.rowDetail, { color: textSecondary }]}>Configured</Text>
              <Text style={[styles.chevronArrow, { color: chevronColor }]}>›</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          {/* App Settings */}
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenSettings}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: textPrimary }]}>System Settings</Text>
              <Text style={[styles.rowSub, { color: textSecondary }]}>Units of measure & GPS frequency</Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.rowDetail, { color: textSecondary }]}>Manage</Text>
              <Text style={[styles.chevronArrow, { color: chevronColor }]}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Section: Family Circle */}
        <Text style={[styles.sectionHeader, { color: textMuted }]}>FAMILY CIRCLE</Text>
        <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
          <TouchableOpacity
            style={styles.tableRow}
            onPress={handleCopyCode}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: textPrimary }]}>{circleName}</Text>
              <Text style={[styles.rowSub, { color: textSecondary }]}>
                {members.length} connected family {members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.rowDetail, { color: accentColor, fontWeight: '600' }]}>
                Code: {inviteCode}
              </Text>
              <Text style={[styles.chevronArrow, { color: chevronColor }]}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Section: About & Info */}
        <Text style={[styles.sectionHeader, { color: textMuted }]}>ABOUT</Text>
        <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenAbout}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: textPrimary }]}>About CircleGuard</Text>
              <Text style={[styles.rowSub, { color: textSecondary }]}>Version 1.2.0 • Family Safety Architecture</Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.chevronArrow, { color: chevronColor }]}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Section: Account Actions */}
        <Text style={[styles.sectionHeader, { color: textMuted }]}>ACCOUNT</Text>
        <View style={[styles.groupedTable, { backgroundColor: bgCard, borderColor }]}>
          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenLogout}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: textPrimary }]}>Log Out</Text>
              <Text style={[styles.rowSub, { color: textSecondary }]}>Sign out of your session on this device</Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.chevronArrow, { color: chevronColor }]}>›</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

          <TouchableOpacity
            style={styles.tableRow}
            onPress={onOpenDeleteAccount}
            activeOpacity={0.65}
          >
            <View style={styles.rowTextCol}>
              <Text style={[styles.rowTitle, { color: '#EF4444' }]}>Delete Account</Text>
              <Text style={[styles.rowSub, { color: isDark ? '#7F1D1D' : '#DC2626' }]}>
                Permanently erase data & membership
              </Text>
            </View>
            <View style={styles.rowRightCol}>
              <Text style={[styles.chevronArrow, { color: '#EF4444' }]}>›</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Floating In-App Toast */}
      {toastText && (
        <View style={[styles.toastContainer, { backgroundColor: isDark ? '#1C1D24' : '#1F2937' }]}>
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
  headerBackArrow: {
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 28,
    marginRight: 4,
  },
  headerBackText: {
    fontSize: 15,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  headerRightAction: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  headerActionText: {
    fontSize: 15,
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
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '700',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
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
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  editPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  editPillText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Grouped Table
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginLeft: 12,
    marginBottom: 8,
  },
  groupedTable: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 22,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  rowRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowDetail: {
    fontSize: 13,
    maxWidth: 120,
  },
  chevronArrow: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 18,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
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
    alignItems: 'center',
    justifyContent: 'center',
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
