import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../navigation/HomeStackNavigator';
import AddToWatchlistModal from '../components/AddToWatchlistModal';
import PriceAlertsModal from '../components/PriceAlertsModal';
import { colors } from '../../src/theme/colors';
import { Button } from 'react-reusables/components/ui/button';
import { Card, CardContent } from 'react-reusables/components/ui/card';
import { Input } from 'react-reusables/components/ui/input';
import { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootTabParamList } from '../navigation/AppNavigator';

// Import Database and API functions
import {
  getMarketStatus,
  getTopGainers,
  getTopLosers,
  getWatchlistStocks,
  getPortfolioHoldings,
  getPricesBySymbols,
  MarketStatusItem,
  TopListItem,
  WatchlistItem,
  PortfolioHolding,
  PriceStatItem,
} from '../../src/utils/database';
import { refreshDataIfNeeded } from '../../src/api/nepseScraper';
import { searchCompanies } from '../../src/utils/database';

// Define SearchResult interface if not present
interface SearchResult {
  id: string;
  symbol: string;
  name: string;
}

// Combine navigation props: Stack prop for within HomeStack, Tab prop for parent tabs
type HomeScreenNavigationProp = CompositeNavigationProp<
    NativeStackNavigationProp<HomeStackParamList, 'Home'>, // Primary: Navigation within HomeStack
    BottomTabNavigationProp<RootTabParamList> // Secondary: Access to parent Tab navigator
>;

// Helper type for combined portfolio data
interface CalculatedPortfolio {
  value: number;
  cost: number;
  profitLoss: number;
  profitLossPercentage: number;
  isPositive: boolean;
  overallPLString: string;
  overallPLPercentString: string;
}

// --- Helper Components / Render Functions ---

