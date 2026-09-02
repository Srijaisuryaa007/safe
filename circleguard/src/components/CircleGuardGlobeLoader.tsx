import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useThemeStore } from '../store/useThemeStore';

interface CircleGuardGlobeLoaderProps {
  size?: number;
  loadingLabel?: string;
  subLabel?: string;
  fullscreen?: boolean;
}

const GLOBE_HTML = (size: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: transparent;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
    }
    #globeCanvas {
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      filter: drop-shadow(0 0 16px rgba(161, 98, 7, 0.45));
    }
  </style>
  <script src="https://d3js.org/d3.v7.min.js"></script>
</head>
<body>
  <canvas id="globeCanvas"></canvas>
  <script>
    (function() {
      const canvas = document.getElementById('globeCanvas');
      const context = canvas.getContext('2d');
      const size = ${size};
      const radius = size / 2.55;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = size * dpr;
      canvas.height = size * dpr;
      context.scale(dpr, dpr);

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([size / 2, size / 2])
        .clipAngle(90);

      const path = d3.geoPath().projection(projection).context(context);

      let landFeatures = null;
      let allDots = [];

      // Fallback synthetic land dots generator in case offline
      function generateFallbackWorldDots() {
        const dots = [];
        // Approximate continent centers & landmass clusters
        const continents = [
          // Americas
          { minLng: -130, maxLng: -60, minLat: 10, maxLat: 60, step: 8 },
          { minLng: -80, maxLng: -35, minLat: -55, maxLat: 10, step: 8 },
          // Europe & Africa
          { minLng: -10, maxLng: 40, minLat: 35, maxLat: 70, step: 7 },
          { minLng: -15, maxLng: 50, minLat: -35, maxLat: 35, step: 8 },
          // Asia & Australia
          { minLng: 40, maxLng: 140, minLat: 10, maxLat: 70, step: 7 },
          { minLng: 110, maxLng: 155, minLat: -40, maxLat: -10, step: 8 },
        ];

        continents.forEach(c => {
          for (let lng = c.minLng; lng <= c.maxLng; lng += c.step) {
            for (let lat = c.minLat; lat <= c.maxLat; lat += c.step) {
              if (Math.sin(lng * 0.05) * Math.cos(lat * 0.05) > -0.3) {
                dots.push({ lng, lat });
              }
            }
          }
        });
        return dots;
      }

      allDots = generateFallbackWorldDots();

      function render() {
        context.clearRect(0, 0, size, size);
        const currentScale = projection.scale();
        const scaleFactor = currentScale / radius;

        // Globe base — near black
        context.beginPath();
        context.arc(size / 2, size / 2, currentScale, 0, 2 * Math.PI);
        context.fillStyle = '#0B0D10';
        context.fill();
        context.strokeStyle = '#A16207';
        context.lineWidth = 1.5 * scaleFactor;
        context.globalAlpha = 0.65;
        context.stroke();
        context.globalAlpha = 1;

        // Graticule grid — faint gold
        const graticule = d3.geoGraticule();
        context.beginPath();
        path(graticule());
        context.strokeStyle = '#A16207';
        context.lineWidth = 0.5 * scaleFactor;
        context.globalAlpha = 0.18;
        context.stroke();
        context.globalAlpha = 1;

        if (landFeatures) {
          context.beginPath();
          landFeatures.features.forEach(function(feature) { path(feature); });
          context.strokeStyle = '#A16207';
          context.lineWidth = 0.8 * scaleFactor;
          context.globalAlpha = 0.55;
          context.stroke();
          context.globalAlpha = 1;
        }

        // Golden land dots
        allDots.forEach(function(dot) {
          const projected = projection([dot.lng, dot.lat]);
          if (
            projected &&
            projected[0] >= 0 && projected[0] <= size &&
            projected[1] >= 0 && projected[1] <= size
          ) {
            context.beginPath();
            context.arc(projected[0], projected[1], 1.2 * scaleFactor, 0, 2 * Math.PI);
            context.fillStyle = '#D4AF37';
            context.fill();
          }
        });
      }

      // Fetch official 110m land polygons
      fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          landFeatures = data;
          render();
        })
        .catch(function() {});

      // Continuous 3D rotation with tilt
      let rotation = [0, 15];
      const rotationSpeed = 0.85;

      function rotate() {
        rotation[0] += rotationSpeed;
        projection.rotate(rotation);
        render();
        requestAnimationFrame(rotate);
      }

      rotate();
    })();
  </script>
</body>
</html>
`;

export default function CircleGuardGlobeLoader({
  size = 180, // Medium balanced size for mobile screens and tabs
  loadingLabel = 'Securing your Circle',
  subLabel,
  fullscreen = false,
}: CircleGuardGlobeLoaderProps) {
  const { colors, isDark } = useThemeStore();
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
      -1,
      false
    );
  }, []);

  const radarRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 0.4, 1], [0.8, 0.3, 0]),
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [0.85, 1.45]) }],
  }));

  const content = (
    <View style={styles.contentContainer}>
      {/* Globe Canvas Container */}
      <View style={[styles.globeWrapper, { width: size + 20, height: size + 20 }]}>
        {/* Pulsing Outer Radar Ring */}
        <Animated.View
          style={[
            styles.radarRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
            radarRingStyle,
          ]}
        />

        {/* 3D Rotating Globe in WebView */}
        <View style={[styles.canvasBox, { width: size, height: size, borderRadius: size / 2 }]}>
          <WebView
            originWhitelist={['*']}
            source={{ html: GLOBE_HTML(size) }}
            style={styles.webView}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
          />
        </View>
      </View>

      {/* Brand & Loading Labels */}
      <View style={styles.textStack}>
        <Text style={styles.brandTitle}>CIRCLE GUARD</Text>
        <Text style={[styles.loadingLabel, { color: colors.textMuted || '#94A3B8' }]}>
          {loadingLabel}
        </Text>
        {subLabel ? (
          <Text style={[styles.subLabel, { color: colors.textMuted || '#64748B' }]}>
            {subLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (fullscreen) {
    return (
      <View style={[styles.fullscreenContainer, { backgroundColor: isDark ? '#0B0D10' : '#111317' }]}>
        {content}
      </View>
    );
  }

  return <View style={styles.inlineContainer}>{content}</View>;
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  inlineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  globeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#A16207',
  },
  canvasBox: {
    overflow: 'hidden',
    backgroundColor: '#0B0D10',
    borderWidth: 1,
    borderColor: 'rgba(161, 98, 7, 0.4)',
    shadowColor: '#A16207',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  webView: {
    backgroundColor: 'transparent',
    width: '100%',
    height: '100%',
  },
  textStack: {
    alignItems: 'center',
    gap: 4,
  },
  brandTitle: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3.5,
    textTransform: 'uppercase',
  },
  loadingLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 2,
  },
});
