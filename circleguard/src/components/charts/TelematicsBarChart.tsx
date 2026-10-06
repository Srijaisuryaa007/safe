import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Rect,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
  Circle,
} from 'react-native-svg';

export interface BarDatum {
  label: string; // e.g. "Mon", "Tue" or trip name
  value: number; // primary bar height (e.g. km driven or score)
  secondaryValue?: number; // e.g. top speed or drive mins
  subLabel?: string;
  badge?: string;
  isToday?: boolean;
}

export interface TelematicsBarChartProps {
  data: BarDatum[];
  height?: number;
  barWidth?: number;
  lineCap?: 'round' | 'butt';
  accentColor?: string;
  secondaryColor?: string;
  isDark?: boolean;
  title?: string;
  unit?: string;
  secondaryUnit?: string;
  onBarPress?: (item: BarDatum, index: number) => void;
  showDepth?: boolean;
}

export const TelematicsBarChart: React.FC<TelematicsBarChartProps> = ({
  data = [],
  height = 190,
  barWidth: propBarWidth,
  lineCap = 'round',
  accentColor = '#00E599',
  secondaryColor = '#38E8FF',
  isDark = true,
  title = 'WEEKLY MOBILITY & DISTANCE (KM)',
  unit = 'km',
  secondaryUnit = 'km/h',
  onBarPress,
  showDepth = true,
}) => {
  const [containerWidth, setContainerWidth] = useState<number>(320);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const padding = { top: 26, right: 16, bottom: 32, left: 34 };

  // Fallback demo data if data is empty or too short
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    return [
      { label: 'Mon', value: 14.2, secondaryValue: 54, subLabel: '2 trips' },
      { label: 'Tue', value: 28.5, secondaryValue: 68, subLabel: '4 trips' },
      { label: 'Wed', value: 9.8, secondaryValue: 42, subLabel: '1 trip' },
      { label: 'Thu', value: 34.0, secondaryValue: 74, subLabel: '5 trips' },
      { label: 'Fri', value: 22.4, secondaryValue: 58, subLabel: '3 trips' },
      { label: 'Sat', value: 41.6, secondaryValue: 82, subLabel: '6 trips' },
      { label: 'Sun', value: 18.0, secondaryValue: 48, subLabel: '2 trips', isToday: true },
    ];
  }, [data]);

  const innerWidth = Math.max(10, containerWidth - padding.left - padding.right);
  const innerHeight = Math.max(10, height - padding.top - padding.bottom);

  // Y domain
  const { maxVal, yTicks } = useMemo(() => {
    const values = chartData.map((d) => d.value);
    const max = Math.max(...values, 10);
    const roundedMax = Math.ceil((max * 1.15) / 10) * 10;
    const ticks = [0, Math.round(roundedMax * 0.33), Math.round(roundedMax * 0.66), roundedMax];
    return { maxVal: roundedMax, yTicks: ticks };
  }, [chartData]);

  // Bar layout
  const numBars = chartData.length;
  const barSlotWidth = innerWidth / Math.max(1, numBars);
  const calculatedBarWidth = propBarWidth || Math.max(14, Math.min(32, barSlotWidth * 0.58));
  const rx = lineCap === 'round' ? Math.min(8, calculatedBarWidth / 2) : 0;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 3) {
      setContainerWidth(w);
    }
  };

  const selectedItem = selectedIndex !== null ? chartData[selectedIndex] : null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(11, 13, 20, 0.75)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
      onLayout={onLayout}
    >
      {/* Header Bar */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrapper}>
          <View style={[styles.headerDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.titleText, { color: isDark ? '#A0AEC0' : '#4A5568' }]}>
            {title}
          </Text>
        </View>

        {selectedItem ? (
          <View style={styles.selectedPill}>
            <Text style={[styles.selectedVal, { color: accentColor }]}>
              {selectedItem.value.toFixed(1)} <Text style={styles.selectedUnit}>{unit}</Text>
            </Text>
            {selectedItem.secondaryValue ? (
              <Text style={styles.selectedSecondary}>
                • Peak: {selectedItem.secondaryValue} {secondaryUnit}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.totalBadge}>
            <Text style={[styles.totalText, { color: isDark ? '#718096' : '#A0AEC0' }]}>
              TOTAL <Text style={{ color: isDark ? '#E2E8F0' : '#1A202C', fontWeight: '800' }}>
                {chartData.reduce((acc, d) => acc + d.value, 0).toFixed(1)} {unit}
              </Text>
            </Text>
          </View>
        )}
      </View>

      {/* SVG Canvas */}
      <View style={{ alignItems: 'center' }}>
        <Svg width={containerWidth} height={height}>
          <Defs>
            {/* Primary Bar Linear Gradient (Top to bottom) */}
            <LinearGradient id="barGradPrimary" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#00E599" stopOpacity={0.95} />
              <Stop offset="70%" stopColor="#00B87A" stopOpacity={0.7} />
              <Stop offset="100%" stopColor="#008A5B" stopOpacity={0.4} />
            </LinearGradient>

            {/* Selected Active Bar Glow */}
            <LinearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#38E8FF" stopOpacity={1} />
              <Stop offset="65%" stopColor="#00E599" stopOpacity={0.85} />
              <Stop offset="100%" stopColor="#00B87A" stopOpacity={0.5} />
            </LinearGradient>

            {/* Glass Sheen (3D depth layer) */}
            <LinearGradient id="barGlassSheen" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.25} />
              <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.08} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={0.15} />
            </LinearGradient>

            {/* Peak Milestone Dot Glow */}
            <LinearGradient id="peakDotGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#38E8FF" />
              <Stop offset="100%" stopColor="#007AFF" />
            </LinearGradient>
          </Defs>

          {/* Horizontal Grid lines */}
          {yTicks.map((val) => {
            const y = padding.top + innerHeight - (val / maxVal) * innerHeight;
            return (
              <G key={`grid-line-${val}`}>
                <Line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + innerWidth}
                  y2={y}
                  stroke={isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                <SvgText
                  x={padding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill={isDark ? '#4A5568' : '#A0AEC0'}
                  fontSize={8.5}
                  fontWeight="600"
                >
                  {val}
                </SvgText>
              </G>
            );
          })}

          {/* Bars */}
          {chartData.map((d, i) => {
            const barHeight = Math.max(4, (d.value / maxVal) * innerHeight);
            const x = padding.left + i * barSlotWidth + (barSlotWidth - calculatedBarWidth) / 2;
            const y = padding.top + innerHeight - barHeight;
            const isSelected = selectedIndex === i;

            return (
              <G key={`bar-group-${i}`}>
                {/* Background Track (Empty column slot) */}
                <Rect
                  x={x}
                  y={padding.top}
                  width={calculatedBarWidth}
                  height={innerHeight}
                  rx={rx}
                  fill={isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.02)'}
                />

                {/* Primary Bar */}
                <Rect
                  x={x}
                  y={y}
                  width={calculatedBarWidth}
                  height={barHeight}
                  rx={rx}
                  fill={isSelected ? 'url(#barGradActive)' : 'url(#barGradPrimary)'}
                />

                {/* 3D Glass Sheen Overlay */}
                {showDepth && (
                  <Rect
                    x={x}
                    y={y}
                    width={calculatedBarWidth}
                    height={barHeight}
                    rx={rx}
                    fill="url(#barGlassSheen)"
                  />
                )}

                {/* Secondary Peak Milestone Dot (Top Speed indicator) */}
                {d.secondaryValue && d.secondaryValue > 0 && (
                  <Circle
                    cx={x + calculatedBarWidth / 2}
                    cy={Math.max(padding.top + 8, y - 8)}
                    r={isSelected ? 4 : 2.5}
                    fill={isSelected ? '#38E8FF' : 'rgba(56, 232, 255, 0.7)'}
                  />
                )}

                {/* Category X-Axis Label */}
                <SvgText
                  x={x + calculatedBarWidth / 2}
                  y={height - 10}
                  textAnchor="middle"
                  fill={isSelected ? '#00E599' : d.isToday ? '#38E8FF' : isDark ? '#718096' : '#A0AEC0'}
                  fontSize={9.5}
                  fontWeight={isSelected || d.isToday ? '800' : '600'}
                >
                  {d.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Tap Overlay Row */}
      <View style={[styles.touchOverlay, { left: padding.left, width: innerWidth, height: height - 20 }]}>
        {chartData.map((d, i) => (
          <TouchableOpacity
            key={`touch-${i}`}
            style={{ flex: 1, height: '100%' }}
            onPress={() => {
              const next = selectedIndex === i ? null : i;
              setSelectedIndex(next);
              if (onBarPress) onBarPress(d, i);
            }}
            activeOpacity={0.6}
          />
        ))}
      </View>

      {/* Interactive Tooltip Card */}
      {selectedItem ? (
        <View
          style={[
            styles.tooltipBox,
            {
              backgroundColor: isDark ? 'rgba(0, 229, 153, 0.08)' : '#F0FFF4',
              borderColor: isDark ? 'rgba(0, 229, 153, 0.25)' : '#C6E7D5',
            },
          ]}
        >
          <View style={styles.tooltipHeader}>
            <Text style={[styles.tooltipDay, { color: '#00E599' }]}>
              {selectedItem.label.toUpperCase()} {selectedItem.isToday ? '• TODAY' : ''}
            </Text>
            {selectedItem.subLabel ? (
              <Text style={[styles.tooltipSub, { color: isDark ? '#A0AEC0' : '#718096' }]}>
                {selectedItem.subLabel}
              </Text>
            ) : null}
          </View>
          <View style={styles.tooltipMetricsRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="navigate" size={13} color="#00E599" />
              <Text style={[styles.tooltipMetricVal, { color: isDark ? '#FFFFFF' : '#1A202C' }]}>
                {selectedItem.value.toFixed(1)} {unit} driven
              </Text>
            </View>
            {selectedItem.secondaryValue ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="speedometer" size={13} color="#38E8FF" />
                <Text style={[styles.tooltipMetricVal, { color: isDark ? '#FFFFFF' : '#1A202C' }]}>
                  {selectedItem.secondaryValue} {secondaryUnit} top speed
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.hintFooter}>
          <Text style={[styles.hintText, { color: isDark ? '#4A5568' : '#A0AEC0' }]}>
            Tap any day column to view detailed mobility & peak speeds
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 14,
    marginVertical: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  titleText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 153, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 153, 0.25)',
    gap: 4,
  },
  selectedVal: {
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  selectedUnit: {
    fontSize: 9,
    fontWeight: '700',
  },
  selectedSecondary: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#38E8FF',
  },
  totalBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  totalText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  touchOverlay: {
    position: 'absolute',
    top: 36,
    flexDirection: 'row',
  },
  tooltipBox: {
    marginHorizontal: 16,
    marginTop: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tooltipDay: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tooltipSub: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  tooltipMetricsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  tooltipMetricVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  hintFooter: {
    alignItems: 'center',
    marginTop: 4,
  },
  hintText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default TelematicsBarChart;
