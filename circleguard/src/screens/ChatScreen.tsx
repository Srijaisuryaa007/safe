import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeTopInset } from '../utils/safeArea';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { getThemeChatBubbleStyles, getThemeButtonStyles, getThemeBorderStyles } from '../constants/theme';
import { sendExpoPushNotification } from '../services/PushNotificationService';
import TypingIndicator from '../components/TypingIndicator';
import ReadReceiptCheckmarks from '../components/ReadReceiptCheckmarks';
import EmojiGifPickerModal from '../components/EmojiGifPickerModal';
import LuxuryRadarLoading from '../components/LuxuryRadarLoading';
import { RateLimiter } from '../services/RateLimiter';
import { ValidationSchema } from '../lib/validationSchema';
import { handleServiceError } from '../lib/errorHandler';
import {
  Chat5Header,
  Chat5MessageItem,
  Chat5Composer,
  Chat5AttachmentSheet,
  Chat5MembersModal,
  Chat5Attachment,
  parseMessageAttachment,
} from '../components/chat/ReactBitsChat5';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { decode } from 'base64-arraybuffer';
import {
  validateAttachmentUpload,
  validateImageUpload,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '../lib/fileUploadSecurity';
import ChatImageViewerModal from '../components/chat/ChatImageViewerModal';

async function readAttachmentAsBase64Async(uri: string): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (fsErr) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          const commaIdx = res.indexOf(',');
          resolve(commaIdx !== -1 ? res.substring(commaIdx + 1) : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      throw fsErr;
    }
  }
}

export interface ChatMessage {
  id: string;
  circle_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'location' | 'safety_pill' | 'image' | 'file';
  media_url?: string;
  created_at: string;
  expires_at?: string | null;
  max_ttl_expires_at?: string | null;
  deleted_at?: string | null;
  is_all_viewed?: boolean;
  sender_name?: string;
  sender_avatar?: string;
  is_viewed_by_me?: boolean;
  reactions?: Record<string, string[]>;
  attachment?: Chat5Attachment;
  replies_count?: number;
}

