import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';

export interface RingMetric {
  key: string;
  label: string;
  value: number; // current value
  target: number; // goal/max
  color: string;
  gradientTo?: string;
  unit?: string;
  icon?: string;
}

export interface ConcentricActivityRingsProps {
  metrics?: RingMetric[];
  size?: number;
  strokeWidth?: number;
  ringGap?: number;
  isDark?: boolean;
  title?: string;
}

export const ConcentricActivityRings: React.FC<ConcentricActivityRingsProps> = ({
  metrics: propMetrics,
  size = 190,
  strokeWidth = 14,
  ringGap = 4,
  isDark = true,
  title = 'DAILY MOBILITY & SAFE HAVEN RINGS',
}) => {
  const center = size / 2;

  // Default metrics if not passed
  const rings = useMemo(() => {
    if (propMetrics && propMetrics.length > 0) return propMetrics;
    return [
      {
        key: 'safeZone',
        label: 'Safe Haven Time',
        value: 18.5,
        target: 24,
        unit: 'hrs',
        color: '#00E599',
        gradientTo: '#00B87A',
      },
      {
        key: 'mobility',
        label: 'Transit Distance',
        value: 14.8,
        target: 20,
        unit: 'km',
        color: '#38E8FF',
        gradientTo: '#007AFF',
      },
      {
        key: 'dwell',
        label: 'Place Stability',
        value: 82,
        target: 100,
        unit: '%',
        color: '#A855F7',
        gradientTo: '#EC4899',
      },
    ];
  }, [propMetrics]);

  // Radii for concentric rings from outer to inner
  const ringConfigs = useMemo(() => {
    const startRadius = center - strokeWidth / 2 - 8;
    return rings.map((r, i) => {
      const radius = startRadius - i * (strokeWidth + ringGap);
      const circumference = 2 * Math.PI * radius;
      const progress = Math.max(0, Math.min(1, r.value / Math.max(1, r.target)));
      const strokeDashoffset = circumference * (1 - progress);
      const pct = Math.round(progress * 100);

      return {
        ...r,
        radius,
        circumference,
        strokeDashoffset,
        pct,
      };
    });
  }, [rings, center, strokeWidth, ringGap]);

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
          <View style={[styles.headerDot, { backgroundColor: '#00E599' }]} />
          <Text style={[styles.titleText, { color: isDark ? '#A0AEC0' : '#4A5568' }]}>
            {title}
          </Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryBadgeText}>ACTIVITY HUD</Text>
        </View>
      </View>

      <View style={styles.contentRow}>
        {/* SVG Concentric Rings */}
        <View style={styles.svgWrapper}>
          <Svg width={size} height={size}>
            <Defs>
              {ringConfigs.map((r, i) => (
                <LinearGradient
                  key={`ringGrad-${r.key}`}
                  id={`ringGrad-${r.key}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <Stop offset="0%" stopColor={r.color} />
                  <Stop offset="100%" stopColor={r.gradientTo || r.color} />
                </LinearGradient>
              ))}
            </Defs>

            <G rotation="-90" origin={`${center}, ${center}`}>
              {/* Background Tracks */}
              {ringConfigs.map((r) => (
                <Circle
                  key={`track-${r.key}`}
                  cx={center}
                  cy={center}
                  r={r.radius}
                  stroke={r.color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={0.15}
                  fill="none"
                />
              ))}

              {/* Foreground Animated Arcs */}
              {ringConfigs.map((r) => (
                <Circle
                  key={`arc-${r.key}`}
                  cx={center}
                  cy={center}
                  r={r.radius}
                  stroke={`url(#ringGrad-${r.key})`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${r.circumference} ${r.circumference}`}
                  strokeDashoffset={r.strokeDashoffset}
                  strokeLinecap="round"
                  fill="none"
                />
              ))}
            </G>
          </Svg>

          {/* Center Activity Icon */}
          <View style={[styles.centerAura, { width: 44, height: 44, borderRadius: 22 }]}>
            <Ionicons name="shield-checkmark" size={20} color="#00E599" />
          </View>
        </View>

        {/* Legend & Telemetry Metrics Column */}
        <View style={styles.metricsColumn}>
          {ringConfigs.map((r) => (
            <View key={`metric-${r.key}`} style={styles.metricItem}>
              <View style={[styles.colorBar, { backgroundColor: r.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.metricLabel, { color: isDark ? '#A0AEC0' : '#4A5568' }]}>
                  {r.label}
                </Text>
                <View style={styles.valueRow}>
                  <Text style={[styles.metricValue, { color: isDark ? '#FFFFFF' : '#1A202C' }]}>
                    {typeof r.value === 'number' && !Number.isInteger(r.value)
                      ? r.value.toFixed(1)
                      : r.value}{' '}
                    <Text style={[styles.metricUnit, { color: isDark ? '#718096' : '#A0AEC0' }]}>
                      {r.unit}
                    </Text>
                  </Text>
                  <View style={[styles.pctPill, { backgroundColor: `${r.color}20` }]}>
                    <Text style={[styles.pctText, { color: r.color }]}>{r.pct}%</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
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
  summaryBadge: {
    backgroundColor: 'rgba(0, 229, 153, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 153, 0.25)',
  },
  summaryBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00E599',
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
  centerAura: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  metricsColumn: {
    flex: 1,
    gap: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorBar: {
    width: 4,
    height: 28,
    borderRadius: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '600',
  },
  pctPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pctText: {
    fontSize: 9.5,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});

export default ConcentricActivityRings;
