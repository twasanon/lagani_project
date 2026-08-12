import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Alert,
  ActivityIndicator,
  RefreshControl,
  View,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootTabParamList } from '../navigation/AppNavigator';
import {
  executePaperTrade,
  getPaperTradingHistory,
  OrderType,
  PaperTradingTransaction,
  PaperTradingHolding,
  getPaperPortfolioItem,
  getPaperTradingPortfolio,
  getPriceBySymbol,
  PriceStatItem,
  getPricesBySymbols,
  getAllCompanies,
  resetPaperTradingData,
  getPaperTradingBalance,
  DEFAULT_PAPER_TRADING_BALANCE,
  recordPaperPortfolioValue,
  getPaperPortfolioHistory,
  PaperPortfolioHistoryPoint,
} from '../../src/utils/database';
import { syncPrices } from '../../src/api/nepseScraper';
import Toast from 'react-native-toast-message';
import PortfolioChart from '../components/PortfolioChart';
import { colors } from '../../src/theme/colors';
import { Avatar, AvatarFallback, AvatarImage } from 'react-reusables/components/ui/avatar';
import { Button } from 'react-reusables/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'react-reusables/components/ui/card';
import { Input } from 'react-reusables/components/ui/input';
import { Label } from 'react-reusables/components/ui/label';
import { Text } from 'react-reusables/components/ui/text';
import { cn } from 'react-reusables/lib/utils';

type PaperTradingScreenNavigationProp = NativeStackNavigationProp<RootTabParamList, 'PaperTrading'>;
type PaperTradingScreenRouteProp = RouteProp<RootTabParamList, 'PaperTrading'>;

interface PaperTradingScreenProps {
  route: PaperTradingScreenRouteProp;
  navigation: PaperTradingScreenNavigationProp;
}

interface TransactionHistoryItem extends PaperTradingTransaction {}

