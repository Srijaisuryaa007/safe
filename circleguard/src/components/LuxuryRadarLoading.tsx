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

  const computedSub = React.useMemo(() => {
    if (subMessage) {
      if (networkState === 'slow') return `${subMessage} • Slow network`;
      if (networkState === 'offline') return `${subMessage} • Offline mode`;
      return subMessage;
    }
    if (networkState === 'slow') return 'Slow network • Connecting satellite';
    if (networkState === 'offline') return 'Offline mode • Using cached telemetry';
    return undefined;
  }, [subMessage, networkState]);

  return (
    <CircleGuardGlobeLoader
      size={size}
      loadingLabel={message}
      subLabel={computedSub}
      fullscreen={fullscreen}
    />
  );
}
