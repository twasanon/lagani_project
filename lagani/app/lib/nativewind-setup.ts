// This file is used to set up NativeWind with TypeScript

import { ViewProps, TextProps, ImageProps, TouchableOpacityProps, ScrollViewProps } from 'react-native';

// Extend the native React Native types to include className
declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }

  interface TextProps {
    className?: string;
  }

  interface ImageProps {
    className?: string;
  }

  interface TouchableOpacityProps {
    className?: string;
  }

  interface ScrollViewProps {
    className?: string;
  }

  interface TextInputProps {
    className?: string;
  }
}

// No exports needed, we're just extending types
export { /* nothing */ }; 