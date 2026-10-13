/**
 * DeadReckoningEngine.ts
 * 
 * Provides kinematic dead reckoning and inertial trajectory projection when GPS satellite signals
 * are temporarily lost (e.g. road tunnels, mountain canyons, dense tree canopies, subways, or concrete parking garages).
 * 
 * Projects the user's probable position using last valid velocity, heading, and elapsed time,
 * with realistic velocity decay and bounded maximum duration to eliminate unbounded drift.
 */

export interface DeadReckoningPoint {
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDeg: number;
  accuracyMeters: number;
  timestampMs: number;
  isDeadReckoning: boolean;
  confidenceScore: number; // 0.0 - 1.0
  environment: 'open_sky' | 'tunnel' | 'canopy' | 'indoor_parking';
}

export interface LastKnownGpsFix {
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDeg: number;
  accuracyMeters: number;
  timestampMs: number;
}

const MAX_DEAD_RECKONING_DURATION_MS = 180000; // Max 3 minutes projection without fresh GPS
const MAX_DEAD_RECKONING_DISTANCE_METERS = 3500; // Max 3.5 km total projection
const ACCURACY_DECAY_RATE_METERS_PER_SEC = 1.2; // Estimated horizontal accuracy widens gracefully

export class DeadReckoningEngine {
  private static lastValidFix: LastKnownGpsFix | null = null;
  private static deadReckoningStartTimeMs: number | null = null;
  private static accumulatedDistanceMeters = 0;

  /**
   * Ingest fresh, authentic satellite GPS fix to anchor or re-anchor position.
   */
  public static updateGpsFix(
    latitude: number,
    longitude: number,
    speedKmh: number = 0,
    headingDeg: number = 0,
    accuracyMeters: number = 10,
    timestampMs: number = Date.now()
  ): void {
    // Only anchor if coordinates are valid WGS84
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
    if (latitude === 0 && longitude === 0) return; // Discard Null Island

    this.lastValidFix = {
      latitude,
      longitude,
      speedKmh: Math.max(0, speedKmh),
      headingDeg: (headingDeg % 360 + 360) % 360,
      accuracyMeters: Math.max(3, accuracyMeters),
      timestampMs: timestampMs || Date.now(),
    };

    // Reset dead-reckoning state on fresh satellite lock
    this.deadReckoningStartTimeMs = null;
    this.accumulatedDistanceMeters = 0;
  }

  /**
   * Determine if dead-reckoning projection is currently viable.
   */
  public static isDeadReckoningViable(currentTimeMs: number = Date.now()): boolean {
    if (!this.lastValidFix) return false;
    const elapsedMs = currentTimeMs - this.lastValidFix.timestampMs;
    return elapsedMs > 2000 && elapsedMs <= MAX_DEAD_RECKONING_DURATION_MS;
  }

  /**
   * Estimate current position using kinematic projection when GPS satellite signal drops.
   */
  public static projectPosition(
    currentTimeMs: number = Date.now(),
    assumedEnvironment: 'tunnel' | 'canopy' | 'indoor_parking' = 'tunnel'
  ): DeadReckoningPoint | null {
    if (!this.lastValidFix) return null;

    const elapsedMs = currentTimeMs - this.lastValidFix.timestampMs;
    if (elapsedMs <= 0) {
      return {
        latitude: this.lastValidFix.latitude,
        longitude: this.lastValidFix.longitude,
        speedKmh: this.lastValidFix.speedKmh,
        headingDeg: this.lastValidFix.headingDeg,
        accuracyMeters: this.lastValidFix.accuracyMeters,
        timestampMs: this.lastValidFix.timestampMs,
        isDeadReckoning: false,
        confidenceScore: 1.0,
        environment: 'open_sky',
      };
    }

    if (elapsedMs > MAX_DEAD_RECKONING_DURATION_MS) {
      // Signal lost for too long; unbounded drift risk
      return null;
    }

    if (!this.deadReckoningStartTimeMs) {
      this.deadReckoningStartTimeMs = currentTimeMs;
    }

    const elapsedSeconds = elapsedMs / 1000;

    // Kinematic model: Velocity decays realistically over time (rolling resistance/drag)
    // In tunnels or coasting, speed gradually drops by 3% every 10 seconds
    const decayFactor = Math.max(0.2, Math.exp(-0.015 * elapsedSeconds));
    const currentSpeedKmh = this.lastValidFix.speedKmh * decayFactor;
    const avgSpeedMs = ((this.lastValidFix.speedKmh + currentSpeedKmh) / 2) / 3.6;

    // Projected distance traveled along heading vector
    const stepDistanceMeters = avgSpeedMs * elapsedSeconds;
    if (stepDistanceMeters > MAX_DEAD_RECKONING_DISTANCE_METERS) {
      return null;
    }

    const headingRad = (this.lastValidFix.headingDeg * Math.PI) / 180;
    const deltaY = stepDistanceMeters * Math.cos(headingRad); // North-South displacement
    const deltaX = stepDistanceMeters * Math.sin(headingRad); // East-West displacement

    // 1 deg latitude ~ 111,139 meters
    const deltaLat = deltaY / 111139;
    const cosLat = Math.cos((this.lastValidFix.latitude * Math.PI) / 180);
    // 1 deg longitude ~ 111,139 * cos(lat) meters
    const deltaLng = deltaX / (111139 * Math.max(0.1, cosLat));

    const projectedLat = parseFloat((this.lastValidFix.latitude + deltaLat).toFixed(6));
    const projectedLng = parseFloat((this.lastValidFix.longitude + deltaLng).toFixed(6));

    // Accuracy degrades smoothly as dead-reckoning duration increases
    const estimatedAccuracy = Math.min(
      250,
      Math.round(this.lastValidFix.accuracyMeters + (elapsedSeconds * ACCURACY_DECAY_RATE_METERS_PER_SEC))
    );

    // Confidence drops with elapsed time
    const confidenceScore = Math.max(0.15, parseFloat((1.0 - (elapsedMs / MAX_DEAD_RECKONING_DURATION_MS)).toFixed(2)));

    return {
      latitude: projectedLat,
      longitude: projectedLng,
      speedKmh: Math.round(currentSpeedKmh),
      headingDeg: this.lastValidFix.headingDeg,
      accuracyMeters: estimatedAccuracy,
      timestampMs: currentTimeMs,
      isDeadReckoning: true,
      confidenceScore,
      environment: assumedEnvironment,
    };
  }

  /**
   * Resets engine state (e.g. upon user logout or manual reset).
   */
  public static reset(): void {
    this.lastValidFix = null;
    this.deadReckoningStartTimeMs = null;
    this.accumulatedDistanceMeters = 0;
  }
}
