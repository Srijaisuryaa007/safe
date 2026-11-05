import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Vibration,
  ScrollView,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Gyroscope } from 'expo-sensors';
import RadarPulseBeacon from './RadarPulseBeacon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Free-roaming spacious card dimensions (NO cramped box!)
const CARD_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.82), 340);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 0.65); // ~215px, spacious luxury landscape ratio
const CARD_GAP = 14;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;
const HORIZONTAL_PADDING = Math.max(16, Math.round((SCREEN_WIDTH - CARD_WIDTH) / 2));

export interface ReactBitsParallaxCardsProps {
  members: any[];
  activeCircle?: any;
  isDark?: boolean;
  circlePlaces?: any[];
  trueLeaderId?: string | null;
  currentUserId?: string;
  onLocateMember?: (member: any) => void;
  onChatMember?: (member: any) => void;
  onCallMember?: (member: any) => void;
  onMemberActions?: (member: any) => void;
}

interface ArtTheme {
  id: string;
  name: string;
  renderSvg: (w: number, h: number, uid: string) => React.ReactNode;
}

// 8 Signature Artwork Themes matching React Bits Pro Parallax Cards
const CARD_ART_THEMES: ArtTheme[] = [
  {
    id: 'sunset_split',
    name: 'Sunset Split',
    // Signature fiery red-orange gradient with diagonal dark cut (React Bits Pro Center Card)
    renderSvg: (w: number, h: number, uid: string) => (
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`sunsetGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="85%">
            <Stop offset="0%" stopColor="#FF1E44" />
            <Stop offset="38%" stopColor="#FF4D00" />
            <Stop offset="72%" stopColor="#FF6B00" />
            <Stop offset="100%" stopColor="#D81B60" />
          </LinearGradient>
          <LinearGradient id={`darkWedge_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#1E0728" />
            <Stop offset="60%" stopColor="#0E0117" />
            <Stop offset="100%" stopColor="#05000A" />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#sunsetGrad_${uid})`} />
        <Path
          d={`M0,${h * 0.42} L${w * 0.82},${h * 0.88} L${w},${h * 0.72} L${w},${h} L0,${h} Z`}
          fill={`url(#darkWedge_${uid})`}
        />
      </Svg>
    ),
  },
  {
    id: 'planet_horizon',
    name: 'Planet Horizon',
    // Deep purple with glowing pink planet rising over dark horizon
    renderSvg: (w: number, h: number, uid: string) => (
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`skyGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#310D59" />
            <Stop offset="50%" stopColor="#4A1578" />
            <Stop offset="100%" stopColor="#130224" />
          </LinearGradient>
          <RadialGradient id={`sunGlow_${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF5A79" />
            <Stop offset="65%" stopColor="#FF1E56" />
            <Stop offset="100%" stopColor="#B3003B" />
          </RadialGradient>
          <LinearGradient id={`duneGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#1B0433" />
            <Stop offset="100%" stopColor="#0B0017" />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#skyGrad_${uid})`} />
        <Circle cx={w * 0.44} cy={h * 0.42} r={w * 0.28} fill={`url(#sunGlow_${uid})`} />
        <Path
          d={`M0,${h * 0.62} Q${w * 0.5},${h * 0.46} ${w},${h * 0.38} L${w},${h} L0,${h} Z`}
          fill={`url(#duneGrad_${uid})`}
        />
      </Svg>
    ),
  },
  {
    id: 'golden_ribbon',
    name: 'Golden Ribbon',
    // Deep plum with glowing golden-amber 3D U-tube horseshoe ribbon
    renderSvg: (w: number, h: number, uid: string) => (
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`bgUGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#3F0635" />
            <Stop offset="60%" stopColor="#250020" />
            <Stop offset="100%" stopColor="#120010" />
          </LinearGradient>
          <LinearGradient id={`uRibbon_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFEA61" />
            <Stop offset="35%" stopColor="#FFAA00" />
            <Stop offset="75%" stopColor="#FF6600" />
            <Stop offset="100%" stopColor="#D92027" />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#bgUGrad_${uid})`} />
        <Path
          d={`M${w * 0.22},${-6} 
              C${w * 0.22},${h * 0.78} ${w * 0.78},${h * 0.78} ${w * 0.78},${-6} 
              L${w * 0.92},${-6} 
              C${w * 0.92},${h * 0.94} ${w * 0.08},${h * 0.94} ${w * 0.08},${-6} Z`}
          fill={`url(#uRibbon_${uid})`}
        />
      </Svg>
    ),
  },
  {
    id: 'torus_rings',
    name: 'Magenta Torus',
    // Deep violet with glowing hot magenta 3D torus ring
    renderSvg: (w: number, h: number, uid: string) => (
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`bgTorus_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#320452" />
            <Stop offset="70%" stopColor="#19002B" />
            <Stop offset="100%" stopColor="#0B0014" />
          </LinearGradient>
          <RadialGradient id={`ringGlow_${uid}`} cx="45%" cy="45%" r="55%">
            <Stop offset="0%" stopColor="#FF1493" />
            <Stop offset="60%" stopColor="#FF007F" />
            <Stop offset="100%" stopColor="#800045" />
          </RadialGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#bgTorus_${uid})`} />
        <Circle cx={w * 0.38} cy={h * 0.58} r={w * 0.36} fill={`url(#ringGlow_${uid})`} />
        <Circle cx={w * 0.38} cy={h * 0.58} r={w * 0.20} fill="#140024" />
      </Svg>
    ),
  },
  {
    id: 'fuchsia_wave',
    name: 'Fuchsia Wave',
    // Deep violet with glowing undulating neon-fuchsia wave ribbon
    renderSvg: (w: number, h: number, uid: string) => (
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`bgWave_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#250543" />
            <Stop offset="60%" stopColor="#140026" />
            <Stop offset="100%" stopColor="#080012" />
          </LinearGradient>
          <LinearGradient id={`wavePink_${uid}`} x1="0%" y1="50%" x2="100%" y2="50%">
            <Stop offset="0%" stopColor="#FF0080" />
            <Stop offset="50%" stopColor="#FF3377" />
            <Stop offset="100%" stopColor="#FF6644" />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#bgWave_${uid})`} />
        <Path
          d={`M0,${h * 0.65} 
              Q${w * 0.32},${h * 0.35} ${w * 0.65},${h * 0.62} 
              T${w},${h * 0.40} 
              L${w},${h * 0.68} 
              Q${w * 0.65},${h * 0.88} ${w * 0.32},${h * 0.62} 
              T0,${h * 0.90} Z`}
          fill={`url(#wavePink_${uid})`}
        />
      </Svg>
    ),
  },
  {
    id: 'isometric_stairs',
    name: 'Isometric Stairs',
    // 3D stepped blocks in glowing purple & magenta
    renderSvg: (w: number, h: number, uid: string) => (
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`bgStairs_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#2A0845" />
            <Stop offset="100%" stopColor="#10001D" />
          </LinearGradient>
          <LinearGradient id={`stairTop_${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#D946EF" />
            <Stop offset="100%" stopColor="#A855F7" />
          </LinearGradient>
          <LinearGradient id={`stairSide_${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#7E22CE" />
            <Stop offset="100%" stopColor="#3B0764" />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#bgStairs_${uid})`} />
        <Path d={`M${w * 0.12},${h * 0.68} L${w * 0.52},${h * 0.68} L${w * 0.52},${h * 0.96} L${w * 0.12},${h * 0.96} Z`} fill={`url(#stairSide_${uid})`} />
        <Path d={`M${w * 0.35},${h * 0.44} L${w * 0.82},${h * 0.44} L${w * 0.82},${h * 0.68} L${w * 0.35},${h * 0.68} Z`} fill={`url(#stairTop_${uid})`} />
        <Path d={`M${w * 0.58},${h * 0.20} L${w},${h * 0.20} L${w},${h * 0.44} L${w * 0.58},${h * 0.44} Z`} fill={`url(#stairSide_${uid})`} />
      </Svg>
    ),
  },
  {
    id: 'geometric_wedge',
    name: 'Prism Wedge',
    // Geometric faceted prism wedges in crimson & violet
    renderSvg: (w: number, h: number, uid: string) => (
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`bgWedge_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#38072E" />
            <Stop offset="100%" stopColor="#140012" />
          </LinearGradient>
          <LinearGradient id={`wedgeGrad_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FF1E44" />
            <Stop offset="50%" stopColor="#9C27B0" />
            <Stop offset="100%" stopColor="#4A148C" />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#bgWedge_${uid})`} />
        <Path d={`M${w * 0.2},0 L${w * 0.95},${h * 0.82} L${w * 0.05},${h} Z`} fill={`url(#wedgeGrad_${uid})`} />
      </Svg>
    ),
  },
  {
    id: 'cosmic_orb',
    name: 'Cosmic Nebula',
    // Deep velvet indigo with vibrant pink/violet nebula core
    renderSvg: (w: number, h: number, uid: string) => (
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`bgAurora_${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#1A0B2E" />
            <Stop offset="100%" stopColor="#0B0014" />
          </LinearGradient>
          <RadialGradient id={`auroraOrb_${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF2E93" />
            <Stop offset="70%" stopColor="#9B51E0" />
            <Stop offset="100%" stopColor="#2E0854" />
          </RadialGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#bgAurora_${uid})`} />
        <Circle cx={w * 0.45} cy={h * 0.5} r={w * 0.34} fill={`url(#auroraOrb_${uid})`} />
      </Svg>
    ),
  },
];

/**
 * Free-Roaming React Bits Pro Parallax Cards
 * 
 * - NO outer confining box: Cards roam freely across the screen.
 * - Fluid horizontal scrolling with 3D CoverFlow perspective, scale, and snap physics.
 * - Option to view in horizontal 3D deck or vertical 3D stream.
 * - Each card has full spaciousness, beautiful abstract artwork, live battery, and direct 1-tap actions.
 */
export const ReactBitsParallaxCards: React.FC<ReactBitsParallaxCardsProps> = ({
  members = [],
  activeCircle,
  isDark = true,
  circlePlaces = [],
  trueLeaderId,
  currentUserId,
  onLocateMember,
  onChatMember,
  onCallMember,
  onMemberActions,
}) => {
  const [scrollMode, setScrollMode] = useState<'horizontal' | 'vertical'>('horizontal');
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null);

  // Phone Gyroscope tilt support
  const gyroX = useRef(new Animated.Value(0)).current;
  const gyroY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: any = null;
    let isSubscribed = true;

    (async () => {
      try {
        const available = await Gyroscope.isAvailableAsync();
        if (!available || !isSubscribed) return;

        Gyroscope.setUpdateInterval(50);
        sub = Gyroscope.addListener(({ x, y }) => {
          const targetX = Math.max(-1, Math.min(1, y * 0.4));
          const targetY = Math.max(-1, Math.min(1, -x * 0.4));

          Animated.parallel([
            Animated.timing(gyroX, {
              toValue: targetX,
              duration: 80,
              useNativeDriver: true,
            }),
            Animated.timing(gyroY, {
              toValue: targetY,
              duration: 80,
              useNativeDriver: true,
            }),
          ]).start();
        });
      } catch (_) {}
    })();

    return () => {
      isSubscribed = false;
      if (sub) {
        try { sub.remove(); } catch (_) {}
      }
    };
  }, []);

  const safeMembers = useMemo(() => {
    if (!members || members.length === 0) return [];
    return members;
  }, [members]);

  if (safeMembers.length === 0) return null;

  // Scroll to a member card smoothly
  const scrollToMember = (index: number) => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(8); } catch (_) {}
    }
    setActiveIndex(index);
    if (scrollMode === 'horizontal' && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * SNAP_INTERVAL,
        animated: true,
      });
    }
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / SNAP_INTERVAL);
        if (index >= 0 && index < safeMembers.length && index !== activeIndex) {
          setActiveIndex(index);
        }
      },
    }
  );

  return (
    <View style={styles.roamContainer}>
      {/* Top Controls: 3D Parallax Badge + Horizontal / Vertical Scroll Switcher */}
      <View style={styles.topControlRow}>
        <View
          style={[
            styles.deckBadgePill,
            isDark && { backgroundColor: 'rgba(245, 166, 35, 0.12)', borderColor: 'rgba(245, 166, 35, 0.3)' },
          ]}
        >
          <Ionicons name="sparkles" size={10} color={isDark ? '#F5A623' : '#D97706'} />
          <Text style={[styles.deckBadgeText, { color: isDark ? '#F5A623' : '#D97706' }]}>
            3D PARALLAX
          </Text>
        </View>

        <View style={[styles.modeToggleWrap, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.12)' }]}>
          <TouchableOpacity
            style={[
              styles.modeToggleBtn,
              scrollMode === 'horizontal' && (isDark ? styles.modeToggleActiveDark : styles.modeToggleActiveLight),
            ]}
            onPress={() => {
              if (Platform.OS !== 'web') {
                try { Vibration.vibrate(8); } catch (_) {}
              }
              setScrollMode('horizontal');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="swap-horizontal"
              size={12}
              color={scrollMode === 'horizontal' ? (isDark ? '#000000' : '#FFFFFF') : (isDark ? '#94A3B8' : '#64748B')}
            />
            <Text
              style={[
                styles.modeToggleText,
                isDark && { color: '#94A3B8' },
                scrollMode === 'horizontal' && (isDark ? { color: '#000000', fontWeight: '800' } : { color: '#FFFFFF', fontWeight: '800' }),
              ]}
            >
              Horizontal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeToggleBtn,
              scrollMode === 'vertical' && (isDark ? styles.modeToggleActiveDark : styles.modeToggleActiveLight),
            ]}
            onPress={() => {
              if (Platform.OS !== 'web') {
                try { Vibration.vibrate(8); } catch (_) {}
              }
              setScrollMode('vertical');
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="swap-vertical"
              size={12}
              color={scrollMode === 'vertical' ? (isDark ? '#000000' : '#FFFFFF') : (isDark ? '#94A3B8' : '#64748B')}
            />
            <Text
              style={[
                styles.modeToggleText,
                isDark && { color: '#94A3B8' },
                scrollMode === 'vertical' && (isDark ? { color: '#000000', fontWeight: '800' } : { color: '#FFFFFF', fontWeight: '800' }),
              ]}
            >
              Vertical
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ============================================================== */}
      {/* 1. HORIZONTAL ROAMING 3D PARALLAX DECK (NO OUTER BOX!) */}
      {/* ============================================================== */}
      {scrollMode === 'horizontal' ? (
        <View style={styles.horizontalWrap}>
          <Animated.ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: HORIZONTAL_PADDING,
              alignItems: 'center',
              paddingVertical: 12,
            }}
            snapToInterval={SNAP_INTERVAL}
            snapToAlignment="center"
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={handleScroll}
          >
            {safeMembers.map((member, index) => {
              const theme = CARD_ART_THEMES[index % CARD_ART_THEMES.length];
              const memberUserId = member?.user_id || member?.id;
              const isSelf = memberUserId === currentUserId;
              const isTargetOwner = Boolean(memberUserId && trueLeaderId && memberUserId === trueLeaderId);
              const effectiveRole = isTargetOwner
                ? 'owner'
                : member?.role === 'owner'
                ? 'co_leader'
                : member?.role || 'member';

              const roleLabel =
                effectiveRole === 'owner'
                  ? 'Circle Leader'
                  : effectiveRole === 'co_leader'
                  ? 'Co-Leader'
                  : effectiveRole === 'guardian'
                  ? 'Guardian'
                  : 'Member';

              const name = member?.profile?.full_name || `Member ${index + 1}`;
              const isOnline = member?.isOnline !== false;
              const isDriving = Boolean(member?.isDriving);
              const batteryPctVal = member?.batteryPct ?? 96;
              const batteryStr = member?.batteryPct != null ? `${member.batteryPct}%` : '96%';
              const isLowBattery = batteryPctVal <= 20;

              const matchedPlace = circlePlaces.find((p) => p.id === member?.latestPlaceEvent?.place_id);
              const isInSafePlace = member?.latestPlaceEvent?.event_type === 'arrival';
              const placeName = matchedPlace?.name
                ? matchedPlace.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()
                : 'Safe Zone';

              // 3D Parallax & CoverFlow Interpolations
              const inputRange = [
                (index - 1) * SNAP_INTERVAL,
                index * SNAP_INTERVAL,
                (index + 1) * SNAP_INTERVAL,
              ];

              const scale = scrollX.interpolate({
                inputRange,
                outputRange: [0.90, 1.0, 0.90],
                extrapolate: 'clamp',
              });

              const rotateY = scrollX.interpolate({
                inputRange,
                outputRange: ['14deg', '0deg', '-14deg'],
                extrapolate: 'clamp',
              });

              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.75, 1.0, 0.75],
                extrapolate: 'clamp',
              });

              const glareShiftX = scrollX.interpolate({
                inputRange,
                outputRange: [-180, 0, 180],
                extrapolate: 'clamp',
              });

              const glareOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.08, 0.35, 0.08],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={`roam_card_${memberUserId || index}`}
                  style={[
                    styles.roamCardItem,
                    {
                      width: CARD_WIDTH,
                      height: CARD_HEIGHT,
                      marginRight: CARD_GAP,
                      opacity,
                      transform: [
                        { perspective: 950 },
                        { scale },
                        { rotateY },
                      ],
                    },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => onMemberActions?.(member)}
                    style={styles.cardTouchWrapper}
                  >
                    {/* Glowing Outer Card Border (Crisp white border matching React Bits Pro) */}
                    <View
                      style={[
                        styles.roamCardBorder,
                        index === activeIndex && styles.roamCardBorderActive,
                      ]}
                    >
                      {/* Rich Vector Artwork Wallpaper */}
                      {theme.renderSvg(CARD_WIDTH, CARD_HEIGHT, `roam_${memberUserId || index}`)}

                      {/* Specular Sheen Glare */}
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.specularGlare,
                          {
                            opacity: glareOpacity,
                            transform: [
                              { translateX: glareShiftX },
                              { rotate: '32deg' },
                            ],
                          },
                        ]}
                      />

                      {/* Card Overlay Content */}
                      <View style={styles.cardOverlayContent}>
                        {/* Top Bar: Role Pill + Battery Pill */}
                        <View style={styles.cardTopRow}>
                          <View style={styles.glassRolePill}>
                            <Ionicons name="sparkles" size={10} color="#FFD700" />
                            <Text style={styles.glassRoleText}>{roleLabel.toUpperCase()}</Text>
                          </View>

                          <View
                            style={[
                              styles.glassBatteryPill,
                              isLowBattery && { backgroundColor: 'rgba(239, 68, 68, 0.45)', borderColor: '#EF4444' },
                            ]}
                          >
                            <Ionicons
                              name={isLowBattery ? 'battery-dead' : 'battery-charging'}
                              size={11}
                              color={isLowBattery ? '#FCA5A5' : '#34D399'}
                            />
                            <Text style={styles.glassBatteryText}>{batteryStr}</Text>
                          </View>
                        </View>

                        {/* Bottom Row: Member Avatar + Full Name + Live State */}
                        <View style={styles.cardBottomDock}>
                          <View style={styles.dockAvatarBox}>
                            <RadarPulseBeacon
                              size={44}
                              color={isDriving ? '#F5A623' : isOnline ? '#10B981' : '#64748B'}
                              isPulsing={isOnline || isDriving}
                            >
                              {member?.profile?.avatar_url ? (
                                <Image source={{ uri: member.profile.avatar_url }} style={styles.dockAvatarImg} />
                              ) : (
                                <View style={styles.dockAvatarFallback}>
                                  <Text style={styles.dockAvatarFallbackText}>{name.charAt(0).toUpperCase()}</Text>
                                </View>
                              )}
                            </RadarPulseBeacon>
                          </View>

                          <View style={styles.dockBioCol}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Text style={styles.dockNameText} numberOfLines={1}>
                                {name}
                              </Text>
                              {isSelf && (
                                <View style={styles.dockYouBadge}>
                                  <Text style={styles.dockYouBadgeText}>YOU</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.dockStatusRow}>
                              <View
                                style={[
                                  styles.dockStatusDot,
                                  { backgroundColor: isDriving ? '#F5A623' : isOnline ? '#10B981' : '#94A3B8' },
                                ]}
                              />
                              <Text style={styles.dockStatusText} numberOfLines={1}>
                                {isDriving ? 'Moving in transit' : isInSafePlace ? `At ${placeName}` : isOnline ? 'Active on radar' : 'Offline'}
                              </Text>
                            </View>
                          </View>

                          {/* Quick 1-Tap Locate Icon */}
                          <TouchableOpacity
                            style={styles.dockQuickLocateBtn}
                            onPress={() => onLocateMember?.(member)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="navigate" size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </Animated.ScrollView>

          {/* 1-Tap Action Dock for Active Member (Centered, Matching Card Width) */}
          {safeMembers.length > 0 && (() => {
            const activeMember = safeMembers[activeIndex] || safeMembers[0];
            return (
              <View
                style={[
                  styles.horizontalActionDock,
                  isDark
                    ? { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }
                    : { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
                ]}
              >
                <TouchableOpacity
                  style={[styles.cardActionBtn, styles.cardActionBtnPrimary]}
                  onPress={() => onLocateMember?.(activeMember)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="navigate" size={13} color="#FFFFFF" />
                  <Text style={styles.cardActionBtnPrimaryText}>Locate</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cardActionBtn,
                    styles.cardActionBtnSecondary,
                    isDark && { backgroundColor: '#181A20', borderColor: 'rgba(255, 255, 255, 0.1)' },
                  ]}
                  onPress={() => onChatMember?.(activeMember)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
                  <Text style={[styles.cardActionBtnSecondaryText, isDark && { color: '#FFFFFF' }]}>Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cardActionBtn,
                    styles.cardActionBtnSecondary,
                    isDark && { backgroundColor: '#181A20', borderColor: 'rgba(255, 255, 255, 0.1)' },
                  ]}
                  onPress={() => onCallMember?.(activeMember)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
                  <Text style={[styles.cardActionBtnSecondaryText, isDark && { color: '#FFFFFF' }]}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cardActionBtn,
                    styles.cardActionBtnSecondary,
                    isDark && { backgroundColor: '#181A20', borderColor: 'rgba(255, 255, 255, 0.1)' },
                  ]}
                  onPress={() => onMemberActions?.(activeMember)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="options-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
                  <Text style={[styles.cardActionBtnSecondaryText, isDark && { color: '#FFFFFF' }]}>Actions</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* Quick-Scroll Luxury Avatar Selector Ticker (Centered & Symmetrical) */}
          {safeMembers.length > 1 && (
            <View
              style={[
                styles.avatarTickerWrap,
                isDark
                  ? { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }
                  : { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  styles.avatarTickerScroll,
                  safeMembers.length <= 7 && { justifyContent: 'center' },
                ]}
              >
                {safeMembers.map((m, idx) => {
                  const isSelected = idx === activeIndex;
                  const mName = m?.profile?.full_name || `Member ${idx + 1}`;
                  return (
                    <TouchableOpacity
                      key={`ticker_${m.user_id || idx}`}
                      style={[
                        styles.tickerAvatarBtn,
                        isSelected
                          ? (isDark ? styles.tickerAvatarBtnActiveDark : styles.tickerAvatarBtnActiveLight)
                          : (isDark ? { borderColor: 'rgba(255, 255, 255, 0.12)' } : { borderColor: '#E2E8F0' }),
                      ]}
                      onPress={() => scrollToMember(idx)}
                      activeOpacity={0.7}
                    >
                      {m?.profile?.avatar_url ? (
                        <Image source={{ uri: m.profile.avatar_url }} style={styles.tickerAvatarImg} />
                      ) : (
                        <View style={[styles.tickerAvatarFallback, isDark && { backgroundColor: '#1E293B' }]}>
                          <Text style={styles.tickerAvatarFallbackText}>{mName.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      {isSelected && (
                        <View
                          style={[
                            styles.tickerActiveDot,
                            isDark
                              ? { backgroundColor: '#FFD700', borderColor: '#000000' }
                              : { backgroundColor: '#0F172A', borderColor: '#FFFFFF' },
                          ]}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      ) : (
        /* ============================================================== */
        /* 2. VERTICAL ROAMING 3D STREAM (NO OUTER BOX!) */
        /* ============================================================== */
        <View style={styles.verticalWrap}>
          {safeMembers.map((member, index) => {
            const theme = CARD_ART_THEMES[index % CARD_ART_THEMES.length];
            const memberUserId = member?.user_id || member?.id;
            const isSelf = memberUserId === currentUserId;
            const isTargetOwner = Boolean(memberUserId && trueLeaderId && memberUserId === trueLeaderId);
            const effectiveRole = isTargetOwner
              ? 'owner'
              : member?.role === 'owner'
              ? 'co_leader'
              : member?.role || 'member';

            const roleLabel =
              effectiveRole === 'owner'
                ? 'Circle Leader'
                : effectiveRole === 'co_leader'
                ? 'Co-Leader'
                : effectiveRole === 'guardian'
                ? 'Guardian'
                : 'Member';

            const name = member?.profile?.full_name || `Member ${index + 1}`;
            const isOnline = member?.isOnline !== false;
            const isDriving = Boolean(member?.isDriving);
            const batteryPctVal = member?.batteryPct ?? 96;
            const batteryStr = member?.batteryPct != null ? `${member.batteryPct}%` : '96%';
            const isLowBattery = batteryPctVal <= 20;

            const matchedPlace = circlePlaces.find((p) => p.id === member?.latestPlaceEvent?.place_id);
            const isInSafePlace = member?.latestPlaceEvent?.event_type === 'arrival';
            const placeName = matchedPlace?.name
              ? matchedPlace.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()
              : 'Safe Zone';

            return (
              <View
                key={`vert_card_${memberUserId || index}`}
                style={styles.verticalCardItem}
              >
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => onMemberActions?.(member)}
                  style={[styles.verticalCardTouch, { height: CARD_HEIGHT }]}
                >
                  <View style={styles.roamCardBorder}>
                    {/* Rich Vector Artwork */}
                    {theme.renderSvg(SCREEN_WIDTH - 32, CARD_HEIGHT, `vert_${memberUserId || index}`)}

                    {/* Card Content Overlay */}
                    <View style={styles.cardOverlayContent}>
                      <View style={styles.cardTopRow}>
                        <View style={styles.glassRolePill}>
                          <Ionicons name="sparkles" size={10} color="#FFD700" />
                          <Text style={styles.glassRoleText}>{roleLabel.toUpperCase()}</Text>
                        </View>

                        <View
                          style={[
                            styles.glassBatteryPill,
                            isLowBattery && { backgroundColor: 'rgba(239, 68, 68, 0.45)', borderColor: '#EF4444' },
                          ]}
                        >
                          <Ionicons
                            name={isLowBattery ? 'battery-dead' : 'battery-charging'}
                            size={11}
                            color={isLowBattery ? '#FCA5A5' : '#34D399'}
                          />
                          <Text style={styles.glassBatteryText}>{batteryStr}</Text>
                        </View>
                      </View>

                      <View style={styles.cardBottomDock}>
                        <View style={styles.dockAvatarBox}>
                          <RadarPulseBeacon
                            size={44}
                            color={isDriving ? '#F5A623' : isOnline ? '#10B981' : '#64748B'}
                            isPulsing={isOnline || isDriving}
                          >
                            {member?.profile?.avatar_url ? (
                              <Image source={{ uri: member.profile.avatar_url }} style={styles.dockAvatarImg} />
                            ) : (
                              <View style={styles.dockAvatarFallback}>
                                <Text style={styles.dockAvatarFallbackText}>{name.charAt(0).toUpperCase()}</Text>
                              </View>
                            )}
                          </RadarPulseBeacon>
                        </View>

                        <View style={styles.dockBioCol}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={styles.dockNameText} numberOfLines={1}>
                              {name}
                            </Text>
                            {isSelf && (
                              <View style={styles.dockYouBadge}>
                                <Text style={styles.dockYouBadgeText}>YOU</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.dockStatusRow}>
                            <View
                              style={[
                                styles.dockStatusDot,
                                { backgroundColor: isDriving ? '#F5A623' : isOnline ? '#10B981' : '#94A3B8' },
                              ]}
                            />
                            <Text style={styles.dockStatusText} numberOfLines={1}>
                              {isDriving ? 'Moving in transit' : isInSafePlace ? `At ${placeName}` : isOnline ? 'Active on radar' : 'Offline'}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.dockQuickLocateBtn}
                          onPress={() => onLocateMember?.(member)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="navigate" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Action Buttons for Vertical Card */}
                <View style={[styles.cardActionDock, isDark && { backgroundColor: '#101114', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
                  <TouchableOpacity
                    style={[styles.cardActionBtn, styles.cardActionBtnPrimary]}
                    onPress={() => onLocateMember?.(member)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="navigate" size={12} color="#FFFFFF" />
                    <Text style={styles.cardActionBtnPrimaryText}>Locate</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cardActionBtn, styles.cardActionBtnSecondary, isDark && { backgroundColor: '#181A20', borderColor: 'rgba(255, 255, 255, 0.1)' }]}
                    onPress={() => onChatMember?.(member)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={12} color={isDark ? '#FFFFFF' : '#0F172A'} />
                    <Text style={[styles.cardActionBtnSecondaryText, isDark && { color: '#FFFFFF' }]}>Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cardActionBtn, styles.cardActionBtnSecondary, isDark && { backgroundColor: '#181A20', borderColor: 'rgba(255, 255, 255, 0.1)' }]}
                    onPress={() => onCallMember?.(member)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call-outline" size={12} color={isDark ? '#FFFFFF' : '#0F172A'} />
                    <Text style={[styles.cardActionBtnSecondaryText, isDark && { color: '#FFFFFF' }]}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.cardActionBtn, styles.cardActionBtnSecondary, isDark && { backgroundColor: '#181A20', borderColor: 'rgba(255, 255, 255, 0.1)' }]}
                    onPress={() => onMemberActions?.(member)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="options-outline" size={12} color={isDark ? '#FFFFFF' : '#0F172A'} />
                    <Text style={[styles.cardActionBtnSecondaryText, isDark && { color: '#FFFFFF' }]}>Actions</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  roamContainer: {
    width: '100%',
    marginBottom: 16,
  },
  // Top control bar
  topControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginBottom: 10,
  },
  deckBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  deckBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modeToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modeToggleActiveLight: {
    backgroundColor: '#0F172A',
  },
  modeToggleActiveDark: {
    backgroundColor: '#FFFFFF',
  },
  modeToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  // Horizontal layout
  horizontalWrap: {
    width: '100%',
  },
  roamCardItem: {
    justifyContent: 'flex-start',
  },
  cardTouchWrapper: {
    width: '100%',
    height: '100%',
  },
  roamCardBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.55)', // Crisp white border matching React Bits Pro
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 12,
  },
  roamCardBorderActive: {
    borderColor: 'rgba(255, 255, 255, 0.85)',
    shadowOpacity: 0.65,
    shadowRadius: 26,
    elevation: 16,
  },
  specularGlare: {
    position: 'absolute',
    top: -150,
    bottom: -150,
    width: 140,
    backgroundColor: '#FFFFFF',
    zIndex: 4,
  },
  cardOverlayContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    zIndex: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glassRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassRoleText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 0.4,
  },
  glassBatteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  glassBatteryText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardBottomDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  dockAvatarBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dockAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  dockAvatarFallbackText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  dockBioCol: {
    flex: 1,
  },
  dockNameText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  dockYouBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dockYouBadgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#000000',
  },
  dockStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dockStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dockStatusText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  dockQuickLocateBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Action buttons dock below card (Vertical mode)
  cardActionDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  // Dedicated Action Dock for Active Member in Horizontal Mode (Aligned with Card)
  horizontalActionDock: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardActionBtn: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cardActionBtnPrimary: {
    backgroundColor: '#0F172A',
  },
  cardActionBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardActionBtnSecondary: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardActionBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  // Avatar Ticker Dock (Centered & Symmetrical)
  avatarTickerWrap: {
    width: CARD_WIDTH,
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  avatarTickerScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    flexGrow: 1,
  },
  tickerAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickerAvatarBtnActiveLight: {
    borderColor: '#0F172A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  tickerAvatarBtnActiveDark: {
    borderColor: '#FFD700',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  tickerAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  tickerAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickerAvatarFallbackText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  tickerActiveDot: {
    position: 'absolute',
    bottom: -3,
    alignSelf: 'center',
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  // Vertical layout
  verticalWrap: {
    width: '100%',
    gap: 16,
  },
  verticalCardItem: {
    width: '100%',
  },
  verticalCardTouch: {
    width: '100%',
  },
});

export default ReactBitsParallaxCards;
