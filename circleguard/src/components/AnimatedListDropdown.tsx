import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

export interface AnimatedDropdownItem {
  id: string;
  title: string;
  subtitle?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  badge?: string;
  data?: any;
}

interface AnimatedListDropdownProps {
  items: AnimatedDropdownItem[];
  selectedIndex?: number;
  onItemSelect: (item: AnimatedDropdownItem, index: number) => void;
  showGradients?: boolean;
  maxHeight?: number;
}

export default function AnimatedListDropdown({
  items,
  selectedIndex = -1,
  onItemSelect,
  showGradients = true,
  maxHeight = 260,
}: AnimatedListDropdownProps) {
  const { colors, isDark } = useThemeStore();
  const [topOpacity, setTopOpacity] = useState(0);
  const [bottomOpacity, setBottomOpacity] = useState(1);
  const [currentSelected, setCurrentSelected] = useState(selectedIndex);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const maxScroll = contentSize.height - layoutMeasurement.height;

    // Calculate top and bottom gradient fades
    setTopOpacity(Math.min(y / 30, 1));
    if (maxScroll <= 0) {
      setBottomOpacity(0);
    } else {
      setBottomOpacity(Math.min((maxScroll - y) / 30, 1));
    }
  };

  return (
    <View style={[styles.container, { maxHeight }]}>
      <ScrollView
        showsVerticalScrollIndicator={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item, index) => {
          const isSelected = currentSelected === index;

          return (
            <TouchableOpacity
              key={item.id || index}
              style={[
                styles.itemRow,
                {
                  backgroundColor: isSelected
                    ? isDark
                      ? 'rgba(180, 139, 30, 0.16)'
                      : '#FAF5DB'
                    : isDark
                    ? colors.surfaceMuted
                    : '#F8F9FA',
                  borderColor: isSelected ? '#B48B1E' : isDark ? colors.border : '#E4E4E7',
                },
              ]}
              onPress={() => {
                setCurrentSelected(index);
                onItemSelect(item, index);
              }}
              activeOpacity={0.8}
            >
              {/* Item Icon */}
              {item.iconName ? (
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: isSelected
                        ? '#B48B1E'
                        : isDark
                        ? colors.surface
                        : '#E4E4E7',
                    },
                  ]}
                >
                  <Ionicons
                    name={item.iconName}
                    size={16}
                    color={isSelected ? '#FFFFFF' : isDark ? colors.foreground : '#4B5563'}
                  />
                </View>
              ) : null}

              {/* Title & Subtitle */}
              <View style={styles.textWrap}>
                <Text
                  style={[
                    styles.itemTitle,
                    {
                      color: isSelected
                        ? '#B48B1E'
                        : isDark
                        ? colors.foreground
                        : '#18181B',
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text
                    style={[
                      styles.itemSubtitle,
                      { color: isDark ? colors.textMuted : '#71717A' },
                    ]}
                  >
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>

              {/* Active Badge / Check Icon */}
              {isSelected ? (
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark-circle" size={18} color="#B48B1E" />
                </View>
              ) : item.badge ? (
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Top & Bottom Soft Fading Gradient Overlays */}
      {showGradients && (
        <>
          {topOpacity > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.topGradient,
                { opacity: topOpacity, backgroundColor: isDark ? colors.surface : '#FFFFFF' },
              ]}
            />
          )}
          {bottomOpacity > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.bottomGradient,
                { opacity: bottomOpacity, backgroundColor: isDark ? colors.surface : '#FFFFFF' },
              ]}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingVertical: 4,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  itemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  checkWrap: {
    marginLeft: 4,
  },
  badgePill: {
    backgroundColor: '#E4E4E7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4B5563',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 18,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
  },
});
