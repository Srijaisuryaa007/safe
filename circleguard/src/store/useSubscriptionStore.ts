import { create } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getRevenueCatService() {
  return require('../services/RevenueCatService').RevenueCatService;
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  priceString: string;
  priceDecimal: number;
  period: 'monthly' | 'annual';
  discountText?: string;
}

interface SubscriptionState {
  isPremium: boolean;
  subscriptionTier: 'free' | 'premium';
  subscriptionType: 'monthly' | 'annual' | null;
  loading: boolean;
  isTestMode: boolean;
  offerings: any | null;
  customerInfo: any | null;
  packages: {
    monthly: SubscriptionPackage;
    annual: SubscriptionPackage;
  };
  
  // Actions
  refresh: () => Promise<void>;
  purchasePackage: (pkg: any) => Promise<void>;
  restorePurchases: () => Promise<void>;
  setPremium: (isPremium: boolean, type?: 'monthly' | 'annual') => Promise<void>;
  toggleTestMode: () => Promise<void>;
  loadSubscriptionState: () => Promise<void>;
  initListeners: () => () => void;

  // Feature Gating Checks (Source of Truth)
  canCreatePlace: (currentCount: number) => boolean;
  canUseRouteCategory: () => boolean;
  canUseAdaptiveBuffer: () => boolean;
  canUseSchedule: () => boolean;
  canViewFullHistory: () => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPremium: false,
  subscriptionTier: 'free',
  subscriptionType: null,
  loading: false,
  isTestMode: true,
  offerings: null,
  customerInfo: null,
  packages: {
    monthly: {
      id: 'circleguard_plus_monthly',
      name: 'Circle Guard Plus Monthly',
      priceString: '$6.99 / mo',
      priceDecimal: 6.99,
      period: 'monthly',
    },
    annual: {
      id: 'circleguard_plus_annual',
      name: 'Circle Guard Plus Annual',
      priceString: '$59.99 / yr',
      priceDecimal: 59.99,
      period: 'annual',
      discountText: 'SAVE 28%',
    },
  },

  refresh: async () => {
    set({ loading: true });
    try {
      // 1. Check local saved state first for offline/sandbox mode
      const savedPrem = await AsyncStorage.getItem('@circleguard_is_premium');
      let isPrem = savedPrem === 'true';

      // 2. Attempt live RevenueCat refresh if Purchases SDK is configured with a real API key
      try {
        const apiKey = getRevenueCatService().getApiKey();
        const isPlaceholderKey = !apiKey || apiKey.includes('circleguard_') || apiKey.includes('sample');

        if (!isPlaceholderKey) {
          const Purchases = require('react-native-purchases').default;
          if (Purchases && typeof Purchases.getCustomerInfo === 'function') {
            const info = await Purchases.getCustomerInfo();
            const offeringsData = await Purchases.getOfferings();
            
            const hasPremiumEntitlement = info?.entitlements?.active?.['premium'] !== undefined;
            if (hasPremiumEntitlement) {
              isPrem = true;
            }

            set({
              customerInfo: info,
              offerings: offeringsData,
            });
          }
        }
      } catch (sdkErr) {
        // Runs in Sandbox Test Mode
      }

      set({
        isPremium: isPrem,
        subscriptionTier: isPrem ? 'premium' : 'free',
        loading: false,
      });
    } catch (e) {
      set({ loading: false });
    }
  },

  purchasePackage: async (pkg: any) => {
    set({ loading: true });
    try {
      const { RevenueCatService } = require('../services/RevenueCatService');
      const success = await RevenueCatService.purchasePackage(pkg);
      if (success) {
        await get().refresh();
      }
    } catch (e) {
      console.error('[SubscriptionStore] Purchase error:', e);
    } finally {
      set({ loading: false });
    }
  },

  restorePurchases: async () => {
    set({ loading: true });
    try {
      const { RevenueCatService } = require('../services/RevenueCatService');
      const success = await RevenueCatService.restorePurchases();
      if (success) {
        await get().refresh();
      }
    } catch (e) {
      console.error('[SubscriptionStore] Restore error:', e);
    } finally {
      set({ loading: false });
    }
  },

  setPremium: async (isPremium: boolean, type = 'monthly') => {
    const subscriptionTier = isPremium ? 'premium' : 'free';
    const subscriptionType = isPremium ? type : null;
    set({ isPremium, subscriptionTier, subscriptionType });
    try {
      await AsyncStorage.setItem('@circleguard_is_premium', isPremium ? 'true' : 'false');
      if (type) await AsyncStorage.setItem('@circleguard_sub_type', type);
    } catch (e) {}
  },

  toggleTestMode: async () => {
    const nextTestMode = !get().isTestMode;
    set({ isTestMode: nextTestMode });
    try {
      await AsyncStorage.setItem('@circleguard_sub_test_mode', nextTestMode ? 'true' : 'false');
    } catch (e) {}
  },

  loadSubscriptionState: async () => {
    await get().refresh();
  },

  initListeners: () => {
    // 1. Live RevenueCat CustomerInfo Listener
    let customerInfoUnsub: any = null;
    try {
      const Purchases = require('react-native-purchases').default;
      if (Purchases && typeof Purchases.addCustomerInfoUpdateListener === 'function') {
        customerInfoUnsub = Purchases.addCustomerInfoUpdateListener((info: any) => {
          const isPrem = info?.entitlements?.active?.['premium'] !== undefined;
          set({
            customerInfo: info,
            isPremium: isPrem,
            subscriptionTier: isPrem ? 'premium' : 'free',
          });
        });
      }
    } catch (e) {}

    // 2. React Native AppState Listener for Foreground Refresh
    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        get().refresh();
      }
    });

    return () => {
      if (customerInfoUnsub && typeof customerInfoUnsub.remove === 'function') {
        customerInfoUnsub.remove();
      }
      appStateSub.remove();
    };
  },

  // Feature Gating Logic (Source of Truth)
  canCreatePlace: (currentCount: number) => {
    if (get().isPremium) return true;
    return currentCount < 2;
  },

  canUseRouteCategory: () => {
    return get().isPremium;
  },

  canUseAdaptiveBuffer: () => {
    return get().isPremium;
  },

  canUseSchedule: () => {
    return get().isPremium;
  },

  canViewFullHistory: () => {
    return get().isPremium;
  },
}));
