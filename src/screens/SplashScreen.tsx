import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../components/theme';

interface Props {
  hasWallet: boolean;
  onDone: () => void;
}

export function IriumSplash({ onDone }: Props) {
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo springs in
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Text fades in 300ms after logo lands
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Hold for 900ms then dismiss
      Animated.delay(900),
    ]).start(() => onDone());
  }, []);

  return (
    <View style={styles.root}>
      {/* Radial glow behind logo */}
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

      {/* IRM logo */}
      <Animated.View
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Text style={styles.logoText}>IRM</Text>
      </Animated.View>

      {/* Irium Wallet text */}
      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textTranslate }],
          alignItems: 'center',
          marginTop: 24,
        }}
      >
        <Text style={styles.title}>Irium Wallet</Text>
        <Text style={styles.subtitle}>Decentralized Commerce Protocol</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.primary,
    // shadowColor creates the soft glow on supported platforms
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 60,
    elevation: 0,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontFamily: Fonts.bold,
    letterSpacing: 2,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginTop: 6,
  },
});