export interface TaggedMemberInfo {
  id: string;
  name: string;
  avatar?: string | null;
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors, themeMode, isDark } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();

  const insets = useSafeAreaInsets();
  const topInset = getSafeTopInset(insets.top);

  // If explicitly requested to only filter, apply filter; otherwise keep all circle messages visible
  const isExplicitFilter = Boolean(route.params?.onlyFilter || (route.params?.filterMemberId && !route.params?.taggedMember));
  const initialFilterId = isExplicitFilter ? (route.params?.filterMemberId || route.params?.memberId) : null;
  const targetMemberName = route.params?.memberName;
  const [activeFilterMemberId, setActiveFilterMemberId] = useState<string | null>(initialFilterId || null);

  useEffect(() => {
    if (route.params?.onlyFilter || (route.params?.filterMemberId && !route.params?.taggedMember)) {
      const fId = route.params?.filterMemberId || route.params?.memberId;
      if (fId) {
        setActiveFilterMemberId(fId);
      }
    }
  }, [route.params?.onlyFilter, route.params?.filterMemberId, route.params?.taggedMember, route.params?.memberId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [selectedReactionMsgId, setSelectedReactionMsgId] = useState<string | null>(null);
  const [reactionTargetMsgId, setReactionTargetMsgId] = useState<string | null>(null);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [selectedViewerAttachment, setSelectedViewerAttachment] = useState<Chat5Attachment | null>(null);
  const [selectedViewerMsgId, setSelectedViewerMsgId] = useState<string | null>(null);

  // Active Tagged Member State
  const [taggedMember, setTaggedMember] = useState<TaggedMemberInfo | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  const uploadChatAttachmentFile = async (
    userId: string,
    fileName: string,
    base64Data: string,
    contentType: string
  ): Promise<string> => {
    const cleanBase64 = base64Data.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '').trim();
    const fileBytes = decode(cleanBase64);
    const cleanExt = fileName.split('.').pop() || 'bin';
    const cleanBaseName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const storagePath = `${userId}/chat_${Date.now()}_${cleanBaseName}.${cleanExt}`;

    const bucket = 'chat-attachments';
    let uploadRes = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBytes, { contentType, upsert: true });

    if (uploadRes.error) {
      console.warn('Initial chat-attachments upload note, retrying standard upload:', uploadRes.error);
      uploadRes = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileBytes, { contentType, upsert: false });
    }

    if (uploadRes.error) {
      console.error('Chat attachment storage upload failed:', uploadRes.error);
      throw uploadRes.error;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return urlData.publicUrl;
  };

  const handlePickPhotoAttachment = async () => {
    if (!profile?.id) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll permission is required to attach photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setSending(true);

      const base64 = asset.base64 || (await readAttachmentAsBase64Async(asset.uri));

      const validation = validateImageUpload({
        base64Content: base64,
        fileSizeBytes: asset.fileSize,
        userId: profile.id,
        maxSizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
        prefix: 'chat_photo',
      });

      if (!validation.valid) {
        Alert.alert('Photo Upload', validation.error || 'Please select a valid image under 25MB.');
        setSending(false);
        return;
      }

      const rawFileName = asset.fileName || `photo-${Date.now().toString().slice(-4)}.${validation.extension || 'jpg'}`;
      const format = validation.extension?.toUpperCase() || 'JPEG';
      const dimensions = asset.width && asset.height ? `${asset.width}×${asset.height}` : '1920×1080';
      const fileSize = asset.fileSize
        ? (asset.fileSize > 1024 * 1024 ? `${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(asset.fileSize / 1024)} KB`)
        : '1.2 MB';

      // Upload to Supabase Storage so every circle member can view it across any device
      const publicUrl = await uploadChatAttachmentFile(
        profile.id,
        rawFileName,
        base64,
        validation.detectedMimeType || 'image/jpeg'
      );

      const attachmentPayload = `[ATTACHMENT:IMAGE:${JSON.stringify({
        name: rawFileName,
        format,
        size: fileSize,
        dimensions,
        url: publicUrl,
      })}]`;

      await handleSendText(attachmentPayload, 'text');
    } catch (err: any) {
      console.error('Error attaching photo:', err);
      const userMessage = err?.message || 'Could not upload photo. Please check your internet connection and try again.';
      Alert.alert('Photo Upload Notice', userMessage);
    } finally {
      setSending(false);
    }
  };

  const handleAttachDocument = async () => {
    if (!profile?.id) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const maxLimit = MAX_ATTACHMENT_SIZE_BYTES; // 25MB limit

      if (asset.size && asset.size > maxLimit) {
        const sizeMb = (asset.size / (1024 * 1024)).toFixed(1);
        Alert.alert(
          'File Too Large',
          `The selected document (${sizeMb}MB) exceeds the maximum allowed limit of 25MB. Please choose a smaller document.`
        );
        return;
      }

      setSending(true);

      const base64 = await readAttachmentAsBase64Async(asset.uri);

      const validation = validateAttachmentUpload({
        fileName: asset.name,
        fileSizeBytes: asset.size,
        userId: profile.id,
        base64Content: base64,
        maxSizeBytes: maxLimit,
      });

      if (!validation.valid) {
        Alert.alert('Document Upload', validation.error || 'Please select a valid document under 25MB.');
        setSending(false);
        return;
      }

      const fileName = asset.name || `doc-${Date.now().toString().slice(-4)}.pdf`;
      const format = validation.extension || 'PDF';
      const sizeStr = asset.size
        ? (asset.size > 1024 * 1024 ? `${(asset.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(asset.size / 1024)} KB`)
        : '640 KB';

      // Upload to Supabase Storage so every circle member can access and open it
      const publicUrl = await uploadChatAttachmentFile(
        profile.id,
        fileName,
        base64,
        validation.mimeType || 'application/pdf'
      );

      const attachmentPayload = `[ATTACHMENT:FILE:${JSON.stringify({
        name: fileName,
        format,
        size: sizeStr,
        url: publicUrl,
      })}] Attaching ${fileName}`;

      await handleSendText(attachmentPayload, 'text');
    } catch (err: any) {
      console.error('Error attaching document:', err);
      Alert.alert('Document Upload Error', 'Could not upload document. Please ensure the file is under 25MB and try again.');
    } finally {
      setSending(false);
    }
  };

  const handleOpenAttachment = (attachment: Chat5Attachment, messageId?: string) => {
    setSelectedViewerAttachment(attachment);
    if (messageId) setSelectedViewerMsgId(messageId);
  };

  // Auto-tag user when navigating to Chat from a user's profile, member card, or action modal
  useEffect(() => {
    const tm = route.params?.taggedMember || route.params?.member;
    const targetName = tm?.profile?.full_name || tm?.full_name || tm?.name || route.params?.memberName;
    const targetId = tm?.user_id || tm?.id || route.params?.memberId;
    const targetAvatar = tm?.profile?.avatar_url || tm?.avatar_url || tm?.avatar;

    if (targetName) {
      setTaggedMember({
        id: targetId || '',
        name: targetName,
        avatar: targetAvatar,
      });

      const tagPrefix = `@${targetName} `;
      setInputText((prev) => {
        if (!prev) return tagPrefix;
        if (prev.includes(`@${targetName}`)) return prev;
        return `${tagPrefix}${prev.trimStart()}`;
      });

      const timer = setTimeout(() => {
        inputRef.current?.focus?.();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [route.params?.taggedMember, route.params?.member, route.params?.memberName, route.params?.memberId]);

  const handleTagMember = (memberInfo: { id: string; name: string; avatar?: string | null }) => {
    setTaggedMember(memberInfo);
    const tagPrefix = `@${memberInfo.name} `;
    setInputText((prev) => {
      if (!prev) return tagPrefix;
      if (prev.includes(`@${memberInfo.name}`)) return prev;
      return `${prev.trimEnd()} ${tagPrefix}`;
    });
    setTimeout(() => {
      inputRef.current?.focus?.();
    }, 120);
  };

  const handleClearTag = () => {
    if (taggedMember) {
      const tagPattern = new RegExp(`@${taggedMember.name}\\s*`, 'gi');
      setInputText((prev) => prev.replace(tagPattern, '').trimStart());
    }
    setTaggedMember(null);
  };

  // Mention Autocomplete: detect "@" being typed
  const lastAtPos = inputText.lastIndexOf('@');
  const isTypingMention = lastAtPos !== -1 && !inputText.slice(lastAtPos).includes(' ');
  const mentionQuery = isTypingMention ? inputText.slice(lastAtPos + 1).toLowerCase() : '';

  const mentionSuggestions = React.useMemo(() => {
    if (!isTypingMention) return [];
    return members
      .filter((m) => {
        if (m.user_id === profile?.id) return false;
        const fullName = m.profile?.full_name || '';
        return fullName.toLowerCase().includes(mentionQuery);
      })
      .slice(0, 5);
  }, [isTypingMention, mentionQuery, members, profile?.id]);

  const handleSelectMentionSuggestion = (memberItem: any) => {
    const memName = memberItem.profile?.full_name || 'Member';
    const beforeAt = inputText.slice(0, lastAtPos);
    const newText = `${beforeAt}@${memName} `;
    setInputText(newText);
    setTaggedMember({
      id: memberItem.user_id,
      name: memName,
      avatar: memberItem.profile?.avatar_url,
    });
    setTimeout(() => {
      inputRef.current?.focus?.();
    }, 80);
  };

  // Set of viewed message IDs to prevent duplicate RPC calls
  const viewedSetRef = useRef<Set<string>>(new Set());

  const quickPills = ["I'm Safe", "On My Way", "Heading Home", "Call Me ASAP"];

  const handleInputChange = (text: string) => {
    setInputText(text);

    if (channelRef.current && profile?.id) {
      const senderFirstName = profile?.full_name?.split(' ')[0] || 'Member';
      const isTyping = text.trim().length > 0;

      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: profile.id, user_name: senderFirstName, is_typing: isTyping },
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { user_id: profile.id, user_name: senderFirstName, is_typing: false },
        });
      }, 2500);
    }
  };

  useEffect(() => {
    let cleanupFn: (() => void) | undefined;
    if (activeCircle?.id) {
      fetchMessages(activeCircle.id);
      cleanupFn = subscribeToRealtimeChat(activeCircle.id);
    } else {
      setLoading(false);
    }
    return () => {
      if (cleanupFn) cleanupFn();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeCircle?.id]);

  const displayedMessages = React.useMemo(() => {
    if (!activeFilterMemberId) return messages;
    return messages.filter(
      (m) => m.sender_id === activeFilterMemberId || m.sender_id === profile?.id
    );
  }, [messages, activeFilterMemberId, profile?.id]);

  const isPermissionOrSystemMsg = (content?: string, messageType?: string) => {
    if (messageType && messageType !== 'text' && messageType !== 'TEXT') {
      const upperType = messageType.toUpperCase();
      if (['CHECKIN', 'CHECKIN_REQUEST', 'SYSTEM', 'GEOFENCE'].includes(upperType)) {
        return true;
      }
    }
    if (!content) return false;
    const upper = content.toUpperCase().trim();
    return (
      upper.includes('PERMISSION REQUEST') ||
      upper.includes('PERMISSION GRANTED') ||
      upper.includes('PERMISSION AUTHORIZED') ||
      upper.includes('PERMISSION DENIED') ||
      upper.includes('PERMISSION DECLINED') ||
      upper.includes('PERMISSION REVOKED') ||
      upper.includes('SYSTEM NOTIFICATION') ||
      upper.includes('CHIME ALERT:') ||
      upper.includes('BATTERY NUDGE:') ||
      upper.startsWith('📍 LEFT ') ||
      upper.startsWith('📍 ARRIVED ') ||
      upper.startsWith('📍 CHECK-IN') ||
      upper.includes('SAFE BOUNDARY AT')
    );
  };

  const fetchMessages = async (circleId: string) => {
    setLoading(true);
    try {
      // 1. Fetch active (non-deleted) messages within active window
      const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      let rawData: any[] | null = null;

      const res = await supabase
        .from('circle_messages')
        .select('*, profiles:sender_id(full_name, avatar_url)')
        .eq('circle_id', circleId)
        .gte('created_at', cutoffTime)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (res.error) {
        const fallbackRes = await supabase
          .from('circle_messages')
          .select('*, profiles!circle_messages_sender_id_fkey(full_name, avatar_url)')
          .eq('circle_id', circleId)
          .gte('created_at', cutoffTime)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });

        if (fallbackRes.error) {
          const basicRes = await supabase
            .from('circle_messages')
            .select('*')
            .eq('circle_id', circleId)
            .gte('created_at', cutoffTime)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });
          rawData = basicRes.data || [];
        } else {
          rawData = fallbackRes.data || [];
        }
      } else {
        rawData = res.data || [];
      }

      // 2. Fetch my view receipts
      const msgIds = (rawData || []).map((m: any) => m.id);
      let myViewsSet = new Set<string>();

      if (msgIds.length > 0 && profile?.id) {
        const { data: viewsData } = await supabase
          .from('message_views')
          .select('message_id')
          .eq('user_id', profile.id)
          .in('message_id', msgIds);

        if (viewsData) {
          viewsData.forEach((v: any) => myViewsSet.add(v.message_id));
        }
      }

      const formatted: ChatMessage[] = (rawData || [])
        .filter((msg: any) => !isPermissionOrSystemMsg(msg.content, msg.message_type))
        .map((msg: any) => {
          let prof = msg.profiles;
          if (Array.isArray(prof)) prof = prof[0];
          return {
            ...msg,
            sender_name: prof?.full_name || (msg.sender_id === profile?.id ? profile?.full_name : 'Member'),
            sender_avatar: prof?.avatar_url || (msg.sender_id === profile?.id ? profile?.avatar_url : undefined),
            is_viewed_by_me: myViewsSet.has(msg.id) || msg.sender_id === profile?.id,
          };
        });

      setMessages(formatted);
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToRealtimeChat = (circleId: string) => {
    const channelTopic = `chat_room_${circleId}`;

    // Safely remove any existing channel with matching topic to prevent reuse errors after subscribe
    const existingChannel = supabase.getChannels().find((ch) => ch.topic === `realtime:${channelTopic}` || ch.topic === channelTopic);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circle_messages',
          filter: `circle_id=eq.${circleId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any;
            if (newMsg.deleted_at || isPermissionOrSystemMsg(newMsg.content, newMsg.message_type)) return;

            const { data: prof } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .single();

            const completeMsg: ChatMessage = {
              ...newMsg,
              sender_name: prof?.full_name || 'Member',
              sender_avatar: prof?.avatar_url,
              is_viewed_by_me: newMsg.sender_id === profile?.id,
            };

            setMessages((prev) => {
              if (prev.some((m) => m.id === completeMsg.id)) return prev;
              return [...prev, completeMsg];
            });

            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as any;
            if (updatedMsg.deleted_at) {
              setMessages((prev) => prev.filter((m) => m.id !== updatedMsg.id));
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setMessages((prev) => prev.filter((m) => m.id !== deletedId));
            }
          }
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, user_name, is_typing } = payload.payload || {};
        if (!user_id || user_id === profile?.id) return;

        setTypingUsers((prev) => {
          if (is_typing) {
            if (!prev.includes(user_name)) return [...prev, user_name];
            return prev;
          } else {
            return prev.filter((name) => name !== user_name);
          }
        });
      })
      .on('broadcast', { event: 'reaction' }, (payload) => {
        const { message_id, emoji, user_id, action } = payload.payload || {};
        if (!message_id || !emoji || !user_id) return;

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== message_id) return msg;

            const currentReactions = msg.reactions || {};
            const userList = currentReactions[emoji] || [];

            const updatedList = action === 'add'
              ? (userList.includes(user_id) ? userList : [...userList, user_id])
              : userList.filter((id) => id !== user_id);

            return { ...msg, reactions: { ...currentReactions, [emoji]: updatedList } };
          })
        );
      })
      .on('broadcast', { event: 'read_receipt' }, (payload) => {
        const { message_id, user_id } = payload.payload || {};
        if (!message_id) return;

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === message_id) {
              return { ...m, is_all_viewed: true };
            }
            return m;
          })
        );
      })
      .on('broadcast', { event: 'message_deleted' }, (payload) => {
        const { message_id } = payload.payload || {};
        if (message_id) {
          setMessages((prev) => prev.filter((m) => m.id !== message_id));
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  };

  // Viewport Viewability Configuration: Item visible >= 75% for minimum 1500ms
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 75,
    minimumViewTime: 1500,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<any> }) => {
    if (!profile?.id) return;

    viewableItems.forEach((item) => {
      const msg = item.item as ChatMessage;
      if (
        msg &&
        msg.id &&
        msg.sender_id !== profile.id &&
        !msg.is_viewed_by_me &&
        !viewedSetRef.current.has(msg.id)
      ) {
        viewedSetRef.current.add(msg.id);

        // Optimistically mark as viewed locally
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, is_viewed_by_me: true } : m))
        );

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'read_receipt',
            payload: { message_id: msg.id, user_id: profile.id },
          });
        }

        // Server RPC call to record view receipt and evaluate grace period countdown
        supabase
          .rpc('mark_message_viewed', { p_message_id: msg.id, p_viewport_ms: 1500 })
          .then(({ data, error }) => {
            if (error) {
              console.warn('mark_message_viewed note:', error);
            }
          });
      }
    });
  }).current;

  const handleDeleteMessage = (message: ChatMessage) => {
    // 1. If it's a demo message, remove from UI immediately
    if (message.id.startsWith('demo-')) {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      return;
    }

    // 2. Permission check: Sender can delete their message; Circle owners/co-leaders can delete any message
    const myMember = members.find((m) => m.user_id === profile?.id);
    const isLeader = myMember?.role === 'owner' || myMember?.role === 'co_leader' || activeCircle?.owner_id === profile?.id;
    const isMe = message.sender_id === profile?.id;

    if (!isMe && !isLeader) {
      Alert.alert('Cannot Delete', 'You can only delete messages sent by you, or be a circle leader to moderate.');
      return;
    }

    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message for everyone in the circle?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Optimistically remove from state
              setMessages((prev) => prev.filter((m) => m.id !== message.id));

              // Broadcast delete event over channel so all connected circle devices update instantly
              if (channelRef.current) {
                channelRef.current.send({
                  type: 'broadcast',
                  event: 'message_deleted',
                  payload: { message_id: message.id },
                });
              }

              // First try updating deleted_at (soft delete)
              const updateRes = await supabase
                .from('circle_messages')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', message.id)
                .select('id');

              // If update returned 0 rows (e.g. RLS blocked update) or error, execute direct DELETE
              // which is guaranteed by the RLS delete policy:
              if (updateRes.error || !updateRes.data || updateRes.data.length === 0) {
                const { error: delError } = await supabase
                  .from('circle_messages')
                  .delete()
                  .eq('id', message.id);

                if (delError) throw delError;
              }
            } catch (err: any) {
              const cleanMsg = handleServiceError('Chat:deleteMessage', err, 'Failed to delete message. Please try again.');
              Alert.alert('Error', cleanMsg);
              if (activeCircle?.id) fetchMessages(activeCircle.id);
            }
          },
        },
      ]
    );
  };

  const EMOJI_OPTIONS = ['❤️', '👍', '🔥', '😂', '😮', '🙏', '🛡️'];

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!profile?.id) return;
    const currentUserId = profile.id;

    let updatedReactionsMap: Record<string, string[]> = {};

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;

        const currentReactions = { ...(msg.reactions || {}) };
        const userList = [...(currentReactions[emoji] || [])];
        const hasReacted = userList.includes(currentUserId);

        const updatedList = hasReacted
          ? userList.filter((id) => id !== currentUserId)
          : [...userList, currentUserId];

        const action = hasReacted ? 'remove' : 'add';

        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'reaction',
            payload: { message_id: messageId, emoji, user_id: currentUserId, action },
          });
        }

        if (updatedList.length === 0) {
          delete currentReactions[emoji];
        } else {
          currentReactions[emoji] = updatedList;
        }

        updatedReactionsMap = currentReactions;
        return { ...msg, reactions: currentReactions };
      })
    );

    if (!reactionTargetMsgId) {
      setSelectedReactionMsgId(null);
    }

    try {
      const { error } = await supabase.rpc('toggle_message_reaction', {
        p_message_id: messageId,
        p_emoji: emoji,
      });

      if (error) {
        await supabase
          .from('circle_messages')
          .update({ reactions: updatedReactionsMap })
          .eq('id', messageId);
      }
    } catch (err) {
      console.warn('Reaction database update note:', err);
    }
  };

  const handleSendText = async (customContent?: string, messageType: 'text' | 'location' | 'safety_pill' = 'text') => {
    const textToSend = customContent || inputText.trim();
    if (!profile?.id || !activeCircle?.id) return;

    // Strict Input Schema Validation (reject empty, >2000 chars, control characters)
    const msgValidation = ValidationSchema.validateChatMessage(textToSend);
    if (!msgValidation.valid) {
      Alert.alert('Invalid Message', msgValidation.error || 'Message cannot be sent.');
      return;
    }

    // Rate limit authenticated chat messages to prevent spam or client flooding
    const rateCheck = await RateLimiter.checkLimit('AUTHED_CHAT_MESSAGE', profile.id);
    if (!rateCheck.allowed) {
      Alert.alert('Please Slow Down', `You are sending messages too quickly. Please wait ${rateCheck.retryAfterSec}s before sending another message.`);
      return;
    }

    if (!customContent) {
      setInputText('');
      setTaggedMember(null);
    }
    setSending(true);

    const senderFirstName = profile?.full_name?.split(' ')[0] || 'Member';

    if (channelRef.current && profile?.id) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: profile.id, user_name: senderFirstName, is_typing: false },
      });
    }

    try {
      const now = new Date();
      const maxTtl = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

      let insertRes = await supabase
        .from('circle_messages')
        .insert({
          circle_id: activeCircle.id,
          sender_id: profile.id,
          content: textToSend,
          message_type: messageType,
          created_at: now.toISOString(),
          max_ttl_expires_at: maxTtl.toISOString(),
          grace_period_days: 1,
        })
        .select('*')
        .single();

      if (insertRes.error) {
        insertRes = await supabase
          .from('circle_messages')
          .insert({
            circle_id: activeCircle.id,
            sender_id: profile.id,
            content: textToSend,
            message_type: messageType,
            created_at: now.toISOString(),
          })
          .select('*')
          .single();
      }

      if (insertRes.error) throw insertRes.error;

      if (insertRes.data) {
        const formattedMsg: ChatMessage = {
          ...insertRes.data,
          sender_name: profile.full_name,
          sender_avatar: profile.avatar_url,
          is_viewed_by_me: true,
        };

        setMessages((prev) => [...prev, formattedMsg]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        dispatchChatPushNotification(textToSend);
        await RateLimiter.recordAttempt('AUTHED_CHAT_MESSAGE', true, profile.id);
      }
    } catch (err: any) {
      await RateLimiter.recordAttempt('AUTHED_CHAT_MESSAGE', false, profile?.id);
      const cleanMsg = handleServiceError('Chat:sendMessage', err, 'Failed to send message. Please try again.');
      Alert.alert('Error', cleanMsg);
    } finally {
      setSending(false);
    }
  };

  const handleShareLocationInChat = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to share current location in chat.');
        return;
      }

      setSending(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const locContent = `Shared Live Location: ${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`;
      await handleSendText(locContent, 'location');
    } catch (err) {
      console.error('Error sharing location in chat:', err);
    } finally {
      setSending(false);
    }
  };

  const dispatchChatPushNotification = async (msgText: string) => {
    if (!activeCircle?.id || !profile?.id) return;
    try {
      const { data: circleMembers } = await supabase
        .from('circle_members')
        .select('user_id, profiles(id, full_name, push_token)')
        .eq('circle_id', activeCircle.id)
        .neq('user_id', profile.id);

      if (!circleMembers) return;

      const tokens: string[] = [];
      const taggedTokens: string[] = [];

      circleMembers.forEach((m: any) => {
        let prof = m.profiles;
        if (Array.isArray(prof)) prof = prof[0];
        if (prof?.push_token) {
          const isTagged = taggedMember?.id === m.user_id || 
            (prof.full_name && msgText.toLowerCase().includes(`@${prof.full_name.toLowerCase()}`));
          if (isTagged) {
            taggedTokens.push(prof.push_token);
          } else {
            tokens.push(prof.push_token);
          }
        }
      });

      const senderName = profile?.full_name || 'Circle Member';
      const cleanBody = msgText.length > 90 ? `${msgText.substring(0, 90)}...` : msgText;

      // 1. High-priority targeted alert for tagged member
      if (taggedTokens.length > 0) {
        await sendExpoPushNotification(
          taggedTokens,
          `${senderName} mentioned you in Circle Chat`,
          cleanBody,
          { screen: 'Chat', circle_id: activeCircle.id, tagged: true }
        );
      }

      // 2. Regular alert for the rest of circle members
      if (tokens.length > 0) {
        await sendExpoPushNotification(
          tokens,
          `${senderName} (Circle Chat)`,
          cleanBody,
          { screen: 'Chat', circle_id: activeCircle.id }
        );
      }
    } catch (e) {
      console.warn('Chat push notification error:', e);
    }
  };

  const getTimeRemainingText = (msg: ChatMessage) => {
    const rawExpire = msg.expires_at || msg.max_ttl_expires_at;
    const createdAtMs = new Date(msg.created_at).getTime();

    // Strict 2 Days Maximum Hard Cap (48 Hours from creation)
    const maxExpiryMs = createdAtMs + (2 * 24 * 60 * 60 * 1000);
    const targetExpiryMs = rawExpire ? Math.min(new Date(rawExpire).getTime(), maxExpiryMs) : maxExpiryMs;

    const diffMs = targetExpiryMs - Date.now();
    if (diffMs <= 0) return 'Expiring soon';

    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));

    // Only display countdown text when <= 12 hours remaining to keep chat bubbles sleek and clean
    if (totalHours <= 12) {
      return `${totalHours}h left`;
    }
    return '';
  };

  const renderFormattedMessageContent = (content: string, textColor: string, isMeBubble: boolean) => {
    // Regex matching @Name mentions (e.g. @John Doe, @Alice)
    const mentionRegex = /(@[A-Za-z0-9_]+(?:\s[A-Za-z0-9_]+)?)/g;
    const parts = content.split(mentionRegex);

    if (parts.length <= 1) {
      return (
        <Text style={[styles.bubbleText, { color: textColor }]}>
          {content}
        </Text>
      );
    }

    return (
      <Text style={[styles.bubbleText, { color: textColor }]}>
        {parts.map((part, idx) => {
          if (!part) return null;
          if (part.startsWith('@')) {
            const rawName = part.substring(1).trim().toLowerCase();
            const matchedMember = members.find((m) => {
              const fName = (m.profile?.full_name || '').toLowerCase();
              return fName === rawName || fName.startsWith(rawName) || rawName.startsWith(fName.split(' ')[0]);
            });

            return (
              <Text
                key={idx}
                style={[
                  styles.mentionInBubble,
                  {
                    color: isMeBubble ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#0F172A'),
                    backgroundColor: isMeBubble
                      ? 'rgba(255, 255, 255, 0.22)'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.14)'
                      : 'rgba(15, 23, 42, 0.08)',
                  },
                ]}
                onPress={() => {
                  if (matchedMember) {
                    handleTagMember({
                      id: matchedMember.user_id,
                      name: matchedMember.profile?.full_name || part.substring(1),
                      avatar: matchedMember.profile?.avatar_url,
                    });
                  }
                }}
              >
                {part}
              </Text>
            );
          }
          return <Text key={idx}>{part}</Text>;
        })}
      </Text>
    );
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender_id === profile?.id;
    const isReactionOpen = selectedReactionMsgId === item.id;

    return (
      <Chat5MessageItem
        item={item as any}
        isMe={isMe}
        currentUserId={profile?.id}
        onTagMember={handleTagMember}
        onToggleReaction={handleToggleReaction}
        onOpenReactions={(id) => setSelectedReactionMsgId((prev) => (prev === id ? null : id))}
        onOpenFullEmojiPicker={(id) => {
          setSelectedReactionMsgId(null);
          setReactionTargetMsgId(id);
          setEmojiPickerVisible(true);
        }}
        isReactionOpen={isReactionOpen}
        onDelete={handleDeleteMessage}
        onOpenAttachment={(att) => handleOpenAttachment(att, item.id)}
        onViewLocation={(lat, lng) => {
          (navigation.navigate as any)('MainTabs', {
            screen: 'Map',
            params: {
              focusUserId: item.sender_id,
              focusLat: lat,
              focusLng: lng,
              focusUserName: isMe ? 'You' : (item.sender_name || 'Circle Member'),
            },
          });
        }}
        onReplyThread={(msg) => {
          const replyTag = `@${msg.sender_name || 'Member'} `;
          setInputText((prev) => (prev ? `${prev} ${replyTag}` : replyTag));
          inputRef.current?.focus?.();
        }}
        timeRemainingText={getTimeRemainingText(item)}
        emojiOptions={EMOJI_OPTIONS}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* React Bits Pro Chat 5 Header */}
      <Chat5Header
        channelName={activeCircle?.name || 'Circle Chat'}
        memberCount={members.length}
        onlineCount={Math.max(1, members.filter((m: any) => m.is_active || m.is_online).length || Math.min(3, members.length))}
        members={members}
        onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            (navigation as any).navigate('MainTabs', { screen: 'Circle' });
          }
        }}
        onOpenMembers={() => setMembersModalVisible(true)}
        onShareLocation={handleShareLocationInChat}
        topInset={topInset}
      />

      {/* Active Member Filter Banner */}
      {activeFilterMemberId && (
        <View style={[styles.filterBanner, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9', borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0' }]}>
          <View style={styles.filterBannerLeft}>
            <View style={[styles.filterBannerDot, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]} />
            <Text style={[styles.filterBannerText, { color: colors.foreground }]} numberOfLines={1}>
              Filtered: {targetMemberName || 'Member'}'s Messages
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.filterBannerClearBtn, { backgroundColor: isDark ? '#27272A' : '#0F172A' }]}
            onPress={() => setActiveFilterMemberId(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.filterBannerClearText}>Show All</Text>
            <Ionicons name="close" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}



      {/* Quick Action Safety Pills */}
      <View style={[styles.pillsBar, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={quickPills}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.pillBtn, 
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  borderRadius: 12,
                  borderWidth: 1,
                }
              ]}
              onPress={() => handleSendText(item, 'safety_pill')}
            >
              <Ionicons name="flash-outline" size={13} color={colors.accentGold} />
              <Text style={[styles.pillText, { color: colors.foreground }]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Messages Feed */}
      {!activeCircle ? (
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>NO ACTIVE CIRCLE</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted, maxWidth: 280, textAlign: 'center' }]}>
            You need to be in an active circle to chat with members. Create or join a circle to get started.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 18,
              backgroundColor: colors.accentGold || (isDark ? '#FFFFFF' : '#0F172A'),
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 12,
            }}
            onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Circle' })}
          >
            <Text style={{ color: '#1A1A1A', fontWeight: 'bold', fontSize: 12 }}>
              GO TO CIRCLE TAB
            </Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.centerContainer}>
          <LuxuryRadarLoading size={140} message="CONNECTING ENCRYPTED CHANNEL…" />
        </View>
      ) : displayedMessages.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {activeFilterMemberId ? `NO MESSAGES FROM ${targetMemberName ? targetMemberName.toUpperCase() : 'MEMBER'}` : 'NO MESSAGES YET'}
          </Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            {activeFilterMemberId
              ? `No messages exchanged with this member yet. Tap below or type a message to start.`
              : 'Start a secure conversation with your circle. Chat messages automatically purge between 1 to 2 days maximum.'}
          </Text>
          {activeFilterMemberId ? (
            <TouchableOpacity
              style={{ marginTop: 16, backgroundColor: isDark ? '#27272A' : '#0F172A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}
              onPress={() => setActiveFilterMemberId(null)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>SHOW ALL CIRCLE MESSAGES</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayedMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 14 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Live Typing Indicator Animation */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Mention Autocomplete Suggestions List */}
      {mentionSuggestions.length > 0 && (
        <View style={[
          styles.mentionSuggestBox, 
          { 
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF', 
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
          }
        ]}>
          <View style={styles.mentionSuggestHeader}>
            <Ionicons name="at" size={12} color={colors.accentGold} />
            <Text style={[styles.mentionSuggestHeaderText, { color: colors.textMuted }]}>
              CIRCLE MEMBERS
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mentionSuggestScroll}>
            {mentionSuggestions.map((m) => {
              const mName = m.profile?.full_name || 'Member';
              return (
                <TouchableOpacity
                  key={m.user_id}
                  style={[
                    styles.mentionSuggestItem, 
                    { 
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#CBD5E1',
                    }
                  ]}
                  onPress={() => handleSelectMentionSuggestion(m)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.suggestAvatarWrap, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0' }]}>
                    {m.profile?.avatar_url ? (
                      <Image source={{ uri: m.profile.avatar_url }} style={styles.suggestAvatarImg} />
                    ) : (
                      <Text style={[styles.suggestAvatarInitial, { color: colors.foreground }]}>{mName.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={[styles.suggestMemberName, { color: colors.foreground }]}>{mName}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Active Tagged Member Banner */}
      {taggedMember && (
        <View style={[
          styles.taggedMemberBanner, 
          { 
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
          }
        ]}>
          <View style={styles.taggedMemberLeft}>
            <View style={[styles.taggedAvatarCircle, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#CBD5E1' }]}>
              {taggedMember.avatar ? (
                <Image source={{ uri: taggedMember.avatar }} style={styles.taggedAvatarImg} />
              ) : (
                <Text style={[styles.taggedAvatarInitial, { color: colors.foreground }]}>
                  {taggedMember.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="at" size={13} color={isDark ? '#FFFFFF' : '#0F172A'} />
                <Text style={[styles.taggedTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]} numberOfLines={1}>
                  Mentioning {taggedMember.name}
                </Text>
              </View>
              <Text style={[styles.taggedSubtitleText, { color: colors.textMuted }]} numberOfLines={1}>
                Member will be notified and tagged directly in this message
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.dismissTagBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            onPress={handleClearTag}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Remove mention tag"
          >
            <Ionicons name="close" size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      )}

      {/* React Bits Pro Chat 5 Composer */}
      <Chat5Composer
        value={inputText}
        onChangeText={handleInputChange}
        onSend={() => handleSendText()}
        onOpenAttachment={() => setAttachmentSheetVisible(true)}
        onOpenEmoji={() => {
          setReactionTargetMsgId(null);
          setEmojiPickerVisible(true);
        }}
        channelName={activeCircle?.name || 'circle'}
        sending={sending}
        inputRef={inputRef}
      />

      {/* React Bits Pro Chat 5 Attachment Sheet */}
      <Chat5AttachmentSheet
        visible={attachmentSheetVisible}
        onClose={() => setAttachmentSheetVisible(false)}
        onPickPhoto={handlePickPhotoAttachment}
        onAttachDocument={handleAttachDocument}
        onShareLocation={handleShareLocationInChat}
        onSelectSafetyPill={(pill) => handleSendText(pill, 'safety_pill')}
      />

      {/* React Bits Pro Chat 5 Members Modal */}
      <Chat5MembersModal
        visible={membersModalVisible}
        onClose={() => setMembersModalVisible(false)}
        members={members}
        channelName={activeCircle?.name || 'Circle Members'}
        onTagMember={handleTagMember}
      />

      <EmojiGifPickerModal
        visible={emojiPickerVisible}
        onClose={() => {
          setEmojiPickerVisible(false);
          setReactionTargetMsgId(null);
        }}
        mode={reactionTargetMsgId ? 'reaction' : 'composer'}
        myActiveReactions={
          reactionTargetMsgId
            ? Object.entries(messages.find((m) => m.id === reactionTargetMsgId)?.reactions || {})
                .filter(([_, list]) => Array.isArray(list) && list.includes(profile?.id || ''))
                .map(([e]) => e)
            : []
        }
        onSelectEmoji={(emoji) => {
          if (reactionTargetMsgId) {
            handleToggleReaction(reactionTargetMsgId, emoji);
          } else {
            handleInputChange(inputText + emoji);
          }
        }}
        onSelectGif={(gifUrl) => handleSendText(gifUrl, 'safety_pill')}
      />

      {/* React Bits Pro Chat 5 Full-Screen Image & Document Lightbox Viewer */}
      <ChatImageViewerModal
        visible={!!selectedViewerAttachment}
        attachment={selectedViewerAttachment}
        onClose={() => {
          setSelectedViewerAttachment(null);
          setSelectedViewerMsgId(null);
        }}
        onDelete={() => {
          if (selectedViewerMsgId) {
            const msg = messages.find((m) => m.id === selectedViewerMsgId);
            if (msg) handleDeleteMessage(msg);
          }
          setSelectedViewerAttachment(null);
          setSelectedViewerMsgId(null);
        }}
        canDelete={
          selectedViewerMsgId
            ? (messages.find((m) => m.id === selectedViewerMsgId)?.sender_id === profile?.id ||
               members.find((m) => m.user_id === profile?.id)?.role === 'owner' ||
               members.find((m) => m.user_id === profile?.id)?.role === 'co_leader' ||
               activeCircle?.owner_id === profile?.id)
            : false
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerActionBtn: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 20,
  },
  pillsBar: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  avatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble3D: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  myBubble3D: {
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  theirBubble3D: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  floatingEmojiBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 6,
    gap: 4,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  emojiPickerBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reactionBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  reactionBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  reactionCountText: {
    fontSize: 10,
    fontWeight: '800',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 12,
  },
  disappearingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  disappearingTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 10,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  attachBtn: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 20,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  filterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    marginRight: 10,
  },
  filterBannerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  filterBannerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filterBannerClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  filterBannerClearText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  membersTagStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  tagStripLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingRight: 8,
  },
  tagStripLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  membersTagScroll: {
    gap: 8,
    alignItems: 'center',
  },
  memberTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  memberTagAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberTagAvatarImg: {
    width: '100%',
    height: '100%',
  },
  memberTagAvatarInitial: {
    fontSize: 10,
    fontWeight: '800',
  },
  memberTagChipText: {
    fontSize: 11,
  },
  taggedMemberBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  taggedMemberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taggedAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  taggedAvatarImg: {
    width: '100%',
    height: '100%',
  },
  taggedAvatarInitial: {
    fontSize: 12,
    fontWeight: '800',
  },
  taggedTitleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taggedSubtitleText: {
    fontSize: 10,
    marginTop: 1,
  },
  dismissTagBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  mentionSuggestBox: {
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: 2,
  },
  mentionSuggestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  mentionSuggestHeaderText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mentionSuggestScroll: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  mentionSuggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  suggestAvatarWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  suggestAvatarImg: {
    width: '100%',
    height: '100%',
  },
  suggestAvatarInitial: {
    fontSize: 10,
    fontWeight: '800',
  },
  suggestMemberName: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  mentionInBubble: {
    fontWeight: '800',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
});
