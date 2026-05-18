import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../theme';

/** Flat dark background — replaces the previous animated "deep space" effect. */
export function DeepSpaceBg() {
  return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.background }]} pointerEvents="none" />;
}
