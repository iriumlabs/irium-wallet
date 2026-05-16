import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
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

type Props = NativeStackScreenProps<OnboardingStackParams, 'SecurityNotice'>;

const WARNING_ITEMS = [
  {
    icon: 'eye-off-outline' as const,
    text: 'Never share these words with anyone',
  },
  {
    icon: 'lock-closed-outline' as const,
    text: 'Store them somewhere safe and offline',
  },
  {
    icon: 'warning-outline' as const,
    text: 'You cannot recover your wallet without them',
  },
];

function GradientButton({ label, onPress }: { label: string; onPress: () => void }) {
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

export function SecurityNoticeScreen({ navigation, route }: Props) {
  const { mode } = route.params;

  // Lock icon springs in on mount
  const iconScale = useRef(new Animated.Value(0)).current;
  // Title + items fade up
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(20)).current;
  const itemAnims = useRef(
    WARNING_ITEMS.map(() => ({
      opacity: new Animated.Value(0),
      y: new Animated.Value(16),
    }))
  ).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Icon springs in
    Animated.spring(iconScale, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();

    // Title slides up
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();

    // Items stagger in
    Animated.sequence([
      Animated.delay(400),
      Animated.stagger(
        120,
        itemAnims.map((anim) =>
          Animated.parallel([
            Animated.timing(anim.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(anim.y, { toValue: 0, duration: 300, useNativeDriver: true }),
          ])
        )
      ),
    ]).start();

    // Button fades in last
    Animated.sequence([
      Animated.delay(900),
      Animated.timing(btnOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header back button */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Lock icon springs in */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
          <Ionicons name="lock-closed" size={64} color={Colors.primary} />
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleY }],
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <Text style={styles.title}>Your Secret Recovery Phrase</Text>
          <Text style={styles.subtitle}>
            {mode === 'create'
              ? 'You will be shown 24 words that are the key to your wallet.'
              : 'You will need to enter your 12 or 24 word recovery phrase.'}
          </Text>
        </Animated.View>

        {/* Warning items */}
        {WARNING_ITEMS.map((item, i) => (
          <Animated.View
            key={i}
            style={[
              styles.warningCard,
              {
                opacity: itemAnims[i].opacity,
                transform: [{ translateY: itemAnims[i].y }],
              },
            ]}
          >
            <View style={styles.warningIconWrap}>
              <Ionicons name={item.icon} size={22} color={Colors.primary} />
            </View>
            <Text style={styles.warningText}>{item.text}</Text>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Bottom CTA */}
      <Animated.View style={[styles.footer, { opacity: btnOpacity }]}>
        <GradientButton
          label="I understand, show me"
          onPress={() => navigation.navigate('Mnemonic', { mode })}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 0,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    gap: 14,
  },
  warningIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
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
