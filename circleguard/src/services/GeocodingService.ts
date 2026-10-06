/**
 * GeocodingService.ts
 *
 * Ultra-High-Precision Multi-Tiered Reverse Geocoding Engine.
 * Features:
 * 1. Safe Places geofence matching (instantly badges "Home", "Office", etc.)
 * 2. Multi-tier resolution: Native (Google/Apple) -> OpenStreetMap Nominatim -> Photon OSM
 * 3. Intelligent token cleaning: Strips Plus Codes (e.g. 7M8R+4G), cleans duplicates, extracts house numbers & POI landmarks
 * 4. High-efficiency in-memory & AsyncStorage coordinate grid caching (~11m resolution)
 * 5. Full address synthesis tailored for live telemetry, emergency dispatch, and sharing
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateHaversineDistanceMeters } from './RoadRoutingService';

export interface GeocodedAddress {
  headline: string;           // e.g. "42 Baker Street" or "Oakwood Apts, 3rd Cross Rd"
  subtitle: string;           // e.g. "Indiranagar, Bengaluru, 560038"
  fullAddress: string;        // Complete deduplicated string for clipboard/share
  safePlaceName?: string;     // Circle safe place name if within geofence
  isSafePlace: boolean;
  buildingOrPoi?: string;     // Building/Amenity/Shop name
  houseNumber?: string;       // House/Building number
  road?: string;              // Road/Street name
  neighbourhood?: string;     // Suburb/Quarter/Locality
  district?: string;          // City district/borough
  city?: string;              // City or Town
  state?: string;             // State or Region
  postalCode?: string;        // Pincode/Zip
  country?: string;           // Country
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface SafePlaceTarget {
  id?: string;
  name: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  radius_m?: number;
  radius?: number;
  geom?: any;
}

// In-memory cache for ultra-fast < 1ms synchronous lookups
const inMemoryGeocodeCache = new Map<string, GeocodedAddress>();
const CACHE_STORAGE_PREFIX = '@circleguard_geocode_cache_v2_';

/**
 * Filter out invalid, empty, or Plus Code tokens
 */
function cleanAddressToken(token?: string | null): string {
  if (!token) return '';
  const trimmed = token.trim();
  if (!trimmed) return '';

  // Reject Plus Codes (e.g., "7M8R+4G", "8F9V+28 Bengaluru", "4Q77+XW")
  if (/^[A-Z0-9]{4,}\+[A-Z0-9]{2,}/i.test(trimmed)) return '';
  if (trimmed.includes('+') && trimmed.length <= 12) return '';

  // Reject raw coordinate strings (e.g. "12.3456, 78.9012")
  if (/^[-+]?\d{1,3}\.\d+,\s*[-+]?\d{1,3}\.\d+$/.test(trimmed)) return '';

  // Reject generic placeholders
  const lower = trimmed.toLowerCase();
  if (
    lower === 'unnamed road' ||
    lower === 'unknown' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'current location' ||
    lower === 'location'
  ) {
    return '';
  }

  return trimmed;
}

/**
 * Deduplicate an array of address parts case-insensitively
 */
function deduplicateParts(parts: (string | undefined | null)[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const p of parts) {
    const cleaned = cleanAddressToken(p);
    if (!cleaned) continue;

    const lower = cleaned.toLowerCase();
    // Check if exact match or substantially redundant with existing item
    if (seen.has(lower)) continue;

    // Check if already covered by an existing token (e.g., "Bengaluru" already in "Bengaluru Urban")
    const isRedundant = result.some((existing) => {
      const exLower = existing.toLowerCase();
      return (
        exLower === lower ||
        (exLower.includes(lower) && exLower.length - lower.length < 8) ||
        (lower.includes(exLower) && lower.length - exLower.length < 8)
      );
    });

    if (!isRedundant) {
      result.push(cleaned);
      seen.add(lower);
    }
  }

  return result;
}

/**
 * Extract lat/lng from SafePlaceTarget object
 */
function getPlaceCoords(place: SafePlaceTarget): { lat: number; lng: number } {
  let lat = Number(place.latitude || place.lat || 0);
  let lng = Number(place.longitude || place.lng || 0);

  if ((!lat || !lng || isNaN(lat) || isNaN(lng)) && place.geom) {
    if (typeof place.geom === 'string') {
      const match = place.geom.match(/POINT\s*\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/i);
      if (match && match.length >= 3) {
        lng = parseFloat(match[1]);
        lat = parseFloat(match[2]);
      }
    } else if (typeof place.geom === 'object' && Array.isArray(place.geom.coordinates)) {
      lng = parseFloat(place.geom.coordinates[0]);
      lat = parseFloat(place.geom.coordinates[1]);
    }
  }

  return { lat, lng };
}

