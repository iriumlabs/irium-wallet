import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from './theme';

type Tone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastCtx {
  show: (message: string, tone?: Tone) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used inside <ToastProvider>');
  return c;
}

// Each tone defines:
//   bg     — translucent background (~13% alpha)
//   border — translucent border on top/right/bottom (~38% alpha)
//   accent — solid color for the 4px left-border stripe (notification-style)
//   fg     — text + icon color
//   icon   — Ionicons glyph
const TONE_COLORS: Record<
  Tone,
  { bg: string; border: string; accent: string; fg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  success: {
    bg: Colors.success + '22',
    border: Colors.success + '60',
    accent: Colors.success,
    fg: Colors.success,
    icon: 'checkmark-circle',
  },
  error: {
    bg: Colors.error + '22',
    border: Colors.error + '60',
    accent: Colors.error,
    fg: Colors.error,
    icon: 'alert-circle',
  },
  info: {
    bg: Colors.card,
    border: Colors.border,
    accent: Colors.textMuted,
    fg: Colors.textPrimary,
    icon: 'information-circle',
  },
};

const DEFAULT_DURATION_MS = 3200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, tone: Tone = 'info') => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(
      () => setItems((prev) => prev.filter((t) => t.id !== id)),
      DEFAULT_DURATION_MS,
    );
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <ToastStack items={items} />
    </Ctx.Provider>
  );
}

function ToastStack({ items }: { items: ToastItem[] }) {
  const insets = useContext(SafeAreaInsetsContext);
  return (
    <View
      pointerEvents="none"
      style={[styles.stack, { bottom: (insets?.bottom ?? 0) + 80 }]}
    >
      {items.map((t) => (
        <ToastRow key={t.id} item={t} />
      ))}
    </View>
  );
}

function ToastRow({ item }: { item: ToastItem }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    // Fade out shortly before the parent removes the item
    const fadeOutAt = DEFAULT_DURATION_MS - 220;
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }, fadeOutAt);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = TONE_COLORS[item.tone];

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          borderLeftColor: c.accent,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Ionicons name={c.icon} size={18} color={c.fg} />
      <Text style={[styles.text, { color: c.fg }]} numberOfLines={2}>
        {item.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 8,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4, // accent stripe in solid tone color
    maxWidth: 480,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    lineHeight: 18,
  },
});
