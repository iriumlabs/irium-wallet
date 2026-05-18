import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Animated, TextInput, Pressable, Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DeepSpaceBg } from '../components/onboarding/DeepSpaceBg';
import { IriumLogo } from '../components/IriumLogo';
import { Colors, Fonts, GradientColors } from '../components/theme';

const AUTH_METHOD_KEY = 'irium_auth_method';
const AUTH_PIN_KEY    = 'irium_auth_pin';

interface Props {
  method: 'pin' | 'biometric';
  onUnlock: () => void;
}

export function AuthLockScreen({ method, onUnlock }: Props) {
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState<string | null>(null);
  const shake               = useRef(new Animated.Value(0)).current;
  const fadeIn              = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    if (method === 'biometric') {
      runBiometric();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runBiometric() {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Irium Wallet',
        fallbackLabel: 'Enter PIN',
      });
      if (result.success) {
        onUnlock();
      } else {
        setError('Authentication cancelled. Try again.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Biometric unavailable');
    }
  }

  async function trySubmitPin(value: string) {
    const stored = await SecureStore.getItemAsync(AUTH_PIN_KEY);
    if (stored && value === stored) {
      onUnlock();
      return;
    }
    triggerShake();
    setError('Incorrect PIN');
    setTimeout(() => { setPin(''); setError(null); }, 1000);
  }

  function onChangePin(value: string) {
    if (value.length > 6) return;
    setPin(value);
    if (value.length >= 4 && value.length <= 6) {
      // Auto-submit when length reaches stored PIN length on next 6
    }
    if (value.length === 6) {
      trySubmitPin(value);
    }
  }

  function triggerShake() {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleSubmit() {
    if (pin.length < 4) {
      setError('Enter at least 4 digits');
      return;
    }
    trySubmitPin(pin);
  }

  return (
    <View style={styles.root}>
      <DeepSpaceBg />
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Animated.View style={[styles.center, { opacity: fadeIn }]}>
        <IriumLogo size={64} glow />
        <Text style={styles.title}>Welcome Back</Text>

        {method === 'biometric' ? (
          <>
            <Text style={styles.subtitle}>Authenticate to unlock your wallet.</Text>
            <Pressable onPress={runBiometric} style={styles.bioBtn}>
              <Ionicons name="finger-print-outline" size={32} color={Colors.primary} />
              <Text style={styles.bioText}>Try Biometric Again</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>Enter your PIN to continue</Text>
            <Animated.View style={{ transform: [{ translateX: shake }] }}>
              <View style={styles.pinDots}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.pinDot,
                      pin.length > i && styles.pinDotFilled,
                      error && styles.pinDotError,
                    ]}
                  />
                ))}
              </View>
              <TextInput
                style={styles.hiddenInput}
                value={pin}
                onChangeText={onChangePin}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                autoFocus
              />
            </Animated.View>
            {error && <Text style={styles.errorText}>{error}</Text>}
            {pin.length >= 4 && pin.length < 6 && (
              <Pressable onPress={handleSubmit} style={styles.gradBtnWrap}>
                <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
                  <Text style={styles.gradBtnText}>Unlock</Text>
                </LinearGradient>
              </Pressable>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 18 },

  title: { fontSize: 26, fontFamily: Fonts.bold, color: '#FFFFFF', marginTop: 28 },
  subtitle: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },

  pinDots: { flexDirection: 'row', gap: 14, marginTop: 24, marginBottom: 8 },
  pinDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent',
  },
  pinDotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pinDotError: { borderColor: Colors.danger },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  errorText: { color: Colors.danger, fontFamily: Fonts.semiBold, fontSize: 13 },

  gradBtnWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 16 },
  gradBtn: { paddingVertical: 14, paddingHorizontal: 36 },
  gradBtnText: { color: '#FFFFFF', fontFamily: Fonts.semiBold, fontSize: 15 },

  bioBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(123,47,255,0.08)',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  bioText: { color: Colors.primary, fontFamily: Fonts.semiBold, fontSize: 14 },
});
