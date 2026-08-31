import React, { useState, useMemo, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { COMPLETE_EMOJI_DATA, EmojiItem, EmojiCategory } from '../constants/emojiData';

interface EmojiGifPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gifUrl: string, title?: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ALL_CURATED_GIFS = [
  // Driving & On My Way
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
    url: 'https://media.giphy.com/media/3o7ZetIsjgoqVebN5K/giphy.gif',
    preview: 'https://media.giphy.com/media/3o7ZetIsjgoqVebN5K/200w.gif',
  },
  {
    id: 'omw_5',
    category: 'on_my_way',
    title: 'Rocket Launch 🚀',
    url: 'https://media.giphy.com/media/3ohnEqJ1XOfvWaSk7e/giphy.gif',
    preview: 'https://media.giphy.com/media/3ohnEqJ1XOfvWaSk7e/200w.gif',
  },

  // Safe & Reassurance
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

  // Funny & Curiosity & Where Are You
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
    id: 'where_4',
    category: 'reactions',
    title: 'Confused Math Lady 🧐',
    url: 'https://media.giphy.com/media/4JVTF9fR99WYo/giphy.gif',
    preview: 'https://media.giphy.com/media/4JVTF9fR99WYo/200w.gif',
  },
  {
    id: 'where_5',
    category: 'reactions',
    title: 'Cat Dancing Party 🐱',
    url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
    preview: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.gif',
  },

  // Food & Family
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
  {
    id: 'food_3',
    category: 'food',
    title: 'Burger Eating Nom 🍔',
    url: 'https://media.giphy.com/media/eSQKNSmg07dHq/giphy.gif',
    preview: 'https://media.giphy.com/media/eSQKNSmg07dHq/200w.gif',
  },
];

