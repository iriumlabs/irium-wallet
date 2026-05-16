import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { bridge } from '../../bridge';
import { useWalletStore } from '../../store/wallet';
import { useNodeStore } from '../../store/node';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Typography, Fonts } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'Connecting'>;

export function ConnectingScreen({ navigation }: Props) {
  const { extraPeer } = useWalletStore();
  const { syncedHeight } = useNodeStore();
  const [peers, setPeers] = useState(0);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing ring behind peer count
  const ringScale   = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.5)).current;

  // Status rows stagger in when starting completes
  const rowAnims = useRef(
    [0, 1, 2].map(() => ({
      opacity: new Animated.Value(0),
      x: new Animated.Value(-16),
    }))
  ).current;

  // Button entrance
  const btnOpacity = useRef(new Animated.Value(0)).current;

  // Peer count number scale flash on increment
  const countScale = useRef(new Animated.Value(1)).current;
  const prevPeers  = useRef(0);

  useEffect(() => {
    // Ring pulse loop — always running
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ringScale,   { toValue: 1.35, duration: 1000, useNativeDriver: true }),
          Animated.timing(ringScale,   { toValue: 1.0,  duration: 1000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.1,  duration: 1000, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.5,  duration: 1000, useNativeDriver: true }),
        ]),
      ])
    ).start();

    async function start() {
      try {
        await bridge.startLightClient({
          seedlist_path: 'assets/seedlist.txt',
          extra_peer: extraPeer,
          start_height: syncedHeight,
        });
      } catch (e: any) {
        setError(e.message ?? 'Failed to start light client');
      } finally {
        setStarting(false);
      }
    }
    start();

    timerRef.current = setInterval(() => {
      const n = bridge.peerCount();
      setPeers(n);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Stagger status rows when starting finishes
  useEffect(() => {
    if (starting) return;
    Animated.stagger(
      110,
      rowAnims.map((anim) =>
        Animated.parallel([
          Animated.timing(anim.opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(anim.x,       { toValue: 0, duration: 280, useNativeDriver: true }),
        ])
      )
    ).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.timing(btnOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [starting]);

  // Flash count when peers increase
  useEffect(() => {
    if (peers > prevPeers.current) {
      countScale.setValue(1.3);
      Animated.spring(countScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    }
    prevPeers.current = peers;
  }, [peers]);

  const ringColor = peers > 0 ? Colors.success : Colors.primary;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={styles.center}>
        <Text style={[Typography.h2, { marginBottom: 8 }]}>Connecting to network</Text>
        <Text style={[Typography.caption, { textAlign: 'center', marginBottom: 40 }]}>
          Finding Irium P2P peers on port 38291
        </Text>

        {/* Peer count with pulsing ring */}
        <View style={styles.orb}>
          <Animated.View
            style={[
              styles.pulse,
              {
                borderColor: ringColor,
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
          />
          <View style={[styles.orbInner, { borderColor: ringColor }]}>
            {starting ? (
              <Text style={styles.orbLabel}>…</Text>
            ) : error ? (
              <Text style={[styles.orbLabel, { color: Colors.error }]}>!</Text>
            ) : (
              <Animated.Text
                style={[styles.orbCount, { transform: [{ scale: countScale }] }]}
              >
                {peers}
              </Animated.Text>
            )}
            <Text style={styles.orbSub}>
              {starting ? 'starting' : peers === 1 ? 'peer' : 'peers'}
            </Text>
          </View>
        </View>

        {/* Status rows — staggered slide-in */}
        {!starting && (
          <View style={styles.statusRows}>
            {[
              { label: 'Bootstrap peers loaded', ok: true,       pending: false },
              { label: 'Light client started',   ok: !error,     pending: false },
              { label: 'P2P connection',         ok: peers > 0,  pending: peers === 0 && !error },
            ].map((row, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.statusRow,
                  {
                    opacity: rowAnims[i].opacity,
                    transform: [{ translateX: rowAnims[i].x }],
                  },
                ]}
              >
                <StatusDot ok={row.ok} pending={row.pending} />
                <Text style={[styles.rowLabel, { color: row.ok || row.pending ? Colors.text : Colors.textMuted }]}>
                  {row.label}
                </Text>
              </Animated.View>
            ))}
          </View>
        )}
      </View>

      <Animated.View style={[styles.actions, { opacity: btnOpacity }]}>
        <GradientButton
          label={peers > 0 ? 'Connected — continue' : 'Continue anyway'}
          onPress={() => navigation.navigate('Ready')}
          disabled={starting}
        />
        {peers === 0 && !starting && (
          <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.navigate('Ready')}>
            <Text style={[Typography.caption, { color: Colors.textMuted }]}>
              Skip — connect later in Settings
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

function StatusDot({ ok, pending }: { ok: boolean; pending?: boolean }) {
  const color = pending ? Colors.warning : ok ? Colors.success : Colors.error;
  return (
    <View style={[styles.dot, { backgroundColor: color, opacity: pending ? 0.6 : 1 }]} />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: 24,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orb: { alignItems: 'center', justifyContent: 'center', marginBottom: 40, width: 130, height: 130 },
  pulse: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
  },
  orbInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbCount: {
    fontSize: 36,
    fontFamily: Fonts.bold,
    color: Colors.text,
    lineHeight: 40,
  },
  orbLabel: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.textMuted,
    lineHeight: 36,
  },
  orbSub: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusRows: { width: '100%', gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowLabel: { fontSize: 15, fontFamily: Fonts.regular },
  actions: { gap: 12 },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
});
