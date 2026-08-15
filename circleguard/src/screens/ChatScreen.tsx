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
  ActivityIndicator,
  Image,
  Alert,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import { useThemeStore } from '../store/useThemeStore';
import { sendExpoPushNotification } from '../services/PushNotificationService';

export interface ChatMessage {
  id: string;
  circle_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'location' | 'safety_pill';
  media_url?: string;
  created_at: string;
  expires_at?: string | null;
  max_ttl_expires_at?: string | null;
  deleted_at?: string | null;
  is_all_viewed?: boolean;
  sender_name?: string;
  sender_avatar?: string;
  is_viewed_by_me?: boolean;
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const { colors } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle, members } = useCircleStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Set of viewed message IDs to prevent duplicate RPC calls
  const viewedSetRef = useRef<Set<string>>(new Set());

  const quickPills = ["I'm Safe", "On My Way", "Heading Home", "Call Me ASAP"];

  useEffect(() => {
    if (activeCircle?.id) {
      fetchMessages(activeCircle.id);
      subscribeToRealtimeChat(activeCircle.id);
    } else {
      setLoading(false);
    }
  }, [activeCircle?.id]);

  const fetchMessages = async (circleId: string) => {
    setLoading(true);
    try {
      // 1. Fetch active (non-deleted) messages
      const { data, error } = await supabase
        .from('circle_messages')
        .select('*, profiles!circle_messages_sender_id_fkey(full_name, avatar_url)')
        .eq('circle_id', circleId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // 2. Fetch my view receipts
      const msgIds = (data || []).map((m: any) => m.id);
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

      const formatted: ChatMessage[] = (data || []).map((msg: any) => ({
        ...msg,
        sender_name: msg.profiles?.full_name || 'Member',
        sender_avatar: msg.profiles?.avatar_url,
        is_viewed_by_me: myViewsSet.has(msg.id) || msg.sender_id === profile?.id,
      }));

      setMessages(formatted);
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToRealtimeChat = (circleId: string) => {
    const channelTopic = `chat_${circleId}_${Date.now()}`;
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
            if (newMsg.deleted_at) return;

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Viewport Viewability Configuration: Item visible >= 75% for minimum 1500ms
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 75,
    minimumViewTime: 1500,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
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
    if (message.sender_id !== profile?.id) {
      Alert.alert('Cannot Delete', 'You can only delete messages sent by you.');
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
              setMessages((prev) => prev.filter((m) => m.id !== message.id));

              const { error } = await supabase
                .from('circle_messages')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', message.id)
                .eq('sender_id', profile.id);

              if (error) throw error;
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete message.');
              if (activeCircle?.id) fetchMessages(activeCircle.id);
            }
          },
        },
      ]
    );
  };

  const handleSendText = async (customContent?: string, messageType: 'text' | 'location' | 'safety_pill' = 'text') => {
    const textToSend = customContent || inputText.trim();
    if (!textToSend || !profile?.id || !activeCircle?.id) return;

    if (!customContent) setInputText('');
    setSending(true);

    try {
      const now = new Date();
      const maxTtl = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('circle_messages')
        .insert({
          circle_id: activeCircle.id,
          sender_id: profile.id,
          content: textToSend,
          message_type: messageType,
          created_at: now.toISOString(),
          max_ttl_expires_at: maxTtl.toISOString(),
          grace_period_days: 3,
        })
        .select('*, profiles!circle_messages_sender_id_fkey(full_name, avatar_url)')
        .single();

      if (error) throw error;

      if (data) {
        const formattedMsg: ChatMessage = {
          ...data,
          sender_name: profile.full_name,
          sender_avatar: profile.avatar_url,
          is_viewed_by_me: true,
        };

        setMessages((prev) => [...prev, formattedMsg]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        dispatchChatPushNotification(textToSend);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send message.');
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
      const locContent = `📍 Shared Live Location: ${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`;
      await handleSendText(locContent, 'location');
    } catch (err) {
      console.error('Error sharing location in chat:', err);
    } finally {
      setSending(false);
    }
  };

  const dispatchChatPushNotification = async (msgText: string) => {
    try {
      const tokenSet = new Set<string>();
      (members || []).forEach((m: any) => {
        let prof = m.profiles as any;
        if (Array.isArray(prof)) prof = prof[0];
        if (prof?.push_token && m.user_id !== profile?.id) {
          tokenSet.add(prof.push_token);
        }
      });

      const tokens = Array.from(tokenSet);
      if (tokens.length > 0) {
        await sendExpoPushNotification(
          tokens,
          `💬 ${profile?.full_name || 'Buddy'} (Circle Chat)`,
          msgText,
          { screen: 'Chat' }
        );
      }
    } catch (e) {
      console.warn('Chat push error:', e);
    }
  };

  const getTimeRemainingText = (msg: ChatMessage) => {
    if (msg.expires_at) {
      const diffMs = new Date(msg.expires_at).getTime() - Date.now();
      if (diffMs <= 0) return 'Expiring now';
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      if (days > 0) return `${days}d ${remHours}h remaining`;
      return `${hours}h remaining`;
    }
    if (msg.is_all_viewed) {
      return '3-day grace period';
    }
    return '';
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender_id === profile?.id;
    const initial = String(item.sender_name || 'M').charAt(0).toUpperCase();

    const isLocationMsg = item.message_type === 'location' || item.content.includes('Shared Live Location');

    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
        {!isMe ? (
          <View style={[styles.avatarBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {item.sender_avatar ? (
              <Image source={{ uri: item.sender_avatar }} style={styles.avatarImg} />
            ) : (
              <Text style={[styles.avatarInitial, { color: colors.accentGold }]}>{initial}</Text>
            )}
          </View>
        ) : null}

        <View style={{ maxWidth: '80%' }}>
          {!isMe ? (
            <Text style={[styles.senderName, { color: colors.foreground, fontSize: 11, fontWeight: '700', marginBottom: 2 }]}>{item.sender_name}</Text>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.85}
            onLongPress={() => handleDeleteMessage(item)}
            delayLongPress={250}
            style={[
              styles.bubble,
              isMe
                ? [styles.myBubble, { backgroundColor: '#D4AF37' }]
                : [styles.theirBubble, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }],
            ]}
          >
            {isLocationMsg ? (
              <View style={{ gap: 6, paddingVertical: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="location" size={18} color={isMe ? '#FFFFFF' : '#D4AF37'} />
                  <Text style={{ color: isMe ? '#FFFFFF' : colors.foreground, fontSize: 12, fontWeight: '800' }}>
                    Shared Live Location
                  </Text>
                </View>
                <Text style={{ color: isMe ? 'rgba(255,255,255,0.9)' : colors.textMuted, fontSize: 11 }}>
                  {item.content.replace('📍 Shared Live Location:', '').trim() || 'Tap to view live location on map'}
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(212, 175, 55,0.12)',
                    borderRadius: 8,
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    alignSelf: 'flex-start',
                    marginTop: 4,
                  }}
                  onPress={() => navigation.navigate('Map' as never)}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: isMe ? '#FFFFFF' : '#D4AF37' }}>🧭 VIEW ON MAP</Text>
                </TouchableOpacity>
              </View>
            ) : item.message_type === 'safety_pill' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="shield-checkmark" size={16} color={isMe ? '#FFFFFF' : colors.accentGold} />
                <Text style={[styles.bubbleText, { color: isMe ? '#FFFFFF' : colors.foreground, fontWeight: '700' }]}>
                  {item.content}
                </Text>
              </View>
            ) : (
              <Text style={[styles.bubbleText, { color: isMe ? '#FFFFFF' : colors.foreground }]}>
                {item.content}
              </Text>
            )}

            {/* Time Readout */}
            <View style={styles.bubbleFooter}>
              {getTimeRemainingText(item) ? (
                <View style={styles.disappearingTag}>
                  <Ionicons name="time-outline" size={11} color={isMe ? 'rgba(255,255,255,0.7)' : colors.accentGold} />
                  <Text style={[styles.disappearingTagText, { color: isMe ? 'rgba(255,255,255,0.8)' : colors.accentGold }]}>
                    {getTimeRemainingText(item)}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {activeCircle?.name || 'Circle Chat'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={12} color={colors.accentGold} />
            <Text style={[styles.headerSub, { color: colors.accentGold }]}>
              DISAPPEARING MESSAGES ACTIVE (3-DAY GRACE)
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleShareLocationInChat} style={[styles.headerActionBtn, { borderColor: colors.accentGold }]}>
          <Ionicons name="location-outline" size={18} color={colors.accentGold} />
        </TouchableOpacity>
      </View>

      {/* Quick Action Safety Pills */}
      <View style={[styles.pillsBar, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={quickPills}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.pillBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleSendText(item, 'safety_pill')}
            >
              <Ionicons name="flash-outline" size={13} color={colors.accentGold} />
              <Text style={[styles.pillText, { color: colors.foreground }]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Messages Feed */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accentGold} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>NO MESSAGES YET</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            Start a secure conversation with your circle. Messages automatically disappear 3 days post-viewed.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 14 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.attachBtn, { borderColor: colors.border }]}
          onPress={handleShareLocationInChat}
        >
          <Ionicons name="navigate-outline" size={18} color={colors.accentGold} />
        </TouchableOpacity>

        <TextInput
          style={[styles.textInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Write a message..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: sending ? colors.surfaceMuted : colors.accentGold }]}
          onPress={() => handleSendText()}
          disabled={sending || !inputText.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#1A1A1A" />
          ) : (
            <Ionicons name="send" size={16} color="#1A1A1A" />
          )}
        </TouchableOpacity>
      </View>
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
  bubble: {
    padding: 12,
    borderWidth: 1,
  },
  myBubble: {
    borderColor: '#D4AF37',
  },
  theirBubble: {},
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
});
