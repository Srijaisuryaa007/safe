import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';

export interface AnimatedListItem {
  id: string;
  title: string;
  badgeText?: string;
  message?: string;
  time?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  category?: string;
  isNew?: boolean;
  [key: string]: any;
}

interface AnimatedItemProps {
  children: React.ReactNode;
  index: number;
  isSelected?: boolean;
  onPress?: () => void;
}

const AnimatedItem: React.FC<AnimatedItemProps> = ({ children, index, isSelected, onPress }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const scaleTouch = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      delay: Math.min(index * 60, 300),
      useNativeDriver: true,
    }).start();
  }, [index]);

  const handlePressIn = () => {
    Animated.spring(scaleTouch, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleTouch, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  const entranceScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY }, { scale: Animated.multiply(entranceScale, scaleTouch) }],
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

export interface AnimatedListProps {
  items: AnimatedListItem[];
  onItemSelect?: (item: AnimatedListItem, index: number) => void;
  showGradients?: boolean;
  enableArrowNavigation?: boolean;
  displayScrollbar?: boolean;
  initialSelectedIndex?: number;
  maxHeight?: number;
  isNestedInParentScroll?: boolean;
  containerStyle?: ViewStyle;
  itemStyle?: ViewStyle;
  renderCustomItem?: (item: AnimatedListItem, index: number, isSelected: boolean) => React.ReactNode;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  items = [],
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  displayScrollbar = true,
  initialSelectedIndex = -1,
  maxHeight,
  isNestedInParentScroll = false,
  containerStyle,
  itemStyle,
  renderCustomItem,
}) => {
  const { colors, isDark } = useThemeStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(initialSelectedIndex);
  const [topGradientOpacity, setTopGradientOpacity] = useState<number>(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState<number>(1);

  const handleItemClick = useCallback(
    (item: AnimatedListItem, index: number) => {
      setSelectedIndex(index);
      if (onItemSelect) {
        onItemSelect(item, index);
      }
    },
    [onItemSelect]
  );

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = contentOffset.y;
    const scrollHeight = contentSize.height;
    const clientHeight = layoutMeasurement.height;
    const maxScroll = scrollHeight - clientHeight;

    setTopGradientOpacity(Math.min(y / 40, 1));
    if (maxScroll <= 0) {
      setBottomGradientOpacity(0);
    } else {
      setBottomGradientOpacity(Math.min((maxScroll - y) / 40, 1));
    }
  };

  const renderContent = () => (
    <View style={styles.scrollContent}>
      {items.map((item, index) => {
        const isSelected = selectedIndex === index;
        const accentColor = item.color || colors.accentGold;

        return (
          <AnimatedItem
            key={item.id || index}
            index={index}
            isSelected={isSelected}
            onPress={() => handleItemClick(item, index)}
          >
            {renderCustomItem ? (
              renderCustomItem(item, index, isSelected)
            ) : (
              <View
                style={[
                  styles.cardContainer,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(212, 175, 55, 0.12)'
                        : '#F4F4F5'
                      : isDark
                      ? colors.surface
                      : '#FFFFFF',
                    borderColor: isSelected ? accentColor : isDark ? colors.border : '#E4E4E7',
                    borderLeftColor: accentColor,
                    borderLeftWidth: 4,
                  },
                  itemStyle,
                ]}
              >
                {/* Top Header Row with Icon Box, Badge Tag & Aligned Time */}
                <View style={styles.cardHeader}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.iconBox, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}40` }]}>
                      <Ionicons name={item.icon || 'shield-outline'} size={13} color={accentColor} />
                    </View>
                    {item.badgeText ? (
                      <Text style={[styles.badgeText, { color: accentColor }]}>
                        {item.badgeText}
                      </Text>
                    ) : null}
                  </View>

                  {item.time ? (
                    <View style={styles.timePill}>
                      <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                      <Text style={[styles.timeText, { color: colors.textMuted }]}>{item.time}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Title */}
                <Text style={[styles.titleText, { color: colors.foreground }]}>
                  {item.title}
                </Text>

                {/* Subtitle / Message */}
                {item.message ? (
                  <Text style={[styles.messageText, { color: colors.textMuted }]}>
                    {item.message}
                  </Text>
                ) : null}
              </View>
            )}
          </AnimatedItem>
        );
      })}
    </View>
  );

  if (isNestedInParentScroll) {
    return (
      <View style={[styles.outerWrapper, containerStyle]}>
        {renderContent()}
      </View>
    );
  }

  return (
    <View style={[styles.outerWrapper, containerStyle, maxHeight ? { maxHeight } : undefined]}>
      <ScrollView
        ref={scrollViewRef}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={displayScrollbar}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {renderContent()}
      </ScrollView>

      {/* Top & Bottom Dynamic Fading Overflow Gradients */}
      {showGradients && (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.topGradientOverlay,
              {
                opacity: topGradientOpacity,
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.bottomGradientOverlay,
              {
                opacity: bottomGradientOpacity,
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
              },
            ]}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  scrollContent: {
    paddingVertical: 6,
    gap: 10,
  },
  cardContainer: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  titleText: {
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  messageText: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 4,
  },
  topGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
  },
  bottomGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 26,
  },
});

export default AnimatedList;
