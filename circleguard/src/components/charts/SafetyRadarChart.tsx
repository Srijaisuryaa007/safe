import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import Svg, {
  Polygon,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
} from 'react-native-svg';

export interface RadarMetric {
  key: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface RadarSeries {
  label: string;
  color: string;
  fillOpacity?: number;
  values: Record<string, number>; // key -> 0 to 100
}

export interface SafetyRadarChartProps {
  data: RadarSeries[];
  metrics?: RadarMetric[];
  size?: number;
  levels?: number;
  overallScore?: number;
  isDark?: boolean;
  title?: string;
  showBenchmark?: boolean;
}

export const DEFAULT_SAFETY_METRICS: RadarMetric[] = [
  { key: 'braking', label: 'Smooth Braking', description: 'Zero sudden hard brakes detected' },
  { key: 'acceleration', label: 'Controlled Accel', description: 'Smooth throttle application without rapid bursts' },
  { key: 'speedCompliance', label: 'Speed Compliance', description: 'Consistently driving within road limits' },
  { key: 'paceConsistency', label: 'Pace Stability', description: 'Even driving speeds and safe stopping distance' },
  { key: 'nightFocus', label: 'Day/Night Caution', description: 'Extra caution and safe speed during nighttime' },
];

export const SafetyRadarChart: React.FC<SafetyRadarChartProps> = ({
  data = [],
  metrics = DEFAULT_SAFETY_METRICS,
  size: propSize,
  levels = 4,
  overallScore,
  isDark = true,
  title = 'DRIVING SAFETY TELEMETRICS RADAR',
  showBenchmark = true,
}) => {
  const [containerWidth, setContainerWidth] = useState<number>(320);
  const [activeMetricKey, setActiveMetricKey] = useState<string | null>(null);

  const chartSize = propSize || Math.min(containerWidth - 32, 340);
  const center = chartSize / 2;
  const radius = chartSize * 0.36; // leave room for labels around perimeter

  const numMetrics = metrics.length;
  const angleStep = (2 * Math.PI) / numMetrics;

  // Grid level polygons (spider web)
  const gridLevels = useMemo(() => {
    const list: { level: number; pointsString: string; value: number }[] = [];
    for (let l = 1; l <= levels; l++) {
      const levelRadius = (radius * l) / levels;
      const points = metrics.map((_, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const x = center + levelRadius * Math.cos(angle);
        const y = center + levelRadius * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      list.push({
        level: l,
        pointsString: points.join(' '),
        value: Math.round((100 * l) / levels),
      });
    }
    return list;
  }, [levels, radius, center, metrics, angleStep]);

  // Radial spoke lines from center to perimeter
  const spokeLines = useMemo(() => {
    return metrics.map((m, i) => {
      const angle = -Math.PI / 2 + i * angleStep;
      const endX = center + radius * Math.cos(angle);
      const endY = center + radius * Math.sin(angle);

      // Label coordinate slightly outside perimeter
      const labelRadius = radius + 24;
      const labelX = center + labelRadius * Math.cos(angle);
      const labelY = center + labelRadius * Math.sin(angle);

      return {
        metric: m,
        startX: center,
        startY: center,
        endX,
        endY,
        labelX,
        labelY,
        angle,
      };
    });
  }, [metrics, center, radius, angleStep]);

  // Series polygons
  const seriesPolygons = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((series) => {
      const coords = metrics.map((m, i) => {
        const rawVal = series.values[m.key] !== undefined ? series.values[m.key] : 75;
        const clampedVal = Math.max(5, Math.min(100, rawVal));
        const valRadius = (radius * clampedVal) / 100;
        const angle = -Math.PI / 2 + i * angleStep;
        return {
          key: m.key,
          x: center + valRadius * Math.cos(angle),
          y: center + valRadius * Math.sin(angle),
          value: clampedVal,
        };
      });

      const pointsString = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

      return {
        series,
        coords,
        pointsString,
      };
    });
  }, [data, metrics, center, radius, angleStep]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 4) {
      setContainerWidth(w);
    }
  };

