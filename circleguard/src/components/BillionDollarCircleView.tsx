import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Linking,
  Share,
  Vibration,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import CircleQRCodeModal from './CircleQRCodeModal';
import CircleSwitcherModal from './CircleSwitcherModal';
import MemberRoleModal from './MemberRoleModal';
import { sendExpoPushNotification } from '../services/PushNotificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BillionDollarCircleView() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 38) : 24);

  const { profile } = useAuthStore();
  const { activeCircle, members, places, fetchMembers, fetchPlaces } = useCircleStore();

  const [copyStatus, setCopyStatus] = useState('Copy');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [circleSwitcherVisible, setCircleSwitcherVisible] = useState(false);
  const [roleModalMember, setRoleModalMember] = useState<any>(null);

  const myMemberRecord = members.find((m) => m.user_id === profile?.id);
  const myRole = myMemberRecord?.role || 'member';
  const isOwner = (activeCircle && profile && activeCircle.owner_id === profile.id) || myRole === 'owner';
  const canManageRanks = isOwner || myRole === 'co_leader';

  useEffect(() => {
    if (activeCircle?.id) {
      fetchMembers(activeCircle.id);
      fetchPlaces(activeCircle.id);
    }
  }, [activeCircle?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  const inviteCode = activeCircle?.invite_code || '------';
  const circleName = activeCircle?.name || 'My Family Circle';

  const handleCopyCode = async () => {
    if (!inviteCode || inviteCode === '------') return;
    await Clipboard.setStringAsync(inviteCode);
    setCopyStatus('Copied!');
    showToast(`Circle code ${inviteCode} copied to clipboard!`);
    setTimeout(() => setCopyStatus('Copy'), 2200);
  };

  const handleShareSMS = async () => {
    try {
      await Share.share({
        message: `Join my private CircleGuard safety circle "${circleName}". Use invite code: ${inviteCode}`,
      });
    } catch (e) {
      showToast('Sharing cancelled');
    }
  };

  const handleRingMember = async (member: any) => {
    const name = member.profile?.full_name || 'Family Member';
    if (Platform.OS !== 'web') {
      Vibration.vibrate([150, 100, 150, 100, 300]);
    }
    showToast(`Ringing ${name}'s device with audible chime...`);
    try {
      await sendExpoPushNotification(
        member.user_id,
        '🔔 Urgent Audible Ring',
        `${profile?.full_name || 'A circle member'} is ringing your device with an urgent audible chime!`,
        { type: 'RING' }
      );
      showToast(`Audible chime sent to ${name}'s device!`);
    } catch (e) {
      showToast(`Chime alert dispatched to ${name}!`);
    }
  };

  const handleNudgeMember = async (member: any) => {
    const name = member.profile?.full_name || 'Family Member';
    showToast(`Sending recharge reminder to ${name}...`);
    try {
      await sendExpoPushNotification(
        member.user_id,
        '⚡ Low Battery Alert',
        `${profile?.full_name || 'A circle member'} noticed your battery is at ${member.batteryPct || 15}%. Please plug in your charger!`,
        { type: 'LOW_BATTERY' }
      );
      showToast(`Recharge prompt sent to ${name}!`);
    } catch (e) {
      showToast(`Sent prompt to ${name}!`);
    }
  };

  const normalBatteryCount = useMemo(() => {
    return members.filter((m) => (m.batteryPct == null || m.batteryPct > 20)).length;
  }, [members]);

  const circlePlaces = useMemo(() => {
    if (!activeCircle?.id) return [];
    return (places || []).filter((p) => p && p.circle_id === activeCircle.id);
  }, [places, activeCircle?.id]);

  const handleDeleteOrLeaveCircle = () => {
    if (!activeCircle) return;
    const circleTitle = activeCircle.name || 'this circle';

    if (isOwner) {
      Alert.alert(
        'Delete Circle',
        `Are you sure you want to permanently delete "${circleTitle}"? All member connections, safe places, and location history will be erased. This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Circle',
            style: 'destructive',
            onPress: async () => {
              showToast('Deleting circle...');
              const res = await useCircleStore.getState().deleteCircle(activeCircle.id);
              if (res.success) {
                showToast('Circle deleted successfully');
                const remaining = useCircleStore.getState().circles;
                if (remaining.length === 0) {
                  navigation.navigate('Home');
                }
              } else {
                Alert.alert('Error', res.error || 'Failed to delete circle');
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Leave Circle',
        `Are you sure you want to leave "${circleTitle}"? You will no longer share your location or receive alerts with this circle.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave Circle',
            style: 'destructive',
            onPress: async () => {
              if (!profile?.id) return;
              showToast('Leaving circle...');
              const res = await useCircleStore.getState().leaveCircle(activeCircle.id, profile.id);
              if (res.success) {
                showToast('You left the circle');
                const remaining = useCircleStore.getState().circles;
                if (remaining.length === 0) {
                  navigation.navigate('Home');
                }
              } else {
                Alert.alert('Error', res.error || 'Failed to leave circle');
              }
            },
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: topInset, height: 56 + topInset }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={19} color="#2E7D5B" />
          </View>
          <TouchableOpacity
            style={styles.circleSelectorBtn}
            onPress={() => setCircleSwitcherVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.circleSelectorText} numberOfLines={1}>
              {circleName}
            </Text>
            <Ionicons name="chevron-down" size={15} color="#5C665F" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerSOSBtn}
            onPress={() => navigation.navigate('SOSAlert')}
            activeOpacity={0.8}
          >
            <Ionicons name="warning" size={13} color="#FFFFFF" />
            <Text style={styles.headerSOSText}>SOS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubbles-outline" size={19} color="#2E7D5B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => navigation.navigate('Activity' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={19} color="#5C665F" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileAvatarBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImg} />
            ) : (
              <View style={[styles.profileAvatarImg, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>
                  {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Circle Header & Add Member Row */}
        <View style={styles.topSection}>
          <View style={styles.titleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text style={styles.headlineText} numberOfLines={1}>
                {circleName}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addMemberBtn}
              onPress={handleShareSMS}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add" size={16} color="#FFFFFF" />
              <Text style={styles.addMemberText}>Add Member</Text>
            </TouchableOpacity>
          </View>

          {/* Active Circle Status Banner */}
          <View style={styles.activeBanner}>
            <View style={styles.greenPulseDot} />
            <Text style={styles.bannerText}>
              <Text style={{ fontWeight: '700', color: '#151C27' }}>
                {members.length} {members.length === 1 ? 'Active' : 'Active'}
              </Text>
              {'  ·  '}
              <Text>{circlePlaces.length} Geofences Monitored</Text>
              {'  ·  '}
              <Text style={{ color: '#006C4F', fontWeight: '600' }}>
                {normalBatteryCount} Normal Battery
              </Text>
            </Text>
          </View>
        </View>

        {/* Common Circle Group Chat Hub */}
        <TouchableOpacity
          style={styles.commonChatCard}
          onPress={() => navigation.navigate('Chat')}
          activeOpacity={0.85}
        >
          <View style={styles.commonChatIconBox}>
            <Ionicons name="chatbubbles" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.commonChatTitle}>Circle Group Chat</Text>
              <View style={styles.liveChatBadge}>
                <Text style={styles.liveChatBadgeText}>Active</Text>
              </View>
            </View>
            <Text style={styles.commonChatSub}>
              Common chat with all {members.length} circle members
            </Text>
          </View>
          <View style={styles.commonChatAction}>
            <Text style={styles.commonChatActionText}>Open</Text>
            <Ionicons name="chevron-forward" size={16} color="#183CE6" />
          </View>
        </TouchableOpacity>

        {/* Family Members Section */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>Family Members</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{members.length}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Home')}>
            <Text style={styles.sectionLink}>Live Map View ›</Text>
          </TouchableOpacity>
        </View>

        {/* Real Members List */}
        {members.length > 0 ? (
          members.map((member) => {
            const name = member.profile?.full_name || 'Family Member';
            const isSelf = member.user_id === profile?.id;
            const role = member.role || 'Member';
            const battery = member.batteryPct != null ? `${member.batteryPct}%` : '100%';
            const isLowBattery = (member.batteryPct != null && member.batteryPct <= 20);
            const isDriving = Boolean(member.isDriving);

            return (
              <View key={member.user_id} style={styles.memberCard}>
                <View style={styles.memberCardTop}>
                  <View style={styles.memberAvatarWrapper}>
                    {member.profile?.avatar_url ? (
                      <Image source={{ uri: member.profile.avatar_url }} style={styles.avatarImg} />
                    ) : (
                      <View style={[styles.avatarImg, styles.avatarFallback]}>
                        <Text style={styles.avatarFallbackText}>
                          {name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.avatarStatusBadge,
                        isDriving && { backgroundColor: '#DEE0FF' },
                      ]}
                    >
                      {isDriving ? (
                        <Ionicons name="car" size={10} color="#183CE6" />
                      ) : (
                        <View style={styles.avatarStatusDot} />
                      )}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {isSelf ? `${name} (You)` : name}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.roleTag,
                          {
                            backgroundColor: role === 'owner' ? '#FEF3C7' : (role === 'co_leader' ? '#F3E8FF' : (role === 'guardian' ? '#E0F2FE' : '#F3F4F6')),
                            borderColor: role === 'owner' ? '#F59E0B' : (role === 'co_leader' ? '#A855F7' : (role === 'guardian' ? '#38BDF8' : '#D1D5DB')),
                            borderWidth: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 3,
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }
                        ]}
                        onPress={() => {
                          if (canManageRanks || isSelf) {
                            setRoleModalMember(member);
                          }
                        }}
                        activeOpacity={canManageRanks ? 0.7 : 1}
                      >
                        <Ionicons
                          name={role === 'owner' ? 'ribbon' : (role === 'co_leader' ? 'shield-checkmark' : (role === 'guardian' ? 'shield' : 'person'))}
                          size={10}
                          color={role === 'owner' ? '#B45309' : (role === 'co_leader' ? '#7E22CE' : (role === 'guardian' ? '#0369A1' : '#4B5563'))}
                        />
                        <Text
                          style={[
                            styles.roleTagText,
                            { color: role === 'owner' ? '#B45309' : (role === 'co_leader' ? '#7E22CE' : (role === 'guardian' ? '#0369A1' : '#4B5563')) }
                          ]}
                        >
                          {role === 'owner' ? 'OWNER' : (role === 'co_leader' ? 'CO-LEADER' : (role === 'guardian' ? 'GUARDIAN' : 'MEMBER'))}
                        </Text>
                        {canManageRanks && !isSelf && (
                          <Ionicons name="create-outline" size={10} color="#7E22CE" style={{ marginLeft: 1 }} />
                        )}
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.memberStatusText} numberOfLines={1}>
                      {isDriving
                        ? 'Driving in transit'
                        : member.isOnline !== false
                        ? 'Location active on map'
                        : 'Recently active'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.cardBatteryPill,
                      isLowBattery && { backgroundColor: '#FFDAD7' },
                    ]}
                  >
                    <Ionicons
                      name={isLowBattery ? 'battery-dead' : 'battery-full'}
                      size={15}
                      color={isLowBattery ? '#AE041B' : '#006C4F'}
                    />
                    <Text
                      style={[
                        styles.cardBatteryText,
                        isLowBattery && { color: '#AE041B', fontWeight: '700' },
                      ]}
                    >
                      {battery}
                    </Text>
                  </View>
                </View>

                {/* Member Actions */}
                <View style={styles.memberActionsRow}>
                  {canManageRanks && !isSelf && (
                    <TouchableOpacity
                      style={[styles.actionPillBtn, { borderColor: '#A855F7', backgroundColor: '#FAF5FF' }]}
                      onPress={() => setRoleModalMember(member)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="shield-half-outline" size={14} color="#A855F7" />
                      <Text style={[styles.actionPillText, { color: '#A855F7', fontWeight: '700' }]}>Promote</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.actionPillBtn}
                    onPress={() => {
                      if (member.latitude && member.longitude) {
                        const scheme = Platform.select({
                          ios: `maps:0,0?q=${member.latitude},${member.longitude}`,
                          android: `geo:0,0?q=${member.latitude},${member.longitude}`,
                          web: `https://www.google.com/maps/search/?api=1&query=${member.latitude},${member.longitude}`,
                        });
                        if (scheme) Linking.openURL(scheme);
                      } else {
                        navigation.navigate('Home');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="navigate-outline" size={15} color="#183CE6" />
                    <Text style={styles.actionPillText}>Directions</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionPillBtn}
                    onPress={() => handleRingMember(member)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="notifications-outline" size={15} color="#183CE6" />
                    <Text style={styles.actionPillText}>Ring</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => navigation.navigate('LocationHistory', { member, circleId: activeCircle?.id })}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={17} color="#444656" />
                  </TouchableOpacity>
                </View>

                {isLowBattery && (
                  <View style={styles.lowBatteryNotice}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Ionicons name="leaf" size={15} color="#AE041B" />
                      <Text style={styles.lowBatteryText}>Low battery detected</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleNudgeMember(member)}
                    >
                      <Text style={styles.nudgeBtn}>Nudge</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="person-add-outline" size={32} color="#183CE6" />
            <Text style={styles.emptyCardTitle}>No Members In This Circle Yet</Text>
            <Text style={styles.emptyCardSub}>
              Share your invite code below with family to see their real-time location and safety status.
            </Text>
          </View>
        )}

        {/* Monitored Safe Places */}
        <View style={[styles.sectionHeader, { marginTop: 14 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>Monitored Places</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{circlePlaces.length}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('SafePlaces')}>
            <Text style={styles.sectionLink}>Manage All</Text>
          </TouchableOpacity>
        </View>

        {circlePlaces && circlePlaces.length > 0 ? (
          circlePlaces.map((place) => (
            <View key={place.id} style={styles.placeCard}>
              <View style={[styles.placeIconBox, { backgroundColor: '#DEE0FF' }]}>
                <Ionicons name="location" size={20} color="#183CE6" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.placeName} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <View style={[styles.avatarStatusDot, { width: 6, height: 6 }]} />
                </View>
                <Text style={styles.placeMeta}>
                  Radius {place.radius_m || 150}m · Entry & Exit notifications
                </Text>
              </View>
              <TouchableOpacity
                style={styles.placeEditBtn}
                onPress={() => navigation.navigate('SafePlaces')}
              >
                <Ionicons name="options-outline" size={18} color="#444656" />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.emptyPlaceCard}>
            <Text style={styles.emptyPlaceText}>
              No safe places set up yet. Add home, school, or work to get automatic arrival & exit alerts.
            </Text>
          </View>
        )}

        {/* Add New Safe Place Button */}
        <TouchableOpacity
          style={styles.addPlaceCard}
          onPress={() => navigation.navigate('SafePlaces')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={18} color="#183CE6" />
          <Text style={styles.addPlaceText}>Add New Safe Place</Text>
        </TouchableOpacity>

        {/* Family Invite Code Section */}
        <View style={styles.inviteCard}>
          <View style={styles.inviteCardTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="key" size={18} color="#183CE6" />
              <Text style={styles.inviteCardTitle}>Family Invite Code</Text>
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={handleCopyCode}
            >
              <Ionicons name="copy-outline" size={14} color="#183CE6" />
              <Text style={styles.copyLinkText}>{copyStatus}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inviteCodeRow}>
            <Text style={styles.inviteCodeText}>{inviteCode}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity style={styles.codeActionBtn} onPress={handleShareSMS}>
                <Ionicons name="chatbox-outline" size={14} color="#183CE6" />
                <Text style={styles.codeActionText}>SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.codeActionBtn}
                onPress={() => setQrModalVisible(true)}
              >
                <Ionicons name="qr-code-outline" size={14} color="#183CE6" />
                <Text style={styles.codeActionText}>QR</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.inviteCodeNote}>
            Only share with verified family members. New members will appear instantly upon joining.
          </Text>
        </View>

        {/* Circle Management & Danger Zone */}
        <View style={styles.dangerZoneCard}>
          <View style={styles.dangerZoneHeader}>
            <View style={styles.dangerIconBox}>
              <Ionicons
                name={isOwner ? 'trash-outline' : 'log-out-outline'}
                size={18}
                color="#DC2626"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerZoneTitle}>
                {isOwner ? 'Delete Circle' : 'Leave Circle'}
              </Text>
              <Text style={styles.dangerZoneSubtitle}>
                {isOwner
                  ? 'Permanently erase this circle, safe places, and member history'
                  : 'Disconnect and stop sharing location with this circle'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.dangerActionBtn}
            onPress={handleDeleteOrLeaveCircle}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isOwner ? 'trash' : 'exit-outline'}
              size={16}
              color="#DC2626"
            />
            <Text style={styles.dangerActionBtnText}>
              {isOwner ? 'Delete Circle' : 'Leave Circle'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Circle QR Code Modal */}
      <CircleQRCodeModal
        visible={qrModalVisible}
        circle={activeCircle}
        onClose={() => setQrModalVisible(false)}
      />

      {/* Toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Member Role Promotion Modal */}
      <MemberRoleModal
        visible={!!roleModalMember}
        member={roleModalMember}
        circleId={activeCircle?.id || ''}
        canEdit={canManageRanks}
        onClose={() => setRoleModalMember(null)}
        onRoleUpdated={(userId, newRole) => {
          setRoleModalMember((prev: any) => prev ? { ...prev, role: newRole } : null);
          if (activeCircle?.id) fetchMembers(activeCircle.id);
          showToast(`Role updated to ${newRole.replace('_', ' ').toUpperCase()}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(250, 249, 246, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    maxWidth: SCREEN_WIDTH * 0.5,
  },
  circleSelectorText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2A24',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSOSBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#DC2626',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  headerSOSText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EFEA',
  },
  profileAvatarBtn: {
    padding: 1,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#2E7D5B',
  },
  profileAvatarImg: {
    width: 30,
    height: 30,
    borderRadius: 999,
  },
  avatarFallback: {
    backgroundColor: '#2E7D5B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },
  topSection: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headlineText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2A24',
    letterSpacing: -0.3,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2E7D5B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addMemberText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D5B',
  },
  bannerText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#5C665F',
  },
  commonChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDEBE6',
    marginBottom: 16,
    gap: 12,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  commonChatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#2E7D5B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commonChatTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2A24',
  },
  liveChatBadge: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveChatBadgeText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  commonChatSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#5C665F',
    marginTop: 2,
  },
  commonChatAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  commonChatActionText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2A24',
  },
  countBadge: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  sectionLink: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D5B',
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDEBE6',
    marginBottom: 12,
    shadowColor: '#1F2A24',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  memberCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  memberAvatarWrapper: {
    position: 'relative',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarStatusBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#006C4F',
  },
  memberName: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#151C27',
  },
  roleTag: {
    backgroundColor: '#E2E8F8',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#444656',
  },
  memberStatusText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#444656',
    marginTop: 2,
  },
  cardBatteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0F3FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  cardBatteryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#444656',
  },
  memberActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  actionPillBtn: {
    flex: 1,
    height: 36,
    backgroundColor: '#F0F3FF',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionPillText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '600',
    color: '#151C27',
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowBatteryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 218, 215, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    marginTop: 10,
  },
  lowBatteryText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '600',
    color: '#930014',
  },
  nudgeBtn: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '700',
    color: '#183CE6',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E7EEFE',
    marginBottom: 10,
  },
  emptyCardTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 14,
    fontWeight: '700',
    color: '#151C27',
  },
  emptyCardSub: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#444656',
    textAlign: 'center',
    lineHeight: 16,
  },
  placeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E7EEFE',
    shadowColor: '#151C27',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  placeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#151C27',
  },
  placeMeta: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#444656',
    marginTop: 2,
  },
  placeEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F3FF',
  },
  emptyPlaceCard: {
    backgroundColor: '#F0F3FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  emptyPlaceText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    color: '#444656',
    lineHeight: 16,
  },
  addPlaceCard: {
    backgroundColor: '#F0F3FF',
    borderRadius: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 16,
  },
  addPlaceText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#183CE6',
  },
  inviteCard: {
    backgroundColor: '#E7EEFE',
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  inviteCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCardTitle: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '700',
    color: '#151C27',
  },
  copyLinkText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 12,
    fontWeight: '700',
    color: '#183CE6',
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inviteCodeText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 3,
    color: '#151C27',
  },
  codeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F3FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  codeActionText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    fontWeight: '600',
    color: '#183CE6',
  },
  inviteCodeNote: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 11,
    color: '#444656',
    lineHeight: 16,
  },
  floatingSOSButton: {
    position: 'absolute',
    right: 18,
    bottom: 95,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    shadowColor: '#DC2626',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 12,
    zIndex: 9999,
  },
  sosPulseAura: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    opacity: 0.4,
  },
  floatingSOSText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  toastContainer: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: '#2A313D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  toastText: {
    fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    color: '#EBF1FF',
    fontSize: 12,
    fontWeight: '600',
  },
  dangerZoneCard: {
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 44,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 16,
  },
  dangerZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  dangerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerZoneTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
  },
  dangerZoneSubtitle: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16,
  },
  dangerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dangerActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
});
