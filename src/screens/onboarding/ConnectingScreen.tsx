import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Pressable, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { IriumLogo } from '../../components/IriumLogo';
import { DeepSpaceBg } from '../../components/onboarding/DeepSpaceBg';
import { StepDots } from '../../components/onboarding/StepDots';
import { Colors, Fonts, GradientColors } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Connecting'>;

const TARGET_PEERS = 3;
const PEER_INCREMENT_INTERVAL = 700; // ms per peer found
const CENTER = 90;                   // half of NETWORK_SIZE (180)
const NETWORK_SIZE = 180;
const NODE_RADIUS = 70;              // distance from center to each node

interface NodePos { x: number; y: number; angleDeg: number; }

const NODES: NodePos[] = [
  { angleDeg: -90, x: CENTER + NODE_RADIUS * Math.cos(-Math.PI / 2), y: CENTER + NODE_RADIUS * Math.sin(-Math.PI / 2) },
  { angleDeg: 30,  x: CENTER + NODE_RADIUS * Math.cos(Math.PI / 6),  y: CENTER + NODE_RADIUS * Math.sin(Math.PI / 6)  },
  { angleDeg: 150, x: CENTER + NODE_RADIUS * Math.cos(5 * Math.PI / 6), y: CENTER + NODE_RADIUS * Math.sin(5 * Math.PI / 6) },
];

export function ConnectingScreen({ navigation, route }: Props) {
  const mode = route.params?.mode ?? 'create';
  // Step number depends on flow: create flow step 4/6, import flow step 2/4
  const stepCurrent = mode === 'import' ? 2 : 4;
  const stepTotal   = mode === 'import' ? 4 : 6;

  const [peers, setPeers] = useState(0);
  const [phase, setPhase] = useState<'searching' | 'found'>('searching');

  // Center logo pulse
  const pulseScale = useRef(new Animated.Value(1)).current;
  // Per-line + per-node animations
  const lineAnims  = useRef(NODES.map(() => new Animated.Value(0))).current;
  const nodeAnims  = useRef(NODES.map(() => new Animated.Value(0))).current;
  const peerBump   = useRef(new Animated.Value(0)).current;
  // Entrance
  const titleY     = useRef(new Animated.Value(20)).current;
  const titleOpac  = useRef(new Animated.Value(0)).current;
  const ctaOpac    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(titleOpac, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(titleY,    { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    // Center logo continuous pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.08, duration: 900,  easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.0,  duration: 900,  easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // Discover peers one by one — each triggers line draw + node fade-in
    NODES.forEach((_, i) => {
      const delay = (i + 1) * PEER_INCREMENT_INTERVAL;
      setTimeout(() => {
        setPeers(i + 1);
        // bump peer counter
        peerBump.setValue(0);
        Animated.spring(peerBump, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
        // draw line + show node
        Animated.parallel([
          Animated.timing(lineAnims[i], { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
          Animated.spring(nodeAnims[i], { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        ]).start();
      }, delay);
    });

    // After all peers found, show CTA
    const ctaTimer = setTimeout(() => {
      setPhase('found');
      Animated.timing(ctaOpac, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, (NODES.length + 1) * PEER_INCREMENT_INTERVAL);

    return () => { clearTimeout(ctaTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const peerScale = peerBump.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.2, 0.95, 1] });

  return (
    <View style={styles.root}>
      <DeepSpaceBg />
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header with step dots */}
      <View style={styles.header}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <StepDots total={stepTotal} current={stepCurrent} />
        </View>
      </View>

      <View style={styles.body}>
        <Animated.View style={[styles.titleWrap, { opacity: titleOpac, transform: [{ translateY: titleY }] }]}>
          <Text style={styles.title}>Connecting to Network</Text>
          <Text style={styles.subtitle}>
            {phase === 'searching' ? 'Searching for peers…' : `Connected to ${peers} peer${peers !== 1 ? 's' : ''}.`}
          </Text>
        </Animated.View>

        {/* Network visualization */}
        <View style={styles.networkCanvas}>
          {/* Lines from center to each node */}
          {NODES.map((node, i) => {
            const dx = node.x - CENTER;
            const dy = node.y - CENTER;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angleRad = Math.atan2(dy, dx);
            const angleDeg = (angleRad * 180) / Math.PI;
            const widthInterp = lineAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, length] });
            const opacityInterp = lineAnims[i].interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.5, 1] });
            return (
              <Animated.View
                key={`line-${i}`}
                style={[
                  styles.line,
                  {
                    width: widthInterp,
                    opacity: opacityInterp,
                    left: CENTER,
                    top: CENTER,
                    transform: [{ rotate: `${angleDeg}deg` }],
                  },
                ]}
              />
            );
          })}

          {/* Orbiting nodes */}
          {NODES.map((node, i) => (
            <Animated.View
              key={`node-${i}`}
              style={[
                styles.node,
                {
                  left: node.x - 8,
                  top:  node.y - 8,
                  opacity: nodeAnims[i],
                  transform: [{ scale: nodeAnims[i] }],
                },
              ]}
            />
          ))}

          {/* Center: pulsing logo */}
          <Animated.View style={[styles.center, { transform: [{ scale: pulseScale }] }]}>
            <View style={styles.centerGlow} />
            <IriumLogo size={48} glow />
          </Animated.View>
        </View>

        {/* Peer counter */}
        <Animated.View style={{ transform: [{ scale: peerScale }], marginTop: 18 }}>
          <Text style={styles.peerCount}>
            <Text style={styles.peerNumber}>{peers}</Text>
            <Text style={styles.peerLabel}> / {TARGET_PEERS} peers</Text>
          </Text>
        </Animated.View>
      </View>

      {/* CTA */}
      <Animated.View style={[styles.footer, { opacity: ctaOpac }]}>
        <Pressable
          onPress={() => navigation.push('SecureWallet')}
          disabled={phase !== 'found'}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : phase === 'found' ? 1 : 0.4 })}
        >
          <View style={{ borderRadius: 14, overflow: 'hidden' }}>
            <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradBtn}>
              <Text style={styles.gradText}>Continue</Text>
            </LinearGradient>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  titleWrap: { alignItems: 'center', marginBottom: 32 },
  title:     { fontSize: 24, fontFamily: Fonts.bold, color: '#FFFFFF', textAlign: 'center' },
  subtitle:  { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },

  networkCanvas: {
    width: NETWORK_SIZE,
    height: NETWORK_SIZE,
    position: 'relative',
  },
  line: {
    position: 'absolute',
    height: 1,
    backgroundColor: Colors.accent,
    transformOrigin: 'left center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  node: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  center: {
    position: 'absolute',
    left: CENTER - 28,
    top:  CENTER - 28,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(123,47,255,0.25)',
    shadowColor: Colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },

  peerCount: { textAlign: 'center' },
  peerNumber: { color: '#FFFFFF', fontSize: 36, fontFamily: Fonts.bold },
  peerLabel:  { color: Colors.textSecondary, fontSize: 16, fontFamily: Fonts.regular },

  footer: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  gradBtn: { paddingVertical: 16, alignItems: 'center' },
  gradText: { color: '#FFFFFF', fontFamily: Fonts.semiBold, fontSize: 16 },
});
