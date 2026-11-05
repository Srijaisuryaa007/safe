import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Dimensions,
  FlatList,
  Platform,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { COMPLETE_EMOJI_DATA, EmojiItem } from '../constants/emojiData';

interface EmojiGifPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gifUrl: string, title?: string) => void;
  mode?: 'composer' | 'reaction';
  myActiveReactions?: string[];
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TRAY_HEIGHT = Math.min(Math.round(SCREEN_HEIGHT * 0.65), 550);

// Discord-style quick-filter GIF categories
const DISCORD_GIF_CATEGORIES = [
  { id: 'trending', label: '🔥 Trending', query: '' },
  { id: 'omw', label: '🚗 On My Way', query: 'driving on my way' },
  { id: 'safe', label: '🛡️ Safe & Sound', query: 'safe all good' },
  { id: 'memes', label: '🤣 Memes & Lol', query: 'funny memes lol' },
  { id: 'reactions', label: '👀 Reactions', query: 'reactions' },
  { id: 'pets', label: '🐱 Cute Pets', query: 'cute dogs cats' },
  { id: 'food', label: '🍕 Food & Coffee', query: 'delicious food coffee' },
  { id: 'party', label: '💃 Dance & Party', query: 'party dance celebrate' },
  { id: 'love', label: '💖 Love & Hugs', query: 'love hug kiss' },
  { id: 'gaming', label: '🎮 Gaming', query: 'gaming victory gamer' },
  { id: 'sleep', label: '😴 Sleep & Late', query: 'sleeping tired late' },
  { id: 'drama', label: '🍿 Popcorn Drama', query: 'popcorn waiting' },
];

// Offline & Emergency Curated GIFs
const ALL_CURATED_GIFS = [
  {
    id: 'omw_1',
    category: 'on_my_way',
    title: 'On My Way Fast 🚗',
    url: 'https://media.giphy.com/media/l41JGlWa1xYFU9ASc/giphy.gif',
    preview: 'https://media.giphy.com/media/l41JGlWa1xYFU9ASc/200w.gif',
  },
  {
    id: 'omw_2',
    category: 'on_my_way',
    title: 'Running Late Zoom 🏃‍♂️',
    url: 'https://media.giphy.com/media/26AHPxxnSw1L9T1rW/giphy.gif',
    preview: 'https://media.giphy.com/media/26AHPxxnSw1L9T1rW/200w.gif',
  },
  {
    id: 'omw_3',
    category: 'on_my_way',
    title: 'Driving Mr Bean 🏎️',
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif',
  },
  {
    id: 'omw_4',
    category: 'on_my_way',
    title: 'Scooter Speeding 🛵',
    url: 'https://media.giphy.com/media/3o7TKtnuHOH6yxnM1q/giphy.gif',
    preview: 'https://media.giphy.com/media/3o7TKtnuHOH6yxnM1q/200w.gif',
  },
  {
    id: 'omw_5',
    category: 'on_my_way',
    title: 'Rocket Launch 🚀',
    url: 'https://media.giphy.com/media/3ohnEqJ1XOfvWaSk7e/giphy.gif',
    preview: 'https://media.giphy.com/media/3ohnEqJ1XOfvWaSk7e/200w.gif',
  },
  {
    id: 'safe_1',
    category: 'safe',
    title: 'Thumbs Up All Good 👍',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    preview: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif',
  },
  {
    id: 'safe_2',
    category: 'safe',
    title: 'Mission Passed Respect 🛡️',
    url: 'https://media.giphy.com/media/npszbmF6GwHSw/giphy.gif',
    preview: 'https://media.giphy.com/media/npszbmF6GwHSw/200w.gif',
  },
  {
    id: 'safe_3',
    category: 'safe',
    title: 'Phew Safe & Sound 😌',
    url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif',
    preview: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/200w.gif',
  },
  {
    id: 'safe_4',
    category: 'safe',
    title: 'I Made It Safe 🏡',
    url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    preview: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200w.gif',
  },
  {
    id: 'safe_5',
    category: 'safe',
    title: 'Leonardo Cheers Toast 🥂',
    url: 'https://media.giphy.com/media/GCLlQnV7dXZ2E/giphy.gif',
    preview: 'https://media.giphy.com/media/GCLlQnV7dXZ2E/200w.gif',
  },
  {
    id: 'where_1',
    category: 'reactions',
    title: 'Where Are You Travolta 👀',
    url: 'https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif',
    preview: 'https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/200w.gif',
  },
  {
    id: 'where_2',
    category: 'reactions',
    title: 'Homer Bush Disappear 👻',
    url: 'https://media.giphy.com/media/jUwpNzg9IcyrK/giphy.gif',
    preview: 'https://media.giphy.com/media/jUwpNzg9IcyrK/200w.gif',
  },
  {
    id: 'where_3',
    category: 'reactions',
    title: 'Popcorn Waiting 🍿',
    url: 'https://media.giphy.com/media/hVTouq08miyGT52UKL/giphy.gif',
    preview: 'https://media.giphy.com/media/hVTouq08miyGT52UKL/200w.gif',
  },
  {
    id: 'food_1',
    category: 'food',
    title: 'Pizza Slicing Delicious 🍕',
    url: 'https://media.giphy.com/media/1108D2tVaUN3eo/giphy.gif',
    preview: 'https://media.giphy.com/media/1108D2tVaUN3eo/200w.gif',
  },
  {
    id: 'food_2',
    category: 'food',
    title: 'Coffee Cheer ☕',
    url: 'https://media.giphy.com/media/3oriO04qxVReM5rJEA/giphy.gif',
    preview: 'https://media.giphy.com/media/3oriO04qxVReM5rJEA/200w.gif',
  },
];

