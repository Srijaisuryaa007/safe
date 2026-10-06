import { Platform, Linking } from 'react-native';
import * as Device from 'expo-device';

export interface OemOptimizationGuide {
  manufacturer: string;
  isAggressiveKiller: boolean;
  title: string;
  steps: string[];
  batterySettingName: string;
  autostartSettingName?: string;
  settingsUrl?: string;
}

class OemBatteryOptimizationService {
  /**
   * Get the device manufacturer name safely.
   */
  getManufacturer(): string {
    if (Platform.OS === 'ios') return 'Apple';
    const brand = (Device.brand || Device.manufacturer || '').toLowerCase();
    if (brand.includes('xiaomi') || brand.includes('redmi') || brand.includes('poco')) return 'Xiaomi';
    if (brand.includes('samsung')) return 'Samsung';
    if (brand.includes('oppo')) return 'Oppo';
    if (brand.includes('vivo') || brand.includes('iqoo')) return 'Vivo';
    if (brand.includes('realme')) return 'Realme';
    if (brand.includes('oneplus')) return 'OnePlus';
    if (brand.includes('huawei') || brand.includes('honor')) return 'Huawei';
    if (brand.includes('google')) return 'Google';
    return Device.manufacturer || 'Android';
  }

  /**
   * Check if this device brand is known for aggressive background process killing (DontKillMyApp rating).
   */
  isAggressiveOem(): boolean {
    if (Platform.OS !== 'android') return false;
    const m = this.getManufacturer().toLowerCase();
    return ['xiaomi', 'samsung', 'oppo', 'vivo', 'realme', 'huawei', 'oneplus'].includes(m);
  }

  /**
   * Get tailored step-by-step instructions for the specific phone model.
   */
  getGuideForDevice(): OemOptimizationGuide {
    const brand = this.getManufacturer();

    switch (brand) {
      case 'Xiaomi':
        return {
          manufacturer: 'Xiaomi / MIUI / HyperOS',
          isAggressiveKiller: true,
          title: 'Xiaomi Background & Autostart Guide',
          batterySettingName: 'No restrictions',
          autostartSettingName: 'Autostart (Enabled)',
          steps: [
            '1. Tap "Open App Settings" below.',
            '2. Scroll down and enable "Autostart".',
            '3. Tap "Battery saver" and change from "MIUI Battery Saver" to "No restrictions".',
            '4. In Recent Apps screen, long-press CircleGuard and tap the "Lock" icon to keep it active.',
          ],
        };

      case 'Samsung':
        return {
          manufacturer: 'Samsung (One UI)',
          isAggressiveKiller: true,
          title: 'Samsung Battery Optimization Guide',
          batterySettingName: 'Unrestricted',
          steps: [
            '1. Tap "Open App Settings" below.',
            '2. Tap "Battery".',
            '3. Select "Unrestricted" (do NOT select Optimized or Restricted).',
            '4. Go to Device Care > Battery > Background usage limits > ensure CircleGuard is in "Never sleeping apps".',
          ],
        };

      case 'Oppo':
        return {
          manufacturer: 'Oppo (ColorOS)',
          isAggressiveKiller: true,
          title: 'Oppo Background Execution Guide',
          batterySettingName: 'Allow background activity',
          autostartSettingName: 'Auto-startup (Enabled)',
          steps: [
            '1. Tap "Open App Settings" below.',
            '2. Select "Battery" > "Advanced settings".',
            '3. Turn ON "Allow background activity" and "Allow foreground activity".',
            '4. Open Phone Manager > Privacy permissions > Startup manager > enable CircleGuard.',
          ],
        };

      case 'Vivo':
        return {
          manufacturer: 'Vivo (Funtouch OS / OriginOS)',
          isAggressiveKiller: true,
          title: 'Vivo Background Execution Guide',
          batterySettingName: 'High background power consumption',
          autostartSettingName: 'Autostart (Enabled)',
          steps: [
            '1. Tap "Open App Settings" below.',
            '2. Tap "Battery" > "High background power consumption".',
            '3. Turn ON permission for CircleGuard.',
            '4. Go to Settings > More settings > Applications > Autostart > enable CircleGuard.',
          ],
        };

      case 'Realme':
        return {
          manufacturer: 'Realme (Realme UI)',
          isAggressiveKiller: true,
          title: 'Realme Battery & Startup Guide',
          batterySettingName: 'Don\'t optimize',
          steps: [
            '1. Tap "Open App Settings" below.',
            '2. Tap "Battery" > "Battery optimization".',
            '3. Select CircleGuard and choose "Don\'t optimize".',
            '4. Enable "Allow auto-launch" and "Allow background tasks".',
          ],
        };

      case 'OnePlus':
        return {
          manufacturer: 'OnePlus (OxygenOS)',
          isAggressiveKiller: true,
          title: 'OnePlus Battery Optimization Guide',
          batterySettingName: 'Don\'t optimize',
          steps: [
            '1. Tap "Open App Settings" below.',
            '2. Select "Battery" > "Battery optimization".',
            '3. Find CircleGuard and set to "Don\'t optimize".',
            '4. Turn ON "Allow background activity".',
          ],
        };

      case 'Huawei':
        return {
          manufacturer: 'Huawei (EMUI)',
          isAggressiveKiller: true,
          title: 'Huawei App Launch Guide',
          batterySettingName: 'Manage manually',
          steps: [
            '1. Tap "Open App Settings" below.',
            '2. Go to "Battery" > "App launch".',
            '3. Turn OFF "Manage automatically" for CircleGuard.',
            '4. Enable "Auto-launch", "Secondary launch", and "Run in background".',
          ],
        };

      default:
        return {
          manufacturer: brand,
          isAggressiveKiller: false,
          title: 'Android Battery Optimization Guide',
          batterySettingName: 'Unrestricted',
          steps: [
            '1. Tap "Open App Settings" below.',
            '2. Select "Battery" or "App Battery Usage".',
            '3. Set to "Unrestricted" or "Don\'t optimize".',
            '4. Ensure Background data usage is permitted.',
          ],
        };
    }
  }

  /**
   * Open the native OS settings page for this app.
   */
  async openSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (e) {
      console.warn('[OemService] Could not open app settings:', e);
    }
  }
}

export const oemBatteryOptimizationService = new OemBatteryOptimizationService();
