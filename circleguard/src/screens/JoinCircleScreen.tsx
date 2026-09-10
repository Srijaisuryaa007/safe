import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Vibration,
  Animated,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { RateLimiter } from '../services/RateLimiter';
import { ValidationSchema } from '../lib/validationSchema';
import { handleServiceError } from '../lib/errorHandler';

export default function JoinCircleScreen() {
  const { colors, isDark } = useThemeStore();
  const route = useRoute<any>();
  const initialTab = route.params?.initialTab === 'code' ? 'code' : 'qr';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'code' | 'qr'>(initialTab);
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  
  const scanLaserAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation<any>();
  const { profile, user } = useAuthStore();
  const { setActiveCircle } = useCircleStore();

  const userId = profile?.id || user?.id;

  useEffect(() => {
    if (activeTab === 'qr') {
      if (permission && !permission.granted && permission.canAskAgain) {
        requestPermission();
      }
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLaserAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(scanLaserAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [activeTab, permission]);

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        const validation = ValidationSchema.validateInviteCode(text);
        if (validation.valid && validation.value) {
          setCode(validation.value);
          setErrorMsg('');
        } else {
          setCode(text.trim());
          setErrorMsg(validation.error || 'Clipboard content is not a valid invite code.');
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const executeJoin = async (targetCode: string) => {
    setErrorMsg('');

    // Strict schema validation (reject rather than sanitize)
    const codeValidation = ValidationSchema.validateInviteCode(targetCode);
    if (!codeValidation.valid) {
      setErrorMsg(codeValidation.error || 'Please enter a valid 6-character private invite code.');
      return;
    }
    const cleanCode = codeValidation.value!;

    if (!userId) {
      setErrorMsg('User session expired. Please sign in again.');
      return;
    }

    // Rate limit public invite code lookups to prevent brute force enumeration
    const limitCheck = await RateLimiter.checkLimit('PUBLIC_INVITE_CODE');
    if (!limitCheck.allowed) {
      setErrorMsg(`Too many verification attempts. Please wait ${limitCheck.retryAfterSec}s before retrying.`);
      return;
    }

    setLoading(true);
    try {
      // 1. Find circle by invite code OR circle id
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode);
      let query = supabase.from('circles').select('*');
      if (isUuid) {
        query = query.eq('id', cleanCode);
      } else {
        query = query.ilike('invite_code', cleanCode);
      }
      const { data: circleData, error: circleError } = await query.maybeSingle();

      if (circleError) {
        await RateLimiter.recordAttempt('PUBLIC_INVITE_CODE', false);
        throw circleError;
      }

      if (!circleData) {
        await RateLimiter.recordAttempt('PUBLIC_INVITE_CODE', false);
        setErrorMsg(`No active circle found matching "${cleanCode}". Please verify with the circle owner.`);
        return;
      }

      await RateLimiter.recordAttempt('PUBLIC_INVITE_CODE', true);

      // 2. Check if user is already a member
      const { data: existingMember } = await supabase
        .from('circle_members')
        .select('*')
        .eq('circle_id', circleData.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingMember) {
        // Already a member, switch active circle with persistence
        await useCircleStore.getState().addCreatedCircle(circleData as any, userId);
        Alert.alert(
          'Circle Switched',
          `You are already a member of "${circleData.name}". Active circle updated.`,
          [{ text: 'CONTINUE', onPress: () => navigation.goBack() }]
        );
        return;
      }

      // 3. Join circle
      const { error: joinError } = await supabase
        .from('circle_members')
        .insert([
          {
            circle_id: circleData.id,
            user_id: userId,
            role: 'member'
          }
        ]);

      if (joinError) {
        throw joinError;
      }

      // 4. Save circle to store with persistence & fetch members
      await useCircleStore.getState().addCreatedCircle(circleData as any, userId);
      Alert.alert(
        'Joined Circle!',
        `Successfully joined "${circleData.name}".`,
        [{ text: 'CONTINUE', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      setErrorMsg(handleServiceError('JoinCircle:executeJoin', err, 'Unable to join circle. Please check the code and try again.'));
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    Vibration.vibrate(80);

    let raw = data.trim();
    try {
      if (raw.startsWith('{') && raw.endsWith('}')) {
        const parsed = JSON.parse(raw);
        if (parsed.invite_code) raw = parsed.invite_code;
        else if (parsed.code) raw = parsed.code;
        else if (parsed.circle_id) raw = parsed.circle_id;
      }
    } catch (e) {}

    if (raw.includes('code=')) {
      raw = raw.split('code=')[1].split('&')[0];
    } else if (raw.includes('join/')) {
      raw = raw.split('join/')[1].split('?')[0];
    }

    const cleanCode = raw.replace(/[^A-Za-z0-9-]/g, '').trim().toUpperCase();

    if (cleanCode.length >= 6) {
      const codeToUse = cleanCode.slice(0, cleanCode.length > 8 ? 36 : 6);
      setCode(codeToUse);
      executeJoin(codeToUse);
    } else {
      setErrorMsg(`Scanned QR is not a valid circle code: "${data}"`);
      setScanned(false);
    }
  };

  const startScanner = async () => {
    setErrorMsg('');
    setActiveTab('qr');
    setScanned(false);
    if (!permission?.granted) {
      await requestPermission();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Join Circle</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Dual Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9' }]}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'code' && [styles.activeTabBtn, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }],
          ]}
          onPress={() => {
            setActiveTab('code');
            setErrorMsg('');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="keypad-outline" size={16} color={activeTab === 'code' ? (isDark ? '#38BDF8' : '#0F172A') : colors.textMuted} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'code' ? colors.foreground : colors.textMuted }]}>
            ENTER CODE
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'qr' && [styles.activeTabBtn, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }],
          ]}
          onPress={startScanner}
          activeOpacity={0.8}
        >
          <Ionicons name="qr-code-outline" size={16} color={activeTab === 'qr' ? (isDark ? '#38BDF8' : '#0F172A') : colors.textMuted} />
          <Text style={[styles.tabBtnText, { color: activeTab === 'qr' ? colors.foreground : colors.textMuted }]}>
            SCAN QR CODE
          </Text>
        </TouchableOpacity>
      </View>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      {activeTab === 'code' ? (
        <View style={styles.form}>
          <Text style={[styles.inputHint, { color: colors.textMuted }]}>
            Enter or paste the 6-character encryption key provided by the circle owner.
          </Text>

          <View style={styles.inputWrap}>
            <TextInput
              style={[
                styles.input,
                styles.codeInput,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0', 
                  color: colors.foreground,
                }
              ]}
              placeholder="e.g. 8HGTT0"
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={(t) => {
                setCode(t.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
                if (errorMsg) setErrorMsg('');
              }}
              autoCapitalize="characters"
              maxLength={8}
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.pasteBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}
              onPress={handlePaste}
              activeOpacity={0.7}
            >
              <Ionicons name="clipboard-outline" size={16} color={colors.foreground} />
              <Text style={[styles.pasteBtnText, { color: colors.foreground }]}>PASTE</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[
              styles.button, 
              { 
                backgroundColor: isDark ? '#F8FAFC' : '#0F172A',
                opacity: loading || code.trim().length < 6 ? 0.6 : 1,
              }
            ]} 
            onPress={() => executeJoin(code)} 
            disabled={loading || code.trim().length < 6}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={isDark ? '#0F172A' : '#FFFFFF'} />
            ) : (
              <Text style={[styles.buttonText, { color: isDark ? '#0F172A' : '#FFFFFF' }]}>JOIN CIRCLE</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* Camera QR Code Scanner */
        <View style={styles.scannerContainer}>
          {!permission?.granted ? (
            <View style={styles.permissionCard}>
              <View style={[styles.permOrb, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' }]}>
                <Ionicons name="camera-outline" size={32} color={isDark ? '#38BDF8' : '#0F172A'} />
              </View>
              <Text style={[styles.permTitle, { color: colors.foreground }]}>Camera Permission Needed</Text>
              <Text style={[styles.permSub, { color: colors.textMuted }]}>
                Allow camera access to automatically scan circle invitation QR codes.
              </Text>
              <TouchableOpacity style={[styles.permBtn, { backgroundColor: isDark ? '#F8FAFC' : '#0F172A' }]} onPress={requestPermission}>
                <Text style={[styles.permBtnText, { color: isDark ? '#0F172A' : '#FFFFFF' }]}>GRANT CAMERA PERMISSION</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraBox}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              />

              {/* Torch Toggle Button */}
              <TouchableOpacity
                style={styles.torchBtn}
                onPress={() => setTorch(!torch)}
                activeOpacity={0.7}
              >
                <Ionicons name={torch ? 'flash' : 'flash-outline'} size={18} color={torch ? '#F59E0B' : '#FFFFFF'} />
              </TouchableOpacity>

              {/* Viewfinder Reticle Overlay */}
              <View style={styles.viewfinderBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {/* Animated Laser Beam */}
                <Animated.View
                  style={[
                    styles.laserLine,
                    {
                      transform: [
                        {
                          translateY: scanLaserAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [10, 210],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>

              <Text style={styles.scannerPrompt}>Align circle QR code inside the frame</Text>

              {loading ? (
                <View style={styles.scanLoader}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.scanLoaderText}>Verifying invite key...</Text>
                </View>
              ) : null}

              {scanned && !loading ? (
                <TouchableOpacity
                  style={styles.rescanBtn}
                  onPress={() => {
                    setScanned(false);
                    setErrorMsg('');
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.rescanBtnText}>RESCAN QR CODE</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 42,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    marginBottom: 24,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  activeTabBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  form: {
    gap: 16,
  },
  inputHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginBottom: 16,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    padding: 18,
    borderWidth: 1,
    fontSize: 16,
    borderRadius: 14,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 6,
    paddingRight: 80,
  },
  pasteBtn: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pasteBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  button: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  scannerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionCard: {
    alignItems: 'center',
    padding: 24,
    maxWidth: 320,
  },
  permOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  permSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  permBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cameraBox: {
    width: '100%',
    height: 380,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  viewfinderBox: {
    width: 230,
    height: 230,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    position: 'absolute',
    top: 0,
  },
  scannerPrompt: {
    position: 'absolute',
    bottom: 20,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  scanLoader: {
    position: 'absolute',
    top: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  scanLoaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  torchBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  rescanBtn: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  rescanBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
