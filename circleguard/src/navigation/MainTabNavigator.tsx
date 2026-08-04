import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.border }],
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={20} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={20} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="SOS"
        component={DummySOS}
        options={({ navigation }) => ({
          tabBarButton: () => (
            <TouchableOpacity
              style={styles.sosTabBtn}
              onPress={() => (navigation as any).navigate('SOSAlert')}
              activeOpacity={0.85}
            >
              <Ionicons name="alert-circle" size={26} color="#D4AF37" />
              <Text style={styles.sosTabLabel}>SOS</Text>
            </TouchableOpacity>
          ),
        })}
      />

      <Tab.Screen
        name="Circle"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={20} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={20} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 70,
    paddingBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  tabBarLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  sosTabBtn: {
    top: -20,
    width: 58,
    height: 58,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D4AF37',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  sosTabLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginTop: -2,
  },
});
