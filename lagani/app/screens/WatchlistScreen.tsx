import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, ActivityIndicator, StyleSheet } from 'react-native'; // Added StyleSheet
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'; // Need for parent Tab navigator
import { RootTabParamList } from '../navigation/AppNavigator'; // Import RootTabParamList
import { HomeStackParamList } from '../navigation/HomeStackNavigator'; // Import HomeStackParamList for nested navigation
// DB Imports - Correct function name
import { getWatchlistStocks, removeStockFromWatchlist, WatchlistItem as DbWatchlistItemBase } from '../../src/utils/database';
// Scraper Imports - Assuming scrapeCompanyDetailBySymbol is no longer used directly here
// import { scrapeCompanyDetailBySymbol, ScrapedCompanyDetail } from '../../src/api/nepseScraper';
// Import the modal
import AddToWatchlistModal from '../components/AddToWatchlistModal';
import { colors } from '../../src/theme/colors'; // Import theme colors

// Composite type: Primary is Bottom Tab, Secondary is Stack for navigating TO the HomeStack
type WatchlistScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Watchlist'>, // Primary: Current Tab Navigator Context
  NativeStackNavigationProp<HomeStackParamList> // Secondary: Ability to navigate to screens in HomeStack
>;

// Simplified WatchlistItem for this screen - gets data from DB which includes price/change
interface WatchlistItem extends DbWatchlistItemBase {}

interface WatchlistItemCardProps {
  item: WatchlistItem;
  onPress: (symbol: string, name: string) => void;
  onDelete: (symbol: string) => void;
}

const WatchlistItemCard = ({ item, onPress, onDelete }: WatchlistItemCardProps) => {
  const changeColor = item.changePercent == null || item.changePercent >= 0 ? styles.positiveChange : styles.negativeChange;
  const price = item.lastPrice != null ? item.lastPrice.toFixed(2) : '--';
  const changeText = item.changePercent != null ? `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%` : '--%';

  return (
    // Remove border-border
    <TouchableOpacity 
      style={styles.cardContainer} 
      onPress={() => onPress(item.symbol, item.name)}
    >
        <View style={styles.logoContainer}>
             <Text style={styles.logoText}>{item.symbol?.charAt(0) ?? '?'}</Text>
        </View>
        <View style={styles.infoContainer}>
            <Text style={styles.symbolText} numberOfLines={1}>{item.symbol}</Text>
            <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
        </View>
        <View style={styles.priceContainer}>
            <Text style={styles.priceText}>₹ {price}</Text>
            <Text style={[styles.changeText, changeColor]}>{changeText}</Text>
        </View>
        {/* Delete Button */}
        <TouchableOpacity onPress={() => onDelete(item.symbol)} style={styles.removeButton}>
           <Ionicons name="trash-outline" size={20} color={colors.negative} /> 
        </TouchableOpacity>
    </TouchableOpacity>
  );
};

