import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
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
      previewBg: '#F9F8F6',
      borderColor: '#3B82F6',
    },
    {
      id: 'satellite',
      title: 'Satellite Imagery',
      description: 'High-resolution real-world Earth satellite imagery from ESRI.',
      icon: 'earth-outline',
      badge: 'SATELLITE',
      previewBg: '#1C2E1E',
      borderColor: '#10B981',
    },
    {
      id: 'dark',
      title: 'Midnight Dark Mode',
      description: 'Obsidian dark vector map designed for night viewing and battery saving.',
      icon: 'moon-outline',
      badge: 'NIGHT',
      previewBg: '#0D0E12',
      borderColor: '#A855F7',
    },
    {
      id: 'terrain',
      title: 'Topographic Terrain',
      description: 'Contour lines, elevation profiles, and outdoor geographical terrain.',
      icon: 'navigate-circle-outline',
      badge: 'TERRAIN',
      previewBg: '#2D281E',
      borderColor: '#F59E0B',
    },
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.overline, { color: colors.accentGold }]}>MAP INTELLIGENCE</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>Select Map View Style</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
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
        </View>
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
    padding: 24,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
