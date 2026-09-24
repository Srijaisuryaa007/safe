import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  Platform,
} from 'react-native';

export interface AnimatedListProps<T = any> {
  items?: T[];
  onItemSelect?: (item: T, index: number) => void;
  showGradients?: boolean;
  enableArrowNavigation?: boolean;
  className?: string;
  itemClassName?: string;
  displayScrollbar?: boolean;
  initialSelectedIndex?: number;
  maxHeight?: number | string;
  gradientColor?: string;
  renderItem?: (item: T, index: number, isSelected: boolean) => React.ReactNode;
}

const AnimatedItemWrapper = ({
  children,
  index,
  onPress,
  hasCustomRender,
}: {
  children: React.ReactNode;
  index: number;
  onPress: () => void;
  hasCustomRender?: boolean;
}) => {
  const enterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      delay: Math.min(index * 35, 300),
      useNativeDriver: true,
    }).start();
  }, [index]);

  const scale = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const translateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return (
    <Animated.View
      style={[
        styles.itemWrapper,
        {
          opacity: enterAnim,
          transform: [{ scale }, { translateY }],
        },
      ]}
    >
      {hasCustomRender ? (
        children
      ) : (
        <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
          {children}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const AnimatedList = <T,>({
  items = [] as unknown as T[],
  onItemSelect,
  showGradients = true,
  displayScrollbar = false,
  initialSelectedIndex = -1,
  maxHeight = 380,
  gradientColor = '#FAF9F6',
  renderItem,
}: AnimatedListProps<T>) => {
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [topOpacity, setTopOpacity] = useState(0);
  const [bottomOpacity, setBottomOpacity] = useState(1);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const y = contentOffset.y;
      setTopOpacity(Math.min(y / 40, 1));
      const distBottom = contentSize.height - (y + layoutMeasurement.height);
      setBottomOpacity(contentSize.height <= layoutMeasurement.height ? 0 : Math.min(distBottom / 40, 1));
    },
    []
  );

  const handleSelect = (item: T, idx: number) => {
    setSelectedIndex(idx);
    if (onItemSelect) onItemSelect(item, idx);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={[styles.scrollList, { maxHeight: typeof maxHeight === 'number' ? maxHeight : 380 }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={displayScrollbar}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
      >
        {items.map((item, index) => {
          const isSelected = selectedIndex === index;
          return (
            <AnimatedItemWrapper
              key={((item as any)?.user_id || (item as any)?.id || index)}
              index={index}
              onPress={() => handleSelect(item, index)}
              hasCustomRender={Boolean(renderItem)}
            >
              {renderItem ? (
                renderItem(item, index, isSelected)
              ) : (
                <View style={[styles.defaultItem, isSelected && styles.defaultItemSelected]}>
                  <Text style={styles.defaultItemText}>{typeof item === 'string' ? item : JSON.stringify(item)}</Text>
                </View>
              )}
            </AnimatedItemWrapper>
          );
        })}
      </ScrollView>

      {showGradients && (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.gradientOverlayTop,
              { backgroundColor: gradientColor, opacity: topOpacity * 0.95 },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.gradientOverlayBottom,
              { backgroundColor: gradientColor, opacity: bottomOpacity * 0.95 },
            ]}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  scrollList: {
    width: '100%',
  },
  scrollContent: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  itemWrapper: {
    marginBottom: 10,
  },
  defaultItem: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDEBE6',
  },
  defaultItemSelected: {
    backgroundColor: '#E8F5EE',
    borderColor: '#2E7D5B',
  },
  defaultItemText: {
    color: '#1F2A24',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'sans-serif' : undefined,
  },
  gradientOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  gradientOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 38,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
});

export default AnimatedList;