// Active GIPHY key with live trending & global search access
const GIPHY_API_KEY = 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh';

export default function EmojiGifPickerModal({
  visible,
  onClose,
  onSelectEmoji,
  onSelectGif,
  mode = 'composer',
  myActiveReactions = [],
}: EmojiGifPickerModalProps) {
  const { colors, isDark } = useThemeStore();
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif'>('emoji');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('all');
  const [selectedGifCategory, setSelectedGifCategory] = useState<string>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveGifs, setLiveGifs] = useState<any[]>(ALL_CURATED_GIFS);
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);

  // In-memory GIF cache to avoid unnecessary network calls
  const gifCacheRef = useRef<Record<string, any[]>>({});

  // Flatten all emojis for fast Discord-style search
  const allFlatEmojis = useMemo(() => {
    const list: EmojiItem[] = [];
    COMPLETE_EMOJI_DATA.forEach((cat) => {
      cat.emojis.forEach((e) => list.push(e));
    });
    return list;
  }, []);

  // Filtered Emojis based on search keyword or selected category
  const displayedEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return allFlatEmojis.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q)) ||
          item.emoji.includes(q)
      );
    }

    if (selectedEmojiCategory === 'all') {
      return allFlatEmojis;
    }

    const cat = COMPLETE_EMOJI_DATA.find((c) => c.id === selectedEmojiCategory);
    return cat ? cat.emojis : allFlatEmojis;
  }, [searchQuery, selectedEmojiCategory, allFlatEmojis]);

  // Live GIPHY & Web GIF Search (Discord style)
  useEffect(() => {
    if (!visible || activeTab !== 'gif') return;

    let isMounted = true;
    const fetchGifs = async () => {
      // Determine query: user typed query takes precedence, otherwise use category query
      const typedQuery = searchQuery.trim();
      const activeCat = DISCORD_GIF_CATEGORIES.find((c) => c.id === selectedGifCategory);
      const effectiveQuery = typedQuery || (activeCat && activeCat.id !== 'trending' ? activeCat.query : '');

      const cacheKey = effectiveQuery.toLowerCase() || '__trending__';
      if (gifCacheRef.current[cacheKey]) {
        setLiveGifs(gifCacheRef.current[cacheKey]);
        setIsSearchingGifs(false);
        return;
      }

      setIsSearchingGifs(true);

      try {
        const endpoint = effectiveQuery
          ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(effectiveQuery)}&limit=40&rating=pg`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=40&rating=pg`;

        const res = await fetch(endpoint);
        const json = await res.json();

        if (json && json.data && json.data.length > 0) {
          const formatted = json.data
            .map((g: any) => ({
              id: g.id,
              title: g.title || 'GIF',
              url: g.images?.original?.url || g.images?.downsized?.url || g.images?.fixed_height?.url,
              preview: g.images?.fixed_height?.url || g.images?.fixed_width?.url || g.images?.downsized?.url,
            }))
            .filter((g: any) => Boolean(g.url));

          if (isMounted) {
            gifCacheRef.current[cacheKey] = formatted;
            setLiveGifs(formatted);
            setIsSearchingGifs(false);
            return;
          }
        }
      } catch (e) {
        // Fallback to curated safety & emotion GIFs
      }

      if (isMounted) {
        if (!effectiveQuery) {
          setLiveGifs(ALL_CURATED_GIFS);
        } else {
          setLiveGifs(
            ALL_CURATED_GIFS.filter(
              (g) =>
                g.title.toLowerCase().includes(effectiveQuery.toLowerCase()) ||
                g.category.toLowerCase().includes(effectiveQuery.toLowerCase())
            )
          );
        }
        setIsSearchingGifs(false);
      }
    };

    const timer = setTimeout(fetchGifs, searchQuery ? 250 : 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedGifCategory, activeTab, visible]);

  const translateY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      translateY.setValue(0);
    }
  }, [visible, translateY]);

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(translateY, {
      toValue: 650,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [onClose, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 2,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const isTap = Math.abs(gestureState.dy) < 8 && Math.abs(gestureState.dx) < 8;
          const isDragDown = gestureState.dy > 35 || gestureState.vy > 0.2;

          if (isTap || isDragDown) {
            handleDismiss();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [handleDismiss, translateY]
  );

  if (!visible) return null;

  // Dynamic Theme Colors with Guaranteed High Contrast
  const activeTabBg = isDark ? '#FFFFFF' : '#0F172A';
  const activeTabText = isDark ? '#0F172A' : '#FFFFFF';
  const inactiveTabText = isDark ? '#94A3B8' : '#475569';

  const activePillBg = isDark ? '#FFFFFF' : '#0F172A';
  const activePillText = isDark ? '#0F172A' : '#FFFFFF';
  const inactivePillBg = isDark ? '#1E2430' : '#F1F5F9';
  const inactivePillBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
  const inactivePillText = isDark ? '#E2E8F0' : '#334155';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.trayCard,
            {
              height: TRAY_HEIGHT,
              backgroundColor: isDark ? '#111317' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
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
          {/* Top Grabber Handle - Interactive Drag or Tap to Close */}
          <View
            style={styles.topHandleBar}
            {...panResponder.panHandlers}
            accessible={true}
            accessibilityLabel="Drag down or tap to close picker"
            accessibilityRole="button"
          >
            <View style={[styles.dragHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : '#CBD5E1' }]} />
          </View>

          {/* Reaction Mode Context Header */}
          {mode === 'reaction' && (
            <View
              style={[
                styles.reactionHeaderBanner,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.1)',
                  borderColor: 'rgba(245, 158, 11, 0.35)',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Ionicons name="sparkles" size={16} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reactionHeaderText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    React to Message
                  </Text>
                  <Text style={[styles.reactionSubText, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                    Tap any emoji to react • Select multiple emojis
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.reactionDoneBtn, { backgroundColor: activeTabBg }]}
                onPress={onClose}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Done selecting reactions"
              >
                <Text style={[styles.reactionDoneBtnText, { color: activeTabText }]}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Header Row with Discord-Style Segmented Tabs */}
          <View style={[styles.headerRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
            <View
              style={[
                styles.tabPillContainer,
                {
                  backgroundColor: isDark ? '#181A20' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                  flex: 1,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === 'emoji' && { backgroundColor: activeTabBg, elevation: 2 },
                ]}
                onPress={() => {
                  setActiveTab('emoji');
                  setSearchQuery('');
                }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 14, marginRight: 6 }}>😄</Text>
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'emoji' ? activeTabText : inactiveTabText },
                  ]}
                >
                  EMOJIS ({allFlatEmojis.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === 'gif' && { backgroundColor: activeTabBg, elevation: 2 },
                ]}
                onPress={() => {
                  setActiveTab('gif');
                  setSearchQuery('');
                }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 14, marginRight: 6 }}>🎬</Text>
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'gif' ? activeTabText : inactiveTabText },
                  ]}
                >
                  GIFS & MEMES
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Global Search Bar (Discord / Apple Style) */}
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: isDark ? '#181A20' : '#F8FAFC',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
              },
            ]}
          >
            <Ionicons name="search" size={17} color={isDark ? '#F5A623' : '#D97706'} />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
              placeholder={
                activeTab === 'emoji'
                  ? 'Search emojis (e.g. fire, laughing, dog, pizza, run)...'
                  : 'Search live GIFs from the web (e.g. driving, safe, cat)...'
              }
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {/* Search Input Clear or Loading Indicator */}
            {isSearchingGifs ? (
              <ActivityIndicator size="small" color={isDark ? '#F5A623' : '#0F172A'} />
            ) : searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Category Jump Bar for Emojis */}
          {activeTab === 'emoji' && !searchQuery.trim() && (
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: selectedEmojiCategory === 'all' ? activePillBg : inactivePillBg,
                      borderColor: selectedEmojiCategory === 'all' ? activePillBg : inactivePillBorder,
                    },
                  ]}
                  onPress={() => setSelectedEmojiCategory('all')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="grid-outline"
                    size={13}
                    color={selectedEmojiCategory === 'all' ? activePillText : inactivePillText}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: selectedEmojiCategory === 'all' ? activePillText : inactivePillText },
                    ]}
                  >
                    All ({allFlatEmojis.length})
                  </Text>
                </TouchableOpacity>

                {COMPLETE_EMOJI_DATA.map((cat) => {
                  const isSelected = selectedEmojiCategory === cat.id;
                  const catEmoji = cat.emojis?.[0]?.emoji || '🏷️';
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: isSelected ? activePillBg : inactivePillBg,
                          borderColor: isSelected ? activePillBg : inactivePillBorder,
                        },
                      ]}
                      onPress={() => setSelectedEmojiCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, marginRight: 5 }}>{catEmoji}</Text>
                      <Text
                        style={[
                          styles.categoryPillText,
                          { color: isSelected ? activePillText : inactivePillText },
                        ]}
                      >
                        {cat.name.split(' & ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={[styles.separatorLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]} />
            </View>
          )}

          {/* Category Jump Bar for GIFs (Discord Style) */}
          {activeTab === 'gif' && !searchQuery.trim() && (
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {DISCORD_GIF_CATEGORIES.map((cat) => {
                  const isSelected = selectedGifCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: isSelected ? activePillBg : inactivePillBg,
                          borderColor: isSelected ? activePillBg : inactivePillBorder,
                        },
                      ]}
                      onPress={() => setSelectedGifCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.categoryPillText,
                          { color: isSelected ? activePillText : inactivePillText },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={[styles.separatorLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]} />
            </View>
          )}

          {/* Tab Content: Discord-Style Emoji Grid */}
          {activeTab === 'emoji' ? (
            <FlatList
              key="emoji-flatlist-7-cols"
              data={displayedEmojis}
              keyExtractor={(item, index) => `${item.emoji}-${index}`}
              numColumns={7}
              contentContainerStyle={styles.emojiGridContainer}
              columnWrapperStyle={{ justifyContent: 'flex-start', gap: 6 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              initialNumToRender={35}
              maxToRenderPerBatch={35}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              getItemLayout={(_, index) => ({ length: 44, offset: 44 * Math.floor(index / 7), index })}
              renderItem={({ item }) => {
                const isSelectedReaction = mode === 'reaction' && myActiveReactions.includes(item.emoji);
                return (
                  <TouchableOpacity
                    style={[
                      styles.emojiCell,
                      isSelectedReaction && {
                        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.2)',
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: '#F59E0B',
                      },
                    ]}
                    onPress={() => onSelectEmoji(item.emoji)}
                    activeOpacity={0.5}
                  >
                    <Text style={styles.emojiGlyph}>{item.emoji}</Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                  <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>No Matching Emojis</Text>
                  <Text style={[styles.emptySub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Try searching for "happy", "car", "heart", "food", or "fire".
                  </Text>
                </View>
              }
            />
          ) : (
            /* Tab Content: Animated GIF Grid (Discord Live Search) */
            <FlatList
              key="gif-flatlist-2-cols"
              data={liveGifs}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              numColumns={2}
              contentContainerStyle={styles.gifGridContainer}
              columnWrapperStyle={{ gap: 10 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="always"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.gifCard,
                    {
                      backgroundColor: isDark ? '#181A20' : '#F1F5F9',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                    },
                  ]}
                  onPress={() => {
                    onSelectGif(item.url, item.title);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: item.preview || item.url }}
                    style={styles.gifImage}
                    resizeMode="cover"
                  />
                  <View style={styles.gifOverlayPill}>
                    <Text style={styles.gifOverlayText} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                  <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {isSearchingGifs ? 'Searching Web GIFs...' : 'No GIFs Found'}
                  </Text>
                  <Text style={[styles.emptySub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    {isSearchingGifs
                      ? 'Fetching live animations from GIPHY...'
                      : 'Try searching for any emotion, meme, or phrase (e.g. "laugh", "cat", "omw", "dance").'}
                  </Text>
                </View>
              }
            />
          )}
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
  trayCard: {
    width: '100%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  topHandleBar: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  tabPillContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3.5,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7.5,
    borderRadius: 10,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8.5,
    marginTop: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  separatorLine: {
    height: 1,
    width: '100%',
    marginBottom: 6,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 2,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emojiGridContainer: {
    paddingVertical: 8,
    paddingBottom: 28,
  },
  emojiCell: {
    width: (SCREEN_WIDTH - 68) / 7,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emojiGlyph: {
    fontSize: 27,
  },
  gifGridContainer: {
    paddingVertical: 10,
    paddingBottom: 32,
  },
  gifCard: {
    flex: 1,
    height: 130,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  gifOverlayPill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  gifOverlayText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 45,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
  reactionHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  reactionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
  },
  reactionSubText: {
    fontSize: 11,
    fontWeight: '500',
  },
  reactionDoneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  reactionDoneBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