  const activeMetricObj = activeMetricKey
    ? metrics.find((m) => m.key === activeMetricKey)
    : null;

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
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrapper}>
          <View style={[styles.headerDot, { backgroundColor: '#00E599' }]} />
          <Text style={[styles.titleText, { color: isDark ? '#A0AEC0' : '#4A5568' }]}>
            {title}
          </Text>
        </View>

        {overallScore !== undefined && (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>
              {overallScore} <Text style={styles.scoreBadgeDenom}>/100</Text>
            </Text>
          </View>
        )}
      </View>

      {/* SVG Radar Spider Web */}
      <View style={styles.svgWrapper}>
        <Svg width={chartSize} height={chartSize}>
          <Defs>
            {/* Primary Driver Glow Gradient */}
            <LinearGradient id="radarDriverGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#00E599" stopOpacity={0.45} />
              <Stop offset="100%" stopColor="#38E8FF" stopOpacity={0.25} />
            </LinearGradient>

            {/* Benchmark Fill Gradient */}
            <LinearGradient id="radarBenchmarkGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#94A3B8" stopOpacity={0.15} />
              <Stop offset="100%" stopColor="#64748B" stopOpacity={0.08} />
            </LinearGradient>
          </Defs>

          {/* Web Levels (Concentric Polygons) */}
          {gridLevels.map((gl) => (
            <Polygon
              key={`grid-level-${gl.level}`}
              points={gl.pointsString}
              fill="none"
              stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
              strokeWidth={1}
              strokeDasharray={gl.level === levels ? undefined : '3,3'}
            />
          ))}

          {/* Spokes Lines */}
          {spokeLines.map((spoke, idx) => (
            <G key={`spoke-${idx}`}>
              <Line
                x1={spoke.startX}
                y1={spoke.startY}
                x2={spoke.endX}
                y2={spoke.endY}
                stroke={isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}
                strokeWidth={1}
              />
            </G>
          ))}

          {/* Benchmark Series (rendered in background) */}
          {showBenchmark &&
            seriesPolygons
              .filter((sp) => sp.series.label.toLowerCase().includes('benchmark'))
              .map((sp, idx) => (
                <G key={`benchmark-poly-${idx}`}>
                  <Polygon
                    points={sp.pointsString}
                    fill="url(#radarBenchmarkGrad)"
                    stroke="rgba(148, 163, 184, 0.5)"
                    strokeWidth={1.5}
                    strokeDasharray="4,3"
                  />
                </G>
              ))}

          {/* Active Driver Series (Primary Polygon) */}
          {seriesPolygons
            .filter((sp) => !sp.series.label.toLowerCase().includes('benchmark'))
            .map((sp, idx) => (
              <G key={`driver-poly-${idx}`}>
                <Polygon
                  points={sp.pointsString}
                  fill="url(#radarDriverGrad)"
                  stroke="#00E599"
                  strokeWidth={2.4}
                  strokeLinejoin="round"
                />

                {/* Vertices Dots */}
                {sp.coords.map((coord, ptIdx) => {
                  const isHighlighted = activeMetricKey === coord.key;
                  return (
                    <G key={`point-${ptIdx}`}>
                      <Circle
                        cx={coord.x}
                        cy={coord.y}
                        r={isHighlighted ? 7 : 4.5}
                        fill="#00E599"
                        fillOpacity={isHighlighted ? 0.4 : 0.2}
                      />
                      <Circle
                        cx={coord.x}
                        cy={coord.y}
                        r={isHighlighted ? 4 : 2.5}
                        fill="#FFFFFF"
                        stroke="#00E599"
                        strokeWidth={1.8}
                      />
                    </G>
                  );
                })}
              </G>
            ))}

          {/* Perimeter Labels */}
          {spokeLines.map((spoke, idx) => {
            const isTop = Math.abs(spoke.angle - -Math.PI / 2) < 0.2;
            const isBottom = Math.abs(spoke.angle - Math.PI / 2) < 0.2;
            const isRight = spoke.labelX > center + 10;
            const isLeft = spoke.labelX < center - 10;

            let anchor: 'middle' | 'start' | 'end' = 'middle';
            if (isRight) anchor = 'start';
            if (isLeft) anchor = 'end';

            const isSelected = activeMetricKey === spoke.metric.key;

            return (
              <SvgText
                key={`label-${idx}`}
                x={spoke.labelX}
                y={spoke.labelY + (isTop ? -4 : isBottom ? 10 : 3)}
                textAnchor={anchor}
                fill={isSelected ? '#00E599' : isDark ? '#A0AEC0' : '#4A5568'}
                fontSize={9.5}
                fontWeight={isSelected ? '900' : '700'}
                letterSpacing={0.4}
              >
                {spoke.metric.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>

      {/* Interactive Metric Pills */}
      <View style={styles.metricsPillsRow}>
        {metrics.map((m) => {
          const isSelected = activeMetricKey === m.key;
          const driverSeries = data.find((d) => !d.label.toLowerCase().includes('benchmark'));
          const scoreVal = driverSeries?.values[m.key] !== undefined ? driverSeries.values[m.key] : 85;

          return (
            <TouchableOpacity
              key={m.key}
              style={[
                styles.metricPill,
                {
                  backgroundColor: isSelected
                    ? isDark ? 'rgba(0, 229, 153, 0.16)' : '#E8F5EE'
                    : isDark ? 'rgba(255, 255, 255, 0.04)' : '#F7FAFC',
                  borderColor: isSelected
                    ? '#00E599'
                    : isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                },
              ]}
              onPress={() => setActiveMetricKey(isSelected ? null : m.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.metricPillLabel, { color: isSelected ? '#00E599' : isDark ? '#E2E8F0' : '#2D3748' }]}>
                {m.label}
              </Text>
              <Text style={[styles.metricPillScore, { color: isSelected ? '#00E599' : isDark ? '#A0AEC0' : '#718096' }]}>
                {Math.round(scoreVal)}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Explanatory Context Footer */}
      {activeMetricObj && (
        <View style={[styles.detailBox, { backgroundColor: isDark ? 'rgba(0, 229, 153, 0.08)' : '#F0FFF4' }]}>
          <Text style={[styles.detailTitle, { color: '#00E599' }]}>
            {activeMetricObj.label.toUpperCase()}
          </Text>
          <Text style={[styles.detailDesc, { color: isDark ? '#E2E8F0' : '#2D3748' }]}>
            {activeMetricObj.description}
          </Text>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00E599' }]} />
          <Text style={[styles.legendText, { color: isDark ? '#A0AEC0' : '#718096' }]}>Driver Evaluation</Text>
        </View>
        {showBenchmark && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(148, 163, 184, 0.6)' }]} />
            <Text style={[styles.legendText, { color: isDark ? '#A0AEC0' : '#718096' }]}>Circle Average</Text>
          </View>
        )}
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
    alignItems: 'center',
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
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  scoreBadge: {
    backgroundColor: 'rgba(0, 229, 153, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 153, 0.3)',
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00E599',
    fontVariant: ['tabular-nums'],
  },
  scoreBadgeDenom: {
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(0, 229, 153, 0.7)',
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  metricsPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 6,
    width: '100%',
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  metricPillLabel: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  metricPillScore: {
    fontSize: 9.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  detailBox: {
    width: '100%',
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 153, 0.25)',
  },
  detailTitle: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  detailDesc: {
    fontSize: 10.5,
    fontWeight: '600',
    lineHeight: 14,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
});

export default SafetyRadarChart;
