import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import MapScreen from '../screens/MapScreen';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error?.toString() || 'Unknown error' };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ff3b30', marginBottom: 8 }}>Screen Error</Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 }}>{this.state.error}</Text>
          <TouchableOpacity 
            style={{ backgroundColor: '#0066cc', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: '' })}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export type MainTabParamList = {
  Map: undefined;
  Members: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function SafeMapScreen(props: any) {
  return (
    <ErrorBoundary>
      <MapScreen {...props} />
    </ErrorBoundary>
  );
}

function SafeDashboardScreen(props: any) {
  return (
    <ErrorBoundary>
      <DashboardScreen {...props} />
    </ErrorBoundary>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator detachInactiveScreens={false} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Map" component={SafeMapScreen} />
      <Tab.Screen name="Members" component={SafeDashboardScreen} />
    </Tab.Navigator>
  );
}
