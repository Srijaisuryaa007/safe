import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useSubscriptionStore, SubscriptionPackage } from '../store/useSubscriptionStore';
import { RevenueCatService } from '../services/RevenueCatService';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  gatedFeatureName?: string;
}

export default function PaywallModal({ visible, onClose, gatedFeatureName }: PaywallModalProps) {
  const { colors } = useThemeStore();
  const { isPremium, packages, setPremium } = useSubscriptionStore();
  const [selectedPeriod, setSelectedPeriod] = useState<'annual' | 'monthly'>('annual');
  const [loading, setLoading] = useState(false);

  const selectedPkg: SubscriptionPackage = selectedPeriod === 'annual' ? packages.annual : packages.monthly;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const success = await RevenueCatService.purchasePackage(selectedPkg);
      if (success) {
        Alert.alert(
          'Welcome to Circle Guard Plus',
          'Unlimited safe places, speed-adaptive geofencing, schedules, and route ETAs are now active.',
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (e) {
      Alert.alert('Purchase Error', 'Failed to complete transaction.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const success = await RevenueCatService.restorePurchases();
      if (success) {
        Alert.alert('Purchases Restored', 'Your Circle Guard Plus subscription has been restored.', [{ text: 'OK', onPress: onClose }]);
      }
    } catch (e) {
      Alert.alert('Restore Error', 'No active subscription found.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSandboxTest = async () => {
    const nextState = !isPremium;
    await setPremium(nextState, 'annual');
    Alert.alert(
      nextState ? 'Sandbox Test Premium Activated' : 'Returned to Free Tier',
      nextState
        ? 'Unlocked Unlimited Places, Speed-Adaptive Buffers, Schedules, and Route ETAs.'
        : 'Restricted to 2 Safe Places and Basic Geofencing.',
      [{ text: 'OK', onPress: onClose }]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerBadge}>
              <Ionicons name="sparkles-sharp" size={16} color={colors.accentGold} />
              <Text style={[styles.headerBadgeText, { color: colors.accentGold }]}>CIRCLE GUARD PLUS</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.title, { color: colors.foreground }]}>Unlock Premium Safety Architecture</Text>
            
            {gatedFeatureName ? (
              <View style={[styles.gatedBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)', borderColor: colors.accentGold }]}>
                <Ionicons name="lock-closed" size={16} color={colors.accentGold} />
                <Text style={[styles.gatedText, { color: colors.accentGold }]}>
                  "{gatedFeatureName}" is a Circle Guard Plus feature.
                </Text>
              </View>
            ) : null}

            {/* Pricing Packages Grid */}
            <View style={styles.pkgRow}>
              {/* Annual Package (Best Value) */}
              <TouchableOpacity
                style={[
                  styles.pkgCard,
                  { backgroundColor: colors.background, borderColor: selectedPeriod === 'annual' ? colors.accentGold : colors.border },
                  selectedPeriod === 'annual' ? styles.selectedPkgCard : null,
                ]}
                onPress={() => setSelectedPeriod('annual')}
              >
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>SAVE 28%</Text>
                </View>
                <Text style={[styles.pkgPeriod, { color: colors.textMuted }]}>ANNUAL PLAN</Text>
                <Text style={[styles.pkgPrice, { color: colors.foreground }]}>$59.99</Text>
                <Text style={[styles.pkgSub, { color: colors.accentGold }]}>$4.99 / mo billed yearly</Text>
              </TouchableOpacity>

              {/* Monthly Package */}
              <TouchableOpacity
                style={[
                  styles.pkgCard,
                  { backgroundColor: colors.background, borderColor: selectedPeriod === 'monthly' ? colors.accentGold : colors.border },
                  selectedPeriod === 'monthly' ? styles.selectedPkgCard : null,
                ]}
                onPress={() => setSelectedPeriod('monthly')}
              >
                <Text style={[styles.pkgPeriod, { color: colors.textMuted }]}>MONTHLY PLAN</Text>
                <Text style={[styles.pkgPrice, { color: colors.foreground }]}>$6.99</Text>
                <Text style={[styles.pkgSub, { color: colors.textMuted }]}>Billed monthly</Text>
              </TouchableOpacity>
            </View>

            {/* Features List (Source of Truth) */}
            <View style={styles.featuresContainer}>
              <Text style={[styles.featuresHeader, { color: colors.textMuted }]}>PLUS FEATURES INCLUDE:</Text>
              
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-sharp" size={18} color={colors.accentGold} />
                <Text style={[styles.featureText, { color: colors.foreground }]}>Unlimited Saved Safe Places (&gt; 2 per circle)</Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-sharp" size={18} color={colors.accentGold} />
                <Text style={[styles.featureText, { color: colors.foreground }]}>Speed-Adaptive Geofence Buffer</Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-sharp" size={18} color={colors.accentGold} />
                <Text style={[styles.featureText, { color: colors.foreground }]}>Active Hours & Days Scheduling</Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-sharp" size={18} color={colors.accentGold} />
                <Text style={[styles.featureText, { color: colors.foreground }]}>Commute Corridor Route & Live ETAs</Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-sharp" size={18} color={colors.accentGold} />
                <Text style={[styles.featureText, { color: colors.foreground }]}>Full Geofence Breach History Logs</Text>
              </View>

              <View style={[styles.freeNoticeBox, { borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                <Text style={[styles.freeNoticeText, { color: colors.textMuted }]}>
                  Manual SOS distress alerts & live location sharing are always 100% FREE.
                </Text>
              </View>
            </View>

          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.subscribeBtn, { backgroundColor: colors.accentGold }]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <Text style={styles.subscribeBtnText}>SUBSCRIBE ({selectedPkg.priceString})</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerSubRow}>
              <TouchableOpacity onPress={handleRestore}>
                <Text style={[styles.restoreText, { color: colors.textMuted }]}>RESTORE PURCHASES</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.border }}>•</Text>
              <TouchableOpacity onPress={handleToggleSandboxTest}>
                <Text style={[styles.restoreText, { color: colors.accentGold }]}>
                  {isPremium ? 'TEST: DEMOTE TO FREE' : 'TEST: UNLOCK PLUS'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.4,
    marginBottom: 16,
  },
  gatedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  gatedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pkgRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  pkgCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    position: 'relative',
  },
  selectedPkgCard: {
    borderWidth: 2,
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  saveBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: 0.5,
  },
  pkgPeriod: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  pkgPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pkgSub: {
    fontSize: 10,
    fontWeight: '700',
  },
  featuresContainer: {
    gap: 10,
  },
  featuresHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
  },
  freeNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  freeNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    padding: 20,
    gap: 12,
  },
  subscribeBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: 1,
  },
  footerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  restoreText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
