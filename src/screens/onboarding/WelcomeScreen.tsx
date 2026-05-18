import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Animated, Pressable, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { IriumLogo } from '../../components/IriumLogo';
import { GradientText } from '../../components/GradientText';
import { DeepSpaceBg } from '../../components/onboarding/DeepSpaceBg';
import { Colors, Fonts, GradientColors } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Welcome'>;

const TAGLINE_WORDS = ['Trustless.', 'Borderless.', 'Yours.'];

export function WelcomeScreen({ navigation }: Props) {
  // Logo float (matches splash)
  const logoFloat = useRef(new Animated.Value(0)).current;
  // Entrance fades
  const brandOpacity   = useRef(new Animated.Value(0)).current;
  const brandY         = useRef(new Animated.Value(20)).current;
  const subOpacity     = useRef(new Animated.Value(0)).current;
  const wordAnims      = useRef(TAGLINE_WORDS.map(() => new Animated.Value(0))).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsY       = useRef(new Animated.Value(24)).current;
  // Press scales
  const primaryScale   = useRef(new Animated.Value(1)).current;
  const secondaryScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous logo float -8 ↔ 8 px
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(logoFloat, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // Brand block springs up
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(brandOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(brandY,       { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(80),
      Animated.timing(subOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Tagline appears word-by-word
    Animated.sequence([
      Animated.delay(900),
      Animated.stagger(180, wordAnims.map((a) =>
        Animated.timing(a, { toValue: 1, duration: 280, useNativeDriver: true }),
      )),
    ]).start();

    // Buttons slide up
    Animated.sequence([
      Animated.delay(1500),
      Animated.parallel([
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(buttonsY,       { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logoY = logoFloat.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });

  function pressSpring(v: Animated.Value, to: number) {
    Animated.spring(v, { toValue: to, useNativeDriver: true, friction: 6 }).start();
  }

  return (
    <View style={styles.root}>
      <DeepSpaceBg />
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.body}>
        {/* Floating logo */}
        <Animated.View style={[styles.logoWrap, { transform: [{ translateY: logoY }] }]}>
          {/* Dual glow */}
          <View style={styles.glowPurple} />
          <View style={styles.glowCyan} />
          <IriumLogo size={110} glow />
        </Animated.View>

        {/* Brand block: IRIUM WALLET (gradient) + subtitle */}
        <Animated.View style={[styles.brand, { opacity: brandOpacity, transform: [{ translateY: brandY }] }]}>
          <GradientText
            text="IRIUM WALLET"
            stops={['#7B2FFF', '#00D4FF']}
            style={styles.brandChar}
          />
        </Animated.View>

        <Animated.Text style={[styles.subtitle, { opacity: subOpacity }]}>
          Decentralized Commerce Protocol
        </Animated.Text>

        {/* Tagline — word by word */}
        <View style={styles.tagline}>
          {TAGLINE_WORDS.map((word, i) => (
            <Animated.Text key={word} style={[styles.taglineWord, { opacity: wordAnims[i] }]}>
              {word}
            </Animated.Text>
          ))}
        </View>
      </View>

      {/* Buttons */}
      <Animated.View style={[styles.actions, { opacity: buttonsOpacity, transform: [{ translateY: buttonsY }] }]}>
        {/* Primary — gradient fill */}
        <Pressable
          onPressIn={() => pressSpring(primaryScale, 0.97)}
          onPressOut={() => pressSpring(primaryScale, 1)}
          onPress={() => navigation.push('SecurityNotice', { mode: 'create' })}
        >
          <Animated.View style={{ transform: [{ scale: primaryScale }], borderRadius: 16, overflow: 'hidden' }}>
            <LinearGradient
              colors={GradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryLabel}>Create New Wallet</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>

        <View style={{ height: 12 }} />

        {/* Secondary — glass / border-gradient */}
        <Pressable
          onPressIn={() => pressSpring(secondaryScale, 0.97)}
          onPressOut={() => pressSpring(secondaryScale, 1)}
          onPress={() => navigation.push('ImportWallet')}
        >
          <Animated.View style={{ transform: [{ scale: secondaryScale }] }}>
            <View style={styles.secondaryWrap}>
              {/* Gradient border via padded gradient + inner fill */}
              <LinearGradient
                colors={GradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.secondaryBorder}
              >
                <View style={styles.secondaryInner}>
                  <Text style={styles.secondaryLabel}>Import Wallet</Text>
                </View>
              </LinearGradient>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  body: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },

  // Logo + dual glow
  logoWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  glowPurple: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(123,47,255,0.18)',
    shadowColor: '#7B2FFF',
    shadowOpacity: 0.8,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  glowCyan: {
    position: 'absolute',
    width: 95,
    height: 95,
    borderRadius: 50,
    backgroundColor: 'rgba(0,212,255,0.12)',
    shadowColor: '#00D4FF',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },

  // Brand text
  brand: { alignItems: 'center' },
  brandChar: {
    fontSize: 30,
    fontFamily: Fonts.bold,
    letterSpacing: 4,
    textShadowColor: 'rgba(123,47,255,0.6)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },

  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  tagline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  taglineWord: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.5,
  },

  // Buttons
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  primaryBtn: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.3,
  },
  secondaryWrap: { borderRadius: 16, overflow: 'hidden' },
  secondaryBorder: {
    padding: 1.5,
    borderRadius: 16,
  },
  secondaryInner: {
    backgroundColor: 'rgba(10,10,26,0.85)',
    borderRadius: 14.5,
    paddingVertical: 15.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.3,
  },
});
