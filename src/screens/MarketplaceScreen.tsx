import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Fonts } from '../components/theme';
import type { SettlementStackParams } from '../navigation/SettlementNavigator';

type Nav = NativeStackNavigationProp<SettlementStackParams>;

type OfferType = 'otc' | 'freelance' | 'milestone' | 'deposit';

interface MarketOffer {
  id: string;
  type: OfferType;
  side: 'buy' | 'sell' | 'hire' | 'work';
  title: string;
  description: string;
  amountSats: number;
  poster: string;
  postedAgo: string;
  tags: string[];
}

const TYPE_COLOR: Record<OfferType, string> = {
  otc: '#F59E0B',
  freelance: '#7B2FFF',
  milestone: '#10B981',
  deposit: '#3B5BDB',
};

const TYPE_LABEL: Record<OfferType, string> = {
  otc: 'OTC Trade',
  freelance: 'Freelance',
  milestone: 'Milestone',
  deposit: 'Deposit',
};

const MOCK_OFFERS: MarketOffer[] = [
  {
    id: '1', type: 'otc', side: 'buy',
    title: 'Buying 500 IRM',
    description: 'Looking to buy 500 IRM. Payment via bank transfer. Fast settlement preferred.',
    amountSats: 50000000000, poster: 'Qm3kP…xR9f', postedAgo: '2 min ago',
    tags: ['bank', 'fast'],
  },
  {
    id: '2', type: 'freelance', side: 'hire',
    title: 'Smart contract audit needed',
    description: 'Need an experienced auditor for a 2000-line Rust codebase. 2-week timeline.',
    amountSats: 10000000000, poster: 'Qx7nA…kL2m', postedAgo: '8 min ago',
    tags: ['rust', 'audit', 'remote'],
  },
  {
    id: '3', type: 'otc', side: 'sell',
    title: 'Selling 1,200 IRM',
    description: 'Mining rewards available. USDT or BTC accepted. Escrow via HTLC.',
    amountSats: 120000000000, poster: 'Qb9eM…pF4j', postedAgo: '15 min ago',
    tags: ['mining', 'usdt', 'btc'],
  },
  {
    id: '4', type: 'milestone', side: 'hire',
    title: 'Mobile wallet UI/UX design',
    description: '4-milestone project. Pay per milestone. Portfolio required.',
    amountSats: 5000000000, poster: 'Qd2hT…wC8n', postedAgo: '22 min ago',
    tags: ['design', 'ui', 'figma'],
  },
  {
    id: '5', type: 'deposit', side: 'work',
    title: 'Backend API development',
    description: 'Node.js REST API. HTLC escrow holds until client signs off. 30-day project.',
    amountSats: 25000000000, poster: 'Qf5rN…vB3s', postedAgo: '1 hr ago',
    tags: ['nodejs', 'api', 'remote'],
  },
  {
    id: '6', type: 'otc', side: 'buy',
    title: 'Buying 250 IRM weekly',
    description: 'Recurring weekly buyer. Verified on 5 previous trades. All payment methods.',
    amountSats: 25000000000, poster: 'Qg1kR…zD7c', postedAgo: '2 hr ago',
    tags: ['recurring', 'verified'],
  },
];

function irmStr(sats: number) {
  if (sats >= 1e12) return (sats / 1e12).toFixed(1) + 'T IRM';
  if (sats >= 1e9)  return (sats / 1e9).toFixed(1)  + 'B IRM';
  return (sats / 1e8).toFixed(2) + ' IRM';
}

type FilterTab = 'all' | OfferType;

function FilterPill({ label, active, color, onPress }: {
  label: string; active: boolean; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.pill, active && { backgroundColor: color + '22', borderColor: color }]}
    >
      <Text style={[styles.pillText, active && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function OfferCard({ offer, index }: { offer: MarketOffer; index: number }) {
  const nav = useNavigation<Nav>();
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 60),
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(translateY,  { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accentColor = TYPE_COLOR[offer.type];

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        style={styles.offerCard}
        activeOpacity={0.75}
        onPress={() => nav.navigate('OtcWizard')}
      >
        <View style={styles.offerHeader}>
          <View style={[styles.typeBadge, { backgroundColor: accentColor + '22' }]}>
            <Text style={[styles.typeBadgeText, { color: accentColor }]}>
              {TYPE_LABEL[offer.type]}
            </Text>
          </View>
          <Text style={styles.postedAgo}>{offer.postedAgo}</Text>
        </View>
        <Text style={styles.offerTitle}>{offer.title}</Text>
        <Text style={styles.offerDesc} numberOfLines={2}>{offer.description}</Text>
        <View style={styles.offerFooter}>
          <Text style={[styles.offerAmount, { color: accentColor }]}>{irmStr(offer.amountSats)}</Text>
          <View style={styles.posterRow}>
            <Ionicons name="person-circle-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.posterText}>{offer.poster}</Text>
          </View>
        </View>
        {offer.tags.length > 0 && (
          <View style={styles.tagRow}>
            {offer.tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function MarketplaceScreen() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  const visible = filter === 'all'
    ? MOCK_OFFERS
    : MOCK_OFFERS.filter((o) => o.type === filter);

  function onRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marketplace</Text>
        <Text style={styles.headerSub}>{MOCK_OFFERS.length} active offers</Text>
      </View>
      <View style={styles.filterRow}>
        <FilterPill label="All"       active={filter === 'all'}       color={Colors.primary}       onPress={() => setFilter('all')} />
        <FilterPill label="OTC"       active={filter === 'otc'}       color={TYPE_COLOR.otc}       onPress={() => setFilter('otc')} />
        <FilterPill label="Freelance" active={filter === 'freelance'} color={TYPE_COLOR.freelance} onPress={() => setFilter('freelance')} />
        <FilterPill label="Milestone" active={filter === 'milestone'} color={TYPE_COLOR.milestone} onPress={() => setFilter('milestone')} />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => <OfferCard offer={item} index={index} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="storefront-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No offers in this category</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 26, fontFamily: Fonts.bold, color: Colors.textPrimary },
  headerSub: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  pillText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSecondary },
  list: { padding: 16, gap: 12 },
  offerCard: {
    backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, padding: 16, gap: 10,
  },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  typeBadgeText: { fontSize: 11, fontFamily: Fonts.semiBold },
  postedAgo: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary },
  offerTitle: { fontSize: 16, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  offerDesc: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 19 },
  offerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  offerAmount: { fontSize: 16, fontFamily: Fonts.bold },
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  posterText: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: Colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
