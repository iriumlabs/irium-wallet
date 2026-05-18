import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/** Standard screen-entrance animation: fade in + slide up 20px, 300ms, ease-out.
 *  Spread the returned style on an outer Animated.View that wraps the screen body. */
export function useScreenEnter() {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  return {
    opacity: fade,
    transform: [{ translateY: slide }],
    flex: 1,
  } as const;
}
