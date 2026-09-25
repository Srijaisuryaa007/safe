import React from 'react';
import { Platform } from 'react-native';
import { AnimatedListProps } from './AnimatedList.native';
import WebAnimatedList from './AnimatedList.web';
import NativeAnimatedList from './AnimatedList.native';

export { AnimatedListProps };

const AnimatedList = <T,>(props: AnimatedListProps<T>) => {
  if (Platform.OS === 'web') {
    return <WebAnimatedList {...props} />;
  }
  return <NativeAnimatedList {...props} />;
};

export default AnimatedList;
