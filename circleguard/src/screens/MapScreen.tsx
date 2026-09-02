import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, TextInput, Linking, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore, Place } from '../store/useCircleStore';
import AlertModal from '../components/AlertModal';
import AddPlaceModal from '../components/AddPlaceModal';
import SearchFilterModal from '../components/SearchFilterModal';
import MapLayerModal, { MapStyleType } from '../components/MapLayerModal';
import SpringTouchable from '../components/SpringTouchable';
import { 
  LUXURY_THEME, 
  getThemeCardStyles, 
  getThemeButtonStyles, 
  getThemeBadgeStyles, 
  getThemeBorderStyles, 
  getThemeSheetStyles, 
  getThemeFloatingControlStyles 
} from '../constants/theme';
import { evaluateGeofenceBreaches } from '../services/GeofenceEngine';
import { fetchCategoryPois, generateFallbackPois } from '../services/PoiService';
import LuxuryRadarLoading from '../components/LuxuryRadarLoading';
import { useThemeStore } from '../store/useThemeStore';
import { queueAndSyncLocationHistory, flushOfflineBreadcrumbs } from '../services/OfflineLocationQueueService';
import { useLuxuryAlert } from '../components/LuxuryAlertModal';
import { scheduleLocalNotification } from '../services/PushNotificationService';
import { calculateDijkstraRouteBetweenUsers, fetchDrivingDistance, fetchMultipleDrivingRoutes, DrivingRouteOption } from '../services/RoadRoutingService';

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseEWKBPoint(hex: string): { latitude: number; longitude: number } | null {
  try {
    if (typeof hex !== 'string') return null;
    const cleanHex = hex.trim();
    if (cleanHex.length >= 40) {
      const isLittleEndian = cleanHex.startsWith('0101') || cleanHex.startsWith('01');
      let offset = cleanHex.length >= 50 ? 18 : (cleanHex.length >= 42 ? 10 : 2);

      const lngHex = cleanHex.substr(offset, 16);
      const latHex = cleanHex.substr(offset + 16, 16);

      if (lngHex.length < 16 || latHex.length < 16) return null;

      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);

      const parseHexDouble = (hexStr: string) => {
        for (let i = 0; i < 8; i++) {
          const byte = parseInt(hexStr.substr(i * 2, 2), 16);
          view.setUint8(isLittleEndian ? i : 7 - i, byte);
        }
        return view.getFloat64(0, isLittleEndian);
      };

      const lng = parseHexDouble(lngHex);
      const lat = parseHexDouble(latHex);

      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
        return { latitude: lat, longitude: lng };
      }
    }
  } catch (e) {
    console.error('EWKB parse error:', e);
  }
  return null;
}

function parseLocationPoint(item: any): { latitude: number; longitude: number } {
  if (!item) return { latitude: 0, longitude: 0 };

  const directLat = parseFloat(item.latitude ?? item.start_lat ?? item.lat);
  const directLng = parseFloat(item.longitude ?? item.start_lng ?? item.lng);

  if (!isNaN(directLat) && !isNaN(directLng) && Math.abs(directLat) <= 90 && Math.abs(directLng) <= 180 && (directLat !== 0 || directLng !== 0)) {
    return { latitude: directLat, longitude: directLng };
  }

  let lat = 0;
  let lng = 0;

  if (item.geom) {
    if (typeof item.geom === 'string') {
      const clean = item.geom.trim();
      if (clean.startsWith('01') || clean.startsWith('00')) {
        const parsed = parseEWKBPoint(clean);
        if (parsed) {
          lat = parsed.latitude;
          lng = parsed.longitude;
        }
      } else {
        const matches = clean.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
        if (matches && matches.length >= 3) {
          const val1 = parseFloat(matches[1]);
          const val2 = parseFloat(matches[2]);
          if (Math.abs(val1) > 90) {
            lng = val1;
            lat = val2;
          } else if (Math.abs(val2) > 90) {
            lat = val1;
            lng = val2;
          } else {
            lng = val1;
            lat = val2;
          }
        }
      }
    } else if (typeof item.geom === 'object') {
      if (Array.isArray(item.geom.coordinates) && item.geom.coordinates.length >= 2) {
        const c0 = parseFloat(item.geom.coordinates[0]);
        const c1 = parseFloat(item.geom.coordinates[1]);
        if (Math.abs(c0) > 90) {
          lng = c0;
          lat = c1;
        } else if (Math.abs(c1) > 90) {
          lat = c0;
          lng = c1;
        } else {
          lng = c0;
          lat = c1;
        }
      } else if (item.geom.latitude && item.geom.longitude) {
        lat = parseFloat(item.geom.latitude);
        lng = parseFloat(item.geom.longitude);
      }
    }
  }

  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    const temp = lat;
    lat = lng;
    lng = temp;
  }

  if (isNaN(lat) || isNaN(lng)) {
    return { latitude: 0, longitude: 0 };
  }

  return { latitude: lat, longitude: lng };
}

