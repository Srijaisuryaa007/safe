import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useCircleStore } from '../store/useCircleStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 38) : 24);
  const { activeCircle, members } = useCircleStore();
  const initial = String(profile?.full_name || 'U').charAt(0).toUpperCase();

  const [toastText, setToastText] = useState<string | null>(null);

  const displayToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => {
      setToastText(null);
    }, 2800);
    if (showToast) {
      showToast(msg);
    }
  };

  const circleName = activeCircle?.name || 'My Circle';
  const inviteCode = activeCircle?.invite_code || '------';

  const handleCopyCode = async () => {
    if (!inviteCode || inviteCode === '------') return;
    await Clipboard.setStringAsync(inviteCode);
    displayToast(`Circle code ${inviteCode} copied to clipboard!`);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topInset, height: 62 + topInset }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={19} color="#2E7D5B" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Profile & Settings</Text>
            <Text style={styles.headerSub}>Account · Security · Preferences</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.circleInviteBadge}
          onPress={handleCopyCode}
          activeOpacity={0.8}
        >
          <Ionicons name="key" size={13} color="#E07A5F" />
          <Text style={styles.circleInviteBadgeText}>{inviteCode}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D5B']} />
        }
      >
        {/* 1. Profile Identity Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            {/* Avatar with Camera Overlay */}
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={onPickAvatar}
              disabled={uploading}
              activeOpacity={0.85}
            >
              <View style={styles.avatarHalo} />
              {profile?.avatar_url && !imageError ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatarImg}
                  onError={() => setImageError(true)}
                />
              ) : (
                <View style={[styles.avatarImg, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>{initial}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>

            {/* User Title & Role */}
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {profile?.full_name || 'CircleGuard User'}
              </Text>
              <View style={styles.roleTagPill}>
                <View style={styles.roleTagDot} />
                <Text style={styles.roleTagText}>
                  {activeCircle?.owner_id === profile?.id ? 'CIRCLE LEADER' : 'VERIFIED MEMBER'}
                </Text>
              </View>
            </View>

            {/* Edit Profile Button */}
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={onEditProfile}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={16} color="#2E7D5B" />
            </TouchableOpacity>
          </View>

          {/* Contact Details Column */}
          <View style={styles.contactDetailsBox}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconSquircle}>
                <Ionicons name="call-outline" size={14} color="#2E7D5B" />
              </View>
              <Text style={styles.detailText}>{userPhone}</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIconSquircle}>
                <Ionicons name="mail-outline" size={14} color="#2E7D5B" />
              </View>
              <Text style={styles.detailText}>{userEmail}</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailIconSquircle, { backgroundColor: '#FFF3EB' }]}>
                <Ionicons name="calendar-outline" size={14} color="#E07A5F" />
              </View>
              <Text style={styles.detailText}>
                Date of Birth: {userDob || (profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '07/08/2004')}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Active Circle Status Banner */}
        <View style={styles.circleStatusCard}>
          <View style={styles.circleStatusLeft}>
            <View style={styles.circleIconBox}>
              <Ionicons name="people" size={18} color="#2E7D5B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.circleStatusTitle} numberOfLines={1}>
                {circleName}
              </Text>
              <Text style={styles.circleStatusSub}>
                {members.length} active family {members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.copyInviteBtn} onPress={handleCopyCode} activeOpacity={0.8}>
            <Ionicons name="copy-outline" size={13} color="#2E7D5B" />
            <Text style={styles.copyInviteText}>Code: {inviteCode}</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Primary Emergency Responder Card */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>PRIMARY EMERGENCY RESPONDER</Text>
        </View>

        <View style={styles.emergencyCard}>
          <View style={styles.emergencyCardLeft}>
            <View style={styles.emergencyIconBox}>
              <Ionicons name="shield" size={18} color="#E07A5F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyCardTitle}>
                {emergencyContact ? emergencyContact.name : 'No Primary Contact Set'}
              </Text>
              <Text style={styles.emergencyCardSub}>
                {emergencyContact ? emergencyContact.phone : 'Designate contact for 1-tap dispatch'}
              </Text>
            </View>
          </View>

          <View style={styles.emergencyActions}>
            {emergencyContact ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={onPickContactFromPhone}
                  style={styles.actionIconBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil-outline" size={15} color="#2E7D5B" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onDeleteContact}
                  style={[styles.actionIconBtn, { backgroundColor: '#FFF3EB' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={15} color="#E07A5F" />
                </TouchableOpacity>

                <TouchableOpacity onPress={onOpenContacts} style={styles.chevronBtn}>
                  <Ionicons name="chevron-forward" size={16} color="#757688" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={onPickContactFromPhone}
                  style={styles.addEmergencyBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={14} color="#E07A5F" />
                  <Text style={styles.addEmergencyText}>Add</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onOpenContacts} style={styles.chevronBtn}>
                  <Ionicons name="chevron-forward" size={16} color="#757688" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* 4. Grouped Settings Menus */}
        {/* Section: SAFETY & MEDICAL PROTOCOLS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>SAFETY & MEDICAL PROTOCOLS</Text>
        </View>

        <View style={styles.menuGroupCard}>
          {/* Emergency Contacts */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={onOpenContacts}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconSquircle, { backgroundColor: '#FFF3EB' }]}>
                <Ionicons name="call-outline" size={18} color="#E07A5F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Emergency Contacts</Text>
                <Text style={styles.menuItemDesc}>Manage priority responders & notification chimes</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8E9992" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Regional Emergency Hotlines */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={onOpenCountry}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconSquircle, { backgroundColor: '#E8F5EE' }]}>
                <Ionicons name="globe-outline" size={18} color="#2E7D5B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>
                  Emergency Hotlines ({country.flag} {country.name})
                </Text>
                <Text style={styles.menuItemDesc}>Local dispatch: {country.primaryEmergency}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8E9992" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Medical Information */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={onOpenMedical}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconSquircle, { backgroundColor: '#E8F5EE' }]}>
                <Ionicons name="medical-outline" size={18} color="#2E7D5B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Medical Information</Text>
                <Text style={styles.menuItemDesc}>Blood type, allergies, conditions & first responder ID</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8E9992" />
          </TouchableOpacity>
        </View>

        {/* Section: SYSTEM & PREFERENCES */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>SYSTEM & PREFERENCES</Text>
        </View>

        <View style={styles.menuGroupCard}>
          {/* Appearance & Theme */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={onOpenAppearance}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconSquircle, { backgroundColor: '#FFF3EB' }]}>
                <Ionicons name="color-palette-outline" size={18} color="#E07A5F" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.menuItemTitle}>Appearance & Theme</Text>
                  <View style={styles.billionDollarPill}>
                    <Text style={styles.billionDollarPillText}>BILLION DOLLAR UI</Text>
                  </View>
                </View>
                <Text style={styles.menuItemDesc}>Pine Emerald, Terracotta Peach, map styles</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8E9992" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Notifications */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={onOpenNotifications}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconSquircle, { backgroundColor: '#F0EFEA' }]}>
                <Ionicons name="notifications-outline" size={18} color="#1F2A24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Notifications & Alerts</Text>
                <Text style={styles.menuItemDesc}>Geofence entry/exit, battery warnings & pings</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8E9992" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Privacy & Security */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={onOpenPrivacy}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconSquircle, { backgroundColor: '#F0EFEA' }]}>
                <Ionicons name="lock-closed-outline" size={18} color="#1F2A24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Privacy & Security</Text>
                <Text style={styles.menuItemDesc}>Encrypted telemetry, ghost mode & app lock</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8E9992" />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* App Settings */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={onOpenSettings}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconSquircle, { backgroundColor: '#F0EFEA' }]}>
                <Ionicons name="settings-outline" size={18} color="#1F2A24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Settings</Text>
                <Text style={styles.menuItemDesc}>Distance units, GPS sync rate & local cache</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8E9992" />
          </TouchableOpacity>
        </View>

        {/* Section: APPLICATION INFO */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>APPLICATION INFO</Text>
        </View>

        <View style={styles.menuGroupCard}>
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={onOpenAbout}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconSquircle, { backgroundColor: '#E8F5EE' }]}>
                <Ionicons name="information-circle-outline" size={18} color="#2E7D5B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>About CircleGuard</Text>
                <Text style={styles.menuItemDesc}>Version 1.2.0 • Flagship Safety Platform</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8E9992" />
          </TouchableOpacity>
        </View>

        {/* Section: SESSION & ACCOUNT SECURITY */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>SESSION & ACCOUNT SECURITY</Text>
        </View>

        <View style={styles.actionButtonsCol}>
          {/* Logout Button */}
          <TouchableOpacity
            style={styles.actionBoxBtn}
            onPress={onOpenLogout}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="log-out-outline" size={18} color="#E07A5F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBtnTitle}>Log Out</Text>
              <Text style={styles.actionBtnSub}>Sign out of your session on this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#E07A5F" />
          </TouchableOpacity>

          {/* Delete Account Button */}
          <TouchableOpacity
            style={[styles.actionBoxBtn, styles.deleteActionBox]}
            onPress={onOpenDeleteAccount}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionBtnTitle, { color: '#DC2626' }]}>Delete Account</Text>
              <Text style={styles.actionBtnSub}>Permanently erase your account and telemetry data</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Floating In-App Toast */}
      {toastText && (
        <View style={styles.toastContainer}>
          <Ionicons name="checkmark-circle" size={15} color="#2E7D5B" style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>{toastText}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(250, 249, 246, 0.97)',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#5C665F',
    marginTop: 1,
  },
  circleInviteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF3EB',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFD7C7',
  },
  circleInviteBadgeText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#E07A5F',
    letterSpacing: 0.5,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    marginBottom: 14,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  avatarWrapper: {
    position: 'relative',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHalo: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#2E7D5B',
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarFallback: {
    backgroundColor: '#2E7D5B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2E7D5B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.2,
  },
  roleTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  roleTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E7D5B',
  },
  roleTagText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D5B',
    letterSpacing: 0.4,
  },
  editProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactDetailsBox: {
    backgroundColor: '#FAF9F6',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIconSquircle: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#1F2A24',
    fontWeight: '500',
    flex: 1,
  },
  circleStatusCard: {
    backgroundColor: '#E8F5EE',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#C6E7D5',
  },
  circleStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  circleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleStatusTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2A24',
  },
  circleStatusSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#5C665F',
    marginTop: 1,
  },
  copyInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C6E7D5',
  },
  copyInviteText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  sectionHeaderRow: {
    marginBottom: 8,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  sectionHeaderTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#5C665F',
    letterSpacing: 0.6,
  },
  emergencyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    marginBottom: 14,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  emergencyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  emergencyIconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyCardTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2A24',
  },
  emergencyCardSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
  },
  emergencyActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronBtn: {
    paddingLeft: 4,
  },
  addEmergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF3EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FFD7C7',
  },
  addEmergencyText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#E07A5F',
  },
  menuGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEAE4',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIconSquircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2A24',
  },
  menuItemDesc: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F0EFEA',
    marginLeft: 66,
  },
  billionDollarPill: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  billionDollarPillText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 9,
    fontWeight: '800',
    color: '#2E7D5B',
    letterSpacing: 0.4,
  },
  actionButtonsCol: {
    gap: 10,
    marginTop: 4,
    marginBottom: 20,
  },
  actionBoxBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  deleteActionBox: {
    borderColor: '#FFD7C7',
    backgroundColor: '#FFF5F5',
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#E07A5F',
  },
  actionBtnSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#5C665F',
    marginTop: 2,
  },
  toastContainer: {
    position: 'absolute',
    top: 74,
    alignSelf: 'center',
    backgroundColor: '#1F2A24',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    color: '#FAF9F6',
    fontSize: 12,
    fontWeight: '600',
  },
});
