import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../navigation/MainStackNavigator'; // Adjust path if needed
import { PortfolioTransaction, getTransactionsBySymbol, deletePortfolioTransaction } from '../../src/utils/database';
import { colors } from '../../src/theme/colors'; // Import theme colors

type TransactionHistoryRouteProp = RouteProp<MainStackParamList, 'TransactionHistory'>;

const TransactionHistoryScreen = () => {
  const route = useRoute<TransactionHistoryRouteProp>();
  const navigation = useNavigation();
  
  // Safely access params, provide defaults or handle error if missing
  const symbol = route.params?.symbol;
  const companyName = route.params?.companyName;

  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  const fetchTransactions = useCallback(async () => {
    // Check if symbol is available before fetching
    if (!symbol) {
        setError("Stock symbol not provided.");
        setIsLoading(false);
        setTransactions([]);
        return;
    }
    setIsLoading(true);
    setError(null);
    console.log(`[TransactionHistoryScreen] Fetching transactions for ${symbol}...`);
    try {
      const fetchedTransactions = await getTransactionsBySymbol(symbol);
      setTransactions(fetchedTransactions);
    } catch (err: any) {
      console.error(`[TransactionHistoryScreen] Failed to fetch transactions for ${symbol}:`, err);
      setError("Could not load transaction history.");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // --- Delete Transaction Logic ---
  const handleDeleteTransaction = (transaction: PortfolioTransaction) => {
    if (!transaction.id) return; // Should always have ID from DB

    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to delete the ${transaction.type} transaction of ${transaction.quantity} shares @ ₹ ${transaction.price.toFixed(2)} on ${new Date(transaction.timestamp).toLocaleDateString()}? This will recalculate your holding.`, 
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
                console.log(`[TransactionHistoryScreen] Deleting transaction ID: ${transaction.id}`);
                await deletePortfolioTransaction(transaction.id!);
                Alert.alert("Success", "Transaction deleted and holding recalculated.");
                fetchTransactions(); // Refresh the list on this screen
                // PortfolioScreen will refresh via useFocusEffect when navigated back to
            } catch (err: any) {
                 console.error(`[TransactionHistoryScreen] Failed to delete transaction ${transaction.id}:`, err);
                Alert.alert("Error", `Could not delete transaction. ${err.message || ''}`);
            }
          }
        }
      ]
    );
  };

  // --- Render Logic ---
  const renderTransactionItem = ({ item }: { item: PortfolioTransaction }) => {
    // Check if ID exists before rendering delete button
    const canDelete = item.id !== undefined && item.id !== null;
    return (
        <View style={styles.transactionItemContainer}>
            <View style={styles.transactionDetails}>
                <View style={styles.row}>
                    <Text style={[styles.typeText, item.type === 'BUY' ? styles.buyText : styles.sellText]}>{item.type}</Text>
                    <Text style={styles.dateText}>{new Date(item.timestamp).toLocaleDateString()}</Text>
                </View>
                 <View style={styles.row}>
                     <Text style={styles.detailLabel}>Quantity:</Text>
                     <Text style={styles.detailValue}>{String(item.quantity?.toLocaleString() ?? 'N/A')}</Text>
                 </View>
                 <View style={styles.row}>
                     <Text style={styles.detailLabel}>Price:</Text>
                     <Text style={styles.detailValue}>₹ {String(item.price?.toFixed(2) ?? 'N/A')}</Text>
                </View>
            </View>
            {canDelete && (
                <TouchableOpacity onPress={() => handleDeleteTransaction(item)} style={styles.deleteButton}>
                     <Ionicons name="trash-outline" size={20} color={colors.negative} />
                </TouchableOpacity>
            )}
        </View>
    );
  };

  // Add check for symbol at the top level render
  if (!symbol) {
      return (
          <SafeAreaView style={styles.container}>
             <View style={styles.centered}>
                 <Text style={styles.errorText}>Error: Stock symbol is missing.</Text>
                 <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retryButton}>
                     <Text style={styles.retryButtonText}>Go Back</Text>
                 </TouchableOpacity>
             </View>
          </SafeAreaView>
      );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */} 
      <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{symbol ? `${symbol} Transactions` : 'Transactions'}</Text>
              {companyName ? <Text style={styles.headerSubtitle}>{companyName}</Text> : null}
          </View>
           <View style={{ width: 40 }} /> {/* Spacer */} 
      </View>

      {/* Content Area */} 
      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.negative} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchTransactions} style={styles.retryButton}>
                 <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.centered}>
            <Ionicons name="receipt-outline" size={48} color={colors.border} />
            <Text style={styles.emptyText}>No transaction history found for {symbol || 'this stock'}.</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransactionItem}
          keyExtractor={(item: PortfolioTransaction) => item.id!.toString()}
          contentContainerStyle={styles.listContentContainer}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB', // Light gray background
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 5,
        marginRight: 10,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#6B7280',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: colors.negative,
        textAlign: 'center',
        marginBottom: 15,
    },
     retryButton: {
        backgroundColor: colors.primary + '1A',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 6,
     },
     retryButtonText: {
        color: colors.primary,
        fontWeight: '500',
     },
    emptyText: {
        marginTop: 15,
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    listContentContainer: {
        padding: 15,
    },
    transactionItemContainer: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1, // For Android
    },
    transactionDetails: {
        flex: 1,
        marginRight: 10,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    typeText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    buyText: {
        color: colors.positive,
        fontWeight: '500',
    },
    sellText: {
        color: colors.negative,
        fontWeight: '500',
    },
    dateText: {
        fontSize: 12,
        color: '#6B7280',
    },
    detailLabel: {
        fontSize: 13,
        color: '#4B5563',
    },
    detailValue: {
        fontSize: 13,
        color: '#1F2937',
        fontWeight: '500',
    },
    deleteButton: {
        padding: 8,
        backgroundColor: '#FEE2E2', // Light red background
        borderRadius: 6,
    },
    separator: {
        height: 10,
    },
});

export default TransactionHistoryScreen; 