import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { generateInviteCode } from '../lib/utils';
import { ValidationSchema } from '../lib/validationSchema';
import { handleServiceError } from '../lib/errorHandler';
import BatteryOptimizationGuideModal from '../components/BatteryOptimizationGuideModal';
import BuildingRoomLoaderModal from '../components/BuildingRoomLoaderModal';
import { oemBatteryOptimizationService } from '../services/OemBatteryOptimizationService';

export default function CreateCircleScreen() {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);
  const { colors, isDark } = useThemeStore();
  const [name, setName] = useState('');
  const [trackingMode, setTrackingMode] = useState<'continuous' | 'privacy'>('continuous');
  const [showBatteryModal, setShowBatteryModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigation = useNavigation<any>();
  const { profile, user } = useAuthStore();
  const { setActiveCircle } = useCircleStore();

  const userId = profile?.id || user?.id;

  const handleCreate = async () => {
    setErrorMsg('');

    // Strict schema validation
    const nameValidation = ValidationSchema.validateCircleName(name);
    if (!nameValidation.valid) {
      setErrorMsg(nameValidation.error || 'Invalid circle name.');
      return;
    }

    if (!userId) {
      setErrorMsg('User authentication session expired. Please sign in again.');
      return;
    }

    const startTime = Date.now();
    setLoading(true);
    try {
      const inviteCode = generateInviteCode();
      
      // 1. Create the circle with chosen tracking_mode
      const { data: circleData, error: circleError } = await supabase
        .from('circles')
        .insert([
          { 
            name: name.trim(),
            owner_id: userId,
            invite_code: inviteCode,
            tracking_mode: trackingMode,
          }
        ])
        .select()
        .single();

      if (circleError) throw circleError;

      // 2. Add creator as owner member
      const { error: memberError } = await supabase
        .from('circle_members')
        .insert([
          {
            circle_id: circleData.id,
            user_id: userId,
            role: 'owner'
          }
        ]);

      if (memberError) throw memberError;

      // 3. Save circle to store with persistence & fetch members
      await useCircleStore.getState().addCreatedCircle(circleData as any, userId);

      // Guarantee minimum showcase of ~3-4 building steps so the room creation animation is appreciated
      const elapsed = Date.now() - startTime;
      const minDisplayMs = 3200;
      if (elapsed < minDisplayMs) {
        await new Promise((resolve) => setTimeout(resolve, minDisplayMs - elapsed));
      }

      setLoading(false);

      if (trackingMode === 'continuous' && Platform.OS === 'android') {
        Alert.alert(
          'Circle Created — Action Required',
          `Your circle "${circleData.name}" is set to Continuous 24/7 Safety Mode (Option B).\n\nTo ensure Android never pauses tracking while driving or moving, set CircleGuard's battery usage to "Unrestricted":\n\nSettings ➔ Apps ➔ CircleGuard ➔ Battery ➔ Unrestricted (Don't optimize).`,
          [
            {
              text: 'SET TO "UNRESTRICTED" NOW',
              onPress: async () => {
                await oemBatteryOptimizationService.openSettings();
                navigation.goBack();
              },
            },
            {
              text: 'DONE',
              onPress: () => navigation.goBack(),
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert(
          'Circle Created',
          `Your circle "${circleData.name}" is ready with ${trackingMode === 'continuous' ? 'Continuous 24/7 Safety Tracking' : 'Privacy-First Disconnect'} mode!`,
          [{ text: 'CONTINUE', onPress: () => navigation.goBack() }]
        );
      }
    } catch (err: any) {
      setErrorMsg(handleServiceError('CreateCircle:handleCreate', err, 'Failed to create circle. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { paddingTop: topInset + 14 }]}>
      <TouchableOpacity
        style={[
          styles.backBtn,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
          },
        ]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={20} color={colors.foreground} />
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.foreground }]}>Create a New Circle</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Family, Private Group, or Friends</Text>

      <View style={styles.form}>
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        
        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>CIRCLE NAME</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#CBD5E1',
              color: colors.foreground,
            },
          ]}
          placeholder="e.g. My Family Circle"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>LOCATION TRACKING BEHAVIOR</Text>

        <TouchableOpacity
          style={[
            styles.modeCard,
            {
              backgroundColor: trackingMode === 'continuous'
                ? (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC')
                : colors.surface,
              borderColor: trackingMode === 'continuous'
                ? (isDark ? '#FFFFFF' : '#0F172A')
                : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0'),
            },
          ]}
          onPress={() => {
            setTrackingMode('continuous');
            if (Platform.OS === 'android') {
              setShowBatteryModal(true);
            }
          }}
          activeOpacity={0.8}
        >
          <View style={styles.modeCardHeader}>
            <Ionicons name="pulse" size={20} color={isDark ? '#38BDF8' : '#0284C7'} />
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>OPTION B: CONTINUOUS 24/7 TRACKING</Text>
            {trackingMode === 'continuous' ? (
              <Ionicons name="checkmark-circle" size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
            ) : null}
          </View>
          <Text style={[styles.modeSubtext, { color: colors.textMuted }]}>
            Location sharing & geofence alerts continue running in the background even when members close or swipe away the app. Best for family & child safety tracking.
          </Text>

          {/* Android Battery Optimization Prompt Callout */}
          {Platform.OS === 'android' && trackingMode === 'continuous' && (
            <View style={[styles.batteryCallout, isDark && styles.batteryCalloutDark]}>
              <View style={styles.batteryCalloutHeader}>
                <Ionicons name="battery-charging" size={16} color={isDark ? '#34D399' : '#059669'} />
                <Text style={[styles.batteryCalloutTitle, isDark && { color: '#34D399' }]}>
                  RECOMMENDED FOR 24/7 MOTION TRACKING
                </Text>
              </View>
              <Text style={[styles.batteryCalloutDesc, isDark && { color: '#94A3B8' }]}>
                To ensure Android never pauses tracking while driving or moving:
                {'\n'}
                <Text style={[styles.batteryPathHighlight, isDark && { color: '#FFFFFF' }]}>
                  Settings ➔ Apps ➔ CircleGuard ➔ Battery ➔ Unrestricted (Don't optimize)
                </Text>
              </Text>
              <TouchableOpacity
                style={[styles.batterySettingsBtn, isDark && styles.batterySettingsBtnDark]}
                onPress={() => setShowBatteryModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={14} color={isDark ? '#FFFFFF' : '#0F172A'} />
                <Text style={[styles.batterySettingsBtnText, isDark && { color: '#FFFFFF' }]}>
                  Set Battery to "Unrestricted"
                </Text>
                <Ionicons name="chevron-forward" size={14} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeCard,
            {
              backgroundColor: trackingMode === 'privacy'
                ? (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC')
                : colors.surface,
              borderColor: trackingMode === 'privacy'
                ? (isDark ? '#FFFFFF' : '#0F172A')
                : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0'),
            },
          ]}
          onPress={() => setTrackingMode('privacy')}
          activeOpacity={0.8}
        >
          <View style={styles.modeCardHeader}>
            <Ionicons name="power-outline" size={20} color="#F59E0B" />
            <Text style={[styles.modeTitle, { color: colors.foreground }]}>OPTION A: PRIVACY-FIRST DISCONNECT</Text>
            {trackingMode === 'privacy' ? (
              <Ionicons name="checkmark-circle" size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
            ) : null}
          </View>
          <Text style={[styles.modeSubtext, { color: colors.textMuted }]}>
            Location tracking automatically disconnects and stops sharing when members close or swipe away the app. Shows member status as Offline when app is closed.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.button,
            {
              backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.3 : 0.18,
              shadowRadius: 10,
              elevation: 4,
            },
          ]} 
          onPress={handleCreate} 
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={isDark ? '#000000' : '#FFFFFF'} />
          ) : (
            <View style={styles.buttonContent}>
              <Text style={[styles.buttonText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                CREATE CIRCLE
              </Text>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={isDark ? '#000000' : '#FFFFFF'}
                style={{ marginLeft: 6 }}
              />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <BatteryOptimizationGuideModal
        visible={showBatteryModal}
        onClose={() => setShowBatteryModal(false)}
      />

      {/* Building Room 1-Second Vector SVG Architecture Loading Modal */}
      <BuildingRoomLoaderModal
        visible={loading}
        size={72}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    fontWeight: '500',
  },
  form: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 6,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  input: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.2,
    fontSize: 16,
    fontWeight: '600',
  },
  modeCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    gap: 8,
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    flex: 1,
  },
  modeSubtext: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  batteryCallout: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 6,
  },
  batteryCalloutDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  batteryCalloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batteryCalloutTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.6,
  },
  batteryCalloutDesc: {
    fontSize: 11.5,
    color: '#4B5563',
    lineHeight: 16,
  },
  batteryPathHighlight: {
    fontWeight: '700',
    color: '#0F172A',
  },
  batterySettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 4,
  },
  batterySettingsBtnDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  batterySettingsBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
});
