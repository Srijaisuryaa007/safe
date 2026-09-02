import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
      filter: drop-shadow(0 0 20px rgba(212, 175, 55, 0.4));
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://cdn.jsdelivr.net/npm/topojson-client@3"></script>
</head>
<body>
  <canvas id="globeCanvas"></canvas>
  <script>
    (function() {
      const canvas = document.getElementById('globeCanvas');
      const context = canvas.getContext('2d');
      const size = ${size};
      const radius = size / 2.52;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = size * dpr;
      canvas.height = size * dpr;
      context.scale(dpr, dpr);

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([size / 2, size / 2])
        .clipAngle(90);

      const path = d3.geoPath().projection(projection).context(context);

      let landGeo = null;
      let countryDots = [];

      // High-density world country point sampling grid
      function buildCountryDots(features) {
        const dots = [];
        const step = 4.5; // Fine resolution for realistic Earth continents & countries

        for (let lng = -180; lng <= 180; lng += step) {
          for (let lat = -85; lat <= 85; lat += step) {
            const pt = [lng, lat];
            if (d3.geoContains(features, pt)) {
              dots.push(pt);
            }
          }
        }
        return dots;
      }

      function render() {
        context.clearRect(0, 0, size, size);
        const currentScale = projection.scale();
        const scaleFactor = currentScale / radius;

        // 1. Deep Midnight Ocean Base
        context.beginPath();
        context.arc(size / 2, size / 2, currentScale, 0, 2 * Math.PI);
        context.fillStyle = '#0B0D10';
        context.fill();

        // 2. Outer Atmospheric Gold Ring
        context.strokeStyle = '#D4AF37';
        context.lineWidth = 1.6 * scaleFactor;
        context.globalAlpha = 0.7;
        context.stroke();
        context.globalAlpha = 1.0;

        // 3. Coordinate Graticule (Latitude & Longitude parallels)
        const graticule = d3.geoGraticule().step([20, 20]);
        context.beginPath();
        path(graticule());
        context.strokeStyle = '#A16207';
        context.lineWidth = 0.5 * scaleFactor;
        context.globalAlpha = 0.16;
        context.stroke();
        context.globalAlpha = 1.0;

        if (landGeo) {
          // 4. Continent Land Mass Fill (Subtle Charcoal-Gold)
          context.beginPath();
          path(landGeo);
          context.fillStyle = '#14171E';
          context.globalAlpha = 0.9;
          context.fill();
          context.globalAlpha = 1.0;

          // 5. Authentic Continent Coastlines & Country Boundaries
          context.beginPath();
          path(landGeo);
          context.strokeStyle = '#D4AF37';
          context.lineWidth = 0.85 * scaleFactor;
          context.globalAlpha = 0.65;
          context.stroke();
          context.globalAlpha = 1.0;

          // 6. Geographic Country Dots (Glow on Land Only)
          countryDots.forEach(function(pt) {
            const coords = projection(pt);
            if (coords && coords[0] >= 0 && coords[0] <= size && coords[1] >= 0 && coords[1] <= size) {
              context.beginPath();
              context.arc(coords[0], coords[1], 0.95 * scaleFactor, 0, 2 * Math.PI);
              context.fillStyle = '#F59E0B';
              context.globalAlpha = 0.85;
              context.fill();
            }
          });
          context.globalAlpha = 1.0;
        }
      }

      // Load authentic 110m TopoJSON world geography
      fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json')
        .then(function(res) { return res.json(); })
        .then(function(world) {
          landGeo = topojson.feature(world, world.objects.land);
          countryDots = buildCountryDots(landGeo);
          render();
        })
        .catch(function() {
          // Backup fallback to natural earth geojson
          fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json')
            .then(function(res) { return res.json(); })
            .then(function(geo) {
              landGeo = geo;
              countryDots = buildCountryDots(geo);
              render();
            })
            .catch(function() {});
        });

      // Smooth auto-rotation with realistic axial tilt
      let rotation = [0, -18]; // 18 degree Earth axial tilt
      const rotationSpeed = 0.75;

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
  size = 190,
  loadingLabel = 'Securing your Circle…',
  subLabel,
  fullscreen = false,
}: CircleGuardGlobeLoaderProps) {
  const { colors, isDark } = useThemeStore();
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
      -1,
      false
    );
  }, []);

  const radarRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 0.35, 1], [0.85, 0.35, 0]),
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [0.92, 1.42]) }],
  }));

  const content = (
    <View style={styles.contentContainer}>
      {/* Globe Container */}
      <View style={[styles.globeWrapper, { width: size + 24, height: size + 24 }]}>
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

        {/* 3D Realistic Earth Globe */}
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
    paddingVertical: 20,
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
    borderColor: '#D4AF37',
  },
  canvasBox: {
    overflow: 'hidden',
    backgroundColor: '#0B0D10',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.45)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
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
