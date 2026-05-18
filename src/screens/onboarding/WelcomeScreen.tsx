import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Animated, Pressable, Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { Colors, Fonts } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <Animated.View style={[styles.body, { opacity: fade }]}>
        <Image
          source={require('../../../assets/irium-logo-transparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Welcome to Irium</Text>
        <Text style={styles.subtitle}>Your decentralized commerce wallet</Text>
      </Animated.View>

      <Animated.View style={[styles.actions, { opacity: fade }]}>
        <Pressable
          onPress={() => navigation.push('SecurityNotice', { mode: 'create' })}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryLabel}>Create New Wallet</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.push('ImportWallet')}
          style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.outlineLabel}>Import Wallet</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '20%',
    paddingHorizontal: 32,
    gap: 12,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  actions: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
  },
  outlineBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  outlineLabel: {
    color: Colors.primary,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
  },
});
