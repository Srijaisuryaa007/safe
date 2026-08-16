import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';

interface TypingIndicatorProps {
  typingUsers: string[];
}

export default function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  const { colors } = useThemeStore();

  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typingUsers.length === 0) return;

    const createBouncingLoop = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -6,
            duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 300,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createBouncingLoop(dot1Anim, 0);
    const anim2 = createBouncingLoop(dot2Anim, 150);
    const anim3 = createBouncingLoop(dot3Anim, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
      dot1Anim.setValue(0);
      dot2Anim.setValue(0);
      dot3Anim.setValue(0);
    };
  }, [typingUsers.length]);

  if (typingUsers.length === 0) return null;

  const labelText = typingUsers.length === 1 
    ? `${typingUsers[0]} is typing` 
    : `${typingUsers.join(', ')} are typing`;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.typingText, { color: colors.textMuted }]}>{labelText}</Text>
      
      {/* 3 Bouncing Dots */}
      <View style={styles.dotsContainer}>
        <Animated.View style={[styles.dot, { backgroundColor: colors.accentGold, transform: [{ translateY: dot1Anim }] }]} />
        <Animated.View style={[styles.dot, { backgroundColor: colors.accentGold, transform: [{ translateY: dot2Anim }] }]} />
        <Animated.View style={[styles.dot, { backgroundColor: colors.accentGold, transform: [{ translateY: dot3Anim }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginLeft: 14,
    marginBottom: 8,
    gap: 8,
  },
  typingText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 12,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
