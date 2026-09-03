import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

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

export default function MainTabNavigator() {
  const { colors, themeMode, isDark } = useThemeStore();

  const activeTintColor = themeMode === 'brand_green' ? '#3DBE6C' : colors.accentGold;
  const inactiveTintColor = isDark ? '#7E8B9B' : '#8C96A5';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeTintColor,
        tabBarInactiveTintColor: inactiveTintColor,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderTopColor: isDark ? 'rgba(233, 195, 73, 0.18)' : 'rgba(0, 0, 0, 0.08)',
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
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={19} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: activeTintColor }]} />}
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? 'map' : 'map-outline'} size={19} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: activeTintColor }]} />}
            </View>
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
          tabBarIcon: () => (
            <View style={styles.sosCenterBadge}>
              <Ionicons name="shield" size={15} color="#EF4444" />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Circle"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Circle',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? 'people' : 'people-outline'} size={19} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: activeTintColor }]} />}
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={19} color={color} />
              {focused && <View style={[styles.activeDot, { backgroundColor: activeTintColor }]} />}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 78 : 58,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 22 : 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarItem: {
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 22,
  },
  activeDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    position: 'absolute',
    bottom: -4,
  },
  // Centered SOS Badge (aligned in center with all other tabs, no upward offset)
  sosCenterBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
