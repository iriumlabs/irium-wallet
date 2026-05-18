import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Pressable, Animated,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { Colors, Fonts, GradientColors } from '../../components/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { DeepSpaceBg } from '../../components/onboarding/DeepSpaceBg';
import { StepDots } from '../../components/onboarding/StepDots';

const AUTH_METHOD_KEY = 'irium_auth_method';
const AUTH_PIN_KEY    = 'irium_auth_pin';

type Props = NativeStackScreenProps<OnboardingStackParams, 'SecureWallet'>;

type PinStep = 'method' | 'pin_enter' | 'pin_confirm';

export function SecureWalletScreen({ navigation }: Props) {
  const goNext = () => navigation.push('Ready');
  const [step, setStep]           = useState<PinStep>('method');
  const [pin, setPin]             = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [biometricAvail, setBiometricAvail] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    LocalAuthentication.hasHardwareAsync().then((has) => {
      if (!has) return;
      LocalAuthentication.isEnrolledAsync().then(setBiometricAvail);
    }).catch(() => {});
  }, []);

  async function chooseBiometric() {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to enable biometric lock',
    });
    if (result.success) {
      await SecureStore.setItemAsync(AUTH_METHOD_KEY, 'biometric');
      goNext();
    } else {
      Alert.alert('Failed', 'Authentication failed. Please choose another method.');
    }
  }

  function choosePIN() {
    setPin('');
    setConfirmPin('');
    setStep('pin_enter');
  }

  async function skip() {
    await SecureStore.setItemAsync(AUTH_METHOD_KEY, 'none');
    goNext();
  }

  async function submitPin() {
    if (step === 'pin_enter') {
      if (pin.length < 4) {
        Alert.alert('Too short', 'PIN must be at least 4 digits');
        return;
      }
      setStep('pin_confirm');
      return;
    }
    if (confirmPin !== pin) {
      Alert.alert('Mismatch', 'PINs do not match');
      setConfirmPin('');
      return;
    }
    await SecureStore.setItemAsync(AUTH_PIN_KEY, pin);
    await SecureStore.setItemAsync(AUTH_METHOD_KEY, 'pin');
    goNext();
  }

  if (step === 'pin_enter' || step === 'pin_confirm') {
    const isPinEnter = step === 'pin_enter';
    return (
      <SafeAreaView style={styles.root}>
        <DeepSpaceBg />
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.center}>
          <Ionicons name="keypad-outline" size={52} color={Colors.primary} style={{ marginBottom: 20 }} />
          <Text style={styles.title}>{isPinEnter ? 'Set Your PIN' : 'Confirm PIN'}</Text>
          <Text style={styles.subtitle}>
            {isPinEnter ? 'Choose a 4–6 digit PIN' : 'Enter the same PIN again to confirm'}
          </Text>

          {/* PIN dots */}
          <View style={styles.pinDots}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  (isPinEnter ? pin : confirmPin).length > i && styles.pinDotFilled,
                ]}
              />
            ))}
          </View>

          <TextInput
            style={styles.hiddenInput}
            value={isPinEnter ? pin : confirmPin}
            onChangeText={isPinEnter ? setPin : setConfirmPin}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            autoFocus
          />
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.gradBtnWrap} onPress={submitPin}>
            <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
              <Text style={styles.gradBtnText}>{isPinEnter ? 'Next' : 'Confirm'}</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => setStep('method')} style={styles.skipBtn}>
            <Text style={styles.skipText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <DeepSpaceBg />
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 8 }}>
        <StepDots total={6} current={5} />
      </View>
      <Animated.View style={[styles.content, { opacity: fadeIn }]}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark-outline" size={56} color={Colors.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Protect Your Wallet</Text>
          <Text style={styles.subtitle}>Choose how you want to secure access to your wallet</Text>
        </View>

        <View style={styles.options}>
          {biometricAvail && (
            <Pressable style={styles.optionCard} onPress={chooseBiometric}>
              <View style={styles.optionIcon}>
                <Ionicons name="finger-print-outline" size={28} color={Colors.primary} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Face ID / Biometrics</Text>
                <Text style={styles.optionSub}>Use biometric authentication to unlock</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </Pressable>
          )}

          <Pressable style={styles.optionCard} onPress={choosePIN}>
            <View style={styles.optionIcon}>
              <Ionicons name="keypad-outline" size={28} color={Colors.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>PIN Code</Text>
              <Text style={styles.optionSub}>Set a 4–6 digit PIN to unlock your wallet</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <Pressable onPress={skip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', justifyContent: 'space-between' },
  content: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', paddingTop: 48, paddingBottom: 32 },
  title: {
    fontSize: 26, fontFamily: Fonts.bold, color: Colors.textPrimary,
    marginBottom: 10, textAlign: 'center',
  },
  subtitle: {
    fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 21,
  },
  options: { gap: 12, paddingTop: 4 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, padding: 18,
  },
  optionIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.primary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textPrimary, marginBottom: 3 },
  optionSub: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary },

  // PIN entry
  pinDots: { flexDirection: 'row', gap: 14, marginTop: 32, marginBottom: 8 },
  pinDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: 'transparent',
  },
  pinDotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  hiddenInput: {
    position: 'absolute', opacity: 0, width: 1, height: 1,
  },

  // Footer
  footer: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  gradBtnWrap: { borderRadius: 14, overflow: 'hidden' },
  gradBtn: { paddingVertical: 17, alignItems: 'center' },
  gradBtnText: { color: Colors.textPrimary, fontSize: 16, fontFamily: Fonts.semiBold },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: Colors.textSecondary, fontSize: 14, fontFamily: Fonts.regular },
});
