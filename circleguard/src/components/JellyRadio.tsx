import React from 'react';
import { Platform } from 'react-native';
import JellyRadioWeb from './JellyRadio.web';
import JellyRadioNative, { JellyRadioProps, JellyRadioItem } from './JellyRadio.native';

export { JellyRadioProps, JellyRadioItem };

export default function JellyRadio(props: JellyRadioProps) {
  if (Platform.OS === 'web') {
    const WebComponent = JellyRadioWeb as any;
    return <WebComponent {...props} />;
  }
  return <JellyRadioNative {...props} />;
}
