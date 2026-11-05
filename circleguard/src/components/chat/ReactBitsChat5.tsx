import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/useThemeStore';
import ReadReceiptCheckmarks from '../ReadReceiptCheckmarks';

export interface Chat5Attachment {
  type: 'image' | 'file' | 'location';
  name: string;
  format?: string;
  size?: string;
  dimensions?: string;
  pages?: string;
  url?: string;
  latitude?: number;
  longitude?: number;
}

export interface Chat5Message {
  id: string;
  circle_id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  content: string;
  message_type: 'text' | 'location' | 'safety_pill' | 'image' | 'file';
  created_at: string;
  expires_at?: string | null;
  max_ttl_expires_at?: string | null;
  is_all_viewed?: boolean;
  is_viewed_by_me?: boolean;
  reactions?: Record<string, string[]>;
  attachment?: Chat5Attachment;
  replies_count?: number;
}

/**
 * Extracts and parses any attachment stored in standard format or inline JSON tag
 */
export function parseMessageAttachment(msg: Chat5Message): Chat5Attachment | null {
  if (msg.attachment) return msg.attachment;

  if (typeof msg.content === 'string' && msg.content.startsWith('[ATTACHMENT:')) {
    try {
      const match = msg.content.match(/^\[ATTACHMENT:([A-Z]+):(.*?)\](?:\s*(.*))?$/);
      if (match) {
        const type = match[1].toLowerCase() as 'image' | 'file' | 'location';
        const parsed = JSON.parse(match[2]);
        return {
          type,
          ...parsed,
        };
      }
    } catch {
      // Fallback if parsing fails
    }
  }

  // Location message detection
  if (msg.message_type === 'location' || (typeof msg.content === 'string' && msg.content.includes('Shared Live Location'))) {
    let lat: number | undefined;
    let lng: number | undefined;
    const coordsMatch = msg.content.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (coordsMatch) {
      lat = parseFloat(coordsMatch[1]);
      lng = parseFloat(coordsMatch[2]);
    }
    return {
      type: 'location',
      name: 'Live GPS Safe Haven Coordinates',
      format: 'GPS',
      size: 'High Accuracy',
      latitude: lat,
      longitude: lng,
    };
  }

  // Media URL fallback
  if (msg.message_type === 'image' || (typeof msg.content === 'string' && msg.content.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i))) {
    const rawUrl = msg.content.startsWith('http') ? msg.content : (msg as any).media_url;
    const filename = rawUrl ? rawUrl.split('/').pop()?.split('?')[0] : 'attached-photo.png';
    return {
      type: 'image',
      name: filename || 'photo.png',
      format: (filename?.split('.').pop() || 'PNG').toUpperCase(),
      size: '1.8 MB',
      dimensions: '2400×1350',
      url: rawUrl,
    };
  }

  return null;
}

/**
 * Returns user-visible caption without the internal attachment metadata wrapper
 */
