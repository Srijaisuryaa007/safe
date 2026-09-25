import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

interface AddPlaceModalProps {
  visible: boolean;
  coordinate: { latitude: number; longitude: number } | null;
  members?: any[];
  onClose: () => void;
  onSave: (name: string, radius: number, selectedUserIds: string[], category: string) => void;
}

const CATEGORY_OPTIONS = [
  { id: 'home', icon: 'home', label: 'Home', color: '#10B981' },
  { id: 'work', icon: 'briefcase', label: 'Work', color: '#3B82F6' },
  { id: 'school', icon: 'school', label: 'School', color: '#F59E0B' },
  { id: 'fitness', icon: 'fitness', label: 'Gym', color: '#8B5CF6' },
  { id: 'danger', icon: 'alert-circle', label: 'Danger Zone', color: '#EF4444' },
  { id: 'custom', icon: 'shield-checkmark', label: 'Custom', color: '#D4AF37' },
];

export default function AddPlaceModal({ visible, coordinate, members = [], onClose, onSave }: AddPlaceModalProps) {
  const { colors, isDark } = useThemeStore();
  const [name, setName] = useState('');
  const [radius, setRadius] = useState('150');
  const [category, setCategory] = useState('home');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

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

  useEffect(() => {
    if (visible) {
      setName('');
      setRadius('150');
      setCategory('home');
      setSelectedUserIds([]);
    }
  }, [visible]);

  const toggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === members.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(members.map(m => m.user_id || m.id).filter(Boolean));
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const r = parseInt(radius, 10);
    onSave(name.trim(), isNaN(r) ? 150 : r, selectedUserIds, category);
  };

  if (!visible) return null;

  return (
    <Modal transparent={true} visible={visible} animationType="slide">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.overlay}
      >
        <Animated.View
          style={[
            styles.modalBox,
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
            accessibilityLabel="Drag down or tap to close zone creator"
          >
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </TouchableOpacity>

          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>Create Geofence Zone</Text>
          </View>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Set boundary radius, category, and select which circle members this zone applies to.
          </Text>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {/* Category Chips */}
            <Text style={[styles.label, { color: colors.foreground }]}>ZONE CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {CATEGORY_OPTIONS.map(cat => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected ? `${cat.color}25` : colors.surfaceMuted,
                        borderColor: isSelected ? cat.color : colors.border,
                      }
                    ]}
                    onPress={() => setCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={cat.icon as any} size={14} color={isSelected ? cat.color : colors.textMuted} />
                    <Text style={[styles.categoryText, { color: isSelected ? cat.color : colors.foreground }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.label, { color: colors.foreground }]}>ZONE NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, color: colors.foreground, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Home, Office, Campus, Downtown"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, { color: colors.foreground }]}>RADIUS (METERS)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, color: colors.foreground, borderColor: colors.border }]}
              value={radius}
              onChangeText={setRadius}
              keyboardType="number-pad"
              placeholder="150"
              placeholderTextColor={colors.textMuted}
            />

            {/* Member Allocation Section */}
            <View style={styles.memberHeaderRow}>
              <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>ALLOCATE TO CIRCLE MEMBERS</Text>
              {members.length > 0 ? (
                <TouchableOpacity onPress={toggleSelectAll}>
                  <Text style={[styles.selectAllText, { color: colors.accentGold }]}>
                    {selectedUserIds.length === members.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={[styles.helperText, { color: colors.textMuted }]}>
              {selectedUserIds.length === 0 
                ? 'Applies to entire circle by default if no individual member is selected.' 
                : `Explicitly assigned to ${selectedUserIds.length} of ${members.length} members`}
            </Text>

            <View style={styles.membersListContainer}>
              {members.map(m => {
                const uid = m.user_id || m.id;
                const mName = m.profile?.full_name || m.full_name || 'Member';
                const avatarUrl = m.profile?.avatar_url || m.avatar_url;
                const isSelected = selectedUserIds.includes(uid);
                const initial = mName.charAt(0).toUpperCase();

                return (
                  <TouchableOpacity
                    key={uid}
                    style={[
                      styles.memberItemRow,
                      {
                        backgroundColor: isSelected ? 'rgba(212, 175, 55, 0.12)' : colors.surfaceMuted,
                        borderColor: isSelected ? colors.accentGold : colors.border,
                      }
                    ]}
                    onPress={() => toggleUserSelection(uid)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.memberAvatarWrap}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={[styles.avatarInitial, { color: colors.foreground }]}>{initial}</Text>
                      )}
                    </View>

                    <Text style={[styles.memberNameText, { color: colors.foreground }]}>{mName}</Text>

                    <View style={[styles.checkbox, isSelected && { backgroundColor: colors.accentGold, borderColor: colors.accentGold }]}>
                      {isSelected ? <Ionicons name="checkmark" size={14} color="#1A1A1A" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.cancelButton, { backgroundColor: colors.surfaceMuted }]} onPress={onClose}>
              <Text style={[styles.cancelButtonText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.saveButton, { backgroundColor: colors.accentGold }, !name.trim() && styles.disabledButton]} 
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={styles.saveButtonText}>Save Zone</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 36,
    borderWidth: 1,
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  memberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 11,
    marginBottom: 12,
  },
  membersListContainer: {
    gap: 8,
    marginBottom: 16,
  },
  memberItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  memberAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
  },
  memberNameText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {},
  cancelButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  saveButton: {},
  disabledButton: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#1A1A1A',
    fontWeight: '900',
    fontSize: 15,
  },
});
