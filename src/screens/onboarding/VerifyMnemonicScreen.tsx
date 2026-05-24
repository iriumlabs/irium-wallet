import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { Colors, Fonts, GradientColors } from '../../components/theme';
import { DeepSpaceBg } from '../../components/onboarding/DeepSpaceBg';
import { StepDots } from '../../components/onboarding/StepDots';
import { tempMnemonicWords } from './MnemonicScreen';

type Props = NativeStackScreenProps<OnboardingStackParams, 'VerifyMnemonic'>;

// Pick 3 deterministic random positions from the word list
function pickThreePositions(wordCount: number): [number, number, number] {
  if (wordCount < 3) return [0, 1, 2];
  // Spread them across early, mid, late thirds
  const third = Math.floor(wordCount / 3);
  const p1 = 1 + Math.floor(Math.random() * (third - 1));
  const p2 = third + 1 + Math.floor(Math.random() * (third - 1));
  const p3 = third * 2 + 1 + Math.floor(Math.random() * (third - 1));
  return [p1, p2, p3];
}

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

export function VerifyMnemonicScreen({ navigation }: Props) {
  const words = tempMnemonicWords;
  const wordCount = words.length > 0 ? words.length : 24;

  // Pick 3 positions once on mount
  const [positions] = useState<[number, number, number]>(() =>
    pickThreePositions(wordCount)
  );

  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [submitted, setSubmitted] = useState(false);
  const shakeAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  function triggerShake(i: number) {
    const v = shakeAnims[i];
    v.setValue(0);
    Animated.sequence([
      Animated.timing(v, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(v, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(v, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  }

  // Entrance animations
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(20)).current;
  const cardAnims = useRef(
    [0, 1, 2].map(() => ({
      opacity: new Animated.Value(0),
      y: new Animated.Value(16),
    }))
  ).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
      Animated.stagger(
        110,
        cardAnims.map((a) =>
          Animated.parallel([
            Animated.timing(a.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(a.y, { toValue: 0, duration: 300, useNativeDriver: true }),
          ])
        )
      ),
      Animated.timing(btnOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  function updateAnswer(i: number, val: string) {
    const next = [...answers];
    next[i] = val.trim().toLowerCase();
    setAnswers(next);
  }

  function verify(): boolean {
    // Strict: every answer must match the actual word at that position.
    // If the words array is empty (mnemonic generation failed upstream),
    // verification must REFUSE — accepting "any non-empty answer" used
    // to happen here in the old mock-friendly path and silently let the
    // user finish onboarding with no real backup.
    if (words.length === 0) return false;
    return positions.every((pos, i) => {
      const expected = words[pos]?.toLowerCase() ?? '';
      const given = answers[i].toLowerCase();
      if (!expected) return false;
      return given === expected;
    });
  }

  function onConfirm() {
    setSubmitted(true);
    if (verify()) {
      navigation.push('SecureWallet');
      return;
    }
    // Shake any cards that have a wrong answer
    positions.forEach((pos, i) => {
      const expected = words[pos]?.toLowerCase() ?? '';
      const given    = answers[i].toLowerCase();
      if (expected && given !== expected) triggerShake(i);
    });
  }

  const allFilled = answers.every((a) => a.length > 0);

  return (
    <View style={styles.root}>
      <DeepSpaceBg />
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <StepDots total={6} current={3} />
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleY }],
            marginBottom: 32,
          }}
        >
          <Text style={styles.title}>Verify Your Backup</Text>
          <Text style={styles.subtitle}>
            Enter the words at the positions below to confirm you have written your recovery phrase
            down correctly.
          </Text>
        </Animated.View>

        {/* 3 word input cards */}
        {positions.map((pos, i) => {
          const expected = words[pos]?.toLowerCase() ?? '';
          const given = answers[i].toLowerCase();
          const isWrong = submitted && given !== '' && expected !== '' && given !== expected;
          const isOk = submitted && expected !== '' && given === expected;

          return (
            <Animated.View
              key={i}
              style={[
                styles.card,
                isWrong && styles.cardError,
                isOk && styles.cardOk,
                {
                  opacity: cardAnims[i].opacity,
                  transform: [
                    { translateY: cardAnims[i].y },
                    { translateX: shakeAnims[i] },
                  ],
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Word #{pos + 1}</Text>
                </View>
                {isOk && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                )}
                {isWrong && (
                  <Ionicons name="close-circle" size={20} color={Colors.danger} />
                )}
              </View>
              <TextInput
                style={[styles.input, isWrong && styles.inputError, isOk && styles.inputOk]}
                value={answers[i]}
                onChangeText={(v) => {
                  setSubmitted(false);
                  updateAnswer(i, v);
                }}
                placeholder={`Word #${pos + 1}`}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </Animated.View>
          );
        })}

        {/* Error banner */}
        {submitted && !verify() && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>
              One or more words don&apos;t match. Check your backup and try again.
            </Text>
          </View>
        )}

        <Animated.View style={[styles.btnWrap, { opacity: btnOpacity }]}>
          <GradientBtn label="Confirm" onPress={onConfirm} disabled={!allFilled} />
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 60 },
  title: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
  },
  cardError: {
    borderColor: Colors.danger,
    shadowColor: Colors.danger,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  cardOk: {
    borderColor: Colors.success,
    shadowColor: Colors.success,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    backgroundColor: Colors.cardElevated,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
    color: Colors.primary,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: Fonts.medium,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  inputOk: {
    borderColor: Colors.success,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#2A0A0A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.danger,
    lineHeight: 19,
  },
  btnWrap: {
    marginTop: 8,
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
