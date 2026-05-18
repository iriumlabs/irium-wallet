import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, Fonts } from '../components/theme';

// Map route name → outline + filled icon
const ICON_MAP: Record<string, { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap; label: string }> = {
  Dashboard:   { outline: 'home-outline',         filled: 'home',         label: 'Home' },
  Send:        { outline: 'arrow-up-outline',     filled: 'arrow-up',     label: 'Send' },
  Receive:     { outline: 'arrow-down-outline',   filled: 'arrow-down',   label: 'Receive' },
  History:     { outline: 'time-outline',         filled: 'time',         label: 'History' },
  Settlement:  { outline: 'shield-outline',       filled: 'shield',       label: 'Settle' },
  Marketplace: { outline: 'storefront-outline',   filled: 'storefront',   label: 'Market' },
};

interface ItemProps {
  routeName: string;
  focused: boolean;
  onPress: () => void;
}

function TabItem({ routeName, focused, onPress }: ItemProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const meta  = ICON_MAP[routeName];
  if (!meta) return null;

  // Pulse the pill when activated
  useEffect(() => {
    if (!focused) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [focused, scale]);

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.88, friction: 7, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start()}
      hitSlop={4}
      style={styles.itemWrap}
    >
      <Animated.View style={[styles.itemInner, { transform: [{ scale }] }]}>
        {focused && <View style={styles.activePill} />}
        <Ionicons
          name={focused ? meta.filled : meta.outline}
          size={focused ? 22 : 20}
          color={focused ? Colors.primary : '#4B5563'}
        />
        <Text
          style={[
            styles.label,
            focused ? styles.labelActive : styles.labelInactive,
          ]}
          numberOfLines={1}
        >
          {meta.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r) => ICON_MAP[r.name]);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10), height: 85 + insets.bottom * 0.3 }]}>
      {/* Gradient top border */}
      <LinearGradient
        colors={['rgba(123,47,255,0.5)', 'rgba(0,212,255,0.5)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topBorder}
      />
      <View style={styles.row}>
        {visibleRoutes.map((route) => {
          const focused = state.index === state.routes.findIndex((r) => r.key === route.key);
          const descriptor = descriptors[route.key];
          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, descriptor.route.params);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#05050F',
    borderTopWidth: 0,
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
  },
  itemWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 14,
    position: 'relative',
    minWidth: 52,
  },
  activePill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    backgroundColor: 'rgba(123,47,255,0.15)',
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.3,
  },
  labelActive:   { color: Colors.primary },
  labelInactive: { color: '#4B5563' },
});
