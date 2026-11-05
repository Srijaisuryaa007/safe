import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import * as d3 from 'd3';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/useThemeStore';

export interface Analytics5Segment {
  id: string;
  name: string;
  value: number; // Duration in minutes, distance in km, or score
  formattedValue?: string;
  color: string;
  icon?: string;
  subText?: string;
}

export interface Analytics5DonutChartProps {
  title?: string;
  subtitle?: string;
  trendText?: string;
  trendPositive?: boolean;
  segments?: Analytics5Segment[];
  size?: number;
  innerRadiusRatio?: number;
  unit?: string;
  isDark?: boolean;
  valueFormatter?: (val: number) => string;
}

export const Analytics5DonutChart: React.FC<Analytics5DonutChartProps> = ({
  title = 'ACTIVITY DISTRIBUTION',
  subtitle = 'Breakdown of recorded telematic segments',
  trendText,
  trendPositive = true,
  segments: propSegments,
  size = 190,
  innerRadiusRatio = 0.68,
  unit = '',
  isDark: propIsDark,
  valueFormatter,
}) => {
  const { isDark: storeIsDark } = useThemeStore();
  const isDark = propIsDark !== undefined ? propIsDark : storeIsDark;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Responsive size calculation to guarantee generous horizontal legend space on mobile
  const screenWidth = Dimensions.get('window').width;
  const actualSize = useMemo(() => {
    if (size !== 190) return size;
    if (screenWidth < 370) return 122;
    if (screenWidth < 415) return 130;
    return 138;
  }, [size, screenWidth]);

  // Fallback demo segments if none provided
  const data: Analytics5Segment[] = useMemo(() => {
    if (propSegments && propSegments.length > 0) return propSegments;
    return [
      { id: '1', name: 'Safe Places', value: 520, color: '#FFFFFF', subText: 'Safe Haven' },
      { id: '2', name: 'Transit & Commute', value: 240, color: '#38BDF8', subText: 'In Transit' },
      { id: '3', name: 'Secondary Stops', value: 120, color: '#94A3B8', subText: 'Third Place' },
      { id: '4', name: 'Short Stays', value: 65, color: '#64748B', subText: 'Quick Errand' },
    ];
  }, [propSegments]);

  const total = useMemo(() => {
    return data.reduce((acc, d) => acc + (d.value || 0), 0);
  }, [data]);

  const formatValue = (val: number) => {
    if (valueFormatter) return valueFormatter(val);
    if (unit === 'km' || unit === 'mi') {
      return `${val.toFixed(1)} ${unit}`;
    }
    // Default time format
    const h = Math.floor(val / 60);
    const m = Math.round(val % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const center = actualSize / 2;
  const outerRadius = actualSize / 2 - 8;
  const innerRadius = outerRadius * (actualSize < 140 ? 0.63 : innerRadiusRatio);

  // D3 Pie & Arc Calculations with smooth corner radius and padding gaps
  const pieArcs = useMemo(() => {
    if (data.length === 0 || total === 0) return [];

    const pie = d3
      .pie<Analytics5Segment>()
      .value((d) => d.value)
      .sort(null)
      .padAngle(0.045);

    const arcGen = d3
      .arc<d3.PieArcDatum<Analytics5Segment>>()
      .innerRadius(innerRadius)
      .outerRadius((d) => (selectedId === d.data.id ? outerRadius + 4 : outerRadius))
      .cornerRadius(4);

    const arcs = pie(data);

    return arcs.map((arc) => ({
      data: arc.data,
      path: arcGen(arc) || '',
      pct: total > 0 ? Math.round((arc.data.value / total) * 100) : 0,
    }));
  }, [data, total, innerRadius, outerRadius, selectedId]);

  const selectedItem = selectedId ? data.find((d) => d.id === selectedId) : null;
  const selectedPct = selectedItem && total > 0 ? Math.round((selectedItem.value / total) * 100) : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#101319' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
        },
      ]}
    >
      {/* 1. Header with Badge & Trend */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            />
            <Text
              style={[
                styles.overline,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              ANALYTICS 5 • LIVE DONUT
            </Text>
          </View>

          <Text
            style={[
              styles.cardTitle,
              { color: isDark ? '#FFFFFF' : '#0F172A' },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.cardSubtitle,
                { color: isDark ? '#64748B' : '#94A3B8' },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {trendText ? (
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor: trendPositive
                  ? (isDark ? 'rgba(56, 189, 248, 0.12)' : '#E0F2FE')
                  : (isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2'),
                borderColor: trendPositive
                  ? (isDark ? 'rgba(56, 189, 248, 0.3)' : '#BAE6FD')
                  : (isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA'),
              },
            ]}
          >
            <Ionicons
              name={trendPositive ? 'trending-up' : 'trending-down'}
              size={12}
              color={trendPositive ? '#38BDF8' : '#EF4444'}
            />
            <Text
              style={[
                styles.trendText,
                { color: trendPositive ? (isDark ? '#38BDF8' : '#0369A1') : '#DC2626' },
              ]}
            >
              {trendText}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.totalLoggedPill,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#CBD5E1',
              },
            ]}
          >
            <Ionicons
              name="pie-chart-outline"
              size={12}
              color={isDark ? '#FFFFFF' : '#0F172A'}
            />
            <Text
              style={[
                styles.totalLoggedText,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              {formatValue(total)}
            </Text>
          </View>
        )}
      </View>

      {/* 2. Donut & Live Center Metric */}
      <View style={styles.chartLayoutRow}>
        <View style={styles.donutSvgContainer}>
          <Svg width={actualSize} height={actualSize}>
            <G transform={`translate(${center}, ${center})`}>
              {pieArcs.map((arc) => {
                const isSelected = selectedId === arc.data.id;
                const isDimmed = selectedId !== null && !isSelected;

                return (
                  <Path
                    key={`arc_${arc.data.id}`}
                    d={arc.path}
                    fill={arc.data.color}
                    opacity={isDimmed ? 0.30 : 0.98}
                    stroke={isSelected ? (isDark ? '#FFFFFF' : '#0F172A') : (isDark ? '#101319' : '#FFFFFF')}
                    strokeWidth={isSelected ? 2 : 1}
                    onPress={() => setSelectedId(isSelected ? null : arc.data.id)}
                  />
                );
              })}
            </G>
          </Svg>

          {/* Live Center Total Container */}
          <TouchableOpacity
            style={[
              styles.centerTouchOverlay,
              {
                width: innerRadius * 1.85,
                height: innerRadius * 1.85,
                borderRadius: innerRadius,
              },
            ]}
            onPress={() => setSelectedId(null)}
            activeOpacity={0.8}
          >
            {/* Live Center Metric */}
            <Text
              style={[
                styles.centerLiveValue,
                {
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  fontSize: actualSize < 135 ? (total >= 1000 ? 14 : 16) : (total >= 1000 ? 17 : 20),
                },
              ]}
              numberOfLines={1}
            >
              {selectedItem ? formatValue(selectedItem.value) : formatValue(total)}
            </Text>

            <View style={styles.centerSubRow}>
              {selectedItem && (
                <View
                  style={[
                    styles.centerIndicatorDot,
                    { backgroundColor: selectedItem.color },
                  ]}
                />
              )}
              <Text
                style={[
                  styles.centerLiveSubtitle,
                  { color: isDark ? '#94A3B8' : '#64748B' },
                ]}
                numberOfLines={1}
              >
                {selectedItem
                  ? `${selectedItem.name.split(' ')[0].toUpperCase()} (${selectedPct}%)`
                  : 'LIVE TOTAL'}
              </Text>
            </View>

            {selectedItem && (
              <Text
                style={[
                  styles.centerTapHint,
                  { color: isDark ? '#64748B' : '#94A3B8' },
                ]}
              >
                TAP TO RESET
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. Interactive Legend Breakdown */}
        <View style={styles.legendContainer}>
          {data.map((seg) => {
            const isSelected = selectedId === seg.id;
            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;

            return (
              <TouchableOpacity
                key={`legend_${seg.id}`}
                style={[
                  styles.legendCard,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : '#F1F5F9'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : '#F8FAFC',
                    borderColor: isSelected
                      ? isDark
                        ? '#FFFFFF'
                        : '#0F172A'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : '#E2E8F0',
                  },
                ]}
                onPress={() => setSelectedId(isSelected ? null : seg.id)}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.legendColorBox,
                    { backgroundColor: seg.color },
                  ]}
                />

                <View style={{ flex: 1, minWidth: 0, marginRight: 6 }}>
                  <Text
                    style={[
                      styles.legendItemName,
                      {
                        color: isSelected
                          ? isDark
                            ? '#FFFFFF'
                            : '#0F172A'
                          : isDark
                          ? '#E2E8F0'
                          : '#1E293B',
                        fontWeight: isSelected ? '800' : '600',
                      },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {seg.name}
                  </Text>
                  <Text
                    style={[
                      styles.legendItemMeta,
                      { color: isDark ? '#94A3B8' : '#64748B' },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {seg.subText || formatValue(seg.value)}
                  </Text>
                </View>

                {/* Percentage Pill */}
                <View
                  style={[
                    styles.pctPill,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? '#FFFFFF'
                          : '#0F172A'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#EDEBE6',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pctPillText,
                      {
                        color: isSelected
                          ? isDark
                            ? '#000000'
                            : '#FFFFFF'
                          : isDark
                          ? '#FFFFFF'
                          : '#0F172A',
                      },
                    ]}
                  >
                    {pct}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default Analytics5DonutChart;

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    borderWidth: 1.2,
    padding: 14,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  overline: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontSize: 10.5,
    marginTop: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
  },
  trendText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalLoggedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 20,
    borderWidth: 1,
  },
  totalLoggedText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  chartLayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  donutSvgContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTouchOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  centerLiveValue: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  centerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  centerIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  centerLiveSubtitle: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  centerTapHint: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  legendContainer: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  legendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6.5,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  legendColorBox: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  legendItemName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  legendItemMeta: {
    fontSize: 9.5,
    marginTop: 1,
  },
  pctPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
});
