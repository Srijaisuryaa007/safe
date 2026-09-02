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
      filter: drop-shadow(0 0 24px rgba(212, 175, 55, 0.45));
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
      const radius = size / 2.5;
      const cx = size / 2;
      const cy = size / 2;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = size * dpr;
      canvas.height = size * dpr;
      context.scale(dpr, dpr);

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .clipAngle(90);

      const path = d3.geoPath().projection(projection).context(context);

      let landGeo = null;
      let countriesGeo = null;
      let countryDots = [];

      // Major World Metropolises & Safety Beacons (Lat/Lng)
      const majorHubs = [
        { name: 'London', lat: 51.5074, lng: -0.1278 },
        { name: 'Paris', lat: 48.8566, lng: 2.3522 },
        { name: 'New York', lat: 40.7128, lng: -74.0060 },
        { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
        { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
        { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
        { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
        { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
        { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
        { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
        { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
        { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
        { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
        { name: 'Berlin', lat: 52.5200, lng: 13.4050 },
        { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
        { name: 'Seoul', lat: 37.5665, lng: 126.9780 },
      ];

      // High-precision country-fill sampling matrix
      function buildCountryDots(features) {
        const dots = [];
        const step = 3.8; // Dense sampling so countries are filled realistically

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

      let pulseTick = 0;

      function render() {
        context.clearRect(0, 0, size, size);
        const currentScale = projection.scale();
        const scaleFactor = currentScale / radius;

        // 1. Deep Midnight Spherical Ocean Base
        const oceanGrad = context.createRadialGradient(
          cx - radius * 0.35, cy - radius * 0.35, radius * 0.1,
          cx, cy, currentScale
        );
        oceanGrad.addColorStop(0, '#0F1318');
        oceanGrad.addColorStop(0.7, '#080A0D');
        oceanGrad.addColorStop(1, '#040507');

        context.beginPath();
        context.arc(cx, cy, currentScale, 0, 2 * Math.PI);
        context.fillStyle = oceanGrad;
        context.fill();

        // 2. Globe Sphere Border Ring
        context.strokeStyle = '#D4AF37';
        context.lineWidth = 1.6 * scaleFactor;
        context.globalAlpha = 0.85;
        context.stroke();
        context.globalAlpha = 1.0;

        // 3. Coordinate Graticule (Parallels & Meridians)
        const graticule = d3.geoGraticule().step([20, 20]);
        context.beginPath();
        path(graticule());
        context.strokeStyle = '#A16207';
        context.lineWidth = 0.5 * scaleFactor;
        context.globalAlpha = 0.18;
        context.stroke();
        context.globalAlpha = 1.0;

        if (landGeo) {
          // 4. Continent Shaded Landmass (Deep Obsidian Green)
          context.beginPath();
          path(landGeo);
          context.fillStyle = '#131B16';
          context.globalAlpha = 0.95;
          context.fill();
          context.globalAlpha = 1.0;

          // 5. Individual Country Borders (Fine Gold Wireframe)
          if (countriesGeo) {
            context.beginPath();
            path(countriesGeo);
            context.strokeStyle = '#D4AF37';
            context.lineWidth = 0.55 * scaleFactor;
            context.globalAlpha = 0.45;
            context.stroke();
            context.globalAlpha = 1.0;
          }

          // 6. Prominent Continent & Island Coastlines
          context.beginPath();
          path(landGeo);
          context.strokeStyle = '#F3E5AB';
          context.lineWidth = 1.1 * scaleFactor;
          context.globalAlpha = 0.8;
          context.stroke();
          context.globalAlpha = 1.0;

          // 7. Geographic Country Matrix Dots with 3D Spherical Light Attenuation
          countryDots.forEach(function(pt) {
            const coords = projection(pt);
            if (coords && coords[0] >= 0 && coords[0] <= size && coords[1] >= 0 && coords[1] <= size) {
              const dx = coords[0] - cx;
              const dy = coords[1] - cy;
              const distFromCenter = Math.sqrt(dx * dx + dy * dy);
              const sphereFactor = Math.max(0.2, 1 - (distFromCenter / currentScale) * 0.7);

              context.beginPath();
              context.arc(coords[0], coords[1], 1.1 * scaleFactor * sphereFactor, 0, 2 * Math.PI);
              context.fillStyle = '#F59E0B';
              context.globalAlpha = 0.75 * sphereFactor;
              context.fill();
            }
          });
          context.globalAlpha = 1.0;

          // 8. Major Capital & City Safety Beacons (Pulsing Beacons)
          const beaconSize = (1 + Math.sin(pulseTick) * 0.35) * scaleFactor;
          majorHubs.forEach(function(hub) {
            const coords = projection([hub.lng, hub.lat]);
            if (coords && coords[0] >= 0 && coords[0] <= size && coords[1] >= 0 && coords[1] <= size) {
              // Pulse Halo
              context.beginPath();
              context.arc(coords[0], coords[1], 3.5 * beaconSize, 0, 2 * Math.PI);
              context.fillStyle = '#F59E0B';
              context.globalAlpha = 0.25;
              context.fill();

              // Solid Center Pin
              context.beginPath();
              context.arc(coords[0], coords[1], 1.6 * scaleFactor, 0, 2 * Math.PI);
              context.fillStyle = '#FFFBEB';
              context.globalAlpha = 0.95;
              context.fill();
            }
          });
          context.globalAlpha = 1.0;
        }

        // 9. Spherical 3D Shading Overlay (Light Specular on top-left, Shadow on bottom-right)
        const shadowGrad = context.createRadialGradient(
          cx - radius * 0.4, cy - radius * 0.4, radius * 0.2,
          cx, cy, currentScale
        );
        shadowGrad.addColorStop(0, 'rgba(243, 229, 171, 0.12)');
        shadowGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');

        context.beginPath();
        context.arc(cx, cy, currentScale, 0, 2 * Math.PI);
        context.fillStyle = shadowGrad;
        context.fill();
      }

      // Load official 110m world countries & landmass TopoJSON
      fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
        .then(function(res) { return res.json(); })
        .then(function(world) {
          landGeo = topojson.feature(world, world.objects.land);
          countriesGeo = topojson.feature(world, world.objects.countries);
          countryDots = buildCountryDots(landGeo);
          render();
        })
        .catch(function() {
          // Backup fallback
          fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json')
            .then(function(res) { return res.json(); })
            .then(function(world) {
              landGeo = topojson.feature(world, world.objects.land);
              countryDots = buildCountryDots(landGeo);
              render();
            })
            .catch(function() {});
        });

      // Smooth realistic Earth rotation with 18 degree axial tilt
      let rotation = [0, -18];
      const rotationSpeed = 0.75;

      function rotate() {
        rotation[0] += rotationSpeed;
        pulseTick += 0.06;
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
  size = 195,
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
