import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CompositeNavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { RootTabParamList } from '../navigation/AppNavigator';
import { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../../src/theme/colors';
import {
  getPaperTradingBalance,
  resetAllUserData,
  resetPaperTradingData,
} from '../../src/utils/database';
import { refreshAllData } from '../../src/api/nepseScraper';

type SettingsNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Settings'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  destructive?: boolean;
  onPress?: () => void;
}

const SettingsRow = ({ icon, label, detail, destructive, onPress }: SettingsRowProps) => (
  <TouchableOpacity
    className="flex-row items-center px-4 py-4"
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
    onPress={onPress}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={onPress ? label : undefined}
  >
    <View className="h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
      <Ionicons name={icon} size={19} color={destructive ? colors.negative : colors.primary} />
    </View>
    <View className="ml-3 flex-1">
      <Text className={`text-base font-medium ${destructive ? 'text-negative' : 'text-text'}`}>{label}</Text>
      {detail ? <Text className="mt-0.5 text-xs text-textSecondary">{detail}</Text> : null}
    </View>
    {onPress ? <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /> : null}
  </TouchableOpacity>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View className="mb-5">
    <Text className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-textSecondary">{title}</Text>
    <View className="overflow-hidden rounded-2xl border border-border bg-card">{children}</View>
  </View>
);

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsNavigation>();
  const [paperBalance, setPaperBalance] = useState<number | null>(null);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);

  const loadBalance = useCallback(async () => {
    try {
      setPaperBalance(await getPaperTradingBalance());
    } catch (error) {
      console.error('[Settings] Could not load paper balance:', error);
      setPaperBalance(null);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadBalance();
  }, [loadBalance]));

  const refreshMarket = async () => {
    if (isRefreshingMarket) return;
    setIsRefreshingMarket(true);
    try {
      const snapshot = await refreshAllData();
      Toast.show({
        type: 'success',
        text1: 'Market data updated',
        text2: `${snapshot.companies.length} companies and ${snapshot.prices.length} prices cached.`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: error instanceof Error ? error.message : 'Could not reach the Lagani API.',
      });
    } finally {
      setIsRefreshingMarket(false);
    }
  };

  const confirmPaperReset = () => Alert.alert(
    'Reset paper trading?',
    'This deletes all simulated trades and restores Rs. 1,000,000 in virtual cash.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => void (async () => {
          try {
            await resetPaperTradingData();
            await loadBalance();
            Toast.show({ type: 'success', text1: 'Paper account reset' });
          } catch {
            Toast.show({ type: 'error', text1: 'Reset failed' });
          }
        })(),
      },
    ],
  );

  const confirmAllDataReset = () => Alert.alert(
    'Reset all personal data?',
    'This permanently deletes your watchlist, portfolio transactions, price alerts, and paper-trading activity. Cached public market data is kept.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete personal data',
        style: 'destructive',
        onPress: () => void (async () => {
          try {
            await resetAllUserData();
            await loadBalance();
            Toast.show({ type: 'success', text1: 'Personal data reset' });
          } catch {
            Toast.show({ type: 'error', text1: 'Reset failed' });
          }
        })(),
      },
    ],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="mb-1 text-3xl font-bold text-text">Settings</Text>
        <Text className="mb-6 text-sm text-textSecondary">Manage local data and app tools.</Text>

        <Section title="Market data">
          <SettingsRow
            icon="cloud-download-outline"
            label={isRefreshingMarket ? 'Updating market data…' : 'Refresh market data'}
            detail="Fetch a fresh, validated snapshot from the Lagani API."
            onPress={() => void refreshMarket()}
          />
        </Section>

        <Section title="Paper trading">
          <SettingsRow
            icon="wallet-outline"
            label="Paper account"
            detail={paperBalance == null ? 'Balance unavailable' : `Virtual cash: Rs. ${paperBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            onPress={() => navigation.navigate('PaperTrading')}
          />
          <SettingsRow icon="refresh-circle-outline" label="Reset paper trading" destructive onPress={confirmPaperReset} />
        </Section>

        <Section title="Support">
          <SettingsRow icon="help-circle-outline" label="Help and tutorial" onPress={() => navigation.navigate('Help')} />
        </Section>

        <Section title="Privacy">
          <SettingsRow icon="trash-outline" label="Reset all personal data" destructive onPress={confirmAllDataReset} />
        </Section>

        <View className="rounded-2xl bg-amber-50 p-4">
          <Text className="font-semibold text-amber-900">Important</Text>
          <Text className="mt-1 text-sm leading-5 text-amber-800">
            Lagani provides market information and simulation tools for education. It is not investment advice and is not affiliated with NEPSE.
          </Text>
          <Text className="mt-2 text-xs text-amber-700">Price alerts are best-effort and may be delayed by the device operating system.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