const PaperTradingScreen = ({ route, navigation }: PaperTradingScreenProps) => {
  const preselectedSymbol = route.params?.symbol ?? '';

  const [virtualBalance, setVirtualBalance] = useState<number | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistoryItem[]>([]);
  const [paperHoldings, setPaperHoldings] = useState<PaperTradingHolding[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, PriceStatItem>>({});
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingHoldings, setIsLoadingHoldings] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [validSymbols, setValidSymbols] = useState<Set<string>>(new Set());
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [portfolioHistory, setPortfolioHistory] = useState<PaperPortfolioHistoryPoint[]>([]);
  const [isLoadingHistoryChart, setIsLoadingHistoryChart] = useState(true);
  const [selectedChartValue, setSelectedChartValue] = useState<number | null>(null);
  const [selectedChartTime, setSelectedChartTime] = useState<string>('');
  const [activeTab, setActiveTab] = useState("portfolio");
  const [timeRange, setTimeRange] = useState("1d");

  const [tradeModalOrderType, setTradeModalOrderType] = useState<OrderType>('BUY');
  const [dialogSymbol, setDialogSymbol] = useState('');
  const [dialogQuantity, setDialogQuantity] = useState('');
  const [isSubmittingDialog, setIsSubmittingDialog] = useState(false);
  const [isPlaceOrderDialogVisible, setIsPlaceOrderDialogVisible] = useState(false);

  const [estimatedMarketPrice, setEstimatedMarketPrice] = useState<number | null>(null);

  const loadVirtualBalance = useCallback(async () => {
    setIsLoadingBalance(true);
    try {
      setVirtualBalance(await getPaperTradingBalance());
    } catch (error) {
      console.error("Failed to load virtual balance:", error);
      Toast.show({
        type: 'error',
        text1: 'Balance Error',
        text2: 'Could not load virtual balance.'
      });
      setVirtualBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const fetchTransactionHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const history = await getPaperTradingHistory();
      setTransactionHistory(history);
    } catch (error) {
      console.error("Failed to fetch transaction history:", error);
      Toast.show({
        type: 'error',
        text1: 'History Error',
        text2: 'Could not load transaction history.'
      });
      setTransactionHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const fetchPaperPortfolio = useCallback(async () => {
    setIsLoadingHoldings(true);
    try {
      const holdings = await getPaperTradingPortfolio();
      setPaperHoldings(holdings);

      if (holdings.length > 0) {
        const symbols = holdings.map(h => h.symbol);
        const prices = await getPricesBySymbols(symbols);
        setCurrentPrices(prices);
      } else {
        setCurrentPrices({});
      }

    } catch (error) {
      console.error("Failed to fetch paper portfolio:", error);
      Toast.show({
        type: 'error',
        text1: 'Portfolio Error',
        text2: 'Could not load paper portfolio holdings.'
      });
      setPaperHoldings([]);
      setCurrentPrices({});
    } finally {
      setIsLoadingHoldings(false);
    }
  }, []);

  const fetchPortfolioHistoryData = useCallback(async () => {
    setIsLoadingHistoryChart(true);
    setSelectedChartValue(null);
    setSelectedChartTime('');
    try {
      const history = await getPaperPortfolioHistory(90);
      setPortfolioHistory(history);
      if (history.length > 0) {
        const latestPoint = history[history.length - 1];
        setSelectedChartValue(latestPoint.totalValue);
        setSelectedChartTime(latestPoint.timestamp);
      }
    } catch (error) {
      console.error("Failed to fetch portfolio history:", error);
      Toast.show({
        type: 'error',
        text1: 'Chart Error',
        text2: 'Could not load portfolio performance history.'
      });
      setPortfolioHistory([]);
    } finally {
      setIsLoadingHistoryChart(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        console.log("[PaperTrading] Screen focused. Loading data...");
        await Promise.all([
          loadVirtualBalance(),
          fetchTransactionHistory(),
          fetchPaperPortfolio(),
        ]);
        try {
          await recordPaperPortfolioValue();
        } catch (error) {
          console.warn('[PaperTrading] Equity snapshot was not recorded:', error);
        }
        await fetchPortfolioHistoryData();
      };
      void loadData();
    }, [loadVirtualBalance, fetchTransactionHistory, fetchPaperPortfolio, fetchPortfolioHistoryData])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncPrices();
      await Promise.all([
        loadVirtualBalance(),
        fetchTransactionHistory(),
        fetchPaperPortfolio(),
      ]);
      await recordPaperPortfolioValue();
      await fetchPortfolioHistoryData();
    } catch (error) {
      console.error("Error during refresh:", error);
      Toast.show({
        type: 'error',
        text1: 'Refresh Failed',
        text2: 'Could not refresh data.'
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadVirtualBalance, fetchTransactionHistory, fetchPaperPortfolio, fetchPortfolioHistoryData]);

  useEffect(() => {
    const fetchCompanyList = async () => {
      setIsLoadingCompanies(true);
      try {
        const companies = await getAllCompanies();
        setValidSymbols(new Set(companies.map(c => c.symbol)));
        console.log(`[PaperTrading] Loaded ${companies.length} valid company symbols.`);
      } catch (error) {
        console.error("Failed to load company list:", error);
        Toast.show({
          type: 'error',
          text1: 'Company List Error',
          text2: 'Could not load company list for validation.'
        });
      } finally {
        setIsLoadingCompanies(false);
      }
    };
    fetchCompanyList();
  }, []);

  const openPlaceOrderDialog = (type: OrderType, symbol?: string) => {
    setTradeModalOrderType(type);
    setDialogSymbol(symbol ?? preselectedSymbol ?? '');
    setDialogQuantity('');
    setIsSubmittingDialog(false);
    setIsPlaceOrderDialogVisible(true);
  };

  const estimatedTotalValue = useMemo(() => {
    const quantity = parseFloat(dialogQuantity);
    if (estimatedMarketPrice && !isNaN(quantity) && quantity > 0) {
      return estimatedMarketPrice * quantity;
    }
    return null;
  }, [dialogQuantity, estimatedMarketPrice]);

  const executeTrade = async () => {
    if (isSubmittingDialog || isLoadingCompanies) return;
    setIsSubmittingDialog(true);

    const parsedQuantity = Number(dialogQuantity);
    const upperCaseSymbol = dialogSymbol.toUpperCase().trim();

    if (!upperCaseSymbol) {
        Toast.show({ type: 'error', text1: 'Invalid Input', text2: 'Please enter a stock symbol.' });
        setIsSubmittingDialog(false);
        return;
    }

    if (validSymbols.size > 0 && !validSymbols.has(upperCaseSymbol)) {
       Toast.show({ type: 'error', text1: 'Invalid Symbol', text2: `${upperCaseSymbol} is not a valid NEPSE symbol.` });
       setIsSubmittingDialog(false);
       return;
    }

    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Input', text2: 'Share quantity must be a positive whole number.' });
      setIsSubmittingDialog(false);
      return;
    }

    if (virtualBalance === null) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Virtual balance is still loading.' });
        setIsSubmittingDialog(false);
        return;
    }

    let marketPrice: number | null = null;
    try {
        const priceData = await getPriceBySymbol(upperCaseSymbol);
        marketPrice = priceData?.lastTradedPrice ?? null;
        setEstimatedMarketPrice(marketPrice);
        if (!marketPrice) {
             Toast.show({ type: 'error', text1: 'Price Error', text2: `Could not fetch price for ${upperCaseSymbol}. Try later.` });
             setIsSubmittingDialog(false);
             return;
        }
        console.log(`Fetched market price for ${upperCaseSymbol}: ${marketPrice}`);
    } catch (error) {
        console.error(`Error fetching price for ${upperCaseSymbol}:`, error);
        Toast.show({ type: 'error', text1: 'Error', text2: 'Could not fetch market price. Please try again.' });
        setIsSubmittingDialog(false);
        return;
    }

    if (marketPrice === null) {
        console.error("Market price is null after fetch, cannot proceed with trade.");
        Toast.show({ type: 'error', text1: 'Error', text2: 'Could not determine market price.' });
        setIsSubmittingDialog(false);
        return;
    }

    const tradeValue = marketPrice * parsedQuantity;

    if (tradeModalOrderType === 'BUY' && tradeValue > virtualBalance) {
      Toast.show({
          type: 'error',
          text1: 'Insufficient Funds',
          text2: `Balance (Rs. ${virtualBalance.toFixed(2)}) is insufficient for this trade (Rs. ${tradeValue.toFixed(2)}).`
      });
      setIsSubmittingDialog(false);
      return;
    }

    if (tradeModalOrderType === 'SELL') {
      try {
        const currentHolding = await getPaperPortfolioItem(upperCaseSymbol);
        if (!currentHolding || currentHolding.quantity < parsedQuantity) {
          Toast.show({
            type: 'error',
            text1: 'Insufficient Holdings',
            text2: `You only have ${currentHolding?.quantity ?? 0} paper shares of ${upperCaseSymbol}.`
          });
          setIsSubmittingDialog(false);
          return;
        }
      } catch (error) {
         console.error(`Error fetching paper holdings for ${upperCaseSymbol}:`, error);
         Toast.show({ type: 'error', text1: 'Error', text2: 'Could not verify your paper holdings.' });
         setIsSubmittingDialog(false);
         return;
      }
    }

    try {
      // The form's explicit "Confirm BUY/SELL Order" action is the confirmation.
      // A second native Alert made the web build hang because React Native does
      // not implement Alert callbacks there.
      const result = await executePaperTrade(
        upperCaseSymbol,
        tradeModalOrderType,
        parsedQuantity,
        marketPrice,
      );
      setVirtualBalance(result.balance);
      Toast.show({
        type: 'success',
        text1: 'Trade Successful',
        text2: `Successfully ${tradeModalOrderType === 'BUY' ? 'bought' : 'sold'} ${parsedQuantity} ${upperCaseSymbol} at Rs. ${marketPrice.toFixed(2)}.`,
      });
      resetDialogForm();
      setIsPlaceOrderDialogVisible(false);
      await Promise.all([fetchTransactionHistory(), fetchPaperPortfolio()]);
      await recordPaperPortfolioValue();
      await fetchPortfolioHistoryData();
    } catch (error) {
      console.error("Trade execution failed:", error);
      await loadVirtualBalance();
      Toast.show({
        type: 'error',
        text1: 'Trade Failed',
        text2: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      });
    } finally {
      setIsSubmittingDialog(false);
    }
  };

  const resetDialogForm = () => {
    setDialogSymbol('');
    setDialogQuantity('');
    setTradeModalOrderType('BUY');
    setIsSubmittingDialog(false);
    setEstimatedMarketPrice(null);
  };

  const portfolioSummary = useMemo(() => {
       return paperHoldings.reduce(
          (acc, holding) => {
              const currentPriceData = currentPrices[holding.symbol];
              const currentPrice = currentPriceData?.lastTradedPrice;
              const invested = holding.quantity * holding.averageCost;
              const currentValue = currentPrice ? holding.quantity * currentPrice : 0;

              acc.totalInvested += invested;
              acc.currentValue += currentValue;
              const prevClose = currentPriceData?.previousClose;
              if(currentPrice && prevClose) {
                  acc.todayPL += (currentPrice - prevClose) * holding.quantity;
              }

              return acc;
          },
          { totalInvested: 0, currentValue: 0, todayPL: 0 }
      );
  }, [paperHoldings, currentPrices]);

  const totalPL = portfolioSummary.currentValue - portfolioSummary.totalInvested;
  const totalPLPercent = portfolioSummary.totalInvested > 0 ? (totalPL / portfolioSummary.totalInvested) * 100 : 0;
  const todayPlColorClass = portfolioSummary.todayPL >= 0 ? 'text-green-500' : 'text-red-500';

  const handleResetPaperTrading = () => {
    Alert.alert(
      'Reset Paper Trading?',
      'This will clear all your paper trading history and portfolio, and reset your virtual balance to the default amount. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset Data',
          style: 'destructive',
          onPress: async () => {
            console.log('User confirmed paper trading reset.');
            try {
              await resetPaperTradingData();
              setVirtualBalance(DEFAULT_PAPER_TRADING_BALANCE);
              await fetchTransactionHistory();
              await fetchPaperPortfolio();
              await fetchPortfolioHistoryData();
              Toast.show({
                type: 'success',
                text1: 'Paper Trading Reset',
                text2: 'Your history and portfolio have been cleared.'
              });
            } catch (error) {
               console.error("Failed to reset paper trading data:", error);
               Toast.show({
                 type: 'error',
                 text1: 'Reset Failed',
                 text2: 'Could not reset paper trading data. Please try again.'
               });
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleChartValueSelect = useCallback((value: number | null, time: string | null) => {
    if (value !== null && time !== null) {
      setSelectedChartValue(value);
      setSelectedChartTime(time);
    } else {
      if (portfolioHistory.length > 0) {
        const latestPoint = portfolioHistory[portfolioHistory.length - 1];
        setSelectedChartValue(latestPoint.totalValue);
        setSelectedChartTime(latestPoint.timestamp);
      } else {
        setSelectedChartValue(null);
        setSelectedChartTime('');
      }
    }
  }, [portfolioHistory]);

  const filteredPortfolioHistory = useMemo(() => {
    if (timeRange === 'All' || portfolioHistory.length === 0) return portfolioHistory;
    const durations: Record<string, number> = {
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1m': 30 * 24 * 60 * 60 * 1000,
      '3m': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
    };
    const cutoff = Date.now() - (durations[timeRange] ?? durations['1d']);
    return portfolioHistory.filter((point) => new Date(point.timestamp).getTime() >= cutoff);
  }, [portfolioHistory, timeRange]);

  const adaptedHistoryData = useMemo(() => filteredPortfolioHistory.map(point => ({
    time: point.timestamp,
    value: point.totalValue,
  })), [filteredPortfolioHistory]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1 px-4 bg-zinc-50"
        contentContainerClassName="pb-24"
        keyboardShouldPersistTaps="handled"
        refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Card className="w-full mt-4 mb-4 bg-purple-200 text-black rounded-3xl overflow-hidden border-0 shadow-sm">
          <CardContent className="p-6">
            <View className="flex flex-row justify-between items-center">
              <Text className="text-zinc-600 text-lg font-medium">Virtual Balance</Text>
              <Button
                variant="outline"
                size="sm"
                className="flex-row rounded-full border-zinc-300 bg-white/50 h-10 w-auto px-4 active:bg-white/70"
                onPress={handleResetPaperTrading}
                accessibilityLabel="Reset paper trading account"
              >
                <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} className="mr-1" />
                <Text className="text-sm font-medium text-zinc-700">Reset</Text>
              </Button>
            </View>
            {isLoadingBalance ? (
              <ActivityIndicator size="large" color={colors.primary} className="mt-2"/>
            ) : (
              <Text
                className="text-3xl font-bold mt-2 text-zinc-900"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                Rs. {virtualBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '...'}
              </Text>
            )}
          </CardContent>
        </Card>

        <Card className="w-full mb-4 bg-white rounded-3xl border border-zinc-200 shadow-sm">
           <CardHeader className="pb-2 flex-row justify-between items-center">
              <CardTitle className="text-xl font-semibold text-zinc-900">Portfolio Value</CardTitle>
              {!isLoadingHoldings && portfolioSummary.todayPL !== 0 && (
                 <View className={`flex flex-row items-center ${todayPlColorClass}`}>
                    <Ionicons name={portfolioSummary.todayPL >= 0 ? "arrow-up" : "arrow-down"} size={14} color={portfolioSummary.todayPL >= 0 ? colors.positive : colors.negative} className="mr-1" />
                    <Text className={`font-medium text-sm ${todayPlColorClass}`}>
                        {portfolioSummary.todayPL >= 0 ? '+' : ''}{portfolioSummary.todayPL.toFixed(2)} Today
                    </Text>
                </View>
              )}
           </CardHeader>
           <CardContent className="pt-0">
             {isLoadingHoldings ? (
                <ActivityIndicator size="large" color={colors.positive} className="my-6"/>
             ) : (
                <>
                   <View className="flex flex-row justify-between items-center">
                       <Text
                         className="flex-1 mr-2 text-3xl font-bold text-zinc-900"
                         numberOfLines={1}
                         adjustsFontSizeToFit
                         minimumFontScale={0.75}
                       >
                         Rs. {portfolioSummary.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </Text>
                       <View className={`flex flex-row items-center ${totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                         <Ionicons name={totalPL >= 0 ? "arrow-up" : "arrow-down"} size={16} color={totalPL >= 0 ? colors.positive : colors.negative} className="mr-1" />
                         <Text className={`font-medium ${totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{totalPLPercent.toFixed(1)}%</Text>
                       </View>
                   </View>

                   <View className="flex-row justify-between mt-6">
                      <View className="flex-1 items-center px-1">
                         <Text className="text-zinc-500 text-sm mb-1">Invested</Text>
                         <Text className="text-sm font-medium text-zinc-900 text-center">Rs. {portfolioSummary.totalInvested.toFixed(2)}</Text>
                      </View>
                      <View className="flex-1 items-center px-1 border-l border-r border-zinc-200">
                         <Text className="text-zinc-500 text-sm mb-1">Current</Text>
                         <Text className="text-sm font-medium text-zinc-900 text-center">Rs. {portfolioSummary.currentValue.toFixed(2)}</Text>
                      </View>
                      <View className="flex-1 items-center px-1">
                         <Text className="text-zinc-500 text-sm mb-1">Total P/L</Text>
                         <Text className={`font-medium text-center ${totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}
                         </Text>
                      </View>
                    </View>
                </>
             )}
          </CardContent>
        </Card>

        <Card className="w-full mb-4 bg-white rounded-3xl border border-zinc-200 shadow-sm">
          <CardContent className="p-4">
             <View className="px-1 mb-2">
                  <Text className="text-2xl font-bold text-zinc-900">
                       {selectedChartValue !== null
                          ? `Rs. ${selectedChartValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : isLoadingHistoryChart ? 'Loading...' : `Rs. ${((virtualBalance ?? 0) + portfolioSummary.currentValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      }
                  </Text>
                  <Text className="text-sm text-zinc-500">
                       {selectedChartTime
                          ? new Date(selectedChartTime).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : ' '}
                  </Text>
             </View>

            <View className="h-64 w-full relative">
              {isLoadingHistoryChart ? (
                 <View className="absolute inset-0 flex items-center justify-center bg-zinc-50 rounded-lg">
                    <ActivityIndicator size="large" color={colors.primary} />
                 </View>
             ) : adaptedHistoryData.length > 1 ? (
                 <View className="absolute inset-0">
                     <PortfolioChart
                         data={adaptedHistoryData}
                         height={256}
                         onValueSelect={handleChartValueSelect}
                     />
                 </View>
             ) : (
                <View className="absolute inset-0 flex items-center justify-center bg-zinc-50 rounded-lg">
                  <Ionicons name="analytics-outline" size={40} color={colors.textSecondary} />
                  <Text className="text-zinc-500 mt-2 text-center px-4">
                    {portfolioHistory.length <= 1 ? "Not enough data yet. Keep trading!" : "Trade history needed."}
                  </Text>
                </View>
             )}
            </View>

            <View className="flex flex-row justify-between mt-4">
              {["1d", "1w", "1m", "3m", "1y", "All"].map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full px-3 h-8 ${
                    timeRange === range
                    ? "bg-zinc-900 border-zinc-900 active:bg-zinc-700"
                    : "bg-zinc-100 border-zinc-200 active:bg-zinc-200"
                  }`}
                  onPress={() => setTimeRange(range)}
                >
                  <Text className={timeRange === range ? "text-white" : "text-zinc-600"}>{range}</Text>
                </Button>
              ))}
            </View>
          </CardContent>
        </Card>

        {/* Custom Tab Implementation using StyleSheet */}
        <View style={styles.tabContainerWrapper}>
            {/* Tab Bar Container */}
            <View style={styles.tabBarContainer}>
                {/* Portfolio Tab Trigger (Pressable) */}
                <Pressable
                    onPress={() => setActiveTab('portfolio')}
                    style={[
                        styles.tabBase,
                        activeTab === 'portfolio' ? styles.tabActive : styles.tabInactive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activeTab === 'portfolio' }}
                >
                    <Text style={[
                        styles.tabTextBase,
                        activeTab === 'portfolio' ? styles.tabTextActive : styles.tabTextInactive,
                    ]}>
                        Portfolio
                    </Text>
                </Pressable>

                {/* History Tab Trigger (Pressable) */}
                <Pressable
                     onPress={() => setActiveTab('history')}
                     style={[
                        styles.tabBase,
                        activeTab === 'history' ? styles.tabActive : styles.tabInactive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activeTab === 'history' }}
                >
                    <Text style={[
                        styles.tabTextBase,
                        activeTab === 'history' ? styles.tabTextActive : styles.tabTextInactive,
                    ]}>
                        History
                    </Text>
                </Pressable>
            </View>
        </View>

        {/* Conditional Content Rendering */}
        <View className="px-4 mt-4">
            {activeTab === 'portfolio' && (
                /* Portfolio Content */
                isLoadingHoldings ? (
                    <Card className="bg-white rounded-3xl border border-zinc-200 items-center justify-center h-40 shadow-sm">
                        <ActivityIndicator size="large" color={colors.primary} />
                    </Card>
                ) : paperHoldings.length === 0 ? (
                     <Card className="bg-white rounded-3xl border border-zinc-200 items-center justify-center p-6 min-h-[100px] shadow-sm">
                          <Ionicons name="briefcase-outline" size={32} color={colors.border} />
                          <Text className="text-zinc-500 mt-2 text-center">Your paper portfolio is empty.</Text>
                     </Card>
                ) : (
                    paperHoldings.map((item, index) => {
                        const currentPrice = currentPrices[item.symbol]?.lastTradedPrice;
                        const currentValue = currentPrice ? item.quantity * currentPrice : null;
                        const profitLoss = currentValue !== null ? currentValue - (item.quantity * item.averageCost) : null;
                        let profitLossPercent: number | null = null;
                        if (currentValue !== null && item.averageCost > 0 && profitLoss !== null) {
                            profitLossPercent = (profitLoss / (item.quantity * item.averageCost)) * 100;
                        }
                        const valueColorClass = profitLoss === null ? 'text-zinc-500' : profitLoss >= 0 ? 'text-green-500' : 'text-red-500';

                        return (
                            <Card key={item.symbol} className="bg-white rounded-2xl border border-zinc-200 p-0 overflow-hidden shadow-sm mb-3">
                               <CardContent className="flex flex-row items-center justify-between p-4">
                                   <View className="flex flex-row items-center gap-3">
                                       <View className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
                                          <Text className="font-semibold text-zinc-600">{item.symbol.charAt(0)}</Text>
                                       </View>
                                       <View>
                                          <Text className="font-medium text-base text-zinc-900">{item.symbol}</Text>
                                          <Text className="text-sm text-zinc-500">{item.quantity} shares</Text>
                                       </View>
                                   </View>
                                   <View className="text-right">
                                      <Text className="font-medium text-base text-zinc-900">
                                          Rs. {currentValue != null ? currentValue.toFixed(2) : '--'}
                                      </Text>
                                      <Text className={`text-sm font-medium text-right ${valueColorClass}`}>
                                          {profitLossPercent !== null ? `${profitLossPercent >= 0 ? '+' : ''}${profitLossPercent.toFixed(1)}%` : '--'}
                                      </Text>
                                   </View>
                               </CardContent>
                            </Card>
                        );
                    })
                )
            )}

            {activeTab === 'history' && (
                /* History Content */
                isLoadingHistory ? (
                    <Card className="bg-white rounded-3xl border border-zinc-200 items-center justify-center h-40 shadow-sm">
                        <ActivityIndicator size="large" color={colors.primary} />
                    </Card>
                ) : transactionHistory.length === 0 ? (
                     <Card className="bg-white rounded-3xl border border-zinc-200 items-center justify-center p-6 min-h-[100px] shadow-sm">
                         <Ionicons name="receipt-outline" size={32} color={colors.border} />
                         <Text className="text-zinc-500 mt-2 text-center">No transaction history yet.</Text>
                    </Card>
                ) : (
                    transactionHistory.map((item, index) => (
                        <Card key={item.id?.toString() ?? index} className="bg-white rounded-2xl border border-zinc-200 p-0 overflow-hidden shadow-sm mb-3">
                            <CardContent className="flex flex-row items-center justify-between p-4">
                                <View className="flex flex-row items-center gap-3">
                                    <View className={`w-10 h-10 rounded-full flex items-center justify-center ${item.orderType === 'BUY' ? "bg-green-100" : "bg-red-100"}`}>
                                       <Text className={`font-bold text-sm ${item.orderType === 'BUY' ? "text-green-700" : "text-red-700"}`}>{item.orderType.charAt(0)}</Text>
                                    </View>
                                    <View>
                                       <Text className="font-medium text-base text-zinc-900">{item.orderType} {item.symbol}</Text>
                                       <Text className="text-sm text-zinc-500">
                                          {item.quantity} shares • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                       </Text>
                                    </View>
                                </View>
                                <View className="text-right">
                                   <Text className="font-medium text-base text-zinc-900">Rs. {item.executedPrice.toFixed(2)}</Text>
                                   <Text className="text-sm text-zinc-500">{new Date(item.timestamp).toLocaleDateString()}</Text>
                                </View>
                            </CardContent>
                         </Card>
                    ))
                )
            )}
        </View>

      </ScrollView>

       {/* Floating Action Button */}
       <Button
         size="icon"
         className="absolute bottom-5 right-5 h-14 w-14 rounded-full bg-primary shadow-lg"
         onPress={() => openPlaceOrderDialog('BUY')}
         accessibilityLabel="Place paper trade"
       >
         <Ionicons name="add" size={28} className="text-primary-foreground" />
       </Button>

       {/* Trade Entry Modal - Apply static styles matching screenshot */}
       <Modal
         animationType="slide"
         transparent={true}
         visible={isPlaceOrderDialogVisible}
         onRequestClose={() => {
           if (!isSubmittingDialog) {
             setIsPlaceOrderDialogVisible(false);
             resetDialogForm();
           }
         }}
       >
         <View className="flex-1 justify-center items-center bg-black/50 p-4">
            <View className="bg-white rounded-3xl p-6 w-full max-w-md relative flex-shrink">

               {/* Keep Close button */}
               <Pressable
                  className="absolute right-4 top-4 p-2 rounded-full bg-zinc-100 active:bg-zinc-200 z-10"
                  onPress={() => {
                      setIsPlaceOrderDialogVisible(false);
                      resetDialogForm();
                  }}
                  disabled={isSubmittingDialog}
                  accessibilityRole="button"
                  accessibilityLabel="Close trade dialog"
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>

               <Text className="text-xl font-semibold text-zinc-700 mb-4 text-center mr-8"> {/* Added margin-right for spacing */} 
                   Trade Stocks
               </Text>

               <ScrollView className="mt-2 flex-shrink" contentContainerClassName="pb-4">
                  <View>
                     {/* Buy/Sell Toggle - Revert to using cn() */}
                     <View className="flex flex-row bg-zinc-100 p-1 rounded-xl">
                         <Pressable
                             className={cn(
                                 "flex-1 rounded-lg py-2.5",
                                 tradeModalOrderType === 'BUY' ? 'bg-green-500' : 'active:bg-zinc-200',
                                 isSubmittingDialog && "opacity-50"
                             )}
                             onPress={() => setTradeModalOrderType('BUY')}
                             disabled={isSubmittingDialog}
                         >
                             <Text className={cn(
                                 "text-center",
                                 tradeModalOrderType === 'BUY' ? 'text-white font-semibold' : 'text-zinc-600'
                              )}>
                                 Buy
                             </Text>
                         </Pressable>
                         <Pressable
                              className={cn(
                                 "flex-1 rounded-lg py-2.5",
                                 tradeModalOrderType === 'SELL' ? 'bg-red-500' : 'active:bg-zinc-200',
                                 isSubmittingDialog && "opacity-50"
                              )}
                             onPress={() => setTradeModalOrderType('SELL')}
                             disabled={isSubmittingDialog}
                         >
                             <Text className={cn(
                                 "text-center",
                                 tradeModalOrderType === 'SELL' ? 'text-white font-semibold' : 'text-zinc-600'
                             )}>
                                 Sell
                             </Text>
                         </Pressable>
                     </View>

                     {/* Keep Symbol Input with screenshot styling */}
                     <View className="space-y-2 mt-4">
                         <Label nativeID="stock-search-label" className="text-zinc-600 font-medium">Stock Symbol</Label>
                         <View className="relative">
                             {/* Optional: Add search icon back */}
                             {/* <View className="absolute left-3 top-0 bottom-0 flex justify-center"><Ionicons name="search" size={18} color={colors.textSecondary} /></View> */}
                             <Input
                                 placeholder="Search symbol (e.g. NBL)"
                                 className="bg-zinc-100 border-zinc-200 rounded-xl h-12 text-zinc-900 pl-4" // Adjust padding if icon removed
                                 nativeID="stock-search-label"
                                 value={dialogSymbol}
                                 onChangeText={setDialogSymbol}
                                 autoCapitalize="characters"
                                 editable={!isSubmittingDialog}
                                 placeholderTextColor={colors.textSecondary} // Use explicit color
                             />
                         </View>
                     </View>

                     {/* Keep Quantity Input with screenshot styling */}
                     <View className="space-y-2 mt-4">
                         <Label nativeID="shares-label" className="text-zinc-600 font-medium">Number of Shares</Label>
                         <Input
                             placeholder="Enter quantity"
                             className="bg-zinc-100 border-zinc-200 rounded-xl h-12 text-zinc-900 pl-4"
                             nativeID="shares-label"
                             value={dialogQuantity}
                             onChangeText={setDialogQuantity}
                             keyboardType="numeric"
                             editable={!isSubmittingDialog}
                             placeholderTextColor={colors.textSecondary} // Use explicit color
                         />
                     </View>

                     {/* Keep Estimated Cost Section with screenshot styling */}
                     <View className="bg-zinc-100 p-4 rounded-xl space-y-2 mt-6">
                         <View className="flex-row justify-between">
                             <Text className="text-zinc-500">Estimated Cost/Proceeds</Text>
                             <Text className="text-zinc-900 font-medium">
                                 Rs. {estimatedTotalValue !== null ? estimatedTotalValue.toFixed(2) : '--'}
                            </Text>
                         </View>
                         <View className="flex-row justify-between">
                             <Text className="text-zinc-500">Available Balance</Text>
                             <Text className="text-zinc-900 font-medium">
                                 Rs. {virtualBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '...'}
                             </Text>
                         </View>
                     </View>

                     {/* Confirm Button - Use cn() for className */}
                     <Pressable
                          className={cn(
                            "w-full rounded-xl py-3 mt-6", // Base styles
                            tradeModalOrderType === 'BUY' ? 'bg-green-500' : 'bg-red-500', // Conditional bg
                            (isSubmittingDialog || !dialogSymbol || !dialogQuantity) && 'opacity-50' // Disabled opacity
                          )}
                          onPress={executeTrade}
                          disabled={isSubmittingDialog || !dialogSymbol || !dialogQuantity}
                      >
                          {isSubmittingDialog ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                              <Text className="text-center text-white font-semibold text-base">
                                  {`Confirm ${tradeModalOrderType} Order`}
                              </Text>
                          )}
                      </Pressable>

                  </View>
               </ScrollView>
            </View>
         </View>
       </Modal>
    </SafeAreaView>
  );
};

// Define StyleSheet with corrected color names
const styles = StyleSheet.create({
  safeArea: {
      flex: 1,
      backgroundColor: colors.background,
  },
  tabContainerWrapper: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 4,
    height: 48,
    width: '100%',
  },
  tabBase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: '100%',
  },
  tabInactive: {},
  tabActive: {
    backgroundColor: colors.background,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabTextBase: {
    fontSize: 16,
    fontWeight: '500',
  },
  tabTextInactive: {
    color: '#FFFFFF',
  },
  tabTextActive: {
    color: colors.text,
  },
});

export default PaperTradingScreen;
