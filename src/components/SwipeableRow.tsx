import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from './theme';

const ACTION_WIDTH = 80;
const SWIPE_OPEN_AT = ACTION_WIDTH * 0.5;

interface Props {
  /** Unique key for tracking which row is currently open globally */
  rowKey: string;
  /** Callback when the user confirms delete via the revealed button */
  onAction: () => void;
  /** Label on the action button (e.g. "Delete", "Archive") */
  actionLabel?: string;
  /** Color of the action button background */
  actionColor?: string;
  /** Icon for the action button */
  actionIcon?: keyof typeof Ionicons.glyphMap;
  /** Currently open row key (from parent) — closes this row if it's not us */
  openRowKey: string | null;
  /** Setter from parent to update which row is open */
  setOpenRowKey: (k: string | null) => void;
  children: React.ReactNode;
}

export function SwipeableRow({
  rowKey,
  onAction,
  actionLabel = 'Delete',
  actionColor = Colors.danger,
  actionIcon = 'trash-outline',
  openRowKey,
  setOpenRowKey,
  children,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen     = useRef(false);

  // Close this row whenever another row opens
  useEffect(() => {
    if (openRowKey !== rowKey && isOpen.current) {
      isOpen.current = false;
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 9, tension: 70 }).start();
    }
  }, [openRowKey, rowKey, translateX]);

  function open() {
    isOpen.current = true;
    setOpenRowKey(rowKey);
    Animated.spring(translateX, { toValue: -ACTION_WIDTH, useNativeDriver: true, friction: 9, tension: 70 }).start();
  }
  function close() {
    isOpen.current = false;
    setOpenRowKey(null);
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 9, tension: 70 }).start();
  }

  const pan = useRef(PanResponder.create({
    // Only claim the gesture when the motion is clearly horizontal (1.5× vs vertical).
    // This prevents the row from stealing vertical scroll gestures.
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 8,
    onMoveShouldSetPanResponderCapture: (_, g) =>
      Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 8,
    onPanResponderGrant: () => {
      // Tell other rows to close while we're dragging
      if (!isOpen.current) setOpenRowKey(rowKey);
    },
    onPanResponderMove: (_, g) => {
      const base = isOpen.current ? -ACTION_WIDTH : 0;
      const next = Math.max(-ACTION_WIDTH, Math.min(0, base + g.dx));
      translateX.setValue(next);
    },
    onPanResponderRelease: (_, g) => {
      const base = isOpen.current ? -ACTION_WIDTH : 0;
      const finalX = base + g.dx;
      if (finalX < -SWIPE_OPEN_AT) open();
      else close();
    },
    onPanResponderTerminate: () => {
      if (isOpen.current) open(); else close();
    },
  })).current;

  return (
    <View style={styles.container}>
      {/* Action button revealed beneath */}
      <View style={[styles.action, { backgroundColor: actionColor }]}>
        <Pressable
          onPress={() => { close(); onAction(); }}
          style={styles.actionBtn}
        >
          <Ionicons name={actionIcon} size={18} color="#FFFFFF" />
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      </View>

      {/* Foreground card */}
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    marginBottom: 12,
    borderRadius: 16,
  },
  action: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: ACTION_WIDTH,
    gap: 4,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontFamily: Fonts.semiBold,
    fontSize: 12,
  },
});
