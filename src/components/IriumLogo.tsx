import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';

interface Props {
  size?: number;
  animated?: boolean;
  glow?: boolean;
  style?: object;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoSource = require('../../assets/irium-logo-transparent.png');

export function IriumLogo({ size = 80, animated: breathe = false, glow = false, style }: Props) {
  const breatheScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!breathe) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheScale, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(breatheScale, { toValue: 1.0, duration: 1500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [breathe]);

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {glow && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: size / 2,
              backgroundColor: '#7B2FFF',
              opacity: 0.18,
              shadowColor: '#7B2FFF',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: size * 0.7,
              elevation: 0,
            },
          ]}
        />
      )}
      <Animated.Image
        source={logoSource}
        style={{
          width: size,
          height: size,
          resizeMode: 'contain',
          transform: breathe ? [{ scale: breatheScale }] : [],
        }}
      />
    </View>
  );
}
