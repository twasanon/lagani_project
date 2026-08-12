import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../navigation/HomeStackNavigator';
import StockHistoryChart from '../components/StockHistoryChart';
import { fetchStockChartData, ApiChartDataPoint } from '../../src/api/nepseScraper';
import SellStockModal from '../components/SellStockModal';
import SetPriceAlertModal from '../components/SetPriceAlertModal';
import * as Notifications from 'expo-notifications';
import {
  isWatchlisted,
  addStockToWatchlist,
  removeStockFromWatchlist,
  getPriceBySymbol,
  getCompanyBySymbol,
  getPortfolioHoldingBySymbol,
  addPriceAlert,
  PriceStatItem,
  CompanyItem,
  PortfolioHolding,
} from '../../src/utils/database';
import { colors } from '../../src/theme/colors'; // Import theme colors

// --- Notification Permission Handler ---
async function registerForPushNotificationsAsync(): Promise<boolean> {
  let hasPermission = false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('price-alerts', { // Use a specific channel ID
      name: 'Price Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  hasPermission = finalStatus === 'granted';

  return hasPermission;
}

interface StockDetailScreenProps {
  route: RouteProp<HomeStackParamList, 'StockDetail'>;
  navigation: NativeStackNavigationProp<HomeStackParamList, 'StockDetail'>;
}

const StockDetailScreen = ({ route, navigation }: StockDetailScreenProps) => {
  const { symbol, name: initialName } = route.params;
  
  // --- State for fetched data ---
  const [isWatchlistedState, setIsWatchlistedState] = useState(false);
  const [priceDetails, setPriceDetails] = useState<PriceStatItem | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyItem | null>(null);
  const [portfolioHolding, setPortfolioHolding] = useState<PortfolioHolding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSellModalVisible, setIsSellModalVisible] = useState(false);
  const [isPriceAlertModalVisible, setIsPriceAlertModalVisible] = useState(false);

  // --- NEW CHART STATE ---
  const [chartData, setChartData] = useState<ApiChartDataPoint[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  // Default to '1Y'. API expects lowercase 'y', 'm'.
  const [selectedChartRange, setSelectedChartRange] = useState('1y'); 
  const chartRangeOptions: { label: string; value: string }[] = [
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
    { label: 'YTD', value: 'ytd' },
    { label: '5Y', value: '5y' },
    { label: 'All', value: 'all' },
  ];
  const [hoveredChartValue, setHoveredChartValue] = useState<{ time: number; price: number } | null>(null);
  // --- END NEW CHART STATE ---

  // --- Data Fetching --- 
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log(`[StockDetailScreen] Fetching data for ${symbol}...`);
    try {
      const [watchlistStatus, priceData, companyData, holdingData] = await Promise.all([
        isWatchlisted(symbol),
        getPriceBySymbol(symbol),
        getCompanyBySymbol(symbol),
        getPortfolioHoldingBySymbol(symbol),
      ]);
      setIsWatchlistedState(watchlistStatus);
      setPriceDetails(priceData);
      setCompanyInfo(companyData);
      setPortfolioHolding(holdingData);

      console.log(`[StockDetailScreen] Data fetched for ${symbol}:`, { watchlistStatus, priceData, companyData, holdingData });
      if (!priceData) {
          console.warn(`[StockDetailScreen] No price data found in DB for ${symbol}`);
      }
       if (!companyData) {
          console.warn(`[StockDetailScreen] No company data found in DB for ${symbol}`);
      }

    } catch (err: any) {
      console.error(`[StockDetailScreen] Failed to fetch data for ${symbol}:`, err);
      setError("Failed to load stock details. Please try again.");
      setPriceDetails(null);
      setCompanyInfo(null);
      setIsWatchlistedState(false);
      setPortfolioHolding(null);
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  // Fetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // --- NEW: Fetch Chart Data ---
  const fetchChartDataCallback = useCallback(async () => {
    if (!symbol) return;
    setIsLoadingChart(true);
    setChartError(null);
    setHoveredChartValue(null); // Reset hovered value on new fetch
    console.log(`[StockDetailScreen] Fetching chart data for ${symbol}, range: ${selectedChartRange}`);
    try {
      // Resolution can be omitted to let backend decide based on range
      const data = await fetchStockChartData(symbol, selectedChartRange /*, resolution */);
      setChartData(data);
      if (data.length === 0) {
        console.warn(`[StockDetailScreen] No chart data returned for ${symbol}, range: ${selectedChartRange}`);
        // Optionally set a specific message if no data, e.g., setChartError("No chart data available for this range.");
      }
    } catch (err: any) {
      console.error(`[StockDetailScreen] Failed to fetch chart data for ${symbol}:`, err);
      setChartError("Failed to load chart data. Please try again.");
      setChartData([]); // Clear data on error
    } finally {
      setIsLoadingChart(false);
    }
  }, [symbol, selectedChartRange]);

  // Fetch chart data when symbol or range changes
  useEffect(() => {
    fetchChartDataCallback();
  }, [fetchChartDataCallback]); // Re-run when symbol, selectedChartRange, or selectedChartType in fetchChartDataCallback changes

  // --- Watchlist Toggle --- 
  const toggleWatchlist = async () => {
    const currentStatus = isWatchlistedState;
    const companyToAdd = companyInfo;

    setIsWatchlistedState(!currentStatus);

    try {
      if (currentStatus) {
        console.log(`[StockDetailScreen] Removing ${symbol} from watchlist...`);
        await removeStockFromWatchlist(symbol);
        console.log(`[StockDetailScreen] ${symbol} removed.`);
      } else {
        if (companyToAdd) {
          console.log(`[StockDetailScreen] Adding ${symbol} (${companyToAdd.name}) to watchlist...`);
          await addStockToWatchlist(companyToAdd);
          console.log(`[StockDetailScreen] ${symbol} added.`);
        } else {
          setIsWatchlistedState(currentStatus);
          Alert.alert("Error", "Cannot add to watchlist: Company details not available.");
          console.error(`[StockDetailScreen] Cannot add ${symbol} to watchlist: companyInfo is null.`);
        }
      }
    } catch (err: any) {
      console.error(`[StockDetailScreen] Failed to update watchlist for ${symbol}:`, err);
      setIsWatchlistedState(currentStatus);
      Alert.alert("Error", `Could not update watchlist status. ${err.message || ''}`);
    }
  };

  // --- Modal Controls ---
  const openSellModal = () => {
      if (portfolioHolding && portfolioHolding.quantity > 0) {
         setIsSellModalVisible(true);
      } else {
          Alert.alert("Cannot Sell", "You do not currently hold this stock.");
      }
  };
  const closeSellModal = () => setIsSellModalVisible(false);

  // Add handlers for Price Alert Modal
  const openPriceAlertModal = () => {
      if (!priceDetails?.lastTradedPrice) {
          Alert.alert("Cannot Set Alert", "Current price data is unavailable.");
          return;
      }
      setIsPriceAlertModalVisible(true);
  };
  const closePriceAlertModal = () => setIsPriceAlertModalVisible(false);

  // Callback after sell transaction is complete
  const handleTransactionComplete = () => {
      console.log("[StockDetailScreen] Sell transaction complete, refreshing data...");
      fetchData(); // Re-fetch all screen data
  };

  // Callback when user sets an alert in the modal
  const handleAlertSet = async (targetPrice: number, condition: 'ABOVE' | 'BELOW') => {
      console.log(`[StockDetailScreen] Alert set request: ${symbol}, Target: ${targetPrice}, Condition: ${condition}`);
      closePriceAlertModal(); // Close modal first for better UX

      // Check for notification permissions first
      const permissionGranted = await registerForPushNotificationsAsync();

      if (!permissionGranted) {
          Alert.alert(
              'Permission Required',
              'To receive price alerts, please enable notification permissions for this app in your device settings.',
              [{ text: 'OK' }]
          );
          console.log("[StockDetailScreen] Notification permission not granted. Alert not saved.");
          return; // Stop processing if no permission
      }

      // If permission granted, proceed to save
      try {
          await addPriceAlert({ symbol, targetPrice, condition });
          console.log(`[StockDetailScreen] Price alert saved successfully for ${symbol}.`);
          Alert.alert("Success", `Price alert set for ${symbol} when price goes ${condition.toLowerCase()} ${targetPrice}.`);

      } catch (err: any) {
          console.error(`[StockDetailScreen] Failed to save price alert for ${symbol}:`, err);
          Alert.alert("Error", `Failed to save price alert. ${err.message || ''}`);
      }
  };

  // --- Render Logic --- 
  const price = priceDetails?.lastTradedPrice;
  const changePercent = priceDetails?.percentChange;
  const previousClose = priceDetails?.previousClose;

  const pointChange = priceDetails?.change ?? ((typeof price === 'number' && typeof previousClose === 'number')
    ? price - previousClose
    : null);

  // Determine colors based on price change
  const changeColor = changePercent == null || changePercent >= 0 ? 'text-positive' : 'text-negative';
  const changeIcon = changePercent == null || changePercent >= 0 ? "trending-up" : "trending-down";
  // Use opacity for lighter background shades consistent with theme
  const iconColor = changePercent == null || changePercent >= 0 ? colors.positive : colors.negative;

  const displayName = companyInfo?.name || initialName || 'Loading...';

  // --- NEW: Handler for chart crosshair move ---
  const handleChartHover = useCallback((dataPoint: { time: number; price: number }) => {
    setHoveredChartValue(dataPoint);
  }, []);

  const handleChartInteractionEnd = useCallback(() => {
    setHoveredChartValue(null); // Clear the displayed value when interaction stops
  }, []);
  // --- END NEW HANDLER ---

  const latestChartPoint = chartData[chartData.length - 1];
  const displayedChartPrice = hoveredChartValue?.price ?? latestChartPoint?.c;
  const displayedChartTime = hoveredChartValue?.time ?? latestChartPoint?.t;

  if (isLoading && !priceDetails) { // Show main loading only if priceDetails are also loading
      return (
          <SafeAreaView className="flex-1 bg-white justify-center items-center">
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text className="mt-2 text-gray-500">Loading Details for {symbol}...</Text>
          </SafeAreaView>
      );
  }

  if (error) {
      return (
          <SafeAreaView className="flex-1 bg-background justify-center items-center p-4">
              <Text className="mt-4 text-lg font-semibold text-center text-negative">Error</Text>
              <Text className="text-center text-textSecondary mt-2">{error}</Text>
              <TouchableOpacity
                onPress={fetchData}
                className="mt-6 bg-primary px-6 py-2 rounded-lg"
              >
                <Text className="text-white font-medium">Retry</Text>
              </TouchableOpacity>
          </SafeAreaView>
      );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 border-b border-border">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="p-1"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-text" numberOfLines={1}>{symbol}</Text>
        <TouchableOpacity
          onPress={toggleWatchlist}
          className="p-1"
          accessibilityRole="button"
          accessibilityLabel={isWatchlistedState ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
        >
          <Ionicons name={isWatchlistedState ? "heart" : "heart-outline"} size={26} color={isWatchlistedState ? colors.primary : colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Stock Info Header */}
        <View className="p-4">
          <Text className="text-2xl font-bold text-text mb-1" numberOfLines={2}>{displayName}</Text>
          <Text className="text-lg font-semibold text-text mb-1">
            Rs. {price != null ? price.toFixed(2) : '--'}
          </Text>
          <View className="flex-row items-center">
            <Ionicons name={changeIcon} size={18} color={iconColor} />
            <Text className={`ml-1 font-medium ${changeColor}`}>
              {pointChange != null ? pointChange.toFixed(2) : '--'} ({changePercent != null ? changePercent.toFixed(2) : '--'}%)
            </Text>
             {/* Add "Today" or similar indicator? */}
          </View>
        </View>

        {/* Chart Section */}
        <View className="rounded-xl overflow-hidden mx-4 bg-card border border-border p-3">
          <View className="flex-row items-end justify-between mb-2">
            <Text className="text-lg font-semibold text-text">
              {displayedChartPrice == null ? '--' : `Rs. ${displayedChartPrice.toFixed(2)}`}
            </Text>
            <Text className="text-xs text-textSecondary">
              {displayedChartTime == null ? '' : new Date(displayedChartTime * 1000).toLocaleDateString()}
            </Text>
          </View>
          {isLoadingChart ? (
            <View className="h-60 items-center justify-center">
              <ActivityIndicator color={colors.primary} />
              <Text className="mt-2 text-sm text-textSecondary">Loading price history…</Text>
            </View>
          ) : chartError ? (
            <View className="h-60 items-center justify-center px-6">
              <Text className="text-center text-negative">{chartError}</Text>
              <TouchableOpacity className="mt-3 rounded-lg bg-primary px-4 py-2" onPress={fetchChartDataCallback}>
                <Text className="font-medium text-white">Retry chart</Text>
              </TouchableOpacity>
            </View>
          ) : chartData.length === 0 ? (
            <View className="h-60 items-center justify-center">
              <Text className="text-textSecondary">No history is available for this range.</Text>
            </View>
          ) : (
            <StockHistoryChart
              data={chartData}
              height={240}
              lineColor={iconColor}
              chartBackgroundColor={colors.card}
              onCrosshairMove={handleChartHover}
              onInteractionEnd={handleChartInteractionEnd}
            />
          )}
        </View>
        
        {/* Time Range Selector */}
        <View className="flex-row justify-around my-4 mx-4">
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 8, paddingVertical:4, alignItems: 'center' }}
              className="my-1"
            >
              {chartRangeOptions.map((rangeOption) => (
                <TouchableOpacity
                  key={rangeOption.value}
                  onPress={() => setSelectedChartRange(rangeOption.value)}
                  className={`px-3 py-1.5 rounded-md mr-2 border
                             ${selectedChartRange === rangeOption.value ? 'bg-primary border-primary' : 'bg-card border-border'}`}
                >
                  <Text className={`${selectedChartRange === rangeOption.value ? 'text-white' : 'text-textSecondary'} text-xs font-medium`}>
                    {rangeOption.label}
                  </Text>
                </TouchableOpacity>
            ))}
            </ScrollView>
        </View>

        {/* Key Stats Section - Ensure no extra background */}
        <View className="bg-card rounded-lg p-4 mx-4 mb-4 border border-border">
            <Text className="text-lg font-semibold text-text mb-3">Key Statistics</Text>
            <View className="flex-row justify-between mb-2">
                <StatCard label="Open" value={priceDetails?.openPrice} />
                <StatCard label="High" value={priceDetails?.highPrice} />
            </View>
            <View className="flex-row justify-between">
                <StatCard label="Low" value={priceDetails?.lowPrice} />
                <StatCard label="Prev. Close" value={priceDetails?.previousClose} />
            </View>
        </View>

        {/* Action Buttons - Ensure no extra background */}
         <View className="flex-row justify-around mx-4 mb-4">
            <TouchableOpacity
                onPress={openSellModal}
                className="flex-1 bg-negative bg-opacity-90 py-3 px-4 rounded-lg items-center mr-2">
                <Text className="text-white font-semibold">Sell</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={openPriceAlertModal}
                className="flex-1 bg-primary bg-opacity-90 py-3 px-4 rounded-lg items-center ml-2">
                 <Ionicons name="notifications-outline" size={18} color="white" style={{position: 'absolute', left: 15, top: 13}}/>
                <Text className="text-white font-semibold pl-4">Set Alert</Text>
            </TouchableOpacity>
        </View>

        {/* Portfolio Holding Info (Conditional) - Ensure no extra background */}
        {portfolioHolding && (
          <View className="bg-card rounded-lg p-4 mx-4 mb-6 border border-border">
            <Text className="text-lg font-semibold text-text mb-3">Your Holding</Text>
            <View className="flex-row justify-between mb-1">
                <Text className="text-textSecondary">Quantity:</Text>
                <Text className="text-text font-medium">{portfolioHolding.quantity}</Text>
            </View>
            <View className="flex-row justify-between">
                <Text className="text-textSecondary">Avg. Cost:</Text>
                <Text className="text-text font-medium">Rs. {portfolioHolding.averagePurchasePrice.toFixed(2)}</Text>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Modals */}
      <SellStockModal
        isVisible={isSellModalVisible}
        onClose={closeSellModal}
        symbol={symbol}
        companyName={displayName}
        currentQuantity={portfolioHolding?.quantity ?? 0}
        onTransactionComplete={handleTransactionComplete}
      />
      <SetPriceAlertModal 
          isVisible={isPriceAlertModalVisible}
          onClose={closePriceAlertModal}
          symbol={symbol}
          currentPrice={price ?? 0}
          onAlertSet={handleAlertSet}
      />
    </SafeAreaView>
  );
};

// Stat Card Component 
const StatCard = ({ label, value }: { label: string, value: string | number | null | undefined }) => (
    <View className="flex-1 items-center px-1">
        <Text className="text-xs text-textSecondary mb-1">{label}</Text>
        <Text className="text-sm font-semibold text-text">
            {typeof value === 'number' && value > 0 ? `Rs. ${value.toFixed(2)}` : value || '--'}
        </Text>
    </View>
);

export default StockDetailScreen;
