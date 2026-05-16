import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors, Fonts } from '../components/theme';
import { IriumLogo } from '../components/IriumLogo';

interface Props {
  hasWallet: boolean;
  onDone: () => void;
}

export function IriumSplash({ onDone }: Props) {
  const logoScale   = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const iriumOpacity = useRef(new Animated.Value(0)).current;
  const walletOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo springs in from 0 with overshoot
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 70,
        friction: 6,
        useNativeDriver: true,
      }),
      // Glow expands
      Animated.timing(glowOpacity, {
        toValue: 0.4,
        duration: 400,
        useNativeDriver: true,
      }),
      // "IRIUM" fades in after 600ms
      Animated.delay(200),
      Animated.timing(iriumOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      // "WALLET" fades in after 800ms
      Animated.delay(200),
      Animated.timing(walletOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.delay(700),
    ]).start(() => onDone());
  }, []);

  return (
    <View style={styles.root}>
      {/* Radial glow behind logo */}
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

      <Animated.View style={{ transform: [{ scale: logoScale }] }}>
        <IriumLogo size={120} />
      </Animated.View>

      <Animated.Text style={[styles.irium, { opacity: iriumOpacity }]}>
        IRIUM
      </Animated.Text>
      <Animated.Text style={[styles.wallet, { opacity: walletOpacity }]}>
        WALLET
      </Animated.Text>
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
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#7B2FFF',
    shadowColor: '#7B2FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 80,
    elevation: 0,
  },
  irium: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontFamily: Fonts.bold,
    letterSpacing: 8,
    marginTop: 28,
  },
  wallet: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.regular,
    letterSpacing: 4,
    marginTop: 6,
  },
});
