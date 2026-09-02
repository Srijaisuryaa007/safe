import React from 'react';
import CircleGuardGlobeLoader from './CircleGuardGlobeLoader';

interface LuxuryRadarLoadingProps {
  message?: string;
  subMessage?: string;
  size?: number;
  fullscreen?: boolean;
}

export default function LuxuryRadarLoading({
  message = 'Securing your Circle…',
  subMessage,
  size = 180,
  fullscreen = false,
}: LuxuryRadarLoadingProps) {
  return (
    <CircleGuardGlobeLoader
      size={size}
      loadingLabel={message}
      subLabel={subMessage}
      fullscreen={fullscreen}
    />
  );
}