const MarketMoverItem = ({ item, index, navigation }: {
  item: TopListItem;
  index: number;
  navigation: HomeScreenNavigationProp;
}) => {
  const navigateToStockDetail = (symbol: string, name?: string | null) => {
      navigation.navigate('StockDetail', { symbol, name: name ?? undefined });
  };
  const changeColor = item.percentageChange >= 0 ? 'text-positive' : 'text-negative';

  return (
    <TouchableOpacity
      key={`${item.symbol}-${index}`}
      className="flex-row justify-between items-center p-3 mb-2 bg-card rounded-lg shadow-sm"
      onPress={() => navigateToStockDetail(item.symbol, item.securityName)}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.symbol} details`}
    >
      <View className="flex-row items-center flex-1 mr-2">
         <View className="w-10 h-10 rounded-lg items-center justify-center bg-border">
           <Text className="font-bold text-xs text-textSecondary">{item.symbol.charAt(0)}</Text>
         </View>
         <View className="ml-3 flex-1">
           <Text className="font-semibold text-sm text-text" numberOfLines={1}>{item.symbol}</Text>
           <Text className="text-textSecondary text-xs" numberOfLines={1}>{item.securityName}</Text>
         </View>
       </View>
      <View className="items-end w-1/3">
        <Text className="font-semibold text-sm text-text">{item.ltp?.toFixed(2)}</Text>
        <Text className={`text-xs font-medium ${changeColor}`}>
          {item.percentageChange >= 0 ? '+' : ''}{item.percentageChange?.toFixed(2)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const WatchlistItemPreview = ({ item, index, navigation }: {
  item: WatchlistItem;
  index: number;
  navigation: HomeScreenNavigationProp;
}) => {
    const navigateToStockDetail = (symbol: string, name?: string | null) => {
        navigation.navigate('StockDetail', { symbol, name: name ?? undefined });
    };
    const changeColor = item.changePercent == null || item.changePercent >= 0 ? 'text-positive' : 'text-negative';

    return (
        <TouchableOpacity
          key={item.id}
          className="flex-1 flex-row items-center p-2 bg-card rounded-lg mb-2 shadow-sm"
          onPress={() => navigateToStockDetail(item.symbol, item.name)}
          accessibilityRole="button"
          accessibilityLabel={`View ${item.symbol} details`}
        >
          <View className="flex-row items-center flex-1 mr-2">
             <View className="w-10 h-10 rounded-lg items-center justify-center bg-border">
                <Text className="font-bold text-xs text-textSecondary">{item.symbol?.charAt(0) ?? '?'}</Text>
             </View>
             <View className="ml-3 flex-1">
                <Text className="font-semibold text-sm text-text" numberOfLines={1}>{item.symbol}</Text>
                <Text className="text-textSecondary text-xs" numberOfLines={1}>{item.name}</Text>
             </View>
          </View>
          <View className="items-end ml-2 w-20">
             <Text className="text-sm font-semibold text-text">Rs. {item.lastPrice != null ? item.lastPrice.toFixed(2) : '--'}</Text>
             <Text className={`text-xs font-medium ${changeColor}`}>
                 {item.changePercent == null ? '--%' : `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%`}
             </Text>
          </View>
        </TouchableOpacity>
    );
};

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  // --- State for API/DB Data ---
  const [marketStatus, setMarketStatus] = useState<MarketStatusItem | null>(null);
  const [topGainers, setTopGainers] = useState<TopListItem[]>([]);
  const [topLosers, setTopLosers] = useState<TopListItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [portfolioHoldingCount, setPortfolioHoldingCount] = useState(0);
  const [calculatedPortfolio, setCalculatedPortfolio] = useState<CalculatedPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPortfolioLoading, setIsPortfolioLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- State for Modals ---
  const [isAddToWatchlistModalVisible, setIsAddToWatchlistModalVisible] = useState(false);
  const [isPriceAlertsModalVisible, setIsPriceAlertsModalVisible] = useState(false);

  // --- State for Search ---
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  // Add state for debounce timer
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  // --- Portfolio Calculation Logic ---
  const calculatePortfolio = (holdings: PortfolioHolding[], prices: Record<string, PriceStatItem>): CalculatedPortfolio | null => {
      if (!holdings || holdings.length === 0) {
          return { value: 0, cost: 0, profitLoss: 0, profitLossPercentage: 0, isPositive: true, overallPLString: '0.00', overallPLPercentString: '0.00%' };
      }

      let totalValue = 0;
      let totalCost = 0;

      for (const holding of holdings) {
          const currentPriceData = prices[holding.symbol];
          const currentPrice = currentPriceData?.lastTradedPrice ?? holding.averagePurchasePrice;

          totalValue += holding.quantity * currentPrice;
          totalCost += holding.quantity * holding.averagePurchasePrice;
      }

      const profitLoss = totalValue - totalCost;
      const profitLossPercentage = totalCost !== 0 ? (profitLoss / totalCost) * 100 : 0;
      const isPositive = profitLoss >= 0;

       console.log('[HomeScreen] Portfolio Calculated:', { totalValue, totalCost, profitLoss });

      return {
          value: totalValue,
          cost: totalCost,
          profitLoss,
          profitLossPercentage,
          isPositive,
          overallPLString: profitLoss.toFixed(2),
          overallPLPercentString: profitLossPercentage.toFixed(2) + '%',
      };
  };

  // --- Data Fetching Logic ---
  const loadPortfolioData = useCallback(async () => {
      setIsPortfolioLoading(true);
      console.log("[HomeScreen] Loading portfolio data...");
      let calculated: CalculatedPortfolio | null = null;
      try {
          const holdings = await getPortfolioHoldings();
          setPortfolioHoldingCount(holdings.length);
          if (holdings.length > 0) {
              const symbols = holdings.map(h => h.symbol);
              const prices = await getPricesBySymbols(symbols);
              calculated = calculatePortfolio(holdings, prices);
              setCalculatedPortfolio(calculated);
          } else {
              calculated = calculatePortfolio([], {});
              setCalculatedPortfolio(calculated);
          }
          console.log(`[HomeScreen] Portfolio data loaded. Holdings: ${holdings.length}`);

      } catch (err: any) {
          console.error("[HomeScreen] Error loading portfolio data:", err);
          setError("Failed to load portfolio data.");
          setCalculatedPortfolio(null);
      } finally {
           setIsPortfolioLoading(false);
      }
      return calculated;
  }, []);

  const loadData = useCallback(async (refreshing = false) => {
    if (!refreshing) {
        setIsLoading(true);
    }
    setError(null);
    console.log("[HomeScreen] Loading main data...");
    let portfolioSummary: CalculatedPortfolio | null = null;
    try {
      await refreshDataIfNeeded(refreshing);

      const [status, gainers, losers, watch] = await Promise.all([
        getMarketStatus(),
        getTopGainers(),
        getTopLosers(),
        getWatchlistStocks(),
      ]);

      setMarketStatus(status);
      setTopGainers(gainers || []);
      setTopLosers(losers || []);
      setWatchlist(watch || []);

      console.log('[HomeScreen] Main DB data loaded successfully');

      portfolioSummary = await loadPortfolioData();

    } catch (err: any) {
      console.error("[HomeScreen] Error loading main data:", err);
      setError("Failed to load market data. Pull down to retry.");
    } finally {
      setIsLoading(false);
      if (refreshing) {
          setIsRefreshing(false);
      }
    }
    return portfolioSummary;
  }, [loadPortfolioData]);

  useFocusEffect(
    useCallback(() => {
      console.log("[HomeScreen] Screen focused, loading data...");
      void loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
      console.log("[HomeScreen] Pull-to-refresh triggered");
      setIsRefreshing(true);
      void loadData(true);
  }, [loadData]);

  // --- Navigation ---
  const navigateToStockDetail = (symbol: string, name: string) => {
    navigation.navigate('StockDetail', { symbol, name });
  };

  // --- Modal Controls ---
  const openAddToWatchlistModal = () => setIsAddToWatchlistModalVisible(true);
  const closeAddToWatchlistModal = () => setIsAddToWatchlistModalVisible(false);
  const openPriceAlertsModal = () => setIsPriceAlertsModalVisible(true);
  const closePriceAlertsModal = () => setIsPriceAlertsModalVisible(false);

  // Callback for when a stock is added to watchlist
  const handleStockAddedToWatchlist = () => {
    console.log("[HomeScreen] Stock added to watchlist, reloading watchlist data...");
    loadData();
  };

  // --- Search Logic (with Debounce) ---
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (text.length <= 1) {
      setSearchResults([]);
      setIsSearchLoading(false);
      debounceTimer.current = null;
      return;
    }

    const newTimer = setTimeout(async () => {
      console.log("[SearchDebounce] Triggering search for:", text);
      setIsSearchLoading(true);
      setSearchResults([]); 
      try {
        // Fetch results from DB
        const companyResults = await searchCompanies(text);
        
        // Map CompanyItem[] to SearchResult[] (convert id to string)
        const searchResultsMapped: SearchResult[] = companyResults.map(company => ({
          id: String(company.id),
          symbol: company.symbol,
          name: company.name,
        }));

        // Set state with the correctly mapped results
        setSearchResults(searchResultsMapped);
        console.log("[SearchDebounce] Search complete, results count:", searchResultsMapped.length);

      } catch (error) {
        console.error("[SearchDebounce] Error during search:", error);
        setSearchResults([]);
      } finally {
        setIsSearchLoading(false);
      }
    }, 300); 

    debounceTimer.current = newTimer;
  };

  const handleCancelSearch = () => {
    setIsSearching(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSelectSearchResult = (symbol: string, name: string) => {
      handleCancelSearch();
      navigateToStockDetail(symbol, name);
  };

  // Define render functions using the standalone components
  const renderMarketMoverItem = (item: TopListItem, index: number) => (
      <MarketMoverItem item={item} index={index} navigation={navigation} />
  );
  const renderWatchlistItem = (item: WatchlistItem, index: number) => (
      <WatchlistItemPreview item={item} index={index} navigation={navigation} />
  );

  // --- Navigation Handlers ---
  const handleNavigateToNews = () => {
    // Use the composite navigation prop to access the parent tab navigator
    navigation.navigate('News');
  };

  // Add this handler function
  const handleNavigateToAddTransaction = () => {
    // Use composite navigation prop to go to Portfolio tab
    // Optionally, you could open the AddStockHoldingModal directly here instead of navigating
    // setIsAddTransactionModalVisible(true);
    navigation.navigate('Portfolio'); // Navigate to Portfolio Tab
  };

  // --- UI Render Functions ---

   // Function to render the dynamic header based on search state
   const renderHeader = () => {
    if (isSearching) {
      return (
        <View className="flex-row items-center p-4 border-b border-border bg-card">
          <Input
            placeholder="Search stocks... (e.g., NIFRA)"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoFocus
            className="flex-1 mr-2"
          />
          <TouchableOpacity
            onPress={handleCancelSearch}
            className="p-1.5"
            accessibilityRole="button"
            accessibilityLabel="Close stock search"
          >
            <Ionicons name="close" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      );
    }

    // Default Header - Modified Layout, Kept Sizes
    return (
      <View className="flex-row items-center justify-between p-4">
        {/* Left Side: Just the Title */}
        <Text className="text-3xl font-bold text-text">Lagani</Text>

        {/* Right Side: Market Status + Icons */}
        <View className="flex-row items-center space-x-3"> 
            {/* Market Status Moved Here */} 
             {marketStatus ? (
               <View className="flex-row items-center">
                 <View className={`w-2 h-2 rounded-full mr-1.5 ${(marketStatus.isOpen ?? 'CLOSE') === 'OPEN' ? 'bg-positive' : 'bg-negative'}`}></View>
                 <Text className={`text-sm font-medium ${(marketStatus.isOpen ?? 'CLOSE') === 'OPEN' ? 'text-positive' : 'text-negative'}`}>
                     {(marketStatus.isOpen === 'OPEN' ? 'Market Open' : 'Market Closed')} 
                 </Text>
               </View>
             ) : (
               <ActivityIndicator size="small" color={colors.textSecondary} />
             )}

            {/* Icons (Size remains increased) */}
            <TouchableOpacity
              onPress={() => setIsSearching(true)}
              className="p-1.5"
              accessibilityRole="button"
              accessibilityLabel="Search stocks"
            >
              <Ionicons name="search-outline" size={26} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openPriceAlertsModal}
              className="p-1.5"
              accessibilityRole="button"
              accessibilityLabel="View price alerts"
            >
              <Ionicons name="notifications-outline" size={26} color={colors.textSecondary} />
            </TouchableOpacity>
        </View>
      </View>
    );
  };

  // --- Main Render ---
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {/* Render the dynamic header */}
      {renderHeader()}

      {/* Conditional Search Input and Results */}
      {isSearching && (
         // Search Results List
         <View className="flex-1 p-4">
           {isSearchLoading && <ActivityIndicator color={colors.primary} />}
           {!isSearchLoading && searchResults.length === 0 && searchQuery.length > 1 && (
               <Text className="text-center text-textSecondary mt-4">No results found for "{searchQuery}".</Text>
           )}
            {!isSearchLoading && (
                // Use FlatList for better performance with potentially many results
                <FlatList
                    data={searchResults}
                    keyExtractor={(item: SearchResult) => item.id}
                    renderItem={({ item }: { item: SearchResult }) => (
                        <TouchableOpacity
                          onPress={() => handleSelectSearchResult(item.symbol, item.name)}
                          className="py-2 border-b border-border"
                          accessibilityRole="button"
                          accessibilityLabel={`View ${item.symbol} details`}
                        >
                            <Text className="text-base text-text">{item.symbol}</Text>
                            <Text className="text-sm text-textSecondary">{item.name}</Text>
                        </TouchableOpacity>
                    )}
                />
            )}
         </View>
      )}

      {/* Main Content ScrollView - Conditionally render based on search */}
      {!isSearching && (
          <ScrollView
            className="flex-1"
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            showsVerticalScrollIndicator={false}
          >
             {/* Portfolio Section */}
             <View className="mx-4 mt-6">
                 <Text className="text-textSecondary text-sm font-medium">Total Portfolio Value</Text>
                 {isPortfolioLoading ? (
                     <ActivityIndicator size="small" color={colors.primary} className="mt-2 self-start" />
                 ) : calculatedPortfolio ? (
                     <>
                         <View className="flex-row items-baseline mt-1">
                             <Text className="text-3xl font-bold text-text">Rs. {calculatedPortfolio.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                         </View>
                         <View className="flex-row items-center mt-1">
                             <Text className={`font-medium ${calculatedPortfolio.isPositive ? 'text-positive' : 'text-negative'}`}>
                                 {calculatedPortfolio.overallPLString} ({calculatedPortfolio.overallPLPercentString})
                             </Text>
                             <Text className="text-textSecondary ml-2 text-xs">Unrealized P/L</Text>
                         </View>
                     </>
                 ) : (
                     <Text className="text-textSecondary mt-2">Portfolio data unavailable.</Text>
                 )}

                 {calculatedPortfolio && (
                   <View className="mt-4 flex-row rounded-xl bg-card p-3">
                     <View className="flex-1">
                       <Text className="text-xs text-textSecondary">Cost basis</Text>
                       <Text className="mt-1 font-semibold text-text">Rs. {calculatedPortfolio.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                     </View>
                     <View className="flex-1 border-l border-border pl-3">
                       <Text className="text-xs text-textSecondary">Holdings</Text>
                       <Text className="mt-1 font-semibold text-text">{portfolioHoldingCount}</Text>
                     </View>
                   </View>
                 )}
             </View>

             {/* Action Buttons as Cards */}
             <View className="flex-row justify-between mx-4 mt-6">
                {/* Add Stock Card Button */}
                <TouchableOpacity
                     className="flex-1 mr-2"
                     onPress={handleNavigateToAddTransaction}
                 >
                    <Card className="bg-card p-4 rounded-3xl shadow-sm items-center">
                       <Ionicons name="add-circle-outline" size={32} color={colors.primary} className="mb-2" />
                       <Text className="text-text font-medium text-sm">Add Stock</Text>
                    </Card>
                </TouchableOpacity>

                {/* News Card Button - Update onPress */}
                <TouchableOpacity
                     className="flex-1 ml-2"
                     onPress={handleNavigateToNews}
                 >
                    <Card className="bg-card p-4 rounded-3xl shadow-sm items-center">
                       <Ionicons name="newspaper-outline" size={28} color={colors.primary} className="mb-2" />
                       <Text className="text-text font-medium text-sm">News</Text>
                    </Card>
                </TouchableOpacity>
             </View>

             {/* Loading/Error Indicator for main data */}
             {isLoading && !isRefreshing && (
               <View className="flex-1 justify-center items-center mt-10">
                 <ActivityIndicator size="large" color={colors.primary} />
               </View>
             )}
             {error && !isLoading && (
               <View style={styles.centered} className="flex-1 bg-background p-4">
                 <Ionicons name="warning-outline" size={48} color={colors.negative} />
                 <Text className="text-negative text-center mb-3 font-semibold mt-2">Error Loading Market Data</Text>
                 <Text className="text-textSecondary text-center mb-4">{error}</Text>
                 <TouchableOpacity onPress={() => loadData()} className="bg-primary bg-opacity-10 px-4 py-2 rounded-md">
                   <Text className="text-primary font-medium">Retry</Text>
                 </TouchableOpacity>
               </View>
             )}

             {/* Data-dependent sections (Movers, Watchlist) */}
             {!isLoading && !error && (
                 <>
                     {/* Top Gainers Section */}
                     <View className="mt-6 mx-4">
                        <Text className="text-lg font-semibold text-text mb-3">Top Gainers</Text>
                        {topGainers.length > 0 ? (
                            topGainers.slice(0, 5).map((item, index) => 
                                React.cloneElement(renderMarketMoverItem(item, index), { key: `gainer-${item.symbol}-${index}` })
                            )
                        ) : (
                            <Text className="text-textSecondary text-center py-4">No gainers data available.</Text>
                        )}
                     </View>

                     {/* Top Losers Section */}
                     <View className="mt-6 mx-4">
                        <Text className="text-lg font-semibold text-text mb-3">Top Losers</Text>
                        {topLosers.length > 0 ? (
                            topLosers.slice(0, 5).map((item, index) => 
                                React.cloneElement(renderMarketMoverItem(item, index), { key: `loser-${item.symbol}-${index}` })
                            )
                        ) : (
                            <Text className="text-textSecondary text-center py-4">No losers data available.</Text>
                        )}
                     </View>

                     {/* Watchlist Section */}
                     <View className="mt-6 px-4">
                       <View className="flex-row justify-between items-center mb-3">
                         <Text className="text-lg font-semibold text-text">Watchlist</Text>
                         <TouchableOpacity onPress={() => navigation.navigate('Watchlist')}>
                           <Text className="text-primary font-medium">See All</Text>
                         </TouchableOpacity>
                       </View>
                       {watchlist.length > 0 ? (
                         <View>
                           {watchlist.slice(0, 3).map((item, index) => (
                             <WatchlistItemPreview
                               key={item.id}
                               item={item}
                               index={index}
                               navigation={navigation}
                             />
                           ))}
                         </View>
                       ) : (
                         <View className="items-center justify-center p-4 bg-card rounded-lg">
                           <Text className="text-textSecondary text-center">Your watchlist is empty.</Text>
                           <Button variant="link" className="mt-1" onPress={openAddToWatchlistModal}>
                              <Text className="text-primary">Add Stocks</Text>
                           </Button>
                         </View>
                       )}
                     </View>
                 </>
             )}
           </ScrollView>
      )}

      {/* Modals (Only show when not searching) */}
      {!isSearching && (
         <>
           <AddToWatchlistModal
             isVisible={isAddToWatchlistModalVisible}
             onClose={closeAddToWatchlistModal}
             onStockAdded={handleStockAddedToWatchlist}
           />
           <PriceAlertsModal
             isVisible={isPriceAlertsModalVisible}
             onClose={closePriceAlertsModal}
           />
         </>
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    right: 20,
    bottom: 20,
    backgroundColor: colors.primary,
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});

export default HomeScreen;
