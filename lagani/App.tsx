import './global.css';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';
import RootNavigator from './app/navigation/RootNavigator';
import { findTriggeredPriceAlerts } from './src/domain/priceAlerts';
import { refreshDataIfNeeded, syncPrices } from './src/api/nepseScraper';
import {
  deactivatePriceAlert,
  getActivePriceAlerts,
  getPricesBySymbols,
  initDatabaseSchema,
  initializeDatabaseSync,
} from './src/utils/database';

const PRICE_ALERT_BACKGROUND_TASK = 'lagani-price-alerts';

initializeDatabaseSync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const checkPriceAlerts = async (): Promise<number> => {
  await initDatabaseSchema();
  await syncPrices();
  const alerts = await getActivePriceAlerts();
  if (alerts.length === 0) return 0;

  const prices = await getPricesBySymbols(alerts.map((alert) => alert.symbol));
  const triggered = findTriggeredPriceAlerts(alerts, prices);

  for (const { alert, currentPrice } of triggered) {
    if (alert.id === undefined) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${alert.symbol} price alert`,
        body: `${alert.symbol} is at Rs. ${currentPrice.toFixed(2)} (${alert.condition.toLowerCase()} Rs. ${alert.targetPrice.toFixed(2)}).`,
        sound: 'default',
        data: { symbol: alert.symbol },
      },
      trigger: null,
    });
    await deactivatePriceAlert(alert.id);
  }
  return triggered.length;
};

TaskManager.defineTask(PRICE_ALERT_BACKGROUND_TASK, async () => {
  try {
    await checkPriceAlerts();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[PriceAlerts] Background check failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

const registerPriceAlertTask = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    console.warn('[PriceAlerts] OS background tasks are unavailable.');
    return;
  }
  if (await TaskManager.isTaskRegisteredAsync(PRICE_ALERT_BACKGROUND_TASK)) return;
  await BackgroundTask.registerTaskAsync(PRICE_ALERT_BACKGROUND_TASK, {
    minimumInterval: 15,
  });
};

export default function App() {
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const initializeApp = useCallback(async () => {
    setInitializationError(null);
    setIsReady(false);
    try {
      await initDatabaseSchema();
      try {
        await refreshDataIfNeeded();
      } catch (error) {
        // Cached data remains usable when the API is temporarily unreachable.
        console.warn('[App] Initial market refresh failed:', error);
      }
      try {
        await registerPriceAlertTask();
      } catch (error) {
        console.warn('[App] Price-alert task registration failed:', error);
      }
      setIsReady(true);
    } catch (error) {
      setInitializationError(error instanceof Error ? error.message : 'The local database could not be initialized.');
    }
  }, []);

  useEffect(() => {
    void initializeApp();
  }, [initializeApp]);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {isReady ? (
        <RootNavigator />
      ) : (
        <View className="flex-1 items-center justify-center bg-white px-8">
          {initializationError ? (
            <>
              <Text className="mb-2 text-center text-xl font-semibold text-zinc-900">Lagani could not start</Text>
              <Text className="mb-6 text-center text-zinc-600">{initializationError}</Text>
              <Pressable
                accessibilityRole="button"
                className="rounded-xl bg-purple-700 px-6 py-3"
                onPress={() => void initializeApp()}
              >
                <Text className="font-semibold text-white">Try again</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#6d28d9" />
              <Text className="mt-4 text-zinc-600">Preparing Lagani…</Text>
            </>
          )}
        </View>
      )}
      <Toast />
    </SafeAreaProvider>
  );
}
