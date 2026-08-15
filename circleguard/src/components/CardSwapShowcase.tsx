import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeMode, useThemeStore } from '../store/useThemeStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface CardSwapThemeItem {
  id: string;
  title: string;
  subtitle: string;
  iconName: keyof typeof Ionicons.glyphMap;
  badge?: string;
  mode: ThemeMode;
  previewBg: string;
  previewText: string;
  previewBorder: string;
  previewAccent: string;
  previewShadow?: string;
}

interface CardSwapShowcaseProps {
  items: CardSwapThemeItem[];
  activeMode: ThemeMode;
  onSelectTheme: (mode: ThemeMode) => void;
  cardWidth?: number;
  cardHeight?: number;
  delay?: number;
}

export default function CardSwapShowcase({
  items,
  activeMode,
  onSelectTheme,
  cardWidth = Math.min(SCREEN_WIDTH - 64, 340),
  cardHeight = 190,
  delay = 3800,
}: CardSwapShowcaseProps) {
  const [order, setOrder] = useState<number[]>(items.map((_, i) => i));
  const isPaused = useRef(false);

  // Animated values for each item slot
  const animValues = useRef(
    items.map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      scale: new Animated.Value(1),
      opacity: new Animated.Value(1),
      rotate: new Animated.Value(0),
    }))
  ).current;

  // Position cards in slot formation
  const updateCardPositions = (currentOrder: number[], animate = true) => {
    currentOrder.forEach((itemIdx, slotIdx) => {
      const isFront = slotIdx === 0;
      const targetX = slotIdx * 12;
      const targetY = -slotIdx * 14;
      const targetScale = 1 - slotIdx * 0.05;
      const targetOpacity = slotIdx > 3 ? 0 : 1 - slotIdx * 0.15;
      const targetRotate = slotIdx === 0 ? 0 : (slotIdx % 2 === 0 ? 2 : -2);

      if (animate) {
        Animated.parallel([
          Animated.spring(animValues[itemIdx].x, {
            toValue: targetX,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
          }),
          Animated.spring(animValues[itemIdx].y, {
            toValue: targetY,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
          }),
          Animated.spring(animValues[itemIdx].scale, {
            toValue: targetScale,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
          }),
          Animated.timing(animValues[itemIdx].opacity, {
            toValue: targetOpacity,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(animValues[itemIdx].rotate, {
            toValue: targetRotate,
            useNativeDriver: true,
            friction: 8,
          }),
        ]).start();
      } else {
        animValues[itemIdx].x.setValue(targetX);
        animValues[itemIdx].y.setValue(targetY);
        animValues[itemIdx].scale.setValue(targetScale);
        animValues[itemIdx].opacity.setValue(targetOpacity);
        animValues[itemIdx].rotate.setValue(targetRotate);
      }
    });
  };

  useEffect(() => {
    updateCardPositions(order, false);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isPaused.current) return;

      setOrder((prevOrder) => {
        if (prevOrder.length < 2) return prevOrder;
        const [front, ...rest] = prevOrder;
        const nextOrder = [...rest, front];

        // Animate front card dropping down and cycling back
        const frontItem = animValues[front];
        Animated.sequence([
          Animated.timing(frontItem.y, {
            toValue: 160,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(frontItem.opacity, {
            toValue: 0.2,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start(() => {
          updateCardPositions(nextOrder, true);
        });

        return nextOrder;
      });
    }, delay);

    return () => clearInterval(timer);
  }, [delay]);

  const handleCardPress = (item: CardSwapThemeItem, slotIdx: number) => {
    onSelectTheme(item.mode);

    if (slotIdx !== 0) {
      // Bring clicked card to front
      setOrder((prevOrder) => {
        const itemPos = prevOrder.indexOf(items.indexOf(item));
        if (itemPos === -1) return prevOrder;
        const newArr = [...prevOrder.slice(itemPos), ...prevOrder.slice(0, itemPos)];
        updateCardPositions(newArr, true);
        return newArr;
      });
    }
  };

  return (
    <View
      style={styles.wrapper}
      onTouchStart={() => { isPaused.current = true; }}
      onTouchEnd={() => { isPaused.current = false; }}
    >
      <View style={[styles.container, { width: cardWidth, height: cardHeight + 40 }]}>
        {order.map((itemIdx, slotIdx) => {
          const item = items[itemIdx];
          const isActive = activeMode === item.mode;
          const anim = animValues[itemIdx];
          const zIndex = items.length - slotIdx;

          const rotateStr = anim.rotate.interpolate({
            inputRange: [-10, 10],
            outputRange: ['-10deg', '10deg'],
          });

          return (
            <Animated.View
              key={item.id}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  height: cardHeight,
                  zIndex,
                  backgroundColor: item.previewBg,
                  borderColor: isActive ? item.previewAccent : item.previewBorder,
                  borderWidth: isActive ? 3 : 2,
                  transform: [
                    { translateX: anim.x },
                    { translateY: anim.y },
                    { scale: anim.scale },
                    { rotate: rotateStr },
                  ],
                  opacity: anim.opacity,
                  shadowColor: item.previewShadow || '#000000',
                  shadowOffset: { width: slotIdx === 0 ? 5 : 2, height: slotIdx === 0 ? 5 : 2 },
                  shadowOpacity: slotIdx === 0 ? 0.35 : 0.15,
                  shadowRadius: slotIdx === 0 ? 10 : 4,
                  elevation: zIndex * 2,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.cardTouchable}
                activeOpacity={0.88}
                onPress={() => handleCardPress(item, slotIdx)}
              >
                {/* Card Top Pill Badge */}
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: item.previewAccent + '22', borderColor: item.previewAccent },
                    ]}
                  >
                    <Ionicons name={item.iconName} size={18} color={item.previewAccent} />
                  </View>

                  {isActive ? (
                    <View style={[styles.activeBadge, { backgroundColor: item.previewAccent }]}>
                      <Ionicons name="checkmark-sharp" size={12} color="#FFFFFF" />
                      <Text style={styles.activeBadgeText}>ACTIVE PREVIEW</Text>
                    </View>
                  ) : (
                    <View style={[styles.modeBadge, { borderColor: item.previewBorder }]}>
                      <Text style={[styles.modeBadgeText, { color: item.previewText }]}>
                        {item.badge || 'THEME'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Card Main Title & Subtitle */}
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: item.previewText }]}>{item.title}</Text>
                  <Text style={[styles.cardSubtitle, { color: item.previewText + 'BB' }]} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                </View>

                {/* Bottom Visual Palette Dots */}
                <View style={styles.cardFooter}>
                  <View style={styles.paletteDots}>
                    <View style={[styles.dot, { backgroundColor: item.previewAccent }]} />
                    <View style={[styles.dot, { backgroundColor: item.previewBorder }]} />
                    <View style={[styles.dot, { backgroundColor: item.previewBg, borderWidth: 1, borderColor: item.previewText }]} />
                  </View>
                  <Text style={[styles.tapToApplyText, { color: item.previewAccent }]}>
                    {isActive ? 'CURRENT THEME' : 'TAP TO APPLY →'}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      <Text style={styles.instructionHint}>
        💡 Cards cycle automatically • Tap any 3D card to activate theme
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginVertical: 16,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardTouchable: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardBody: {
    marginVertical: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  paletteDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tapToApplyText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  instructionHint: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
});
