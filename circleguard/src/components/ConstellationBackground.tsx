import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Dimensions, Animated, Easing } from 'react-native';
import Svg, { Circle, Line, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useThemeStore } from '../store/useThemeStore';

interface ConstellationBackgroundProps {
  opacity?: number;
  particleCount?: number;
  maxDistance?: number;
  accentColor?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 18 Hand-tuned harmoniously distributed celestial star nodes
const STAR_NODES = [
  { id: 1, xPct: 0.12, yPct: 0.10, radius: 3.5, dx: 18, dy: -14, duration: 6500, delay: 0 },
  { id: 2, xPct: 0.38, yPct: 0.08, radius: 4.2, dx: -20, dy: 16, duration: 7200, delay: 400 },
  { id: 3, xPct: 0.82, yPct: 0.14, radius: 4.8, dx: 16, dy: 22, duration: 8000, delay: 800 },
  { id: 4, xPct: 0.62, yPct: 0.22, radius: 3.2, dx: -15, dy: -18, duration: 6800, delay: 200 },
  { id: 5, xPct: 0.22, yPct: 0.28, radius: 4.5, dx: 22, dy: 14, duration: 7500, delay: 600 },
  { id: 6, xPct: 0.08, yPct: 0.42, radius: 3.8, dx: -18, dy: -20, duration: 7100, delay: 1000 },
  { id: 7, xPct: 0.44, yPct: 0.38, radius: 5.2, dx: 14, dy: 18, duration: 8200, delay: 300 },
  { id: 8, xPct: 0.88, yPct: 0.36, radius: 3.6, dx: -22, dy: 12, duration: 6900, delay: 700 },
  { id: 9, xPct: 0.72, yPct: 0.52, radius: 4.6, dx: 18, dy: -16, duration: 7700, delay: 500 },
  { id: 10, xPct: 0.28, yPct: 0.58, radius: 3.4, dx: -14, dy: 20, duration: 7300, delay: 900 },
  { id: 11, xPct: 0.14, yPct: 0.70, radius: 4.8, dx: 20, dy: -14, duration: 7900, delay: 150 },
  { id: 12, xPct: 0.52, yPct: 0.68, radius: 3.8, dx: -18, dy: -18, duration: 7000, delay: 650 },
  { id: 13, xPct: 0.84, yPct: 0.72, radius: 5.0, dx: 16, dy: 22, duration: 8300, delay: 450 },
  { id: 14, xPct: 0.36, yPct: 0.82, radius: 4.0, dx: -22, dy: 14, duration: 7400, delay: 850 },
  { id: 15, xPct: 0.68, yPct: 0.88, radius: 4.4, dx: 18, dy: -20, duration: 7600, delay: 250 },
  { id: 16, xPct: 0.18, yPct: 0.92, radius: 3.6, dx: -16, dy: 16, duration: 6700, delay: 550 },
  { id: 17, xPct: 0.90, yPct: 0.94, radius: 4.2, dx: 14, dy: -18, duration: 8100, delay: 350 },
  { id: 18, xPct: 0.50, yPct: 0.18, radius: 3.0, dx: -12, dy: 15, duration: 6400, delay: 750 },
];

// Constellation connection bonds between neighbor stars
const CONSTELLATION_BONDS = [
  [0, 1], [1, 3], [3, 2], [1, 4], [4, 5], [4, 6], [6, 3], [6, 7], [7, 8],
  [6, 9], [9, 10], [9, 11], [11, 8], [8, 12], [10, 13], [11, 13], [11, 14],
  [12, 14], [13, 15], [14, 16], [0, 4], [2, 7], [13, 14], [1, 17], [17, 3]
];

function FloatingStarNode({
  node,
  screenWidth,
  screenHeight,
  goldColor,
  coreColor,
}: {
  node: typeof STAR_NODES[0];
  screenWidth: number;
  screenHeight: number;
  goldColor: string;
  coreColor: string;
}) {
  const animX = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    // Silky Smooth Harmonic Lissajous Drift on Native UI Thread (0 JS Re-renders)
    const driftXLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(animX, {
          toValue: node.dx,
          duration: node.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(animX, {
          toValue: -node.dx,
          duration: node.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(animX, {
          toValue: 0,
          duration: node.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const driftYLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(animY, {
          toValue: node.dy,
          duration: node.duration * 1.15,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(animY, {
          toValue: -node.dy,
          duration: node.duration * 1.15,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(animY, {
          toValue: 0,
          duration: node.duration * 1.15,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2200 + (node.id % 4) * 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 2200 + (node.id % 4) * 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const timeout = setTimeout(() => {
      driftXLoop.start();
      driftYLoop.start();
      pulseLoop.start();
    }, node.delay);

    return () => {
      clearTimeout(timeout);
      driftXLoop.stop();
      driftYLoop.stop();
      pulseLoop.stop();
    };
  }, []);

  const posX = node.xPct * screenWidth;
  const posY = node.yPct * screenHeight;
  const haloSize = node.radius * 6;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: posX - haloSize / 2,
        top: posY - haloSize / 2,
        width: haloSize,
        height: haloSize,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: pulseAnim,
        transform: [{ translateX: animX }, { translateY: animY }],
      }}
      pointerEvents="none"
    >
      {/* Outer Radiant Glowing Halo */}
      <View
        style={{
          position: 'absolute',
          width: haloSize,
          height: haloSize,
          borderRadius: haloSize / 2,
          backgroundColor: goldColor,
          opacity: 0.16,
        }}
      />
      {/* Mid Glowing Ring */}
      <View
        style={{
          position: 'absolute',
          width: node.radius * 3.4,
          height: node.radius * 3.4,
          borderRadius: (node.radius * 3.4) / 2,
          backgroundColor: goldColor,
          opacity: 0.38,
        }}
      />
      {/* Bright Core Star */}
      <View
        style={{
          width: node.radius * 1.8,
          height: node.radius * 1.8,
          borderRadius: (node.radius * 1.8) / 2,
          backgroundColor: coreColor,
          shadowColor: goldColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 6,
          elevation: 4,
        }}
      />
    </Animated.View>
  );
}

export default function ConstellationBackground({
  opacity = 0.45,
  accentColor,
}: ConstellationBackgroundProps) {
  const { isDark } = useThemeStore();
  const canvasRef = useRef<any>(null);
  const pulseGlobal = useRef(new Animated.Value(0.7)).current;

  const width = SCREEN_WIDTH || 400;
  const height = SCREEN_HEIGHT || 800;

  const goldColor = accentColor || (isDark ? '#F5D061' : '#D4AF37');
  const coreColor = isDark ? '#FFF9E6' : '#996515';

  useEffect(() => {
    // Breathing opacity for constellation lines
    const linePulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseGlobal, {
          toValue: 0.95,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseGlobal, {
          toValue: 0.5,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    linePulse.start();
    return () => linePulse.stop();
  }, []);

  // 1. Direct Web GPU Canvas (120 FPS hardware-accelerated)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animId: number;
      let w = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth || width);
      let h = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight || height);

      const resizeHandler = () => {
        if (!canvas || !canvas.parentElement) return;
        w = canvas.width = canvas.parentElement.clientWidth || window.innerWidth;
        h = canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
      };
      window.addEventListener('resize', resizeHandler);

      let t = 0;
      const draw = () => {
        ctx.clearRect(0, 0, w, h);
        t += 0.008;

        const currentNodes = STAR_NODES.map((n) => {
          const px = n.xPct * w + Math.sin(t * (6000 / n.duration) + n.id) * n.dx;
          const py = n.yPct * h + Math.cos(t * (6000 / n.duration) * 1.15 + n.id) * n.dy;
          return { ...n, px, py };
        });

        // Draw Lines
        ctx.lineWidth = 1;
        CONSTELLATION_BONDS.forEach(([i, j]) => {
          const n1 = currentNodes[i];
          const n2 = currentNodes[j];
          if (!n1 || !n2) return;
          const lineAlpha = (0.28 + Math.sin(t * 1.8 + i) * 0.12);
          ctx.strokeStyle = isDark ? `rgba(245, 208, 97, ${lineAlpha})` : `rgba(212, 175, 55, ${lineAlpha})`;
          ctx.beginPath();
          ctx.moveTo(n1.px, n1.py);
          ctx.lineTo(n2.px, n2.py);
          ctx.stroke();
        });

        // Draw Stars & Glowing Halos
        currentNodes.forEach((n) => {
          // Halo
          ctx.fillStyle = isDark ? 'rgba(245, 208, 97, 0.18)' : 'rgba(212, 175, 55, 0.16)';
          ctx.beginPath();
          ctx.arc(n.px, n.py, n.radius * 3.4, 0, Math.PI * 2);
          ctx.fill();

          // Mid
          ctx.fillStyle = isDark ? 'rgba(245, 208, 97, 0.42)' : 'rgba(212, 175, 55, 0.38)';
          ctx.beginPath();
          ctx.arc(n.px, n.py, n.radius * 1.7, 0, Math.PI * 2);
          ctx.fill();

          // Core
          ctx.fillStyle = isDark ? '#FFF9E6' : '#8A6318';
          ctx.beginPath();
          ctx.arc(n.px, n.py, n.radius, 0, Math.PI * 2);
          ctx.fill();
        });

        animId = requestAnimationFrame(draw);
      };

      draw();

      return () => {
        window.removeEventListener('resize', resizeHandler);
        cancelAnimationFrame(animId);
      };
    }
  }, [isDark, width, height]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { opacity }]} pointerEvents="none">
        {/* @ts-ignore */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            display: 'block',
          }}
        />
      </View>
    );
  }

  // 2. Native Mobile Hardware-Accelerated UI-Thread Animation (0 JS Overhead)
  return (
    <View style={[styles.container, { opacity }]} pointerEvents="none">
      {/* Constellation Connection Web Lines */}
      <Animated.View style={[styles.fill, { opacity: pulseGlobal }]}>
        <Svg width="100%" height="100%" style={styles.fill} pointerEvents="none">
          <G>
            {CONSTELLATION_BONDS.map(([i, j], idx) => {
              const n1 = STAR_NODES[i];
              const n2 = STAR_NODES[j];
              if (!n1 || !n2) return null;
              return (
                <Line
                  key={`bond-${idx}`}
                  x1={n1.xPct * width}
                  y1={n1.yPct * height}
                  x2={n2.xPct * width}
                  y2={n2.yPct * height}
                  stroke={goldColor}
                  strokeOpacity={0.42}
                  strokeWidth={1}
                />
              );
            })}
          </G>
        </Svg>
      </Animated.View>

      {/* Floating Harmonic Star Nodes */}
      {STAR_NODES.map((node) => (
        <FloatingStarNode
          key={`star-${node.id}`}
          node={node}
          screenWidth={width}
          screenHeight={height}
          goldColor={goldColor}
          coreColor={coreColor}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
