import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
  Vibration,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { LUXURY_THEME } from '../constants/theme';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { supabase } from '../lib/supabase';

interface FakeCallModalProps {
  visible: boolean;
  onClose: () => void;
  callerName?: string;
}

// Single realistic human companion caller configuration
const SINGLE_CALLER = {
  id: 'alex_companion',
  name: 'Alex',
  subtitle: 'Mobile Call • Real Human Voice',
  avatarIcon: 'person' as const,
  accentColor: LUXURY_THEME.colors.accentGold,
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

  // Play realistic DTMF Touch Tone
  const playDtmfTone = (digit: string) => {
    const freqs = DTMF_TONES[digit];
    if (!freqs) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(freqs[0], now);
      osc2.frequency.setValueAtTime(freqs[1], now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.16);
      osc2.stop(now + 0.16);
    } catch (e) {}
  };

  // High-Definition Realistic Human Voice Finder for Native Mobile (iOS & Android)
  // Ensures we select a high-fidelity, natural studio voice instead of the robotic default TTS
  const getNativeVoiceId = () => {
    if (!nativeVoices || nativeVoices.length === 0) return undefined;
    const englishVoices = nativeVoices.filter(v => (v.language || '').toLowerCase().startsWith('en'));
    if (englishVoices.length === 0) return undefined;

    // Filter for enhanced / network / natural quality
    const naturalVoice = englishVoices.find(v => {
      const n = (v.name || '').toLowerCase();
      const id = (v.identifier || '').toLowerCase();
      return (
        v.quality === 'Enhanced' ||
        n.includes('natural') ||
        n.includes('neural') ||
        n.includes('studio') ||
        n.includes('premium') ||
        id.includes('network') ||
        id.includes('enhanced') ||
        n.includes('samantha') ||
        n.includes('karen') ||
        n.includes('ava') ||
        n.includes('oliver') ||
        n.includes('daniel')
      );
    });

    return naturalVoice ? naturalVoice.identifier : englishVoices[0]?.identifier;
  };

  // High-Definition Realistic Human Voice Selector for Web
  const getNaturalWebVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 1. Prioritize Microsoft Natural online neural voices (warmest, human studio quality)
    const naturalVoices = voices.filter(v => v.name.includes('Natural') && v.lang.startsWith('en'));
    if (naturalVoices.length > 0) {
      const preferred = naturalVoices.find(v => v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Guy'));
      return preferred || naturalVoices[0];
    }

    // 2. Google US/UK natural voices
    const googleVoices = voices.filter(v => v.name.includes('Google') && v.lang.startsWith('en'));
    if (googleVoices.length > 0) {
      const preferred = googleVoices.find(v => v.name.includes('Female') || v.name.includes('US English'));
      return preferred || googleVoices[0];
    }

    // 3. Apple / Android Enhanced voices
    const enhanced = voices.filter(v => (v.name.includes('Enhanced') || (v as any).quality === 'Enhanced') && v.lang.startsWith('en'));
    if (enhanced.length > 0) return enhanced[0];

    // 4. Any English voice that is not a robotic legacy voice
    const nonRobotic = voices.find(v => v.lang.startsWith('en') && !v.name.includes('eSpeak') && !v.name.includes('Desktop'));
    if (nonRobotic) return nonRobotic;

    const enUs = voices.find(v => v.lang === 'en-US' || v.lang === 'en_US');
    return enUs || voices[0];
  };

  // Speak aloud with natural human conversational pacing (0.90 rate) and pure mobile call clarity (NO robotic clicks)
  const speakDispatcher = (text: string, onFinish?: () => void) => {
    if (!isSpeakerOn) return;
    setOperatorSpeechText(text);

    // 1. Native Mobile (iOS & Android) via Expo Speech
    if (Platform.OS !== 'web') {
      try {
        if (typeof Speech !== 'undefined' && Speech.speak) {
          Speech.stop();
          const voiceId = getNativeVoiceId();
          Speech.speak(text, {
            language: 'en-US',
            pitch: 1.0,
            rate: 0.90, // Natural human conversational tempo
            voice: voiceId,
            onDone: () => {
              if (onFinish) onFinish();
            },
            onError: () => {
              if (onFinish) onFinish();
            },
          });
          return;
        }
      } catch (e) {}
    }

    // 2. Web Speech API with Natural Neural Voice
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.90;
        utterance.pitch = 1.0;

        const bestVoice = getNaturalWebVoice();
        if (bestVoice) {
          utterance.voice = bestVoice;
        }

        utterance.onend = () => {
          if (onFinish) onFinish();
        };
        utterance.onerror = () => {
          if (onFinish) onFinish();
        };

        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {}
  };

  const stopDispatcherSpeech = () => {
    setIsPreviewPlaying(false);
    try {
      if (typeof Speech !== 'undefined' && Speech.stop) {
        Speech.stop();
      }
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
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
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* =================================================================== */}
        {/* 1. SETUP / DISPATCHER CONFIGURATION STAGE                           */}
        {/* =================================================================== */}
        {stage === 'setup' && (
          <ScrollView contentContainerStyle={styles.setupScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.setupHeader}>
              <View style={styles.shieldBadge}>
                <Ionicons name="call" size={30} color={LUXURY_THEME.colors.accentGold} />
              </View>
              <Text style={styles.setupOverline}>REAL HUMAN CALL ESCORT</Text>
              <Text style={styles.setupTitle}>Safety Phone Call</Text>
              <Text style={styles.setupSubtitle}>
                Triggers an authentic incoming phone call with a fluent, natural human companion voice to comfortably escort you anywhere.
              </Text>
            </View>

            {/* Dedicated Single Real-Human Voice Card */}
            <Text style={styles.sectionHeader}>CALLER & VOICE PROFILE</Text>
            <View style={styles.singleCallerCard}>
              <View style={styles.singleCallerTop}>
                <View style={styles.singleCallerIconBox}>
                  <Ionicons name="person" size={24} color={LUXURY_THEME.colors.accentGold} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.singleCallerTitleRow}>
                    <Text style={styles.singleCallerName}>{effectiveCallerName}</Text>
                    <View style={styles.singleCallerVerifiedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.singleCallerVerifiedText}>Real Human Voice</Text>
                    </View>
                  </View>
                  <Text style={styles.singleCallerSubtitle}>
                    Natural mobile phone speech • Fluent conversational cadence
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
                  size={18}
                  color={isPreviewPlaying ? '#FFFFFF' : LUXURY_THEME.colors.accentGold}
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
                  >
                    <Text style={[styles.timerPillText, isSelected && styles.timerPillTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Circle Notification Toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={styles.toggleTitle}>Notify Circle Guardians</Text>
                <Text style={styles.toggleSubtitle}>Log active escort session in the group feed</Text>
              </View>
              <Switch
                value={notifyCircle}
                onValueChange={setNotifyCircle}
                trackColor={{ false: '#333333', true: LUXURY_THEME.colors.accentGold }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.setupActions}>
              <TouchableOpacity style={styles.armBtn} onPress={handleArmEscort} activeOpacity={0.85}>
                <Ionicons name="call" size={20} color="#0D0E12" />
                <Text style={styles.armBtnText}>
                  {delaySeconds === 0 ? 'CALL NOW' : `CALL IN ${delaySeconds} SECONDS`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelSetupBtn} onPress={onClose}>
                <Text style={styles.cancelSetupText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* =================================================================== */}
        {/* 2. DISCREET COUNTDOWN STAGE                                        */}
        {/* =================================================================== */}
        {stage === 'countdown' && (
          <View style={styles.countdownContainer}>
            <View style={styles.countdownCard}>
              <Ionicons name="time" size={48} color={LUXURY_THEME.colors.accentGold} />
              <Text style={styles.countdownOverline}>ESCORT ARMED & DISCREET</Text>
              <Text style={styles.countdownNumber}>{countdownRemaining}s</Text>
              <Text style={styles.countdownDesc}>
                Slip phone into pocket. {effectiveCallerName} will ring automatically when the timer reaches zero.
              </Text>

              <TouchableOpacity style={styles.triggerNowBtn} onPress={() => { setCountdownRemaining(0); }}>
                <Text style={styles.triggerNowText}>TRIGGER CALL IMMEDIATELY</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.disarmBtn} onPress={() => setStage('setup')}>
                <Text style={styles.disarmText}>CANCEL ESCORT</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* 3. INCOMING CALL STAGE                                             */}
        {/* =================================================================== */}
        {stage === 'incoming' && (
          <View style={styles.incomingWrapper}>
            <View style={styles.topInfo}>
              <Text style={styles.overline}>INCOMING CALL</Text>
              <Text style={styles.callerName}>{effectiveCallerName}</Text>
              <Text style={styles.callStatus}>Mobile Call</Text>
            </View>

            <View style={styles.avatarCenter}>
              <Animated.View style={[styles.avatarCircle, { transform: [{ scale: pulseAnim }], borderColor: SINGLE_CALLER.accentColor }]}>
                <Ionicons name={SINGLE_CALLER.avatarIcon} size={64} color={SINGLE_CALLER.accentColor} />
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
          <View style={styles.activeWrapper}>
            <View style={styles.topInfo}>
              <Text style={styles.overline}>CALL IN PROGRESS</Text>
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
              <Text style={styles.quickTalkHeader}>TAP TO REPLY NATURALLY:</Text>
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
                  <Text style={[styles.quickTalkPillText, { color: '#F59E0B' }]}>"Someone behind me"</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickTalkPill, { borderColor: '#3B82F6' }]}
                  onPress={() => handleQuickResponse('iSeeYou')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickTalkPillText, { color: '#3B82F6' }]}>"I see you!"</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickTalkPill, { borderColor: '#10B981' }]}
                  onPress={() => handleQuickResponse('safeInside')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.quickTalkPillText, { color: '#10B981' }]}>"I'm safely inside"</Text>
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
    backgroundColor: '#0D0E12',
  },
  // Setup Stage Styles
  setupScroll: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  setupHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  shieldBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1.5,
    borderColor: LUXURY_THEME.colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  setupOverline: {
    fontSize: 11,
    fontWeight: '800',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: LUXURY_THEME.typography.fontFamilyDisplay,
    textAlign: 'center',
    marginBottom: 8,
  },
  setupSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1.5,
    marginTop: 18,
    marginBottom: 10,
  },
  // Single Caller Card
  singleCallerCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#16181F',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    gap: 14,
  },
  singleCallerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  singleCallerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  singleCallerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  singleCallerName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  singleCallerVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  singleCallerVerifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  singleCallerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 16,
  },
  voicePreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  voicePreviewBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  voicePreviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 0.5,
  },
  timerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timerPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#16181F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  timerPillActive: {
    borderColor: LUXURY_THEME.colors.accentGold,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  timerPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  timerPillTextActive: {
    color: LUXURY_THEME.colors.accentGold,
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#16181F',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  setupActions: {
    marginTop: 28,
    gap: 12,
  },
  armBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LUXURY_THEME.colors.accentGold,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  armBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D0E12',
    letterSpacing: 1,
  },
  cancelSetupBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelSetupText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1.5,
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
    backgroundColor: '#16181F',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  countdownOverline: {
    fontSize: 11,
    fontWeight: '800',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 6,
  },
  countdownNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    fontFamily: LUXURY_THEME.typography.fontFamilyMono,
    color: '#FFFFFF',
    marginVertical: 8,
  },
  countdownDesc: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  triggerNowBtn: {
    backgroundColor: LUXURY_THEME.colors.accentGold,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  triggerNowText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D0E12',
    letterSpacing: 1,
  },
  disarmBtn: {
    paddingVertical: 12,
  },
  disarmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 1,
  },

  // Incoming Stage Styles
  incomingWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 32,
    paddingVertical: 60,
  },
  topInfo: {
    alignItems: 'center',
    marginTop: 20,
  },
  overline: {
    fontSize: 11,
    fontWeight: '800',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 2,
    marginBottom: 8,
  },
  callerName: {
    fontSize: 28,
    fontFamily: LUXURY_THEME.typography.fontFamilyDisplay,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  callStatus: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  callTimerText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: LUXURY_THEME.typography.fontFamilyMono,
    color: '#34D399',
    marginTop: 4,
  },
  avatarCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#16181F',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  incomingPrompt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 340,
  },
  callBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    letterSpacing: 1,
  },

  // Active Call Stage Styles
  activeWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingVertical: 48,
  },
  audioWaveBox: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    padding: 16,
    alignItems: 'center',
    marginVertical: 12,
  },
  waveBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    marginBottom: 10,
  },
  waveBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: LUXURY_THEME.colors.accentGold,
  },
  operatorSpeechText: {
    fontSize: 13,
    color: '#F3F4F6',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  controlsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
  },
  controlCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1C1F2B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlCircleActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    borderColor: LUXURY_THEME.colors.accentGold,
  },
  controlLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 10,
  },
  keypadBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1C1F2B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  keypadDigit: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: LUXURY_THEME.typography.fontFamilyMono,
  },
  sosEscalateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginVertical: 8,
  },
  sosEscalateBtnActive: {
    backgroundColor: '#991B1B',
  },
  sosEscalateText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  activeBottomRow: {
    alignItems: 'center',
    gap: 10,
  },
  hideKeypadBtn: {
    paddingVertical: 6,
  },
  hideKeypadText: {
    fontSize: 12,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    letterSpacing: 1,
  },
  endCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    width: '100%',
    borderRadius: 16,
    gap: 8,
  },
  endCallText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  quickTalkSection: {
    marginVertical: 6,
  },
  quickTalkHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1.5,
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#16181F',
    borderWidth: 1.2,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  quickTalkPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
  },
});
