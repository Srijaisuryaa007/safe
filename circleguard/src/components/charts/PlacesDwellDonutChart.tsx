import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Svg, { Path, G, Text as SvgText } from 'react-native-svg';
import * as d3 from 'd3';

export interface DwellSegment {
  id: string;
  name: string;
  durationMins: number;
  color: string;
  icon?: string;
  isSafeHaven?: boolean;
}

export interface PlacesDwellDonutChartProps {
  segments?: DwellSegment[];
  size?: number;
  innerRadiusRatio?: number;
  isDark?: boolean;
  title?: string;
}

export const PlacesDwellDonutChart: React.FC<PlacesDwellDonutChartProps> = ({
  segments: propSegments,
  size = 180,
  innerRadiusRatio = 0.68,
  isDark = true,
  title = 'TIME DISTRIBUTION & PLACES DWELL',
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const center = size / 2;
  const outerRadius = size / 2 - 10;
  const innerRadius = outerRadius * innerRadiusRatio;

  // Fallback demo segments if empty
  const data = useMemo(() => {
    if (propSegments && propSegments.length > 0) return propSegments;
    return [
      { id: 'home', name: 'Safe Haven (Home)', durationMins: 780, color: '#00E599', isSafeHaven: true },
      { id: 'work', name: 'Workplace / Campus', durationMins: 390, color: '#007AFF' },
      { id: 'transit', name: 'Vehicular Transit', durationMins: 95, color: '#38E8FF' },
      { id: 'cafe', name: 'Third Places / Stops', durationMins: 45, color: '#FF9500' },
    ];
  }, [propSegments]);

  const totalMinutes = useMemo(() => {
    return data.reduce((acc, d) => acc + d.durationMins, 0);
  }, [data]);

  // D3 Pie Generator
  const pieArcs = useMemo(() => {
    if (data.length === 0 || totalMinutes === 0) return [];

    const pie = d3
      .pie<DwellSegment>()
      .value((d) => d.durationMins)
      .sort(null)
      .padAngle(0.04);

    const arcGen = d3
      .arc<d3.PieArcDatum<DwellSegment>>()
      .innerRadius(innerRadius)
      .outerRadius((d) => (selectedId === d.data.id ? outerRadius + 4 : outerRadius))
      .cornerRadius(4);

    const arcs = pie(data);

    return arcs.map((arc) => ({
      data: arc.data,
      path: arcGen(arc) || '',
      pct: Math.round((arc.data.durationMins / totalMinutes) * 100),
    }));
  }, [data, totalMinutes, innerRadius, outerRadius, selectedId]);

  const formatHoursMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const selectedItem = selectedId ? data.find((d) => d.id === selectedId) : null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(11, 13, 20, 0.75)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
    >
      {/* Title */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrapper}>
          <View style={[styles.headerDot, { backgroundColor: '#38E8FF' }]} />
          <Text style={[styles.titleText, { color: isDark ? '#A0AEC0' : '#4A5568' }]}>
            {title}
          </Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>
            {formatHoursMins(totalMinutes)} LOGGED
          </Text>
        </View>
      </View>

      <View style={styles.contentRow}>
        {/* Donut Svg */}
        <View style={styles.svgWrapper}>
          <Svg width={size} height={size}>
            <G transform={`translate(${center}, ${center})`}>
              {pieArcs.map((arc) => (
                <Path
                  key={`arc-${arc.data.id}`}
                  d={arc.path}
                  fill={arc.data.color}
                  opacity={selectedId && selectedId !== arc.data.id ? 0.35 : 0.95}
                />
              ))}
            </G>
          </Svg>

          {/* Center Callout */}
          <View style={styles.centerTextWrap}>
            <Text style={[styles.centerVal, { color: isDark ? '#FFFFFF' : '#1A202C' }]}>
              {selectedItem ? formatHoursMins(selectedItem.durationMins) : `${Math.round(totalMinutes / 60)}h`}
            </Text>
            <Text style={[styles.centerSub, { color: isDark ? '#718096' : '#A0AEC0' }]}>
              {selectedItem ? selectedItem.name.split(' ')[0].toUpperCase() : 'TOTAL'}
            </Text>
          </View>
        </View>

        {/* Legend Column */}
        <View style={styles.legendColumn}>
          {data.map((seg) => {
            const isSelected = selectedId === seg.id;
            const pct = totalMinutes > 0 ? Math.round((seg.durationMins / totalMinutes) * 100) : 0;

            return (
              <TouchableOpacity
                key={seg.id}
                style={[
                  styles.legendItem,
                  {
                    backgroundColor: isSelected
                      ? `${seg.color}15`
                      : 'transparent',
                    borderColor: isSelected ? seg.color : 'transparent',
                  },
                ]}
                onPress={() => setSelectedId(isSelected ? null : seg.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.legendName,
                      { color: isSelected ? seg.color : isDark ? '#E2E8F0' : '#2D3748' },
                    ]}
                    numberOfLines={1}
                  >
                    {seg.name}
                  </Text>
                  <Text style={[styles.legendMeta, { color: isDark ? '#718096' : '#A0AEC0' }]}>
                    {formatHoursMins(seg.durationMins)} • {pct}%
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

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginVertical: 12,
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
    marginBottom: 10,
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
  totalBadge: {
    backgroundColor: 'rgba(56, 232, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 232, 255, 0.25)',
  },
  totalBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#38E8FF',
    letterSpacing: 0.8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerTextWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerVal: {
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  centerSub: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  legendColumn: {
    flex: 1,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendName: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  legendMeta: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
});

export default PlacesDwellDonutChart;
