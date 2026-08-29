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
      <View
        style={[
          styles.dockPanel,
          {
            backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
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
                {/* Apple Squircle Icon Tile */}
                <TouchableOpacity
                  style={[
                    styles.dockSquircle,
                    {
                      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                      transform: [{ scale: isHovered ? 0.95 : 1.0 }],
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
                    styles.dockItemLabel,
                    { color: isDark ? '#8E8E93' : '#636366' },
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
    marginBottom: 20,
  },
  dockPanel: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  dockScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    gap: 12,
    flexGrow: 1,
  },
  dockItemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  dockSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dockItemLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
});
