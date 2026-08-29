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
            backgroundColor: isDark ? 'rgba(18, 20, 28, 0.95)' : 'rgba(255, 255, 255, 0.96)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
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
                  <View style={[styles.tooltipBubble, { backgroundColor: isDark ? '#1F2432' : '#18181B' }]}>
                    <Text style={styles.tooltipText}>{item.label}</Text>
                  </View>
                ) : null}

                {/* Celestial Frosted Orb Icon */}
                <TouchableOpacity
                  style={[
                    styles.dockIconOuterOrbit,
                    {
                      borderColor: `${item.iconColor}35`,
                      transform: [{ scale: isHovered ? 1.15 : 1.0 }],
                    },
                  ]}
                  onPress={() => {
                    item.onClick();
                  }}
                  onPressIn={() => setActiveItemId(item.id)}
                  onPressOut={() => setActiveItemId(null)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.dockIconInnerOrb,
                      {
                        backgroundColor: `${item.iconColor}16`,
                        borderColor: `${item.iconColor}50`,
                      },
                    ]}
                  >
                    <Ionicons name={item.iconName} size={21} color={item.iconColor} />
                  </View>
                </TouchableOpacity>

                <Text
                  style={[
                    styles.dockItemLabelBelow,
                    { color: isHovered ? colors.accentGold : isDark ? colors.foreground : '#18181B' },
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
    marginBottom: 24,
  },
  dockPanel: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  dockScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    gap: 14,
    flexGrow: 1,
  },
  dockItemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minWidth: 56,
  },
  tooltipBubble: {
    position: 'absolute',
    top: -28,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dockIconOuterOrbit: {
    padding: 2.5,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 5,
  },
  dockIconInnerOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockItemLabelBelow: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
