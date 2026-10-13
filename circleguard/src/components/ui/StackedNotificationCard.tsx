import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/useThemeStore';

export interface StackedAlertItem {
  id: string;
  variant: 'success' | 'warning' | 'info' | 'destructive';
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

export interface StackedNotificationCardProps {
  alerts: StackedAlertItem[];
  className?: string;
}

export default function StackedNotificationCard({ alerts }: StackedNotificationCardProps) {
  const { isDark } = useThemeStore();

  if (!alerts || alerts.length === 0) return null;

  return (
    <View
      style={[
        styles.frameContainer,
        isDark ? styles.frameContainerDark : styles.frameContainerLight,
      ]}
    >
      {alerts.map((item, index) => {
        const isFirst = index === 0;
        const isLast = index === alerts.length - 1;

        const getIconConfig = () => {
          switch (item.variant) {
            case 'success':
              return { name: 'checkmark-circle' as const, color: '#10B981', bg: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5' };
            case 'warning':
              return { name: 'warning' as const, color: '#F59E0B', bg: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB' };
            case 'destructive':
              return { name: 'alert-circle' as const, color: '#EF4444', bg: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2' };
            case 'info':
            default:
              return { name: 'information-circle' as const, color: '#3B82F6', bg: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF' };
          }
        };

        const iconConfig = getIconConfig();

        return (
          <View
            key={item.id}
            style={[
              styles.panelContainer,
              !isLast && (isDark ? styles.panelDividerDark : styles.panelDividerLight),
              item.variant === 'warning' && (isDark ? { backgroundColor: 'rgba(245, 158, 11, 0.04)' } : { backgroundColor: '#FFFEFA' }),
              item.variant === 'success' && (isDark ? { backgroundColor: 'rgba(16, 185, 129, 0.03)' } : { backgroundColor: '#FAFFFD' }),
            ]}
          >
            {/* Icon */}
            <View style={styles.iconWrap}>
              <Ionicons name={iconConfig.name} size={18} color={iconConfig.color} />
            </View>

            {/* Content & Action */}
            <View style={styles.contentWrap}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.titleText,
                    isDark ? styles.textLight : styles.textDark,
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>

                {/* Right Action Button */}
                {item.actionText && item.onAction && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      item.variant === 'warning'
                        ? (isDark ? styles.actionButtonWarningDark : styles.actionButtonWarningLight)
                        : (isDark ? styles.actionButtonDefaultDark : styles.actionButtonDefaultLight),
                    ]}
                    onPress={item.onAction}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        item.variant === 'warning'
                          ? { color: '#D97706' }
                          : (isDark ? { color: '#3ADFAB' } : { color: '#006C4F' }),
                      ]}
                    >
                      {item.actionText}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Description */}
              <Text
                style={[
                  styles.descriptionText,
                  isDark ? styles.subtextDark : styles.subtextLight,
                ]}
              >
                {item.description}
              </Text>

              {/* Secondary action button (e.g. Battery settings) */}
              {item.secondaryActionText && item.onSecondaryAction && (
                <TouchableOpacity
                  style={styles.secondaryActionRow}
                  onPress={item.onSecondaryAction}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.secondaryActionText, isDark && { color: '#3ADFAB' }]}>
                    {item.secondaryActionText} ›
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frameContainer: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginVertical: 8,
  },
  frameContainerLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  frameContainerDark: {
    backgroundColor: '#16201B',
    borderColor: '#26342D',
  },
  panelContainer: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'flex-start',
  },
  panelDividerLight: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  panelDividerDark: {
    borderBottomWidth: 1,
    borderBottomColor: '#26342D',
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  contentWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 26,
    marginBottom: 3,
  },
  titleText: {
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
    paddingRight: 8,
    letterSpacing: -0.1,
  },
  descriptionText: {
    fontSize: 12,
    lineHeight: 17,
  },
  textLight: {
    color: '#FFFFFF',
  },
  textDark: {
    color: '#111827',
  },
  subtextLight: {
    color: '#6B7280',
  },
  subtextDark: {
    color: '#9EACA3',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonWarningLight: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  actionButtonWarningDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  actionButtonDefaultLight: {
    backgroundColor: '#E6F4ED',
    borderWidth: 1,
    borderColor: '#CBE6D7',
  },
  actionButtonDefaultDark: {
    backgroundColor: 'rgba(58, 223, 171, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(58, 223, 171, 0.3)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryActionRow: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  secondaryActionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#006C4F',
  },
});
