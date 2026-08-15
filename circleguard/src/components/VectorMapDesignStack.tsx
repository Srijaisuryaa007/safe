import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

interface VectorMapDesignStackProps {
  onBack?: () => void;
  userLocation?: { latitude: number; longitude: number };
}

export default function VectorMapDesignStack({ onBack, userLocation }: VectorMapDesignStackProps) {
  // Active screen step: 1 (Landing), 2 (Move the map), 3 (Location Details)
  const [currentScreen, setCurrentScreen] = useState<1 | 2 | 3>(1);
  const [addressInput, setAddressInput] = useState('');

  const lat = userLocation?.latitude || 13.0827;
  const lng = userLocation?.longitude || 80.2707;

  // Leaflet HTML string for circular crop map
  const circleMapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; background: #1E1A3A; overflow: hidden; }
          #map { width: 100vw; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], 15);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

          var coralPinSvg = '<div style="filter: drop-shadow(0 6px 10px rgba(255,83,106,0.6));">' +
            '<svg width="36" height="46" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M19 0C8.5 0 0 8.5 0 19C0 32.3 19 48 19 48C19 48 38 32.3 38 19C38 8.5 29.5 0 19 0Z" fill="#FF536A"/>' +
              '<ellipse cx="19" cy="19" rx="7" ry="7" fill="#FFFFFF"/>' +
            '</svg>' +
          '</div>';
          var coralIcon = L.divIcon({ className: 'pin', html: coralPinSvg, iconSize: [36, 46], iconAnchor: [18, 46] });
          L.marker([${lat}, ${lng}], { icon: coralIcon }).addTo(map);

          var bluePinSvg = '<div style="filter: drop-shadow(0 6px 10px rgba(212, 175, 55,0.6));">' +
            '<svg width="32" height="42" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M19 0C8.5 0 0 8.5 0 19C0 32.3 19 48 19 48C19 48 38 32.3 38 19C38 8.5 29.5 0 19 0Z" fill="#D4AF37"/>' +
              '<ellipse cx="19" cy="19" rx="7" ry="7" fill="#FFFFFF"/>' +
            '</svg>' +
          '</div>';
          var blueIcon = L.divIcon({ className: 'pin', html: bluePinSvg, iconSize: [32, 42], iconAnchor: [16, 42] });
          L.marker([${lat + 0.003}, ${lng + 0.003}], { icon: blueIcon }).addTo(map);

          var goldPinSvg = '<div style="filter: drop-shadow(0 6px 10px rgba(255,184,0,0.6));">' +
            '<svg width="32" height="42" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M19 0C8.5 0 0 8.5 0 19C0 32.3 19 48 19 48C19 48 38 32.3 38 19C38 8.5 29.5 0 19 0Z" fill="#FFB800"/>' +
              '<ellipse cx="19" cy="19" rx="7" ry="7" fill="#FFFFFF"/>' +
            '</svg>' +
          '</div>';
          var goldIcon = L.divIcon({ className: 'pin', html: goldPinSvg, iconSize: [32, 42], iconAnchor: [16, 42] });
          L.marker([${lat - 0.003}, ${lng - 0.003}], { icon: goldIcon }).addTo(map);
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.outerContainer}>
      {/* Top Demo Screen Switcher Pills */}
      <View style={styles.topSwitcherBar}>
        <TouchableOpacity
          style={[styles.switcherPill, currentScreen === 1 && styles.switcherPillActive]}
          onPress={() => setCurrentScreen(1)}
        >
          <Text style={[styles.switcherPillText, currentScreen === 1 && styles.switcherPillTextActive]}>1. LANDING</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switcherPill, currentScreen === 2 && styles.switcherPillActive]}
          onPress={() => setCurrentScreen(2)}
        >
          <Text style={[styles.switcherPillText, currentScreen === 2 && styles.switcherPillTextActive]}>2. MOVE MAP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switcherPill, currentScreen === 3 && styles.switcherPillActive]}
          onPress={() => setCurrentScreen(3)}
        >
          <Text style={[styles.switcherPillText, currentScreen === 3 && styles.switcherPillTextActive]}>3. LOCATION</Text>
        </TouchableOpacity>
      </View>

      {/* Screen 1: Landing / Welcome UI */}
      {currentScreen === 1 && (
        <View style={styles.screenBody}>
          {/* Status Bar Dummy */}
          <View style={styles.statusBarRow}>
            <Text style={styles.statusTime}>4:29</Text>
            <View style={styles.statusIconsRow}>
              <Ionicons name="cellular" size={14} color="#1E1B4B" />
              <Ionicons name="wifi" size={14} color="#1E1B4B" />
              <Ionicons name="battery-full" size={16} color="#1E1B4B" />
            </View>
          </View>

          {/* Large Circular Map Hero Frame */}
          <View style={styles.circleFrameWrapper}>
            <View style={styles.circleFrameInner}>
              <WebView
                originWhitelist={['*']}
                source={{ html: circleMapHtml }}
                style={{ flex: 1 }}
                scrollEnabled={false}
              />
            </View>
          </View>

          {/* Title & Subtitle */}
          <View style={styles.titleBlock}>
            <Text style={styles.mainAppTitle}>MAP APP</Text>
            <Text style={styles.subAppTitle}>search locations</Text>
          </View>

          {/* Coral Red Action Pill Button "FIND!" */}
          <TouchableOpacity
            style={styles.coralFindBtn}
            onPress={() => setCurrentScreen(2)}
            activeOpacity={0.85}
          >
            <Text style={styles.coralFindBtnText}>FIND!</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Screen 2: Move the Map Search UI */}
      {currentScreen === 2 && (
        <View style={styles.screenBody}>
          {/* Header */}
          <View style={styles.screenHeader}>
            <TouchableOpacity style={styles.headerBackBtn} onPress={() => setCurrentScreen(1)}>
              <Ionicons name="chevron-back" size={22} color="#1E1B4B" />
            </TouchableOpacity>
            <Text style={styles.screenHeaderTitle}>Move the map</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Full Center Viewport 3D Map */}
          <View style={styles.fullMapViewport}>
            <WebView
              originWhitelist={['*']}
              source={{ html: circleMapHtml }}
              style={{ flex: 1 }}
            />
          </View>

          {/* Bottom Floating Address Search Card */}
          <View style={styles.bottomSearchCard}>
            <View style={styles.addressPillInputWrap}>
              <TextInput
                style={styles.addressPillInput}
                placeholder="or enter address"
                placeholderTextColor="#A0A5C0"
                value={addressInput}
                onChangeText={setAddressInput}
              />
            </View>

            <TouchableOpacity
              style={styles.blueFindBtn}
              onPress={() => setCurrentScreen(3)}
              activeOpacity={0.85}
            >
              <Text style={styles.blueFindBtnText}>Find!</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Screen 3: Location Details UI */}
      {currentScreen === 3 && (
        <View style={styles.screenBody}>
          {/* Header */}
          <View style={styles.screenHeader}>
            <TouchableOpacity style={styles.headerBackBtn} onPress={() => setCurrentScreen(2)}>
              <Ionicons name="chevron-back" size={22} color="#1E1B4B" />
            </TouchableOpacity>
            <Text style={styles.screenHeaderTitle}>Location</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Hero Circular Frame with Overlapping Circle Thumbnail */}
          <View style={styles.locationCircleContainer}>
            {/* Main Circular Building/Map Frame */}
            <View style={styles.mainCircleFrame}>
              <WebView
                originWhitelist={['*']}
                source={{ html: circleMapHtml }}
                style={{ flex: 1 }}
                scrollEnabled={false}
              />
            </View>

            {/* Overlapping Smaller Circle Thumbnail */}
            <View style={styles.overlappingCircleThumbnail}>
              <WebView
                originWhitelist={['*']}
                source={{ html: circleMapHtml }}
                style={{ flex: 1 }}
                scrollEnabled={false}
              />
            </View>
          </View>

          {/* Royal Blue "Details" Pill Button */}
          <TouchableOpacity
            style={styles.blueDetailsBtn}
            onPress={() => setCurrentScreen(1)}
            activeOpacity={0.85}
          >
            <Text style={styles.blueDetailsBtnText}>Details</Text>
          </TouchableOpacity>

          {/* Bottom Soft Lavender User/Location Detail Card */}
          <View style={styles.bottomDetailCard}>
            <View style={styles.avatarYellowCircle}>
              <Ionicons name="person" size={22} color="#FFFFFF" />
            </View>

            <View style={styles.detailCardTextCol}>
              <View style={styles.dashedLineLong} />
              <View style={styles.dashedLineShort} />

              {/* Coral Red Stars */}
              <View style={styles.ratingStarsRow}>
                <Ionicons name="star" size={14} color="#FF536A" />
                <Ionicons name="star" size={14} color="#FF536A" />
                <Ionicons name="star" size={14} color="#FF536A" />
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#F4F5FB',
  },
  topSwitcherBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 46,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55,0.1)',
  },
  switcherPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EEF0F9',
  },
  switcherPillActive: {
    backgroundColor: '#D4AF37',
  },
  switcherPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.8,
  },
  switcherPillTextActive: {
    color: '#FFFFFF',
  },
  screenBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 34,
  },
  statusBarRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  statusTime: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  statusIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleFrameWrapper: {
    width: 270,
    height: 270,
    borderRadius: 135,
    overflow: 'hidden',
    backgroundColor: '#1E1A3A',
    elevation: 8,
    shadowColor: '#1E1A3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    marginTop: 10,
  },
  circleFrameInner: {
    width: '100%',
    height: '100%',
  },
  titleBlock: {
    alignItems: 'center',
    marginVertical: 10,
  },
  mainAppTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#1E1B4B',
  },
  subAppTitle: {
    fontSize: 13,
    letterSpacing: 3,
    color: '#8A8FB9',
    marginTop: 4,
  },
  coralFindBtn: {
    backgroundColor: '#FF536A',
    width: 190,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#FF536A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  coralFindBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  screenHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  screenHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  fullMapViewport: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  bottomSearchCard: {
    width: '90%',
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginTop: 10,
  },
  addressPillInputWrap: {
    width: '100%',
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF0F9',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  addressPillInput: {
    fontSize: 13,
    color: '#1E1B4B',
    textAlign: 'center',
  },
  blueFindBtn: {
    backgroundColor: '#D4AF37',
    width: 140,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  blueFindBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  locationCircleContainer: {
    alignItems: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  mainCircleFrame: {
    width: 260,
    height: 260,
    borderRadius: 130,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    elevation: 8,
  },
  overlappingCircleThumbnail: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    position: 'absolute',
    bottom: -20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  blueDetailsBtn: {
    backgroundColor: '#D4AF37',
    width: 160,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    elevation: 5,
  },
  blueDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  bottomDetailCard: {
    width: '88%',
    backgroundColor: '#EAEBF8',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarYellowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFD56B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailCardTextCol: {
    flex: 1,
    gap: 6,
  },
  dashedLineLong: {
    width: '80%',
    height: 4,
    backgroundColor: '#C5C9E5',
    borderRadius: 2,
  },
  dashedLineShort: {
    width: '50%',
    height: 4,
    backgroundColor: '#D6DAF0',
    borderRadius: 2,
  },
  ratingStarsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
});
