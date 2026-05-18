import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  Pressable, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MarketplaceStackParams } from '../../navigation/MarketplaceNavigator';
import type { MainTabParams } from '../../navigation/MainNavigator';
import { useNodeStore } from '../../store/node';
import { Colors, Fonts, GradientColors } from '../../components/theme';

type Props = NativeStackScreenProps<MarketplaceStackParams, 'OfferDetail'>;

type RootNav = CompositeNavigationProp<
  NativeStackNavigationProp<MarketplaceStackParams, 'OfferDetail'>,
  BottomTabNavigationProp<MainTabParams>
>;

function irmStr(sats: number) {
  return (sats / 1e8).toFixed(8);
}

function timeAgo(unixSec: number) {
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function blocksToTime(blocks: number) {
  if (blocks <= 0) return 'expired';
  const mins = blocks * 2;
  if (mins < 60) return `~${mins} min`;
  const hours = mins / 60;
  if (hours < 24) return `~${hours.toFixed(1)}h`;
  return `~${(hours / 24).toFixed(1)}d`;
}

export function OfferDetailScreen({ route }: Props) {
  const nav = useNavigation<RootNav>();
  const { nodeStatus } = useNodeStore();
  const offer = route.params.offer;

  // Entrance animations — staggered fade+slide
  const sectionAnims = useRef(
    [0, 1, 2, 3, 4].map(() => ({ opacity: new Animated.Value(0), y: new Animated.Value(20) })),
  ).current;

  useEffect(() => {
    Animated.stagger(
      60,
      sectionAnims.map((a) =>
        Animated.parallel([
          Animated.timing(a.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(a.y,       { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ),
    ).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentHeight = nodeStatus?.height ?? 0;
  const blocksLeft = offer.timeout_height - currentHeight;
  const expired = currentHeight > 0 && blocksLeft <= 0;
  const statusColor =
    offer.status === 'open'    ? Colors.success :
    offer.status === 'taken'   ? Colors.warning :
                                 Colors.textMuted;

  async function copySeller() {
    await Clipboard.setStringAsync(offer.seller_address);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied', 'Seller address copied');
  }

  function takeOffer() {
    if (offer.status !== 'open' || expired) {
      Alert.alert('Unavailable', 'This offer is no longer open.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    nav.navigate('Settlement', {
      screen: 'OtcWizard',
      params: {
        prefill: {
          offerId: offer.offer_id,
          sellerAddress: offer.seller_address,
          sellerPubkey: offer.seller_pubkey,
          amountSats: offer.amount_irm,
          paymentMethod: offer.payment_method,
          timeoutHeight: offer.timeout_height,
        },
      },
    });
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Offer Details</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top: badges + status */}
        <Animated.View
          style={[
            styles.row,
            { opacity: sectionAnims[0].opacity, transform: [{ translateY: sectionAnims[0].y }] },
          ]}
        >
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>OTC TRADE</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {offer.status.toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        {/* Amount hero */}
        <Animated.View
          style={[
            styles.amountCard,
            { opacity: sectionAnims[1].opacity, transform: [{ translateY: sectionAnims[1].y }] },
          ]}
        >
          <LinearGradient
            colors={GradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.amountTopBorder}
          />
          <LinearGradient
            colors={['rgba(123,47,255,0.10)', 'rgba(0,212,255,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.amountLabel}>AMOUNT</Text>
          <Text style={styles.amountValue}>{irmStr(offer.amount_irm)}</Text>
          <Text style={styles.amountUnit}>IRM</Text>
          <Text style={styles.amountSats}>{offer.amount_irm.toLocaleString()} sats</Text>
        </Animated.View>

        {/* Seller */}
        <Animated.View
          style={[
            styles.card,
            { opacity: sectionAnims[2].opacity, transform: [{ translateY: sectionAnims[2].y }] },
          ]}
        >
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>SELLER</Text>
            <Pressable onPress={copySeller} hitSlop={6} style={styles.copyChip}>
              <Ionicons name="copy-outline" size={12} color={Colors.primary} />
              <Text style={styles.copyChipText}>Copy</Text>
            </Pressable>
          </View>
          <Text style={styles.kvMono} selectable>{offer.seller_address}</Text>
          {offer.seller_pubkey && (
            <Text style={[styles.kvMono, { fontSize: 10, color: Colors.textMuted, marginTop: 6 }]} numberOfLines={1}>
              pubkey: {offer.seller_pubkey}
            </Text>
          )}
        </Animated.View>

        {/* Terms grid */}
        <Animated.View
          style={[
            styles.card,
            { opacity: sectionAnims[3].opacity, transform: [{ translateY: sectionAnims[3].y }] },
          ]}
        >
          <TermsRow icon="card-outline"     label="Payment method" value={offer.payment_method || 'Unspecified'} />
          <TermsRow icon="time-outline"     label="Posted"         value={timeAgo(offer.created_at)} />
          <TermsRow
            icon="hourglass-outline"
            label="Expires"
            value={`Block #${offer.timeout_height.toLocaleString()} · ${expired ? 'expired' : blocksToTime(blocksLeft) + ' left'}`}
            valueColor={expired ? Colors.danger : Colors.textPrimary}
          />
          <TermsRow
            icon="finger-print-outline"
            label="Offer ID"
            value={offer.offer_id}
            mono
          />
          {offer.price_note && (
            <TermsRow icon="information-circle-outline" label="Note" value={offer.price_note} />
          )}
          {offer.payment_instructions && (
            <TermsRow icon="document-text-outline" label="Instructions" value={offer.payment_instructions} />
          )}
        </Animated.View>

        {/* Risk indicator */}
        <Animated.View
          style={[
            styles.riskCard,
            { opacity: sectionAnims[4].opacity, transform: [{ translateY: sectionAnims[4].y }] },
          ]}
        >
          <Ionicons name="warning-outline" size={20} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.riskTitle}>Off-chain payment risk</Text>
            <Text style={styles.riskText}>
              Your funds will be locked in an HTLC. The seller can only claim after you submit
              proof of off-chain payment. If anything fails, your funds auto-refund at block #{offer.timeout_height.toLocaleString()}.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <Pressable
          onPress={takeOffer}
          disabled={offer.status !== 'open' || expired}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : (offer.status !== 'open' || expired) ? 0.4 : 1 })}
        >
          <LinearGradient
            colors={GradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.takeBtn}
          >
            <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />
            <Text style={styles.takeBtnText}>Take Offer</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Terms row helper ────────────────────────────────────────────────────────

function TermsRow({
  icon, label, value, mono, valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={styles.termsRow}>
      <View style={styles.termsIconWrap}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.termsLabel}>{label}</Text>
        <Text
          style={[
            mono ? styles.termsValueMono : styles.termsValue,
            valueColor ? { color: valueColor } : null,
          ]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: Colors.textPrimary, letterSpacing: 0.3 },

  content: { padding: 16, gap: 14, paddingBottom: 40 },

  // Status row
  row: { flexDirection: 'row', gap: 8 },
  typeBadge: {
    backgroundColor: Colors.primary + '22',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
  },
  typeBadgeText: { color: Colors.primary, fontSize: 10, fontFamily: Fonts.semiBold, letterSpacing: 0.8 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 10, fontFamily: Fonts.semiBold, letterSpacing: 0.8 },

  // Amount hero
  amountCard: {
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  amountTopBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
  },
  amountLabel: {
    color: Colors.textSecondary, fontSize: 10, fontFamily: Fonts.semiBold,
    letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 6,
  },
  amountValue: {
    color: '#FFFFFF', fontSize: 36, fontFamily: Fonts.bold, letterSpacing: -0.8, lineHeight: 42,
  },
  amountUnit: {
    color: Colors.textSecondary, fontSize: 12, fontFamily: Fonts.semiBold, letterSpacing: 2, marginTop: -2,
  },
  amountSats: {
    color: Colors.textMuted, fontSize: 11, fontFamily: Fonts.regular, marginTop: 8,
  },

  // Cards
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
    gap: 8,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kvLabel: {
    color: Colors.textSecondary, fontSize: 10, fontFamily: Fonts.semiBold,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  kvMono: { fontFamily: 'monospace', fontSize: 12, color: Colors.textPrimary, lineHeight: 18 },
  copyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: Colors.primary + '14',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  copyChipText: { color: Colors.primary, fontSize: 11, fontFamily: Fonts.semiBold },

  termsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  termsIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.primary + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  termsLabel: {
    color: Colors.textMuted, fontSize: 10, fontFamily: Fonts.semiBold,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2,
  },
  termsValue: { color: Colors.textPrimary, fontSize: 13, fontFamily: Fonts.medium },
  termsValueMono: { color: Colors.textPrimary, fontSize: 12, fontFamily: 'monospace' },

  // Risk warning
  riskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.warning + '50',
    padding: 14,
  },
  riskTitle: { color: Colors.warning, fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 4 },
  riskText:  { color: Colors.textSecondary, fontSize: 12, fontFamily: Fonts.regular, lineHeight: 18 },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.background,
  },
  takeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  takeBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: Fonts.semiBold, letterSpacing: 0.4 },
});
