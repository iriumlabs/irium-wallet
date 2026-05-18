import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Reusable deep-space backdrop — matches SplashScreen palette. */
export function DeepSpaceBg() {
  return (
    <>
      <LinearGradient
        colors={['#000000', '#050510', '#0A0520']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={styles.centerGlow} pointerEvents="none" />
      <View style={styles.topLeft} pointerEvents="none" />
      <View style={styles.bottomRight} pointerEvents="none" />
    </>
  );
}

const styles = StyleSheet.create({
  centerGlow: {
    position: 'absolute',
    top: SCREEN_H * 0.25,
    left: SCREEN_W * 0.25,
    width: SCREEN_W * 0.5,
    height: SCREEN_W * 0.5,
    borderRadius: 9999,
    backgroundColor: 'rgba(123,47,255,0.07)',
  },
  topLeft: {
    position: 'absolute',
    top: '-12%',
    left: '-22%',
    width: '70%',
    height: '60%',
    borderRadius: 9999,
    backgroundColor: 'rgba(0,212,255,0.04)',
  },
  bottomRight: {
    position: 'absolute',
    bottom: '-14%',
    right: '-22%',
    width: '70%',
    height: '60%',
    borderRadius: 9999,
    backgroundColor: 'rgba(168,85,247,0.04)',
  },
});