export default function EmojiGifPickerModal({
  visible,
  onClose,
  onSelectEmoji,
  onSelectGif,
}: EmojiGifPickerModalProps) {
  const { colors, isDark, themeMode } = useThemeStore();
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif'>('emoji');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveGifs, setLiveGifs] = useState<any[]>(ALL_CURATED_GIFS);
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);

  // Flatten all emojis for fast Discord-style global search
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

  // Dynamic Live GIPHY & Tenor Search (Discord style)
  useEffect(() => {
    if (!visible || activeTab !== 'gif') return;

    let isMounted = true;
    const fetchGifs = async () => {
      const q = searchQuery.trim();
      setIsSearchingGifs(true);

      try {
        const endpoint = q
          ? `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(q)}&limit=36&rating=g`
          : `https://api.giphy.com/v1/gifs/trending?api_key=dc6zaTOxFJmzC&limit=36&rating=g`;

        const res = await fetch(endpoint);
        const json = await res.json();

        if (json && json.data && json.data.length > 0) {
          const formatted = json.data.map((g: any) => ({
            id: g.id,
            title: g.title || 'GIF',
            url: g.images?.original?.url || g.images?.downsized_medium?.url || g.images?.fixed_height?.url,
            preview: g.images?.fixed_width_small?.url || g.images?.fixed_height_small?.url || g.images?.downsized?.url,
          })).filter((g: any) => Boolean(g.url));

          if (isMounted) {
            setLiveGifs(formatted);
            setIsSearchingGifs(false);
            return;
          }
        }
      } catch (e) {
        // Fallback to Tenor API
        try {
          const tenorEndpoint = q
            ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=LIVDSRZULELA&limit=36`
            : `https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=36`;

          const tenorRes = await fetch(tenorEndpoint);
          const tenorJson = await tenorRes.json();

          if (tenorJson && tenorJson.results && tenorJson.results.length > 0) {
            const formatted = tenorJson.results.map((r: any) => {
              const media = r.media?.[0];
              return {
                id: r.id,
                title: r.title || 'GIF',
                url: media?.gif?.url || media?.mediumgif?.url,
                preview: media?.nanogif?.url || media?.tinygif?.url,
              };
            }).filter((g: any) => Boolean(g.url));

            if (isMounted) {
              setLiveGifs(formatted);
              setIsSearchingGifs(false);
              return;
            }
          }
        } catch (err) {}
      }

      // If offline, filter curated gifs
      if (isMounted) {
        if (!q) {
          setLiveGifs(ALL_CURATED_GIFS);
        } else {
          setLiveGifs(
            ALL_CURATED_GIFS.filter(
              (g) => g.title.toLowerCase().includes(q.toLowerCase()) || g.category.toLowerCase().includes(q.toLowerCase())
            )
          );
        }
        setIsSearchingGifs(false);
      }
    };

    const timer = setTimeout(fetchGifs, searchQuery ? 300 : 0);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeTab, visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.trayCard,
            {
              backgroundColor: isDark ? colors.surface : '#FFFFFF',
              borderColor: colors.border,
            },
          ]}
        >
          {/* Top Grabber Handle */}
          <View style={styles.topHandleBar}>
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header Row with Discord-Style Segmented Tabs */}
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View
              style={[
                styles.tabPillContainer,
                {
                  backgroundColor: isDark ? colors.background : '#F1F5F9',
                  borderColor: colors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === 'emoji' && { backgroundColor: colors.accentGold },
                ]}
                onPress={() => {
                  setActiveTab('emoji');
                  setSearchQuery('');
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, marginRight: 5 }}>😄</Text>
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'emoji' ? '#1A1A1A' : colors.foreground },
                  ]}
                >
                  EMOJIS ({allFlatEmojis.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === 'gif' && { backgroundColor: colors.accentGold },
                ]}
                onPress={() => {
                  setActiveTab('gif');
                  setSearchQuery('');
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, marginRight: 5 }}>🎞️</Text>
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'gif' ? '#1A1A1A' : colors.foreground },
                  ]}
                >
                  GIFS & MEMES
                </Text>
              </TouchableOpacity>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeIconBtn, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Global Search Bar (Discord / Apple Style) */}
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: isDark ? colors.background : '#F8FAFC',
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="search" size={16} color={colors.accentGold} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder={
                activeTab === 'emoji'
                  ? 'Search all emojis (e.g. fire, happy, dog, pizza, run)...'
                  : 'Search animated GIFs (e.g. driving, safe, omw, funny)...'
              }
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {/* Search Input Clear or Loading Indicator */}
            {isSearchingGifs ? (
              <ActivityIndicator size="small" color={themeMode === 'brand_green' ? '#3DBE6C' : (colors.accentGold || '#10B981')} />
            ) : searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Category Jump Selector Bar (Only for Emoji Tab when not actively searching) */}
          {activeTab === 'emoji' && !searchQuery.trim() ? (
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
                      backgroundColor: selectedEmojiCategory === 'all'
                        ? (themeMode === 'brand_green' ? '#3DBE6C' : (colors.accentGold || '#10B981'))
                        : (isDark ? '#27272A' : '#E2E8F0'),
                      borderColor: selectedEmojiCategory === 'all'
                        ? (themeMode === 'brand_green' ? '#3DBE6C' : (colors.accentGold || '#10B981'))
                        : (isDark ? '#3F3F46' : '#CBD5E1'),
                    },
                  ]}
                  onPress={() => setSelectedEmojiCategory('all')}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, marginRight: 4 }}>✨</Text>
                  <Text
                    style={[
                      styles.categoryPillText,
                      {
                        color: selectedEmojiCategory === 'all'
                          ? '#FFFFFF'
                          : (isDark ? '#F4F4F5' : '#0F172A'),
                      },
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
                          backgroundColor: isSelected
                            ? (themeMode === 'brand_green' ? '#3DBE6C' : (colors.accentGold || '#10B981'))
                            : (isDark ? '#27272A' : '#E2E8F0'),
                          borderColor: isSelected
                            ? (themeMode === 'brand_green' ? '#3DBE6C' : (colors.accentGold || '#10B981'))
                            : (isDark ? '#3F3F46' : '#CBD5E1'),
                        },
                      ]}
                      onPress={() => setSelectedEmojiCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 13, marginRight: 4 }}>{catEmoji}</Text>
                      <Text
                        style={[
                          styles.categoryPillText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : (isDark ? '#F4F4F5' : '#0F172A'),
                          },
                        ]}
                      >
                        {cat.name.split(' & ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={[styles.separatorLine, { backgroundColor: isDark ? '#27272A' : '#E2E8F0' }]} />
            </View>
          ) : null}

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
              initialNumToRender={28}
              maxToRenderPerBatch={28}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              getItemLayout={(_, index) => ({ length: 44, offset: 44 * Math.floor(index / 7), index })}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.emojiCell}
                  onPress={() => onSelectEmoji(item.emoji)}
                  activeOpacity={0.5}
                >
                  <Text style={styles.emojiGlyph}>{item.emoji}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Matching Emojis</Text>
                  <Text style={[styles.emptySub, { color: colors.textMuted }]}>
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
                      backgroundColor: isDark ? colors.background : '#F1F5F9',
                      borderColor: colors.border,
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
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No GIFs Found</Text>
                  <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                    Try searching for any emotion, meme, or phrase (e.g. "laugh", "cat", "omw", "dance").
                  </Text>
                </View>
              }
            />
          )}
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
  trayCard: {
    width: '100%',
    height: Platform.OS === 'ios' ? 440 : 410,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  topHandleBar: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  tabPillContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  tabBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
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
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  emojiGridContainer: {
    paddingVertical: 8,
    paddingBottom: 24,
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
    paddingBottom: 30,
  },
  gifCard: {
    flex: 1,
    height: 125,
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
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 11.5,
    textAlign: 'center',
  },
});
