import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { IriumLogo } from '../../components/IriumLogo';
import { Colors, Typography, GradientColors, Fonts } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Welcome'>;

function AnimatedButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={{ transform: [{ scale }], borderRadius: 14, overflow: 'hidden' }}>
        <LinearGradient
          colors={GradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btnGradient}
        >
          <Text style={styles.btnLabel}>{label}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

export function WelcomeScreen({ navigation }: Props) {
  const breatheScale = useRef(new Animated.Value(1)).current;
  const glowOpacity  = useRef(new Animated.Value(0.25)).current;
  const titleY       = useRef(new Animated.Value(30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subOpacity   = useRef(new Animated.Value(0)).current;
  const sub2Opacity  = useRef(new Animated.Value(0)).current;
  const btnOpacity   = useRef(new Animated.Value(0)).current;
  const btnY         = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    // Breathing logo pulse (4s cycle, loops forever)
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheScale, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
        Animated.timing(breatheScale, { toValue: 1.0,  duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Glow ring opacity pulse (offset from scale so they feel independent)
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.55, duration: 2200, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.2,  duration: 2200, useNativeDriver: true }),
      ])
    ).start();

    // Title + subtitles cascade in
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(titleY,       { toValue: 0, duration: 480, useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
      Animated.delay(120),
      Animated.timing(subOpacity,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.delay(80),
      Animated.timing(sub2Opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();

    // Buttons slide up from bottom
    Animated.sequence([
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(btnY,       { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={styles.center}>
        {/* Logo with breathing scale */}
        <Animated.View style={{ transform: [{ scale: breatheScale }], alignItems: 'center' }}>
          {/* Pulsing outer glow ring */}
          <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />
          <IriumLogo size={96} />
        </Animated.View>

        {/* Title slides up */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleY }],
            alignItems: 'center',
            marginTop: 28,
          }}
        >
          <Text style={styles.title}>Irium Wallet</Text>
        </Animated.View>

        {/* Tagline fades in */}
        <Animated.Text style={[styles.tagline, { opacity: subOpacity }]}>
          Decentralized Commerce Protocol
        </Animated.Text>

        {/* Sub-tagline fades in */}
        <Animated.Text style={[styles.sub, { opacity: sub2Opacity }]}>
          Your keys stay on this device — always.
        </Animated.Text>
      </View>

      {/* Buttons slide up from bottom */}
      <Animated.View
        style={[
          styles.actions,
          { opacity: btnOpacity, transform: [{ translateY: btnY }] },
        ]}
      >
        <AnimatedButton
          label="Create new wallet"
          onPress={() => navigation.navigate('Mnemonic', { mode: 'create' })}
        />
        <View style={{ height: 12 }} />
        <AnimatedButton
          label="Import existing wallet"
          onPress={() => navigation.navigate('Mnemonic', { mode: 'import' })}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 60,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: Colors.primary,
    // soft shadow on the ring itself
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 0,
  },
  title: {
    fontSize: 30,
    fontFamily: Fonts.bold,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 10,
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    opacity: 0.85,
  },
  sub: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  actions: {
    paddingTop: 8,
  },
  btnGradient: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.3,
  },
});