const WatchlistScreen = () => {
  const navigation = useNavigation<WatchlistScreenNavigationProp>();
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null); // Added error state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  // Add state for the modal
  const [isAddToWatchlistModalVisible, setIsAddToWatchlistModalVisible] = useState(false);

  // Fetch watchlist symbols from DB (includes price/change data from the join)
  const loadWatchlistData = useCallback(async () => {
    console.log("[WatchlistScreen] Fetching watchlist data...");
    setIsLoadingList(true);
    setError(null);
    setWatchlistItems([]); // Clear previous items
    try {
      // Use the correct function name
      const dbItems = await getWatchlistStocks();
      setWatchlistItems(dbItems || []); // Update state with fetched items
      console.log(`[WatchlistScreen] Fetched ${dbItems?.length || 0} items.`);

    } catch (error: any) {
      console.error("[WatchlistScreen] Failed to fetch watchlist items:", error);
      setError("Could not load watchlist.");
    } finally {
        setIsLoadingList(false);
    }
  }, []);

  // Fetch data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadWatchlistData();
    }, [loadWatchlistData])
  );

  // --- Modal Control Handlers ---
  const openAddToWatchlistModal = () => setIsAddToWatchlistModalVisible(true);
  const closeAddToWatchlistModal = () => setIsAddToWatchlistModalVisible(false);

  // Function called when a stock is successfully added via the modal
  const handleStockAdded = useCallback(() => {
    console.log("[WatchlistScreen] Stock added via modal, reloading data...");
    loadWatchlistData(); // Refresh the watchlist
    // Keep modal open or close? Closing for now.
    closeAddToWatchlistModal(); 
  }, [loadWatchlistData]);

  // Function to remove item from watchlist
  const handleRemoveFromWatchlist = async (symbol: string) => {
    console.log(`[WatchlistScreen] Removing ${symbol}...`);
    try {
      // Use the correct function name
      await removeStockFromWatchlist(symbol);
      // Re-fetch data to reflect the change
      // Alternatively, filter locally: setWatchlistItems(prev => prev.filter(item => item.symbol !== symbol));
      await loadWatchlistData(); // Use renamed function
      console.log(`[WatchlistScreen] ${symbol} removed.`);
    } catch (error) {
        console.error(`[WatchlistScreen] Failed to remove ${symbol}:`, error);
        // Show error to user?
    }
  };

  // Filter watchlist items
  const filteredItems = searchQuery
    ? watchlistItems.filter(item =>
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : watchlistItems;

  // Navigate to stock detail - Adjust to navigate into the nested stack
  const navigateToStockDetail = (symbol: string, name?: string) => {
    // Navigate to the HomeStack first, then to the StockDetail screen within it
    navigation.navigate('HomeStack', { screen: 'StockDetail', params: { symbol, name: name || `${symbol} Name` } });
  };

  // Key extractor
  const keyExtractor = (item: WatchlistItem) => item.id.toString();

  // Render Item - Use data directly from WatchlistItem (which includes price/change)
   const renderItem = ({ item }: { item: WatchlistItem }) => {
    const price = item.lastPrice;
    const changePercentage = item.changePercent;
    const changeColor = changePercentage == null || changePercentage >= 0 ? styles.positiveChange : styles.negativeChange;
    const priceDisplay = typeof price === 'number' ? `₹ ${price.toFixed(1)}` : '--'; // Use single dash for N/A
    const changePercentDisplay = typeof changePercentage === 'number' ? `${changePercentage >= 0 ? '+' : ''}${changePercentage.toFixed(1)}%` : '--';

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => navigateToStockDetail(item.symbol, item.name)}
      >
        {/* Stock Info */}
        <View style={styles.stockInfoContainer}>
          {/* Placeholder Icon */}
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>{item.symbol.substring(0, 1)}</Text>
          </View>
          {/* Symbol and Name */}
          <View style={styles.nameContainer}>
            <Text style={styles.symbolText}>{item.symbol}</Text>
            <Text style={styles.nameText} numberOfLines={1}>{item.name || 'Loading...'}</Text> 
          </View>
        </View>
        
        {/* Price and Change */}
        <View style={styles.priceContainer}>
            {/* Display price/change directly */}
           <Text style={styles.priceText}>{priceDisplay}</Text>
           <Text style={[styles.changeText, changeColor]}>
               {changePercentDisplay}
           </Text>
        </View>
        
        {/* Remove Button */}
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={(e) => {
            e.stopPropagation();
            handleRemoveFromWatchlist(item.symbol);
          }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.negative} /> 
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Area within the screen */}
      <View style={styles.headerContainer}>
        {isSearching ? (
          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={20} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search symbol or name..." 
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              placeholderTextColor="#9CA3AF" 
            />
            <TouchableOpacity onPress={() => { setSearchQuery(''); setIsSearching(false); }}>
              <Ionicons name="close-outline" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.titleActionContainer}> 
             <Text style={styles.headerTitle}>Watchlist</Text>
             {/* Container for action icons */}
             <View style={styles.actionIconsContainer}>
                <TouchableOpacity style={styles.actionIcon} onPress={() => setIsSearching(true)}>
                   <Ionicons name="search-outline" size={24} color="#1F2937" />
                </TouchableOpacity>
                {/* Add the '+' button here */}
                <TouchableOpacity style={styles.actionIcon} onPress={openAddToWatchlistModal}>
                   <Ionicons name="add-circle-outline" size={26} color={colors.primary} /> 
                </TouchableOpacity>
             </View>
          </View>
        )}
      </View>

      {/* Watchlist Items List */}
      {isLoadingList ? (
        <View style={styles.centeredMessage}>
          <ActivityIndicator size="large" color={colors.primary} /> 
          <Text style={styles.emptyListText}>Loading Watchlist...</Text>
        </View>
      ) : (
        <FlatList<WatchlistItem>
          data={filteredItems}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          renderItem={renderItem}
          ListEmptyComponent={
             <View style={styles.centeredMessage}>
                <Ionicons name="list-outline" size={64} color="#E5E7EB" />
                <Text style={styles.emptyListText}>
                    {searchQuery ? `No results found for "${searchQuery}"` : 'Your watchlist is empty'}
                </Text>
                {!searchQuery && (
                    <Text style={styles.emptyListSubtext}>
                       Tap the '+' icon above to add stocks.
                    </Text>
                )}
            </View>
          }
        />
      )}

       {/* Render the modal */}
       <AddToWatchlistModal
            isVisible={isAddToWatchlistModalVisible}
            onClose={closeAddToWatchlistModal}
            onStockAdded={handleStockAdded}
        />

    </SafeAreaView>
  );
};

// Restore previous StyleSheet, then remove only the second set of duplicates
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  headerContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  titleActionContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  actionIconsContainer: { flexDirection: 'row', alignItems: 'center' },
  actionIcon: { padding: 8, marginLeft: 8 },
  searchBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#1F2937' },
  centeredMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 40 },
  emptyListText: { fontSize: 18, fontWeight: '500', color: '#6B7280', marginTop: 16, textAlign: 'center' },
  emptyListSubtext: { color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
  itemContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginBottom: 12, backgroundColor: 'white', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, borderWidth: 1, borderColor: '#E5E7EB' },
  stockInfoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  iconPlaceholder: { backgroundColor: '#E5E7EB', width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontWeight: 'bold', color: '#4B5563' },
  nameContainer: { marginLeft: 12, flex: 1 },
  symbolText: { fontWeight: '600', color: '#1F2937' },
  nameText: { color: '#6B7280', fontSize: 12 },
  priceContainer: { alignItems: 'flex-end', width: 80 }, // Keep first definition
  priceText: { fontWeight: '600', color: '#1F2937' }, // Keep first definition
  changeText: { fontSize: 12, marginTop: 2 },
  positiveChange: { color: colors.positive }, 
  negativeChange: { color: colors.negative }, 
  removeButton: { marginLeft: 12, padding: 8 }, // Keep first definition
  cardContainer: { // Keep this set from previous merge attempt
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logoContainer: { // Keep this set
    width: 40,
    height: 40,
    borderRadius: 20, 
    backgroundColor: colors.border, 
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: { // Keep this set
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textSecondary, 
  },
  infoContainer: { // Keep this set
    flex: 1,
    marginLeft: 12,
  },
  // Remove the second, redundant definitions below
  /*
  priceContainer: {
    alignItems: 'flex-end',
    width: 80,
  },
  priceText: {
    fontWeight: '600',
    color: '#1F2937',
  },
  removeButton: {
    marginLeft: 12,
    padding: 8,
  },
  */
});

export default WatchlistScreen; 