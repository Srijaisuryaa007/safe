import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
  Vibration,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '../store/useThemeStore';
import { useCircleStore } from '../store/useCircleStore';
import { WALKAWAY_VIDEO_DATA_URI } from '../constants/walkawayVideo';

const WebViewAny: any = WebView;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WalkawayLeaveCircleModal() {
  const { isDark, colors } = useThemeStore();
  const navigation = useNavigation<any>();
  const { walkawayLeaveState, closeWalkawayLeaveModal } = useCircleStore();
  const { visible, circleName, status, errorMessage, actionType } = walkawayLeaveState;
  const isDelete = actionType === 'delete';

  const [stepperText, setStepperText] = useState('Severing real-time GPS stream...');
  const progressAnim = useRef(new Animated.Value(0.1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Resolve local Metro/bundled mp4 asset or fallback to offline base64 data URI
  let resolvedVideoUri = WALKAWAY_VIDEO_DATA_URI;
  try {
    const asset = Image.resolveAssetSource(require('../../assets/walkaway.mp4'));
    if (asset?.uri) {
      resolvedVideoUri = asset.uri;
    }
  } catch (_) {}

  // Animated progress bar and step progression while leaving or deleting
  useEffect(() => {
    if (visible && status === 'leaving') {
      setStepperText(
        isDelete
          ? 'Severing circle telemetry & member links...'
          : 'Severing real-time GPS stream...'
      );
      progressAnim.setValue(0.1);
      Animated.timing(progressAnim, {
        toValue: 0.95,
        duration: 2300,
        useNativeDriver: false,
      }).start();

      // Pulsing indicator
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      // Stepper text updates
      const t1 = setTimeout(() => {
        setStepperText(
          isDelete
            ? 'Erasing circle geofences & safe zones...'
            : 'Unlinking boundary & safe place alerts...'
        );
      }, 750);

      const t2 = setTimeout(() => {
        setStepperText(
          isDelete
            ? 'Purging circle records from cloud database...'
            : 'Removing identity from circle roster...'
        );
      }, 1550);

      return () => {
        pulseLoop.stop();
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else if (status === 'left') {
      Animated.timing(progressAnim, {
        toValue: 1.0,
        duration: 200,
        useNativeDriver: false,
      }).start();

      try {
        Vibration.vibrate(80);
      } catch (e) {}
    }
  }, [visible, status, isDelete]);

  if (!visible) return null;

  const handleDone = () => {
    closeWalkawayLeaveModal();
    // If navigation can navigate to Home / Dashboard
    try {
      if (navigation?.navigate) {
        navigation.navigate('Home');
      }
    } catch (e) {}
  };

  const videoHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background: #0B0D11;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: 16px;
      background: #0B0D11;
    }
  </style>
</head>
<body>
  <video id="vid" autoplay loop muted playsinline webkit-playsinline preload="auto">
    <source src="${resolvedVideoUri}" type="video/mp4">
    <source src="${WALKAWAY_VIDEO_DATA_URI}" type="video/mp4">
  </video>
  <script>
    function triggerPlay() {
      var v = document.getElementById('vid');
      if (v) {
        v.muted = true;
        v.defaultMuted = true;
        v.playsInline = true;
        var p = v.play();
        if (p !== undefined) {
          p.catch(function(e) {
            setTimeout(triggerPlay, 100);
          });
        }
      }
    }
    document.addEventListener('DOMContentLoaded', triggerPlay);
    window.addEventListener('load', triggerPlay);
    setTimeout(triggerPlay, 30);
    setTimeout(triggerPlay, 150);
  </script>
</body>
</html>`;

  const isLeaving = status === 'leaving';
  const hasLeft = status === 'left';
  const isError = status === 'error';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={hasLeft ? handleDone : undefined}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#101319' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#E2E8F0',
            },
          ]}
        >
          {/* Top Status Header */}
          <View style={styles.headerRow}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: hasLeft
                    ? 'rgba(255, 255, 255, 0.12)'
                    : isError
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'rgba(255, 255, 255, 0.08)',
                  borderColor: hasLeft
                    ? (isDark ? '#FFFFFF' : '#0F172A')
                    : isError
                    ? '#EF4444'
                    : (isDark ? 'rgba(255, 255, 255, 0.25)' : '#CBD5E1'),
                },
              ]}
            >
              {isLeaving ? (
                <Animated.View
                  style={[
                    styles.pulsingDot,
                    {
                      backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                />
              ) : hasLeft ? (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={isDark ? '#FFFFFF' : '#0F172A'}
                />
              ) : (
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
              )}
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: isError
                      ? '#EF4444'
                      : isDark
                      ? '#FFFFFF'
                      : '#0F172A',
                  },
                ]}
              >
                {isLeaving
                  ? isDelete
                    ? 'DESTROYING CIRCLE • PURGING DATA'
                    : 'DISCONNECTING • TELEMETRY SHUTDOWN'
                  : hasLeft
                  ? isDelete
                    ? 'CIRCLE PERMANENTLY DELETED'
                    : 'CIRCLE MEMBERSHIP TERMINATED'
                  : isDelete
                  ? 'DELETION ERROR'
                  : 'DEPARTURE ERROR'}
              </Text>
            </View>
          </View>

          {/* Video Showcase Card */}
          <View
            style={[
              styles.videoContainer,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : '#E2E8F0',
                backgroundColor: '#0B0D11',
              },
            ]}
          >
            {Platform.OS === 'web' ? (
              // @ts-ignore
              <video
                src={WALKAWAY_VIDEO_DATA_URI}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 16,
                  display: 'block',
                }}
              />
            ) : (
              <WebViewAny
                originWhitelist={['*']}
                source={{ html: videoHtml }}
                style={{ width: '100%', height: '100%', backgroundColor: '#0B0D11' }}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scrollEnabled={false}
                bounces={false}
                androidLayerType="hardware"
              />
            )}

            {/* Video Watermark Pill */}
            <View style={styles.videoPillOverlay}>
              <Ionicons
                name={isDelete ? 'trash-outline' : 'footsteps-outline'}
                size={12}
                color="#FFFFFF"
              />
              <Text style={styles.videoPillText}>
                {isDelete ? 'DESTRUCTION SEQUENCE' : 'DEPARTURE ANIMATION'}
              </Text>
            </View>
          </View>

          {/* Dynamic Content Section */}
          <View style={styles.contentSection}>
            {isLeaving ? (
              <>
                <Text
                  style={[
                    styles.primaryTitle,
                    { color: isDark ? '#FFFFFF' : '#0F172A' },
                  ]}
                >
                  {isDelete
                    ? `Deleting ${circleName || 'Circle'}...`
                    : `Leaving ${circleName || 'Circle'}...`}
                </Text>

                <Text
                  style={[
                    styles.subDescription,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {stepperText}
                </Text>

                {/* Progress Bar */}
                <View
                  style={[
                    styles.progressTrack,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#F1F5F9',
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
              </>
            ) : hasLeft ? (
              <>
                <Text
                  style={[
                    styles.primaryTitle,
                    { color: isDark ? '#FFFFFF' : '#0F172A' },
                  ]}
                >
                  {isDelete ? 'Circle Permanently Deleted' : 'You Have Left the Circle'}
                </Text>

                <Text
                  style={[
                    styles.subDescription,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {isDelete ? (
                    <>
                      You have permanently dissolved{' '}
                      <Text style={{ fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                        "{circleName || 'the circle'}"
                      </Text>
                      . All shared locations, boundaries, history, and member connections have been completely erased.
                    </>
                  ) : (
                    <>
                      You have safely departed{' '}
                      <Text style={{ fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                        "{circleName || 'the circle'}"
                      </Text>
                      . Your live location, speed, and safety events are no longer shared with
                      members of this circle.
                    </>
                  )}
                </Text>

                {/* Status Pills */}
                <View style={styles.pillsRow}>
                  <View
                    style={[
                      styles.infoPill,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : '#F1F5F9',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : '#E2E8F0',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isDelete ? 'trash-bin-outline' : 'location-outline'}
                      size={13}
                      color={isDark ? '#94A3B8' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.infoPillText,
                        { color: isDark ? '#E2E8F0' : '#1E293B' },
                      ]}
                    >
                      {isDelete ? 'Circle Erased' : 'Stream Inactive'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.infoPill,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : '#F1F5F9',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : '#E2E8F0',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isDelete ? 'people-outline' : 'shield-outline'}
                      size={13}
                      color={isDark ? '#94A3B8' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.infoPillText,
                        { color: isDark ? '#E2E8F0' : '#1E293B' },
                      ]}
                    >
                      {isDelete ? 'Members Disconnected' : 'Alerts Cleared'}
                    </Text>
                  </View>
                </View>

                {/* High Contrast Action Button */}
                <TouchableOpacity
                  style={[
                    styles.doneButton,
                    {
                      backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                      shadowColor: '#000000',
                    },
                  ]}
                  onPress={handleDone}
                  activeOpacity={0.88}
                >
                  <Text
                    style={[
                      styles.doneButtonText,
                      { color: isDark ? '#000000' : '#FFFFFF' },
                    ]}
                  >
                    DONE • RETURN TO SAFETY HUB
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={isDark ? '#000000' : '#FFFFFF'}
                  />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.primaryTitle, { color: '#EF4444' }]}>
                  {isDelete ? 'Deletion Incomplete' : 'Departure Incomplete'}
                </Text>
                <Text
                  style={[
                    styles.subDescription,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {errorMessage ||
                    (isDelete
                      ? 'An error occurred while deleting the circle. Please try again.'
                      : 'An error occurred while leaving the circle. Please try again.')}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.doneButton,
                    {
                      backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                    },
                  ]}
                  onPress={closeWalkawayLeaveModal}
                  activeOpacity={0.88}
                >
                  <Text
                    style={[
                      styles.doneButtonText,
                      { color: isDark ? '#000000' : '#FFFFFF' },
                    ]}
                  >
                    CLOSE
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  videoContainer: {
    width: '100%',
    height: 230,
    borderRadius: 18,
    borderWidth: 1.2,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 18,
  },
  videoPillOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  videoPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  contentSection: {
    alignItems: 'center',
    gap: 8,
  },
  primaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subDescription: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 6,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 48,
    borderRadius: 14,
    marginTop: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  doneButtonText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