const LEAFLET_HTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #F9F8F6; }
      .leaflet-control-attribution { display: none !important; }
      .custom-icon, .leaflet-div-icon { background: transparent !important; border: none !important; }
      
      .leaflet-marker-icon, .leaflet-marker-shadow {
        transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1) !important;
      }
      
      .member-avatar-online {
        background: #1A1A1A; color: #10B981; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-family: sans-serif; border: 2px solid #10B981;
        box-shadow: 0 4px 14px rgba(16,185,129,0.45);
      }
      .member-avatar-offline {
        background: #374151; color: #D1D5DB; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-family: sans-serif; border: 2px solid #9CA3AF;
        opacity: 0.85;
      }
      
      /* Dedicated Live Self Marker Styles */
      .self-live-container {
        position: relative;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .self-pulse-wave {
        position: absolute;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: rgba(212, 175, 55, 0.22);
        border: 2px solid #D4AF37;
        animation: selfPulseAnim 2s infinite ease-out;
        pointer-events: none;
      }
      @keyframes selfPulseAnim {
        0% { transform: scale(0.6); opacity: 1; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      .self-avatar-circle {
        position: relative;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #0D0E12;
        border: 2.5px solid #D4AF37;
        box-shadow: 0 0 16px rgba(212, 175, 55, 0.8), 0 4px 12px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
      }
      .self-heading-arrow {
        position: absolute;
        top: -8px;
        left: 50%;
        margin-left: -6px;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 10px solid #D4AF37;
        filter: drop-shadow(0 0 6px rgba(212,175,55,0.9));
        z-index: 15;
        transition: transform 0.2s linear;
      }
      
      .custom-poi-logo-icon {
        background: transparent !important;
        border: none !important;
      }
      .poi-badge-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.45));
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .poi-badge-container:hover, .poi-badge-container:active {
        transform: scale(1.18);
        z-index: 99999 !important;
      }
      .poi-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 9px;
        border-radius: 16px;
        color: #FFFFFF;
        font-size: 10px;
        font-weight: 900;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        letter-spacing: 0.4px;
        border: 1.5px solid rgba(255, 255, 255, 0.85);
        white-space: nowrap;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }
      .poi-arrow {
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        margin: -1px auto 0 auto;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      window.map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 15);
      var map = window.map;
      
      // Dedicated Layer Collections
      window.selfMarker = null;
      window.selfAccuracyCircle = null;
      window.memberMarkers = window.memberMarkers || {};
      var memberMarkers = window.memberMarkers;
      window.placeCircles = window.placeCircles || {};
      var placeCircles = window.placeCircles;
      window.poiMarkers = window.poiMarkers || {};
      var poiMarkers = window.poiMarkers;
      var hasRealCentered = false;

      var savedStyle = 'vector';
      try {
        savedStyle = window.localStorage.getItem('@circleguard_map_style') || 'vector';
      } catch(e) {}

      var tileUrls = {
        vector: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        standard: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        midnight: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
      };

      var initialTileUrl = tileUrls[savedStyle] || tileUrls.vector;
      if (savedStyle === 'satellite') {
        document.body.style.background = '#1C2E1E';
      } else if (savedStyle === 'dark' || savedStyle === 'midnight') {
        document.body.style.background = '#0D0E12';
      } else if (savedStyle === 'terrain') {
        document.body.style.background = '#2D281E';
      } else {
        document.body.style.background = '#F9F8F6';
      }

      var tileLayer = L.tileLayer(initialTileUrl, {
        maxZoom: 19,
        maxNativeZoom: 19,
        subdomains: 'abcd',
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 10,
        crossOrigin: true
      }).addTo(map);

      tileLayer.on('tileerror', function(error, tile) {
        if (tile && tile.src && !tile.src.includes('retry=1')) {
          tile.src = tile.src + (tile.src.includes('?') ? '&' : '?') + 'retry=1';
        }
      });

      window.changeTileUrl = function(url, style) {
        if (tileLayer) {
          tileLayer.setUrl(url);
          try { window.localStorage.setItem('@circleguard_map_style', style); } catch(e) {}
          if (style === 'satellite') {
            document.body.style.background = '#1C2E1E';
          } else if (style === 'dark' || style === 'midnight') {
            document.body.style.background = '#0D0E12';
          } else if (style === 'terrain') {
            document.body.style.background = '#2D281E';
          } else {
            document.body.style.background = '#F9F8F6';
          }
        }
      };

      function sendAppMessage(obj) {
        var msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(msg);
        } else if (window.parent && window.parent.postMessage) {
          window.parent.postMessage(msg, '*');
        }
      }

      try {
        sendAppMessage({ type: 'MAP_READY' });
      } catch(e) {}

      // REAL-TIME USER GPS GLIDE BRIDGE WITH JITTER SMOOTHING
      window.lastSelfPanLat = 0;
      window.lastSelfPanLng = 0;

      window.updateSelfLiveGPS = function(lat, lng, heading, speed, accuracy, isDriving, followMode, userName, avatarUrl) {
        if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

        // 1. Accuracy halo
        var accRadius = Math.max(10, Math.min(accuracy || 20, 150));
        if (window.selfAccuracyCircle) {
          window.selfAccuracyCircle.setLatLng([lat, lng]);
          window.selfAccuracyCircle.setRadius(accRadius);
        } else {
          window.selfAccuracyCircle = L.circle([lat, lng], {
            radius: accRadius,
            color: '#D4AF37',
            fillColor: '#D4AF37',
            fillOpacity: 0.12,
            weight: 1,
            dashArray: '3, 3'
          }).addTo(map);
        }

        // 2. Self Marker with rotating heading arrow & live speed badge
        var speedMps = speed || 0;
        var speedKmh = Math.round(speedMps * 3.6);
        var isMoving = speedMps >= 0.8;
        
        var speedText = isDriving ? ('Driving • ' + speedKmh + ' km/h') : (isMoving ? ('Walking • ' + speedKmh + ' km/h') : 'You (Live)');
        var headingStyle = (heading !== undefined && heading !== null && isMoving) 
          ? 'transform: rotate(' + heading + 'deg);' 
          : 'display:none;';

        var avatarContent = avatarUrl 
          ? '<img src="' + avatarUrl + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />' 
          : '<span style="color:#D4AF37;font-weight:900;font-size:12px;">YOU</span>';

        var selfHtml = '<div class="self-live-container">' +
          '<div class="self-pulse-wave"></div>' +
          '<div class="self-heading-arrow" style="' + headingStyle + '"></div>' +
          '<div style="position:absolute; bottom:44px; left:50%; transform:translateX(-50%); white-space:nowrap; background:rgba(22,24,31,0.95); color:#FFFFFF; font-size:10px; font-weight:800; font-family:sans-serif; padding:3px 8px; border-radius:10px; border:1px solid #D4AF37; box-shadow:0 4px 10px rgba(0,0,0,0.5); pointer-events:none; z-index:1000;">' +
            speedText +
          '</div>' +
          '<div class="self-avatar-circle">' + avatarContent + '</div>' +
          '</div>';

        var selfIcon = L.divIcon({
          className: 'custom-icon',
          html: selfHtml,
          iconSize: [50, 50],
          iconAnchor: [25, 25]
        });

        if (window.selfMarker) {
          window.selfMarker.setLatLng([lat, lng]);
          window.selfMarker.setIcon(selfIcon);
        } else {
          window.selfMarker = L.marker([lat, lng], { icon: selfIcon, zIndexOffset: 3500 }).addTo(map);
          window.selfMarker.on('click', function() {
            sendAppMessage({ type: 'SELF_CLICK', lat: lat, lng: lng });
          });
        }

        if (followMode) {
          // Camera pan deadband: avoid jerky panning for microscopic sub-3m GPS drift
          var dLat = Math.abs(lat - (window.lastSelfPanLat || 0));
          var dLng = Math.abs(lng - (window.lastSelfPanLng || 0));
          if (!window.lastSelfPanLat || dLat > 0.000035 || dLng > 0.000035) {
            window.lastSelfPanLat = lat;
            window.lastSelfPanLng = lng;
            map.panTo([lat, lng], { animate: true, duration: 0.5 });
          }
        }
      };

      function fetchOsrmRoute(originLng, originLat, destLng, destLat, callback) {
        var endpoints = [
          'https://router.project-osrm.org/route/v1/driving/',
          'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
        ];
        var coordStr = originLng.toFixed(6) + ',' + originLat.toFixed(6) + ';' + destLng.toFixed(6) + ',' + destLat.toFixed(6);
        
        function tryFetch(index) {
          if (index >= endpoints.length) {
            callback(null);
            return;
          }
          var url = endpoints[index] + coordStr + '?overview=full&geometries=geojson';
          var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 6000) : null;
          
          fetch(url, controller ? { signal: controller.signal } : {})
            .then(function(res) {
              if (timeoutId) clearTimeout(timeoutId);
              return res.json();
            })
            .then(function(json) {
              if (json && json.routes && json.routes.length > 0) {
                var coords = json.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
                callback(coords, json.routes[0].distance, json.routes[0].duration);
              } else {
                tryFetch(index + 1);
              }
            })
            .catch(function() {
              if (timeoutId) clearTimeout(timeoutId);
              tryFetch(index + 1);
            });
        }
        tryFetch(0);
      }

      window.cachedRoadRoutes = {};
      function fetchAndDrawRoadRoute(pId, startLatLng, endLatLng, polylineLayer) {
        if (!startLatLng || !endLatLng || !polylineLayer) return;
        var cacheKey = startLatLng[0].toFixed(4) + ',' + startLatLng[1].toFixed(4) + '_' + endLatLng[0].toFixed(4) + ',' + endLatLng[1].toFixed(4);
        if (window.cachedRoadRoutes[cacheKey]) {
          polylineLayer.setLatLngs(window.cachedRoadRoutes[cacheKey]);
          return;
        }

        fetchOsrmRoute(startLatLng[1], startLatLng[0], endLatLng[1], endLatLng[0], function(coords) {
          if (coords && coords.length > 0) {
            window.cachedRoadRoutes[cacheKey] = coords;
            if (polylineLayer) {
              polylineLayer.setLatLngs(coords);
            }
          }
        });
      }

      window.activeMemberRouteLayers = [];
      window.clearMemberRoute = function() {
        if (window.activeMemberRouteLayers && window.activeMemberRouteLayers.length > 0) {
          window.activeMemberRouteLayers.forEach(function(layer) {
            try { map.removeLayer(layer); } catch(e) {}
          });
          window.activeMemberRouteLayers = [];
        }
      };

      window.drawMultipleRoadRoutes = function(routes, activeIndex) {
        window.clearMemberRoute();
        if (!routes || !Array.isArray(routes) || routes.length === 0) return;

        var allLayers = [];
        var boundsGroup = [];

        // 1. Draw alternative / non-selected routes first (underneath active route)
        routes.forEach(function(r, idx) {
          if (idx === activeIndex || !r.roadCoords || r.roadCoords.length < 2) return;

          // Outer shadow casing for alternative route
          var altCasing = L.polyline(r.roadCoords, {
            color: '#1E293B',
            weight: 7,
            opacity: 0.65,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          // Inner dashed line for alternative route
          var altLine = L.polyline(r.roadCoords, {
            color: '#94A3B8',
            weight: 4.5,
            opacity: 0.95,
            dashArray: '7, 9',
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          var clickHandler = function() {
            sendAppMessage({ type: 'ROUTE_SELECTED', routeIndex: idx });
          };
          altCasing.on('click', clickHandler);
          altLine.on('click', clickHandler);

          allLayers.push(altCasing, altLine);
          boundsGroup.push(altLine);
        });

        // 2. Draw active / selected route on top with signature Google Maps highway styling
        var activeRoute = routes[activeIndex] || routes[0];
        if (activeRoute && activeRoute.roadCoords && activeRoute.roadCoords.length > 1) {
          var isFastest = activeRoute.tag === 'fastest' || activeIndex === 0;
          var mainColor = isFastest ? '#2563EB' : '#D97706';
          var casingColor = isFastest ? '#1E3A8A' : '#78350F';
          var pulseColor = isFastest ? '#93C5FD' : '#FDE68A';

          var casingLayer = L.polyline(activeRoute.roadCoords, {
            color: casingColor,
            weight: 8.5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          var mainLayer = L.polyline(activeRoute.roadCoords, {
            color: mainColor,
            weight: 5.5,
            opacity: 0.98,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          var dotsLayer = L.polyline(activeRoute.roadCoords, {
            color: pulseColor,
            weight: 2.2,
            opacity: 0.92,
            dashArray: '4, 10',
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);

          allLayers.push(casingLayer, mainLayer, dotsLayer);
          boundsGroup.push(mainLayer);
        }

        window.activeMemberRouteLayers = allLayers;

        if (boundsGroup.length > 0) {
          var fg = L.featureGroup(boundsGroup);
          map.fitBounds(fg.getBounds(), { padding: [80, 80], maxZoom: 16 });
        }
      };

      window.drawMemberDijkstraRoute = function(userLat, userLng, memLat, memLng) {
        if (!userLat || !userLng || !memLat || !memLng) return;
        fetchOsrmRoute(userLng, userLat, memLng, memLat, function(coords) {
          if (coords && coords.length > 0) {
            window.drawMultipleRoadRoutes([{ roadCoords: coords, tag: 'fastest', timeText: 'Live Route', distText: 'Direct' }], 0);
          }
        });
      };

      // DELETION HOOK: Instant removal of deleted zone layers
      window.deletePlaceLayer = function(placeId) {
        if (!placeId) return;
        var keys = ['circle_' + placeId, 'marker_' + placeId, placeId, 'start_' + placeId, 'end_' + placeId, 'line_' + placeId];
        keys.forEach(function(k) {
          if (placeCircles[k]) {
            try { map.removeLayer(placeCircles[k]); } catch(e) {}
            delete placeCircles[k];
          }
        });

        map.eachLayer(function(layer) {
          if (layer._placeId === placeId || (layer._placeKey && layer._placeKey.indexOf(placeId) !== -1)) {
            try { map.removeLayer(layer); } catch(e) {}
          }
        });
      };

      window.searchedLocationMarker = null;
      window.showSearchedPlace = function(lat, lng, name) {
        if (!lat || !lng) {
          if (window.searchedLocationMarker) {
            map.removeLayer(window.searchedLocationMarker);
            window.searchedLocationMarker = null;
          }
          return;
        }

        var shortName = name && name.length > 25 ? name.substring(0, 23) + '...' : (name || 'Searched Location');
        var html = '<div class="poi-badge-container">' +
          '<div class="poi-pill" style="background:linear-gradient(135deg, #D4AF37, #B45309); border:2px solid #FFFFFF; box-shadow:0 0 16px rgba(212,175,55,0.7);">' +
          '<span>' + shortName + '</span>' +
          '</div>' +
          '<div class="poi-arrow" style="border-top:6px solid #B45309;"></div>' +
          '</div>';

        var icon = L.divIcon({
          className: 'custom-poi-logo-icon',
          html: html,
          iconSize: [180, 48],
          iconAnchor: [90, 42]
        });

        if (window.searchedLocationMarker) {
          window.searchedLocationMarker.setLatLng([lat, lng]);
          window.searchedLocationMarker.setIcon(icon);
        } else {
          window.searchedLocationMarker = L.marker([lat, lng], { icon: icon, zIndexOffset: 2500 }).addTo(map);
        }
        map.setView([lat, lng], 16);
      };

      window.updateMapData = function(data) {
        if (!data) return;

        var targetStyle = data.mapStyle || savedStyle;
        if (targetStyle === 'satellite') {
          document.body.style.background = '#1C2E1E';
          tileLayer.setUrl(tileUrls.satellite);
          try { window.localStorage.setItem('@circleguard_map_style', 'satellite'); } catch(e) {}
        } else if (targetStyle === 'dark' || targetStyle === 'midnight') {
          document.body.style.background = '#0D0E12';
          tileLayer.setUrl(tileUrls.dark);
          try { window.localStorage.setItem('@circleguard_map_style', 'dark'); } catch(e) {}
        } else if (targetStyle === 'terrain') {
          document.body.style.background = '#2D281E';
          tileLayer.setUrl(tileUrls.terrain);
          try { window.localStorage.setItem('@circleguard_map_style', 'terrain'); } catch(e) {}
        } else if (targetStyle === 'vector') {
          document.body.style.background = '#F9F8F6';
          tileLayer.setUrl(tileUrls.vector);
          try { window.localStorage.setItem('@circleguard_map_style', 'vector'); } catch(e) {}
        }

        if (data.targetFocus) {
          map.setView([data.targetFocus[0], data.targetFocus[1]], data.targetFocus[2] || 17);
          hasRealCentered = true;
        } else if (data.userLocation && data.userLocation.latitude && data.userLocation.latitude !== 20.5937 && (!hasRealCentered || data.isFollowActive)) {
          map.setView([data.userLocation.latitude, data.userLocation.longitude], 16);
          hasRealCentered = true;
        } else if (!hasRealCentered && data.center && data.center[0] !== 20.5937) {
          map.setView(data.center, 15);
          hasRealCentered = true;
        }

        // 1. UPDATE CIRCLE MEMBERS
        if (data.members) {
          var currentMemberIds = {};

          data.members.forEach(function(m) {
            if (m.isSelf) {
              window.updateSelfLiveGPS(m.lat, m.lng, m.heading, m.speed, m.accuracy, m.isDriving, data.isFollowActive, m.name, m.avatarUrl);
              return;
            }

            currentMemberIds[m.id] = true;
            var mLatLng = [m.lat, m.lng];

            var avatarClass = m.isOnline ? 'member-avatar-online' : 'member-avatar-offline';
            var statusTag = m.isOnline ? ' (Online)' : ' (' + (m.lastSeenText || 'Offline') + ')';
            var avatarContent = m.avatarUrl
              ? '<img src="' + m.avatarUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
              : '<span style="color:#FFF;font-weight:bold;font-size:14px;">' + m.initial + '</span>';

            var roleColor = '#10B981';
            var roleBadgeSymbol = '';

            if (m.isGhost) {
              roleColor = '#A855F7';
              roleBadgeSymbol = '';
            } else if (m.role === 'owner') {
              roleColor = '#D4AF37';
            } else if (m.role === 'co_leader') {
              roleColor = '#A855F7';
            } else if (m.role === 'guardian') {
              roleColor = '#3B82F6';
            }

            var pulseStyle = m.isGhost
              ? 'border: 2.5px dashed #A855F7; box-shadow: 0 0 16px rgba(168,85,247,0.75); opacity: 0.88;'
              : (m.isOnline 
                ? 'border: 2.5px solid ' + roleColor + '; box-shadow: 0 0 16px ' + roleColor + 'CC;' 
                : 'border: 2px solid #9CA3AF; opacity: 0.85;');

            var batteryTag = m.batteryPct ? ' • ' + m.batteryPct + '%' : '';
            var activityTag = m.activityText ? ' • ' + m.activityText : '';
            var labelHtml = '<div style="position:absolute; bottom:44px; left:50%; transform:translateX(-50%); white-space:nowrap; background:rgba(22,24,31,0.95); color:#FFFFFF; font-size:10px; font-weight:bold; font-family:sans-serif; padding:4px 9px; border-radius:12px; border:1px solid ' + roleColor + '; box-shadow:0 4px 12px rgba(0,0,0,0.5); pointer-events:none; z-index:1000;">' + roleBadgeSymbol + m.name + activityTag + batteryTag + '</div>';

            var icon = L.divIcon({
              className: 'custom-icon',
              html: '<div style="position:relative; width:40px; height:40px;">' + labelHtml + '<div class="' + avatarClass + '" style="width:40px;height:40px;overflow:hidden;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1A1A1A;' + pulseStyle + '">' + avatarContent + '</div></div>',
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            });

            if (memberMarkers[m.id]) {
              memberMarkers[m.id].setLatLng(mLatLng);
              memberMarkers[m.id].setIcon(icon);
              memberMarkers[m.id].setPopupContent(m.name + statusTag);
            } else {
              memberMarkers[m.id] = L.marker(mLatLng, { icon: icon, zIndexOffset: 2000 }).addTo(map).bindPopup(m.name + statusTag);
              (function(memberId) {
                memberMarkers[memberId].on('click', function() {
                  sendAppMessage({ type: 'MEMBER_CLICK', memberId: memberId });
                });
              })(m.id);
            }
          });

          // Clean up old markers
          Object.keys(memberMarkers).forEach(function(id) {
            if (!currentMemberIds[id]) {
              try { map.removeLayer(memberMarkers[id]); } catch(e) {}
              delete memberMarkers[id];
            }
          });
        }

        // 2. UPDATE GEOFENCE PLACES & ZONES
        if (data.places) {
          var currentPlaceIds = {};
          data.places.forEach(function(p) {
            if (!p.lat || !p.lng || p.lat === 0 || p.lng === 0) return;
            var circleKey = 'circle_' + p.id;
            var markerKey = 'marker_' + p.id;
            currentPlaceIds[circleKey] = true;
            currentPlaceIds[markerKey] = true;

            var pLatLng = [p.lat, p.lng];

            // Resolve Category Theme Colors
            var cat = p.category || 'home';
            var zoneColor = '#D4AF37';
            
            if (cat === 'home') {
              zoneColor = '#10B981';
            } else if (cat === 'work') {
              zoneColor = '#3B82F6';
            } else if (cat === 'school') {
              zoneColor = '#F59E0B';
            } else if (cat === 'fitness' || cat === 'gym') {
              zoneColor = '#8B5CF6';
            } else if (cat === 'danger') {
              zoneColor = '#EF4444';
            }

            // A. Geofence Boundary Circle
            if (placeCircles[circleKey]) {
              placeCircles[circleKey].setLatLng(pLatLng);
              placeCircles[circleKey].setRadius(p.radius);
              placeCircles[circleKey].setStyle({
                color: zoneColor,
                fillColor: zoneColor,
                fillOpacity: 0.22,
                weight: 2.5
              });
            } else {
              var pCircle = L.circle(pLatLng, {
                radius: p.radius,
                color: zoneColor,
                fillColor: zoneColor,
                fillOpacity: 0.22,
                weight: 2.5
              }).addTo(map);

              pCircle._placeId = p.id;
              pCircle._placeKey = circleKey;
              placeCircles[circleKey] = pCircle;

              placeCircles[circleKey].on('click', function() {
                sendAppMessage({ type: 'PLACE_CLICK', placeId: p.id });
              });
            }

            // B. Center Badge
            var memberCountTag = p.assignedCount ? ' • ' + p.assignedCount + ' assigned' : '';
            var radiusTag = p.radius >= 1000 ? ((p.radius/1000).toFixed(1) + 'km') : (p.radius + 'm');
            var badgeHtml = '<div style="position:relative;display:flex;align-items:center;justify-content:center;transform:translate(-50%, -50%);background:rgba(22,24,31,0.92);color:#FFFFFF;border:1.5px solid ' + zoneColor + ';padding:4px 10px;border-radius:14px;box-shadow:0 4px 12px rgba(0,0,0,0.6);font-size:10.5px;font-weight:800;white-space:nowrap;font-family:sans-serif;cursor:pointer;">' +
              '<span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:' + zoneColor + ';margin-right:6px;"></span>' + p.name + ' (' + radiusTag + memberCountTag + ')' +
              '</div>';

            var badgeIcon = L.divIcon({
              className: 'custom-safezone-badge',
              html: badgeHtml,
              iconSize: [0, 0],
              iconAnchor: [0, 0]
            });

            if (placeCircles[markerKey]) {
              placeCircles[markerKey].setLatLng(pLatLng);
              placeCircles[markerKey].setIcon(badgeIcon);
            } else {
              var pMarker = L.marker(pLatLng, { icon: badgeIcon, zIndexOffset: 900 }).addTo(map);
              pMarker._placeId = p.id;
              pMarker._placeKey = markerKey;
              placeCircles[markerKey] = pMarker;

              placeCircles[markerKey].on('click', function() {
                sendAppMessage({ type: 'PLACE_CLICK', placeId: p.id });
              });
            }

            // C. Route Geofence Points
            if (p.endLat && p.endLng) {
              var startKey = 'start_' + p.id;
              var endKey = 'end_' + p.id;
              var lineKey = 'line_' + p.id;
              currentPlaceIds[startKey] = true;
              currentPlaceIds[endKey] = true;
              currentPlaceIds[lineKey] = true;

              var endLatLng = [p.endLat, p.endLng];

              if (placeCircles[startKey]) {
                placeCircles[startKey].setLatLng(pLatLng);
              } else {
                var sMarker = L.marker(pLatLng, {
                  icon: L.divIcon({ className: 'custom-icon', html: '<div style="background:#10B981;border:2px solid #FFF;border-radius:50%;width:16px;height:16px;box-shadow:0 0 10px rgba(16,185,129,0.9);"></div>', iconSize: [16, 16] })
                }).addTo(map);
                sMarker._placeId = p.id;
                sMarker._placeKey = startKey;
                placeCircles[startKey] = sMarker;
              }

              if (placeCircles[endKey]) {
                placeCircles[endKey].setLatLng(endLatLng);
              } else {
                var eMarker = L.marker(endLatLng, {
                  icon: L.divIcon({ className: 'custom-icon', html: '<div style="background:#EF4444;border:2px solid #FFF;border-radius:50%;width:16px;height:16px;box-shadow:0 0 10px rgba(239,68,68,0.9);"></div>', iconSize: [16, 16] })
                }).addTo(map);
                eMarker._placeId = p.id;
                eMarker._placeKey = endKey;
                placeCircles[endKey] = eMarker;
              }

              if (placeCircles[lineKey]) {
                fetchAndDrawRoadRoute(p.id, pLatLng, endLatLng, placeCircles[lineKey]);
              } else {
                var rPolyline = L.polyline([pLatLng, endLatLng], {
                  color: '#3B82F6',
                  weight: 4,
                  opacity: 0.85,
                  smoothFactor: 1.0,
                }).addTo(map);
                rPolyline._placeId = p.id;
                rPolyline._placeKey = lineKey;
                placeCircles[lineKey] = rPolyline;
                fetchAndDrawRoadRoute(p.id, pLatLng, endLatLng, rPolyline);
              }
            }
          });

          Object.keys(placeCircles).forEach(function(id) {
            if (!currentPlaceIds[id]) {
              try { map.removeLayer(placeCircles[id]); } catch(e) {}
              delete placeCircles[id];
            }
          });
        }

        // 3. UPDATE POIs
        if (data.pois) {
          var currentPoiIds = {};
          data.pois.forEach(function(p) {
            currentPoiIds[p.id] = true;
            var poiLatLng = [p.lat, p.lng];
            var poiLabel = p.name ? p.name.toUpperCase() : 'POI';
            var bgGradient = 'linear-gradient(135deg, #EF4444, #B91C1C)';
            var arrowColor = '#B91C1C';

            if (p.category === 'hospital') {
              poiLabel = p.name || 'HOSPITAL';
              bgGradient = 'linear-gradient(135deg, #EF4444, #DC2626)';
              arrowColor = '#DC2626';
            } else if (p.category === 'police') {
              poiLabel = p.name || 'POLICE';
              bgGradient = 'linear-gradient(135deg, #D4AF37, #B45309)';
              arrowColor = '#B45309';
            } else if (p.category === 'school') {
              poiLabel = p.name || 'SCHOOL';
              bgGradient = 'linear-gradient(135deg, #3B82F6, #2563EB)';
              arrowColor = '#2563EB';
            } else if (p.category === 'restaurant') {
              poiLabel = p.name || 'DINING';
              bgGradient = 'linear-gradient(135deg, #F59E0B, #D97706)';
              arrowColor = '#D97706';
            } else if (p.category === 'fuel') {
              poiLabel = p.name || 'FUEL';
              bgGradient = 'linear-gradient(135deg, #10B981, #059669)';
              arrowColor = '#059669';
            }

            var shortLabel = poiLabel.length > 22 ? poiLabel.substring(0, 20) + '...' : poiLabel;

            var htmlStr = '<div class="poi-badge-container">' +
              '<div class="poi-pill" style="background:' + bgGradient + ';">' +
              '<span>' + shortLabel + '</span>' +
              '</div>' +
              '<div class="poi-arrow" style="border-top:6px solid ' + arrowColor + ';"></div>' +
              '</div>';

            var icon = L.divIcon({
              className: 'custom-poi-logo-icon',
              html: htmlStr,
              iconSize: [160, 44],
              iconAnchor: [80, 38]
            });

            if (poiMarkers[p.id]) {
              poiMarkers[p.id].setLatLng(poiLatLng);
              poiMarkers[p.id].setIcon(icon);
            } else {
              poiMarkers[p.id] = L.marker(poiLatLng, { icon: icon, zIndexOffset: 1500 }).addTo(map);
              poiMarkers[p.id].on('click', function() {
                sendAppMessage({ type: 'POI_CLICK', poiId: p.id });
              });
            }
          });

          Object.keys(poiMarkers).forEach(function(id) {
            if (!currentPoiIds[id]) {
              map.removeLayer(poiMarkers[id]);
              delete poiMarkers[id];
            }
          });
        }
      };

      var touchTimer = null;
      map.on('contextmenu', function(e) {
        sendAppMessage({
          type: 'LONG_PRESS',
          lat: e.latlng.lat,
          lng: e.latlng.lng
        });
      });

      map.on('touchstart', function(e) {
        if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length === 1) {
          touchTimer = setTimeout(function() {
            sendAppMessage({
              type: 'LONG_PRESS',
              lat: e.latlng.lat,
              lng: e.latlng.lng
            });
          }, 550);
        }
      });

      map.on('dragstart', function() {
        sendAppMessage({ type: 'USER_DRAGGED_MAP' });
      });

      map.on('touchend touchmove dragstart zoomstart', function() {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
      });

      map.on('moveend', function() {
        try {
          var c = map.getCenter();
          sendAppMessage({ type: 'MAP_MOVE', lat: c.lat, lng: c.lng });
        } catch(e) {}
      });
    </script>
  </body>
  </html>
`;

export default function MapScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const focusUserId = route?.params?.focusUserId;
  const focusLat = route?.params?.focusLat;
  const focusLng = route?.params?.focusLng;
  const focusUserName = route?.params?.focusUserName;

  const { colors, isDark, themeMode, mapStyle: mapStyleSetting, setMapStyle: setMapStyleSetting } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle, members, places, circleFetched, fetchActiveCircle, fetchMembers, fetchPlaces, deletePlace, isLoading: circleLoading } = useCircleStore();
  const { showAlert, showConfirm } = useLuxuryAlert();
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isFollowUserActive, setIsFollowUserActive] = useState(true);

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [showMapLayerModal, setShowMapLayerModal] = useState(false);
  const currentMapCenterRef = useRef<{ lat: number; lng: number }>({ lat: 20.5937, lng: 78.9629 });

  const sheetStyles = getThemeSheetStyles(themeMode);
  const primaryBtnStyles = getThemeButtonStyles(themeMode, 'primary');
  const secondaryBtnStyles = getThemeButtonStyles(themeMode, 'secondary');
  const dangerBtnStyles = getThemeButtonStyles(themeMode, 'danger');
  const floatingControlStyles = getThemeFloatingControlStyles(themeMode);
  const cardBorderStyles = getThemeBorderStyles(themeMode);

  useEffect(() => {
    const loadAppSettings = async () => {
      const u = await AsyncStorage.getItem('@circleguard_distance_unit');
      if (u) setDistanceUnit(u as 'km' | 'mi');
    };
    loadAppSettings();
  }, []);

  const lastHandledFocusKeyRef = useRef<string | null>(null);
  const pendingFocusRef = useRef<{ lat?: number; lng?: number; name?: string; userId?: string } | null>(null);

  const handleCloseMemberCard = () => {
    setSelectedMember(null);
    setMemberRoadInfo(null);
    setAvailableRoutes([]);
    setSelectedRouteIndex(0);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.clearMemberRoute) { window.clearMemberRoute(); } true;`);
    }
    if (navigation && (navigation as any).setParams) {
      (navigation as any).setParams({
        focusUserId: undefined,
        focusLat: undefined,
        focusLng: undefined,
        focusUserName: undefined,
      });
    }
  };

  // Focus from search, chat, or other screens
  useEffect(() => {
    const focusKey = `${focusUserId || ''}_${focusLat || ''}_${focusLng || ''}_${focusUserName || ''}`;
    if (!focusUserId && !focusLat && !focusLng) {
      lastHandledFocusKeyRef.current = null;
      return;
    }

    if (lastHandledFocusKeyRef.current === focusKey) {
      return;
    }
    lastHandledFocusKeyRef.current = focusKey;

    const latNum = focusLat ? Number(focusLat) : undefined;
    const lngNum = focusLng ? Number(focusLng) : undefined;

    pendingFocusRef.current = {
      lat: latNum,
      lng: lngNum,
      name: focusUserName,
      userId: focusUserId,
    };

    // CRITICAL: Disable automatic GPS camera snapping so map stays at searched place
    setIsFollowUserActive(false);

    if (latNum && lngNum && !isNaN(latNum) && !isNaN(lngNum)) {
      if (webViewRef.current) {
        const js = `
          if (window.showSearchedPlace) {
            window.showSearchedPlace(${latNum}, ${lngNum}, ${JSON.stringify(focusUserName || 'Searched Location')});
          } else if (window.map) {
            window.map.setView([${latNum}, ${lngNum}], 16, { animate: true, duration: 1.0 });
          }
          true;
        `;
        webViewRef.current.injectJavaScript(js);
      }

      if (focusUserId) {
        // Focus on member
        const found = members.find(m => String(m.user_id).toLowerCase() === String(focusUserId).toLowerCase());
        setSelectedPlace(null);
        setSelectedPoi(null);
        if (found) {
          handleSelectMember({
            ...found,
            latitude: latNum,
            longitude: lngNum,
          });
        } else {
          handleSelectMember({
            user_id: focusUserId,
            profile: { full_name: focusUserName || 'Circle Member', avatar_url: null },
            isOnline: true,
            latitude: latNum,
            longitude: lngNum,
          });
        }
      } else {
        // Focus on Searched Place or POI
        setSelectedMember(null);
        const matchingPlace = (places || []).find(p => {
          const pt = parseLocationPoint(p);
          const nameMatch = focusUserName && p.name && p.name.toLowerCase() === focusUserName.toLowerCase();
          const coordMatch = Math.abs(pt.latitude - latNum) < 0.001 && Math.abs(pt.longitude - lngNum) < 0.001;
          return nameMatch || coordMatch;
        });

        if (matchingPlace) {
          setSelectedPoi(null);
          setSelectedPlace(matchingPlace);
        } else {
          setSelectedPlace(null);
          setSelectedPoi({
            id: `search_${Date.now()}`,
            name: focusUserName || 'Searched Location',
            subText: `Coordinates: ${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`,
            category: 'location',
            lat: latNum,
            lng: lngNum,
          });
        }
      }
    } else if (focusUserId) {
      const found = members.find(m => String(m.user_id).toLowerCase() === String(focusUserId).toLowerCase());
      const loc = locations.find(l => String(l.user_id).toLowerCase() === String(focusUserId).toLowerCase());
      const targetLat = loc?.latitude || found?.latitude;
      const targetLng = loc?.longitude || found?.longitude;

      if (targetLat && targetLng && webViewRef.current) {
        const js = `
          if (window.map) {
            window.map.setView([${targetLat}, ${targetLng}], 16, { animate: true, duration: 1.0 });
          }
          true;
        `;
        webViewRef.current.injectJavaScript(js);
      }
      if (found) {
        handleSelectMember(found);
      }
    }
  }, [focusUserId, focusLat, focusLng, focusUserName, members, locations, places]);

  const handleDeleteSelectedPlace = async () => {
    if (!selectedPlace) return;
    const placeToDelete = selectedPlace;
    const placeId = placeToDelete.id;

    showConfirm({
      title: 'Delete Geofence Zone',
      message: `Remove "${placeToDelete.name}" from your circle geofences?`,
      confirmText: 'DELETE GEOFENCE',
      cancelText: 'CANCEL',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setSelectedPlace(null);

          // 1. Instantly remove Leaflet map layers with 0ms lag
          if (webViewRef.current) {
            const js = `if (window.deletePlaceLayer) { window.deletePlaceLayer("${placeId}"); } true;`;
            webViewRef.current.injectJavaScript(js);
          }

          // 2. Delete from Supabase & Zustand store
          await deletePlace(placeId);
          if (activeCircle) {
            await fetchPlaces(activeCircle.id);
          }
          pushMapData();

          showAlert({
            title: 'Geofence Removed',
            message: `"${placeToDelete.name}" has been deleted.`,
            type: 'success',
            buttonText: 'DONE',
          });
        } catch (e: any) {
          showAlert({
            title: 'Error Deleting Geofence',
            message: e.message || 'Failed to delete geofence',
            type: 'error',
          });
        }
      },
    });
  };

  // POI Categories & Home Anchoring
  const [selectedPoiCategory, setSelectedPoiCategory] = useState<string | null>(null);
  const [poiList, setPoiList] = useState<any[]>([]);
  const [loadingPois, setLoadingPois] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<any>(null);

  const homePlace = places.find(p => p.category === 'home') || places[0];
  const homeCoords = homePlace ? parseLocationPoint(homePlace) : null;
  const fallbackBaseLat = (homeCoords && homeCoords.latitude !== 0) ? homeCoords.latitude : (userLoc?.latitude || 20.5937);
  const fallbackBaseLng = (homeCoords && homeCoords.longitude !== 0) ? homeCoords.longitude : (userLoc?.longitude || 78.9629);

  const fetchAllNearbyPois = async (lat?: number, lng?: number, targetCategories?: string[]) => {
    setLoadingPois(true);
    const categories = targetCategories && targetCategories.length > 0 
      ? targetCategories 
      : ['hospital', 'school', 'police', 'restaurant', 'fuel'];

    const isMiles = distanceUnit === 'mi';
    const targetLat = lat || userLoc?.latitude || fallbackBaseLat;
    const targetLng = lng || userLoc?.longitude || fallbackBaseLng;

    if (!targetLat || !targetLng || (targetLat === 20.5937 && targetLng === 78.9629)) {
      setLoadingPois(false);
      return;
    }

    try {
      const requests = categories.map(cat =>
        fetchCategoryPois(cat, targetLat, targetLng, isMiles)
      );
      const results = await Promise.all(requests);
      const combined = results.flat();
      setPoiList(combined);
      
      if (webViewRef.current) {
        const jsCode = `if (window.updateMapData) { window.updateMapData({ pois: ${JSON.stringify(combined)} }); } true;`;
        webViewRef.current.injectJavaScript(jsCode);
      }
    } catch (e) {
      console.warn('Real POI fetch error:', e);
    } finally {
      setLoadingPois(false);
    }
  };

  const handleZoomIn = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (map) { map.zoomIn(); } true;`);
    }
  };

  const handleZoomOut = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (map) { map.zoomOut(); } true;`);
    }
  };

  const handleLocateMe = async () => {
    try {
      setIsFollowUserActive(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc && loc.coords) {
        setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (webViewRef.current) {
          const js = `
            if (map) { 
              map.setView([${loc.coords.latitude}, ${loc.coords.longitude}], 16); 
            }
            if (window.updateSelfLiveGPS) {
              window.updateSelfLiveGPS(${loc.coords.latitude}, ${loc.coords.longitude}, ${loc.coords.heading || 0}, ${loc.coords.speed || 0}, ${loc.coords.accuracy || 10}, ${((loc.coords.speed || 0) > 4.5)}, true, "You", ${JSON.stringify(profile?.avatar_url || null)});
            }
            true;
          `;
          webViewRef.current.injectJavaScript(js);
        }
      }
    } catch (e) {
      console.warn("GPS locate error:", e);
    }
  };

  const handleToggleFollow = () => {
    const next = !isFollowUserActive;
    setIsFollowUserActive(next);
    if (next && userLoc && webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (map) { map.panTo([${userLoc.latitude}, ${userLoc.longitude}], { animate: true, duration: 0.5 }); } true;`);
    }
  };

  const handleFitAllMembers = () => {
    setIsFollowUserActive(false);
    let coords: [number, number][] = [];

    if (userLoc && userLoc.latitude !== 0 && userLoc.longitude !== 0) {
      coords.push([userLoc.latitude, userLoc.longitude]);
    }

    // Include primary home place
    const homePlace = places.find(p => p.category === 'home') || places[0];
    if (homePlace) {
      const hPt = parseLocationPoint(homePlace);
      if (hPt.latitude !== 0 && hPt.longitude !== 0) {
        coords.push([hPt.latitude, hPt.longitude]);
      }
    }

    members.forEach((m) => {
      const loc = locations.find(l => String(l.user_id).toLowerCase() === String(m.user_id).toLowerCase());
      let lat = 0;
      let lng = 0;

      if (loc) {
        const pt = parseLocationPoint(loc);
        lat = pt.latitude;
        lng = pt.longitude;
      } else if (m.latitude && m.longitude) {
        lat = m.latitude;
        lng = m.longitude;
      }

      if (lat && lng && lat !== 0 && lng !== 0) {
        coords.push([lat, lng]);
      }
    });

    if (coords.length > 0 && webViewRef.current) {
      const js = `
        if (map && window.L) {
          try {
            var b = L.latLngBounds(${JSON.stringify(coords)});
            map.fitBounds(b, { padding: [70, 70], maxZoom: 16 });
          } catch(e) {}
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  };

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Search Engine State
  const [searchResults, setSearchResults] = useState<{
    members: any[];
    places: any[];
    pois: any[];
    locations: any[];
  }>({ members: [], places: [], pois: [], locations: [] });
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!text.trim() || text.length < 2) {
      setSearchResults({ members: [], places: [], pois: [], locations: [] });
      setIsSearching(false);
      return;
    }

    const queryLower = text.toLowerCase();

    const matchedMembers = members.filter(m => 
      queryLower === 'member' || m.profile?.full_name?.toLowerCase().includes(queryLower)
    );

    const matchedPlaces = places.filter(p => 
      queryLower === 'place' || p.name?.toLowerCase().includes(queryLower)
    );

    const matchedPois = poiList.filter(p => 
      p.name?.toLowerCase().includes(queryLower) ||
      p.category?.toLowerCase().includes(queryLower)
    );

    setSearchResults(prev => ({ 
      ...prev, 
      members: matchedMembers, 
      places: matchedPlaces, 
      pois: matchedPois 
    }));

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const queryEncoded = encodeURIComponent(text.trim());
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${queryEncoded}&limit=10&addressdetails=1`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(nominatimUrl, {
          headers: { 'User-Agent': 'CircleGuardSafetyApp/1.0' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSearchResults(prev => ({
            ...prev,
            locations: data.map(item => ({
              id: item.place_id,
              name: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              type: item.type || item.class || 'location'
            }))
          }));
        }
      } catch (err) {
        console.warn('Geocoding search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const [memberRoadInfo, setMemberRoadInfo] = useState<{ distText: string } | null>(null);
  const [memberRoadDistances, setMemberRoadDistances] = useState<Record<string, string>>({});
  const [availableRoutes, setAvailableRoutes] = useState<DrivingRouteOption[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  useEffect(() => {
    if (!userLoc || !members || members.length === 0) return;
    let isMounted = true;

    members.forEach(async (m) => {
      const isSelf = String(m.user_id).toLowerCase() === String(profile?.id).toLowerCase();
      if (isSelf) return;
      const loc = locations.find(l => String(l.user_id).toLowerCase() === String(m.user_id).toLowerCase());
      const targetLat = loc?.latitude || m.latitude;
      const targetLng = loc?.longitude || m.longitude;
      if (!targetLat || !targetLng || targetLat === 0 || targetLng === 0) return;

      const res = await fetchDrivingDistance(
        { latitude: userLoc.latitude, longitude: userLoc.longitude },
        { latitude: targetLat, longitude: targetLng }
      );
      if (isMounted && res && res.distText) {
        setMemberRoadDistances(prev => ({
          ...prev,
          [m.user_id]: res.distText
        }));
      }
    });

    return () => { isMounted = false; };
  }, [members, locations, userLoc?.latitude, userLoc?.longitude, profile?.id]);

  useEffect(() => {
    if (!selectedMember || !userLoc) {
      setMemberRoadInfo(null);
      setAvailableRoutes([]);
      setSelectedRouteIndex(0);
      return;
    }
    const isSelf = String(selectedMember.user_id).toLowerCase() === String(profile?.id).toLowerCase();
    if (isSelf) {
      setMemberRoadInfo({ distText: 'Your Location' });
      setAvailableRoutes([]);
      setSelectedRouteIndex(0);
      return;
    }
    const memberLoc = locations.find(l => l.user_id === selectedMember.user_id);
    const targetLat = memberLoc?.latitude || selectedMember.latitude;
    const targetLng = memberLoc?.longitude || selectedMember.longitude;
    if (!targetLat || !targetLng || targetLat === 0 || targetLng === 0) return;

    let isMounted = true;
    fetchMultipleDrivingRoutes(
      { latitude: userLoc.latitude, longitude: userLoc.longitude },
      { latitude: targetLat, longitude: targetLng }
    ).then((routes) => {
      if (isMounted && routes && routes.length > 0) {
        setAvailableRoutes(routes);
        setSelectedRouteIndex(0);
        const active = routes[0];
        setMemberRoadInfo({
          distText: `${active.distText} (via road) • ~${active.timeText}`
        });

        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            if (window.drawMultipleRoadRoutes) {
              window.drawMultipleRoadRoutes(${JSON.stringify(routes)}, 0);
            } true;
          `);
        }
      }
    }).catch(() => {});

    return () => { isMounted = false; };
  }, [selectedMember?.user_id, userLoc?.latitude, userLoc?.longitude]);

  const handleSelectRouteOption = (index: number) => {
    setSelectedRouteIndex(index);
    if (availableRoutes[index]) {
      const active = availableRoutes[index];
      setMemberRoadInfo({
        distText: `${active.distText} (via road) • ~${active.timeText}`
      });
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.drawMultipleRoadRoutes) {
            window.drawMultipleRoadRoutes(${JSON.stringify(availableRoutes)}, ${index});
          } true;
        `);
      }
    }
  };

  const handleClosePoi = () => {
    setSelectedPoi(null);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.showSearchedPlace) { window.showSearchedPlace(null, null, null); } true;`);
    }
  };



  const handleSelectMember = (m: any) => {
    setIsFollowUserActive(false);
    setSelectedPoi(null);
    setSelectedPlace(null);
    setSelectedMember(m);
    setSelectedRouteIndex(0);

    const isSelf = String(m.user_id).toLowerCase() === String(profile?.id).toLowerCase();
    const memberLoc = isSelf ? { latitude: userLoc?.latitude, longitude: userLoc?.longitude } : locations.find(l => l.user_id === m.user_id);
    const targetLat = memberLoc?.latitude;
    const targetLng = memberLoc?.longitude;

    if (!isSelf && userLoc && targetLat && targetLng && userLoc.latitude && userLoc.longitude) {
      fetchMultipleDrivingRoutes(
        { latitude: userLoc.latitude, longitude: userLoc.longitude },
        { latitude: targetLat, longitude: targetLng }
      ).then((routes) => {
        if (routes && routes.length > 0) {
          setAvailableRoutes(routes);
          setSelectedRouteIndex(0);
          const active = routes[0];
          setMemberRoadInfo({
            distText: `${active.distText} (via road) • ~${active.timeText}`
          });
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              if (window.drawMultipleRoadRoutes) {
                window.drawMultipleRoadRoutes(${JSON.stringify(routes)}, 0);
              } true;
            `);
          }
        }
      }).catch(() => {});
    } else if (targetLat && targetLng && webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (map) { map.flyTo([${targetLat}, ${targetLng}], 16, { animate: true, duration: 1.0 }); } true;`);
    }
  };

  const handleSelectSearchResult = (item: any, category: 'member' | 'place' | 'poi' | 'location') => {
    setSearchQuery('');
    setSearchResults({ members: [], places: [], pois: [], locations: [] });

    if (category === 'member') {
      setSelectedPlace(null);
      setSelectedPoi(null);
      setSelectedMember(item);
      const loc = locations.find(l => l.user_id === item.user_id);
      if (loc && webViewRef.current) {
        const js = `if (map) { map.setView([${loc.latitude}, ${loc.longitude}], 16); } true;`;
        webViewRef.current.injectJavaScript(js);
      }
    } else if (category === 'place') {
      setSelectedMember(null);
      setSelectedPoi(null);
      setSelectedPlace(item);
      if (webViewRef.current) {
        const js = `if (map) { map.setView([${item.latitude}, ${item.longitude}], 16); } true;`;
        webViewRef.current.injectJavaScript(js);
      }
    } else if (category === 'poi') {
      setSelectedMember(null);
      setSelectedPlace(null);
      setSelectedPoi(item);
      if (webViewRef.current) {
        const js = `if (map) { map.setView([${item.lat}, ${item.lng}], 16); } true;`;
        webViewRef.current.injectJavaScript(js);
      }
    } else if (category === 'location') {
      setSelectedMember(null);
      setSelectedPlace(null);
      const poiItem = {
        id: `search_${item.id || Date.now()}`,
        name: item.name.split(',')[0] || item.name,
        subText: item.name,
        lat: item.lat,
        lng: item.lng,
        category: 'searched_place',
      };
      setSelectedPoi(poiItem);

      if (webViewRef.current) {
        const js = `if (window.showSearchedPlace) { window.showSearchedPlace(${item.lat}, ${item.lng}, ${JSON.stringify(poiItem.name)}); } else if (map) { map.setView([${item.lat}, ${item.lng}], 16); } true;`;
        webViewRef.current.injectJavaScript(js);
      }
    }
  };

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'sos' | 'place'>('sos');
  
  const [addPlaceVisible, setAddPlaceVisible] = useState(false);
  const [addPlaceCoord, setAddPlaceCoord] = useState<{latitude: number, longitude: number} | null>(null);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilterCategories, setActiveFilterCategories] = useState<string[]>([]);
  
  const webViewRef = useRef<WebView | null>(null);
  const lastHistorySavedPoint = useRef<{ lat: number; lng: number; timeMs: number } | null>(null);
  const lastStableGpsRef = useRef<{ lat: number; lng: number; heading: number; speed: number; lastMoveTime: number } | null>(null);

  // Geofence breach monitoring
  useEffect(() => {
    if (!locations || locations.length === 0 || !places || places.length === 0) return;

    (async () => {
      for (const loc of locations) {
        const member = members.find(m => m.user_id === loc.user_id);
        const name = member?.profile?.full_name || (loc.user_id === profile?.id ? 'You' : 'A circle member');

        const breaches = await evaluateGeofenceBreaches(
          {
            user_id: loc.user_id,
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy_m: loc.accuracy_m
          },
          name,
          places as any
        );

        if (breaches.length > 0) {
          const firstBreach = breaches[0];
          if (firstBreach.type === 'exit') {
            const title = 'GEOFENCE EXIT BREACH ALERT';
            const msg = `${firstBreach.userName} exited geofence boundary "${firstBreach.placeName}" (${firstBreach.formattedDistance} from center).`;
            setModalTitle(title);
            setModalMessage(msg);
            setModalType('sos');
            setModalVisible(true);
            scheduleLocalNotification(title, msg);
          } else if (firstBreach.type === 'entry') {
            const title = 'GEOFENCE RE-ENTRY ALERT';
            const msg = `${firstBreach.userName} re-entered geofence boundary "${firstBreach.placeName}" (${firstBreach.formattedDistance} from center).`;
            setModalTitle(title);
            setModalMessage(msg);
            setModalType('place');
            setModalVisible(true);
            scheduleLocalNotification(title, msg);
          }
        }
      }
    })();
  }, [locations, places, members, profile]);

  useEffect(() => {
    if (profile?.id && !activeCircle && !circleFetched) {
      fetchActiveCircle(profile.id);
    }
  }, [profile?.id, activeCircle, circleFetched]);

  // HIGH-FREQUENCY REAL-TIME GPS WATCHER
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Required',
          message: 'Please enable location services to use live circle radar and geofence tracking.',
          type: 'warning',
          buttonText: 'OK',
        });
        return;
      }

      try {
        // 1. Fast instant cached GPS position
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown?.coords) {
          const lkLat = lastKnown.coords.latitude;
          const lkLng = lastKnown.coords.longitude;
          setUserLoc({ latitude: lkLat, longitude: lkLng });
          if (webViewRef.current) {
            const js = `
              if (window.updateSelfLiveGPS) {
                window.updateSelfLiveGPS(${lkLat}, ${lkLng}, ${lastKnown.coords.heading || 0}, ${lastKnown.coords.speed || 0}, ${lastKnown.coords.accuracy || 10}, false, true, "You", ${JSON.stringify(profile?.avatar_url || null)});
              }
              if (window.map) {
                window.map.setView([${lkLat}, ${lkLng}], 16);
              }
              true;
            `;
            webViewRef.current.injectJavaScript(js);
          }
        }

        // 2. Fresh high-precision GPS fix
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (currentLoc?.coords) {
          const initLat = currentLoc.coords.latitude;
          const initLng = currentLoc.coords.longitude;
          setUserLoc({ latitude: initLat, longitude: initLng });
          
          if (webViewRef.current) {
            const js = `
              if (window.updateSelfLiveGPS) {
                window.updateSelfLiveGPS(${initLat}, ${initLng}, ${currentLoc.coords.heading || 0}, ${currentLoc.coords.speed || 0}, ${currentLoc.coords.accuracy || 10}, ${((currentLoc.coords.speed || 0) > 4.5)}, true, "You", ${JSON.stringify(profile?.avatar_url || null)});
              }
              if (window.map) {
                window.map.setView([${initLat}, ${initLng}], 16);
              }
              true;
            `;
            webViewRef.current.injectJavaScript(js);
          }
        }
      } catch (e) {
        console.warn("Initial location fetch error:", e);
      }
      
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 2,
        },
        async (loc) => {
          if (!profile) return;
          const rawLat = loc.coords.latitude;
          const rawLng = loc.coords.longitude;
          const rawSpeed = Math.max(0, loc.coords.speed || 0);
          const rawHeading = loc.coords.heading || 0;
          const accuracy = loc.coords.accuracy || 10;
          const nowMs = Date.now();

          let finalLat = rawLat;
          let finalLng = rawLng;
          let finalHeading = rawHeading;
          let finalSpeed = rawSpeed;

          // STATIONARY DEADBAND & JITTER FILTER
          if (lastStableGpsRef.current) {
            const distFromLast = getDistanceInMeters(
              lastStableGpsRef.current.lat,
              lastStableGpsRef.current.lng,
              rawLat,
              rawLng
            );

            // Stationary noise detection:
            // 1. If physical speed is below 0.75 m/s (~2.7 km/h) and movement is within 4.5 meters
            // 2. OR if distance change is smaller than half of the GPS accuracy radius
            const isStationaryDrift = (rawSpeed < 0.75 && distFromLast < 4.5) || 
                                     (accuracy > 15 && distFromLast < (accuracy * 0.45));

            if (isStationaryDrift) {
              // Anchor coordinates to previous position to eliminate jitter/moving while sitting still
              finalLat = lastStableGpsRef.current.lat;
              finalLng = lastStableGpsRef.current.lng;
              finalHeading = lastStableGpsRef.current.heading;
              finalSpeed = 0;
            } else {
              // Genuine movement detected (>4.5m or clear velocity)
              lastStableGpsRef.current = {
                lat: rawLat,
                lng: rawLng,
                heading: rawHeading,
                speed: rawSpeed,
                lastMoveTime: nowMs
              };
            }
          } else {
            lastStableGpsRef.current = {
              lat: rawLat,
              lng: rawLng,
              heading: rawHeading,
              speed: rawSpeed,
              lastMoveTime: nowMs
            };
          }

          const isDriving = finalSpeed > 4.5;
          const isWalking = finalSpeed >= 0.8;

          setUserLoc({ latitude: finalLat, longitude: finalLng });
          
          // Instant live injection into Leaflet map
          if (webViewRef.current) {
            const jsCode = `
              if (window.updateSelfLiveGPS) {
                window.updateSelfLiveGPS(${finalLat}, ${finalLng}, ${finalHeading}, ${finalSpeed}, ${accuracy}, ${isDriving}, ${isFollowUserActive}, "You", ${JSON.stringify(profile.avatar_url || null)});
              }
              true;
            `;
            webViewRef.current.injectJavaScript(jsCode);
          }

          try {
            let battPct = 100;
            try {
              const battLevel = await Battery.getBatteryLevelAsync();
              if (battLevel >= 0) battPct = Math.round(battLevel * 100);
            } catch (e) {}

            const livePoint = `POINT(${finalLng} ${finalLat})`;
            await supabase.from('locations').upsert({
              user_id: profile.id,
              latitude: finalLat,
              longitude: finalLng,
              geom: livePoint,
              accuracy_m: accuracy,
              speed_mps: finalSpeed,
              battery_pct: battPct,
              is_driving: isDriving,
              activity_state: isDriving ? 'Driving' : (isWalking ? 'Walking' : 'Stationary'),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

            let shouldSaveHistory = false;

            if (!lastHistorySavedPoint.current) {
              shouldSaveHistory = true;
            } else {
              const distMeters = getDistanceInMeters(lastHistorySavedPoint.current.lat, lastHistorySavedPoint.current.lng, finalLat, finalLng);
              const timeDiffSec = (nowMs - lastHistorySavedPoint.current.timeMs) / 1000;

              if (isDriving || finalSpeed >= 2.0) {
                // High-precision breadcrumbs while driving or traveling (every 10m or 15s)
                if (distMeters >= 10 || timeDiffSec >= 15) {
                  shouldSaveHistory = true;
                }
              } else if (distMeters >= 25 || (distMeters >= 12 && timeDiffSec >= 300)) {
                // Only save stationary breadcrumb if user truly moved away (>25m)
                shouldSaveHistory = true;
              }
            }

            if (shouldSaveHistory) {
              const authenticPoint = `POINT(${finalLng} ${finalLat})`;
              await queueAndSyncLocationHistory({
                user_id: profile.id,
                geom: authenticPoint,
                speed_mps: finalSpeed,
                recorded_at: new Date(nowMs).toISOString(),
                accuracy: accuracy ?? undefined,
                latitude: finalLat,
                longitude: finalLng,
              });
              lastHistorySavedPoint.current = { lat: finalLat, lng: finalLng, timeMs: nowMs };
            }
          } catch (err) {
            console.error('Error updating live GPS location:', err);
          }
        }
      );
    })();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [profile, isFollowUserActive]);

  // Realtime Supabase Channels
  useEffect(() => {
    if (!activeCircle) return;
    
    Promise.all([
      fetchMembers(activeCircle.id),
      fetchPlaces(activeCircle.id),
      fetchLocations()
    ]);
    
    const channelUid = Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(`map_locations_${activeCircle.id}_${channelUid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        () => fetchLocations()
      )
      .subscribe();

    const membersChannel = supabase
      .channel(`map_members_${activeCircle.id}_${channelUid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'circle_members', filter: `circle_id=eq.${activeCircle.id}` },
        () => fetchMembers(activeCircle.id)
      )
      .subscribe();
      
    const placesChannel = supabase
      .channel(`map_places_${activeCircle.id}_${channelUid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'places', filter: `circle_id=eq.${activeCircle.id}` },
        () => fetchPlaces(activeCircle.id)
      )
      .subscribe();
      
    const fallbackInterval = setInterval(() => {
      fetchLocations();
    }, 3000);
      
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(placesChannel);
      clearInterval(fallbackInterval);
    };
  }, [activeCircle]);

  // Focus Effect
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      (async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc?.coords && isMounted) {
            setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        } catch (e) {}

        if (activeCircle?.id && isMounted) {
          await Promise.all([
            fetchMembers(activeCircle.id),
            fetchPlaces(activeCircle.id),
            fetchLocations(),
          ]);
        }
        if (isMounted) {
          pushMapData();
        }
      })();

      return () => {
        isMounted = false;
      };
    }, [activeCircle?.id, profile?.id])
  );

  const fetchLocations = async () => {
    try {
      const memberUserIds = members.map(m => m.user_id).filter(Boolean);
      if (profile?.id && !memberUserIds.includes(profile.id)) {
        memberUserIds.push(profile.id);
      }

      let query = supabase
        .from('locations')
        .select('user_id, latitude, longitude, geom, battery_pct, is_driving, speed_mps, activity_state, updated_at');

      if (memberUserIds.length > 0) {
        query = query.in('user_id', memberUserIds);
      }

      let { data, error } = await query;

      if (error) {
        console.error('Error fetching locations:', error);
      }

      let allLocs: any[] = data || [];

      if (allLocs.length > 0) {
        const formatted = allLocs.map(item => {
          const pt = parseLocationPoint(item);
          return {
            ...item,
            latitude: pt.latitude,
            longitude: pt.longitude
          };
        }).filter(item => item.latitude !== 0 && item.longitude !== 0);

        setLocations(formatted);
      }
    } catch (err) {
      console.error('Error in fetchLocations:', err);
    }
  };

  // ZONE CREATION & ALLOCATION
  const savePlace = async (name: string, radius: number, selectedUserIds: string[], category: string = 'home') => {
    if (!activeCircle || !profile || !addPlaceCoord) return;
    try {
      const point = `POINT(${addPlaceCoord.longitude} ${addPlaceCoord.latitude})`;
      const targetUid = selectedUserIds.length === 1 ? selectedUserIds[0] : null;

      const { data: newPlace, error } = await supabase.from('places').insert({
        circle_id: activeCircle.id,
        name: name,
        radius_m: radius,
        geom: point,
        start_lat: addPlaceCoord.latitude,
        start_lng: addPlaceCoord.longitude,
        category: category,
        target_user_id: targetUid,
        created_by: profile.id
      }).select().single();

      if (error) throw error;

      if (newPlace && selectedUserIds && selectedUserIds.length > 0) {
        const pmRows = selectedUserIds.map(uid => ({
          place_id: newPlace.id,
          user_id: uid
        }));
        await supabase.from('place_members').insert(pmRows);
      }

      showAlert({
        title: 'Geofence Created',
        message: `Geofence safe zone "${name}" is now armed and active.`,
        type: 'success',
        buttonText: 'CONTINUE',
      });
      setAddPlaceVisible(false);
      await fetchPlaces(activeCircle.id);
      pushMapData();
    } catch(e: any) {
      showAlert({
        title: 'Geofence Error',
        message: e.message || 'Failed to create geofence place',
        type: 'error',
      });
    }
  };

  const pushMapData = () => {
    if (!webViewRef.current) return;
    const centerLat = focusLat && !isNaN(focusLat) ? focusLat : (userLoc?.latitude || 20.5937);
    const centerLng = focusLng && !isNaN(focusLng) ? focusLng : (userLoc?.longitude || 78.9629);

    // Primary Home / Anchor Place for members whose GPS is stationary at home
    const homePlace = places.find(p => p.category === 'home') || places[0];
    const homeCoords = homePlace ? parseLocationPoint(homePlace) : null;
    const fallbackBaseLat = (homeCoords && homeCoords.latitude !== 0) ? homeCoords.latitude : (userLoc?.latitude || 20.5937);
    const fallbackBaseLng = (homeCoords && homeCoords.longitude !== 0) ? homeCoords.longitude : (userLoc?.longitude || 78.9629);

    const mapData = {
      isDark: isDark,
      mapStyle: mapStyleSetting,
      center: [centerLat, centerLng],
      targetFocus: (focusLat && focusLng && !isNaN(focusLat) && !isNaN(focusLng)) ? [focusLat, focusLng, 17] : null,
      isFollowActive: isFollowUserActive,
      userLocation: userLoc,
      members: (() => {
        let combinedMembers = [...members];
        
        if (profile && !combinedMembers.some(m => String(m.user_id).toLowerCase() === String(profile.id).toLowerCase())) {
          combinedMembers.push({
            user_id: profile.id,
            circle_id: activeCircle?.id || '',
            role: 'owner',
            joined_at: new Date().toISOString(),
            profile: profile,
            isOnline: true,
          } as any);
        }

        return combinedMembers
          .map((m, idx) => {
            const isSelf = String(m.user_id).toLowerCase() === String(profile?.id).toLowerCase();
            const loc = locations.find(l => String(l.user_id).toLowerCase() === String(m.user_id).toLowerCase());
            
            let lat = 0;
            let lng = 0;
            let isRealLocation = false;

            if (isSelf && userLoc && userLoc.latitude !== 0 && userLoc.longitude !== 0) {
              lat = userLoc.latitude;
              lng = userLoc.longitude;
              isRealLocation = true;
            } else if (loc) {
              const pt = parseLocationPoint(loc);
              lat = pt.latitude;
              lng = pt.longitude;
              if (lat !== 0 && lng !== 0) isRealLocation = true;
            } else if (m.latitude && m.longitude) {
              lat = m.latitude;
              lng = m.longitude;
              if (lat !== 0 && lng !== 0) isRealLocation = true;
            }

            // If a member has not broadcasted GPS yet, anchor them at the Circle Home Safe Place (so they don't wander with your traveling GPS!)
            if (!lat || !lng || lat === 0 || lng === 0) {
              const angle = (idx * (360 / Math.max(1, combinedMembers.length))) * (Math.PI / 180);
              lat = fallbackBaseLat + 0.0012 * Math.cos(angle);
              lng = fallbackBaseLng + 0.0012 * Math.sin(angle);
            }

            const isHideOnline = !!m.profile?.hide_online_presence;
            const isGhost = isSelf ? !!profile?.is_ghost_mode : !!m.profile?.is_ghost_mode;

            const isMiles = distanceUnit === 'mi';
            const speedMps = isGhost ? 0 : (loc?.speed_mps || 0);
            const speedFormatted = isMiles ? Math.round(speedMps * 2.23694) : Math.round(speedMps * 3.6);
            const unitText = isMiles ? 'mph' : 'km/h';

            let activityText = 'Stationary';
            if (isGhost) {
              activityText = 'Ghost Mode';
            } else if (!isRealLocation) {
              activityText = 'Stationed at Home';
            } else if (loc?.activity_state) {
              activityText = loc.activity_state;
            } else if (speedMps > 4.5) {
              activityText = `Traveling • ${speedFormatted} ${unitText}`;
            } else if (speedMps >= 0.8) {
              activityText = `Walking • ${speedFormatted} ${unitText}`;
            } else {
              activityText = 'Stationary / Idle';
            }

            return {
              id: m.user_id,
              lat,
              lng,
              isSelf,
              name: isSelf ? 'You' : (m.profile?.full_name || 'Member'),
              initial: String(m.profile?.full_name || (isSelf ? 'Y' : 'M')).charAt(0).toUpperCase(),
              avatarUrl: m.profile?.avatar_url || null,
              role: m.role || 'member',
              isGhost,
              isOnline: (isGhost || isHideOnline) ? false : (m.isOnline ?? (isRealLocation ? true : false)),
              lastSeenText: isGhost ? 'Ghost Mode' : (isHideOnline ? 'Offline' : (m.lastSeenText || (isRealLocation ? 'Online' : 'Stationed at Home'))),
              batteryPct: loc?.battery_pct || m.batteryPct || 100,
              speed: speedMps,
              isDriving: loc?.is_driving ?? (speedMps > 4.5),
              accuracy: loc?.accuracy_m || 10,
              activityText,
            };
          });
      })(),
      places: (useCircleStore.getState().places || places).map(p => {
        const pt = parseLocationPoint(p);
        const radiusNum = typeof p.radius_m === 'number' ? p.radius_m : parseFloat((p as any).radius_m || (p as any).radius || 150);
        const assignedCount = p.assigned_user_ids?.length || (p.target_user_id ? 1 : 0);

        return {
          id: p.id,
          lat: pt.latitude,
          lng: pt.longitude,
          endLat: p.end_lat || null,
          endLng: p.end_lng || null,
          name: p.name,
          category: p.category || 'home',
          radius: isNaN(radiusNum) || radiusNum <= 0 ? 150 : radiusNum,
          assignedCount: assignedCount,
          assignedUserIds: p.assigned_user_ids || (p.target_user_id ? [p.target_user_id] : []),
        };
      }),
      pois: poiList
        .filter(p => activeFilterCategories.length > 0 && activeFilterCategories.includes(p.category))
        .map(p => ({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          name: p.name,
          category: p.category
        }))
    };

    const jsCode = `if (window.updateMapData) { window.updateMapData(${JSON.stringify(mapData)}); } true;`;
    webViewRef.current.injectJavaScript(jsCode);
  };

  const mapPushTimerRef = useRef<any>(null);

  const schedulePushMapData = () => {
    if (mapPushTimerRef.current) return;
    mapPushTimerRef.current = setTimeout(() => {
      mapPushTimerRef.current = null;
      pushMapData();
    }, 100);
  };

  useEffect(() => {
    schedulePushMapData();
    return () => {
      if (mapPushTimerRef.current) clearTimeout(mapPushTimerRef.current);
    };
  }, [userLoc, locations, places, members, poiList, activeFilterCategories, isDark, mapStyleSetting, isFollowUserActive]);

  const webViewSource = useMemo(() => ({ html: LEAFLET_HTML }), []);

  if (!circleFetched || circleLoading) {
    return (
      <View style={styles.centerContainer}>
        <LuxuryRadarLoading
          message="INITIALIZING MAP ENGINE..."
          subMessage="Synchronizing circle nodes & live telemetry"
          size={130}
        />
      </View>
    );
  }

  if (!activeCircle) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Join or create a circle to access live mapping.</Text>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <LuxuryRadarLoading
          message="CALIBRATING HIGH-PRECISION GPS..."
          subMessage="Requesting satellite location permissions"
          size={130}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={webViewSource}
        style={styles.map}
        onLoadEnd={() => {
          pushMapData();
          if (pendingFocusRef.current?.lat && pendingFocusRef.current?.lng && webViewRef.current) {
            const { lat, lng, name } = pendingFocusRef.current;
            const js = `
              if (window.showSearchedPlace) {
                window.showSearchedPlace(${lat}, ${lng}, ${JSON.stringify(name || 'Searched Location')});
              } else if (window.map) {
                window.map.setView([${lat}, ${lng}], 16);
              }
              true;
            `;
            webViewRef.current.injectJavaScript(js);
          }
        }}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'MAP_READY') {
              pushMapData();
              if (pendingFocusRef.current?.lat && pendingFocusRef.current?.lng && webViewRef.current) {
                const { lat, lng, name } = pendingFocusRef.current;
                const js = `
                  if (window.showSearchedPlace) {
                    window.showSearchedPlace(${lat}, ${lng}, ${JSON.stringify(name || 'Searched Location')});
                  } else if (window.map) {
                    window.map.setView([${lat}, ${lng}], 16);
                  }
                  true;
                `;
                webViewRef.current.injectJavaScript(js);
              }
            } else if (msg.type === 'USER_DRAGGED_MAP') {
              setIsFollowUserActive(false);
            } else if (msg.type === 'MAP_MOVE' && msg.lat && msg.lng) {
              currentMapCenterRef.current = { lat: msg.lat, lng: msg.lng };
            } else if (msg.type === 'LONG_PRESS') {
              setAddPlaceCoord({ latitude: msg.lat, longitude: msg.lng });
              setAddPlaceVisible(true);
            } else if (msg.type === 'SELF_CLICK') {
              setSelectedPlace(null);
              setSelectedPoi(null);
              if (profile) {
                setSelectedMember({
                  user_id: profile.id,
                  circle_id: activeCircle?.id || '',
                  role: 'owner',
                  joined_at: new Date().toISOString(),
                  profile: profile,
                  isOnline: true,
                });
              }
            } else if (msg.type === 'MEMBER_CLICK') {
              const found = members.find(m => String(m.user_id).toLowerCase() === String(msg.memberId).toLowerCase());
              if (found) {
                setSelectedPlace(null);
                setSelectedPoi(null);
                setSelectedMember(found);
              } else if (profile && String(profile.id).toLowerCase() === String(msg.memberId).toLowerCase()) {
                setSelectedPlace(null);
                setSelectedPoi(null);
                setSelectedMember({
                  user_id: profile.id,
                  circle_id: activeCircle?.id || '',
                  role: 'owner',
                  joined_at: new Date().toISOString(),
                  profile: profile,
                  isOnline: true,
                });
              }
            } else if (msg.type === 'PLACE_CLICK') {
              const found = places.find(p => p.id === msg.placeId);
              if (found) {
                setSelectedMember(null);
                setSelectedPoi(null);
                setSelectedPlace(found);
              }
            } else if (msg.type === 'POI_CLICK') {
              const found = poiList.find(p => p.id === msg.poiId);
              if (found) {
                setSelectedMember(null);
                setSelectedPlace(null);
                setSelectedPoi(found);
              }
            } else if (msg.type === 'ROUTE_SELECTED' && typeof msg.routeIndex === 'number') {
              handleSelectRouteOption(msg.routeIndex);
            }
          } catch(e) {}
        }}
      />

      {/* Top Search Bar & Members Selector */}
      <View style={styles.searchOverlay}>
        <View style={[
          styles.searchBar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1.5,
            borderRadius: 14,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
          }
        ]}>
          <Ionicons name="search-outline" size={18} color={colors.foreground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search member, safe zone, landmark or area..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholderTextColor={colors.textMuted}
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={colors.accentGold} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
              <Ionicons name="options-outline" size={18} color={activeFilterCategories.length > 0 ? colors.accentGold : colors.foreground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Dropdown Results Box */}
        {(searchResults.members.length > 0 || searchResults.places.length > 0 || searchResults.pois.length > 0 || searchResults.locations.length > 0) ? (
          <ScrollView style={[styles.searchResultsDropdown, getThemeCardStyles(themeMode)]} keyboardShouldPersistTaps="handled">
            {searchResults.members.map(m => (
              <TouchableOpacity key={m.user_id} style={styles.searchResultItem} onPress={() => handleSelectSearchResult(m, 'member')}>
                <Ionicons name="person-outline" size={16} color={colors.accentGold} />
                <View style={styles.searchResultTextWrapper}>
                  <Text style={[styles.searchResultTitle, { color: colors.foreground }]}>{m.profile?.full_name || 'Member'}</Text>
                  <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>Circle Member • {m.isOnline ? 'Online' : 'Offline'}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {searchResults.places.map(p => (
              <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => handleSelectSearchResult(p, 'place')}>
                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                <View style={styles.searchResultTextWrapper}>
                  <Text style={[styles.searchResultTitle, { color: colors.foreground }]}>{p.name}</Text>
                  <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>Safe Zone • {p.radius_m || 150}m</Text>
                </View>
              </TouchableOpacity>
            ))}

            {searchResults.pois.map(p => (
              <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => handleSelectSearchResult(p, 'poi')}>
                <Ionicons name="location-outline" size={16} color={colors.foreground} />
                <View style={styles.searchResultTextWrapper}>
                  <Text style={[styles.searchResultTitle, { color: colors.foreground }]}>{p.name}</Text>
                  <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>{p.category} • {p.distanceKm ? `${p.distanceKm} km away` : 'Nearby'}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {searchResults.locations.map(loc => (
              <TouchableOpacity key={loc.id} style={styles.searchResultItem} onPress={() => handleSelectSearchResult(loc, 'location')}>
                <Ionicons name="map-outline" size={16} color={colors.foreground} />
                <View style={styles.searchResultTextWrapper}>
                  <Text style={[styles.searchResultTitle, { color: colors.foreground }]} numberOfLines={1}>{loc.name}</Text>
                  <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>Searched Map Point</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {/* Member Quick Selector Bar with Dynamic Distance Indicators */}
        {members.length > 0 ? (
          <View style={styles.memberAvatarBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberAvatarContent}>
              {members.map(m => {
                const isSelected = selectedMember?.user_id === m.user_id;
                const nameFirst = String(m.profile?.full_name || 'Member').split(' ')[0];
                const isSelf = String(m.user_id).toLowerCase() === String(profile?.id).toLowerCase();
                const loc = locations.find(l => String(l.user_id).toLowerCase() === String(m.user_id).toLowerCase());
                
                let targetLat = isSelf ? (userLoc?.latitude || 0) : (loc?.latitude || m.latitude || 0);
                let targetLng = isSelf ? (userLoc?.longitude || 0) : (loc?.longitude || m.longitude || 0);

                let distLabel = '';
                if (!isSelf && userLoc && targetLat && targetLng && targetLat !== 0 && targetLng !== 0) {
                  if (memberRoadDistances[m.user_id]) {
                    distLabel = memberRoadDistances[m.user_id];
                  } else {
                    const dMeters = getDistanceInMeters(userLoc.latitude, userLoc.longitude, targetLat, targetLng);
                    distLabel = dMeters > 1000 ? `${(dMeters / 1000).toFixed(1)}km` : `${Math.round(dMeters)}m`;
                  }
                }

                return (
                  <TouchableOpacity
                    key={m.user_id}
                    style={[
                      styles.avatarChip,
                      {
                        borderRadius: 12,
                        borderWidth: 1,
                        backgroundColor: colors.surface,
                        borderColor: isSelected ? colors.accentGold : colors.border,
                      },
                      m.isOnline ? styles.avatarChipOnline : styles.avatarChipOffline,
                      isSelected ? styles.avatarChipSelected : null
                    ]}
                    onPress={() => handleSelectMember(m)}
                  >
                    <View style={[styles.miniDot, { backgroundColor: m.isOnline ? '#10B981' : '#9CA3AF' }]} />
                    <Text style={[styles.chipText, { color: colors.foreground }]}>
                      {nameFirst.toUpperCase()}{distLabel ? ` • ${distLabel}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Real-time Satellite POI GIS Scanning Banner */}
        {loadingPois && (
          <View style={[styles.poiLoadingBanner, getThemeCardStyles(themeMode)]}>
            <View style={styles.poiLoadingGlowBeacon}>
              <ActivityIndicator size="small" color={colors.accentGold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.poiLoadingTitle, { color: colors.accentGold }]}>SCANNING LIVE SATELLITE POIS...</Text>
              <Text style={[styles.poiLoadingSub, { color: colors.textMuted }]}>Searching hospitals, police, schools & cafes nearby</Text>
            </View>
            <View style={styles.poiLoadingLivePill}>
              <View style={styles.poiLoadingDot} />
              <Text style={styles.poiLoadingLiveText}>GIS</Text>
            </View>
          </View>
        )}
      </View>

      {/* Member Details Bottom Card */}
      {selectedMember ? (() => {
        const isSelf = String(selectedMember.user_id).toLowerCase() === String(profile?.id).toLowerCase();
        const memberLoc = isSelf ? { latitude: userLoc?.latitude, longitude: userLoc?.longitude, battery_pct: 100 } : locations.find(l => l.user_id === selectedMember.user_id);
        const lat = memberLoc?.latitude || (isSelf ? userLoc?.latitude : 0) || 0;
        const lng = memberLoc?.longitude || (isSelf ? userLoc?.longitude : 0) || 0;
        
        let distText = isSelf ? 'Your Location' : 'Nearby';
        if (!isSelf && userLoc && lat && lng && lat !== 0 && lng !== 0) {
          if (memberRoadDistances[selectedMember.user_id]) {
            distText = `${memberRoadDistances[selectedMember.user_id]} (via road)`;
          } else {
            const meters = getDistanceInMeters(userLoc.latitude, userLoc.longitude, lat, lng);
            distText = meters > 1000 ? `${(meters / 1000).toFixed(1)} km away` : `${Math.round(meters)} m away`;
          }
        }

        const handleNavigate = () => {
          if (lat && lng && lat !== 0 && lng !== 0) {
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
          } else {
            showAlert({
              title: 'Location Unavailable',
              message: 'No live telemetry coordinates found for this member yet.',
              type: 'info',
            });
          }
        };

        const handleCall = () => {
          const phone = selectedMember.profile?.phone;
          if (phone) {
            Linking.openURL(`tel:${phone}`);
          } else {
            showAlert({
              title: 'Phone Unavailable',
              message: 'No contact phone number is registered for this member.',
              type: 'warning',
            });
          }
        };

        const activeRoute = availableRoutes[selectedRouteIndex] || availableRoutes[0];
        const displayDuration = activeRoute ? activeRoute.timeText : (memberRoadInfo?.distText?.split('~')[1]?.trim() || 'Calculating...');
        const displayDistance = activeRoute ? activeRoute.distText : (memberRoadInfo?.distText?.split('(')[0]?.trim() || distText);

        return (
          <View style={[styles.memberCardSheet, sheetStyles, { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 22 }]}>
            {/* Top Sheet Drag Handle */}
            <View style={styles.sheetHandleContainer}>
              <View style={[styles.sheetHandleBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' }]} />
            </View>

            {/* Profile Header Row */}
            <View style={styles.modernMemberHeader}>
              <View style={styles.modernAvatarContainer}>
                {selectedMember.profile?.avatar_url ? (
                  <Image source={{ uri: selectedMember.profile.avatar_url }} style={styles.modernAvatarImg} />
                ) : (
                  <View style={[styles.modernAvatarPlaceholder, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                    <Text style={[styles.modernAvatarInitials, { color: colors.foreground }]}>
                      {String(selectedMember.profile?.full_name || (isSelf ? 'Y' : 'M')).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={[styles.modernOnlineIndicator, { backgroundColor: selectedMember.isOnline ? '#10B981' : '#94A3B8' }]} />
              </View>

              <View style={styles.modernMemberMeta}>
                <Text style={[styles.modernMemberName, { color: colors.foreground }]} numberOfLines={1}>
                  {isSelf ? 'Your Location' : (selectedMember.profile?.full_name || 'Circle Member')}
                </Text>
                <View style={styles.modernStatusRow}>
                  <Text style={[styles.modernStatusSubtext, { color: colors.textMuted }]}>
                    {selectedMember.isOnline ? 'Active now' : (selectedMember.lastSeenText || 'Offline')}
                  </Text>
                  <Text style={[styles.modernStatusDot, { color: colors.textMuted }]}>•</Text>
                  <Ionicons name="battery-charging-outline" size={13} color={colors.accentGold} />
                  <Text style={[styles.modernStatusSubtext, { color: colors.textMuted }]}>
                    {memberLoc?.battery_pct ? `${memberLoc.battery_pct}%` : 'Optimal'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={handleCloseMemberCard}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[styles.modernCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Google Maps ETA Hero Banner */}
            {!isSelf && (
              <View style={[styles.etaHeroCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0' }]}>
                <View style={styles.etaHeroLeft}>
                  <View style={styles.etaTimeRow}>
                    <Text style={[styles.etaDurationText, { color: '#10B981' }]}>
                      {displayDuration}
                    </Text>
                    <View style={styles.liveTrafficPill}>
                      <View style={styles.liveTrafficDot} />
                      <Text style={styles.liveTrafficText}>Fastest</Text>
                    </View>
                  </View>
                  <Text style={[styles.etaSubText, { color: colors.textMuted }]}>
                    {displayDistance} • via physical road network
                  </Text>
                </View>
              </View>
            )}

            {/* Route Options Segmented Selector (UI/UX Pro Max Bento & Tactile Design) */}
            {!isSelf && availableRoutes.length > 1 && (
              <View style={styles.routeSelectorBlock}>
                <View style={styles.routeSelectorHeaderRow}>
                  <Text style={[styles.routeSelectorTitle, { color: colors.textMuted }]}>DRIVING ROUTE OPTIONS</Text>
                  <Text style={[styles.routeSelectorCount, { color: colors.textMuted }]}>{availableRoutes.length} Available</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeCardsScroll}>
                  {availableRoutes.map((r, rIdx) => {
                    const isSelected = rIdx === selectedRouteIndex;
                    const isFastest = r.tag === 'fastest';
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.routeCardOption,
                          {
                            backgroundColor: isSelected 
                              ? (isDark ? 'rgba(37, 99, 235, 0.16)' : '#EFF6FF') 
                              : (isDark ? 'rgba(30, 41, 59, 0.55)' : '#FFFFFF'),
                            borderColor: isSelected 
                              ? '#2563EB' 
                              : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0'),
                          }
                        ]}
                        onPress={() => handleSelectRouteOption(rIdx)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.routeCardHeaderRow}>
                          <View style={styles.routeCardTagGroup}>
                            <Ionicons 
                              name={isFastest ? 'flash' : 'git-branch'} 
                              size={13} 
                              color={isSelected ? '#2563EB' : (isFastest ? '#10B981' : colors.textMuted)} 
                            />
                            <Text style={[styles.routeCardName, { color: isSelected ? '#1D4ED8' : colors.foreground }]}>
                              {isFastest ? 'Recommended' : `Bypass Route`}
                            </Text>
                          </View>
                          <Ionicons 
                            name={isSelected ? 'radio-button-on' : 'radio-button-off'} 
                            size={16} 
                            color={isSelected ? '#2563EB' : colors.border} 
                          />
                        </View>

                        <View style={styles.routeCardBody}>
                          <Text style={[styles.routeCardDuration, { color: isSelected ? '#1D4ED8' : colors.foreground }]}>
                            {r.timeText}
                          </Text>
                          <View style={styles.routeCardMetaRow}>
                            <Text style={[styles.routeCardDistance, { color: colors.textMuted }]}>
                              {r.distText}
                            </Text>
                            <View style={[
                              styles.routeDeltaPill, 
                              { 
                                backgroundColor: isFastest 
                                  ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5') 
                                  : (isDark ? 'rgba(148, 163, 184, 0.12)' : '#F1F5F9') 
                              }
                            ]}>
                              <Text style={[styles.routeDeltaText, { color: isFastest ? '#059669' : colors.textMuted }]}>
                                {r.diffKmText}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Action Buttons Row (Tactile High-Contrast CTAs) */}
            <View style={styles.modernActionRow}>
              <TouchableOpacity 
                style={styles.modernNavigateBtn} 
                onPress={handleNavigate}
                activeOpacity={0.85}
              >
                <Ionicons name="navigate" size={17} color="#FFFFFF" />
                <Text style={styles.modernNavigateBtnText}>Start in Google Maps</Text>
                <Ionicons name="arrow-forward" size={15} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>

              {selectedMember.profile?.phone ? (
                <TouchableOpacity 
                  style={[
                    styles.modernIconActionBtn, 
                    { 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', 
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0' 
                    }
                  ]} 
                  onPress={handleCall}
                  activeOpacity={0.75}
                >
                  <Ionicons name="call-outline" size={18} color={colors.foreground} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Subtle Realistic Road Network Disclaimer Footer */}
            {!isSelf && (
              <View style={styles.subtleFooterNotice}>
                <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.subtleFooterText, { color: colors.textMuted }]}>
                  Live GIS road preview. Traffic & road conditions may vary.
                </Text>
              </View>
            )}
          </View>
        );
      })() : null}

      {/* GEOFENCE ZONE DETAILS BOTTOM CARD */}
      {selectedPlace ? (() => {
        const placePt = parseLocationPoint(selectedPlace);
        const radiusNum = typeof selectedPlace.radius_m === 'number' ? selectedPlace.radius_m : parseFloat(selectedPlace.radius_m || selectedPlace.radius || 150);
        const cat = selectedPlace.category || 'home';
        
        let catColor = '#D4AF37';
        let catIcon = 'shield-checkmark';
        let catLabel = 'SAFE ZONE';

        if (cat === 'home') {
          catColor = '#10B981';
          catIcon = 'home';
          catLabel = 'HOME ZONE';
        } else if (cat === 'work') {
          catColor = '#3B82F6';
          catIcon = 'briefcase';
          catLabel = 'WORK ZONE';
        } else if (cat === 'school') {
          catColor = '#F59E0B';
          catIcon = 'school';
          catLabel = 'SCHOOL ZONE';
        } else if (cat === 'fitness' || cat === 'gym') {
          catColor = '#8B5CF6';
          catIcon = 'fitness';
          catLabel = 'GYM ZONE';
        } else if (cat === 'danger') {
          catColor = '#EF4444';
          catIcon = 'alert-circle';
          catLabel = 'DANGER ZONE';
        }

        const assignedIds = selectedPlace.assigned_user_ids || (selectedPlace.target_user_id ? [selectedPlace.target_user_id] : []);
        const isAllMembers = assignedIds.length === 0;
        const assignedMembersList = isAllMembers ? members : members.filter(m => assignedIds.includes(m.user_id));

        return (
          <View style={[styles.memberCardSheet, sheetStyles]}>
            <View style={styles.memberCardHeader}>
              <View style={[styles.memberAvatar, { backgroundColor: `${catColor}20`, borderColor: catColor, borderRadius: 22 }]}>
                <Ionicons name={catIcon as any} size={22} color={catColor} />
              </View>
              <View style={styles.memberMainInfo}>
                <Text style={[styles.memberCardName, { color: colors.foreground }]}>{selectedPlace.name}</Text>
                <View style={styles.safeBadge}>
                  <View style={[styles.safeDot, { backgroundColor: catColor }]} />
                  <Text style={[styles.safeBadgeText, { color: catColor }]}>
                    {catLabel} • {radiusNum >= 1000 ? `${(radiusNum / 1000).toFixed(1)}KM` : `${radiusNum}M`} RADIUS
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelectedPlace(null)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Assigned Members Allocation List with Live Geofence Status */}
            <Text style={[styles.zoneAllocTitle, { color: colors.textMuted }]}>ZONE ALLOCATION & LIVE MEMBER PRESENCE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneAllocScroll}>
              {assignedMembersList.length === 0 ? (
                <View style={[styles.zoneMemberPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 12 }]}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={colors.accentGold} />
                  <Text style={[styles.zoneMemberPillText, { color: colors.accentGold }]}>Applied to entire circle</Text>
                </View>
              ) : (
                assignedMembersList.map(m => {
                  const mLoc = locations.find(l => l.user_id === m.user_id);
                  let isInside = false;
                  let distText = 'Stationed at Home';

                  if (mLoc && placePt.latitude && placePt.longitude) {
                    const dist = getDistanceInMeters(mLoc.latitude, mLoc.longitude, placePt.latitude, placePt.longitude);
                    isInside = dist <= radiusNum;
                    distText = isInside ? 'Inside Zone' : `${(dist / 1000).toFixed(1)}km away`;
                  } else if (m.user_id === profile?.id && userLoc && placePt.latitude && placePt.longitude) {
                    const dist = getDistanceInMeters(userLoc.latitude, userLoc.longitude, placePt.latitude, placePt.longitude);
                    isInside = dist <= radiusNum;
                    distText = isInside ? 'Inside Zone' : `${(dist / 1000).toFixed(1)}km away`;
                  }

                  const mName = m.profile?.full_name || 'Member';
                  const initial = mName.charAt(0).toUpperCase();

                  return (
                    <View key={m.user_id} style={[styles.zoneMemberPill, { backgroundColor: colors.surfaceMuted, borderColor: isInside ? '#10B981' : colors.border, borderRadius: 12 }]}>
                      <View style={[styles.miniAvatarWrap, { borderColor: isInside ? '#10B981' : colors.textMuted, backgroundColor: colors.surface }]}>
                        <Text style={[styles.miniAvatarInitial, { color: colors.foreground }]}>{initial}</Text>
                      </View>
                      <View>
                        <Text style={[styles.zoneMemberName, { color: colors.foreground }]}>{mName.split(' ')[0]}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isInside ? '#10B981' : '#94A3B8' }} />
                          <Text style={[styles.zoneMemberStatus, { color: isInside ? '#10B981' : colors.textMuted }]}>
                            {isInside ? 'Inside Zone' : distText}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={[styles.cardActionRow, { marginTop: 16 }]}>
              <TouchableOpacity 
                style={[
                  styles.cardBtnPrimary, 
                  { 
                    backgroundColor: primaryBtnStyles.backgroundColor,
                    borderRadius: primaryBtnStyles.borderRadius,
                    borderWidth: primaryBtnStyles.borderWidth,
                    borderColor: primaryBtnStyles.borderColor,
                    shadowColor: primaryBtnStyles.shadowColor,
                    shadowOffset: primaryBtnStyles.shadowOffset,
                    shadowOpacity: primaryBtnStyles.shadowOpacity,
                    shadowRadius: primaryBtnStyles.shadowRadius,
                    elevation: primaryBtnStyles.elevation,
                  }
                ]} 
                onPress={() => {
                  if (placePt.latitude && placePt.longitude) {
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${placePt.latitude},${placePt.longitude}`);
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="compass" size={16} color={primaryBtnStyles.textColor} />
                <Text style={[styles.cardBtnPrimaryText, { color: primaryBtnStyles.textColor }]}>DIRECTIONS</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.cardBtnDanger, 
                  { 
                    backgroundColor: dangerBtnStyles.backgroundColor,
                    borderRadius: dangerBtnStyles.borderRadius,
                    borderWidth: dangerBtnStyles.borderWidth,
                    borderColor: dangerBtnStyles.borderColor,
                    shadowColor: dangerBtnStyles.shadowColor,
                    shadowOffset: dangerBtnStyles.shadowOffset,
                    shadowOpacity: dangerBtnStyles.shadowOpacity,
                    shadowRadius: dangerBtnStyles.shadowRadius,
                    elevation: dangerBtnStyles.elevation,
                  }
                ]} 
                onPress={handleDeleteSelectedPlace} 
                activeOpacity={0.8}
              >
                <Ionicons name="trash" size={16} color={dangerBtnStyles.textColor} />
                <Text style={[styles.cardBtnDangerText, { color: dangerBtnStyles.textColor }]}>DELETE ZONE</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.cardBtnSecondary, 
                  { 
                    backgroundColor: secondaryBtnStyles.backgroundColor,
                    borderRadius: secondaryBtnStyles.borderRadius,
                    borderWidth: secondaryBtnStyles.borderWidth,
                    borderColor: secondaryBtnStyles.borderColor,
                    shadowColor: secondaryBtnStyles.shadowColor,
                    shadowOffset: secondaryBtnStyles.shadowOffset,
                    shadowOpacity: secondaryBtnStyles.shadowOpacity,
                    shadowRadius: secondaryBtnStyles.shadowRadius,
                    elevation: secondaryBtnStyles.elevation,
                  }
                ]} 
                onPress={() => setSelectedPlace(null)} 
                activeOpacity={0.8}
              >
                <Text style={[styles.cardBtnSecondaryText, { color: secondaryBtnStyles.textColor }]}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })() : null}

      {/* Selected POI Bottom Card */}
      {selectedPoi ? (
        <View style={[styles.memberCardSheet, sheetStyles]}>
          <View style={styles.memberCardHeader}>
            <View style={[styles.memberAvatar, { backgroundColor: `${colors.accentGold}25`, borderColor: colors.accentGold, borderRadius: 22 }]}>
              <Ionicons name="location" size={20} color={colors.accentGold} />
            </View>
            <View style={styles.memberMainInfo}>
              <Text style={[styles.memberCardName, { color: colors.foreground }]}>{selectedPoi.name}</Text>
              <Text style={[styles.poiAddressText, { color: colors.textMuted }]} numberOfLines={2}>{selectedPoi.subText}</Text>
            </View>
            <TouchableOpacity onPress={handleClosePoi} style={{ padding: 4 }} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={[styles.cardActionRow, { marginTop: 16 }]}>
            <TouchableOpacity 
              style={[
                styles.cardBtnPrimary, 
                { 
                  backgroundColor: primaryBtnStyles.backgroundColor,
                  borderRadius: primaryBtnStyles.borderRadius,
                  borderWidth: primaryBtnStyles.borderWidth,
                  borderColor: primaryBtnStyles.borderColor,
                  shadowColor: primaryBtnStyles.shadowColor,
                  shadowOffset: primaryBtnStyles.shadowOffset,
                  shadowOpacity: primaryBtnStyles.shadowOpacity,
                  shadowRadius: primaryBtnStyles.shadowRadius,
                  elevation: primaryBtnStyles.elevation,
                }
              ]} 
              onPress={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPoi.lat},${selectedPoi.lng}`;
                Linking.openURL(url);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="compass" size={16} color={primaryBtnStyles.textColor} />
              <Text style={[styles.cardBtnPrimaryText, { color: primaryBtnStyles.textColor }]}>NAVIGATE</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.cardBtnSecondary, 
                { 
                  backgroundColor: secondaryBtnStyles.backgroundColor,
                  borderRadius: secondaryBtnStyles.borderRadius,
                  borderWidth: secondaryBtnStyles.borderWidth,
                  borderColor: secondaryBtnStyles.borderColor,
                  shadowColor: secondaryBtnStyles.shadowColor,
                  shadowOffset: secondaryBtnStyles.shadowOffset,
                  shadowOpacity: secondaryBtnStyles.shadowOpacity,
                  shadowRadius: secondaryBtnStyles.shadowRadius,
                  elevation: secondaryBtnStyles.elevation,
                }
              ]} 
              onPress={() => {
                setAddPlaceCoord({ latitude: selectedPoi.lat, longitude: selectedPoi.lng });
                setAddPlaceVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="bookmark" size={16} color={secondaryBtnStyles.textColor} />
              <Text style={[styles.cardBtnSecondaryText, { color: secondaryBtnStyles.textColor }]}>CREATE ZONE</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.cardBtnSecondary, 
                { 
                  backgroundColor: secondaryBtnStyles.backgroundColor,
                  borderRadius: secondaryBtnStyles.borderRadius,
                  borderWidth: secondaryBtnStyles.borderWidth,
                  borderColor: secondaryBtnStyles.borderColor,
                  shadowColor: secondaryBtnStyles.shadowColor,
                  shadowOffset: secondaryBtnStyles.shadowOffset,
                  shadowOpacity: secondaryBtnStyles.shadowOpacity,
                  shadowRadius: secondaryBtnStyles.shadowRadius,
                  elevation: secondaryBtnStyles.elevation,
                }
              ]} 
              onPress={handleClosePoi} 
              activeOpacity={0.8}
            >
              <Text style={[styles.cardBtnSecondaryText, { color: secondaryBtnStyles.textColor }]}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <AlertModal 
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
        onClose={() => setModalVisible(false)}
      />

      <AddPlaceModal
        visible={addPlaceVisible}
        coordinate={addPlaceCoord}
        members={members}
        onClose={() => setAddPlaceVisible(false)}
        onSave={savePlace}
      />

      <SearchFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        selectedCategories={activeFilterCategories}
        onApplyFilters={(cats) => {
          setActiveFilterCategories(cats);
          const poiCats = cats.filter(c => c !== 'member' && c !== 'place');
          const firstMem = members.find(m => m.latitude && m.longitude);
          const firstLoc = locations.find(l => l.latitude && l.longitude);
          const lat = userLoc?.latitude || firstLoc?.latitude || firstMem?.latitude || currentMapCenterRef.current.lat;
          const lng = userLoc?.longitude || firstLoc?.longitude || firstMem?.longitude || currentMapCenterRef.current.lng;

          if (poiCats.length > 0) {
            fetchAllNearbyPois(lat, lng, poiCats);
          } else {
            setSelectedPoiCategory(null);
            setPoiList([]);
            if (webViewRef.current) {
              const jsCode = `if (window.updateMapData) { window.updateMapData({ pois: [] }); } true;`;
              webViewRef.current.injectJavaScript(jsCode);
            }
          }
        }}
        poiList={poiList}
        members={members}
        places={places}
        userLoc={userLoc}
      />

      <MapLayerModal
        visible={showMapLayerModal}
        onClose={() => setShowMapLayerModal(false)}
        selectedStyle={mapStyleSetting}
        onSelectStyle={(s) => {
          setMapStyleSetting(s);
          AsyncStorage.setItem('@circleguard_map_style', s);

          const tileUrls: Record<MapStyleType, string> = {
            satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            vector: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          };
          const newTile = tileUrls[s] || tileUrls.vector;

          if (webViewRef.current) {
            const js = `if (window.changeTileUrl) { window.changeTileUrl('${newTile}', '${s}'); } true;`;
            webViewRef.current.injectJavaScript(js);
          }
        }}
      />

      {/* Floating Map Controls */}
      <View style={[styles.floatingControls, selectedMember || selectedPlace || selectedPoi ? { bottom: 310 } : { bottom: 25 }]}>
        {/* Follow Mode Toggle */}
        <SpringTouchable 
          style={[
            styles.controlBtn, 
            floatingControlStyles,
            isFollowUserActive 
              ? { borderColor: '#10B981', backgroundColor: themeMode === 'brand_green' ? '#E8F8EE' : 'rgba(16, 185, 129, 0.25)' } 
              : null
          ]} 
          onPress={handleToggleFollow} 
          scaleTo={0.88}
        >
          <Ionicons name="navigate" size={20} color={isFollowUserActive ? '#10B981' : colors.foreground} />
        </SpringTouchable>

        {/* Locate Me */}
        <SpringTouchable style={[styles.controlBtn, floatingControlStyles]} onPress={handleLocateMe} scaleTo={0.88}>
          <Ionicons name="locate" size={22} color={colors.accentGold} />
        </SpringTouchable>

        {/* Fit All Circle Members */}
        <SpringTouchable style={[styles.controlBtn, floatingControlStyles]} onPress={handleFitAllMembers} scaleTo={0.88}>
          <Ionicons name="people-sharp" size={20} color="#3B82F6" />
        </SpringTouchable>

        {/* Map Layers */}
        <SpringTouchable style={[styles.controlBtn, floatingControlStyles]} onPress={() => setShowMapLayerModal(true)} scaleTo={0.88}>
          <Ionicons name="layers" size={20} color={colors.accentGold} />
        </SpringTouchable>

        {/* Zoom In & Out */}
        <SpringTouchable style={[styles.controlBtn, floatingControlStyles]} onPress={handleZoomIn} scaleTo={0.88}>
          <Ionicons name="add" size={22} color={colors.foreground} />
        </SpringTouchable>

        <SpringTouchable style={[styles.controlBtn, floatingControlStyles]} onPress={handleZoomOut} scaleTo={0.88}>
          <Ionicons name="remove" size={22} color={colors.foreground} />
        </SpringTouchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LUXURY_THEME.colors.background,
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LUXURY_THEME.colors.background,
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    color: LUXURY_THEME.colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: LUXURY_THEME.typography.letterSpacingWide,
  },
  emptyText: {
    color: LUXURY_THEME.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  searchOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 24, 31, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  filterBtn: {
    padding: 4,
  },
  searchResultsDropdown: {
    maxHeight: 240,
    backgroundColor: 'rgba(22, 24, 31, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 14,
    marginTop: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  searchResultTextWrapper: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchResultSub: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },

  memberAvatarBar: {
    marginTop: 10,
  },
  memberAvatarContent: {
    gap: 8,
    paddingVertical: 2,
  },
  avatarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(22, 24, 31, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  avatarChipOnline: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  avatarChipOffline: {
    borderColor: 'rgba(156, 163, 175, 0.3)',
    opacity: 0.8,
  },
  avatarChipSelected: {
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  memberCardSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#16181F',
    padding: 24,
    borderTopWidth: 3,
    borderTopColor: LUXURY_THEME.colors.accentGold,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0D0E12',
    borderWidth: 2,
    borderColor: LUXURY_THEME.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  memberMainInfo: {
    flex: 1,
  },
  memberCardName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  safeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  safeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  safeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  poiAddressText: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  zoneAllocTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  zoneAllocScroll: {
    gap: 8,
    paddingBottom: 6,
  },
  zoneMemberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
  },
  miniAvatarWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0D0E12',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarInitial: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  zoneMemberName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  zoneMemberStatus: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  zoneMemberPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D4AF37',
  },

  cardActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cardBtnPrimary: {
    flex: 1,
    height: 44,
    backgroundColor: LUXURY_THEME.colors.accentGold,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardBtnPrimaryText: {
    color: '#0D0E12',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardBtnSecondary: {
    paddingHorizontal: 16,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardBtnSecondaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBtnDanger: {
    flex: 1,
    height: 44,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardBtnDangerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  floatingControls: {
    position: 'absolute',
    right: 18,
    gap: 10,
    zIndex: 10,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(22, 24, 31, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  poiLoadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 24, 31, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.65)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    gap: 12,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  poiLoadingGlowBeacon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiLoadingTitle: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  poiLoadingSub: {
    color: '#E5E7EB',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.85,
  },
  poiLoadingLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  poiLoadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  poiLoadingLiveText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sheetHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 8,
  },
  sheetHandleBar: {
    width: 36,
    height: 4.5,
    borderRadius: 3,
  },
  modernMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  modernAvatarContainer: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  modernAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  modernAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernAvatarInitials: {
    fontSize: 18,
    fontWeight: '800',
  },
  modernOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modernMemberMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  modernMemberName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  modernStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  modernStatusSubtext: {
    fontSize: 12,
    fontWeight: '500',
  },
  modernStatusDot: {
    fontSize: 10,
    fontWeight: '700',
  },
  modernCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  etaHeroCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  etaHeroLeft: {
    gap: 2,
  },
  etaTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  etaDurationText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  liveTrafficPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  liveTrafficDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  liveTrafficText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  etaSubText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  routeSelectorBlock: {
    marginBottom: 12,
  },
  routeSelectorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  routeSelectorTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  routeSelectorCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  routeCardsScroll: {
    gap: 10,
    paddingRight: 6,
  },
  routeCardOption: {
    width: 185,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  routeCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  routeCardTagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  routeCardName: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  routeCardBody: {
    gap: 3,
  },
  routeCardDuration: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  routeCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeCardDistance: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  routeDeltaPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  routeDeltaText: {
    fontSize: 10,
    fontWeight: '700',
  },

  modernActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  modernNavigateBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  modernNavigateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modernIconActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  subtleFooterNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
  },
  subtleFooterText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
