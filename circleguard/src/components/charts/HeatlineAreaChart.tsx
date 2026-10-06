import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  Animated,
  Platform,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Circle,
  G,
  Text as SvgText,
} from 'react-native-svg';
import * as d3 from 'd3';

export interface TelemetryPoint {
  index?: number;
  time?: string | Date;
  speed: number; // km/h
  distanceKm?: number;
  isHardBrake?: boolean;
  isRapidAccel?: boolean;
  isSpeeding?: boolean;
  lat?: number;
  lng?: number;
}

export interface HeatlineAreaChartProps {
  data: TelemetryPoint[];
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showMarkers?: boolean;
  speedLimitKmh?: number;
  onScrub?: (point: TelemetryPoint | null, index: number | null) => void;
  accentColor?: string;
  isDark?: boolean;
  title?: string;
  unit?: string;
}

export const HeatlineAreaChart: React.FC<HeatlineAreaChartProps> = ({
  data = [],
  height = 180,
  showGrid = true,
  showTooltip = true,
  showMarkers = true,
  speedLimitKmh = 60,
  onScrub,
  accentColor = '#00E599',
  isDark = true,
  title = 'SPEED PROFILE & HEATLINE',
  unit = 'km/h',
}) => {
  const [containerWidth, setContainerWidth] = useState<number>(320);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const padding = { top: 22, right: 18, bottom: 28, left: 36 };

  // Fallback synthetic data if empty
  const chartData = useMemo(() => {
    if (data && data.length > 1) {
      return data;
    }
    // Generate smooth preview trajectory
    const dummy: TelemetryPoint[] = [];
    const count = 20;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      // smooth curve with a couple of peaks
      const baseSpeed = 24 + Math.sin(t * Math.PI) * 28 + Math.sin(t * 4 * Math.PI) * 10;
      dummy.push({
        index: i,
        time: `${Math.floor(i * 2)}m`,
        speed: Math.max(0, Math.round(baseSpeed)),
        isHardBrake: i === 12,
        isSpeeding: baseSpeed > 58,
      });
    }
    return dummy;
  }, [data]);

  const innerWidth = Math.max(10, containerWidth - padding.left - padding.right);
  const innerHeight = Math.max(10, height - padding.top - padding.bottom);

  // Scales
  const { xScale, yScale, maxSpeed, minSpeed } = useMemo(() => {
    const speeds = chartData.map((d) => d.speed);
    const rawMax = Math.max(...speeds, speedLimitKmh || 40);
    const max = Math.ceil((rawMax * 1.15) / 10) * 10; // round up to multiple of 10
    const min = 0;

    const x = d3
      .scaleLinear()
      .domain([0, chartData.length - 1])
      .range([padding.left, padding.left + innerWidth]);

    const y = d3
      .scaleLinear()
      .domain([min, max])
      .range([padding.top + innerHeight, padding.top]);

    return { xScale: x, yScale: y, maxSpeed: max, minSpeed: min };
  }, [chartData, innerWidth, innerHeight, speedLimitKmh, padding.left, padding.top]);

  // D3 Area & Line Generators
  const { areaPath, linePath } = useMemo(() => {
    if (chartData.length < 2) return { areaPath: '', linePath: '' };

    const areaGen = d3
      .area<TelemetryPoint>()
      .x((_, i) => xScale(i))
      .y0(padding.top + innerHeight)
      .y1((d) => yScale(d.speed))
      .curve(d3.curveMonotoneX);

    const lineGen = d3
      .line<TelemetryPoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.speed))
      .curve(d3.curveMonotoneX);

    return {
      areaPath: areaGen(chartData) || '',
      linePath: lineGen(chartData) || '',
    };
  }, [chartData, xScale, yScale, innerHeight, padding.top]);

  // Key event markers (Hard Brake, Rapid Accel, Peak Speed)
  const markers = useMemo(() => {
    if (!showMarkers || chartData.length < 2) return [];

    let peakIdx = 0;
    let maxVal = -1;
    chartData.forEach((pt, i) => {
      if (pt.speed > maxVal) {
        maxVal = pt.speed;
        peakIdx = i;
      }
    });

    const list: {
      index: number;
      x: number;
      y: number;
      type: 'peak' | 'brake' | 'accel' | 'speeding';
      label: string;
      color: string;
    }[] = [];

    // Add peak marker
    if (maxVal > 15) {
      list.push({
        index: peakIdx,
        x: xScale(peakIdx),
        y: yScale(chartData[peakIdx].speed),
        type: 'peak',
        label: `${Math.round(maxVal)} ${unit}`,
        color: maxVal >= speedLimitKmh ? '#FF3B30' : '#00E599',
      });
    }

    chartData.forEach((pt, i) => {
      if (pt.isHardBrake && i !== peakIdx) {
        list.push({
          index: i,
          x: xScale(i),
          y: yScale(pt.speed),
          type: 'brake',
          label: 'Hard Brake',
          color: '#FF453A',
        });
      } else if (pt.isRapidAccel && i !== peakIdx) {
        list.push({
          index: i,
          x: xScale(i),
          y: yScale(pt.speed),
          type: 'accel',
          label: 'Rapid Accel',
          color: '#FFB800',
        });
      }
    });

    return list;
  }, [chartData, showMarkers, xScale, yScale, speedLimitKmh, unit]);

  // Grid tick lines
  const yTicks = useMemo(() => {
    const step = maxSpeed <= 50 ? 10 : maxSpeed <= 100 ? 25 : 50;
    const ticks: number[] = [];
    for (let v = 0; v <= maxSpeed; v += step) {
      ticks.push(v);
    }
    return ticks;
  }, [maxSpeed]);

  const xTicks = useMemo(() => {
    if (chartData.length < 2) return [];
    const count = 4;
    const indices: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i * (chartData.length - 1)) / (count - 1));
      indices.push(idx);
    }
    return indices;
  }, [chartData]);

  // Touch gesture handler for scrubbing
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          handleTouch(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => {
          handleTouch(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          // keep selected or auto-dismiss
        },
        onPanResponderTerminate: () => {},
      }),
    [innerWidth, chartData, xScale]
  );

  const handleTouch = (touchX: number) => {
    if (chartData.length < 2) return;
    const clampedX = Math.max(padding.left, Math.min(padding.left + innerWidth, touchX));
    // Invert X scale
    const relProgress = (clampedX - padding.left) / innerWidth;
    const rawIndex = Math.round(relProgress * (chartData.length - 1));
    const safeIndex = Math.max(0, Math.min(chartData.length - 1, rawIndex));

    setActiveIndex(safeIndex);
    if (onScrub) {
      onScrub(chartData[safeIndex], safeIndex);
    }
  };

  const activePoint = activeIndex !== null ? chartData[activeIndex] : null;
  const activeX = activeIndex !== null ? xScale(activeIndex) : 0;
  const activeY = activePoint ? yScale(activePoint.speed) : 0;

  // Active point heatline color
  const activeColor = useMemo(() => {
    if (!activePoint) return accentColor;
    if (activePoint.speed >= speedLimitKmh) return '#FF3B30';
    if (activePoint.speed >= speedLimitKmh * 0.75) return '#FFB800';
    return '#00E599';
  }, [activePoint, speedLimitKmh, accentColor]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 2) {
      setContainerWidth(w);
    }
  };

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
      {...panResponder.panHandlers}
    >
      {/* Chart Header Bar */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrapper}>
          <View style={[styles.titleDot, { backgroundColor: activeColor }]} />
          <Text style={[styles.headerTitle, { color: isDark ? '#A0AEC0' : '#4A5568' }]}>
            {title}
          </Text>
        </View>

        {activePoint ? (
          <View style={styles.liveStatPill}>
            <Text style={[styles.liveSpeedValue, { color: activeColor }]}>
              {activePoint.speed} <Text style={styles.liveSpeedUnit}>{unit}</Text>
            </Text>
            {activePoint.time ? (
              <Text style={styles.liveTimePill}>
                {typeof activePoint.time === 'string'
                  ? activePoint.time
                  : activePoint.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.statsSummaryPill}>
            <Text style={[styles.summaryMaxLabel, { color: isDark ? '#718096' : '#A0AEC0' }]}>
              PEAK <Text style={{ color: isDark ? '#E2E8F0' : '#1A202C', fontWeight: '800' }}>{Math.round(maxSpeed)} {unit}</Text>
            </Text>
          </View>
        )}
      </View>

      {/* SVG Canvas */}
      <Svg width={containerWidth} height={height}>
        <Defs>
          {/* Vertical Area Gradient */}
          <LinearGradient id="heatlineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={accentColor} stopOpacity={0.38} />
            <Stop offset="55%" stopColor={accentColor} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={accentColor} stopOpacity={0.0} />
          </LinearGradient>

          {/* Stroke Line Heat Gradient */}
          <LinearGradient id="speedStrokeGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#00E599" />
            <Stop offset="50%" stopColor="#38E8FF" />
            <Stop offset="80%" stopColor="#FFB800" />
            <Stop offset="100%" stopColor="#FF3B30" />
          </LinearGradient>

          {/* Speed Limit Dash Pattern */}
          <LinearGradient id="speedLimitGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="rgba(255, 59, 48, 0.4)" />
            <Stop offset="100%" stopColor="rgba(255, 59, 48, 0.7)" />
          </LinearGradient>
        </Defs>

        {/* Horizontal Grid lines */}
        {showGrid &&
          yTicks.map((tickVal) => {
            const y = yScale(tickVal);
            return (
              <G key={`ytick-${tickVal}`}>
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
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill={isDark ? '#4A5568' : '#A0AEC0'}
                  fontSize={9}
                  fontWeight="600"
                >
                  {tickVal}
                </SvgText>
              </G>
            );
          })}

        {/* Speed Limit Guideline (if applicable) */}
        {speedLimitKmh > 0 && speedLimitKmh < maxSpeed && (
          <G>
            <Line
              x1={padding.left}
              y1={yScale(speedLimitKmh)}
              x2={padding.left + innerWidth}
              y2={yScale(speedLimitKmh)}
              stroke="rgba(255, 59, 48, 0.45)"
              strokeWidth={1}
              strokeDasharray="6,3"
            />
            <SvgText
              x={padding.left + innerWidth - 2}
              y={yScale(speedLimitKmh) - 4}
              textAnchor="end"
              fill="rgba(255, 59, 48, 0.75)"
              fontSize={8.5}
              fontWeight="700"
            >
              LIMIT {speedLimitKmh}
            </SvgText>
          </G>
        )}

        {/* Area Path */}
        {areaPath ? <Path d={areaPath} fill="url(#heatlineAreaGrad)" /> : null}

        {/* Heatline Stroke Path */}
        {linePath ? (
          <Path
            d={linePath}
            fill="none"
            stroke="url(#speedStrokeGrad)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Milestone Markers */}
        {markers.map((m, idx) => (
          <G key={`marker-${idx}`}>
            {/* Outer halo */}
            <Circle cx={m.x} cy={m.y} r={7} fill={m.color} fillOpacity={0.25} />
            {/* Center dot */}
            <Circle cx={m.x} cy={m.y} r={3.5} fill="#FFFFFF" stroke={m.color} strokeWidth={2} />
          </G>
        ))}

        {/* Interactive Scrub Crosshair & Dot */}
        {activePoint && (
          <G>
            {/* Vertical crosshair */}
            <Line
              x1={activeX}
              y1={padding.top}
              x2={activeX}
              y2={padding.top + innerHeight}
              stroke={activeColor}
              strokeWidth={1.5}
              strokeDasharray="3,3"
              strokeOpacity={0.8}
            />

            {/* Glowing active indicator on curve */}
            <Circle cx={activeX} cy={activeY} r={8} fill={activeColor} fillOpacity={0.25} />
            <Circle cx={activeX} cy={activeY} r={4.5} fill={activeColor} stroke="#FFFFFF" strokeWidth={2} />
          </G>
        )}

        {/* X-Axis Labels */}
        {xTicks.map((dataIdx) => {
          const pt = chartData[dataIdx];
          if (!pt) return null;
          const x = xScale(dataIdx);
          const label = pt.time
            ? typeof pt.time === 'string'
              ? pt.time
              : pt.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : `${dataIdx} pt`;

          return (
            <SvgText
              key={`xtick-${dataIdx}`}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fill={isDark ? '#4A5568' : '#718096'}
              fontSize={9}
              fontWeight="600"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Floating Scrub Instruction Pill */}
      {activeIndex === null && (
        <View style={styles.hintFooter}>
          <Text style={[styles.hintText, { color: isDark ? '#4A5568' : '#A0AEC0' }]}>
            Slide thumb along chart to inspect road speed & map location
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 12,
    marginVertical: 10,
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
    marginBottom: 4,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  liveStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 6,
  },
  liveSpeedValue: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  liveSpeedUnit: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  liveTimePill: {
    fontSize: 10,
    fontWeight: '700',
    color: '#CBD5E0',
  },
  statsSummaryPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  summaryMaxLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hintFooter: {
    alignItems: 'center',
    marginTop: -2,
  },
  hintText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default HeatlineAreaChart;
