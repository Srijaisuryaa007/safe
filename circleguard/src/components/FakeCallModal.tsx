import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Vibration,
  Switch,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { supabase } from '../lib/supabase';

interface FakeCallModalProps {
  visible: boolean;
  onClose: () => void;
  callerName?: string;
}

// Single realistic human safety escort caller configuration
const SINGLE_CALLER = {
  id: 'alex_companion',
  name: 'Alex',
  subtitle: 'Mobile Call • Safety Escort Voice',
  avatarIcon: 'person' as const,
  accentColor: '#183CE6',
  initialDialogue: () =>
    `Hey! Where are you right now? I'm already standing outside waiting for you. Are you walking up the street? Okay, perfect. Just keep your phone in your hand and keep walking straight towards me. I'm staying right here on the phone with you until you get inside.`,
  followUps: [
    `I'm still right here with you! Can you see the lights yet? Keep heading straight.`,
    `Keep your head up and don't stop for anyone. I'm looking down the sidewalk right now.`,
    `You're almost here! Just a couple more houses down. I've got the front door unlocked for you.`,
    `I see someone walking up, is that you? Wave your hand so I can see you!`,
  ],
  responses: {
    almostHome: () =>
      `Awesome! I'm watching the street right now. Keep your eyes up, see you in just a second!`,
    someoneBehind: () =>
      `Okay, stay calm. Do not turn around. Cross over to the bright side of the street and head straight towards me. I'm right here on the phone with you, do not hang up!`,
    iSeeYou: () =>
      `Yes! I see you too! Come straight up the walkway, let's get you inside.`,
    safeInside: () =>
      `Oh, thank goodness! I'm so glad you made it. Lock the deadbolt behind you, and text me before you go to sleep!`,
  },
};

// Dual-Tone Multi-Frequency (DTMF) definitions for authentic keypad touch tones
const DTMF_TONES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

