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
      duration: 240,
      delay: Math.min(index * 30, 150),
      useNativeDriver: true,
    }).start();
  }, [index]);

  const handlePressIn = () => {
    Animated.spring(scaleTouch, {
      toValue: 0.98,
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
    outputRange: [6, 0],
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
        activeOpacity={0.85}
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
  showGradients = false,
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

  const handleItemClick = useCallback(
    (item: AnimatedListItem, index: number) => {
      setSelectedIndex(index);
      if (onItemSelect) {
        onItemSelect(item, index);
      }
    },
    [onItemSelect]
  );

  const renderContent = () => (
    <View style={styles.scrollContent}>
      {items.map((item, index) => {
        const isSelected = selectedIndex === index;
        const accentColor = item.color || '#30D158';

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
                    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                  },
                  itemStyle,
                ]}
              >
                {/* Left Apple Glyph Box */}
                <View style={[styles.compactOrb, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
                  <Ionicons name={item.icon || 'shield-outline'} size={15} color={accentColor} />
                </View>

                {/* Center Content */}
                <View style={styles.compactContentCol}>
                  <Text style={[styles.compactTitleText, { color: isDark ? '#FFFFFF' : '#000000' }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  
                  {item.badgeText || item.message ? (
                    <View style={styles.compactSubRow}>
                      {item.badgeText ? (
                        <Text style={[styles.compactBadgeText, { color: accentColor }]}>{item.badgeText} • </Text>
                      ) : null}
                      {item.message ? (
                        <Text style={[styles.compactMessageText, { color: isDark ? '#8E8E93' : '#636366' }]} numberOfLines={1}>
                          {item.message}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {/* Right Time & Arrow */}
                <View style={styles.compactRightCol}>
                  {item.time ? (
                    <Text style={[styles.compactTimeText, { color: isDark ? '#8E8E93' : '#8E8E93' }]}>{item.time}</Text>
                  ) : null}
                  <Ionicons name="chevron-forward" size={12} color="#8E8E93" />
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
        contentContainerStyle={styles.scrollContent}
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    width: '100%',
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
    borderRadius: 12,
    gap: 10,
  },
  compactOrb: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContentCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  compactTitleText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  compactSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  compactMessageText: {
    fontSize: 10.5,
    flex: 1,
  },
  compactRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactTimeText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default AnimatedList;
