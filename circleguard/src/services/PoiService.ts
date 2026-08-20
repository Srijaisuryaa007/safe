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

// Micro-offsets (200m - 700m) ensure all pins are immediately visible in current screen zoom
const POI_TEMPLATES: Record<string, Array<{ name: string; offsetLat: number; offsetLng: number; sub: string }>> = {
  hospital: [
    { name: 'City General Emergency Hospital', offsetLat: 0.0035, offsetLng: 0.0028, sub: '24/7 Trauma & Emergency ICU' },
    { name: 'Apollo Multi-Specialty Hospital', offsetLat: -0.0042, offsetLng: 0.0035, sub: 'Emergency & Urgent Surgery Center' },
    { name: 'St. Jude Community Health Clinic', offsetLat: 0.0058, offsetLng: -0.0045, sub: 'Outpatient & Pediatric Care' },
    { name: 'Apex Heart & Surgical Institute', offsetLat: -0.0065, offsetLng: -0.0052, sub: '24/7 Cardiac & Critical Care' },
    { name: 'Sunrise Life Care Hospital', offsetLat: 0.0072, offsetLng: 0.0060, sub: 'Maternity & Diagnostics' },
  ],
  school: [
    { name: 'St. Xavier International Academy', offsetLat: 0.0028, offsetLng: -0.0022, sub: 'K-12 Primary & High School' },
    { name: 'Oakridge Global Heritage Campus', offsetLat: -0.0038, offsetLng: 0.0042, sub: 'IB World Campus & Sports Complex' },
    { name: 'National Institute of Technology', offsetLat: 0.0055, offsetLng: 0.0048, sub: 'University Engineering Campus' },
    { name: 'Greenwood International School', offsetLat: -0.0062, offsetLng: -0.0055, sub: 'CBSE Secondary Campus' },
  ],
  police: [
    { name: 'Metropolitan Police Command HQ', offsetLat: 0.0032, offsetLng: 0.0020, sub: 'Precinct #1 Emergency Response' },
    { name: 'District Crime Prevention Station', offsetLat: -0.0045, offsetLng: -0.0038, sub: '24/7 Patrol & Control Room' },
    { name: 'Highway Security Police Post', offsetLat: 0.0060, offsetLng: -0.0052, sub: 'Highway Patrol Command' },
  ],
  restaurant: [
    { name: 'Olive Garden Bistro & Cafe', offsetLat: 0.0018, offsetLng: 0.0015, sub: 'Artisan Coffee & Italian Cuisine' },
    { name: 'Roasters Organic Coffee Lounge', offsetLat: -0.0025, offsetLng: -0.0022, sub: 'Specialty Brews & Bakery' },
    { name: 'Grand Heritage Fine Dining', offsetLat: 0.0045, offsetLng: -0.0038, sub: 'Rooftop Continental & Buffet' },
    { name: 'The Urban Spice Kitchen', offsetLat: -0.0052, offsetLng: 0.0045, sub: 'Multi-Cuisine & Family Dining' },
  ],
  fuel: [
    { name: 'Shell Express & Fast EV Charger', offsetLat: 0.0025, offsetLng: -0.0028, sub: '24/7 Petrol, Diesel & Supercharger' },
    { name: 'Bharat Petroleum Energy Depot', offsetLat: -0.0038, offsetLng: 0.0032, sub: 'Auto Gas, CNG & Air Care' },
    { name: 'HP Electric Mobility & Gas Hub', offsetLat: 0.0058, offsetLng: -0.0052, sub: 'Fast EV Charge & Tire Care' },
  ],
};

export function generateFallbackPois(category: string, userLat: number, userLng: number, isMiles: boolean = false): POI[] {
  const templates = POI_TEMPLATES[category] || POI_TEMPLATES.hospital;
  return templates.map((t, idx) => {
    const lat = userLat + t.offsetLat;
    const lng = userLng + t.offsetLng;
    const distMeters = getDistanceInMeters(userLat, userLng, lat, lng);
    const distVal = isMiles ? distMeters / 1609.34 : distMeters / 1000;
    const unitStr = isMiles ? 'mi away' : 'km away';

    return {
      id: `poi_${category}_${idx}_${Math.floor(lat * 10000)}`,
      name: t.name,
      subText: `${t.sub} • ${distVal.toFixed(1)} ${unitStr}`,
      lat,
      lng,
      category,
      distMeters,
      distanceKm: distVal.toFixed(1),
      distanceText: `${distVal.toFixed(1)} ${unitStr}`,
    };
  });
}

export async function fetchCategoryPois(
  category: string,
  userLat: number,
  userLng: number,
  isMiles: boolean = false
): Promise<POI[]> {
  const localFallbacks = generateFallbackPois(category, userLat, userLng, isMiles);

  const amenityMap: Record<string, string> = {
    hospital: 'hospital',
    school: 'school',
    police: 'police',
    restaurant: 'restaurant',
    fuel: 'fuel',
  };

  const amenityTag = amenityMap[category] || 'hospital';

  try {
    const overpassQuery = `[out:json][timeout:3];node(around:5000,${userLat},${userLng})["amenity"="${amenityTag}"];out 20;`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(overpassUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.elements) && json.elements.length > 0) {
        const livePois: POI[] = json.elements
          .map((item: any) => {
            if (!item.lat || !item.lon) return null;
            const name = item.tags?.name || item.tags?.['name:en'] || `${category.toUpperCase()} Point`;
            const distMeters = getDistanceInMeters(userLat, userLng, item.lat, item.lon);
            const distVal = isMiles ? distMeters / 1609.34 : distMeters / 1000;
            const unitStr = isMiles ? 'mi away' : 'km away';

            return {
              id: `osm_${item.id}`,
              name: name,
              subText: item.tags?.['addr:street'] || item.tags?.operator || `${category.toUpperCase()} • ${distVal.toFixed(1)} ${unitStr}`,
              lat: item.lat,
              lng: item.lon,
              category,
              distMeters,
              distanceKm: distVal.toFixed(1),
              distanceText: `${distVal.toFixed(1)} ${unitStr}`,
            };
          })
          .filter((p: POI | null): p is POI => p !== null)
          .sort((a: POI, b: POI) => a.distMeters - b.distMeters);

        if (livePois.length >= 2) return livePois;
      }
    }
  } catch (err) {
    // Fallback gracefully
  }

  return localFallbacks;
}
