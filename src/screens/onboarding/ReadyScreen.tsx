import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { bridge } from '../../bridge';
import { useWalletStore } from '../../store/wallet';
import { AddressText } from '../../components/AddressText';
import { Colors, Fonts, GradientColors } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Ready'> & {
  onComplete: () => void;
};

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
          opacity: disabled ? 0.45 : 1,
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

export function ReadyScreen({ onComplete }: Props) {
  const { seedHex, setAddress } = useWalletStore();
  const [addr, setAddr] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Green circle springs in
  const circleScale = useRef(new Animated.Value(0)).current;
  const circleOpacity = useRef(new Animated.Value(0)).current;

  // Checkmark fades in after circle
  const checkOpacity = useRef(new Animated.Value(0)).current;

  // Title slides up
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(16)).current;

  // Address + button fades in
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  // Derive address on mount
  useEffect(() => {
    if (!seedHex) {
      setLoading(false);
      return;
    }
    bridge
      .deriveAddress(seedHex, 0)
      .then((a) => {
        setAddr(a);
        setAddress(a);
      })
      .catch((e: any) => setError(e.message ?? 'Failed to derive address'))
      .finally(() => setLoading(false));
  }, [seedHex]);

  // Trigger animations once address is ready
  useEffect(() => {
    if (loading || error) return;

    // Circle springs in
    Animated.parallel([
      Animated.spring(circleScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(circleOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Checkmark fades in
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Title slides up
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();

    // Address fades in
    Animated.sequence([
      Animated.delay(550),
      Animated.timing(contentOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    // Button fades in last
    Animated.sequence([
      Animated.delay(850),
      Animated.timing(btnOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [loading, error]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.center}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            {/* Animated success circle */}
            <Animated.View
              style={[
                styles.successCircle,
                {
                  opacity: circleOpacity,
                  transform: [{ scale: circleScale }],
                },
              ]}
            >
              <Animated.Text style={[styles.checkmark, { opacity: checkOpacity }]}>
                ✓
              </Animated.Text>
            </Animated.View>

            {/* Title */}
            <Animated.View
              style={{
                opacity: titleOpacity,
                transform: [{ translateY: titleY }],
                alignItems: 'center',
                marginTop: 28,
                marginBottom: 24,
              }}
            >
              <Text style={styles.title}>Wallet Ready</Text>
              <Text style={styles.subtitle}>Your wallet has been set up successfully</Text>
            </Animated.View>

            {/* Address */}
            {addr.length > 0 && (
              <Animated.View style={[styles.addrCard, { opacity: contentOpacity }]}>
                <Text style={styles.addrLabel}>Your first address</Text>
                <AddressText address={addr} truncate={false} />
                <Text style={styles.tapHint}>Tap address to copy</Text>
              </Animated.View>
            )}
          </>
        )}
      </View>

      {/* Open wallet button */}
      <Animated.View style={[styles.footer, { opacity: btnOpacity }]}>
        <GradientBtn
          label="Open Wallet"
          onPress={onComplete}
          disabled={loading || !!error}
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
    paddingBottom: 60,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 0,
  },
  checkmark: {
    fontSize: 48,
    color: Colors.success,
    fontFamily: Fonts.bold,
    lineHeight: 56,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  addrCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  addrLabel: {
    fontSize: 11,
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tapHint: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.danger,
    textAlign: 'center',
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
