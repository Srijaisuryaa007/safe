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
      duration: 280,
      delay: Math.min(index * 40, 200),
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
    outputRange: [10, 0],
  });

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY }, { scale: scaleTouch }],
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
  displayScrollbar = false,
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

    setTopGradientOpacity(Math.min(y / 20, 1));
    if (maxScroll <= 0) {
      setBottomGradientOpacity(0);
    } else {
      setBottomGradientOpacity(Math.min((maxScroll - y) / 20, 1));
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
                  styles.compactRowCard,
                  {
                    backgroundColor: isDark ? 'rgba(21, 23, 30, 0.7)' : 'rgba(249, 250, 251, 0.9)',
                    borderColor: isSelected ? `${accentColor}80` : isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                  },
                  isSelected && {
                    shadowColor: accentColor,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 6,
                    elevation: 2,
                  },
                  itemStyle,
                ]}
              >
                {/* Left Compact Icon Orb */}
                <View style={[styles.compactOrb, { backgroundColor: `${accentColor}15`, borderColor: `${accentColor}40` }]}>
                  <Ionicons name={item.icon || 'shield-outline'} size={13} color={accentColor} />
                </View>

                {/* Center Content */}
                <View style={styles.compactContentCol}>
                  <Text style={[styles.compactTitleText, { color: colors.foreground }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  
                  {item.badgeText || item.message ? (
                    <View style={styles.compactSubRow}>
                      {item.badgeText ? (
                        <View style={[styles.compactBadge, { backgroundColor: `${accentColor}15` }]}>
                          <Text style={[styles.compactBadgeText, { color: accentColor }]}>{item.badgeText}</Text>
                        </View>
                      ) : null}
                      {item.message ? (
                        <Text style={[styles.compactMessageText, { color: colors.textMuted }]} numberOfLines={1}>
                          {item.message}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {/* Right Time & Arrow */}
                <View style={styles.compactRightCol}>
                  {item.time ? (
                    <Text style={[styles.compactTimeText, { color: colors.textMuted }]}>{item.time}</Text>
                  ) : null}
                  <Ionicons name="chevron-forward" size={11} color={colors.textMuted} />
                </View>
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

      {/* Top & Bottom Subtle Fading Overflows */}
      {showGradients && (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.topGradientOverlay,
              {
                opacity: topGradientOpacity,
                backgroundColor: isDark ? 'rgba(18, 20, 28, 0.95)' : '#FFFFFF',
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.bottomGradientOverlay,
              {
                opacity: bottomGradientOpacity,
                backgroundColor: isDark ? 'rgba(18, 20, 28, 0.95)' : '#FFFFFF',
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
    paddingVertical: 1,
    gap: 6,
  },
  compactRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    gap: 9,
  },
  compactOrb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContentCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  compactTitleText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  compactSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactBadge: {
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  compactBadgeText: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  compactMessageText: {
    fontSize: 10,
    flex: 1,
  },
  compactRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactTimeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  topGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 14,
  },
  bottomGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 16,
  },
});

export default AnimatedList;
