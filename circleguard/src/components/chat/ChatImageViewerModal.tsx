import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Linking,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../../utils/safeArea';
import { Chat5Attachment } from './ReactBitsChat5';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChatImageViewerModalProps {
  visible: boolean;
  attachment: Chat5Attachment | null;
  onClose: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}

export default function ChatImageViewerModal({
  visible,
  attachment,
  onClose,
  onDelete,
  canDelete = false,
}: ChatImageViewerModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);
  const bottomInset = Math.max(insets.bottom, 16);

  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setHasError(false);
  }, [attachment?.url]);

  if (!attachment) return null;

  const isImage = attachment.type === 'image' || 
    (attachment.url && attachment.url.match(/\.(jpeg|jpg|png|webp|gif)(\?.*)?$/i));

  const handleOpenExternal = async () => {
    if (!attachment.url) return;
    try {
      if (Platform.OS === 'web') {
        window.open(attachment.url, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(attachment.url);
      }
    } catch {
      Linking.openURL(attachment.url).catch(() => {});
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <StatusBar barStyle="light-content" />
        <View style={styles.safeContainer}>
          {/* Header - Strictly padded below status bar & punch-hole camera */}
          <View style={[styles.header, { paddingTop: topInset + 8, paddingBottom: 14 }]}>
            <TouchableOpacity
              style={styles.circleBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close viewer"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleBox}>
              <Text style={styles.headerFileName} numberOfLines={1}>
                {attachment.name || (isImage ? 'Photo' : 'Document')}
              </Text>
              <View style={styles.badgesRow}>
                {attachment.format && (
                  <View style={styles.badgeChip}>
                    <Text style={styles.badgeText}>{attachment.format}</Text>
                  </View>
                )}
                {attachment.size && (
                  <View style={styles.badgeChip}>
                    <Text style={styles.badgeText}>{attachment.size}</Text>
                  </View>
                )}
                {attachment.dimensions && (
                  <View style={styles.badgeChip}>
                    <Text style={styles.badgeText}>{attachment.dimensions}</Text>
                  </View>
                )}
                {attachment.pages && (
                  <View style={styles.badgeChip}>
                    <Text style={styles.badgeText}>{attachment.pages}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.headerRightActions}>
              {attachment.url && (
                <TouchableOpacity
                  style={styles.circleBtn}
                  onPress={handleOpenExternal}
                  activeOpacity={0.7}
                  accessibilityLabel="Download or open original"
                  accessibilityRole="button"
                >
                  <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {canDelete && onDelete && (
                <TouchableOpacity
                  style={[styles.circleBtn, styles.deleteBtn]}
                  onPress={() => {
                    onClose();
                    onDelete();
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel="Delete attachment"
                  accessibilityRole="button"
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Main Content Area */}
          <View style={styles.contentArea}>
            {isImage ? (
              <View style={styles.imageWrapper}>
                {loading && !hasError && (
                  <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.loadingText}>Loading full resolution…</Text>
                  </View>
                )}

                {hasError || !attachment.url ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.errorTitle}>Unable to Display Image</Text>
                    <Text style={styles.errorSub}>
                      {attachment.url
                        ? 'The image could not be loaded or the link has expired.'
                        : 'No preview URL available for this photo.'}
                    </Text>
                    {attachment.url && (
                      <TouchableOpacity
                        style={styles.actionPillBtn}
                        onPress={handleOpenExternal}
                      >
                        <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.actionPillText}>Open in Browser</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <Image
                    source={{ uri: attachment.url }}
                    style={styles.fullImage}
                    resizeMode="contain"
                    onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)}
                    onError={() => {
                      setLoading(false);
                      setHasError(true);
                    }}
                  />
                )}
              </View>
            ) : (
              /* Document / File Preview View */
              <View style={styles.documentWrapper}>
                <View style={styles.docIconBox}>
                  <Ionicons name="document-text" size={72} color="#FFFFFF" />
                </View>
                <Text style={styles.docTitle} numberOfLines={2}>
                  {attachment.name || 'Document Attachment'}
                </Text>
                <Text style={styles.docMeta}>
                  {[attachment.format || 'PDF', attachment.size, attachment.pages].filter(Boolean).join(' • ')}
                </Text>

                {attachment.url ? (
                  <TouchableOpacity
                    style={styles.openDocButton}
                    onPress={handleOpenExternal}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="open-outline" size={18} color="#000000" />
                    <Text style={styles.openDocButtonText}>VIEW / DOWNLOAD DOCUMENT</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.docNotice}>
                    Document registered in circle protocol deck.
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Bottom Footer Tip */}
          <View style={[styles.footer, { paddingBottom: bottomInset + 8 }]}>
            <Text style={styles.footerTip}>
              {isImage ? 'Tap close or swipe away to exit viewer' : 'Documents open safely in your system PDF viewer'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 14, 0.97)',
  },
  safeContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleBox: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerFileName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  badgeChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  contentArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  loaderOverlay: {
    ...(StyleSheet.absoluteFill as any),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  errorBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  errorSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  actionPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  documentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  docIconBox: {
    width: 110,
    height: 110,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  docTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 300,
  },
  docMeta: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  openDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  openDocButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  docNotice: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 8,
  },
  footer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerTip: {
    color: '#64748B',
    fontSize: 11,
  },
});
