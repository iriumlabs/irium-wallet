import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, Fonts } from '../components/theme';

const ICON_MAP: Record<string, {
  outline: keyof typeof Ionicons.glyphMap;
  filled:  keyof typeof Ionicons.glyphMap;
  label:   string;
}> = {
  Dashboard:   { outline: 'home-outline',         filled: 'home',         label: 'Home' },
  Send:        { outline: 'arrow-up-outline',     filled: 'arrow-up',     label: 'Send' },
  Receive:     { outline: 'arrow-down-outline',   filled: 'arrow-down',   label: 'Receive' },
  History:     { outline: 'time-outline',         filled: 'time',         label: 'History' },
  Settlement:  { outline: 'shield-outline',       filled: 'shield',       label: 'Settle' },
  Marketplace: { outline: 'storefront-outline',   filled: 'storefront',   label: 'Market' },
};

function TabItem({ routeName, focused, onPress }: {
  routeName: string; focused: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const meta  = ICON_MAP[routeName];
  if (!meta) return null;

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.92, friction: 7, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start()}
      hitSlop={4}
      style={styles.itemWrap}
    >
      <Animated.View style={[styles.itemInner, { transform: [{ scale }] }]}>
        <Ionicons
          name={focused ? meta.filled : meta.outline}
          size={22}
          color={focused ? Colors.primary : Colors.textMuted}
        />
        <Text
          style={[
            styles.label,
            { color: focused ? Colors.primary : Colors.textMuted },
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
  const visible = state.routes.filter((r) => ICON_MAP[r.name]);

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 10), height: 70 + insets.bottom },
      ]}
    >
      <View style={styles.row}>
        {visible.map((route) => {
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
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
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
    gap: 4,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    letterSpacing: 0.2,
  },
});
