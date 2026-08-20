import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, TextInput, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useCircleStore } from '../store/useCircleStore';
import AlertModal from '../components/AlertModal';
import AddPlaceModal from '../components/AddPlaceModal';
import SearchFilterModal from '../components/SearchFilterModal';
import MapLayerModal, { MapStyleType } from '../components/MapLayerModal';
import SpringTouchable from '../components/SpringTouchable';
import { LUXURY_THEME } from '../constants/theme';
import { evaluateGeofenceBreaches } from '../services/GeofenceEngine';
import { fetchCategoryPois, generateFallbackPois } from '../services/PoiService';
import LuxuryRadarLoading from '../components/LuxuryRadarLoading';

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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

import { useThemeStore } from '../store/useThemeStore';

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
        transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1) !important;
      }
      .member-avatar-online {
        background: #1A1A1A; color: #10B981; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-family: sans-serif; border: 2px solid #10B981;
        box-shadow: 0 4px 12px rgba(16,185,129,0.35);
      }
      .member-avatar-offline {
        background: #374151; color: #D1D5DB; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-family: sans-serif; border: 2px solid #9CA3AF;
        opacity: 0.75;
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
      window.map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 14);
      var map = window.map;
      var userMarker = null;
      window.memberMarkers = window.memberMarkers || {};
      var memberMarkers = window.memberMarkers;
      window.placeCircles = window.placeCircles || {};
      var placeCircles = window.placeCircles;
      window.poiMarkers = window.poiMarkers || {};
      var poiMarkers = window.poiMarkers;
      var initialCentered = false;

      var savedStyle = 'satellite';
      try {
        savedStyle = window.localStorage.getItem('@circleguard_map_style') || 'satellite';
      } catch(e) {}

      var tileUrls = {
        satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        midnight: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        vector: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
      };

      var initialTileUrl = tileUrls[savedStyle] || tileUrls.satellite;
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
          '<span>📍</span>' +
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
          initialCentered = true;
        } else if (!initialCentered && data.center) {
          map.setView(data.center, 14);
          initialCentered = true;
        }

        // User & Member locations are rendered dynamically via rich avatar markers below

        if (data.members) {
          var currentMemberIds = {};
          var allMemberCoords = [];

          data.members.forEach(function(m) {
            currentMemberIds[m.id] = true;
            var mLatLng = [m.lat, m.lng];
            allMemberCoords.push(mLatLng);

            var avatarClass = m.isOnline ? 'member-avatar-online' : 'member-avatar-offline';
            var statusTag = m.isOnline ? ' (Online)' : ' (' + (m.lastSeenText || 'Offline - Last Known Position') + ')';
            var avatarContent = m.avatarUrl
              ? '<img src="' + m.avatarUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
              : '<span style="color:#FFF;font-weight:bold;font-size:14px;">' + m.initial + '</span>';

            var roleColor = '#10B981';
            var roleBadgeSymbol = '';

            if (m.role === 'owner') {
              roleColor = '#D4AF37';
            } else if (m.role === 'co_leader') {
              roleColor = '#A855F7';
            } else if (m.role === 'guardian') {
              roleColor = '#3B82F6';
            }

            var pulseStyle = m.isOnline 
              ? 'border: 2.5px solid ' + roleColor + '; box-shadow: 0 0 16px ' + roleColor + 'CC;' 
              : 'border: 2px solid #9CA3AF; opacity: 0.85;';

            var batteryTag = m.batteryPct ? ' • ' + m.batteryPct + '%' : '';
            var activityTag = m.activityText ? ' • ' + m.activityText : '';
            var labelHtml = '<div style="position:absolute; bottom:44px; left:50%; transform:translateX(-50%); white-space:nowrap; background:rgba(26,26,26,0.95); color:#FFFFFF; font-size:10px; font-weight:bold; font-family:sans-serif; padding:4px 9px; border-radius:12px; border:1px solid ' + roleColor + '; box-shadow:0 4px 12px rgba(0,0,0,0.5); pointer-events:none; z-index:1000;">' + roleBadgeSymbol + m.name + activityTag + batteryTag + '</div>';

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
              memberMarkers[m.id] = L.marker(mLatLng, { icon: icon }).addTo(map).bindPopup(m.name + statusTag);
              (function(memberId) {
                memberMarkers[memberId].on('click', function() {
                  sendAppMessage({ type: 'MEMBER_CLICK', memberId: memberId });
                });
              })(m.id);
            }
          });

          if (!initialCentered && allMemberCoords.length > 0) {
            try {
              var bounds = L.latLngBounds(allMemberCoords);
              map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
              initialCentered = true;
            } catch(e) {}
          }

          window.fitAllMembers = function() {
            var coords = [];
            Object.keys(memberMarkers).forEach(function(id) {
              if (memberMarkers[id]) {
                coords.push(memberMarkers[id].getLatLng());
              }
            });
            if (coords.length > 0) {
              try {
                var bounds = L.latLngBounds(coords);
                map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
              } catch(e) {}
            }
          };

          Object.keys(memberMarkers).forEach(function(id) {
            if (!currentMemberIds[id]) {
              map.removeLayer(memberMarkers[id]);
              delete memberMarkers[id];
            }
          });
        }

        if (data.places) {
          var currentPlaceIds = {};
          data.places.forEach(function(p) {
            if (!p.lat || !p.lng) return;
            var circleKey = 'circle_' + p.id;
            var markerKey = 'marker_' + p.id;
            currentPlaceIds[circleKey] = true;
            currentPlaceIds[markerKey] = true;

            var pLatLng = [p.lat, p.lng];

            // 1. Gold Geofence Circle Boundary
            if (placeCircles[circleKey]) {
              placeCircles[circleKey].setLatLng(pLatLng);
              placeCircles[circleKey].setRadius(p.radius);
            } else {
              placeCircles[circleKey] = L.circle(pLatLng, {
                radius: p.radius,
                color: '#D4AF37',
                fillColor: '#D4AF37',
                fillOpacity: 0.28,
                weight: 2.5
              }).addTo(map);

              placeCircles[circleKey].on('click', function() {
                sendAppMessage({ type: 'PLACE_CLICK', placeId: p.id });
              });
            }

            // 2. High-Visibility Safe Zone Center Badge
            var badgeHtml = '<div style="position:relative;display:flex;align-items:center;justify-content:center;transform:translate(-50%, -50%);background:rgba(26,26,26,0.92);color:#D4AF37;border:1.5px solid #D4AF37;padding:3px 9px;border-radius:12px;box-shadow:0 3px 10px rgba(0,0,0,0.6);font-size:10px;font-weight:bold;white-space:nowrap;font-family:sans-serif;cursor:pointer;">' +
              '<span style="margin-right:4px;">🛡️</span>' + p.name +
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
              placeCircles[markerKey] = L.marker(pLatLng, { icon: badgeIcon, zIndexOffset: 800 }).addTo(map);
              placeCircles[markerKey].on('click', function() {
                sendAppMessage({ type: 'PLACE_CLICK', placeId: p.id });
              });
            }

            // 3. Route Geofence Points (if route geofence)
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
                placeCircles[startKey] = L.marker(pLatLng, {
                  icon: L.divIcon({ className: 'custom-icon', html: '<div style="background:#10B981;border:2px solid #FFF;border-radius:50%;width:16px;height:16px;box-shadow:0 0 10px rgba(16,185,129,0.9);"></div>', iconSize: [16, 16] })
                }).addTo(map).bindPopup("Start Point: " + p.name);
              }

              if (placeCircles[endKey]) {
                placeCircles[endKey].setLatLng(endLatLng);
              } else {
                placeCircles[endKey] = L.marker(endLatLng, {
                  icon: L.divIcon({ className: 'custom-icon', html: '<div style="background:#EF4444;border:2px solid #FFF;border-radius:50%;width:16px;height:16px;box-shadow:0 0 10px rgba(239,68,68,0.9);"></div>', iconSize: [16, 16] })
                }).addTo(map).bindPopup("End Point: " + p.name);
              }

              if (placeCircles[lineKey]) {
                placeCircles[lineKey].setLatLngs([pLatLng, endLatLng]);
              } else {
                placeCircles[lineKey] = L.polyline([pLatLng, endLatLng], {
                  color: '#60A5FA', weight: 3, dashArray: '6, 6'
                }).addTo(map);
              }
            }
          });

          Object.keys(placeCircles).forEach(function(id) {
            if (!currentPlaceIds[id]) {
              map.removeLayer(placeCircles[id]);
              delete placeCircles[id];
            }
          });
        }

        if (data.pois) {
          var currentPoiIds = {};
          data.pois.forEach(function(p) {
            currentPoiIds[p.id] = true;
            var poiLatLng = [p.lat, p.lng];
            var poiEmoji = '📍';
            var poiLabel = p.name ? p.name.toUpperCase() : 'POI';
            var bgGradient = 'linear-gradient(135deg, #EF4444, #B91C1C)';
            var arrowColor = '#B91C1C';

            if (p.category === 'hospital') {
              poiEmoji = '🏥';
              poiLabel = p.name || 'HOSPITAL';
              bgGradient = 'linear-gradient(135deg, #EF4444, #DC2626)';
              arrowColor = '#DC2626';
            } else if (p.category === 'police') {
              poiEmoji = '🛡️';
              poiLabel = p.name || 'POLICE';
              bgGradient = 'linear-gradient(135deg, #D4AF37, #B45309)';
              arrowColor = '#B45309';
            } else if (p.category === 'school') {
              poiEmoji = '🎓';
              poiLabel = p.name || 'SCHOOL';
              bgGradient = 'linear-gradient(135deg, #3B82F6, #2563EB)';
              arrowColor = '#2563EB';
            } else if (p.category === 'restaurant') {
              poiEmoji = '🍴';
              poiLabel = p.name || 'DINING';
              bgGradient = 'linear-gradient(135deg, #F59E0B, #D97706)';
              arrowColor = '#D97706';
            } else if (p.category === 'fuel') {
              poiEmoji = '⛽';
              poiLabel = p.name || 'FUEL';
              bgGradient = 'linear-gradient(135deg, #10B981, #059669)';
              arrowColor = '#059669';
            }

            var shortLabel = poiLabel.length > 22 ? poiLabel.substring(0, 20) + '...' : poiLabel;

            var htmlStr = '<div class="poi-badge-container">' +
              '<div class="poi-pill" style="background:' + bgGradient + ';">' +
              '<span>' + poiEmoji + '</span>' +
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

  const { colors, isDark, mapStyle: mapStyleSetting, setMapStyle: setMapStyleSetting } = useThemeStore();
  const { profile } = useAuthStore();
  const { activeCircle, members, places, circleFetched, fetchActiveCircle, fetchMembers, fetchPlaces, deletePlace, isLoading: circleLoading } = useCircleStore();
  
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [showMapLayerModal, setShowMapLayerModal] = useState(false);
  const currentMapCenterRef = useRef<{ lat: number; lng: number }>({ lat: 20.5937, lng: 78.9629 });

  useEffect(() => {
    const loadAppSettings = async () => {
      const u = await AsyncStorage.getItem('@circleguard_distance_unit');
      if (u) setDistanceUnit(u as 'km' | 'mi');
    };
    loadAppSettings();
  }, []);

  const lastHandledFocusKeyRef = useRef<string | null>(null);

  const handleCloseMemberCard = () => {
    setSelectedMember(null);
    if (navigation && (navigation as any).setParams) {
      (navigation as any).setParams({
        focusUserId: undefined,
        focusLat: undefined,
        focusLng: undefined,
        focusUserName: undefined,
      });
    }
  };

  // Automatically focus on exact shared location once when navigating from Circle Chat
  useEffect(() => {
    const focusKey = `${focusUserId || ''}_${focusLat || ''}_${focusLng || ''}`;
    if (!focusUserId && !focusLat && !focusLng) {
      lastHandledFocusKeyRef.current = null;
      return;
    }

    if (lastHandledFocusKeyRef.current === focusKey) {
      return; // Already focused and handled; do not force re-open on background state ticks
    }
    lastHandledFocusKeyRef.current = focusKey;

    if (focusLat && focusLng && !isNaN(focusLat) && !isNaN(focusLng)) {
      if (webViewRef.current) {
        const js = `if (window.map) { window.map.setView([${focusLat}, ${focusLng}], 17); } true;`;
        webViewRef.current.injectJavaScript(js);
      }

      const found = members.find(m => String(m.user_id).toLowerCase() === String(focusUserId).toLowerCase());
      if (found) {
        setSelectedMember({
          ...found,
          latitude: focusLat,
          longitude: focusLng,
        });
      } else if (focusUserId) {
        setSelectedMember({
          user_id: focusUserId,
          profile: { full_name: focusUserName || 'Circle Member', avatar_url: null },
          isOnline: true,
          latitude: focusLat,
          longitude: focusLng,
        });
      }
    } else if (focusUserId) {
      const found = members.find(m => String(m.user_id).toLowerCase() === String(focusUserId).toLowerCase());
      const loc = locations.find(l => String(l.user_id).toLowerCase() === String(focusUserId).toLowerCase());
      const targetLat = loc?.latitude || found?.latitude;
      const targetLng = loc?.longitude || found?.longitude;

      if (targetLat && targetLng && webViewRef.current) {
        const js = `if (window.map) { window.map.setView([${targetLat}, ${targetLng}], 17); } true;`;
        webViewRef.current.injectJavaScript(js);
      }
      if (found) setSelectedMember(found);
    }
  }, [focusUserId, focusLat, focusLng, focusUserName, members, locations]);

  const handleDeleteSelectedPlace = async () => {
    if (!selectedPlace) return;
    const placeToDelete = selectedPlace;
    const placeId = placeToDelete.id;

    Alert.alert(
      'Delete Bookmark',
      `Remove "${placeToDelete.name}" from your circle geofences?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSelectedPlace(null);

              // Instantly remove Leaflet map circle layers from Webview with 0ms lag
              if (webViewRef.current) {
                const js = `
                  if (window.map && window.placeCircles) {
                    var keys = ["circle_${placeId}", "marker_${placeId}", "${placeId}", "start_${placeId}", "end_${placeId}", "line_${placeId}"];
                    keys.forEach(function(k) {
                      if (window.placeCircles[k]) {
                        try { window.map.removeLayer(window.placeCircles[k]); } catch(e) {}
                        delete window.placeCircles[k];
                      }
                    });
                  }
                  true;
                `;
                webViewRef.current.injectJavaScript(js);
              }

              await deletePlace(placeId);
              pushMapData();

              Alert.alert('Bookmark Removed', `"${placeToDelete.name}" has been deleted.`);
            } catch (e: any) {
              Alert.alert('Error Deleting Bookmark', e.message || 'Failed to delete bookmark');
            }
          }
        }
      ]
    );
  };

  // POI Categories & Nearby Places State
  const [selectedPoiCategory, setSelectedPoiCategory] = useState<string | null>(null);
  const [poiList, setPoiList] = useState<any[]>([]);
  const [loadingPois, setLoadingPois] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<any>(null);

  const poiCategories = [
    { id: 'hospital', label: 'HOSPITALS', icon: 'medical', color: '#EF4444' },
    { id: 'school', label: 'SCHOOLS', icon: 'school', color: '#3B82F6' },
    { id: 'police', label: 'POLICE STATIONS', icon: 'shield-checkmark', color: '#D4AF37' },
    { id: 'restaurant', label: 'DINING & CAFES', icon: 'restaurant', color: '#F59E0B' },
    { id: 'fuel', label: 'FUEL STATIONS', icon: 'car', color: '#10B981' },
    { id: 'member', label: 'MEMBERS', icon: 'person', color: '#A855F7' },
    { id: 'place', label: 'SAVED PLACES', icon: 'bookmark', color: '#EC4899' },
  ];

  const fetchNearbyPois = async (category: string) => {
    if (selectedPoiCategory === category) {
      setSelectedPoiCategory(null);
      setPoiList([]);
      handleSearchChange('');
      return;
    }

    setSelectedPoiCategory(category);
    setLoadingPois(true);
    setSelectedPoi(null);

    if (category === 'member') {
      handleSearchChange('member');
      setLoadingPois(false);
      return;
    }

    if (category === 'place') {
      handleSearchChange('place');
      setLoadingPois(false);
      return;
    }

    const lat = userLoc?.latitude || 20.5937;
    const lng = userLoc?.longitude || 78.9629;
    const isMiles = distanceUnit === 'mi';

    // 0ms instant display
    const instant = generateFallbackPois(category, lat, lng, isMiles);
    setPoiList(instant);
    handleSearchChange(category);

    try {
      const results = await fetchCategoryPois(category, lat, lng, isMiles);
      if (results && results.length > 0) {
        setPoiList(results);
      }
    } catch (e) {
      console.warn('POI fetch error:', e);
    } finally {
      setLoadingPois(false);
    }
  };

  const fetchAllNearbyPois = async (lat?: number, lng?: number, targetCategories?: string[]) => {
    setLoadingPois(true);
    const categories = targetCategories && targetCategories.length > 0 
      ? targetCategories 
      : ['hospital', 'school', 'police', 'restaurant', 'fuel'];

    const isMiles = distanceUnit === 'mi';

    // Accurately resolve target center (User GPS -> Active Member -> Viewport Center)
    let targetLat = lat;
    let targetLng = lng;

    if (!targetLat || !targetLng || (targetLat === 20.5937 && targetLng === 78.9629 && userLoc?.latitude)) {
      targetLat = userLoc?.latitude;
      targetLng = userLoc?.longitude;
    }
    if (!targetLat || !targetLng) {
      const activeMem = members.find(m => m.latitude && m.longitude);
      const activeLoc = locations.find(l => l.latitude && l.longitude);
      targetLat = activeLoc?.latitude || activeMem?.latitude || currentMapCenterRef.current.lat || 20.5937;
      targetLng = activeLoc?.longitude || activeMem?.longitude || currentMapCenterRef.current.lng || 78.9629;
    }

    // 0ms instant display of all filtered categories
    const instantList = categories.flatMap(cat => generateFallbackPois(cat, targetLat!, targetLng!, isMiles));
    setPoiList(instantList);

    // Immediately push to Leaflet map layer
    if (webViewRef.current) {
      const jsCode = `if (window.updateMapData) { window.updateMapData({ pois: ${JSON.stringify(instantList)} }); } true;`;
      webViewRef.current.injectJavaScript(jsCode);
    }

    try {
      const requests = categories.map(cat =>
        fetchCategoryPois(cat, targetLat!, targetLng!, isMiles).catch(() => generateFallbackPois(cat, targetLat!, targetLng!, isMiles))
      );
      const results = await Promise.all(requests);
      const combined = results.flat();
      if (combined && combined.length > 0) {
        setPoiList(combined);
        if (webViewRef.current) {
          const jsCode = `if (window.updateMapData) { window.updateMapData({ pois: ${JSON.stringify(combined)} }); } true;`;
          webViewRef.current.injectJavaScript(jsCode);
        }
      }
    } catch (e) {
      console.warn('Auto POI fetch error:', e);
    } finally {
      setLoadingPois(false);
    }
  };

  // Map is clean & plain by default showing only User & Circle Members





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

  const handleFitAllMembers = () => {
    let coords: [number, number][] = [];
    const centerLat = userLoc?.latitude || 20.5937;
    const centerLng = userLoc?.longitude || 78.9629;

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

    combinedMembers.forEach((m) => {
      const isSelf = String(m.user_id).toLowerCase() === String(profile?.id).toLowerCase();
      const loc = locations.find(l => String(l.user_id).toLowerCase() === String(m.user_id).toLowerCase());
      
      let lat = 0;
      let lng = 0;

      if (isSelf && userLoc && userLoc.latitude !== 0 && userLoc.longitude !== 0) {
        lat = userLoc.latitude;
        lng = userLoc.longitude;
      } else if (loc) {
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
            map.fitBounds(b, { padding: [60, 60], maxZoom: 16 });
          } catch(e) {}
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  };

  const handleLocateMe = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc && loc.coords) {
        setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (webViewRef.current) {
          const js = `if (map) { map.setView([${loc.coords.latitude}, ${loc.coords.longitude}], 16); } true;`;
          webViewRef.current.injectJavaScript(js);
        }
      }
    } catch (e) {
      console.warn("GPS locate error:", e);
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

    // 1. Filter local circle members
    const matchedMembers = members.filter(m => 
      queryLower === 'member' || m.profile?.full_name?.toLowerCase().includes(queryLower)
    );

    // 2. Filter bookmarked safe places
    const matchedPlaces = places.filter(p => 
      queryLower === 'place' || p.name?.toLowerCase().includes(queryLower)
    );

    // 3. Filter nearby POIs (Hospitals, Schools, Police, Dining, Fuel)
    const matchedPois = poiList.filter(p => 
      p.name?.toLowerCase().includes(queryLower) ||
      p.category?.toLowerCase().includes(queryLower) ||
      (queryLower.includes('hosp') && p.category === 'hospital') ||
      (queryLower.includes('school') && p.category === 'school') ||
      (queryLower.includes('police') && p.category === 'police') ||
      ((queryLower.includes('rest') || queryLower.includes('food') || queryLower.includes('cafe')) && p.category === 'restaurant') ||
      ((queryLower.includes('fuel') || queryLower.includes('gas') || queryLower.includes('petrol')) && p.category === 'fuel')
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
        } else {
          // Fast worldwide photon geocoding fallback
          const photonRes = await fetch(`https://photon.komoot.io/api/?q=${queryEncoded}&limit=8`);
          if (photonRes.ok) {
            const photonJson = await photonRes.json();
            if (Array.isArray(photonJson?.features)) {
              const photonLocations = photonJson.features.map((f: any) => {
                const props = f.properties || {};
                const nameParts = [props.name, props.street, props.city, props.state, props.country].filter(Boolean);
                return {
                  id: f.id || Math.random().toString(),
                  name: nameParts.join(', ') || props.name || 'Searched Location',
                  lat: f.geometry.coordinates[1],
                  lng: f.geometry.coordinates[0],
                  type: props.osm_value || 'location'
                };
              });
              setSearchResults(prev => ({ ...prev, locations: photonLocations }));
            }
          }
        }
      } catch (err) {
        console.warn('Geocoding search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleClosePoi = () => {
    setSelectedPoi(null);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.showSearchedPlace) { window.showSearchedPlace(null, null, null); } true;`);
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

  // Refresh State
  const [isRefreshingMap, setIsRefreshingMap] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshingMap(true);
    try {
      if (profile?.id) {
        await fetchActiveCircle(profile.id);
      }
      if (activeCircle?.id) {
        await Promise.all([
          fetchMembers(activeCircle.id),
          fetchPlaces(activeCircle.id),
          fetchLocations(),
        ]);
      }
      pushMapData();
      Alert.alert('Sync Complete', 'Refreshed latest member locations, online statuses, and geofences!');
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setIsRefreshingMap(false);
    }
  };

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'sos' | 'place'>('sos');
  
  // Add Place Modal State
  const [addPlaceVisible, setAddPlaceVisible] = useState(false);
  const [addPlaceCoord, setAddPlaceCoord] = useState<{latitude: number, longitude: number} | null>(null);

  // Search Filter Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilterCategories, setActiveFilterCategories] = useState<string[]>([]);
  
  const webViewRef = useRef<WebView | null>(null);
  const alertedProximity = useRef<Set<string>>(new Set());
  const lastHistorySavedPoint = useRef<{ lat: number; lng: number; timeMs: number } | null>(null);

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
          const { scheduleLocalNotification } = require('../services/PushNotificationService');
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

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location services to use map tracking.');
        return;
      }

      try {
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (currentLoc?.coords) {
          setUserLoc({ latitude: currentLoc.coords.latitude, longitude: currentLoc.coords.longitude });
        }
      } catch (e) {
        console.warn("Initial location fetch error:", e);
      }
      
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000, // Fast 3-second live sync cycle
          distanceInterval: 0,
        },
        async (loc) => {
          if (!profile) return;
          setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          
          try {
            let battPct = 100;
            try {
              const battLevel = await Battery.getBatteryLevelAsync();
              if (battLevel >= 0) battPct = Math.round(battLevel * 100);
            } catch (e) {}

            const rawLat = loc.coords.latitude;
            const rawLng = loc.coords.longitude;
            const speed = loc.coords.speed || 0;
            const isDriving = speed > 5.5;

            const livePoint = `POINT(${rawLng} ${rawLat})`;
            await supabase.from('locations').upsert({
              user_id: profile.id,
              geom: livePoint,
              accuracy_m: loc.coords.accuracy,
              speed_mps: speed,
              battery_pct: battPct,
              is_driving: isDriving,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

            // 15-meter GPS Drift & Noise Filter for location_history logging
            const nowMs = Date.now();
            let shouldSaveHistory = false;

            if (!lastHistorySavedPoint.current) {
              shouldSaveHistory = true;
            } else {
              const distMeters = getDistanceInMeters(lastHistorySavedPoint.current.lat, lastHistorySavedPoint.current.lng, rawLat, rawLng);
              const timeDiffSec = (nowMs - lastHistorySavedPoint.current.timeMs) / 1000;

              // Save history point ONLY if user actually moved >= 15 meters OR >= 5 minutes elapsed
              if (distMeters >= 15 || timeDiffSec >= 300) {
                shouldSaveHistory = true;
              }
            }

            if (shouldSaveHistory) {
              // Save authentic un-fuzzed GPS position for genuine history logging
              const authenticPoint = `POINT(${rawLng} ${rawLat})`;
              await supabase.from('location_history').insert({
                user_id: profile.id,
                geom: authenticPoint,
                speed_mps: speed,
                recorded_at: new Date(nowMs).toISOString()
              });
              lastHistorySavedPoint.current = { lat: rawLat, lng: rawLng, timeMs: nowMs };
            }
          } catch (err) {
            console.error('Error updating location:', err);
          }
        }
      );
    })();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [profile]);

  useEffect(() => {
    if (!activeCircle) return;
    
    // Fetch members, places, and locations in parallel for sub-second instant load
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
    }, 3000); // 3-second rapid polling
      
    const sosChannel = supabase
      .channel(`map_sos_${activeCircle.id}_${channelUid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_alerts', filter: `circle_id=eq.${activeCircle.id}` },
        (payload) => {
          if (payload.new.user_id === profile?.id) return;
          if (payload.new.status !== 'active') return;
          
          const sender = members.find(m => m.user_id === payload.new.user_id);
          const name = sender?.profile?.full_name || 'A circle member';
          
          const title = 'URGENT: CIRCLE DISTRESS SIGNAL';
          const msg = `${name} triggered an emergency SOS distress alert.`;
          setModalTitle(title);
          setModalMessage(msg);
          setModalType('sos');
          setModalVisible(true);

          const { scheduleLocalNotification } = require('../services/PushNotificationService');
          scheduleLocalNotification(title, msg);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(placesChannel);
      supabase.removeChannel(sosChannel);
      clearInterval(fallbackInterval);
    };
  }, [activeCircle]);

  // Instant location & circle sync every time user switches to the Map tab
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
      let query1 = supabase
        .from('locations')
        .select('user_id, latitude, longitude, geom, battery_pct, is_driving, speed_mps, activity_state, updated_at');

      let { data, error }: { data: any[] | null; error: any } = await query1;

      if (error && (error.code === '42703' || error.message?.includes('latitude') || error.message?.includes('schema cache'))) {
        const res2 = await supabase
          .from('locations')
          .select('user_id, geom, battery_pct, is_driving, speed_mps, activity_state, updated_at');
        data = res2.data;
        error = res2.error;
      }

      if (error) {
        console.error('Error fetching locations:', error);
      }

      let allLocs: any[] = data || [];

      // Query latest location_history fix for any member not currently in the live locations table
      if (members && members.length > 0) {
        for (const m of members) {
          if (!allLocs.some(l => String(l.user_id).toLowerCase() === String(m.user_id).toLowerCase())) {
            try {
              const { data: hist } = await supabase
                .from('location_history')
                .select('user_id, geom, speed_mps, recorded_at')
                .eq('user_id', m.user_id)
                .order('recorded_at', { ascending: false })
                .limit(1);
              if (hist && hist.length > 0) {
                allLocs.push(hist[0]);
              }
            } catch (e) {}
          }
        }
      }

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
      console.error('Error fetching locations:', err);
    }
  };

  const refreshPlaces = async () => {
    if (!activeCircle?.id) return;
    await fetchPlaces(activeCircle.id);
  };

  const savePlace = async (name: string, radius: number, selectedUserIds: string[]) => {
    if (!activeCircle || !profile || !addPlaceCoord) return;
    try {
      const point = `POINT(${addPlaceCoord.longitude} ${addPlaceCoord.latitude})`;
      const { data: newPlace, error } = await supabase.from('places').insert({
        circle_id: activeCircle.id,
        name: name,
        radius_m: radius,
        geom: point,
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

      Alert.alert("Success", `Safe place "${name}" created!`);
      setAddPlaceVisible(false);
      fetchPlaces(activeCircle.id);
    } catch(e: any) {
      Alert.alert("Error", e.message || "Failed to create place");
    }
  };

  const pushMapData = () => {
    if (!webViewRef.current) return;
    const centerLat = focusLat && !isNaN(focusLat) ? focusLat : (userLoc?.latitude || 20.5937);
    const centerLng = focusLng && !isNaN(focusLng) ? focusLng : (userLoc?.longitude || 78.9629);

    const mapData = {
      isDark: isDark,
      mapStyle: mapStyleSetting,
      center: [centerLat, centerLng],
      targetFocus: (focusLat && focusLng && !isNaN(focusLat) && !isNaN(focusLng)) ? [focusLat, focusLng, 17] : null,
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

        locations.forEach(loc => {
          if (loc.user_id && !combinedMembers.some(m => String(m.user_id).toLowerCase() === String(loc.user_id).toLowerCase())) {
            combinedMembers.push({
              user_id: loc.user_id,
              circle_id: activeCircle?.id || '',
              role: 'member',
              joined_at: new Date().toISOString(),
              profile: { full_name: 'Circle Member', avatar_url: null },
              isOnline: true,
            } as any);
          }
        });

        return combinedMembers
          .map((m, idx) => {
            const isSelf = String(m.user_id).toLowerCase() === String(profile?.id).toLowerCase();
            const loc = locations.find(l => String(l.user_id).toLowerCase() === String(m.user_id).toLowerCase());
            
            let lat = 0;
            let lng = 0;
            let isRealLocation = false;

            if (isSelf && userLoc && userLoc.latitude !== 0 && userLoc.longitude !== 0) {
              // Always prioritize device's live high-accuracy GPS for oneself
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

            // Fallback: If member hasn't broadcasted GPS yet, position them near circle center so their avatar is always visible on the map
            if (!lat || !lng || lat === 0 || lng === 0) {
              const baseLat = userLoc?.latitude || (places[0] ? parseLocationPoint(places[0]).latitude : 20.5937);
              const baseLng = userLoc?.longitude || (places[0] ? parseLocationPoint(places[0]).longitude : 78.9629);
              const angle = (idx * (360 / Math.max(1, combinedMembers.length))) * (Math.PI / 180);
              lat = baseLat + 0.0015 * Math.cos(angle);
              lng = baseLng + 0.0015 * Math.sin(angle);
            }

            const isHideOnline = !!m.profile?.hide_online_presence;
            const isGhost = !!m.profile?.is_ghost_mode;

            const isMiles = distanceUnit === 'mi';
            const speedMps = loc?.speed_mps || 0;
            const speedFormatted = isMiles ? Math.round(speedMps * 2.23694) : Math.round(speedMps * 3.6);
            const unitText = isMiles ? 'mph' : 'km/h';

            let activityText = 'Stationary';
            if (!isRealLocation) {
              activityText = 'Location Pending';
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
              name: isSelf ? 'You' : (m.profile?.full_name || 'Member'),
              initial: String(m.profile?.full_name || (isSelf ? 'Y' : 'M')).charAt(0).toUpperCase(),
              avatarUrl: m.profile?.avatar_url || null,
              role: m.role || 'member',
              isOnline: (isGhost || isHideOnline) ? false : (m.isOnline ?? (isRealLocation ? true : false)),
              lastSeenText: isGhost ? 'Ghost Mode' : (isHideOnline ? 'Offline' : (m.lastSeenText || (isRealLocation ? 'Online' : 'Location Pending'))),
              batteryPct: loc?.battery_pct || m.batteryPct || 100,
              activityText,
            };
          });
      })(),
      places: places.map(p => {
        const pt = parseLocationPoint(p);
        const radiusNum = typeof p.radius_m === 'number' ? p.radius_m : parseFloat((p as any).radius_m || (p as any).radius || 150);
        return {
          id: p.id,
          lat: pt.latitude,
          lng: pt.longitude,
          endLat: p.end_lat || null,
          endLng: p.end_lng || null,
          name: p.name,
          radius: isNaN(radiusNum) || radiusNum <= 0 ? 150 : radiusNum
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
    }, 100); // 100ms micro-batch throttle prevents JS main thread blocking
  };

  useEffect(() => {
    schedulePushMapData();
    return () => {
      if (mapPushTimerRef.current) clearTimeout(mapPushTimerRef.current);
    };
  }, [userLoc, locations, places, members, poiList, activeFilterCategories, isDark, mapStyleSetting]);

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
        onLoadEnd={pushMapData}
        onMessage={(event) => {
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.type === 'MAP_READY') {
              pushMapData();
            } else if (msg.type === 'MAP_MOVE' && msg.lat && msg.lng) {
              currentMapCenterRef.current = { lat: msg.lat, lng: msg.lng };
            } else if (msg.type === 'LONG_PRESS') {
              setAddPlaceCoord({ latitude: msg.lat, longitude: msg.lng });
              setAddPlaceVisible(true);
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
                setSelectedPlace(found);
              }
            } else if (msg.type === 'POI_CLICK') {
              const found = poiList.find(p => p.id === msg.poiId);
              if (found) {
                setSelectedMember(null);
                setSelectedPlace(null);
                setSelectedPoi(found);
              }
            }
          } catch(e) {}
        }}
      />

      {/* Top Search Bar & Control Overlay */}
      <View style={styles.searchOverlay}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#FFFFFF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search member, landmark, road or area..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={LUXURY_THEME.colors.accentGold} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
              <Ionicons name="options-outline" size={18} color={activeFilterCategories.length > 0 ? LUXURY_THEME.colors.accentGold : '#FFFFFF'} />
            </TouchableOpacity>
          )}
        </View>

        {/* Dropdown Results Box */}
        {(searchResults.members.length > 0 || searchResults.places.length > 0 || searchResults.pois.length > 0 || searchResults.locations.length > 0) ? (
          <ScrollView style={styles.searchResultsDropdown} keyboardShouldPersistTaps="handled">
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
                <Ionicons name="bookmark-outline" size={16} color={colors.accentGold} />
                <View style={styles.searchResultTextWrapper}>
                  <Text style={[styles.searchResultTitle, { color: colors.foreground }]}>{p.name}</Text>
                  <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>Bookmarked Place</Text>
                </View>
              </TouchableOpacity>
            ))}

            {searchResults.pois.map(p => {
              let iconName = 'location-outline';
              let iconColor = colors.foreground;
              let catTag = 'Nearby Place';

              if (p.category === 'hospital') {
                iconName = 'medical';
                iconColor = '#EF4444';
                catTag = 'Hospital / Clinic';
              } else if (p.category === 'school') {
                iconName = 'school';
                iconColor = '#3B82F6';
                catTag = 'School / University';
              } else if (p.category === 'police') {
                iconName = 'shield-checkmark';
                iconColor = '#D4AF37';
                catTag = 'Police Station';
              } else if (p.category === 'restaurant') {
                iconName = 'restaurant';
                iconColor = '#F59E0B';
                catTag = 'Dining & Cafe';
              } else if (p.category === 'fuel') {
                iconName = 'car';
                iconColor = '#10B981';
                catTag = 'Fuel Station';
              }

              return (
                <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => handleSelectSearchResult(p, 'poi')}>
                  <Ionicons name={iconName as any} size={16} color={iconColor} />
                  <View style={styles.searchResultTextWrapper}>
                    <Text style={[styles.searchResultTitle, { color: colors.foreground }]}>{p.name}</Text>
                    <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>{catTag} • {p.distanceKm ? `${p.distanceKm} km away` : 'Nearby'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {searchResults.locations.map(loc => (
              <TouchableOpacity key={loc.id} style={styles.searchResultItem} onPress={() => handleSelectSearchResult(loc, 'location')}>
                <Ionicons name="location-outline" size={16} color={colors.foreground} />
                <View style={styles.searchResultTextWrapper}>
                  <Text style={[styles.searchResultTitle, { color: colors.foreground }]} numberOfLines={1}>{loc.name}</Text>
                  <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>Map Location</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {/* Horizontal Member Quick Selector Bar */}
        {members.length > 0 ? (
          <View style={styles.memberAvatarBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberAvatarContent}>
              {members.map(m => {
                const isSelected = selectedMember?.user_id === m.user_id;
                const nameFirst = String(m.profile?.full_name || 'Member').split(' ')[0];

                return (
                  <TouchableOpacity
                    key={m.user_id}
                    style={[
                      styles.avatarChip,
                      m.isOnline ? styles.avatarChipOnline : styles.avatarChipOffline,
                      isSelected ? styles.avatarChipSelected : null
                    ]}
                    onPress={() => {
                      setSelectedPoi(null);
                      setSelectedPlace(null);
                      setSelectedMember(m);
                      const isSelf = String(m.user_id).toLowerCase() === String(profile?.id).toLowerCase();
                      const loc = locations.find(l => String(l.user_id).toLowerCase() === String(m.user_id).toLowerCase());
                      
                      let targetLat = isSelf ? (userLoc?.latitude || 0) : 0;
                      let targetLng = isSelf ? (userLoc?.longitude || 0) : 0;

                      if (loc) {
                        const pt = parseLocationPoint(loc);
                        if (pt.latitude !== 0 && pt.longitude !== 0) {
                          targetLat = pt.latitude;
                          targetLng = pt.longitude;
                        }
                      }

                      if (targetLat !== 0 && targetLng !== 0 && webViewRef.current) {
                        const js = `if (map) { map.setView([${targetLat}, ${targetLng}], 16); } true;`;
                        webViewRef.current.injectJavaScript(js);
                      }
                    }}
                  >
                    <View style={[styles.miniDot, { backgroundColor: m.isOnline ? '#10B981' : '#9CA3AF' }]} />
                    <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{nameFirst.toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Member Details Bottom Card */}
      {selectedMember ? (() => {
        const memberLoc = locations.find(l => l.user_id === selectedMember.user_id);
        const lat = memberLoc?.latitude || userLoc?.latitude || 0;
        const lng = memberLoc?.longitude || userLoc?.longitude || 0;
        
        let distText = 'Nearby';
        if (userLoc && lat && lng) {
          const meters = getDistanceInMeters(userLoc.latitude, userLoc.longitude, lat, lng);
          distText = meters > 1000 ? `${(meters / 1000).toFixed(1)} km away` : `${Math.round(meters)} m away`;
        }

        const handleNavigate = () => {
          if (lat && lng) {
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
          } else {
            Alert.alert('Location Unavailable', 'No location coordinates found for this member.');
          }
        };

        const handleCall = () => {
          const phone = selectedMember.profile?.phone;
          if (phone) {
            Linking.openURL(`tel:${phone}`);
          } else {
            Alert.alert('Phone Unavailable', 'No phone number saved for this member.');
          }
        };

        const handleMessage = () => {
          const phone = selectedMember.profile?.phone;
          if (phone) {
            Linking.openURL(`sms:${phone}`);
          } else {
            Alert.alert('Phone Unavailable', 'No phone number saved for this member.');
          }
        };

        return (
          <View style={styles.memberCardSheet}>
            <View style={styles.memberCardHeader}>
              <View style={styles.memberAvatar}>
                <Text style={styles.avatarText}>
                  {String(selectedMember.profile?.full_name || 'M').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberMainInfo}>
                <Text style={styles.memberCardName}>{selectedMember.profile?.full_name || 'Circle Member'}</Text>
                <View style={styles.safeBadge}>
                  <View style={[styles.safeDot, { backgroundColor: selectedMember.isOnline ? '#10B981' : '#9CA3AF' }]} />
                  <Text style={[styles.safeBadgeText, { color: selectedMember.isOnline ? '#10B981' : '#9CA3AF' }]}>
                    {selectedMember.isOnline ? 'ONLINE & ACTIVE' : (selectedMember.lastSeenText || 'OFFLINE').toUpperCase()}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={handleCloseMemberCard}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                style={{ padding: 4 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Ionicons name="battery-charging-outline" size={16} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.metricText}>
                  {memberLoc?.battery_pct ? `BATTERY ${memberLoc.battery_pct}%` : 'BATTERY OPTIMAL'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="car-outline" size={16} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.metricText}>
                  {memberLoc?.is_driving ? 'DRIVING' : 'STATIONARY'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="time-outline" size={16} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.metricText}>LIVE GPS SYNC</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="navigate-outline" size={16} color={LUXURY_THEME.colors.accentGold} />
                <Text style={styles.metricText}>{distText.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.cardActionRow}>
              <TouchableOpacity style={styles.cardBtnPrimary} onPress={handleNavigate} activeOpacity={0.8}>
                <Ionicons name="compass" size={16} color="#0D0E12" />
                <Text style={styles.cardBtnPrimaryText}>NAVIGATE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cardBtnSecondary} onPress={handleCall} activeOpacity={0.8}>
                <Ionicons name="call" size={16} color="#FFFFFF" />
                <Text style={styles.cardBtnSecondaryText}>CALL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cardBtnSecondary} onPress={handleCloseMemberCard} activeOpacity={0.8}>
                <Text style={styles.cardBtnSecondaryText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })() : null}

      {/* Bookmarked Place Bottom Card */}
      {selectedPlace ? (
        <View style={styles.memberCardSheet}>
          <View style={styles.memberCardHeader}>
            <View style={[styles.memberAvatar, { borderColor: '#D4AF37' }]}>
              <Ionicons name="bookmark" size={20} color="#D4AF37" />
            </View>
            <View style={styles.memberMainInfo}>
              <Text style={styles.memberCardName}>{selectedPlace.name}</Text>
              <View style={styles.safeBadge}>
                <View style={styles.safeDot} />
                <Text style={styles.safeBadgeText}>GEOFENCE RADIUS: {selectedPlace.radius_m || selectedPlace.radius || 150}M</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedPlace(null)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={[styles.cardActionRow, { marginTop: 16 }]}>
            <TouchableOpacity style={styles.cardBtnDanger} onPress={handleDeleteSelectedPlace} activeOpacity={0.8}>
              <Ionicons name="trash" size={16} color="#FFFFFF" />
              <Text style={styles.cardBtnDangerText}>DELETE BOOKMARK</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cardBtnSecondary} onPress={() => setSelectedPlace(null)} activeOpacity={0.8}>
              <Text style={styles.cardBtnSecondaryText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Selected POI (Hospital, School, Police, Restaurant, Fuel) Bottom Card */}
      {selectedPoi ? (
        <View style={styles.memberCardSheet}>
          <View style={styles.memberCardHeader}>
            <View style={[styles.memberAvatar, { backgroundColor: '#D4AF37', borderColor: '#D4AF37' }]}>
              <Ionicons name="location" size={20} color="#0D0E12" />
            </View>
            <View style={styles.memberMainInfo}>
              <Text style={styles.memberCardName}>{selectedPoi.name}</Text>
              <Text style={styles.poiAddressText} numberOfLines={2}>{selectedPoi.subText}</Text>
            </View>
              <TouchableOpacity 
                onPress={handleClosePoi}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                style={{ padding: 4 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={[styles.cardActionRow, { marginTop: 16 }]}>
              <TouchableOpacity 
                style={styles.cardBtnPrimary} 
                onPress={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedPoi.lat},${selectedPoi.lng}`;
                  Linking.openURL(url);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="compass" size={16} color="#0D0E12" />
                <Text style={styles.cardBtnPrimaryText}>NAVIGATE</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cardBtnSecondary} 
                onPress={() => {
                  setAddPlaceCoord({ latitude: selectedPoi.lat, longitude: selectedPoi.lng });
                  setAddPlaceVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="bookmark" size={16} color="#FFFFFF" />
                <Text style={styles.cardBtnSecondaryText}>BOOKMARK</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cardBtnSecondary} 
                onPress={handleClosePoi}
                activeOpacity={0.8}
              >
                <Text style={styles.cardBtnSecondaryText}>CLOSE</Text>
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
            dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            vector: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          };
          const newTile = tileUrls[s] || tileUrls.vector;

          if (webViewRef.current) {
            const js = `if (window.changeTileUrl) { window.changeTileUrl('${newTile}', '${s}'); } true;`;
            webViewRef.current.injectJavaScript(js);
          }
        }}
      />

      {/* Floating Map Controls: Layers Selector, Locate Me, Fit Members & Zoom Controls */}
      <View style={[styles.floatingControls, selectedMember || selectedPlace || selectedPoi ? { bottom: 275 } : { bottom: 25 }]}>
        <SpringTouchable style={[styles.controlBtn, { borderColor: '#D4AF37', backgroundColor: 'rgba(212, 175, 55, 0.15)' }]} onPress={handleLocateMe} scaleTo={0.88}>
          <Ionicons name="locate" size={22} color="#D4AF37" />
        </SpringTouchable>

        <SpringTouchable style={[styles.controlBtn, { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.15)' }]} onPress={handleFitAllMembers} scaleTo={0.88}>
          <Ionicons name="people-sharp" size={20} color="#10B981" />
        </SpringTouchable>

        <SpringTouchable style={[styles.controlBtn, { borderColor: '#D4AF37' }]} onPress={() => setShowMapLayerModal(true)} scaleTo={0.88}>
          <Ionicons name="layers" size={20} color="#D4AF37" />
        </SpringTouchable>

        <SpringTouchable style={styles.controlBtn} onPress={handleZoomIn} scaleTo={0.88}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </SpringTouchable>

        <SpringTouchable style={styles.controlBtn} onPress={handleZoomOut} scaleTo={0.88}>
          <Ionicons name="remove" size={22} color="#FFFFFF" />
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
    marginBottom: 20,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: LUXURY_THEME.colors.accentGold,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberMainInfo: {
    flex: 1,
  },
  memberCardName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: LUXURY_THEME.typography.fontFamilySerif,
    fontWeight: 'bold',
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
    backgroundColor: LUXURY_THEME.colors.accentGold,
  },
  safeBadgeText: {
    color: LUXURY_THEME.colors.accentGold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metricItem: {
    width: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardBtnPrimary: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#D4AF37',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  cardBtnPrimaryText: {
    color: '#0D0E12',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cardBtnSecondary: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardBtnSecondaryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  cardBtnDanger: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cardBtnDangerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  memberAvatarBar: {
    marginTop: 8,
  },
  memberAvatarContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  avatarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  avatarChipOnline: {
    backgroundColor: 'rgba(22, 24, 31, 0.9)',
    borderColor: '#10B981',
  },
  avatarChipOffline: {
    backgroundColor: 'rgba(22, 24, 31, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarChipSelected: {
    borderColor: '#D4AF37',
    borderWidth: 1.5,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(22, 24, 31, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    borderRadius: 16,
    padding: 6,
    gap: 8,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    zIndex: 30,
  },
  controlBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotateRow: {
    flexDirection: 'row',
    gap: 4,
  },
  controlBtnSmall: {
    width: 20,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: LUXURY_THEME.colors.accentGold,
    marginTop: 1,
  },
  controlDivider: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 2,
  },
  poiFilterBar: {
    marginTop: 6,
  },
  poiFilterContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  poiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 24, 31, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  poiChipActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    borderColor: '#D4AF37',
  },
  poiChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  poiChipTextActive: {
    color: '#D4AF37',
  },
  poiAddressText: {
    fontSize: 11,
    color: LUXURY_THEME.colors.textMuted,
    marginTop: 2,
  },
});