/**
 * Check if the coordinate lies inside any registered circle safe place
 */
export function findMatchingSafePlace(
  lat: number,
  lng: number,
  safePlaces: SafePlaceTarget[] = []
): SafePlaceTarget | null {
  if (!safePlaces || safePlaces.length === 0) return null;

  for (const place of safePlaces) {
    const coords = getPlaceCoords(place);
    if (!coords.lat || !coords.lng) continue;

    const radius = Math.max(Number(place.radius_m || place.radius || 120), 40);
    const distMeters = calculateHaversineDistanceMeters(lat, lng, coords.lat, coords.lng);

    if (distMeters <= radius) {
      return place;
    }
  }

  return null;
}

/**
 * Tier 1: Native Reverse Geocoding with Expo Location
 */
async function fetchNativeGeocode(lat: number, lng: number): Promise<any | null> {
  try {
    const geoPromise = Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Native geocode timeout')), 2800)
    );

    const results: any = await Promise.race([geoPromise, timeoutPromise]).catch(() => null);
    if (Array.isArray(results) && results.length > 0) {
      return results[0];
    }
  } catch (_) {}
  return null;
}

/**
 * Tier 2: OpenStreetMap Nominatim Reverse Geocoding API
 */
async function fetchNominatimGeocode(lat: number, lng: number): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CircleGuard-Safety-Engine/2.0 (family-safety@circleguard.app)',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        return {
          address: data.address,
          displayName: data.display_name,
        };
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Tier 3: Photon Komoot Reverse Geocoder API
 */
async function fetchPhotonGeocode(lat: number, lng: number): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2600);

    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CircleGuard-Safety-Engine/2.0',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data?.features?.[0]?.properties) {
        return data.features[0].properties;
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Master Reverse Geocoding Function
 * Resolves coordinates into an authentic, street-level, building-level address.
 */
