import React from 'react';
import CircleGuardGlobeLoader from './CircleGuardGlobeLoader';
import { useNetworkStore } from '../store/useNetworkStore';

export interface LuxuryRadarLoadingProps {
  message?: string;
  subMessage?: string;
  size?: number;
  fullscreen?: boolean;
}

export default function LuxuryRadarLoading({
  message = 'SECURING CIRCLE...',
  subMessage,
  size = 180,
  fullscreen = false,
}: LuxuryRadarLoadingProps) {
  const { networkState } = useNetworkStore();

  const computedSubLabel = React.useMemo(() => {
    if (subMessage) {
      if (networkState === 'slow') {
        return `${subMessage} • Slow network`;
      }
      return subMessage;
    }

    if (networkState === 'slow') {
      return 'Slow network • Using cache';
    }

    if (networkState === 'offline') {
      return 'Offline mode • Using cache';
    }

    return undefined;
  }, [subMessage, networkState]);

  return (
    <CircleGuardGlobeLoader
      size={size}
      loadingLabel={message}
      subLabel={computedSubLabel}
      fullscreen={fullscreen}
    />
  );
}
