import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCircleStore, Circle } from '../store/useCircleStore';
import { useAuthStore } from '../store/useAuthStore';

interface CircleSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CircleSwitcherModal({ visible, onClose }: CircleSwitcherModalProps) {
  const navigation = useNavigation<any>();
  const { profile } = useAuthStore();
  const { activeCircle, circles, switchActiveCircle, fetchUserCircles, deleteCircle, leaveCircle, isLoading } = useCircleStore();

  useEffect(() => {
    if (visible && profile?.id) {
      fetchUserCircles(profile.id).catch(() => {});
    }
  }, [visible, profile?.id]);

  const handleSelectCircle = (circle: Circle) => {
    onClose();
    if (circle.id !== activeCircle?.id) {
      switchActiveCircle(circle);
    }
  };

  const handleDeleteCircle = (circle: Circle) => {
    const isOwnerOfCircle = profile?.id && circle.owner_id === profile.id;
    const title = isOwnerOfCircle ? 'Delete Circle' : 'Leave Circle';
    const message = isOwnerOfCircle
      ? `Are you sure you want to permanently delete "${circle.name}"? All members, safe places, and location history will be erased.`
      : `Are you sure you want to leave "${circle.name}"?`;

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: title,
        style: 'destructive',
        onPress: async () => {
          if (isOwnerOfCircle) {
            await deleteCircle(circle.id);
          } else if (profile?.id) {
            await leaveCircle(circle.id, profile.id);
          }
        },
      },
    ]);
  };

  const handleCreateNew = () => {
    onClose();
    navigation.navigate('CreateCircle');
  };

  const handleJoinCircle = () => {
    onClose();
    navigation.navigate('JoinCircle');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheetCard}>
          {/* Top Sheet Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.shieldBadge}>
                <Ionicons name="shield-checkmark" size={20} color="#2E7D5B" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Your Safety Circles</Text>
                <Text style={styles.headerSubtitle}>
                  Switch active circle or join another
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Circles List */}
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {circles && circles.length > 0 ? (
              circles.map((c) => {
                const isActive = activeCircle?.id === c.id;
                const circleInitial = (c.name || 'C').charAt(0).toUpperCase();

                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.circleItem,
                      isActive && styles.circleItemActive,
                    ]}
                    onPress={() => handleSelectCircle(c)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.circleAvatar,
                        isActive && styles.circleAvatarActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.circleAvatarText,
                          isActive && styles.circleAvatarTextActive,
                        ]}
                      >
                        {circleInitial}
                      </Text>
                    </View>

                    <View style={styles.circleInfo}>
                      <Text
                        style={[
                          styles.circleName,
                          isActive && styles.circleNameActive,
                        ]}
                        numberOfLines={1}
                      >
                        {c.name}
                      </Text>
                      <View style={styles.metaRow}>
                        {c.invite_code ? (
                          <Text style={styles.codeText}>
                            Code: <Text style={styles.codeBold}>{c.invite_code}</Text>
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.itemRightGroup}>
                      {isActive && (
                        <View style={styles.activePill}>
                          <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                          <Text style={styles.activePillText}>ACTIVE</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.circleDeleteBtn}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          handleDeleteCircle(c);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={profile?.id && c.owner_id === profile.id ? 'trash-outline' : 'log-out-outline'}
                          size={17}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : isLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="small" color="#2E7D5B" />
                <Text style={styles.emptyText}>Loading your circles...</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={36} color="#94A3B8" />
                <Text style={styles.emptyText}>No circles joined yet.</Text>
              </View>
            )}
          </ScrollView>

          {/* Bottom Action Buttons */}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleCreateNew}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Create New Circle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={handleJoinCircle}
              activeOpacity={0.85}
            >
              <Ionicons name="enter-outline" size={18} color="#2E7D5B" />
              <Text style={styles.secondaryActionText}>Join With Code / QR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandle: {
    width: 42,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  shieldBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    maxHeight: 320,
    marginVertical: 14,
  },
  listContent: {
    gap: 10,
    paddingVertical: 4,
  },
  circleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFAFA',
  },
  circleItemActive: {
    borderColor: '#2E7D5B',
    backgroundColor: '#F0FDF4',
  },
  circleAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleAvatarActive: {
    backgroundColor: '#2E7D5B',
  },
  circleAvatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#475569',
  },
  circleAvatarTextActive: {
    color: '#FFFFFF',
  },
  circleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  circleName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  circleNameActive: {
    color: '#2E7D5B',
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  codeText: {
    fontSize: 12,
    color: '#64748B',
  },
  codeBold: {
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#0F172A',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2E7D5B',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  itemRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchIconBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  footerActions: {
    gap: 10,
    marginTop: 6,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E7D5B',
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryActionText: {
    color: '#2E7D5B',
    fontSize: 14,
    fontWeight: '600',
  },
});
