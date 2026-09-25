import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';

export interface JellyRadioItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface JellyRadioProps {
  items?: (string | JellyRadioItem)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, index: number) => void;
  chipColor?: string;
  activeColor?: string;
  textColor?: string;
  activeTextColor?: string;
  size?: 'sm' | 'md' | 'lg';
  gap?: number;
  radius?: number;
  swell?: number;
  barge?: number;
  shrink?: number;
  jelly?: number;
  bounce?: number;
  stagger?: number;
  stiffness?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const DEFAULT_ITEMS = ['Off', 'Low', 'Medium', 'High', 'Max'];
const SIZES = {
  sm: { h: 28, font: 12, px: 12 },
  md: { h: 36, font: 13, px: 16 },
  lg: { h: 44, font: 14, px: 20 },
};

export default function JellyRadioNative({
  items = DEFAULT_ITEMS,
  value,
  defaultValue,
  onChange,
  chipColor = '#27272a',
  activeColor = '#f5f5f5',
  textColor = '#f5f5f5',
  activeTextColor = '#18181b',
  size = 'md',
  gap = 8,
  radius = 18,
  swell = 0.2,
  bounce = 0.25,
  stiffness = 580,
  disabled = false,
}: JellyRadioProps) {
  const list: JellyRadioItem[] = items.map((it) =>
    typeof it === 'string' ? { value: it, label: it } : it
  );

  const [inner, setInner] = useState<string>(() => defaultValue ?? list[0]?.value ?? '');
  const current = value ?? inner;
  const selectedIdx = Math.max(0, list.findIndex((it) => it.value === current));

  const anims = useRef<Animated.Value[]>([]);
  if (anims.current.length !== list.length) {
    anims.current = list.map((_, i) => new Animated.Value(i === selectedIdx ? 1 + swell : 1));
  }

  const { h, font, px } = SIZES[size] || SIZES.md;

  const triggerAnimation = (newIdx: number) => {
    const tension = Math.min(stiffness / 8, 120);
    const friction = Math.max(12 * (1 - bounce), 4);

    const parallelAnimations = list.map((_, i) => {
      const targetScale = i === newIdx ? 1 + (swell * 0.5) : 1;
      return Animated.spring(anims.current[i], {
        toValue: targetScale,
        friction,
        tension,
        useNativeDriver: true,
      });
    });

    Animated.parallel(parallelAnimations).start();
  };

  useEffect(() => {
    triggerAnimation(selectedIdx);
  }, [selectedIdx]);

  const handlePress = (it: JellyRadioItem, idx: number) => {
    if (disabled || it.disabled || idx === selectedIdx) return;
    if (value === undefined) setInner(it.value);
    triggerAnimation(idx);
    onChange?.(it.value, idx);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        {
          gap,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {list.map((it, i) => {
        const isSelected = i === selectedIdx;
        const scale = anims.current[i] || new Animated.Value(1);

        return (
          <Animated.View
            key={it.value}
            style={{
              transform: [{ scale }],
            }}
          >
            <TouchableOpacity
              onPress={() => handlePress(it, i)}
              disabled={disabled || !!it.disabled}
              activeOpacity={0.8}
              style={[
                styles.chip,
                {
                  height: h,
                  paddingHorizontal: px,
                  borderRadius: radius,
                  backgroundColor: isSelected ? activeColor : chipColor,
                  borderWidth: isSelected ? 0 : StyleSheet.hairlineWidth,
                  borderColor: isSelected ? 'transparent' : 'rgba(255, 255, 255, 0.1)',
                },
                isSelected && styles.chipActiveShadow,
              ]}
            >
              {it.icon ? <View style={styles.iconBox}>{it.icon}</View> : null}
              <Text
                style={[
                  styles.label,
                  {
                    fontSize: font,
                    color: isSelected ? activeTextColor : textColor,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {it.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActiveShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  iconBox: {
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: -0.2,
  },
});
