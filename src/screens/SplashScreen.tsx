import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, StyleSheet, Text, View, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from '../components/theme';

// ─── Constants ───────────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SPLASH_DURATION = 15000;             // 15 seconds exact
const LOGO_SIZE = 200;
const RING_SIZES = [220, 160, 110] as const;
const RING_DURATIONS = [8000, 12000, 6000] as const;
const RING_DIRECTIONS: ('cw' | 'ccw')[] = ['cw', 'ccw', 'cw'];
const DOT_COLORS = ['#7B2FFF', '#00D4FF', '#A855F7'] as const;

const STATUSES = [
  'Initializing secure enclave…',
  'Loading bootstrap peers…',
  'Verifying chain state…',
  'Preparing SPV engine…',
  'Ready.',
];
const STATUS_INTERVAL = 3000; // 5 messages × 3s = 15s

// Gradient stops for "IRIUM" per-letter interpolation
const GRADIENT_STOPS = ['#7B2FFF', '#00D4FF', '#A855F7'];

interface Props {
  hasWallet: boolean;
  onDone: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Linear interpolation between two hex colors at t∈[0,1]. */
function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/** Color at fraction f∈[0,1] across multi-stop gradient. */
function gradientAt(f: number): string {
  const segments = GRADIENT_STOPS.length - 1;
  const seg = Math.min(segments - 1, Math.floor(f * segments));
  const local = (f * segments) - seg;
  return lerpColor(GRADIENT_STOPS[seg], GRADIENT_STOPS[seg + 1], local);
}

// ─── Main component ──────────────────────────────────────────────────────────

export function IriumSplash({ onDone }: Props) {
  const [statusIdx, setStatusIdx] = useState(0);

  // Logo animations
  const logoScale   = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoFloat   = useRef(new Animated.Value(0)).current;

  // Text & progress fades
  const textOpacity = useRef(new Animated.Value(0)).current;
  const barOpacity  = useRef(new Animated.Value(0)).current;
  const progressW   = useRef(new Animated.Value(0)).current;
  const statusFade  = useRef(new Animated.Value(0)).current;

  // Ring rotations
  const ringRotations = useRef(RING_SIZES.map(() => new Animated.Value(0))).current;

  // ── Mount-time animations ──────────────────────────────────────────────────

  useEffect(() => {
    // Orbital rings — endless rotation
    ringRotations.forEach((rot, i) => {
      Animated.loop(
        Animated.timing(rot, {
          toValue: 1,
          duration: RING_DURATIONS[i],
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    });

    // Logo: invisible → spring to 1.0 with physics
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1.0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After landing: subtle continuous float -8 ↔ 8 over 3s, easeInOut
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoFloat, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(logoFloat, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    // Text fades in 400ms after logo lands (logo spring ≈ 600ms)
    Animated.sequence([
      Animated.delay(1000),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar fades in shortly after text
    Animated.sequence([
      Animated.delay(1500),
      Animated.timing(barOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Initial status fade-in
    Animated.timing(statusFade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Progress bar fill over 15 seconds (drives onDone) ──────────────────────

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(1, elapsed / SPLASH_DURATION);
      progressW.setValue(pct);
      if (pct >= 1) {
        clearInterval(id);
        setTimeout(onDone, 200);
      }
    }, 100);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Status message cycler with fade-out / fade-in ─────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      Animated.sequence([
        Animated.timing(statusFade, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(statusFade, { toValue: 0, duration: 0,   useNativeDriver: true }),
      ]).start(() => {
        setStatusIdx((i) => (i + 1) % STATUSES.length);
        Animated.timing(statusFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      });
    }, STATUS_INTERVAL);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived animated transforms ────────────────────────────────────────────

  const logoTranslateY = logoFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });

  const progressWidth = progressW.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  const iriumChars = 'IRIUM'.split('');

  return (
    <View style={styles.root}>
      {/* Deep-space backdrop: vertical gradient + center brightness */}
      <LinearGradient
        colors={['#000000', '#050510', '#0A0520']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {/* Centered "sun" glow to fake the bright-center radial */}
      <View style={styles.centerGlow} />
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

      {/* Logo + orbital rings (centered at 40% from top) */}
      <View style={styles.logoSlot}>
        <View style={styles.orbitContainer}>
          {RING_SIZES.map((size, i) => {
            const deg = ringRotations[i].interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', RING_DIRECTIONS[i] === 'cw' ? '360deg' : '-360deg'],
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.ring,
                  { width: size, height: size, transform: [{ rotate: deg }] },
                ]}
              >
                <View
                  style={[
                    styles.orbitDot,
                    {
                      backgroundColor: DOT_COLORS[i],
                      shadowColor: DOT_COLORS[i],
                      top: -3,
                    },
                  ]}
                />
              </Animated.View>
            );
          })}

          {/* Logo with dual glow + spring + float */}
          <Animated.View
            style={[
              styles.logoWrap,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }, { translateY: logoTranslateY }],
              },
            ]}
          >
            {/* Cyan outer glow layer */}
            <View style={styles.glowCyan} />
            {/* Purple inner glow layer */}
            <View style={styles.glowPurple} />
            <Animated.Image
              source={require('../../assets/irium-logo-transparent.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      </View>

      {/* IRIUM (gradient per-letter) + WALLET subtitle */}
      <Animated.View style={[styles.brandSlot, { opacity: textOpacity }]}>
        <View style={styles.iriumRow}>
          {iriumChars.map((ch, i) => (
            <Text
              key={i}
              style={[
                styles.iriumChar,
                { color: gradientAt(i / (iriumChars.length - 1)) },
              ]}
            >
              {ch}
            </Text>
          ))}
        </View>
        <Text style={styles.walletLabel}>WALLET</Text>
      </Animated.View>

      {/* Progress + status */}
      <Animated.View style={[styles.bottomSlot, { opacity: barOpacity }]}>
        <Animated.Text style={[styles.statusText, { opacity: statusFade }]}>
          {STATUSES[statusIdx]}
        </Animated.Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFillWrap, { width: progressWidth }]}>
            <LinearGradient
              colors={['#7B2FFF', '#00D4FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.progressFill}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },

  // Ambient glow blobs
  centerGlow: {
    position: 'absolute',
    top: SCREEN_H * 0.25,
    left: SCREEN_W * 0.25,
    width: SCREEN_W * 0.5,
    height: SCREEN_W * 0.5,
    borderRadius: 9999,
    backgroundColor: 'rgba(123,47,255,0.08)',
  },
  glowTopLeft: {
    position: 'absolute',
    top: '-12%',
    left: '-22%',
    width: '70%',
    height: '60%',
    borderRadius: 9999,
    backgroundColor: 'rgba(0,212,255,0.05)',
  },
  glowBottomRight: {
    position: 'absolute',
    bottom: '-14%',
    right: '-22%',
    width: '70%',
    height: '60%',
    borderRadius: 9999,
    backgroundColor: 'rgba(168,85,247,0.05)',
  },

  // Logo at 40% from top — slot grows from top, content centered
  logoSlot: {
    position: 'absolute',
    top: SCREEN_H * 0.4 - 110,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  orbitContainer: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Orbital rings
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  orbitDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },

  // Logo wrapper
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowPurple: {
    position: 'absolute',
    width: LOGO_SIZE * 0.9,
    height: LOGO_SIZE * 0.9,
    borderRadius: LOGO_SIZE,
    backgroundColor: 'rgba(123,47,255,0.25)',
    shadowColor: '#7B2FFF',
    shadowOpacity: 0.8,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  glowCyan: {
    position: 'absolute',
    width: LOGO_SIZE * 0.7,
    height: LOGO_SIZE * 0.7,
    borderRadius: LOGO_SIZE,
    backgroundColor: 'rgba(0,212,255,0.15)',
    shadowColor: '#00D4FF',
    shadowOpacity: 0.4,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },

  // Branding text — placed below logo slot
  brandSlot: {
    position: 'absolute',
    top: SCREEN_H * 0.4 + 150,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  iriumRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iriumChar: {
    fontSize: 36,
    fontFamily: Fonts.bold, // bundle tops at 700
    letterSpacing: 12,
    textShadowColor: 'rgba(123,47,255,0.6)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  walletLabel: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    letterSpacing: 8,
    color: '#6B7280',
    marginTop: 10,
  },

  // Bottom progress + status
  bottomSlot: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 14,
  },
  statusText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: '#4B5563',
    letterSpacing: 0.4,
  },
  progressTrack: {
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFillWrap: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
});
