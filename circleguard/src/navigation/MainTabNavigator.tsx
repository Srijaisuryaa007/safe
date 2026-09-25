import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ActivityScreen from '../screens/ActivityScreen';
import SOSAlertScreen from '../screens/SOSAlertScreen';
import { useThemeStore } from '../store/useThemeStore';

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Activity: undefined;
  Circle: undefined;
  SOS: undefined;
  Profile?: undefined;
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
  type: 'home' | 'map' | 'circle' | 'activity' | 'profile' | 'sos';
}

const ThreeDTabIcon: React.FC<ThreeDTabIconProps> = React.memo(({
  focused,
  color,
  activeTintColor,
  activeIcon,
  inactiveIcon,
  isDark,
  type,
}) => {
  const scaleAnim = useRef(new Animated.Value(focused ? 1.08 : 1)).current;
  const bgOpacityAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const dotScaleAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    const useNative = Platform.OS !== 'web';

    if (focused) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.08,
          friction: 6,
          tension: 300,
          useNativeDriver: useNative,
        }),
        Animated.timing(bgOpacityAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: useNative,
        }),
        Animated.spring(dotScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 300,
          useNativeDriver: useNative,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 250,
          useNativeDriver: useNative,
        }),
        Animated.timing(bgOpacityAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: useNative,
        }),
        Animated.spring(dotScaleAnim, {
          toValue: 0,
          friction: 7,
          tension: 250,
          useNativeDriver: useNative,
        }),
      ]).start();
    }
  }, [focused]);

  const isSos = type === 'sos';
  const isBillion = activeTintColor === '#2E7D5B' || activeTintColor === '#183CE6';
  const isGreen = activeTintColor === '#3DBE6C';
  const pillBg = isSos
    ? (isDark ? 'rgba(239, 68, 68, 0.20)' : 'rgba(239, 68, 68, 0.14)')
    : isBillion
    ? 'rgba(46, 125, 91, 0.14)'
    : isGreen
    ? (isDark ? 'rgba(61, 190, 108, 0.16)' : 'rgba(61, 190, 108, 0.12)')
    : (isDark ? 'rgba(212, 175, 55, 0.16)' : 'rgba(212, 175, 55, 0.12)');
  const pillBorder = isSos
    ? (isDark ? 'rgba(239, 68, 68, 0.42)' : 'rgba(239, 68, 68, 0.28)')
    : isBillion
    ? 'rgba(46, 125, 91, 0.25)'
    : isGreen
    ? (isDark ? 'rgba(61, 190, 108, 0.32)' : 'rgba(61, 190, 108, 0.22)')
    : (isDark ? 'rgba(212, 175, 55, 0.32)' : 'rgba(212, 175, 55, 0.22)');

  const iconColor = isSos
    ? (focused ? '#EF4444' : (isDark ? '#F87171' : '#DC2626'))
    : color;
  const dotColor = isSos ? '#EF4444' : activeTintColor;

  return (
    <Animated.View
      style={[
        styles.iconWrapper,
        {
          transform: [{ scale: scaleAnim }],
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

      <View style={styles.inner3DIconContainer}>
        <Ionicons
          name={focused ? activeIcon : inactiveIcon}
          size={focused ? 19 : 17.5}
          color={iconColor}
        />
      </View>

      <Animated.View
        style={[
          styles.activeDot,
          {
            backgroundColor: dotColor,
            transform: [{ scale: dotScaleAnim }],
          },
        ]}
      />
    </Animated.View>
  );
});

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, themeMode, isDark } = useThemeStore();

  const activeTintColor = isDark ? '#3ADFAB' : '#2E7D5B';
  const inactiveTintColor = isDark ? '#CAD5CE' : '#717871';

  // Floating pill dock geometry:
  // Guarantee identical gaps on both left and right sides so the 'C' curves float
  // with the exact same margin from the phone edges, overriding React Navigation's default start/end styles.
  const isWide = windowWidth > 480;
  const sideGap = isWide
    ? Math.max(32, Math.round((windowWidth - 380) / 2))
    : (windowWidth <= 375 ? 24 : 32);
  const pillWidth = isWide ? 380 : undefined;
  const bottomOffset = Platform.OS === 'web' ? 14 : Math.max(insets.bottom, 8) + 8;
  const barHeight = 58;

  return (
    <Tab.Navigator
      detachInactiveScreens={true}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        freezeOnBlur: true,
        lazy: true,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: activeTintColor,
        tabBarInactiveTintColor: inactiveTintColor,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: isDark ? '#141A17' : 'rgba(255, 255, 255, 0.97)',
            borderColor: isDark ? '#26342D' : '#EDEBE6',
            bottom: bottomOffset,
            height: barHeight,
            left: sideGap,
            right: sideGap,
            start: sideGap,
            end: sideGap,
            width: pillWidth,
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
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <ThreeDTabIcon
              focused={focused}
              color={color}
              activeTintColor={activeTintColor}
              activeIcon="time"
              inactiveIcon="time-outline"
              isDark={isDark}
              type="profile"
            />
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
        name="SOS"
        component={SOSAlertScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation as any).navigate('SOSAlert');
          },
        })}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text
              style={[
                styles.tabBarLabel,
                { color: focused ? '#EF4444' : (isDark ? '#F87171' : '#DC2626') },
              ]}
            >
              SOS
            </Text>
          ),
          tabBarIcon: ({ focused }) => (
            <ThreeDTabIcon
              focused={focused}
              color={focused ? '#EF4444' : (isDark ? '#F87171' : '#DC2626')}
              activeTintColor="#EF4444"
              activeIcon="warning"
              inactiveIcon="warning-outline"
              isDark={isDark}
              type="sos"
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
    borderRadius: 29,
    borderWidth: 1.2,
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    paddingHorizontal: 6,
    paddingTop: 0,
    paddingBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarItem: {
    height: 50,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 1,
    marginBottom: 0,
    lineHeight: 12,
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
