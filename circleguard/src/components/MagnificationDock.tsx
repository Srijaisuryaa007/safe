import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

export interface DockItemData {
  id: string;
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  badgeColor: string;
  iconColor: string;
  onClick: () => void;
}

interface MagnificationDockProps {
  items: DockItemData[];
}

export default function MagnificationDock({ items }: MagnificationDockProps) {
  const { colors, isDark } = useThemeStore();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  return (
    <View style={styles.dockOuterWrapper}>
      {/* Dock Container */}
      <View
        style={[
          styles.dockPanel,
          {
            backgroundColor: isDark ? colors.surface : '#FFFFFF',
            borderColor: isDark ? colors.border : '#E4E4E7',
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dockScrollContent}
        >
          {items.map((item) => {
            const isHovered = activeItemId === item.id;

            return (
              <View key={item.id} style={styles.dockItemContainer}>
                {/* Tooltip Label */}
                {isHovered ? (
                  <View style={[styles.tooltipBubble, { backgroundColor: isDark ? '#1F2A3A' : '#18181B' }]}>
                    <Text style={styles.tooltipText}>{item.label}</Text>
                  </View>
                ) : null}

                {/* Dock Icon Button */}
                <TouchableOpacity
                  style={[
                    styles.dockIconCircle,
                    {
                      backgroundColor: item.badgeColor,
                      transform: [{ scale: isHovered ? 1.18 : 1.0 }],
                    },
                  ]}
                  onPress={() => {
                    item.onClick();
                  }}
                  onPressIn={() => setActiveItemId(item.id)}
                  onPressOut={() => setActiveItemId(null)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={item.iconName} size={22} color={item.iconColor} />
                </TouchableOpacity>

                <Text
                  style={[
                    styles.dockItemLabelBelow,
                    { color: isHovered ? '#B48B1E' : isDark ? colors.textMuted : '#71717A' },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockOuterWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 28,
  },
  dockPanel: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  dockScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    gap: 16,
    flexGrow: 1,
  },
  dockItemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minWidth: 54,
  },
  tooltipBubble: {
    position: 'absolute',
    top: -30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dockIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  dockItemLabelBelow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
