import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNetworkStore } from '../store/useNetworkStore';
import { flushOfflineBreadcrumbs } from '../services/OfflineLocationQueueService';

type NetworkState = 'good' | 'slow' | 'offline';

export default function NetworkStatusBanner() {
  const { colors, isDark } = useThemeStore();
  const { profile } = useAuthStore();

  const [networkState, setNetworkState] = useState<NetworkState>('good');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  const translateY = useRef(new Animated.Value(-120)).current;
  const prevStateRef = useRef<NetworkState>('good');

  const checkNetworkSpeed = async () => {
    setIsChecking(true);
    const startTime = Date.now();

    // Check navigator.onLine on web first
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.onLine) {
      handleStateTransition('offline');
      setIsChecking(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s hard timeout

      // Ping lightweight 204 with no-cors on web to avoid browser CORS block
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        mode: Platform.OS === 'web' ? 'no-cors' : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      setLatencyMs(duration);

      // In no-cors mode, status is 0 (opaque response) which indicates network success
      if (response.ok || response.status === 204 || response.type === 'opaque') {
        if (duration > 2200) {
          // Slow Network (> 2.2 seconds latency)
          handleStateTransition('slow');
        } else {
          // Healthy fast network
          handleStateTransition('good');
        }
      } else {
        handleStateTransition('slow');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        handleStateTransition('slow');
      } else {
        handleStateTransition('offline');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleStateTransition = (newState: NetworkState) => {
    const prevState = prevStateRef.current;
    prevStateRef.current = newState;
    useNetworkStore.getState().setNetworkState(newState, latencyMs);

    if (prevState !== 'good' && newState === 'good') {
      // Transition from slow/offline back to healthy! Show "Restored" pill briefly and flush queued GPS points
      setShowRestored(true);
      setNetworkState('good');
      setDismissed(false);

      if (profile?.id) {
        flushOfflineBreadcrumbs(profile.id);
      }

      setTimeout(() => {
        setShowRestored(false);
      }, 3000);
      return;
    }

    if (newState !== prevState) {
      setDismissed(false);
      setNetworkState(newState);
    }
  };

  // Run periodic health checks (every 45 seconds to preserve CPU/battery)
  useEffect(() => {
    checkNetworkSpeed();
    const interval = setInterval(checkNetworkSpeed, 45000);
    return () => clearInterval(interval);
  }, []);

  // Slide animation trigger
  useEffect(() => {
    const shouldShow = (!dismissed && (networkState === 'slow' || networkState === 'offline')) || showRestored;

    Animated.spring(translateY, {
      toValue: shouldShow ? 0 : -140,
      useNativeDriver: true,
      damping: 18,
      stiffness: 140,
    }).start();
  }, [networkState, dismissed, showRestored]);

  const isSlow = networkState === 'slow';
  const isOffline = networkState === 'offline';

  if (networkState === 'good' && !showRestored) {
    return null;
  }

  // UI/UX Pro Max Liquid Glass Palette
  const bannerBg = showRestored
    ? 'rgba(10, 32, 22, 0.94)'
    : isOffline
    ? 'rgba(32, 12, 14, 0.95)'
    : 'rgba(32, 26, 12, 0.94)';

  const borderColor = showRestored
    ? 'rgba(16, 185, 129, 0.6)'
    : isOffline
    ? 'rgba(239, 68, 68, 0.55)'
    : 'rgba(233, 195, 73, 0.55)';

  const accentColor = showRestored
    ? '#10B981'
    : isOffline
    ? '#EF4444'
    : '#E9C349';

  const textColor = '#FFFFFF';
  const subtextColor = 'rgba(255, 255, 255, 0.78)';

  return (
    <Animated.View style={[styles.floatingContainer, { transform: [{ translateY }] }]}>
      <View
        style={[
          styles.bannerCard,
          {
            backgroundColor: bannerBg,
            borderColor: borderColor,
            shadowColor: isOffline ? '#EF4444' : isSlow ? '#F59E0B' : '#10B981',
          },
        ]}
      >
        {/* Left Icon */}
        <View style={styles.iconContainer}>
          {showRestored ? (
            <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
          ) : isOffline ? (
            <Ionicons name="cloud-offline" size={22} color="#FFFFFF" />
          ) : (
            <View style={styles.slowIconWrapper}>
              <Ionicons name="cellular-outline" size={20} color={textColor} />
              <View style={styles.turtleBadge}>
                <Ionicons name="warning" size={10} color="#D97706" />
              </View>
            </View>
          )}
        </View>

        {/* Content Box */}
        <View style={styles.textBox}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: textColor }]}>
              {showRestored
                ? 'Back Online'
                : isOffline
                ? 'No Internet Connection'
                : 'Slow Network Detected'}
            </Text>
            {latencyMs && isSlow ? (
              <Text style={[styles.latencyPill, { color: subtextColor }]}>
                {latencyMs > 1000 ? `${(latencyMs / 1000).toFixed(1)}s delay` : `${latencyMs}ms`}
              </Text>
            ) : null}
          </View>

          <Text style={[styles.subtitle, { color: subtextColor }]} numberOfLines={1}>
            {showRestored
              ? 'Safety GPS connection fully restored.'
              : isOffline
              ? 'Using offline safety cache. Reconnecting...'
              : 'Live tracking & sync may experience slight delays.'}
          </Text>
        </View>

        {/* Right Action Buttons */}
        <View style={styles.actionsRow}>
          {!showRestored ? (
            <TouchableOpacity
              onPress={checkNetworkSpeed}
              style={[styles.retryBtn, { borderColor: borderColor }]}
              disabled={isChecking}
              activeOpacity={0.7}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color={textColor} />
              ) : (
                <Ionicons name="refresh" size={16} color={textColor} />
              )}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={() => setDismissed(true)}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={textColor} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 999,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 12,
  },
  iconContainer: {
    marginRight: 11,
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  slowIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  turtleBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    backgroundColor: '#E9C349',
    borderRadius: 6,
    padding: 1,
  },
  textBox: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  latencyPill: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.85,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