export default function FakeCallModal({ visible, onClose, callerName }: FakeCallModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);

  const { profile } = useAuthStore();
  const { activeCircle } = useCircleStore();
  const effectiveCallerName = callerName && callerName !== 'CIRCLEGUARD ESCORT' ? callerName : SINGLE_CALLER.name;

  // Screen Stages: 'setup' | 'countdown' | 'incoming' | 'active'
  const [stage, setStage] = useState<'setup' | 'countdown' | 'incoming' | 'active'>('setup');
  const [delaySeconds, setDelaySeconds] = useState<number>(0);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const [notifyCircle, setNotifyCircle] = useState<boolean>(true);

  // Call in-progress states
  const [callTimer, setCallTimer] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [showKeypad, setShowKeypad] = useState(false);
  const [operatorSpeechText, setOperatorSpeechText] = useState<string>('');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Conversational timers & follow-ups
  const followUpIndexRef = useRef(0);
  const lastInteractionTimeRef = useRef(0);
  const [nativeVoices, setNativeVoices] = useState<any[]>([]);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0.4)).current;
  const waveAnim2 = useRef(new Animated.Value(0.8)).current;
  const waveAnim3 = useRef(new Animated.Value(0.5)).current;

  // Web Audio Context reference for Ringtone & DTMF
  const audioCtxRef = useRef<any>(null);
  const ringtoneTimerRef = useRef<any>(null);

  // Initialize AudioContext
  const getAudioContext = () => {
    if (typeof window !== 'undefined') {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AudioCtx();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        return audioCtxRef.current;
      }
    }
    return null;
  };

  // Pre-load available high-definition voices on native platforms
  useEffect(() => {
    let isMounted = true;
    const loadVoices = async () => {
      try {
        if (typeof Speech !== 'undefined' && Speech.getAvailableVoicesAsync) {
          const v = await Speech.getAvailableVoicesAsync();
          if (isMounted && v && v.length > 0) {
            setNativeVoices(v);
          }
        }
      } catch (e) {}
    };
    loadVoices();
    return () => { isMounted = false; };
  }, []);

  // Play realistic Telephone Ringtone (US standard 440Hz + 480Hz dual tone cadence)
  const startRingtone = () => {
    stopRingtone();
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate([0, 1800, 3000, 1800], true);
      } catch (e) {}
    }

    const playToneBurst = () => {
      try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gainNode.gain.setValueAtTime(0.001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
        gainNode.gain.setValueAtTime(0.18, now + 1.8);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.0);
        osc2.stop(now + 2.0);
      } catch (e) {}
    };

    playToneBurst();
    ringtoneTimerRef.current = setInterval(playToneBurst, 4500);
  };

  const stopRingtone = () => {
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }
    if (Platform.OS !== 'web') {
      try {
        Vibration.cancel();
      } catch (e) {}
    }
  };

  // Dual Tone Multi-Frequency (DTMF) Keypad audio simulator
  const playDtmfTone = (digit: string) => {
    try {
      const frequencies = DTMF_TONES[digit];
      if (!frequencies) return;

      if (Platform.OS !== 'web') {
        try {
          Vibration.vibrate(40);
        } catch (e) {}
      }

      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const oscLow = ctx.createOscillator();
      const oscHigh = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscLow.frequency.setValueAtTime(frequencies[0], now);
      oscHigh.frequency.setValueAtTime(frequencies[1], now);

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
      gainNode.gain.setValueAtTime(0.16, now + 0.14);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      oscLow.connect(gainNode);
      oscHigh.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscLow.start(now);
      oscHigh.start(now);
      oscLow.stop(now + 0.2);
      oscHigh.stop(now + 0.2);
    } catch (e) {}
  };

  // Synthesize realistic dispatcher/escort speech
  const speakDispatcher = (text: string, onFinish?: () => void) => {
    setOperatorSpeechText(text);

    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.96;
          utterance.pitch = 1.02;

          const voices = window.speechSynthesis.getVoices();
          const naturalVoice = voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Natural') ||
                v.name.includes('Premium') ||
                v.name.includes('Neural') ||
                v.name.includes('Samantha') ||
                v.name.includes('Alex') ||
                v.name.includes('Google') ||
                v.name.includes('Daniel'))
          );

          if (naturalVoice) utterance.voice = naturalVoice;
          utterance.onend = () => onFinish?.();
          window.speechSynthesis.speak(utterance);
          return;
        }
      } catch (e) {}
    }

    try {
      if (typeof Speech !== 'undefined' && Speech.speak) {
        Speech.stop();

        let voiceIdToUse: string | undefined = undefined;
        if (nativeVoices && nativeVoices.length > 0) {
          const preferred = nativeVoices.find(
            (v) =>
              (v.language?.startsWith('en') || v.lang?.startsWith('en')) &&
              (v.quality === 'Enhanced' ||
                v.quality === 300 ||
                v.name?.includes('Enhanced') ||
                v.name?.includes('Premium') ||
                v.name?.includes('Natural') ||
                v.name?.includes('Alex') ||
                v.name?.includes('Samantha') ||
                v.name?.includes('Siri'))
          );
          if (preferred) {
            voiceIdToUse = preferred.identifier || preferred.name;
          }
        }

        Speech.speak(text, {
          rate: 0.95,
          pitch: 1.0,
          language: 'en-US',
          voice: voiceIdToUse,
          onDone: () => onFinish?.(),
          onError: () => onFinish?.(),
        });
      }
    } catch (e) {}
  };

  const stopDispatcherSpeech = () => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } else if (typeof Speech !== 'undefined' && Speech.stop) {
        Speech.stop();
      }
    } catch (e) {}
  };

  // Toggle audio preview in setup screen
  const handleTogglePreview = () => {
    if (isPreviewPlaying) {
      stopDispatcherSpeech();
      setIsPreviewPlaying(false);
    } else {
      setIsPreviewPlaying(true);
      speakDispatcher(
        "Hey! Where are you right now? I'm already standing outside waiting for you. Keep walking straight towards me.",
        () => setIsPreviewPlaying(false)
      );
    }
  };

  // Pulse animation for incoming call & active call audio waves
  useEffect(() => {
    if (visible && (stage === 'incoming' || stage === 'active')) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 850, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 850, useNativeDriver: true }),
        ])
      );
      loop.start();

      const waveLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(waveAnim1, { toValue: 1.0, duration: 400, useNativeDriver: true }),
            Animated.timing(waveAnim1, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(waveAnim2, { toValue: 0.3, duration: 450, useNativeDriver: true }),
            Animated.timing(waveAnim2, { toValue: 1.0, duration: 550, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(waveAnim3, { toValue: 0.9, duration: 350, useNativeDriver: true }),
            Animated.timing(waveAnim3, { toValue: 0.2, duration: 400, useNativeDriver: true }),
          ]),
        ])
      );
      waveLoop.start();

      return () => {
        loop.stop();
        waveLoop.stop();
      };
    }
  }, [visible, stage]);

  // Active call timer & continuous conversational check-in loop
  useEffect(() => {
    let interval: any;
    if (stage === 'active') {
      interval = setInterval(() => {
        setCallTimer((t) => {
          const next = t + 1;
          // Natural conversational cadence intervals (in seconds)
          const followUpIntervals = [14, 30, 48, 70];
          const currentIdx = followUpIndexRef.current;
          if (
            currentIdx < SINGLE_CALLER.followUps.length &&
            next >= followUpIntervals[currentIdx] &&
            next - lastInteractionTimeRef.current >= 12
          ) {
            const nextFollowUp = SINGLE_CALLER.followUps[currentIdx];
            followUpIndexRef.current += 1;
            lastInteractionTimeRef.current = next;
            speakDispatcher(nextFollowUp);
          }
          return next;
        });
      }, 1000);
    } else {
      setCallTimer(0);
      followUpIndexRef.current = 0;
      lastInteractionTimeRef.current = 0;
    }
    return () => clearInterval(interval);
  }, [stage]);

  // Handle countdown delay
  useEffect(() => {
    let timer: any;
    if (stage === 'countdown') {
      if (countdownRemaining > 0) {
        timer = setTimeout(() => {
          setCountdownRemaining((r) => r - 1);
        }, 1000);
      } else {
        // Trigger incoming call
        setStage('incoming');
        startRingtone();
      }
    }
    return () => clearTimeout(timer);
  }, [stage, countdownRemaining]);

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setStage('setup');
      setCallTimer(0);
      setIsMuted(false);
      setIsSpeakerOn(true);
      setShowKeypad(false);
      setIsEmergencyActive(false);
      setOperatorSpeechText('');
      setIsPreviewPlaying(false);
      followUpIndexRef.current = 0;
      lastInteractionTimeRef.current = 0;
      stopRingtone();
      stopDispatcherSpeech();
    } else {
      stopRingtone();
      stopDispatcherSpeech();
    }
  }, [visible]);

  // Handle Launching Escort from Setup
  const handleArmEscort = () => {
    stopDispatcherSpeech();
    if (delaySeconds > 0) {
      setCountdownRemaining(delaySeconds);
      setStage('countdown');
    } else {
      setStage('incoming');
      startRingtone();
    }

    // Optional: Notify circle feed that an escort walk was initiated
    if (notifyCircle && activeCircle?.id && profile?.id) {
      try {
        supabase.from('circle_messages').insert({
          circle_id: activeCircle.id,
          sender_id: profile.id,
          message: `🛡️ Initiated ${effectiveCallerName} safety escort walk. Live phone escort active.`,
        }).then(() => {}, () => {});
      } catch (e) {}
    }
  };

  // Answer call
  const handleAnswer = () => {
    stopRingtone();
    setStage('active');
    followUpIndexRef.current = 0;
    lastInteractionTimeRef.current = 0;
    const dialogue = SINGLE_CALLER.initialDialogue();
    speakDispatcher(dialogue);
  };

  // Decline or End Call
  const handleEndCall = () => {
    stopRingtone();
    stopDispatcherSpeech();
    setStage('setup');
    onClose();
  };

  // Handle Quick Conversational Responses with Fluent Human Grammar
  const handleQuickResponse = (type: 'almostHome' | 'someoneBehind' | 'iSeeYou' | 'safeInside') => {
    lastInteractionTimeRef.current = callTimer;
    const responseFn = SINGLE_CALLER.responses[type];
    if (responseFn) {
      const reply = responseFn();
      speakDispatcher(reply);
    }
  };

  // Interactive Keypad Dialing
  const handleKeyPress = (digit: string) => {
    playDtmfTone(digit);
    lastInteractionTimeRef.current = callTimer;
    if (digit === '9' || digit === '0') {
      handleTriggerEmergencySos();
    }
  };

  // Real Emergency Escalation
  const handleTriggerEmergencySos = async () => {
    setIsEmergencyActive(true);
    speakDispatcher('Emergency SOS escalation broadcast to your circle guardians. Help is on the way.');

    if (activeCircle?.id && profile?.id) {
      try {
        await supabase.from('sos_alerts').insert({
          circle_id: activeCircle.id,
          user_id: profile.id,
          status: 'active',
        });
      } catch (e) {
        console.warn('SOS escalation error in escort:', e);
      }
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose} statusBarTranslucent={true}>
      <View style={[styles.container, (stage === 'setup' || stage === 'countdown') && styles.containerLight]}>
        {/* =================================================================== */}
        {/* 1. SETUP / DISPATCHER CONFIGURATION STAGE                           */}
        {/* =================================================================== */}
        {stage === 'setup' && (
          <View style={styles.stageFull}>
            {/* Header Bar */}
            <View style={[styles.header, { paddingTop: topInset + 6 }]}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="#334155" />
              </TouchableOpacity>
              <View style={styles.headerTitleBox}>
                <View style={styles.headerBadge}>
                  <View style={styles.headerDot} />
                  <Text style={styles.headerOverline}>SAFETY ESCORT</Text>
                </View>
                <Text style={styles.headerTitle}>Safety Escort & Deterrent Call</Text>
              </View>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Info Banner */}
              <View style={styles.infoBanner}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="shield-checkmark" size={20} color="#2E7D5B" />
                </View>
                <Text style={styles.infoBannerText}>
                  Triggers an authentic incoming phone call with clear audio assistance to escort you home safely and deter unwanted attention.
                </Text>
              </View>

              {/* Dedicated Single Real-Human Voice Card */}
              <Text style={styles.sectionHeader}>CALLER & VOICE PROFILE</Text>
              <View style={styles.singleCallerCard}>
                <View style={styles.singleCallerTop}>
                  <View style={styles.singleCallerIconBox}>
                    <Ionicons name="person" size={22} color="#183CE6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.singleCallerTitleRow}>
                      <Text style={styles.singleCallerName}>{effectiveCallerName}</Text>
                      <View style={styles.singleCallerVerifiedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color="#2E7D5B" />
                        <Text style={styles.singleCallerVerifiedText}>Live Audio</Text>
                      </View>
                    </View>
                    <Text style={styles.singleCallerSubtitle}>
                      Natural voice audio • Walk-home safety deterrent
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.voicePreviewBtn, isPreviewPlaying && styles.voicePreviewBtnActive]}
                  onPress={handleTogglePreview}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isPreviewPlaying ? 'stop-circle' : 'volume-high'}
                    size={17}
                    color={isPreviewPlaying ? '#FFFFFF' : '#183CE6'}
                  />
                  <Text style={[styles.voicePreviewBtnText, isPreviewPlaying && { color: '#FFFFFF' }]}>
                    {isPreviewPlaying ? 'Stop Voice Sample' : 'Listen to Voice Sample'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Delay Selector */}
              <Text style={styles.sectionHeader}>TRIGGER TIMING</Text>
              <View style={styles.timerRow}>
                {[
                  { label: 'Instant', sec: 0 },
                  { label: '15 Sec', sec: 15 },
                  { label: '30 Sec', sec: 30 },
                  { label: '60 Sec', sec: 60 },
                ].map((t) => {
                  const isSelected = delaySeconds === t.sec;
                  return (
                    <TouchableOpacity
                      key={t.sec}
                      style={[styles.timerPill, isSelected && styles.timerPillActive]}
                      onPress={() => setDelaySeconds(t.sec)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.timerPillText, isSelected && styles.timerPillTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Circle Notification Toggle */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <Text style={styles.toggleTitle}>Notify Circle Guardians</Text>
                  <Text style={styles.toggleSubtitle}>Log active escort walk in circle activity feed</Text>
                </View>
                <Switch
                  value={notifyCircle}
                  onValueChange={setNotifyCircle}
                  trackColor={{ false: '#D1D5DB', true: '#183CE6' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.setupActions}>
                <TouchableOpacity style={styles.armBtn} onPress={handleArmEscort} activeOpacity={0.85}>
                  <Ionicons name="call" size={19} color="#FFFFFF" />
                  <Text style={styles.armBtnText}>
                    {delaySeconds === 0 ? 'START ESCORT CALL' : `TRIGGER IN ${delaySeconds} SECONDS`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelSetupBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.cancelSetupText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}

        {/* =================================================================== */}
        {/* 2. DISCREET COUNTDOWN STAGE                                        */}
        {/* =================================================================== */}
        {stage === 'countdown' && (
          <View style={styles.stageFull}>
            <View style={[styles.header, { paddingTop: topInset + 6, borderBottomWidth: 0, backgroundColor: 'transparent' }]}>
              <TouchableOpacity onPress={() => setStage('setup')} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={20} color="#334155" />
              </TouchableOpacity>
              <View style={styles.headerTitleBox}>
                <Text style={styles.headerTitle}>Discreet Armed Escort</Text>
              </View>
            </View>

            <View style={styles.countdownContainer}>
              <View style={styles.countdownCard}>
                <View style={styles.countdownIconBox}>
                  <Ionicons name="timer-outline" size={38} color="#183CE6" />
                </View>
                <Text style={styles.countdownOverline}>ESCORT ARMED & DISCREET</Text>
                <Text style={styles.countdownNumber}>{countdownRemaining}s</Text>
                <Text style={styles.countdownDesc}>
                  Slip phone into pocket. {effectiveCallerName} will ring automatically when the timer reaches zero.
                </Text>

                <TouchableOpacity
                  style={styles.triggerNowBtn}
                  onPress={() => { setCountdownRemaining(0); }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                  <Text style={styles.triggerNowText}>TRIGGER CALL IMMEDIATELY</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.disarmBtn} onPress={() => setStage('setup')} activeOpacity={0.7}>
                  <Text style={styles.disarmText}>CANCEL ESCORT</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* 3. INCOMING CALL STAGE                                             */}
        {/* =================================================================== */}
        {stage === 'incoming' && (
          <View style={styles.incomingWrapper}>
            <View style={[styles.topInfo, { paddingTop: topInset + 10 }]}>
              <View style={styles.callBadge}>
                <View style={styles.callDot} />
                <Text style={styles.overline}>INCOMING CALL</Text>
              </View>
              <Text style={styles.callerName}>{effectiveCallerName}</Text>
              <Text style={styles.callStatus}>Mobile Call</Text>
            </View>

            <View style={styles.avatarCenter}>
              <Animated.View style={[styles.avatarCircle, { transform: [{ scale: pulseAnim }], borderColor: '#183CE6' }]}>
                <Ionicons name={SINGLE_CALLER.avatarIcon} size={64} color="#183CE6" />
              </Animated.View>
              <Text style={styles.incomingPrompt}>TAP TO ANSWER</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.callBtn, styles.declineBtn]} onPress={handleEndCall} activeOpacity={0.8}>
                <Ionicons name="call-outline" size={32} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={styles.btnLabel}>DECLINE</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.callBtn, styles.acceptBtn]} onPress={handleAnswer} activeOpacity={0.8}>
                <Ionicons name="call" size={32} color="#FFFFFF" />
                <Text style={styles.btnLabel}>ANSWER</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* 4. ACTIVE CONNECTED CALL STAGE                                     */}
        {/* =================================================================== */}
        {stage === 'active' && (
          <View style={[styles.activeWrapper, { paddingTop: topInset + 8 }]}>
            <View style={styles.topInfo}>
              <View style={styles.callActiveBadge}>
                <View style={[styles.callDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.overline, { color: '#10B981' }]}>CALL IN PROGRESS</Text>
              </View>
              <Text style={styles.callerName}>{effectiveCallerName}</Text>
              <Text style={styles.callTimerText}>{formatTimer(callTimer)}</Text>
            </View>

            {/* Audio Wave Visualizer & Live Speech */}
            <View style={styles.audioWaveBox}>
              <View style={styles.waveBarsRow}>
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim1 }] }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim2 }] }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim3 }] }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim1 }] }]} />
                <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim2 }] }]} />
              </View>
              <Text style={styles.operatorSpeechText}>
                "{operatorSpeechText || 'Speaking...'}"
              </Text>
            </View>

            {/* Conversational Quick Talk Chips (Talk naturally to caller) */}
            <View style={styles.quickTalkSection}>
              <Text style={styles.quickTalkHeader}>TAP TO REPLY NATURALLY</Text>
              <View style={styles.quickTalkRow}>
                <TouchableOpacity
                  style={styles.quickTalkPill}
                  onPress={() => handleQuickResponse('almostHome')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickTalkPillText}>"I'm almost there"</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickTalkPill, { borderColor: '#F59E0B' }]}
                  onPress={() => handleQuickResponse('someoneBehind')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickTalkPillText, { color: '#FCD34D' }]}>"Someone behind me"</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickTalkPill, { borderColor: '#38BDF8' }]}
                  onPress={() => handleQuickResponse('iSeeYou')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickTalkPillText, { color: '#7DD3FC' }]}>"I see you!"</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickTalkPill, { borderColor: '#10B981' }]}
                  onPress={() => handleQuickResponse('safeInside')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickTalkPillText, { color: '#6EE7B7' }]}>"I'm safely inside"</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Keypad Drawer if toggled */}
            {showKeypad ? (
              <View style={styles.keypadGrid}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={styles.keypadBtn}
                    onPress={() => handleKeyPress(k)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keypadDigit}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              /* Standard In-Call Controls */
              <View style={styles.controlsGrid}>
                <TouchableOpacity
                  style={[styles.controlCircle, isMuted && styles.controlCircleActive]}
                  onPress={() => setIsMuted(!isMuted)}
                >
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#FFFFFF" />
                  <Text style={styles.controlLabel}>{isMuted ? 'MUTED' : 'MUTE'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlCircle, showKeypad && styles.controlCircleActive]}
                  onPress={() => setShowKeypad(!showKeypad)}
                >
                  <Ionicons name="keypad" size={24} color="#FFFFFF" />
                  <Text style={styles.controlLabel}>KEYPAD</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.controlCircle, isSpeakerOn && styles.controlCircleActive]}
                  onPress={() => {
                    const next = !isSpeakerOn;
                    setIsSpeakerOn(next);
                    if (!next) stopDispatcherSpeech();
                  }}
                >
                  <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-mute'} size={24} color="#FFFFFF" />
                  <Text style={styles.controlLabel}>{isSpeakerOn ? 'SPEAKER' : 'EARPIECE'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Emergency SOS Escalation Banner */}
            <TouchableOpacity
              style={[styles.sosEscalateBtn, isEmergencyActive && styles.sosEscalateBtnActive]}
              onPress={handleTriggerEmergencySos}
              activeOpacity={0.85}
            >
              <Ionicons name="warning" size={20} color="#FFFFFF" />
              <Text style={styles.sosEscalateText}>
                {isEmergencyActive ? 'SOS BROADCAST TRANSMITTED' : 'ONE-TAP EMERGENCY SOS'}
              </Text>
            </TouchableOpacity>

            {/* Bottom Controls */}
            <View style={styles.activeBottomRow}>
              {showKeypad && (
                <TouchableOpacity style={styles.hideKeypadBtn} onPress={() => setShowKeypad(false)}>
                  <Text style={styles.hideKeypadText}>HIDE KEYPAD</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall} activeOpacity={0.85}>
                <Ionicons name="call-outline" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                <Text style={styles.endCallText}>END CALL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  containerLight: {
    backgroundColor: '#FAF9F6',
  },
  stageFull: {
    flex: 1,
  },

  // Standard Header Bar Styles (Matches Medical & Contacts Modals)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAE4',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 12,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E7D5B',
  },
  headerOverline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D5B',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },

  // Scroll Area & Content
  scrollArea: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E8F5EE',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C6E7D6',
    marginBottom: 16,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerText: {
    fontSize: 12.5,
    color: '#1B4D3E',
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },

  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 10,
  },

  // Single Caller Card
  singleCallerCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  singleCallerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  singleCallerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleCallerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  singleCallerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  singleCallerVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  singleCallerVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D5B',
  },
  singleCallerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  voicePreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  voicePreviewBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  voicePreviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#183CE6',
    letterSpacing: 0.3,
  },

  // Timing selector
  timerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timerPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    alignItems: 'center',
  },
  timerPillActive: {
    borderColor: '#183CE6',
    backgroundColor: '#183CE6',
  },
  timerPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  timerPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },

  // Setup Actions
  setupActions: {
    marginTop: 26,
    gap: 12,
  },
  armBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#183CE6',
    paddingVertical: 15,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#183CE6',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  armBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cancelSetupBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelSetupText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },

  // Countdown Stage Styles
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  countdownCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  countdownIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  countdownOverline: {
    fontSize: 11,
    fontWeight: '800',
    color: '#183CE6',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  countdownNumber: {
    fontSize: 58,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 4,
  },
  countdownDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  triggerNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#183CE6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    gap: 8,
    marginBottom: 10,
  },
  triggerNowText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  disarmBtn: {
    paddingVertical: 10,
  },
  disarmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.8,
  },

  // Incoming Stage Styles
  incomingWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 28,
    paddingBottom: 60,
    backgroundColor: '#090D16',
  },
  topInfo: {
    alignItems: 'center',
  },
  callBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(24, 60, 230, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  callActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  callDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1.5,
  },
  callerName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 13,
    color: '#94A3B8',
  },
  callTimerText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 4,
    letterSpacing: 1,
  },
  avatarCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#131B2E',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#183CE6',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  incomingPrompt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 320,
  },
  callBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  declineBtn: {
    backgroundColor: '#EF4444',
  },
  btnLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 6,
    letterSpacing: 0.8,
  },

  // Active Call Stage Styles
  activeWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 40,
    backgroundColor: '#090D16',
  },
  audioWaveBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    padding: 16,
    alignItems: 'center',
    marginVertical: 10,
  },
  waveBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    marginBottom: 8,
  },
  waveBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
  },
  operatorSpeechText: {
    fontSize: 13,
    color: '#E2E8F0',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  controlsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  controlCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  controlCircleActive: {
    backgroundColor: 'rgba(24, 60, 230, 0.4)',
    borderColor: '#38BDF8',
  },
  controlLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 8,
  },
  keypadBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  keypadDigit: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sosEscalateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
    marginVertical: 6,
  },
  sosEscalateBtnActive: {
    backgroundColor: '#991B1B',
  },
  sosEscalateText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  activeBottomRow: {
    alignItems: 'center',
    gap: 8,
  },
  hideKeypadBtn: {
    paddingVertical: 6,
  },
  hideKeypadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.8,
  },
  endCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 15,
    width: '100%',
    borderRadius: 16,
    gap: 8,
  },
  endCallText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  quickTalkSection: {
    marginVertical: 4,
  },
  quickTalkHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  quickTalkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  quickTalkPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  quickTalkPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
