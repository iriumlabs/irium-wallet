import React, { useRef } from 'react';
import { Pressable, View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientColors, Colors, Fonts } from './theme';
import type { SettlementTemplate } from '../store/settlement';

interface Props {
  id: SettlementTemplate;
  title: string;
  subtitle: string;
  onPress: () => void;
}

export function TemplateCard({ title, subtitle, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn  = () => Animated.spring(scale, { toValue: 0.97, friction: 8, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    friction: 6, useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={styles.outer}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={GradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.badge}
        >
          <Text style={styles.badgeText}>{title}</Text>
        </LinearGradient>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>→</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { marginBottom: 12 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeText: { color: '#fff', fontFamily: Fonts.semiBold, fontSize: 11, letterSpacing: 0.5 },
  title: { color: Colors.text, fontSize: 17, fontFamily: Fonts.bold },
  sub:   { color: Colors.textMuted, fontSize: 13, fontFamily: Fonts.regular, marginTop: 4, lineHeight: 19 },
  arrow: { position: 'absolute', right: 18, top: '50%' },
  arrowText: { color: Colors.primary, fontSize: 18, fontFamily: Fonts.bold },
});
