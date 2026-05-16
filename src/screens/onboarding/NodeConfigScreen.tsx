import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParams } from '../../navigation/OnboardingNavigator';
import { bridge } from '../../bridge';
import { useWalletStore } from '../../store/wallet';
import { GradientButton } from '../../components/GradientButton';
import { Colors, Typography, Fonts } from '../../components/theme';

type Props = NativeStackScreenProps<OnboardingStackParams, 'NodeConfig'>;

export function NodeConfigScreen({ navigation }: Props) {
  const { rpcUrl, extraPeer, setRpcUrl, setExtraPeer } = useWalletStore();
  const [url, setUrl]     = useState(rpcUrl);
  const [peer, setPeer]   = useState(extraPeer ?? '');
  const [testing, setTesting] = useState(false);
  const [status, setStatus]   = useState<string | null>(null);
  const [isOk, setIsOk]       = useState(false);

  // Entrance animation
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceY       = useRef(new Animated.Value(24)).current;

  // Focus border animations (useNativeDriver: false for color interpolation)
  const urlFocus  = useRef(new Animated.Value(0)).current;
  const peerFocus = useRef(new Animated.Value(0)).current;

  // Status result animation
  const resultScale     = useRef(new Animated.Value(0)).current;
  const resultShakeX    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(entranceY,       { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  function onFocus(anim: Animated.Value) {
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  }
  function onBlur(anim: Animated.Value) {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }

  function animateBorderColor(focusAnim: Animated.Value) {
    return focusAnim.interpolate({
      inputRange:  [0, 1],
      outputRange: [Colors.border, Colors.primary],
    });
  }

  function playSuccess() {
    resultScale.setValue(0);
    Animated.spring(resultScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
  }

  function playShake() {
    resultScale.setValue(1);
    Animated.sequence([
      Animated.timing(resultShakeX, { toValue: -8,  duration: 55, useNativeDriver: true }),
      Animated.timing(resultShakeX, { toValue:  8,  duration: 55, useNativeDriver: true }),
      Animated.timing(resultShakeX, { toValue: -6,  duration: 55, useNativeDriver: true }),
      Animated.timing(resultShakeX, { toValue:  6,  duration: 55, useNativeDriver: true }),
      Animated.timing(resultShakeX, { toValue:  0,  duration: 55, useNativeDriver: true }),
    ]).start();
  }

  async function testConnection() {
    setTesting(true);
    setStatus(null);
    try {
      const s = await bridge.rpcGetStatus(url.trim());
      setStatus(`Connected — block ${s.height.toLocaleString()}, ${s.peer_count} peers`);
      setIsOk(true);
      playSuccess();
    } catch (e: any) {
      setStatus(`Failed: ${e.message ?? 'cannot reach node'}`);
      setIsOk(false);
      playShake();
    } finally {
      setTesting(false);
    }
  }

  function save() {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http')) {
      Alert.alert('Invalid URL', 'RPC URL must start with http:// or https://');
      return;
    }
    setRpcUrl(trimmed);
    setExtraPeer(peer.trim() || undefined);
    navigation.navigate('Connecting');
  }

  const urlBorderColor  = animateBorderColor(urlFocus);
  const peerBorderColor = animateBorderColor(peerFocus);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <Animated.View
        style={{ opacity: entranceOpacity, transform: [{ translateY: entranceY }] }}
      >
        <Text style={[Typography.h2, { marginBottom: 8 }]}>Node configuration</Text>
        <Text style={[Typography.caption, { marginBottom: 24 }]}>
          Point to any iriumd instance — your own node, a VPS, or a community endpoint.
          Your keys never leave this device.
        </Text>

        <View style={styles.card}>
          {/* RPC URL input */}
          <Text style={styles.fieldLabel}>RPC endpoint</Text>
          <Animated.View style={[styles.inputWrap, { borderColor: urlBorderColor }]}>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              onFocus={() => onFocus(urlFocus)}
              onBlur={() => onBlur(urlFocus)}
              placeholder="http://192.168.1.x:38300"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </Animated.View>

          {/* Extra peer input */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
            Extra P2P peer{' '}
            <Text style={styles.fieldOptional}>(optional)</Text>
          </Text>
          <Animated.View style={[styles.inputWrap, { borderColor: peerBorderColor }]}>
            <TextInput
              style={styles.input}
              value={peer}
              onChangeText={setPeer}
              onFocus={() => onFocus(peerFocus)}
              onBlur={() => onBlur(peerFocus)}
              placeholder="/ip4/1.2.3.4/tcp/38291"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Animated.View>

          {/* Test result */}
          {status !== null && (
            <Animated.View
              style={[
                styles.statusBox,
                { backgroundColor: isOk ? '#001a10' : '#1a0000' },
                { transform: [{ scale: resultScale }, { translateX: resultShakeX }] },
              ]}
            >
              <Text style={{ color: isOk ? Colors.success : Colors.error, fontSize: 13, fontFamily: Fonts.regular }}>
                {isOk ? '✓  ' : '✗  '}{status}
              </Text>
            </Animated.View>
          )}

          <GradientButton
            label={testing ? 'Testing…' : 'Test connection'}
            onPress={testConnection}
            loading={testing}
            style={{ marginTop: 16 }}
          />
        </View>

        <GradientButton label="Continue" onPress={save} style={{ marginTop: 16 }} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, paddingBottom: 60 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  fieldOptional: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: Fonts.regular,
    textTransform: 'none',
    letterSpacing: 0,
  },
  inputWrap: {
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: Colors.bg,
    padding: 14,
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  statusBox: {
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
});
