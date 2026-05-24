// @ts-nocheck
// This screen was removed from the onboarding navigator (the light
// client starts silently in WalletApp via usePeers() after onboarding
// completes). The file is preserved here for reference / potential
// re-enable. ts-nocheck above suppresses errors from the orphaned
// NativeStackScreenProps<..., 'Connecting'> ref, since 'Connecting' is
// no longer in OnboardingStackParams.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Pressable, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { StepDots } from '../../components/onboarding/StepDots';
import { Colors, Fonts } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Connecting'>;

const STEPS = [
  'Loading bootstrap peers',
  'Connecting to network',
  'Syncing block headers',
] as const;

const STEP_DELAYS = [800, 1600, 2400];
const COMPLETE_DELAY = 2700;
const TARGET_PEERS = 3;

export function ConnectingScreen({ navigation, route }: Props) {
  const mode = route.params?.mode ?? 'create';
  const stepCurrent = mode === 'import' ? 2 : 4;
  const stepTotal   = mode === 'import' ? 4 : 6;

  const [doneSteps, setDoneSteps] = useState<boolean[]>([false, false, false]);
  const [ready, setReady] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();

    STEPS.forEach((_, i) => {
      setTimeout(() => {
        setDoneSteps((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, STEP_DELAYS[i]);
    });

    const id = setTimeout(() => setReady(true), COMPLETE_DELAY);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <StepDots total={stepTotal} current={stepCurrent} />
      </View>

      <Animated.View style={[styles.body, { opacity: fade }]}>
        <Text style={styles.title}>Connecting to Network</Text>
        <Text style={styles.subtitle}>Finding peers…</Text>

        <View style={styles.statusList}>
          {STEPS.map((label, i) => (
            <View key={i} style={styles.statusRow}>
              {doneSteps[i] ? (
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              ) : (
                <ActivityIndicator size="small" color={Colors.primary} />
              )}
              <Text
                style={[
                  styles.statusLabel,
                  doneSteps[i] && { color: Colors.textPrimary },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>

        {ready && (
          <Text style={styles.peerText}>Connected to {TARGET_PEERS} peers</Text>
        )}
      </Animated.View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => navigation.push('SecureWallet')}
          disabled={!ready}
          style={({ pressed }) => [
            styles.cta,
            { opacity: pressed ? 0.85 : ready ? 1 : 0.4 },
          ]}
        >
          <Text style={styles.ctaLabel}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },

  statusList: {
    width: '100%',
    gap: 14,
    marginTop: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },

  peerText: {
    marginTop: 24,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.success,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  cta: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
