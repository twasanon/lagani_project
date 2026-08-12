import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, SectionList, ListRenderItemInfo, ActivityIndicator, Alert, StyleSheet 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import AddStockHoldingModal from '../components/AddStockHoldingModal';
import SellStockModal from '../components/SellStockModal';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import EditTransactionModal from '../components/EditTransactionModal';
import { 
    getAllTransactionsForHeldSymbols,
    getPricesBySymbols, 
    getPortfolioHoldingBySymbol,
    PortfolioTransaction,
    PriceStatItem, 
    PortfolioHolding,
    deletePortfolioTransaction
} from '../../src/utils/database';
import SkeletonPlaceholder from '../components/SkeletonPlaceholder';
import { colors } from '../../src/theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from 'react-reusables/components/ui/card';

interface PortfolioLotDisplay extends PortfolioTransaction {
  companyName?: string;
  currentPrice?: number | null;
  marketValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  isPositive: boolean;
}

interface PortfolioSection {
  symbol: string;
  companyName?: string;
  currentPrice?: number | null;
  percentageChange?: number | null;
  totalHoldingData?: PortfolioHolding | null;
  data: PortfolioLotDisplay[];
}

type PortfolioScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AppTabs'>;

const PortfolioScreen = () => {
  const navigation = useNavigation<PortfolioScreenNavigationProp>();
  const [portfolioSections, setPortfolioSections] = useState<PortfolioSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isSellModalVisible, setIsSellModalVisible] = useState(false);
  const [selectedHoldingForSell, setSelectedHoldingForSell] = useState<PortfolioHolding | null>(null);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [selectedSymbolForHistory, setSelectedSymbolForHistory] = useState<string | null>(null);
  const [selectedCompanyNameForHistory, setSelectedCompanyNameForHistory] = useState<string | undefined>(undefined);
  const [isEditTransactionModalVisible, setIsEditTransactionModalVisible] = useState(false);
  const [selectedTransactionToEdit, setSelectedTransactionToEdit] = useState<PortfolioTransaction | null>(null);

  const [calculatedSummary, setCalculatedSummary] = useState({
    totalValue: 0,
    totalInvestment: 0,
    totalProfitLoss: 0,
    totalProfitLossPercentage: 0,
    isPositive: true,
  });

  const fetchPortfolioData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log('[PortfolioScreen] Fetching portfolio transactions (BUY/SELL)...');
    try {
      // 1. Get all transactions (BUY/SELL) for currently held symbols
      const allTransactions = await getAllTransactionsForHeldSymbols();
      if (allTransactions.length === 0) {
        setPortfolioSections([]);
        calculateAndSetSummary([]);
        setIsLoading(false);
        return;
      }

      // 2. Get unique symbols and their current prices
      const uniqueSymbols = [...new Set(allTransactions.map(tx => tx.symbol))];
      const prices = await getPricesBySymbols(uniqueSymbols);
      
      // 3. Fetch total holding data for each symbol (for Sell modal & Company Name)
      const totalHoldingsMap: Record<string, PortfolioHolding | null> = {};
      for (const symbol of uniqueSymbols) {
        totalHoldingsMap[symbol] = await getPortfolioHoldingBySymbol(symbol);
      }

      // 4. Group ALL transactions by symbol and enrich with market data
      const groupedBySymbol: Record<string, PortfolioLotDisplay[]> = {};
      allTransactions.forEach((tx: PortfolioTransaction) => {
        if (!groupedBySymbol[tx.symbol]) {
          groupedBySymbol[tx.symbol] = [];
        }
        const currentPriceData = prices[tx.symbol];
        const currentPrice = currentPriceData?.lastTradedPrice;
        
        // For P/L display on SELL, we might compare sell price to average cost at time of sale,
        // or simply display the sell record differently. For now, keep P/L based on current price.
        const valueAtTransactionTime = tx.quantity * tx.price;
        const marketValue = tx.quantity * (currentPrice ?? tx.price); // Current value based on current price
        
        // P/L shown for SELL will be based on current market value vs sell price, 
        // which isn't standard P/L. Let's mark SELL differently for now.
        const profitLoss = tx.type === 'BUY' ? marketValue - valueAtTransactionTime : 0; // Simplified P/L for now
        const profitLossPercentage = tx.type === 'BUY' && valueAtTransactionTime > 0 ? (profitLoss / valueAtTransactionTime) * 100 : 0;

        groupedBySymbol[tx.symbol].push({
          ...tx,
          companyName: totalHoldingsMap[tx.symbol]?.companyName,
          currentPrice: currentPrice,
          marketValue: marketValue,
          profitLoss: profitLoss,
          profitLossPercentage: profitLossPercentage,
          isPositive: profitLoss >= 0,
        });
      });

      // 5. Convert grouped data into sections for SectionList
      const sections: PortfolioSection[] = uniqueSymbols.map(symbol => {
        const currentPriceData = prices[symbol];
        const currentPrice = currentPriceData?.lastTradedPrice;
        const percentageChange = currentPriceData?.percentageChange;
        return {
          symbol: symbol,
          companyName: totalHoldingsMap[symbol]?.companyName,
          currentPrice: currentPrice,
          percentageChange: percentageChange,
          totalHoldingData: totalHoldingsMap[symbol],
          data: groupedBySymbol[symbol] || [],
        };
      }).sort((a, b) => a.symbol.localeCompare(b.symbol));

      setPortfolioSections(sections);
      // Calculate summary ONLY from BUY lots for total investment
      const buyLots = allTransactions.filter(tx => tx.type === 'BUY').map(tx => groupedBySymbol[tx.symbol]?.find(lot => lot.id === tx.id)).filter(lot => lot !== undefined) as PortfolioLotDisplay[];
      calculateAndSetSummary(buyLots);
      console.log(`[PortfolioScreen] Portfolio loaded with ${sections.length} symbols.`);

    } catch (err: any) {
      console.error("[PortfolioScreen] Failed to fetch portfolio transactions:", err);
      setError("Could not load portfolio data. Please try again.");
      setPortfolioSections([]);
      calculateAndSetSummary([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const calculateAndSetSummary = (lots: PortfolioLotDisplay[]) => {
    let totalValue = 0;
    let totalInvestment = 0;

    lots.forEach(lot => {
      totalValue += lot.marketValue;
      totalInvestment += lot.quantity * lot.price; // Cost basis is per lot
    });

    const totalProfitLoss = totalValue - totalInvestment;
    const totalProfitLossPercentage = totalInvestment > 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;
    const isPositive = totalProfitLoss >= 0;

    setCalculatedSummary({ totalValue, totalInvestment, totalProfitLoss, totalProfitLossPercentage, isPositive });
    console.log('[PortfolioScreen] Summary Calculated:', { totalValue, totalInvestment });
  };

  useFocusEffect(
    useCallback(() => {
      fetchPortfolioData();
    }, [fetchPortfolioData])
  );

  const handleDeleteLot = (transaction: PortfolioTransaction) => {
    if (!transaction.id) return;

    Alert.alert(
        "Confirm Deletion",
        `Delete purchase of ${transaction.quantity} ${transaction.symbol} shares @ Rs. ${transaction.price.toFixed(2)}? This will update your overall holding.`, 
        [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        console.log(`[PortfolioScreen] Deleting transaction ID: ${transaction.id}`);
                        await deletePortfolioTransaction(transaction.id!);
                        Alert.alert("Success", "Purchase record deleted.");
                        fetchPortfolioData(); // Refresh the portfolio
                    } catch (err: any) {
                         console.error(`[PortfolioScreen] Failed to delete transaction ${transaction.id}:`, err);
                        Alert.alert("Error", `Could not delete record. ${err.message || ''}`);
                    }
                }
            }
        ]
    );
  };

  const openAddModal = () => setIsAddModalVisible(true);
  const closeAddModal = () => setIsAddModalVisible(false);

  const openSellModal = (holdingData: PortfolioHolding | null | undefined) => {
    console.log("[PortfolioScreen] openSellModal called. Holding data:", holdingData);
    if (holdingData && holdingData.quantity > 0) {
        setSelectedHoldingForSell(holdingData);
        setIsSellModalVisible(true);
        console.log("[PortfolioScreen] Set isSellModalVisible to true");
    } else {
        console.log("[PortfolioScreen] Sell modal not opened. Reason: Invalid holding data or zero quantity.");
        Alert.alert("Cannot Sell", "No holding data found or quantity is zero.");
    }
  };
  const closeSellModal = () => {
    setIsSellModalVisible(false);
    setSelectedHoldingForSell(null);
  };

  const openHistoryModal = (symbol: string, companyName?: string) => {
    console.log(`[PortfolioScreen] Navigating to TransactionHistory. Symbol: ${symbol}, Name: ${companyName}`);
    navigation.navigate('TransactionHistory', { symbol, companyName });
  };

  const openEditTransactionModal = (transaction: PortfolioTransaction) => {
    setSelectedTransactionToEdit(transaction);
    setIsEditTransactionModalVisible(true);
  };

  const closeEditTransactionModal = () => {
    setIsEditTransactionModalVisible(false);
    setSelectedTransactionToEdit(null);
  };

  const handleTransactionComplete = () => {
    console.log("[PortfolioScreen] Transaction complete, refreshing portfolio...");
    fetchPortfolioData();
    closeEditTransactionModal();
    closeSellModal();
    closeAddModal();
  };

  const keyExtractor = (item: PortfolioLotDisplay, index: number) => `lot-${item.id}-${index}`;

  const renderLoadingState = () => (
    <View className="p-4">
        {/* Skeleton for Summary Card */}
        <View className="bg-white rounded-xl shadow-md p-4 mb-4 border border-gray-200">
            <SkeletonPlaceholder width={120} height={14} style={{ marginBottom: 8 }} />
            <SkeletonPlaceholder width={200} height={28} style={{ marginBottom: 12 }} />
            <View className="flex-row justify-between items-center pt-3 border-t border-gray-100">
                <View className="items-start">
                    <SkeletonPlaceholder width={80} height={12} style={{ marginBottom: 4 }} />
                    <SkeletonPlaceholder width={100} height={14} />
                </View>
                <View className="items-end">
                    <SkeletonPlaceholder width={80} height={12} style={{ marginBottom: 4 }} />
                    <SkeletonPlaceholder width={120} height={14} />
                </View>
            </View>
        </View>

        {/* Skeleton for List Items (show a few) */}
        {[1, 2, 3].map((key) => (
            <View key={key} className="bg-white rounded-xl shadow-sm mb-3 border border-gray-200 overflow-hidden">
                {/* Header Skeleton */}
                <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
                    <View className="flex-1 mr-4">
                        <SkeletonPlaceholder width={80} height={20} style={{ marginBottom: 4 }} />
                        <SkeletonPlaceholder width={150} height={12} />
                    </View>
                     <View className="flex-row">
                         <SkeletonPlaceholder width={50} height={24} borderRadius={6} style={{ marginRight: 8 }}/>
                         <SkeletonPlaceholder width={50} height={24} borderRadius={6} />
                    </View>
                </View>
                {/* Item Skeleton */}
                <View className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-row items-center">
                    <View className="flex-1 mr-2">
                        <SkeletonPlaceholder width={100} height={12} style={{ marginBottom: 12 }}/>
                        <View className="flex-row justify-between items-center">
                            <SkeletonPlaceholder width={50} height={20} />
                            <SkeletonPlaceholder width={60} height={20} />
                            <SkeletonPlaceholder width={70} height={20} />
                            <SkeletonPlaceholder width={60} height={20} />
                        </View>
                    </View>
                    <SkeletonPlaceholder width={24} height={24} borderRadius={4} />
                </View>
            </View>
        ))}
    </View>
    );

  const renderSectionHeader = ({ section }: { section: PortfolioSection }) => {
    const price = section.currentPrice;
    const changePercent = section.percentageChange;
    const priceColor = changePercent == null ? 'text-textSecondary' : changePercent >= 0 ? 'text-positive' : 'text-negative';
    const changeDisplay = typeof changePercent === 'number' ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '--%';

    return (
      <Card className="mx-4 mb-3 rounded-xl shadow-md overflow-hidden border border-border bg-background">
        <TouchableOpacity 
          className="flex-row justify-between items-center p-4 border-b border-border active:opacity-90 transition-opacity duration-150"
          onPress={() => openHistoryModal(section.symbol, section.companyName)}
          activeOpacity={1}
        >
          <View className="flex-1 mr-2">
            <Text className="text-base font-semibold text-text">{section.symbol}</Text>
            <Text className="text-xs text-textSecondary" numberOfLines={1}>{section.companyName ?? 'Loading...'}</Text>
          </View>
          
          <View className="items-end mr-3">
              <Text className={`text-base font-medium ${priceColor}`}>Rs. {price != null ? price.toFixed(2) : '--'}</Text>
              <Text className={`text-xs ${priceColor}`}>{changeDisplay}</Text>
          </View>

          <View className="flex-row items-center">
              <TouchableOpacity 
                  onPress={(e) => { e.stopPropagation(); openHistoryModal(section.symbol, section.companyName); }}
                  className="p-2 mr-2"
              >
                  <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              </TouchableOpacity>

              {section.totalHoldingData && section.totalHoldingData.quantity > 0 && (
                 <TouchableOpacity 
                    onPress={(e) => { e.stopPropagation(); openSellModal(section.totalHoldingData); }} 
                    className="bg-negative px-3 py-1 rounded-full"
                  >
                     <Text className="text-white text-xs font-medium">Sell</Text>
                 </TouchableOpacity>
              )}
          </View>
        </TouchableOpacity>

        <CardContent className="p-0">
          {section.data.map((item, index) => {
            const isSell = item.type === 'SELL';
            const isLastItem = index === section.data.length - 1;

            return (
              <View 
                key={`lot-${item.id}-${index}`} 
                className={`flex-row items-center px-4 py-3 ${!isLastItem ? 'border-b border-border' : ''} ${isSell ? 'bg-negative bg-opacity-5' : ''}`}
              >
                <View className="flex-1 mr-2">
                    <Text className="text-xs text-textSecondary">
                        {new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {isSell ? ' (Sold)' : ' (Purchased)'}
                    </Text>
                    <View className="flex-row justify-between items-baseline mt-0.5">
                        <Text className="text-sm text-text">{item.quantity} shares @ Rs. {item.price.toFixed(2)}</Text>
                        {!isSell && item.currentPrice !== null && (
                            <View className="items-end">
                                <Text className="text-xs text-textSecondary">Value: {item.marketValue.toFixed(2)}</Text>
                                {item.profitLoss !== null && (
                                    <Text className={`text-xs font-medium ${item.profitLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                                        {item.profitLoss >= 0 ? '+' : ''}{item.profitLoss.toFixed(2)}
                                    </Text>
                                )}
                            </View>
                        )}
                        {isSell && (
                            <Text className="text-sm text-negative font-medium">Total: {(item.quantity * item.price).toFixed(2)}</Text>
                        )}
                    </View>
                </View>
                
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => handleDeleteLot(item)} className="p-2 ml-1">
                        <Ionicons name="trash-outline" size={20} color={colors.negative} />
                    </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
        {/* Modify Header */}
        <View className="px-4 pt-3 pb-3 flex-row justify-end items-center">
             {/* Modify Add Stock Button to be a circular + icon */}
             <TouchableOpacity 
                onPress={openAddModal} 
                className="h-8 w-8 bg-primary rounded-full items-center justify-center shadow"
             > 
                {/* Use Ionicons for the plus icon */}
                <Ionicons name="add" size={22} color="white" /> 
             </TouchableOpacity>
        </View>
        
        {/* Conditional Rendering */}
        {isLoading ? renderLoadingState() : (
            <> 
                <Card 
                  className="rounded-3xl mx-4 mb-4 bg-emerald-200"
                  style={{ borderWidth: 0 }}
                >
                     <CardHeader className="pb-2"> 
                         <CardTitle className="text-xl font-semibold text-emerald-700">Total Portfolio Value</CardTitle> 
                     </CardHeader>
                     <CardContent className="pt-0"> 
                         {calculatedSummary ? (
                             <>
                                 <Text className="text-4xl font-bold text-emerald-700 mb-4"> 
                                     Rs. {calculatedSummary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                 </Text>
                                 <View className="flex-row border-t border-gray-300 pt-3"> 
                                     <DetailItem label="Investment" value={calculatedSummary.totalInvestment.toFixed(2)} />
                                     <DetailItem label="Overall P/L" value={calculatedSummary.totalProfitLoss.toFixed(2)} isProfit={calculatedSummary.isPositive} />
                                     <DetailItem label="P/L %" value={calculatedSummary.totalProfitLossPercentage.toFixed(2)} isProfit={calculatedSummary.isPositive} />
                                 </View>
                             </>
                         ) : (
                             <Text className="text-textSecondary mt-1">Data unavailable.</Text>
                         )}
                      </CardContent>
                  </Card>

                <View className="flex-1 mt-4">
                   {error ? (
                       <View style={styles.centered} className="flex-1 bg-background p-4">
                            <Ionicons name="warning-outline" size={48} color={colors.negative} />
                            <Text className="text-negative text-center mb-3 font-semibold mt-2">Error Loading Portfolio</Text>
                            <Text className="text-textSecondary text-center mb-4">{error}</Text>
                            <TouchableOpacity onPress={fetchPortfolioData} className="bg-primary bg-opacity-10 px-4 py-2 rounded-md">
                                <Text className="text-primary font-medium">Retry</Text>
          </TouchableOpacity>
                         </View>
                   ) : portfolioSections.length === 0 ? (
                       <View className="flex-1 justify-center items-center p-4">
                            <Ionicons name="briefcase-outline" size={48} color={colors.border} />
                            <Text className="text-gray-500 mt-4 text-center">Your portfolio is empty.</Text>
                            <Text className="text-gray-400 mt-1 text-center text-xs">Tap 'Add Stock' to add your first holding.</Text>
      </View>
                   ) : (
                       <SectionList
                           sections={portfolioSections}
                           keyExtractor={keyExtractor}
                           renderItem={() => null}
                           renderSectionHeader={renderSectionHeader}
                           stickySectionHeadersEnabled={false}
                           contentContainerStyle={{ paddingBottom: 20, paddingTop: 16 }}
                       />
                   )}
               </View> 
            </> 
        )}

        {/* Keep Modals (they only render when visible) */}
         <AddStockHoldingModal
            isVisible={isAddModalVisible}
            onClose={closeAddModal}
            onTransactionAdded={handleTransactionComplete}
        />
         {selectedHoldingForSell && (
              <SellStockModal
                  isVisible={isSellModalVisible}
                  onClose={closeSellModal}
                  onTransactionComplete={handleTransactionComplete}
                  symbol={selectedHoldingForSell.symbol}
                  companyName={selectedHoldingForSell.companyName}
                  currentQuantity={selectedHoldingForSell.quantity}
              />
        )}
         {selectedTransactionToEdit && (
             <EditTransactionModal
                  isVisible={isEditTransactionModalVisible}
                  onClose={closeEditTransactionModal}
                  onTransactionComplete={handleTransactionComplete}
                  transaction={selectedTransactionToEdit}
             />
        )}
    </SafeAreaView>
  );
};

const DetailItem = ({ label, value, isProfit }: { label: string, value: string | number, isProfit?: boolean }) => {
    const valueColor = isProfit === undefined ? 'text-emerald-700' : isProfit ? 'text-positive' : 'text-negative';
    const sign = isProfit === undefined ? '' : isProfit ? '+' : '';

    return (
        <View className="items-center flex-1 px-1">
            <Text className="text-xs text-textSecondary uppercase tracking-wider mb-1">{label}</Text>
            <Text
              className={`font-medium text-sm ${valueColor}`}
              numberOfLines={1}
            >
              {sign}{value}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});

export default PortfolioScreen; 