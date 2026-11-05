import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ParallaxCard from './ParallaxCard';
import RadarPulseBeacon from './RadarPulseBeacon';

export interface ParallaxMemberCardProps {
  member: any;
  variant?: 'hero' | 'bento' | 'list';
  isDark: boolean;
  isSelf?: boolean;
  isTargetOwner?: boolean;
  trueLeaderId?: string | null;
  circlePlaces?: any[];
  onPress?: () => void;
  onLocate?: () => void;
  onChat?: () => void;
  onCall?: () => void;
  onMore?: () => void;
}

export const ParallaxMemberCard: React.FC<ParallaxMemberCardProps> = ({
  member,
  variant = 'bento',
  isDark,
  isSelf = false,
  isTargetOwner = false,
  circlePlaces = [],
  onPress,
  onLocate,
  onChat,
  onCall,
  onMore,
}) => {
  const name = member?.profile?.full_name || 'Family Member';
  const role = isTargetOwner ? 'owner' : (member?.role === 'owner' ? 'co_leader' : (member?.role || 'member'));
  const batteryPctVal = member?.batteryPct ?? 100;
  const battery = member?.batteryPct != null ? `${member.batteryPct}%` : '100%';
  const isLowBattery = member?.batteryPct != null && member.batteryPct <= 20;
  const isDriving = Boolean(member?.isDriving);
  const isOnline = member?.isOnline !== false;
  const isGhostMode = Boolean(member?.profile?.is_ghost_mode);

  const matchedPlace = circlePlaces.find((p) => p.id === member?.latestPlaceEvent?.place_id);
  const isInSafePlace = member?.latestPlaceEvent?.event_type === 'arrival';
  const placeName = matchedPlace?.name
    ? matchedPlace.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()
    : 'Safe Place';

  const roleLabel =
    role === 'owner'
      ? 'Circle Leader'
      : role === 'co_leader'
      ? 'Co-Leader'
      : role === 'guardian'
      ? 'Guardian'
      : 'Member';

  const roleColor =
    role === 'owner'
      ? (isDark ? '#F5A623' : '#D97706')
      : role === 'co_leader'
      ? (isDark ? '#FFFFFF' : '#0F172A')
      : role === 'guardian'
      ? (isDark ? '#94A3B8' : '#475569')
      : (isDark ? '#64748B' : '#64748B');

  const roleBg =
    role === 'owner'
      ? (isDark ? 'rgba(245, 166, 35, 0.15)' : '#FEF3C7')
      : role === 'co_leader'
      ? (isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9')
      : role === 'guardian'
      ? (isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC')
      : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#F1F5F9');

  const handleCardPress = () => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(10); } catch (_) {}
    }
    if (onPress) onPress();
  };

  // 1. HERO SPOTLIGHT PARALLAX CARD
  if (variant === 'hero') {
    return (
      <ParallaxCard
        style={[
          styles.heroCard,
          isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.12)' },
          isTargetOwner && { borderColor: isDark ? 'rgba(245, 166, 35, 0.45)' : 'rgba(217, 119, 6, 0.35)' },
        ]}
        depthMultiplier={1.25}
        maxTiltAngle={14}
        enableGlare={true}
        onPress={handleCardPress}
        renderBackgroundLayer={() => (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Ambient Aura Gradient Ring */}
            <View
              style={[
                styles.heroAuraBackdrop,
                {
                  backgroundColor: role === 'owner'
                    ? (isDark ? 'rgba(245, 166, 35, 0.08)' : 'rgba(245, 166, 35, 0.05)')
                    : (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.03)'),
                },
              ]}
            />
            {/* Concentric radar depth circle */}
            <View style={[styles.heroRadarRing, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]} />
          </View>
        )}
      >
        <View style={styles.heroContent}>
          {/* Top Row: Overline + 3D Badge + Battery */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroOverlineBadge}>
              <Ionicons name="sparkles" size={12} color={roleColor} />
              <Text style={[styles.heroOverlineText, { color: roleColor }]}>
                SPOTLIGHT • {roleLabel.toUpperCase()}
              </Text>
              <View style={[styles.parallaxTag, isDark && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={[styles.parallaxTagText, isDark && { color: '#E2E8F0' }]}>3D PARALLAX</Text>
              </View>
            </View>

            <View style={[styles.batteryPill, isDark && { backgroundColor: '#1A1C22' }, isLowBattery && { backgroundColor: isDark ? '#4A1D1D' : '#FFDAD7' }]}>
              <Ionicons
                name={isLowBattery ? 'battery-dead' : 'battery-full'}
                size={11}
                color={isLowBattery ? '#EF4444' : batteryPctVal > 50 ? (isDark ? '#FFFFFF' : '#0F172A') : '#F59E0B'}
              />
              <Text style={[styles.batteryText, isDark && { color: '#F1F5F9' }, isLowBattery && { color: '#EF4444', fontWeight: '800' }]}>
                {battery}
              </Text>
            </View>
          </View>

          {/* Main Middle Row: Big Avatar + Member Bio */}
          <View style={styles.heroMainRow}>
            <RadarPulseBeacon
              size={54}
              color={isDriving ? '#F5A623' : '#0F172A'}
              isPulsing={isOnline && !isGhostMode}
            >
              <View style={styles.heroAvatarWrapper}>
                {member?.profile?.avatar_url ? (
                  <Image source={{ uri: member.profile.avatar_url }} style={styles.heroAvatarImg} />
                ) : (
                  <View style={[styles.heroAvatarImg, styles.avatarFallback, isDark && { backgroundColor: '#1A1C22' }]}>
                    <Text style={[styles.avatarFallbackText, { color: roleColor, fontSize: 18 }]}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.heroAvatarStatusBadge,
                    isDark && { backgroundColor: '#101114', borderColor: '#101114' },
                    isDriving && { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.20)' : '#FEF3C7', borderColor: isDark ? '#F5A623' : '#D97706' },
                  ]}
                >
                  {isDriving ? (
                    <Ionicons name="car" size={10} color={isDark ? '#F5A623' : '#D97706'} />
                  ) : (
                    <View
                      style={[
                        styles.avatarStatusDot,
                        { backgroundColor: isOnline ? (isDark ? '#FFFFFF' : '#0F172A') : '#64748B' },
                      ]}
                    />
                  )}
                </View>
              </View>
            </RadarPulseBeacon>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.heroName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                  {isSelf ? `${name} (You)` : name}
                </Text>
                {role === 'owner' && (
                  <Ionicons name="shield-checkmark" size={15} color={isDark ? '#F5A623' : '#D97706'} />
                )}
              </View>

              <View style={styles.heroStatusRow}>
                <View
                  style={[
                    styles.heroLiveStatusPill,
                    {
                      backgroundColor: isDriving
                        ? (isDark ? 'rgba(245, 166, 35, 0.15)' : '#FEF3C7')
                        : isInSafePlace
                        ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7')
                        : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9'),
                    },
                  ]}
                >
                  <Ionicons
                    name={isDriving ? 'car' : isInSafePlace ? 'shield-checkmark' : 'navigate-outline'}
                    size={11}
                    color={
                      isDriving
                        ? '#F5A623'
                        : isInSafePlace
                        ? '#10B981'
                        : (isDark ? '#94A3B8' : '#64748B')
                    }
                  />
                  <Text
                    style={[
                      styles.heroLiveStatusText,
                      {
                        color: isDriving
                          ? '#F5A623'
                          : isInSafePlace
                          ? '#10B981'
                          : (isDark ? '#CBD5E1' : '#334155'),
                      },
                    ]}
                  >
                    {isDriving
                      ? 'In Transit (Live Telematics)'
                      : isInSafePlace
                      ? `At ${placeName}`
                      : isOnline
                      ? 'Live Active'
                      : 'Offline'}
                  </Text>
                </View>

                {isGhostMode && (
                  <View style={[styles.ghostPill, isDark && { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
                    <Ionicons name="eye-off" size={9} color={isDark ? '#94A3B8' : '#64748B'} />
                    <Text style={[styles.ghostPillText, isDark && { color: '#94A3B8' }]}>Ghost</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Bottom Micro-Dock */}
          <View style={[styles.heroDockRow, isDark && { borderTopColor: 'rgba(255, 255, 255, 0.08)' }]}>
            <TouchableOpacity
              style={[styles.heroDockBtn, isDark && { backgroundColor: '#1A1C22' }]}
              onPress={onLocate}
              activeOpacity={0.75}
            >
              <Ionicons name="navigate-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
              <Text style={[styles.heroDockBtnText, isDark && { color: '#FFFFFF' }]}>Locate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroDockBtn, isDark && { backgroundColor: '#1A1C22' }]}
              onPress={onChat}
              activeOpacity={0.75}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
              <Text style={[styles.heroDockBtnText, isDark && { color: '#FFFFFF' }]}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroDockBtn, isDark && { backgroundColor: '#1A1C22' }]}
              onPress={onCall}
              activeOpacity={0.75}
            >
              <Ionicons name="call-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
              <Text style={[styles.heroDockBtnText, isDark && { color: '#FFFFFF' }]}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroDockBtn, isDark && { backgroundColor: '#1A1C22' }]}
              onPress={onMore}
              activeOpacity={0.75}
            >
              <Ionicons name="options-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
              <Text style={[styles.heroDockBtnText, isDark && { color: '#FFFFFF' }]}>Actions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ParallaxCard>
    );
  }

  // 2. LIST ROW PARALLAX CARD (Streamlined High-Density List)
  if (variant === 'list') {
    return (
      <ParallaxCard
        style={[
          styles.listCard,
          isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' },
          isTargetOwner && { borderColor: isDark ? 'rgba(245, 166, 35, 0.35)' : 'rgba(217, 119, 6, 0.3)' },
        ]}
        depthMultiplier={0.9}
        maxTiltAngle={9}
        enableGlare={true}
        onPress={handleCardPress}
        renderBackgroundLayer={() => (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View
              style={[
                styles.listAuraBackdrop,
                {
                  backgroundColor: isDriving
                    ? (isDark ? 'rgba(245, 166, 35, 0.05)' : 'rgba(245, 166, 35, 0.03)')
                    : (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(15, 23, 42, 0.015)'),
                },
              ]}
            />
          </View>
        )}
      >
        <View style={styles.listContent}>
          {/* Avatar with Radar Pulse Beacon */}
          <RadarPulseBeacon
            size={44}
            color={isDriving ? '#F5A623' : '#0F172A'}
            isPulsing={isOnline && !isGhostMode}
          >
            <View style={styles.bentoAvatarWrapper}>
              {member?.profile?.avatar_url ? (
                <Image source={{ uri: member.profile.avatar_url }} style={styles.bentoAvatarImg} />
              ) : (
                <View style={[styles.bentoAvatarImg, styles.avatarFallback, isDark && { backgroundColor: '#1A1C22' }]}>
                  <Text style={[styles.avatarFallbackText, { color: roleColor }]}>
                    {name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.bentoAvatarStatusBadge,
                  isDark && { backgroundColor: '#101114', borderColor: '#101114' },
                  isDriving && { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.20)' : '#FEF3C7', borderColor: isDark ? '#F5A623' : '#D97706' },
                ]}
              >
                {isDriving ? (
                  <Ionicons name="car" size={10} color={isDark ? '#F5A623' : '#D97706'} />
                ) : (
                  <View
                    style={[
                      styles.avatarStatusDot,
                      { backgroundColor: isOnline ? (isDark ? '#FFFFFF' : '#0F172A') : '#64748B' },
                    ]}
                  />
                )}
              </View>
            </View>
          </RadarPulseBeacon>

          {/* Member Info */}
          <View style={styles.listInfoCol}>
            <View style={styles.listNameRow}>
              <Text style={[styles.listMemberName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
                {isSelf ? `${name} (You)` : name}
              </Text>

              <View
                style={[
                  styles.roleTag,
                  { backgroundColor: roleBg, borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E2E8F0' },
                ]}
              >
                <Ionicons
                  name={
                    role === 'owner' ? 'shield-checkmark' :
                    role === 'co_leader' ? 'ribbon-outline' :
                    role === 'guardian' ? 'eye-outline' : 'person-outline'
                  }
                  size={10}
                  color={roleColor}
                />
                <Text style={[styles.roleTagText, { color: roleColor, fontSize: 10 }]}>{roleLabel}</Text>
              </View>
            </View>

            <View style={styles.listStatusRow}>
              <Ionicons
                name={isDriving ? 'car' : isInSafePlace ? 'shield-checkmark' : 'location-outline'}
                size={11}
                color={isDriving ? '#F5A623' : isInSafePlace ? '#10B981' : (isDark ? '#94A3B8' : '#64748B')}
              />
              <Text
                style={[
                  styles.listStatusText,
                  isDark && { color: '#94A3B8' },
                  isInSafePlace && { color: '#10B981', fontWeight: '600' },
                  isDriving && { color: '#F5A623', fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                {isDriving
                  ? 'Moving · Live Telematics'
                  : isInSafePlace
                  ? `At ${placeName}`
                  : isOnline
                  ? 'Active now'
                  : 'Last seen recently'}
              </Text>
            </View>
          </View>

          {/* Right Edge: Battery & Quick Actions */}
          <View style={styles.listRightCol}>
            <View
              style={[
                styles.cardBatteryPill,
                isDark && { backgroundColor: '#1A1C22' },
                isLowBattery && { backgroundColor: isDark ? '#4A1D1D' : '#FFDAD7' },
              ]}
            >
              <Ionicons
                name={isLowBattery ? 'battery-dead' : 'battery-full'}
                size={11}
                color={isLowBattery ? '#EF4444' : batteryPctVal > 50 ? (isDark ? '#FFFFFF' : '#0F172A') : '#F59E0B'}
              />
              <Text
                style={[
                  styles.cardBatteryText,
                  isDark && { color: '#F1F5F9' },
                  isLowBattery && { color: '#EF4444', fontWeight: '800' },
                ]}
              >
                {battery}
              </Text>
            </View>

            <View style={styles.listMiniActions}>
              <TouchableOpacity
                style={[styles.miniDirectActionBtn, isDark && { backgroundColor: '#1A1C22' }]}
                onPress={onLocate}
                activeOpacity={0.7}
              >
                <Ionicons name="navigate-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.miniDirectActionBtn, isDark && { backgroundColor: '#1A1C22' }]}
                onPress={onChat}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.miniDirectActionBtn, isDark && { backgroundColor: '#1A1C22' }]}
                onPress={onCall}
                activeOpacity={0.7}
              >
                <Ionicons name="call-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ParallaxCard>
    );
  }

  // 3. BENTO 2-COLUMN PARALLAX TILE
  return (
    <ParallaxCard
      style={[
        styles.bentoCard,
        isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' },
      ]}
      depthMultiplier={1.1}
      maxTiltAngle={12}
      enableGlare={true}
      onPress={handleCardPress}
      renderBackgroundLayer={() => (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View
            style={[
              styles.bentoAuraBackdrop,
              {
                backgroundColor: isDriving
                  ? (isDark ? 'rgba(245, 166, 35, 0.07)' : 'rgba(245, 166, 35, 0.04)')
                  : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.02)'),
              },
            ]}
          />
        </View>
      )}
    >
      <View style={styles.bentoContent}>
        {/* Tile Top: Avatar + Battery */}
        <View style={styles.bentoTopRow}>
          <RadarPulseBeacon
            size={42}
            color={isDriving ? '#F5A623' : '#0F172A'}
            isPulsing={isOnline && !isGhostMode}
          >
            <View style={styles.bentoAvatarWrapper}>
              {member?.profile?.avatar_url ? (
                <Image source={{ uri: member.profile.avatar_url }} style={styles.bentoAvatarImg} />
              ) : (
                <View style={[styles.bentoAvatarImg, styles.avatarFallback, isDark && { backgroundColor: '#1A1C22' }]}>
                  <Text style={[styles.avatarFallbackText, { color: roleColor, fontSize: 14 }]}>
                    {name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.bentoAvatarStatusBadge,
                  isDark && { backgroundColor: '#101114', borderColor: '#101114' },
                  isDriving && { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.20)' : '#FEF3C7', borderColor: isDark ? '#F5A623' : '#D97706' },
                ]}
              >
                {isDriving ? (
                  <Ionicons name="car" size={9} color={isDark ? '#F5A623' : '#D97706'} />
                ) : (
                  <View
                    style={[
                      styles.avatarStatusDot,
                      { backgroundColor: isOnline ? (isDark ? '#FFFFFF' : '#0F172A') : '#64748B' },
                    ]}
                  />
                )}
              </View>
            </View>
          </RadarPulseBeacon>

          <View style={[styles.cardBatteryPill, isDark && { backgroundColor: '#1A1C22' }, isLowBattery && { backgroundColor: isDark ? '#4A1D1D' : '#FFDAD7' }]}>
            <Ionicons
              name={isLowBattery ? 'battery-dead' : 'battery-full'}
              size={10}
              color={isLowBattery ? '#EF4444' : batteryPctVal > 50 ? (isDark ? '#FFFFFF' : '#0F172A') : '#F59E0B'}
            />
            <Text style={[styles.cardBatteryText, isDark && { color: '#F1F5F9' }, isLowBattery && { color: '#EF4444', fontWeight: '800' }]}>
              {battery}
            </Text>
          </View>
        </View>

        {/* Member Name */}
        <Text style={[styles.bentoName, isDark && { color: '#FFFFFF' }]} numberOfLines={1}>
          {isSelf ? `${name} (You)` : name}
        </Text>

        {/* Status Badge */}
        <View
          style={[
            styles.bentoStatusBadge,
            isDark && { backgroundColor: '#1A1C22' },
            isInSafePlace && { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' },
            isDriving && { backgroundColor: isDark ? 'rgba(245, 166, 35, 0.15)' : '#FEF3C7' },
          ]}
        >
          <Ionicons
            name={isDriving ? 'car' : isInSafePlace ? 'shield-checkmark' : 'navigate-outline'}
            size={10}
            color={
              isDriving
                ? '#F5A623'
                : isInSafePlace
                ? '#10B981'
                : (isDark ? '#94A3B8' : '#64748B')
            }
          />
          <Text
            style={[
              styles.bentoStatusBadgeText,
              isDark && { color: '#CBD5E1' },
              isInSafePlace && { color: '#10B981', fontWeight: '700' },
              isDriving && { color: '#F5A623', fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {isDriving ? 'Moving' : isInSafePlace ? placeName : isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        {/* Action Row */}
        <View style={[styles.bentoActionRow, isDark && { borderTopColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <TouchableOpacity
            style={[styles.bentoMiniActionBtn, isDark && { backgroundColor: '#1A1C22' }]}
            onPress={onLocate}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bentoMiniActionBtn, isDark && { backgroundColor: '#1A1C22' }]}
            onPress={onChat}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bentoMiniActionBtn, isDark && { backgroundColor: '#1A1C22' }]}
            onPress={onCall}
            activeOpacity={0.7}
          >
            <Ionicons name="call-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bentoMiniActionBtn, isDark && { backgroundColor: '#1A1C22' }]}
            onPress={onMore}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
        </View>
      </View>
    </ParallaxCard>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  heroContent: {
    padding: 16,
  },
  heroAuraBackdrop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  heroRadarRing: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroOverlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroOverlineText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  parallaxTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  parallaxTagText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  heroAvatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    position: 'relative',
  },
  heroAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  heroAvatarStatusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  heroStatusRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroLiveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  heroLiveStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ghostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  ghostPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  heroDockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  heroDockBtn: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  heroDockBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  // List Card Variant Styles
  listCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDEBE6',
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  listContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  listAuraBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  listInfoCol: {
    flex: 1,
  },
  listNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  listMemberName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  listStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listStatusText: {
    fontSize: 11,
    color: '#64748B',
    flexShrink: 1,
  },
  listRightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  listMiniActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniDirectActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bento Card Variant Styles
  bentoCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  bentoContent: {
    padding: 12,
  },
  bentoAuraBackdrop: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  bentoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bentoAvatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    position: 'relative',
  },
  bentoAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  bentoAvatarStatusBadge: {
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
  bentoName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  bentoStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 6,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  bentoStatusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  bentoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bentoMiniActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  batteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  batteryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardBatteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  cardBatteryText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleTagText: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  avatarFallback: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontWeight: '800',
  },
  avatarStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default ParallaxMemberCard;
