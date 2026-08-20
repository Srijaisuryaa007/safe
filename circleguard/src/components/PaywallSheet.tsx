import React from 'react';
import PaywallModal from './PaywallModal';

interface PaywallSheetProps {
  visible: boolean;
  onClose: () => void;
  gatedFeatureName?: string;
}

export default function PaywallSheet({ visible, onClose, gatedFeatureName }: PaywallSheetProps) {
  return (
    <PaywallModal
      visible={visible}
      onClose={onClose}
      gatedFeatureName={gatedFeatureName}
    />
  );
}
