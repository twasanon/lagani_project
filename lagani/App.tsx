import './global.css';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import RootNavigator from './app/navigation/RootNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import {
  initializeDatabaseSync,
  initDatabaseSchema,
  getActivePriceAlerts,
  deactivatePriceAlert,
  getPricesBySymbols,
  PriceStatItem,
} from './src/utils/database';
import Toast from 'react-native-toast-message';

const PRICE_ALERT_BACKGROUND_FETCH_TASK = 'price-alert-background-fetch';

TaskManager.defineTask(PRICE_ALERT_BACKGROUND_FETCH_TASK, async () => {
  const now = new Date();
  console.log(`[${PRICE_ALERT_BACKGROUND_FETCH_TASK}] Task running at: ${now.toLocaleTimeString()}`);

  try {
    const activeAlerts = await getActivePriceAlerts();
    if (activeAlerts.length === 0) {
      console.log(`[${PRICE_ALERT_BACKGROUND_FETCH_TASK}] No active alerts found.`);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    console.log(`[${PRICE_ALERT_BACKGROUND_FETCH_TASK}] Found ${activeAlerts.length} active alerts.`);
    const symbols = [...new Set(activeAlerts.map(alert => alert.symbol))];
    const currentPrices = await getPricesBySymbols(symbols);

    let notificationsSent = 0;
    for (const alert of activeAlerts) {
      const priceData = currentPrices[alert.symbol];
      if (!priceData || priceData.lastTradedPrice == null) {
        console.log(`[${PRICE_ALERT_BACKGROUND_FETCH_TASK}] No current price found for ${alert.symbol}, skipping alert ID ${alert.id}.`);
        continue;
      }

      const currentPrice = priceData.lastTradedPrice;
      let trigger = false;

      if (alert.condition === 'ABOVE' && currentPrice >= alert.targetPrice) {
        trigger = true;
      } else if (alert.condition === 'BELOW' && currentPrice <= alert.targetPrice) {
        trigger = true;
      }

      if (trigger && alert.id) {
        console.log(`[${PRICE_ALERT_BACKGROUND_FETCH_TASK}] Triggering alert for ${alert.symbol}! Current: ${currentPrice}, Target: ${alert.condition} ${alert.targetPrice}`);
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🚨 Price Alert: ${alert.symbol} 🚨`,
            body: `${alert.symbol} reached ${currentPrice.toFixed(2)}, meeting your alert (${alert.condition.toLowerCase()} ${alert.targetPrice.toFixed(2)}).`,
            sound: 'default',
            data: { symbol: alert.symbol },
          },
          trigger: null,
        });
        notificationsSent++;

        await deactivatePriceAlert(alert.id);
        console.log(`[${PRICE_ALERT_BACKGROUND_FETCH_TASK}] Deactivated alert ID ${alert.id}.`);
      }
    }

    if (notificationsSent > 0) {
      console.log(`[${PRICE_ALERT_BACKGROUND_FETCH_TASK}] Task finished, ${notificationsSent} notifications sent.`);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } else {
      console.log(`[${PRICE_ALERT_BACKGROUND_FETCH_TASK}] Task finished, no alerts triggered.`);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

  } catch (error) {
    console.error(`[${PRICE_ALERT_BACKGROUND_FETCH_TASK}] Error running background task:`, error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

async function registerBackgroundFetchAsync() {
  console.log('[App] Registering background fetch task...');
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(PRICE_ALERT_BACKGROUND_FETCH_TASK);
    if (isRegistered) {
        console.log('[App] Background fetch task already registered.');
    }

    await BackgroundFetch.registerTaskAsync(PRICE_ALERT_BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('[App] Background fetch task registration attempt complete (check logs for success/failure). Status of registration check:', await TaskManager.isTaskRegisteredAsync(PRICE_ALERT_BACKGROUND_FETCH_TASK));

  } catch (err) {
    console.error('[App] Error registering background fetch task:', err);
  }
}

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// Initialize DB connection synchronously
console.log("[App] Initializing database connection synchronously...");
try {
  initializeDatabaseSync();
  console.log("[App] Synchronous database connection established.");
} catch (error) {
  console.error("[App] CRITICAL: Failed synchronous database initialization:", error);
}

export default function App() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  
  // Initialize DB SCHEMA asynchronously & Register Background Task
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log("[App] useEffect: Initializing database schema...");
        await initDatabaseSchema();
        console.log("[App] Database schema initialized/verified.");

        await registerBackgroundFetchAsync();

      } catch (error: any) {
        console.error("[App] Error during async app initialization:", error);
      }
    };

    initializeApp();

  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <RootNavigator />
      <Toast />
    </SafeAreaProvider>
  );
}
