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
  showGradients = false,
  maxHeight = 280,
}: AnimatedListDropdownProps) {
  const { colors, isDark } = useThemeStore();
  const [currentSelected, setCurrentSelected] = useState(selectedIndex);

  return (
    <View style={[styles.container, { maxHeight }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
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
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#F1F5F9'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.03)'
                    : '#F8FAFC',
                  borderColor: isSelected
                    ? isDark
                      ? 'rgba(255, 255, 255, 0.25)'
                      : '#0F172A'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : '#E2E8F0',
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
                        ? isDark
                          ? 'rgba(255, 255, 255, 0.15)'
                          : '#0F172A'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : '#E2E8F0',
                    },
                  ]}
                >
                  <Ionicons
                    name={item.iconName}
                    size={16}
                    color={isSelected ? '#FFFFFF' : isDark ? '#F8FAFC' : '#475569'}
                  />
                </View>
              ) : null}

              {/* Title & Subtitle */}
              <View style={styles.textWrap}>
                <Text
                  style={[
                    styles.itemTitle,
                    {
                      color: isDark ? '#F8FAFC' : '#0F172A',
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
                      { color: isDark ? '#94A3B8' : '#64748B' },
                    ]}
                  >
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>

              {/* Active Badge / Check Icon */}
              {isSelected ? (
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark-circle" size={19} color={isDark ? '#38BDF8' : '#0F172A'} />
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