export function getCleanMessageContent(rawContent: string): string {
  if (!rawContent) return '';
  if (rawContent.startsWith('[ATTACHMENT:')) {
    const match = rawContent.match(/^\[ATTACHMENT:[A-Z]+:.*?\](?:\s*(.*))?$/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return '';
  }
  // If the content is purely an image/GIF URL, it is rendered in the attachment preview card
  if (rawContent.trim().match(/^https?:\/\/\S+\.(jpeg|jpg|gif|png|webp)(\?\S*)?$/i)) {
    return '';
  }
  return rawContent;
}

/* =========================================================================
   1. CHAT 5 HEADER (With Channel Title, Online Indicator & Avatar Stack)
   ========================================================================= */

interface Chat5HeaderProps {
  channelName: string;
  memberCount: number;
  onlineCount: number;
  members: any[];
  onBack: () => void;
  onOpenMembers: () => void;
  onShareLocation?: () => void;
  topInset: number;
}

export function Chat5Header({
  channelName,
  memberCount,
  onlineCount,
  members,
  onBack,
  onOpenMembers,
  onShareLocation,
  topInset,
}: Chat5HeaderProps) {
  const { colors, isDark } = useThemeStore();
  const displayMembers = (members || []).slice(0, 3);
  const remainingCount = Math.max(0, (members || []).length - 3);

  return (
    <View
      style={[
        styles.headerContainer,
        {
          paddingTop: topInset + 8,
          backgroundColor: isDark ? '#0D0F12' : '#FFFFFF',
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
        },
      ]}
    >
      <View style={styles.headerLeftRow}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
          activeOpacity={0.7}
          accessibilityLabel="Back to Circles"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerChannelName, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
            {channelName ? (channelName.startsWith('#') ? channelName : `#${channelName}`) : '#circle-chat'}
          </Text>
          <View style={styles.headerSubtitleRow}>
            <View style={styles.onlinePulseDot} />
            <Text style={[styles.headerMemberSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'} · {onlineCount} online
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.headerRightRow}>
        {/* Avatar Stack Pill */}
        <TouchableOpacity
          style={[
            styles.avatarStackBtn,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
            },
          ]}
          onPress={onOpenMembers}
          activeOpacity={0.7}
          accessibilityLabel="View Circle Members"
          accessibilityRole="button"
        >
          <View style={styles.avatarStackOverlaps}>
            {displayMembers.map((m, idx) => {
              const name = m.profile?.full_name || m.full_name || 'Member';
              const avatar = m.profile?.avatar_url || m.avatar_url;
              const initial = name.charAt(0).toUpperCase();

              return (
                <View
                  key={m.user_id || m.id || idx}
                  style={[
                    styles.stackedAvatarCircle,
                    {
                      marginLeft: idx === 0 ? 0 : -8,
                      borderColor: isDark ? '#0D0F12' : '#FFFFFF',
                      backgroundColor: isDark ? '#1E232D' : '#E2E8F0',
                    },
                  ]}
                >
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.stackedAvatarImg} />
                  ) : (
                    <Text style={[styles.stackedAvatarInitial, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {initial}
                    </Text>
                  )}
                </View>
              );
            })}
            {remainingCount > 0 && (
              <View
                style={[
                  styles.stackedAvatarCircle,
                  styles.stackedBadgeRemaining,
                  {
                    marginLeft: -8,
                    borderColor: isDark ? '#0D0F12' : '#FFFFFF',
                    backgroundColor: isDark ? '#27272A' : '#CBD5E1',
                  },
                ]}
              >
                <Text style={[styles.remainingCountText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  +{remainingCount}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.membersLabelChip}>
            <Ionicons name="people-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
            <Text style={[styles.membersBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Members</Text>
          </View>
        </TouchableOpacity>

        {onShareLocation && (
          <TouchableOpacity
            style={[
              styles.headerLocationBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
              },
            ]}
            onPress={onShareLocation}
            activeOpacity={0.7}
            accessibilityLabel="Share Current Location"
            accessibilityRole="button"
          >
            <Ionicons name="location-outline" size={18} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* =========================================================================
   2. CHAT 5 ATTACHMENT CARD (Image, Document & Location)
   ========================================================================= */

interface Chat5AttachmentCardProps {
  attachment: Chat5Attachment;
  onViewLocation?: (lat: number, lng: number) => void;
  onOpenAttachment?: (attachment: Chat5Attachment) => void;
}

export function Chat5AttachmentCard({
  attachment,
  onViewLocation,
  onOpenAttachment,
}: Chat5AttachmentCardProps) {
  const { isDark } = useThemeStore();
  const [imageError, setImageError] = useState(false);

  if (attachment.type === 'image') {
    return (
      <View
        style={[
          styles.attachmentImageCard,
          {
            backgroundColor: isDark ? '#161920' : '#F8FAFC',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onOpenAttachment?.(attachment)}
          style={styles.attachmentImagePreviewBox}
        >
          {attachment.url && !imageError ? (
            <Image
              source={{ uri: attachment.url }}
              style={styles.attachmentImg}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.attachmentImagePlaceholder}>
              <Ionicons name="image-outline" size={36} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
              <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 11, marginTop: 4 }}>
                {imageError ? 'Preview unavailable • Tap to view' : 'Attached Photo'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.attachmentImageMetaFooter}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.attachmentFileName, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
              {attachment.name || 'image.png'}
            </Text>
            <View style={styles.attachmentBadgesRow}>
              {attachment.format ? (
                <Text style={[styles.attachmentBadgeText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {attachment.format}
                </Text>
              ) : null}
              {attachment.size ? (
                <Text style={[styles.attachmentBadgeText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  · {attachment.size}
                </Text>
              ) : null}
              {attachment.dimensions ? (
                <Text style={[styles.attachmentBadgeText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  · {attachment.dimensions}
                </Text>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.attachmentDownloadBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)' }]}
            onPress={() => onOpenAttachment?.(attachment)}
            activeOpacity={0.7}
          >
            <Ionicons name="download-outline" size={16} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (attachment.type === 'file') {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onOpenAttachment?.(attachment)}
        style={[
          styles.attachmentFileCard,
          {
            backgroundColor: isDark ? '#161920' : '#F8FAFC',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
          },
        ]}
      >
        <View style={[styles.attachmentFileIconBox, { backgroundColor: isDark ? '#242A36' : '#E2E8F0' }]}>
          <Ionicons name="document-text-outline" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
        </View>

        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <Text style={[styles.attachmentFileName, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
            {attachment.name || 'document.pdf'}
          </Text>
          <Text style={[styles.attachmentBadgeText, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
            {[attachment.format || 'PDF', attachment.size || '640 KB', attachment.pages || '12 pages'].filter(Boolean).join(' · ')}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.attachmentDownloadBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)' }]}
          onPress={() => onOpenAttachment?.(attachment)}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={16} color={isDark ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // Location Card
  return (
    <View
      style={[
        styles.attachmentLocationCard,
        {
          backgroundColor: isDark ? '#161920' : '#F8FAFC',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
        },
      ]}
    >
      <View style={styles.locationHeaderRow}>
        <View style={[styles.locationIconPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]}>
          <Ionicons name="location" size={16} color={isDark ? '#FFFFFF' : '#0F172A'} />
        </View>
        <Text style={[styles.locationTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          {attachment.name || 'Live Safe Haven Location'}
        </Text>
      </View>

      {attachment.latitude && attachment.longitude && (
        <Text style={[styles.locationCoordsText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          {attachment.latitude.toFixed(5)}, {attachment.longitude.toFixed(5)}
        </Text>
      )}

      {onViewLocation && attachment.latitude && attachment.longitude && (
        <TouchableOpacity
          style={[styles.viewMapActionBtn, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]}
          onPress={() => onViewLocation(attachment.latitude!, attachment.longitude!)}
          activeOpacity={0.8}
        >
          <Ionicons name="map-outline" size={13} color={isDark ? '#000000' : '#FFFFFF'} />
          <Text style={[styles.viewMapActionText, { color: isDark ? '#000000' : '#FFFFFF' }]}>VIEW ON MAP</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* =========================================================================
   3. CHAT 5 MESSAGE ITEM (Full Group Chat Layout, Replies & Reactions)
   ========================================================================= */

interface Chat5MessageItemProps {
  item: Chat5Message;
  isMe: boolean;
  currentUserId?: string;
  onTagMember?: (member: { id: string; name: string; avatar?: string | null }) => void;
  onToggleReaction?: (msgId: string, emoji: string) => void;
  onOpenReactions?: (msgId: string | null) => void;
  onOpenFullEmojiPicker?: (msgId: string) => void;
  isReactionOpen?: boolean;
  onDelete?: (msg: Chat5Message) => void;
  onViewLocation?: (lat: number, lng: number) => void;
  onOpenAttachment?: (attachment: Chat5Attachment) => void;
  onReplyThread?: (msg: Chat5Message) => void;
  timeRemainingText?: string;
  emojiOptions?: string[];
}

export function Chat5MessageItem({
  item,
  isMe,
  currentUserId,
  onTagMember,
  onToggleReaction,
  onOpenReactions,
  onOpenFullEmojiPicker,
  isReactionOpen,
  onDelete,
  onViewLocation,
  onOpenAttachment,
  onReplyThread,
  timeRemainingText,
  emojiOptions = ['❤️', '👍', '🔥', '😂', '😮', '🙏', '🛡️'],
}: Chat5MessageItemProps) {
  const { isDark } = useThemeStore();
  const attachment = parseMessageAttachment(item);
  const cleanContent = getCleanMessageContent(item.content);
  const initial = String(item.sender_name || 'M').charAt(0).toUpperCase();

  const reactionEntries = Object.entries(item.reactions || {}).filter(([_, users]) => users && users.length > 0);
  const repliesCount = item.replies_count || (item as any).reply_count || 0;

  return (
    <View style={[styles.chat5RowContainer, isMe ? styles.chat5RowMe : styles.chat5RowOther]}>
      {/* Left Avatar for Others */}
      {!isMe && (
        <TouchableOpacity
          style={[
            styles.chat5AvatarBox,
            {
              backgroundColor: isDark ? '#1E232D' : '#E2E8F0',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1',
            },
          ]}
          onPress={() => {
            if (item.sender_name && onTagMember) {
              onTagMember({
                id: item.sender_id,
                name: item.sender_name,
                avatar: item.sender_avatar,
              });
            }
          }}
          activeOpacity={0.7}
        >
          {item.sender_avatar ? (
            <Image source={{ uri: item.sender_avatar }} style={styles.chat5AvatarImg} />
          ) : (
            <Text style={[styles.chat5AvatarInitial, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{initial}</Text>
          )}
        </TouchableOpacity>
      )}

      <View style={[styles.chat5BubbleColumn, { alignItems: isMe ? 'flex-end' : 'flex-start' }]}>
        {/* Header Line: Tomas Lindqvist 09:58 */}
        <View style={[styles.chat5MetaLine, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
          {!isMe && (
            <TouchableOpacity
              onPress={() => {
                if (item.sender_name && onTagMember) {
                  onTagMember({
                    id: item.sender_id,
                    name: item.sender_name,
                    avatar: item.sender_avatar,
                  });
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.chat5SenderName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {item.sender_name || 'Member'}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.chat5TimestampText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>

          {isMe && (
            <ReadReceiptCheckmarks
              isSent={true}
              isDelivered={true}
              isReadByAll={item.is_all_viewed}
              color={isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.6)'}
            />
          )}
        </View>

        {/* Reaction Bar Flyout */}
        {isReactionOpen && onToggleReaction && (
          <View
            style={[
              styles.floatingReactionFlyout,
              {
                backgroundColor: isDark ? '#1E232D' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#E2E8F0',
              },
            ]}
          >
            {emojiOptions.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.floatingEmojiBtn}
                onPress={() => onToggleReaction(item.id, emoji)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 18 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}

            {onOpenFullEmojiPicker && (
              <TouchableOpacity
                style={[
                  styles.floatingAddMoreBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
                  },
                ]}
                onPress={() => {
                  onOpenReactions?.(null);
                  onOpenFullEmojiPicker(item.id);
                }}
                activeOpacity={0.7}
                accessibilityLabel="Choose from all emojis"
                accessibilityRole="button"
              >
                <Ionicons name="add" size={17} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Message Content Container */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onOpenReactions?.(item.id)}
          onLongPress={() => onDelete?.(item)}
          delayLongPress={300}
          style={[
            styles.chat5BubbleBody,
            isMe
              ? [
                  styles.chat5BubbleMe,
                  {
                    backgroundColor: isDark ? '#272A30' : '#0F172A',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#0F172A',
                  },
                ]
              : [
                  styles.chat5BubbleOther,
                  {
                    backgroundColor: isDark ? '#161920' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                  },
                ],
          ]}
        >
          {/* Attachment Preview (if any) */}
          {attachment && (
            <Chat5AttachmentCard
              attachment={attachment}
              onViewLocation={onViewLocation}
              onOpenAttachment={onOpenAttachment}
            />
          )}

          {/* Clean Text Content */}
          {cleanContent ? (
            <Text
              style={[
                styles.chat5MessageText,
                { color: isMe ? '#FFFFFF' : isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              {cleanContent}
            </Text>
          ) : null}

          {/* Disappearing Timer Notice */}
          {timeRemainingText ? (
            <View style={styles.disappearingTagBadge}>
              <Ionicons name="time-outline" size={11} color={isDark ? '#94A3B8' : '#64748B'} />
              <Text style={[styles.disappearingTagText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {timeRemainingText}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {/* Thread Replies Pill Button */}
        {repliesCount > 0 && onReplyThread && (
          <TouchableOpacity
            style={[
              styles.repliesCountPill,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
              },
            ]}
            onPress={() => onReplyThread(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubbles-outline" size={12} color={isDark ? '#94A3B8' : '#64748B'} />
            <Text style={[styles.repliesCountText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {repliesCount} {repliesCount === 1 ? 'reply' : 'replies'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Reactions List with Plus Button */}
        <View style={styles.reactionsLine}>
          {reactionEntries.map(([emoji, userList]) => {
            const hasMyReaction = currentUserId ? userList.includes(currentUserId) : false;
            return (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.reactionItemPill,
                  {
                    backgroundColor: hasMyReaction
                      ? (isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.16)')
                      : (isDark ? '#1C2028' : '#FFFFFF'),
                    borderColor: hasMyReaction
                      ? '#F59E0B'
                      : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#CBD5E1'),
                  },
                ]}
                onPress={() => onToggleReaction?.(item.id, emoji)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 12 }}>{emoji}</Text>
                <Text
                  style={[
                    styles.reactionCountText,
                    {
                      color: hasMyReaction
                        ? (isDark ? '#FBBF24' : '#B45309')
                        : (isDark ? '#FFFFFF' : '#0F172A'),
                    },
                  ]}
                >
                  {userList.length}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Plus button to open full emoji picker */}
          <TouchableOpacity
            style={[
              styles.reactionPlusBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
              },
            ]}
            onPress={() => {
              if (onOpenFullEmojiPicker) {
                onOpenFullEmojiPicker(item.id);
              } else {
                onOpenReactions?.(item.id);
              }
            }}
            activeOpacity={0.7}
            accessibilityLabel="Add reaction"
            accessibilityRole="button"
          >
            <Ionicons name="add" size={13} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* =========================================================================
   4. CHAT 5 COMPOSER (Input Bar with Attachment '+', Emoji & Send)
   ========================================================================= */

interface Chat5ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onOpenAttachment: () => void;
  onOpenEmoji: () => void;
  channelName: string;
  sending?: boolean;
  inputRef?: any;
}

export function Chat5Composer({
  value,
  onChangeText,
  onSend,
  onOpenAttachment,
  onOpenEmoji,
  channelName,
  sending,
  inputRef,
}: Chat5ComposerProps) {
  const { isDark } = useThemeStore();
  const cleanChannel = channelName.replace(/^#/, '');

  return (
    <View
      style={[
        styles.composerContainer,
        {
          backgroundColor: isDark ? '#0D0F12' : '#FFFFFF',
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
        },
      ]}
    >
      <View
        style={[
          styles.composerPillBar,
          {
            backgroundColor: isDark ? '#161920' : '#F1F5F9',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
          },
        ]}
      >
        {/* Attachment '+' Button */}
        <TouchableOpacity
          style={[styles.composerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }]}
          onPress={onOpenAttachment}
          activeOpacity={0.7}
          accessibilityLabel="Open Attachments Drawer"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>

        {/* Text Input */}
        <TextInput
          ref={inputRef}
          style={[styles.composerInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
          placeholder={`Message #${cleanChannel || 'circle'}`}
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          value={value}
          onChangeText={onChangeText}
          multiline
        />

        {/* Emoji Button */}
        <TouchableOpacity
          style={styles.composerIconBtn}
          onPress={onOpenEmoji}
          activeOpacity={0.7}
          accessibilityLabel="Open Emoji Picker"
          accessibilityRole="button"
        >
          <Ionicons name="happy-outline" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
        </TouchableOpacity>

        {/* Send Button */}
        <TouchableOpacity
          style={[
            styles.composerSendBtn,
            {
              backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
              opacity: !value.trim() && !sending ? 0.4 : 1,
            },
          ]}
          onPress={onSend}
          disabled={sending || !value.trim()}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
          ) : (
            <Ionicons name="paper-plane" size={15} color={isDark ? '#000000' : '#FFFFFF'} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* =========================================================================
   5. CHAT 5 ATTACHMENT SHEET MODAL (Photos, Documents, GPS & Safety Pills)
   ========================================================================= */

interface Chat5AttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onPickPhoto: () => void;
  onAttachDocument: () => void;
  onShareLocation: () => void;
  onSelectSafetyPill: (pillText: string) => void;
}

export function Chat5AttachmentSheet({
  visible,
  onClose,
  onPickPhoto,
  onAttachDocument,
  onShareLocation,
  onSelectSafetyPill,
}: Chat5AttachmentSheetProps) {
  const { isDark } = useThemeStore();
  const quickPills = ["I'm Safe", "On My Way", "Heading Home", "Call Me ASAP"];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Dismiss sheet"
        />
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#14171E' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.sheetHandleBar} />

          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Add Attachment
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
              <Ionicons name="close" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>
          </View>

          {/* Action Grid */}
          <View style={styles.sheetGrid}>
            <TouchableOpacity
              style={[styles.sheetGridItem, { backgroundColor: isDark ? '#1C202A' : '#F8FAFC' }]}
              onPress={() => {
                onClose();
                onPickPhoto();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.sheetItemIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                <Ionicons name="image-outline" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </View>
              <Text style={[styles.sheetItemTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Photo / Image</Text>
              <Text style={[styles.sheetItemSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>From camera or gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetGridItem, { backgroundColor: isDark ? '#1C202A' : '#F8FAFC' }]}
              onPress={() => {
                onClose();
                onAttachDocument();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.sheetItemIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                <Ionicons name="document-text-outline" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </View>
              <Text style={[styles.sheetItemTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Document</Text>
              <Text style={[styles.sheetItemSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>PDF protocols, guides</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetGridItem, { backgroundColor: isDark ? '#1C202A' : '#F8FAFC' }]}
              onPress={() => {
                onClose();
                onShareLocation();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.sheetItemIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                <Ionicons name="location-outline" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </View>
              <Text style={[styles.sheetItemTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Share Location</Text>
              <Text style={[styles.sheetItemSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>Live GPS safe coordinates</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Safety Pills Strip */}
          <Text style={[styles.sheetSectionHeading, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            QUICK SAFETY STATUS PILLS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetPillsRow}>
            {quickPills.map((pill) => (
              <TouchableOpacity
                key={pill}
                style={[
                  styles.sheetPillChip,
                  {
                    backgroundColor: isDark ? '#1C202A' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1',
                  },
                ]}
                onPress={() => {
                  onClose();
                  onSelectSafetyPill(pill);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="shield-checkmark-outline" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
                <Text style={[styles.sheetPillChipText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{pill}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* =========================================================================
   6. CHAT 5 MEMBERS MODAL (Member Details, Online Status & Direct Tag)
   ========================================================================= */

interface Chat5MembersModalProps {
  visible: boolean;
  onClose: () => void;
  members: any[];
  channelName: string;
  onTagMember: (member: { id: string; name: string; avatar?: string | null }) => void;
}

export function Chat5MembersModal({
  visible,
  onClose,
  members,
  channelName,
  onTagMember,
}: Chat5MembersModalProps) {
  const { isDark } = useThemeStore();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.membersModalOverlay}>
        {/* Background dismiss layer */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Dismiss members modal"
        />

        {/* Modal Card - Independent View allowing free touch scrolling */}
        <View
          style={[
            styles.membersModalCard,
            {
              backgroundColor: isDark ? '#14171E' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.membersModalHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {channelName || 'Circle Members'}
              </Text>
              <Text style={[styles.membersModalSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {members.length} {members.length === 1 ? 'member' : 'members'} in this circle
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.membersScrollView}
            contentContainerStyle={styles.membersScrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            bounces={true}
            scrollEventThrottle={16}
          >
            {members.map((m) => {
              const name = m.profile?.full_name || m.full_name || 'Member';
              const avatar = m.profile?.avatar_url || m.avatar_url;
              const battery = m.battery_level ?? m.profile?.battery_level;
              const role = m.role || 'Member';

              return (
                <View
                  key={m.user_id || m.id}
                  style={[
                    styles.memberListItem,
                    { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                  ]}
                >
                  <View style={[styles.memberListAvatarBox, { backgroundColor: isDark ? '#1E232D' : '#E2E8F0' }]}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.memberListAvatarImg} />
                    ) : (
                      <Text style={[styles.memberListAvatarInitial, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text style={[styles.memberListName, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <View style={styles.memberListStatusRow}>
                      <Text style={[styles.memberRoleText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                        {role.toUpperCase()}
                      </Text>
                      {battery !== undefined && (
                        <Text style={[styles.memberRoleText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          · 🔋 {battery}%
                        </Text>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.memberTagActionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                        borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1',
                      },
                    ]}
                    onPress={() => {
                      onClose();
                      onTagMember({
                        id: m.user_id || m.id,
                        name,
                        avatar,
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="at" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
                    <Text style={[styles.memberTagActionText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Tag</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* =========================================================================
   STYLES
   ========================================================================= */

const styles = StyleSheet.create({
  // Header
  headerContainer: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerChannelName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 5,
  },
  onlinePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  headerMemberSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  avatarStackOverlaps: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  stackedAvatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stackedAvatarImg: {
    width: '100%',
    height: '100%',
  },
  stackedAvatarInitial: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  stackedBadgeRemaining: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingCountText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  membersLabelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  membersBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  headerLocationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Attachments
  attachmentImageCard: {
    width: 260,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 6,
  },
  attachmentImagePreviewBox: {
    width: '100%',
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentImg: {
    width: '100%',
    height: '100%',
  },
  attachmentImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentImageMetaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  attachmentFileName: {
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  attachmentBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  attachmentBadgeText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  attachmentDownloadBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentFileCard: {
    width: 260,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  attachmentFileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentLocationCard: {
    width: 260,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  locationIconPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  locationCoordsText: {
    fontSize: 11,
    marginBottom: 8,
    marginLeft: 34,
  },
  viewMapActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'stretch',
  },
  viewMapActionText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Message Items
  chat5RowContainer: {
    flexDirection: 'row',
    marginVertical: 6,
    paddingHorizontal: 4,
  },
  chat5RowMe: {
    justifyContent: 'flex-end',
  },
  chat5RowOther: {
    justifyContent: 'flex-start',
  },
  chat5AvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  chat5AvatarImg: {
    width: '100%',
    height: '100%',
  },
  chat5AvatarInitial: {
    fontSize: 13,
    fontWeight: '700',
  },
  chat5BubbleColumn: {
    maxWidth: '82%',
  },
  chat5MetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  chat5SenderName: {
    fontSize: 12,
    fontWeight: '700',
  },
  chat5TimestampText: {
    fontSize: 10,
    fontWeight: '500',
  },
  chat5BubbleBody: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  chat5BubbleMe: {
    borderTopRightRadius: 4,
  },
  chat5BubbleOther: {
    borderTopLeftRadius: 4,
  },
  chat5MessageText: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '400',
  },
  disappearingTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  disappearingTagText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  repliesCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  repliesCountText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  reactionsLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionItemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  reactionCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  reactionPlusBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingReactionFlyout: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 4,
    gap: 4,
  },
  floatingEmojiBtn: {
    padding: 3,
  },
  floatingAddMoreBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },

  // Composer
  composerContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  composerPillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minHeight: 46,
  },
  composerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    fontSize: 13.5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    maxHeight: 100,
  },
  composerSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingTop: 10,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sheetCloseBtn: {
    padding: 4,
  },
  sheetGrid: {
    gap: 8,
    marginBottom: 16,
  },
  sheetGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
  },
  sheetItemIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sheetItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 1,
  },
  sheetItemSub: {
    fontSize: 11,
  },
  sheetSectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  sheetPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  sheetPillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  sheetPillChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Members Modal
  membersModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  membersModalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  membersScrollView: {
    maxHeight: 460,
  },
  membersScrollContent: {
    paddingBottom: 16,
  },
  membersModalContainer: {
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  membersModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  membersModalSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  memberListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  memberListAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberListAvatarImg: {
    width: '100%',
    height: '100%',
  },
  memberListAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
  },
  memberListName: {
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberListStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberRoleText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  memberTagActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  memberTagActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
