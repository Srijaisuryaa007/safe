import { useState, useCallback } from 'react';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

export function usePaywall() {
  const { isPremium } = useSubscriptionStore();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [gatedFeatureName, setGatedFeatureName] = useState<string>('');

  const presentPaywall = useCallback((featureName?: string) => {
    if (featureName) {
      setGatedFeatureName(featureName);
    }
    setPaywallVisible(true);
  }, []);

  const dismissPaywall = useCallback(() => {
    setPaywallVisible(false);
  }, []);

  const checkAndRequirePremium = useCallback((featureName: string, action: () => void) => {
    if (isPremium) {
      action();
    } else {
      presentPaywall(featureName);
    }
  }, [isPremium, presentPaywall]);

  return {
    isPremium,
    paywallVisible,
    gatedFeatureName,
    presentPaywall,
    dismissPaywall,
    checkAndRequirePremium,
  };
}
