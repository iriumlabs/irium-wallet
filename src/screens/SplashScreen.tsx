import React, { useEffect, useRef } from 'react';
import {
  Animated, Image, StyleSheet, Text, View,
} from 'react-native';
import { Colors, Fonts } from '../components/theme';

const SPLASH_DURATION = 3000; // 3 seconds max

interface Props {
  hasWallet: boolean;
  onDone: () => void;
}

export function IriumSplash({ onDone }: Props) {
  const fade     = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade content in
    Animated.timing(fade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Progress bar fills over 3 seconds
    Animated.timing(progress, {
      toValue: 1,
      duration: SPLASH_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onDone();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.content, { opacity: fade }]}>
        <Image
          source={require('../../assets/irium-logo-transparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.iriumLabel}>Irium</Text>
        <Text style={styles.walletLabel}>Wallet</Text>
      </Animated.View>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  iriumLabel: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  walletLabel: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontFamily: Fonts.regular,
    marginTop: -4,
  },
  barTrack: {
    position: 'absolute',
    bottom: 60,
    left: 32,
    right: 32,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(99,102,241,0.15)',
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 1.5,
  },
});
