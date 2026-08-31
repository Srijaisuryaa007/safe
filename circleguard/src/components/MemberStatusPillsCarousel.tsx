import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore, CircleMember } from '../store/useCircleStore';
import { useNavigation } from '@react-navigation/native';
import { getHaversineDistanceInMeters } from '../services/GeofenceEngine';

interface MemberStatusPillsCarouselProps {
  safePlaces?: any[];
  userLoc?: { latitude: number; longitude: number } | null;
  onSelectMember?: (member: any) => void;
  onSosPress?: () => void;
}

import { useAuthStore } from '../store/useAuthStore';

function parseCoords(item: any): { lat: number; lng: number } {
  if (!item) return { lat: 0, lng: 0 };
  const dLat = parseFloat(item.latitude ?? item.start_lat ?? item.lat);
  const dLng = parseFloat(item.longitude ?? item.start_lng ?? item.lng);
  if (!isNaN(dLat) && !isNaN(dLng) && Math.abs(dLat) <= 90 && Math.abs(dLng) <= 180 && (dLat !== 0 || dLng !== 0)) {
    return { lat: dLat, lng: dLng };
  }
  if (item.geom && typeof item.geom === 'string') {
    const match = item.geom.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
    if (match) {
      let lngVal = parseFloat(match[1]); // Token 1 is Longitude
      let latVal = parseFloat(match[2]); // Token 2 is Latitude
      if (Math.abs(latVal) > 90 && Math.abs(lngVal) <= 90) {
        const temp = latVal;
        latVal = lngVal;
        lngVal = temp;
      }
      return { lat: latVal, lng: lngVal };
    }
  }
  return { lat: 0, lng: 0 };
}

