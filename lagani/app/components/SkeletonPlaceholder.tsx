import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface SkeletonPlaceholderProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object; // Allow passing additional styles
}

const SkeletonPlaceholder: React.FC<SkeletonPlaceholderProps> = ({
  width,
  height,
  borderRadius = 4,
  style = {},
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200], // Adjust based on width for a better shimmer
  });

  const shimmerStyle = {
    backgroundColor: '#E5E7EB', // Base color
    overflow: 'hidden' as 'hidden', // Ensure overflow is hidden for shimmer
  };

  const gradientStyle = {
      position: 'absolute' as 'absolute',
      left: 0, // Start from left edge
      right: 0, // End at right edge 
      top: 0, // Start from top edge
      bottom: 0, // End at bottom edge
      backgroundColor: '#F3F4F6', // Shimmer color
      opacity: animatedValue.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1, 0.5] }),
      transform: [{ translateX }],
  };

  return (
    <View style={[styles.placeholder, { width, height, borderRadius }, shimmerStyle, style]}>
        <Animated.View style={gradientStyle as any} />
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    // Base styles are applied dynamically
  },
});

export default SkeletonPlaceholder; 