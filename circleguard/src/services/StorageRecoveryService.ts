import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * StorageRecoveryService.ts
 * 
 * Provides automated self-healing, transient cache pruning, and safety wrappers
 * when a mobile device or SQLite database encounters SQLITE_FULL (code 13: database or disk is full).
 */
export class StorageRecoveryService {
  private static isPruning = false;

  /**
   * Identifies whether an exception is an SQLite or filesystem storage exhaustion error.
   */
  public static isDiskFullError(error: any): boolean {
    if (!error) return false;
    const msg = String(error?.message || error?.details || error).toLowerCase();
    return (
      msg.includes('disk is full') ||
      msg.includes('sqlite_full') ||
      msg.includes('code 13') ||
      msg.includes('enospc') ||
      msg.includes('no space left on device') ||
      msg.includes('storage full')
    );
  }

  /**
   * Safely attempts an AsyncStorage.setItem operation.
   * If an SQLite disk-full error occurs, it automatically triggers emergency cache pruning
   * and swallows non-critical persistence failures so essential user actions (like joining a circle)
   * can continue smoothly in-memory without crashing.
   */
  public static async safeSetItem(
    key: string,
    value: string,
    isCritical = false
  ): Promise<boolean> {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch (err: any) {
      if (this.isDiskFullError(err)) {
        console.warn(`[StorageRecovery] Storage full while writing ${key}. Triggering automated cache prune...`);
        await this.pruneTransientCacheAsync();
        // Retry once after pruning
        try {
          await AsyncStorage.setItem(key, value);
          return true;
        } catch (retryErr) {
          console.warn(`[StorageRecovery] Retry failed for ${key} after prune. Continuing gracefully.`);
          if (isCritical) {
            throw retryErr;
          }
          return false;
        }
      } else {
        if (isCritical) throw err;
        console.warn(`[StorageRecovery] Failed to write ${key}:`, err);
        return false;
      }
    }
  }

  /**
   * Evicts transient map-matching geometry, reverse geocoding entries,
   * old route reconstructions, and legacy cache keys to reclaim physical SQLite storage.
   */
  public static async pruneTransientCacheAsync(): Promise<number> {
    if (this.isPruning) return 0;
    this.isPruning = true;

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const transientPrefixes = [
        '@circleguard_map_match_',
        '@circleguard_geocoding_',
        '@circleguard_cached_geocoding_',
        '@circleguard_historical_route_',
        '@circleguard_route_preview_',
        '@circleguard_tree_hierarchy_',
        '@circleguard_transit_corridor_',
        '@circleguard_last_crit_sync_',
      ];

      const keysToRemove = allKeys.filter((key) =>
        transientPrefixes.some((prefix) => key.startsWith(prefix))
      );

      if (keysToRemove.length > 0) {
        console.log(`[StorageRecovery] Evicting ${keysToRemove.length} transient cache keys from SQLite storage.`);
        await AsyncStorage.multiRemove(keysToRemove);
        return keysToRemove.length;
      }
      return 0;
    } catch (e) {
      console.warn('[StorageRecovery] Error during emergency storage prune:', e);
      return 0;
    } finally {
      this.isPruning = false;
    }
  }
}
