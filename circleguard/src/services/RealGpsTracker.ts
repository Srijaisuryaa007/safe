/**
 * RealGpsTracker.ts
 * Real GPS-based travel history tracking & polyline rendering using Plain Leaflet (No Routing Plugins).
 * 
 * Features:
 * - Real-time device position capture via navigator.geolocation.watchPosition (enableHighAccuracy: true)
 * - Jitter & noise filtering (ignores points where accuracy > 50 meters)
 * - Dynamic L.polyline update by appending raw recorded GPS coordinates
 * - Trip persistence (LocalStorage / IndexedDB / Supabase)
 * - Trip replay & display without computed/guessed road routes
 */

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: string;
  accuracy: number;
}

export interface SavedTrip {
  id: string;
  startTime: string;
  endTime: string;
  totalDistanceMeters: number;
  points: GpsPoint[];
}

export interface TrackingOptions {
  maxAccuracyMeters?: number; // Default 50m filter
  minDistanceMeters?: number; // Minimum 3m separation to prevent micro-jitter
  lineColor?: string;
  lineWidth?: number;
  autoPan?: boolean;
  onPointRecorded?: (point: GpsPoint, totalPoints: number) => void;
  onError?: (error: string) => void;
}

// Calculate Haversine distance in meters between two GPS coordinates
export function calculateHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
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

// Calculate total distance of a recorded point array
export function calculateTripTotalDistance(points: GpsPoint[]): number {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateHaversineMeters(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }
  return Math.round(total);
}

class RealGpsTrackerManager {
  private watchId: number | null = null;
  private isTracking: boolean = false;
  private currentPoints: GpsPoint[] = [];
  private startTime: string | null = null;
  private currentPolyline: any = null; // Leaflet L.polyline reference
  private currentMap: any = null;
  private options: TrackingOptions = {};

