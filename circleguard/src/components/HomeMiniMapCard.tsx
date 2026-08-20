import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '../store/useThemeStore';
import { CircleMember } from '../store/useCircleStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HomeMiniMapCardProps {
  members: CircleMember[];
  userLoc: { latitude: number; longitude: number } | null;
  activeCircleName?: string;
}

export default function HomeMiniMapCard({
  members,
  userLoc,
  activeCircleName,
}: HomeMiniMapCardProps) {
  const { colors, isDark } = useThemeStore();
  const navigation = useNavigation<any>();
  const webViewRef = useRef<WebView | null>(null);

  const centerLat = userLoc?.latitude || (members[0]?.latitude) || 20.5937;
  const centerLng = userLoc?.longitude || (members[0]?.longitude) || 78.9629;

  const pushMapData = () => {
    if (!webViewRef.current) return;

    const memberPins = members.map((m, idx) => {
      let lat = m.latitude || 0;
      let lng = m.longitude || 0;

      if (!lat || !lng || lat === 0 || lng === 0) {
        const baseLat = userLoc?.latitude || 20.5937;
        const baseLng = userLoc?.longitude || 78.9629;
        const angle = (idx * (360 / Math.max(1, members.length))) * (Math.PI / 180);
        lat = baseLat + 0.0015 * Math.cos(angle);
        lng = baseLng + 0.0015 * Math.sin(angle);
      }

      const roleColor = m.role === 'owner' ? '#D4AF37' : (m.role === 'co_leader' ? '#A855F7' : (m.role === 'guardian' ? '#3B82F6' : '#10B981'));
      const name = m.profile?.full_name || 'Member';

      return {
        id: m.user_id,
        lat,
        lng,
        name,
        initial: name.charAt(0).toUpperCase(),
        avatarUrl: m.profile?.avatar_url || null,
        roleColor,
        isOnline: m.isOnline ?? true,
      };
    });

    const data = {
      isDark,
      center: [centerLat, centerLng],
      members: memberPins,
    };

    const js = `
      if (window.updateHomeMiniMap) {
        window.updateHomeMiniMap(${JSON.stringify(data)});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  };

  useEffect(() => {
    pushMapData();
  }, [members, userLoc, isDark]);

  const miniMapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        html, body, #map { width:100%; height:100%; background:${isDark ? '#0D0E12' : '#F4F4F5'}; overflow:hidden; }
        .leaflet-control-attribution, .leaflet-control-zoom { display:none !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          touchZoom: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false
        }).setView([${centerLat}, ${centerLng}], 15);

        var tileUrl = '${isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}';
        L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);

        var markers = {};

        window.updateHomeMiniMap = function(data) {
          if (!data) return;

          Object.keys(markers).forEach(function(k) {
            map.removeLayer(markers[k]);
          });
          markers = {};

          var bounds = [];

          if (data.members) {
            data.members.forEach(function(m) {
              bounds.push([m.lat, m.lng]);
              var avatarHtml = m.avatarUrl
                ? '<img src="' + m.avatarUrl + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />'
                : '<span style="color:#FFF;font-size:10px;font-weight:bold;">' + m.initial + '</span>';

              var icon = L.divIcon({
                className: 'mini-avatar-icon',
                html: '<div style="position:relative;width:28px;height:28px;border-radius:50%;background:#1A1A1A;border:2px solid ' + m.roleColor + ';display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px ' + m.roleColor + '99;">' + avatarHtml + '</div>',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
              });

              markers[m.id] = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
            });
          }

          if (bounds.length > 0) {
            try {
              map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
            } catch(e) {}
          } else if (data.center) {
            map.setView(data.center, 15);
          }
        };

        // Initial trigger
        setTimeout(function() {
          window.updateHomeMiniMap(${JSON.stringify({ isDark, center: [centerLat, centerLng], members: members.map((m, idx) => {
            let lat = m.latitude || 0;
            let lng = m.longitude || 0;
            if (!lat || !lng || lat === 0 || lng === 0) {
              const baseLat = userLoc?.latitude || 20.5937;
              const baseLng = userLoc?.longitude || 78.9629;
              const angle = (idx * (360 / Math.max(1, members.length))) * (Math.PI / 180);
              lat = baseLat + 0.0015 * Math.cos(angle);
              lng = baseLng + 0.0015 * Math.sin(angle);
            }
            return {
              id: m.user_id,
              lat,
              lng,
              name: m.profile?.full_name || 'Member',
              initial: (m.profile?.full_name || 'M').charAt(0).toUpperCase(),
              avatarUrl: m.profile?.avatar_url || null,
              roleColor: m.role === 'owner' ? '#D4AF37' : (m.role === 'co_leader' ? '#A855F7' : (m.role === 'guardian' ? '#3B82F6' : '#10B981')),
              isOnline: m.isOnline ?? true,
            };
          }) })});
        }, 200);
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.cardWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.livePulseDot, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>LIVE RADAR MINI MAP</Text>
        </View>
        <TouchableOpacity
          style={[styles.expandBtn, { backgroundColor: `${colors.accentGold}15`, borderColor: colors.accentGold }]}
          onPress={() => navigation.navigate('Map')}
          activeOpacity={0.7}
        >
          <Text style={[styles.expandBtnText, { color: colors.accentGold }]}>FULL MAP</Text>
          <Ionicons name="arrow-forward" size={11} color={colors.accentGold} />
        </TouchableOpacity>
      </View>

      {/* Mini Map Container */}
      <TouchableOpacity
        style={styles.mapContainer}
        onPress={() => navigation.navigate('Map')}
        activeOpacity={0.9}
      >
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: miniMapHtml }}
          style={styles.webview}
          onLoadEnd={pushMapData}
          pointerEvents="none"
        />

        {/* Floating Tap Hint Overlay */}
        <View style={[styles.tapOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}>
          <Ionicons name="map-outline" size={13} color="#FFFFFF" />
          <Text style={styles.tapOverlayText}>
            {members.length} {members.length === 1 ? 'member' : 'members'} live on radar • Tap to interact
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  expandBtnText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mapContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  webview: {
    width: '100%',
    height: '100%',
  },
  tapOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  tapOverlayText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
});
