import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, StatusBar,
  TouchableOpacity, Animated, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWalletStore } from '../store/wallet';
import { Colors, Fonts } from '../components/theme';
import { SwipeableRow } from '../components/SwipeableRow';
import { ConfirmModal } from '../components/ConfirmModal';
import type { MarketplaceStackParams, MarketOfferData } from '../navigation/MarketplaceNavigator';

type Nav = NativeStackNavigationProp<MarketplaceStackParams, 'Feed'>;

function irmStr(sats: number) {
  if (sats >= 1e12) return (sats / 1e12).toFixed(1) + 'T';
  if (sats >= 1e9)  return (sats / 1e9).toFixed(1) + 'B';
  return (sats / 1e8).toFixed(2);
}

function truncAddress(addr: string) {
  if (addr.length <= 14) return addr;
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

function timeAgo(unixSec: number) {
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSec));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const STATUS_COLORS: Record<string, string> = {
  open:    '#00D4A0',
  taken:   '#F59E0B',
  settled: '#6B7280',
};

type StatusFilter = 'all' | 'open' | 'taken' | 'settled';

// ─── Filter pill ─────────────────────────────────────────────────────────────

function FilterPill({ label, active, onPress }: {
  label: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Offer card ──────────────────────────────────────────────────────────────

function OfferCard({ offer, index, onPress }: {
  offer: MarketOfferData; index: number; onPress: () => void;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 60),
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusColor = STATUS_COLORS[offer.status] ?? Colors.textMuted;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        style={[styles.offerCard, { marginBottom: 0 }]}
        activeOpacity={0.75}
        onPress={onPress}
      >
        <View style={styles.offerHeader}>
          <View style={[styles.typeBadge, { backgroundColor: Colors.primary + '22', borderColor: Colors.primary + '60' }]}>
            <Text style={[styles.typeBadgeText, { color: Colors.primary }]}>OTC</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColor + '80' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{offer.status.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.postedAgo}>{timeAgo(offer.created_at)}</Text>
        </View>

        <Text style={styles.amountLine}>
          <Text style={styles.amountNumber}>{irmStr(offer.amount_irm)}</Text>
          <Text style={styles.amountUnit}> IRM</Text>
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="card-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{offer.payment_method || 'unspecified'}</Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="person-circle-outline" size={13} color={Colors.textSecondary} />
          <Text style={[styles.metaText, { fontFamily: 'monospace' }]}>{truncAddress(offer.seller_address)}</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.offerIdHint}>id · {offer.offer_id.slice(0, 12)}{offer.offer_id.length > 12 ? '…' : ''}</Text>
          <View style={styles.viewRow}>
            <Text style={styles.viewText}>View</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function MarketplaceScreen() {
  const nav = useNavigation<Nav>();
  const { rpcUrl } = useWalletStore();
  const [offers, setOffers]       = useState<MarketOfferData[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [filter, setFilter]       = useState<StatusFilter>('all');
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hideTarget, setHideTarget] = useState<string | null>(null);

  const fetchOffers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      if (!rpcUrl) throw new Error('Connect your node in Settings → Advanced');
      const resp = await fetch(`${rpcUrl.replace(/\/$/, '')}/offers/feed`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const list: MarketOfferData[] = Array.isArray(json?.offers) ? json.offers : [];
      setOffers(list);
    } catch (e: any) {
      // Real failure — surface it. No fake fallback data, otherwise users
      // would see synthetic offers and think the marketplace is working.
      setOffers([]);
      setError(e?.message ?? 'Could not reach your node');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rpcUrl]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  function onRefresh() {
    setRefreshing(true);
    fetchOffers(true);
  }

  const visible = filter === 'all' ? offers : offers.filter((o) => o.status === filter);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marketplace</Text>
        <Text style={styles.headerSub}>
          {error
            ? `Could not reach your node — check Settings → Advanced`
            : `${offers.length} offer${offers.length === 1 ? '' : 's'} from your node`}
        </Text>
      </View>

      <View style={styles.filterRow}>
        <FilterPill label="All"     active={filter === 'all'}     onPress={() => setFilter('all')} />
        <FilterPill label="Open"    active={filter === 'open'}    onPress={() => setFilter('open')} />
        <FilterPill label="Taken"   active={filter === 'taken'}   onPress={() => setFilter('taken')} />
        <FilterPill label="Settled" active={filter === 'settled'} onPress={() => setFilter('settled')} />
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.warning} />
          <Text style={styles.errorText} numberOfLines={1}>
            {error}
          </Text>
        </View>
      )}

      {loading && offers.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching offers…</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o) => o.offer_id}
          contentContainerStyle={styles.list}
          scrollEnabled={!openRowKey}
          onScrollBeginDrag={() => setOpenRowKey(null)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          renderItem={({ item, index }) => (
            <SwipeableRow
              rowKey={item.offer_id}
              openRowKey={openRowKey}
              setOpenRowKey={setOpenRowKey}
              actionLabel="Hide"
              actionIcon="eye-off-outline"
              actionColor={Colors.danger}
              onAction={() => setHideTarget(item.offer_id)}
            >
              <OfferCard
                offer={item}
                index={index}
                onPress={() => nav.push('OfferDetail', { offer: item })}
              />
            </SwipeableRow>
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No offers in this view</Text>
              <Text style={styles.emptyHint}>Pull down to refresh.</Text>
            </View>
          }
        />
      )}

      <ConfirmModal
        visible={hideTarget !== null}
        title="Hide offer"
        body="Remove this offer from your local view. It will reappear next time you refresh."
        confirmLabel="Hide"
        destructive
        onConfirm={() => {
          setOffers((prev) => prev.filter((o) => o.offer_id !== hideTarget));
          setHideTarget(null);
        }}
        onCancel={() => setHideTarget(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 26, fontFamily: Fonts.bold, color: Colors.textPrimary },
  headerSub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.borderSubtle, backgroundColor: Colors.card,
  },
  pillActive: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary,
  },
  pillText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  pillTextActive: { color: Colors.primary },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  errorText: { color: Colors.warning, fontSize: 12, fontFamily: Fonts.regular, flex: 1 },

  loading: { paddingTop: 80, alignItems: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontFamily: Fonts.regular, fontSize: 13 },

  list: { paddingHorizontal: 16, paddingBottom: 24 },

  offerCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 14,
    gap: 8,
  },
  offerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 10, fontFamily: Fonts.semiBold, letterSpacing: 0.6 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: Fonts.semiBold, letterSpacing: 0.6 },
  postedAgo: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textMuted },

  amountLine: { marginTop: 4 },
  amountNumber: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
  },
  amountUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    letterSpacing: 1,
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: Colors.textSecondary, fontSize: 12, fontFamily: Fonts.regular },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  offerIdHint: { fontSize: 10, fontFamily: 'monospace', color: Colors.textMuted },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewText: { color: Colors.primary, fontFamily: Fonts.semiBold, fontSize: 12 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  emptyHint: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted },
});