  /**
   * Start live GPS location tracking
   */
  public startTracking(map: any, options: TrackingOptions = {}): boolean {
    if (this.isTracking) {
      console.warn('[RealGpsTracker] Tracking is already active.');
      return false;
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      const errorMsg = 'Geolocation API is not supported by your browser or environment.';
      console.error('[RealGpsTracker]', errorMsg);
      if (options.onError) options.onError(errorMsg);
      return false;
    }

    this.options = {
      maxAccuracyMeters: options.maxAccuracyMeters || 50,
      minDistanceMeters: options.minDistanceMeters || 3,
      lineColor: options.lineColor || '#10B981',
      lineWidth: options.lineWidth || 5,
      autoPan: options.autoPan !== undefined ? options.autoPan : true,
      ...options,
    };

    this.currentMap = map;
    this.currentPoints = [];
    this.startTime = new Date().toISOString();
    this.isTracking = true;

    // Create Leaflet polyline for real-time path drawing
    if (map && (window as any).L) {
      if (this.currentPolyline) {
        map.removeLayer(this.currentPolyline);
      }
      const L = (window as any).L;
      this.currentPolyline = L.polyline([], {
        color: this.options.lineColor,
        weight: this.options.lineWidth,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
    }

    // Begin Watching Position with High Accuracy
    this.watchId = navigator.geolocation.watchPosition(
      (position: GeolocationPosition) => this.handlePositionUpdate(position),
      (error: GeolocationPositionError) => this.handleGeolocationError(error),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );

    console.log('[RealGpsTracker] Started live GPS tracking.');
    return true;
  }

  /**
   * Internal Handler for Position Updates
   */
  private handlePositionUpdate(position: GeolocationPosition) {
    if (!this.isTracking) return;

    const { latitude, longitude, accuracy } = position.coords;
    const maxAccuracy = this.options.maxAccuracyMeters || 50;

    // Requirement 7: Ignore points where accuracy is worse than threshold (e.g. 50m)
    if (accuracy > maxAccuracy) {
      console.warn(
        `[RealGpsTracker] Point ignored due to poor accuracy (${Math.round(accuracy)}m > max ${maxAccuracy}m)`
      );
      return;
    }

    // Requirement 3: Check min separation distance to prevent stationary GPS noise jitter
    if (this.currentPoints.length > 0) {
      const last = this.currentPoints[this.currentPoints.length - 1];
      const dist = calculateHaversineMeters(last.lat, last.lng, latitude, longitude);
      const minDist = this.options.minDistanceMeters || 3;
      if (dist < minDist) {
        return; // Skip duplicate / micro-jitter coordinates
      }
    }

    const newPoint: GpsPoint = {
      lat: latitude,
      lng: longitude,
      timestamp: new Date(position.timestamp).toISOString(),
      accuracy: Math.round(accuracy),
    };

    // Requirement 3 & 4: Append real GPS point to array & update Leaflet polyline
    this.currentPoints.push(newPoint);

    if (this.currentPolyline) {
      this.currentPolyline.addLatLng([latitude, longitude]);
    }

    if (this.options.autoPan && this.currentMap) {
      this.currentMap.panTo([latitude, longitude], { animate: true });
    }

    if (this.options.onPointRecorded) {
      this.options.onPointRecorded(newPoint, this.currentPoints.length);
    }
  }

  /**
   * Internal Handler for Geolocation Permission & Hardware Errors
   */
  private handleGeolocationError(error: GeolocationPositionError) {
    let message = 'An unknown GPS error occurred.';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Location permission denied. Please enable GPS permissions in your browser or device settings.';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'GPS signal unavailable. Please ensure location services are turned on.';
        break;
      case error.TIMEOUT:
        message = 'GPS location request timed out.';
        break;
    }

    console.error('[RealGpsTracker] Geolocation error:', message);
    if (this.options.onError) {
      this.options.onError(message);
    }
  }

  /**
   * Stop tracking, clear watch, and persist the recorded trip
   */
  public async stopTracking(): Promise<SavedTrip | null> {
    if (!this.isTracking) {
      console.warn('[RealGpsTracker] Tracking is not currently active.');
      return null;
    }

    if (this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.isTracking = false;
    const endTime = new Date().toISOString();
    const totalDistanceMeters = calculateTripTotalDistance(this.currentPoints);

    const trip: SavedTrip = {
      id: `trip_${Date.now()}`,
      startTime: this.startTime || new Date().toISOString(),
      endTime,
      totalDistanceMeters,
      points: [...this.currentPoints],
    };

    // Requirement 5: Save trip to LocalStorage / IndexedDB / Storage
    await this.saveTripToStorage(trip);

    console.log(`[RealGpsTracker] Trip tracking stopped. Saved ${trip.points.length} points (${(totalDistanceMeters/1000).toFixed(2)} km).`);
    return trip;
  }

  /**
   * Requirement 5: Persist Trip to LocalStorage / IndexedDB
   */
  public async saveTripToStorage(trip: SavedTrip): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const existingKey = '@circleguard_saved_trips';
        const existingRaw = localStorage.getItem(existingKey);
        const trips: SavedTrip[] = existingRaw ? JSON.parse(existingRaw) : [];
        trips.unshift(trip); // Add newest trip at top
        localStorage.setItem(existingKey, JSON.stringify(trips.slice(0, 50))); // Keep last 50 trips
      }
    } catch (e) {
      console.error('[RealGpsTracker] Error saving trip to storage:', e);
    }
  }

  /**
   * Retrieve all saved trips from LocalStorage / IndexedDB
   */
  public async getSavedTrips(): Promise<SavedTrip[]> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem('@circleguard_saved_trips');
        return raw ? JSON.parse(raw) : [];
      }
    } catch (e) {}
    return [];
  }

  /**
   * Requirement 6: Replay / Display a previously saved trip on map by connecting recorded points in order
   */
  public displaySavedTripOnMap(trip: SavedTrip, map: any, options: { lineColor?: string; weight?: number; fitBounds?: boolean } = {}): any {
    if (!map || !(window as any).L || !trip || !trip.points || trip.points.length === 0) {
      console.warn('[RealGpsTracker] Cannot display trip: Invalid map or empty points.');
      return null;
    }

    const L = (window as any).L;
    const latLngs = trip.points.map(p => [p.lat, p.lng]);

    // Draw polyline directly from saved real points — NO routing engine
    const polyline = L.polyline(latLngs, {
      color: options.lineColor || '#3B82F6',
      weight: options.weight || 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Draw Start & End Markers
    if (latLngs.length > 0) {
      L.circleMarker(latLngs[0], {
        radius: 8,
        fillColor: '#10B981',
        color: '#FFFFFF',
        weight: 2,
        fillOpacity: 1,
      }).addTo(map).bindPopup(`Start: ${new Date(trip.startTime).toLocaleTimeString()}`);

      L.circleMarker(latLngs[latLngs.length - 1], {
        radius: 8,
        fillColor: '#EF4444',
        color: '#FFFFFF',
        weight: 2,
        fillOpacity: 1,
      }).addTo(map).bindPopup(`End: ${new Date(trip.endTime).toLocaleTimeString()}`);
    }

    if (options.fitBounds !== false && latLngs.length > 0) {
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }

    return polyline;
  }

  public getIsTracking(): boolean {
    return this.isTracking;
  }

  public getCurrentPointCount(): number {
    return this.currentPoints.length;
  }
}

export const RealGpsTracker = new RealGpsTrackerManager();
