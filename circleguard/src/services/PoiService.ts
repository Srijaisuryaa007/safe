function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface POI {
  id: string;
  name: string;
  subText: string;
  lat: number;
  lng: number;
  category: 'hospital' | 'school' | 'police' | 'restaurant' | 'fuel' | string;
  distMeters: number;
  distanceKm: string;
  distanceText: string;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

const OVERPASS_TAG_FILTERS: Record<string, string> = {
  hospital: '["amenity"~"hospital|clinic|doctors|emergency_room"]',
  police: '["amenity"="police"]',
  school: '["amenity"~"school|university|college|kindergarten"]',
  restaurant: '["amenity"~"restaurant|cafe|fast_food|food_court|bar"]',
  fuel: '["amenity"~"fuel|charging_station"]',
};

const NOMINATIM_SEARCH_KEYWORDS: Record<string, string[]> = {
  hospital: ['hospital', 'emergency clinic'],
  police: ['police station'],
  school: ['school', 'university', 'college'],
  restaurant: ['restaurant', 'cafe', 'food'],
  fuel: ['fuel station', 'petrol pump', 'gas station'],
};

// Fallback search using OpenStreetMap Nominatim
async function fetchNominatimPois(
  category: string,
  userLat: number,
  userLng: number,
  isMiles: boolean = false
): Promise<POI[]> {
  try {
    const keywords = NOMINATIM_SEARCH_KEYWORDS[category] || [category];
    const query = encodeURIComponent(keywords[0]);
    const delta = 0.06; // ~6km bounding box
    const viewbox = `${(userLng - delta).toFixed(4)},${(userLat + delta).toFixed(4)},${(userLng + delta).toFixed(4)},${(userLat - delta).toFixed(4)}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&viewbox=${viewbox}&bounded=1&limit=15&addressdetails=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(url, {
      headers: { 'User-Agent': 'CircleGuardSafetyApp/1.0 (SafetyPOI)' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) return [];

    return items
      .map((item: any) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

        const nameParts = (item.display_name || '').split(',');
        const primaryName = nameParts[0]?.trim() || `${category.toUpperCase()} Location`;
        const streetOrArea = nameParts.slice(1, 3).map((s: string) => s.trim()).filter(Boolean).join(', ');

        const distMeters = getDistanceInMeters(userLat, userLng, lat, lng);
        const distVal = isMiles ? distMeters / 1609.34 : distMeters / 1000;
        const unitStr = isMiles ? 'mi away' : 'km away';

        return {
          id: `nom_${item.place_id || item.osm_id || Math.random()}`,
          name: primaryName,
          subText: streetOrArea ? `${streetOrArea} • ${distVal.toFixed(1)} ${unitStr}` : `${distVal.toFixed(1)} ${unitStr}`,
          lat,
          lng,
          category,
          distMeters,
          distanceKm: distVal.toFixed(1),
          distanceText: `${distVal.toFixed(1)} ${unitStr}`,
        };
      })
      .filter((p: POI | null): p is POI => p !== null)
      .sort((a: POI, b: POI) => a.distMeters - b.distMeters);
  } catch (e) {
    return [];
  }
}

export function generateFallbackPois(category: string, userLat: number, userLng: number, isMiles: boolean = false): POI[] {
  // Graceful empty fallback when offline or loading
  return [];
}

async function fetchFromOverpassEndpoint(
  endpoint: string,
  overpassQuery: string,
  category: string,
  userLat: number,
  userLng: number,
  isMiles: boolean
): Promise<POI[]> {
  const overpassUrl = `${endpoint}?data=${encodeURIComponent(overpassQuery)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  const res = await fetch(overpassUrl, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error('Overpass error');
  const json = await res.json();
  if (!Array.isArray(json?.elements) || json.elements.length === 0) throw new Error('No elements');

  const livePois: POI[] = json.elements
    .map((item: any) => {
      const lat = item.lat ?? item.center?.lat;
      const lon = item.lon ?? item.center?.lon;
      if (!lat || !lon) return null;

      const tags = item.tags || {};
      const rawName = tags.name || tags['name:en'] || tags.brand || tags.operator;
      if (!rawName) return null;

      const street = tags['addr:street'] || tags['addr:suburb'] || tags['addr:district'] || tags['addr:city'] || '';
      const brandOrType = tags.brand || tags.operator || tags.amenity || category;
      
      const distMeters = getDistanceInMeters(userLat, userLng, lat, lon);
      const distVal = isMiles ? distMeters / 1609.34 : distMeters / 1000;
      const unitStr = isMiles ? 'mi away' : 'km away';

      const subText = street 
        ? `${street} • ${distVal.toFixed(1)} ${unitStr}`
        : `${brandOrType} • ${distVal.toFixed(1)} ${unitStr}`;

      return {
        id: `osm_${item.type || 'n'}_${item.id}`,
        name: rawName,
        subText: subText,
        lat: lat,
        lng: lon,
        category,
        distMeters,
        distanceKm: distVal.toFixed(1),
        distanceText: `${distVal.toFixed(1)} ${unitStr}`,
      };
    })
    .filter((p: POI | null): p is POI => p !== null)
    .sort((a: POI, b: POI) => a.distMeters - b.distMeters);

  if (livePois.length === 0) throw new Error('No valid POIs');
  return livePois;
}

export async function fetchCategoryPois(
  category: string,
  userLat: number,
  userLng: number,
  isMiles: boolean = false
): Promise<POI[]> {
  if (!userLat || !userLng || (userLat === 20.5937 && userLng === 78.9629)) {
    return [];
  }

  const tagFilter = OVERPASS_TAG_FILTERS[category] || `["amenity"="${category}"]`;
  const overpassQuery = `[out:json][timeout:5];nwr(around:6000,${userLat},${userLng})${tagFilter};out center 35;`;

  // Query all Overpass endpoints in parallel for blazing fast response
  const promises = OVERPASS_ENDPOINTS.map(endpoint =>
    fetchFromOverpassEndpoint(endpoint, overpassQuery, category, userLat, userLng, isMiles)
  );

  try {
    return await Promise.any(promises);
  } catch (e) {
    // If Overpass mirrors fail or timeout, fallback to Nominatim
    return await fetchNominatimPois(category, userLat, userLng, isMiles);
  }
}
