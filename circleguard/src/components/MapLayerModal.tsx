import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

export type MapStyleType = 'vector' | 'satellite' | 'dark' | 'terrain';

interface MapLayerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedStyle: MapStyleType;
  onSelectStyle: (style: MapStyleType) => void;
}

export default function MapLayerModal({
  visible,
  onClose,
  selectedStyle,
  onSelectStyle,
}: MapLayerModalProps) {
  const { colors } = useThemeStore();

  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 4,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 80 || gestureState.vy > 0.5) {
            Animated.timing(translateY, {
              toValue: 600,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              onClose();
              translateY.setValue(0);
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [onClose, translateY]
  );

  const stylesList: Array<{
    id: MapStyleType;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    badge: string;
    previewBg: string;
    borderColor: string;
  }> = [
    {
      id: 'vector',
      title: 'Standard Vector Map',
      description: 'Clean high-clarity street vector map optimized for city navigation.',
      icon: 'map-outline',
      badge: 'DEFAULT',
      previewBg: '#1E293B',
      borderColor: '#0284C7',
    },
    {
      id: 'satellite',
      title: 'Satellite Photographic Imagery',
      description: 'High resolution orbital imagery with topological street overlays.',
      icon: 'earth-outline',
      badge: 'ORBITAL',
      previewBg: '#0F172A',
      borderColor: '#10B981',
    },
    {
      id: 'terrain',
      title: 'Topographic Terrain Radar',
      description: 'Elevation contours and elevation tracking with shaded physical relief.',
      icon: 'trail-sign-outline',
      badge: 'TOPOGRAPHY',
      previewBg: '#1B262C',
      borderColor: '#8B5CF6',
    },
    {
      id: 'dark',
      title: 'Tactical Midnight Stealth',
      description: 'Ultra high-contrast OLED dark radar mode for night operations.',
      icon: 'moon-outline',
      badge: 'OLED DARK',
      previewBg: '#2D281E',
      borderColor: '#F59E0B',
    },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              transform: [
                {
                  translateY: translateY.interpolate({
                    inputRange: [-50, 0, 600],
                    outputRange: [0, 0, 600],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          {/* Top Interactive Drag-to-Dismiss / Tap-to-Close Handle */}
          <TouchableOpacity
            style={styles.handleContainer}
            onPress={onClose}
            activeOpacity={0.7}
            {...panResponder.panHandlers}
            accessibilityLabel="Drag down or tap to close map layer picker"
          >
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.overline, { color: colors.accentGold }]}>MAP RADAR & LAYERS</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>Select Map View Style</Text>
            </View>
          </View>

          {/* Map Layer Options List */}
          <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
            {stylesList.map((item) => {
              const isSelected = selectedStyle === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.layerCard,
                    { backgroundColor: colors.background, borderColor: isSelected ? item.borderColor : colors.border },
                    isSelected && styles.layerCardActive,
                  ]}
                  onPress={() => {
                    onSelectStyle(item.id);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconBox, { backgroundColor: item.previewBg, borderColor: item.borderColor }]}>
                    <Ionicons name={item.icon} size={24} color={isSelected ? item.borderColor : '#9CA3AF'} />
                  </View>

                  <View style={styles.cardInfo}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                      <View style={[styles.badgePill, { backgroundColor: isSelected ? item.borderColor : 'rgba(156, 163, 175, 0.15)' }]}>
                        <Text style={[styles.badgeText, { color: isSelected ? '#FFFFFF' : '#9CA3AF' }]}>
                          {item.badge}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.cardDesc, { color: colors.textMuted }]}>{item.description}</Text>
                  </View>

                  <View style={styles.radioBox}>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? item.borderColor : colors.textMuted}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '75%',
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 10,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  header: {
    marginBottom: 16,
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  listContainer: {
    gap: 14,
    paddingBottom: 20,
  },
  layerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 14,
  },
  layerCardActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  radioBox: {
    paddingLeft: 4,
  },
});
