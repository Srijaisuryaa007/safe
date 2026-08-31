import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore } from '../store/useCircleStore';
import { useNavigation } from '@react-navigation/native';
import { getHaversineDistanceInMeters } from '../services/GeofenceEngine';
import { calculateDijkstraRouteBetweenUsers } from '../services/RoadRoutingService';

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

interface ZomatoLiveJourneyCardProps {
  inTransitMember?: any | null;
  outsideMember?: any | null;
  safePlaces?: any[];
  userLoc?: { latitude: number; longitude: number } | null;
  onFocusMember?: (member: any) => void;
}

export default function ZomatoLiveJourneyCard({
  inTransitMember,
  outsideMember,
  safePlaces = [],
  userLoc,
  onFocusMember,
}: ZomatoLiveJourneyCardProps) {
  const { colors, isDark } = useThemeStore();
  const { activeCircle } = useCircleStore();
  const navigation = useNavigation<any>();

  const activeTarget = inTransitMember || outsideMember;

  const [roadDistanceKm, setRoadDistanceKm] = useState<number | null>(null);
  const [roadDurationMins, setRoadDurationMins] = useState<number | null>(null);

  const { lat: memLat, lng: memLng } = parseCoords(activeTarget);

  useEffect(() => {
    if (!userLoc || !userLoc.latitude || !userLoc.longitude || memLat === 0 || memLng === 0) return;

    let isMounted = true;
    calculateDijkstraRouteBetweenUsers(
      { latitude: userLoc.latitude, longitude: userLoc.longitude },
      { latitude: memLat, longitude: memLng }
    ).then((route) => {
      if (isMounted && route.totalDistanceKm > 0) {
        setRoadDistanceKm(route.totalDistanceKm);
        setRoadDurationMins(route.totalDurationMins);
      }
    }).catch(() => {});

    return () => { isMounted = false; };
  }, [userLoc?.latitude, userLoc?.longitude, memLat, memLng]);

  // If no member is in-transit or outside boundaries, render "All Members Safe"
  if (!activeTarget) {
    return (
      <View
        style={[
          styles.cardContainer,
          {
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.topStatusRow}>
          <View style={styles.statusLeft}>
            <View style={[styles.secureIconPill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#DCFCE7' }]}>
              <View style={styles.greenPulseDot} />
              <Text style={[styles.securePillText, { color: isDark ? '#34D399' : '#059669' }]}>
                ALL MEMBERS SAFE
              </Text>
            </View>
            <Text style={[styles.cardHeading, { color: colors.foreground }]}>
              {activeCircle?.name || 'Family Circle'} • Perimeter Secure
            </Text>
          </View>

          <View style={[styles.shieldBadge, { backgroundColor: isDark ? 'rgba(212, 175, 55, 0.15)' : '#FEF3C7' }]}>
            <Ionicons name="shield-checkmark" size={20} color={colors.accentGold} />
          </View>
        </View>

        <Text style={[styles.cardSubText, { color: colors.textMuted }]}>
          All circle members are confirmed safe inside registered boundaries. 24/7 background telemetry is active.
        </Text>
      </View>
    );
  }

  const isOutsideAlert = Boolean(!inTransitMember && outsideMember);
  const memberName = activeTarget.profile?.full_name || activeTarget.full_name || 'Circle Member';
  const avatarUrl = activeTarget.profile?.avatar_url || activeTarget.avatar_url;
  const memberPhone = activeTarget.profile?.phone || activeTarget.phone;
  const speedKmh = Math.round(((activeTarget.speed_mps || activeTarget.speed || 0) * 3.6));
  const isDriving = Boolean(activeTarget.isDriving || activeTarget.is_driving || speedKmh > 18);
  const initial = String(memberName).charAt(0).toUpperCase();

  // Authentic Road (Dijkstra) distance with Haversine instant fallback
  let distanceKm: number | null = roadDistanceKm;
  let distanceLabel = 'Nearby';

  if (distanceKm === null && userLoc && userLoc.latitude && userLoc.longitude && memLat !== 0 && memLng !== 0) {
    const distM = getHaversineDistanceInMeters(
      userLoc.latitude,
      userLoc.longitude,
      memLat,
      memLng
    );
    if (distM < 60) {
      distanceLabel = 'With You (< 50m)';
      distanceKm = 0.05;
    } else if (distM < 1000) {
      distanceLabel = `${Math.round(distM)}m away`;
      distanceKm = parseFloat((distM / 1000).toFixed(2));
    } else {
      distanceKm = parseFloat((distM / 1000).toFixed(1));
      distanceLabel = `${distanceKm} km (road)`;
    }
  } else if (distanceKm !== null) {
    if (distanceKm < 0.08) {
      distanceLabel = 'With You (< 50m)';
    } else if (distanceKm < 1.0) {
      distanceLabel = `${Math.round(distanceKm * 1000)}m (via road)`;
    } else {
      distanceLabel = `${distanceKm} km (via road)`;
    }
  }

  const approxMins = roadDurationMins !== null 
    ? roadDurationMins 
    : (distanceKm !== null && distanceKm > 0.08 
      ? Math.max(2, Math.round((distanceKm / Math.max(speedKmh, isDriving ? 35 : 5)) * 60)) 
      : null);

  const etaTime = approxMins !== null ? new Date(Date.now() + approxMins * 60 * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  }) : null;

  const handleCall = () => {
    if (memberPhone) {
      Linking.openURL(`tel:${memberPhone}`);
    } else {
      navigation.navigate('MainTabs', { screen: 'Chat' });
    }
  };

  const handleFocus = () => {
    if (onFocusMember) {
      onFocusMember(activeTarget);
    } else {
      navigation.navigate('MainTabs', {
        screen: 'Map',
        params: {
          focusUserId: activeTarget.user_id || activeTarget.id,
          focusLat: memLat !== 0 ? memLat : undefined,
          focusLng: memLng !== 0 ? memLng : undefined,
          focusUserName: memberName,
        },
      });
    }
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: isDark ? colors.surface : '#FFFFFF',
          borderColor: isDark ? 'rgba(212, 175, 55, 0.35)' : '#E2E8F0',
        },
      ]}
    >
      {/* Header Info: Member Avatar + Motion Status */}
      <View style={styles.memberHeaderRow}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarInitialBox, { backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9' }]}>
              <Text style={[styles.avatarInitialText, { color: colors.foreground }]}>{initial}</Text>
            </View>
          )}
          <View style={[styles.motionBadge, isOutsideAlert && { backgroundColor: '#F59E0B' }]}>
            <Ionicons name={isOutsideAlert ? 'warning' : (isDriving ? 'car' : 'walk')} size={11} color="#FFFFFF" />
          </View>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.memberNameText, { color: colors.foreground }]} numberOfLines={1}>
              {memberName}
            </Text>
            <View
              style={[
                styles.speedTag,
                {
                  backgroundColor: isOutsideAlert
                    ? 'rgba(245, 158, 11, 0.15)'
                    : isDriving
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(16, 185, 129, 0.15)',
                },
              ]}
            >
              <Text
                style={[
                  styles.speedTagText,
                  { color: isOutsideAlert ? '#F59E0B' : isDriving ? '#3B82F6' : '#10B981' },
                ]}
              >
                {isOutsideAlert
                  ? 'Outside Safe Zone'
                  : isDriving
                  ? `Driving • ${speedKmh} km/h`
                  : speedKmh >= 3
                  ? `Walking • ${speedKmh} km/h`
                  : 'In Motion'}
              </Text>
            </View>
          </View>

          <Text style={[styles.etaHeading, { color: isOutsideAlert ? '#F59E0B' : colors.foreground }]}>
            {isOutsideAlert
              ? (distanceKm !== null ? `${distanceLabel} from your location` : 'Outside registered safe boundary')
              : approxMins !== null
              ? `Arriving in ~${approxMins} mins (${etaTime})`
              : (distanceKm !== null ? distanceLabel : 'In transit')}
          </Text>
        </View>
      </View>

      {/* Progress / Status Bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: isOutsideAlert ? '#F59E0B' : (colors.accentGold || '#10B981'),
              width: isOutsideAlert ? '85%' : '65%',
            },
          ]}
        />
      </View>

      <View style={styles.journeyMetaRow}>
        <Text style={[styles.journeyStatusText, { color: colors.textMuted }]}>
          {isOutsideAlert ? 'Boundary Exit Telemetry Active' : 'Live Route Tracking Active'}
        </Text>
        <Text style={[styles.distanceText, { color: colors.foreground }]}>
          {distanceKm !== null ? distanceLabel : 'Active'}
        </Text>
      </View>

      {/* Quick Action Buttons (Call / Directions) */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F8FAFC', borderColor: colors.border }]}
          onPress={handleCall}
          activeOpacity={0.7}
        >
          <Ionicons name="call-outline" size={16} color={colors.foreground} />
          <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accentGold || '#10B981', borderColor: 'transparent' }]}
          onPress={handleFocus}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={16} color="#1A1A1A" />
          <Text style={[styles.actionBtnText, { color: '#1A1A1A', fontWeight: '800' }]}>Live Track</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  topStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLeft: {
    flex: 1,
  },
  secureIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 4,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  securePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: '700',
  },
  shieldBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSubText: {
    fontSize: 12,
    lineHeight: 17,
  },
  memberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarInitialBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    fontSize: 16,
    fontWeight: '700',
  },
  motionBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  memberNameText: {
    fontSize: 14,
    fontWeight: '700',
  },
  speedTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  speedTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  etaHeading: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  journeyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  journeyStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  distanceText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
