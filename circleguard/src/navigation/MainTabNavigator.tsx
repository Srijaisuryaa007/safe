import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useThemeStore } from '../store/useThemeStore';

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  SOS: undefined;
  Circle: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function DummySOS() {
  const { colors } = useThemeStore();
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

interface ThreeDTabIconProps {
  focused: boolean;
  color: string;
  activeTintColor: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  isDark: boolean;
  type: 'home' | 'map' | 'circle' | 'profile';
}

const ThreeDTabIcon: React.FC<ThreeDTabIconProps> = ({
  focused,
  color,
  activeTintColor,
  activeIcon,
  inactiveIcon,
  isDark,
  type,
}) => {
  const scaleAnim = useRef(new Animated.Value(focused ? 1.08 : 1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const rotYAnim = useRef(new Animated.Value(0)).current;
  const rotXAnim = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const bgOpacityAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const dotScaleAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    const useNative = Platform.OS !== 'web';

    if (focused) {
      // 1. Initial 3D spring pop & 360 flip on focus
      flipAnim.setValue(0);
      Animated.parallel([
        Animated.timing(flipAnim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: useNative,
        }),
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.18,
            duration: 130,
            useNativeDriver: useNative,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1.08,
            friction: 4.5,
            tension: 220,
            useNativeDriver: useNative,
          }),
        ]),
        Animated.timing(bgOpacityAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: useNative,
        }),
        Animated.spring(dotScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 240,
          useNativeDriver: useNative,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 200,
          useNativeDriver: useNative,
        }),
        Animated.timing(bgOpacityAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: useNative,
        }),
        Animated.spring(dotScaleAnim, {
          toValue: 0,
          friction: 6,
          tension: 250,
          useNativeDriver: useNative,
        }),
      ]).start();
    }

    // 2. Continuous 3D moving oscillation tailored to each icon (both focused & idle)
    // Focused tab has pronounced 3D amplitude, idle tabs maintain elegant breathing 3D float
    let baseDuration = 2400;
    if (type === 'home') baseDuration = 2400;
    else if (type === 'map') baseDuration = 2800;
    else if (type === 'circle') baseDuration = 2600;
    else if (type === 'profile') baseDuration = 3000;

    const targetRotY = focused ? 1 : 0.45;
    const targetRotX = focused ? 1 : 0.35;
    const targetFloat = focused ? -2.5 : -1.2;
    const returnFloat = focused ? 0.5 : 0.3;

    const motionLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rotYAnim, {
            toValue: targetRotY,
            duration: baseDuration / 2,
            useNativeDriver: useNative,
          }),
          Animated.timing(rotXAnim, {
            toValue: -targetRotX,
            duration: baseDuration / 2,
            useNativeDriver: useNative,
          }),
          Animated.timing(floatAnim, {
            toValue: targetFloat,
            duration: baseDuration / 2,
            useNativeDriver: useNative,
          }),
        ]),
        Animated.parallel([
          Animated.timing(rotYAnim, {
            toValue: -targetRotY,
            duration: baseDuration / 2,
            useNativeDriver: useNative,
          }),
          Animated.timing(rotXAnim, {
            toValue: targetRotX,
            duration: baseDuration / 2,
            useNativeDriver: useNative,
          }),
          Animated.timing(floatAnim, {
            toValue: returnFloat,
            duration: baseDuration / 2,
            useNativeDriver: useNative,
          }),
        ]),
      ])
    );

    motionLoop.start();
    return () => motionLoop.stop();
  }, [focused, type]);

  const rotYDeg = rotYAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: type === 'map' ? ['-22deg', '0deg', '22deg'] : ['-16deg', '0deg', '16deg'],
  });

  const rotXDeg = rotXAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  const flipDeg = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isGreen = activeTintColor === '#3DBE6C';
  const pillBg = isGreen
    ? (isDark ? 'rgba(61, 190, 108, 0.16)' : 'rgba(61, 190, 108, 0.12)')
    : (isDark ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.12)');
  const pillBorder = isGreen
    ? (isDark ? 'rgba(61, 190, 108, 0.32)' : 'rgba(61, 190, 108, 0.22)')
    : (isDark ? 'rgba(212, 175, 55, 0.32)' : 'rgba(212, 175, 55, 0.22)');

  return (
    <Animated.View
      style={[
        styles.iconWrapper,
        {
          transform: [
            { perspective: 850 },
            { translateY: floatAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.activePillBackground,
          {
            backgroundColor: pillBg,
            borderColor: pillBorder,
            opacity: bgOpacityAnim,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.inner3DIconContainer,
          {
            transform: [
              { perspective: 850 },
              { rotateY: rotYDeg },
              { rotateX: rotXDeg },
              { rotateZ: flipDeg },
            ],
          },
        ]}
      >
        <Ionicons
          name={focused ? activeIcon : inactiveIcon}
          size={focused ? 19 : 17.5}
          color={color}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.activeDot,
          {
            backgroundColor: activeTintColor,
            transform: [
              { scale: dotScaleAnim },
              { translateY: floatAnim },
            ],
          },
        ]}
      />
    </Animated.View>
  );
};

const ThreeDSosIcon: React.FC<{ focused: boolean }> = ({ focused }) => {
  const rotYAnim = useRef(new Animated.Value(0)).current;
  const rotXAnim = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.35)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const useNative = Platform.OS !== 'web';

    const sosLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.10,
            duration: 850,
            useNativeDriver: useNative,
          }),
          Animated.timing(ringScale, {
            toValue: 1.34,
            duration: 850,
            useNativeDriver: useNative,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.8,
            duration: 850,
            useNativeDriver: useNative,
          }),
          Animated.timing(rotYAnim, {
            toValue: 1,
            duration: 850,
            useNativeDriver: useNative,
          }),
          Animated.timing(rotXAnim, {
            toValue: -1,
            duration: 850,
            useNativeDriver: useNative,
          }),
          Animated.timing(floatAnim, {
            toValue: -2.5,
            duration: 850,
            useNativeDriver: useNative,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 850,
            useNativeDriver: useNative,
          }),
          Animated.timing(ringScale, {
            toValue: 1,
            duration: 850,
            useNativeDriver: useNative,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.25,
            duration: 850,
            useNativeDriver: useNative,
          }),
          Animated.timing(rotYAnim, {
            toValue: -1,
            duration: 850,
            useNativeDriver: useNative,
          }),
          Animated.timing(rotXAnim, {
            toValue: 1,
            duration: 850,
            useNativeDriver: useNative,
          }),
          Animated.timing(floatAnim, {
            toValue: 0.5,
            duration: 850,
            useNativeDriver: useNative,
          }),
        ]),
      ])
    );

    sosLoop.start();
    return () => sosLoop.stop();
  }, []);

  const rotYDeg = rotYAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-18deg', '0deg', '18deg'],
  });

  const rotXDeg = rotXAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-14deg', '0deg', '14deg'],
  });

  return (
    <Animated.View
      style={[
        styles.sosOuterGlow,
        {
          transform: [
            { perspective: 850 },
            { scale: pulseScale },
            { translateY: floatAnim },
            { rotateY: rotYDeg },
            { rotateX: rotXDeg },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.sosPulseHalo,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <View style={styles.sosCenterBadge}>
        <Ionicons name="shield" size={15} color="#EF4444" />
      </View>
    </Animated.View>
  );
};

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { colors, themeMode, isDark } = useThemeStore();

  const activeTintColor = themeMode === 'brand_green' ? '#3DBE6C' : colors.accentGold;
  const inactiveTintColor = isDark ? '#7E8B9B' : '#8C96A5';

  const bottomInset = Platform.OS === 'web' ? 4 : (insets.bottom > 0 ? Math.min(insets.bottom, Platform.OS === 'ios' ? 20 : 12) : 4);
  const barHeight = 44 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: activeTintColor,
        tabBarInactiveTintColor: inactiveTintColor,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderTopColor: isDark ? 'rgba(233, 195, 73, 0.16)' : 'rgba(0, 0, 0, 0.08)',
            height: barHeight,
            paddingBottom: Platform.OS === 'web' ? 8 : bottomInset,
          },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <ThreeDTabIcon
              focused={focused}
              color={color}
              activeTintColor={activeTintColor}
              activeIcon="home"
              inactiveIcon="home-outline"
              isDark={isDark}
              type="home"
            />
          ),
        }}
      />

      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <ThreeDTabIcon
              focused={focused}
              color={color}
              activeTintColor={activeTintColor}
              activeIcon="map"
              inactiveIcon="map-outline"
              isDark={isDark}
              type="map"
            />
          ),
        }}
      />

      <Tab.Screen
        name="SOS"
        component={DummySOS}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation as any).navigate('SOSAlert');
          },
        })}
        options={{
          tabBarLabel: 'SOS',
          tabBarActiveTintColor: '#EF4444',
          tabBarInactiveTintColor: '#EF4444',
          tabBarIcon: ({ focused }) => (
            <ThreeDSosIcon focused={focused} />
          ),
        }}
      />

      <Tab.Screen
        name="Circle"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Circle',
          tabBarIcon: ({ color, focused }) => (
            <ThreeDTabIcon
              focused={focused}
              color={color}
              activeTintColor={activeTintColor}
              activeIcon="people"
              inactiveIcon="people-outline"
              isDark={isDark}
              type="circle"
            />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <ThreeDTabIcon
              focused={focused}
              color={color}
              activeTintColor={activeTintColor}
              activeIcon="person"
              inactiveIcon="person-outline"
              isDark={isDark}
              type="profile"
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    borderRadius: 0,
    borderTopWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    paddingTop: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarItem: {
    height: 42,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 1,
    marginBottom: 0,
    lineHeight: 11,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 22,
    width: 35,
    borderRadius: 11,
  },
  activePillBackground: {
    borderRadius: 11,
    borderWidth: 0.8,
  },
  inner3DIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    position: 'absolute',
    bottom: -1,
  },
  sosOuterGlow: {
    padding: 2,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosPulseHalo: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
  },
  sosCenterBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderWidth: 1.4,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
