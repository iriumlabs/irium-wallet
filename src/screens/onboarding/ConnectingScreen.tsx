import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { IriumLogo } from '../../components/IriumLogo';
import { Colors, Fonts, GradientColors } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Connecting'>;

const STEPS = [
  { label: 'Loading bootstrap peers', delay: 800 },
  { label: 'Connecting to network', delay: 1600 },
  { label: 'Syncing block headers', delay: 2400 },
] as const;

const MOCK_PEERS = 3;
const COMPLETE_DELAY = 2400;

function GradientBtn({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled}>
      <Animated.View
        style={{
          transform: [{ scale }],
          borderRadius: 14,
          overflow: 'hidden',
          opacity: disabled ? 0.4 : 1,
        }}
      >
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

export function ConnectingScreen({ navigation }: Props) {
  // Which steps have resolved (0, 1, 2)
  const [doneSteps, setDoneSteps] = useState<boolean[]>([false, false, false]);
  const [ready, setReady] = useState(false);
  const [peers] = useState(MOCK_PEERS);

  // Pulsing ring
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.5)).current;

  // Per-step animations: checkmark opacity
  const checkAnims = useRef(STEPS.map(() => new Animated.Value(0))).current;
  const rowAnims = useRef(
    STEPS.map(() => ({ opacity: new Animated.Value(0), x: new Animated.Value(-16) }))
  ).current;

  // Title + logo entrance
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(20)).current;

  // Button entrance
  const btnOpacity = useRef(new Animated.Value(0)).current;

  // Peer count scale flash
  const peerScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Title slides in
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(titleY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    // Pulsing ring loop
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ringScale, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(ringScale, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.1, duration: 1000, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Status rows stagger in
    Animated.stagger(
      140,
      rowAnims.map((a) =>
        Animated.parallel([
          Animated.timing(a.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(a.x, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      )
    ).start();

    // Per-step timed checkmarks
    STEPS.forEach((step, i) => {
      const timer = setTimeout(() => {
        setDoneSteps((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        Animated.timing(checkAnims[i], {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }, step.delay);
      return timer;
    });

    // Peer count springs in
    const peerTimer = setTimeout(() => {
      Animated.spring(peerScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }, 600);

    // Enable continue button
    const readyTimer = setTimeout(() => {
      setReady(true);
      Animated.timing(btnOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }, COMPLETE_DELAY + 300);

    return () => {
      clearTimeout(peerTimer);
      clearTimeout(readyTimer);
    };
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.center}>
        {/* Title */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleY }],
            alignItems: 'center',
            marginBottom: 40,
          }}
        >
          <Text style={styles.title}>Connecting to Irium Network</Text>
          <Text style={styles.subtitle}>Finding peers on port 38291…</Text>
        </Animated.View>

        {/* Logo with pulsing ring */}
        <View style={styles.logoWrap}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                borderColor: Colors.primary,
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
          />
          <IriumLogo size={80} animated glow />
        </View>

        {/* Peer count */}
        <Animated.View style={{ transform: [{ scale: peerScale }], marginBottom: 40 }}>
          <Text style={styles.peerText}>Connected to {peers} peers</Text>
        </Animated.View>

        {/* Status rows */}
        <View style={styles.statusRows}>
          {STEPS.map((step, i) => (
            <Animated.View
              key={i}
              style={[
                styles.statusRow,
                {
                  opacity: rowAnims[i].opacity,
                  transform: [{ translateX: rowAnims[i].x }],
                },
              ]}
            >
              {/* Icon area 24px */}
              <View style={styles.iconArea}>
                {doneSteps[i] ? (
                  <Animated.View style={{ opacity: checkAnims[i] }}>
                    <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                  </Animated.View>
                ) : (
                  <View style={styles.spinnerDot} />
                )}
              </View>
              <Text
                style={[
                  styles.rowLabel,
                  { color: doneSteps[i] ? Colors.textPrimary : Colors.textSecondary },
                ]}
              >
                {step.label}
              </Text>
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Continue button */}
      <Animated.View style={[styles.footer, { opacity: btnOpacity }]}>
        <GradientBtn
          label={`Continue — ${peers} peer${peers !== 1 ? 's' : ''} connected`}
          onPress={() => navigation.navigate('Ready')}
          disabled={!ready}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  logoWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  peerText: {
    fontSize: 14,
    fontFamily: Fonts.semibold,
    color: Colors.success,
    textAlign: 'center',
  },
  statusRows: {
    width: '100%',
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconArea: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
    opacity: 0.5,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    flex: 1,
  },
  footer: {
    paddingTop: 12,
  },
  btnGradient: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: Fonts.semibold,
    letterSpacing: 0.3,
  },
});