export async function reverseGeocodeLive(
  lat: number,
  lng: number,
  options?: {
    safePlaces?: SafePlaceTarget[];
    accuracyMeters?: number;
    skipCache?: boolean;
  }
): Promise<GeocodedAddress> {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return {
      headline: 'Location Unavailable',
      subtitle: 'Coordinates missing',
      fullAddress: 'Location unavailable',
      isSafePlace: false,
      latitude: lat || 0,
      longitude: lng || 0,
    };
  }

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  // 1. Check in-memory cache
  if (!options?.skipCache && inMemoryGeocodeCache.has(cacheKey)) {
    const cached = inMemoryGeocodeCache.get(cacheKey)!;
    // Check safe place in case circle places updated
    if (options?.safePlaces && options.safePlaces.length > 0) {
      const match = findMatchingSafePlace(lat, lng, options.safePlaces);
      if (match) {
        return {
          ...cached,
          safePlaceName: match.name,
          isSafePlace: true,
          headline: `${match.name} • ${cached.headline}`,
        };
      }
    }
    return cached;
  }

  // 2. Check registered Circle Safe Places
  const matchedPlace = options?.safePlaces ? findMatchingSafePlace(lat, lng, options.safePlaces) : null;
  const safePlaceName = matchedPlace?.name ? matchedPlace.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim() : undefined;

  // 3. Multi-tier resolution:
  // Fire Native and Nominatim concurrently to obtain highest precision data without waiting on sequential timeouts
  const [nativeData, nomData] = await Promise.all([
    fetchNativeGeocode(lat, lng),
    fetchNominatimGeocode(lat, lng),
  ]);

  let photonData: any = null;
  if (!nativeData && !nomData) {
    photonData = await fetchPhotonGeocode(lat, lng);
  }

  // Extract from Native
  const nativeHouseNum = cleanAddressToken(nativeData?.streetNumber);
  const nativeStreet = cleanAddressToken(nativeData?.street);
  const nativeName = cleanAddressToken(nativeData?.name);
  const nativeDistrict = cleanAddressToken(nativeData?.district || nativeData?.subregion);
  const nativeCity = cleanAddressToken(nativeData?.city);
  const nativeState = cleanAddressToken(nativeData?.region);
  const nativePostal = cleanAddressToken(nativeData?.postalCode);
  const nativeCountry = cleanAddressToken(nativeData?.country);

  // Extract from Nominatim
  const nomAddress = nomData?.address || {};
  const nomHouseNum = cleanAddressToken(nomAddress.house_number || nomAddress.building);
  const nomRoad = cleanAddressToken(
    nomAddress.road || nomAddress.pedestrian || nomAddress.footway || nomAddress.residential || nomAddress.path
  );
  const nomPoi = cleanAddressToken(
    nomAddress.amenity || nomAddress.shop || nomAddress.office || nomAddress.leisure || nomAddress.tourism || nomAddress.building
  );
  const nomNeighbourhood = cleanAddressToken(
    nomAddress.suburb || nomAddress.neighbourhood || nomAddress.quarter || nomAddress.residential
  );
  const nomDistrict = cleanAddressToken(
    nomAddress.city_district || nomAddress.district || nomAddress.subdistrict || nomAddress.borough
  );
  const nomCity = cleanAddressToken(
    nomAddress.city || nomAddress.town || nomAddress.village || nomAddress.municipality || nomAddress.county
  );
  const nomState = cleanAddressToken(nomAddress.state);
  const nomPostal = cleanAddressToken(nomAddress.postcode);
  const nomCountry = cleanAddressToken(nomAddress.country);

  // Extract from Photon
  const photonRoad = cleanAddressToken(photonData?.street);
  const photonHouseNum = cleanAddressToken(photonData?.housenumber);
  const photonPoi = cleanAddressToken(photonData?.name);
  const photonDistrict = cleanAddressToken(photonData?.district || photonData?.locality);
  const photonCity = cleanAddressToken(photonData?.city || photonData?.county);
  const photonState = cleanAddressToken(photonData?.state);
  const photonPostal = cleanAddressToken(photonData?.postcode);
  const photonCountry = cleanAddressToken(photonData?.country);

  // Synthesize optimal components:
  const houseNumber = nativeHouseNum || nomHouseNum || photonHouseNum || '';
  const road = nomRoad || nativeStreet || photonRoad || '';
  const buildingOrPoi = nomPoi || (nativeName !== nativeStreet && nativeName !== nativeCity ? nativeName : '') || photonPoi || '';
  const neighbourhood = nomNeighbourhood || nomDistrict || nativeDistrict || photonDistrict || '';
  const district = nomDistrict || nativeDistrict || photonDistrict || '';
  const city = nativeCity || nomCity || photonCity || '';
  const state = nativeState || nomState || photonState || '';
  const postalCode = nativePostal || nomPostal || photonPostal || '';
  const country = nativeCountry || nomCountry || photonCountry || '';

  // Construct Primary Street Headline
  let headline = '';
  if (buildingOrPoi && road) {
    headline = houseNumber ? `${buildingOrPoi}, ${houseNumber} ${road}` : `${buildingOrPoi}, ${road}`;
  } else if (road) {
    headline = houseNumber ? `${houseNumber} ${road}` : road;
  } else if (buildingOrPoi) {
    headline = buildingOrPoi;
  } else if (neighbourhood) {
    headline = neighbourhood;
  } else if (city) {
    headline = city;
  } else {
    headline = `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  // If user is inside a registered safe place, prepend it
  if (safePlaceName) {
    headline = `${safePlaceName} • ${headline}`;
  }

  // Construct Subtitle (Locality, City, Postal Code)
  const subtitleParts = deduplicateParts([
    neighbourhood !== headline ? neighbourhood : '',
    district !== neighbourhood && district !== headline ? district : '',
    city,
    postalCode,
  ]);
  const subtitle = subtitleParts.join(', ') || (state ? `${state}, ${country}` : country || 'High Precision GPS Lock');

  // Construct Full Address for Sharing / Copying
  const fullAddressParts = deduplicateParts([
    safePlaceName,
    buildingOrPoi,
    houseNumber ? `${houseNumber} ${road}` : road,
    neighbourhood,
    district,
    city,
    state,
    postalCode,
    country,
  ]);

  const fullAddress =
    fullAddressParts.join(', ') ||
    `${headline}, ${subtitle}`;

  const resolved: GeocodedAddress = {
    headline,
    subtitle,
    fullAddress,
    safePlaceName,
    isSafePlace: !!safePlaceName,
    buildingOrPoi: buildingOrPoi || undefined,
    houseNumber: houseNumber || undefined,
    road: road || undefined,
    neighbourhood: neighbourhood || undefined,
    district: district || undefined,
    city: city || undefined,
    state: state || undefined,
    postalCode: postalCode || undefined,
    country: country || undefined,
    latitude: lat,
    longitude: lng,
    accuracyMeters: options?.accuracyMeters,
  };

  // Cache in-memory
  inMemoryGeocodeCache.set(cacheKey, resolved);

  // Cache to AsyncStorage asynchronously
  AsyncStorage.setItem(`${CACHE_STORAGE_PREFIX}${cacheKey}`, JSON.stringify(resolved)).catch(() => {});

  return resolved;
}

/**
 * Fast synchronous reverse geocode cache getter (0ms)
 */
export function getCachedReverseGeocode(lat: number, lng: number): GeocodedAddress | null {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  return inMemoryGeocodeCache.get(cacheKey) || null;
}