export default function MemberStatusPillsCarousel({
  safePlaces = [],
  userLoc,
  onSelectMember,
  onSosPress,
}: MemberStatusPillsCarouselProps) {
  const { colors, isDark } = useThemeStore();
  const { members } = useCircleStore();
  const { profile } = useAuthStore();
  const navigation = useNavigation<any>();

  const getMemberDisplayName = (m: any): string => {
    return m.profile?.full_name || m.full_name || 'Member';
  };

  const getMemberAvatar = (m: any): string | null => {
    return m.profile?.avatar_url || m.avatar_url || null;
  };

  const getMemberStatusTag = (m: any) => {
    const { lat, lng } = parseCoords(m);
    const isSelf = profile?.id && (m.user_id === profile.id || m.id === profile.id);

    // 1. Check if member is offline or missing GPS telemetry
    if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0 || m.isOnline === false) {
      return {
        label: isSelf ? 'Your Device' : (m.lastSeenText ? `Seen ${m.lastSeenText}` : 'Offline'),
        icon: isSelf ? ('phone-portrait-outline' as const) : ('moon-outline' as const),
        color: colors.textMuted || '#8E8E93',
        isMoving: false,
      };
    }

    const speedKmh = Math.round(((m.speed_mps || m.speed || 0) * 3.6));
    const isDriving = Boolean(m.isDriving || m.is_driving || speedKmh > 18);
    const isWalking = speedKmh >= 3 && speedKmh <= 18;

    if (isDriving) {
      return {
        label: `Driving • ${speedKmh} km/h`,
        icon: 'car-sport-outline' as const,
        color: '#3B82F6',
        isMoving: true,
      };
    }

    if (isWalking) {
      return {
        label: `Walking • ${speedKmh} km/h`,
        icon: 'walk-outline' as const,
        color: '#10B981',
        isMoving: true,
      };
    }

    // 2. Check if inside a registered safe place
    if (safePlaces && safePlaces.length > 0) {
      for (const p of safePlaces) {
        const pLat = parseFloat(p.start_lat || p.latitude || '0');
        const pLng = parseFloat(p.start_lng || p.longitude || '0');
        if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
          const dist = getHaversineDistanceInMeters(lat, lng, pLat, pLng);
          const radius = Number(p.radius_m) || 150;
          if (dist <= radius) {
            const isHome = (p.category || '').toLowerCase() === 'home' || (p.name || '').toLowerCase().includes('home');
            return {
              label: isHome ? 'At Home' : `At ${p.name || 'Safe Place'}`,
              icon: isHome ? ('home-outline' as const) : ('location-outline' as const),
              color: '#10B981',
              isMoving: false,
            };
          }
        }
      }
    }

    // 3. Self or Proximity distance
    if (isSelf) {
      return {
        label: 'Your Device',
        icon: 'phone-portrait-outline' as const,
        color: '#10B981',
        isMoving: false,
      };
    }

    if (userLoc && !isNaN(userLoc.latitude) && !isNaN(userLoc.longitude)) {
      const distM = getHaversineDistanceInMeters(userLoc.latitude, userLoc.longitude, lat, lng);
      if (distM < 60) {
        return {
          label: 'With You',
          icon: 'people-outline' as const,
          color: '#10B981',
          isMoving: false,
        };
      }
      if (distM < 1000) {
        return {
          label: `${Math.round(distM)}m away`,
          icon: 'navigate-outline' as const,
          color: colors.textMuted || '#8E8E93',
          isMoving: false,
        };
      }
      const km = (distM / 1000).toFixed(1);
      return {
        label: `${km} km away`,
        icon: 'navigate-outline' as const,
        color: colors.textMuted || '#8E8E93',
        isMoving: false,
      };
    }

    return {
      label: 'Stationary',
      icon: 'radio-outline' as const,
      color: '#10B981',
      isMoving: false,
    };
  };

  const handleMemberPress = (m: any) => {
    if (onSelectMember) {
      onSelectMember(m);
    } else {
      const name = getMemberDisplayName(m);
      const memberId = m.user_id || m.id;
      const lat = Number(m.latitude);
      const lng = Number(m.longitude);

      navigation.navigate('MainTabs', {
        screen: 'Map',
        params: {
          focusUserId: memberId,
          focusLat: !isNaN(lat) ? lat : undefined,
          focusLng: !isNaN(lng) ? lng : undefined,
          focusUserName: name,
        },
      });
    }
  };

  const safeMemberList = Array.isArray(members) ? members : [];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContainer}
    >
      {/* Member Quick Status Capsules */}
      {safeMemberList.map((member: any, index: number) => {
        const uniqueKey = member.user_id || member.id || `member-pill-${index}`;
        const name = getMemberDisplayName(member);
        const avatarUrl = getMemberAvatar(member);
        const status = getMemberStatusTag(member);
        const initial = String(name || 'M').charAt(0).toUpperCase();
        const battery = member.batteryPct ?? member.battery_pct ?? 85;

        return (
          <TouchableOpacity
            key={uniqueKey}
            style={[
              styles.memberPill,
              {
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                borderColor: status.isMoving ? (colors.accentGold || '#10B981') : (colors.border || '#E5E7EB'),
              },
            ]}
            onPress={() => handleMemberPress(member)}
            activeOpacity={0.7}
          >
            {/* Avatar */}
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.pillAvatar} />
            ) : (
              <View style={[styles.initialAvatar, { backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9' }]}>
                <Text style={[styles.initialText, { color: colors.foreground }]}>{initial}</Text>
              </View>
            )}

            <View style={styles.pillTextBox}>
              <View style={styles.pillNameRow}>
                <Text style={[styles.pillName, { color: colors.foreground }]} numberOfLines={1}>
                  {name.split(' ')[0] || 'Member'}
                </Text>
                {/* Battery percentage */}
                <View style={styles.batteryBadge}>
                  <Ionicons
                    name={battery < 20 ? 'battery-dead' : 'battery-charging'}
                    size={11}
                    color={battery < 20 ? '#EF4444' : '#10B981'}
                  />
                  <Text style={[styles.batteryText, { color: battery < 20 ? '#EF4444' : (colors.textMuted || '#8E8E93') }]}>
                    {battery}%
                  </Text>
                </View>
              </View>

              <View style={styles.pillStatusRow}>
                <Ionicons name={status.icon} size={11} color={status.color} />
                <Text style={[styles.pillStatusText, { color: status.color }]} numberOfLines={1}>
                  {status.label}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 0,
    paddingVertical: 2,
    marginBottom: 12,
  },
  sosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
  },
  sosPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  pillAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  initialAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pillTextBox: {
    justifyContent: 'center',
  },
  pillNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillName: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 75,
  },
  batteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  batteryText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  pillStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  pillStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
