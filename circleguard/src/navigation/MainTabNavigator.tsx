import React from 'react';
import { View, StyleSheet } from 'react-native';
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
  const { colors } = useThemeStore();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentGold || '#D4AF37',
        tabBarInactiveTintColor: colors.textMuted || '#737373',
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
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
            <Ionicons name={focused ? 'home' : 'home-outline'} size={21} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarLabel: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={21} color={color} />
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
          tabBarIcon: () => (
            <View style={styles.sosBadge}>
              <Ionicons name="alert-circle" size={22} color="#EF4444" />
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
            <Ionicons name={focused ? 'people' : 'people-outline'} size={21} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={21} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tabBarItem: {
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  sosBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
