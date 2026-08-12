import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PortfolioTransaction, getTransactionsBySymbol } from '../../src/utils/database';
import { colors } from '../../src/theme/colors';

interface TransactionHistoryModalProps {
  isVisible: boolean;
  onClose: () => void;
  onEditRequest: (transaction: PortfolioTransaction) => void; 
  symbol: string;
  companyName?: string;
}

const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
  isVisible,
  onClose,
  onEditRequest,
  symbol,
  companyName,
}) => {
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
     if (!isVisible || !symbol) return;
     setIsLoading(true);
     setError(null);
     console.log(`[TransactionHistoryModal] Fetching transactions for symbol: ${symbol}`); 
     try {
       const fetchedTransactions = await getTransactionsBySymbol(symbol);
       console.log(`[TransactionHistoryModal] Fetched ${fetchedTransactions.length} transactions:`, fetchedTransactions);
       setTransactions(fetchedTransactions);
     } catch (err: any) {
       console.error(`[TransactionHistoryModal] Failed to fetch transactions for ${symbol}:`, err);
       setError("Could not load transaction history.");
       setTransactions([]);
     } finally {
       setIsLoading(false);
     }
  }, [symbol, isVisible]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const renderTransactionItem = ({ item }: { item: PortfolioTransaction }) => (
    <View style={styles.transactionItemContainer}>
        <View style={styles.transactionDetails}>
             <View style={styles.row}>
                <Text style={[styles.typeText, item.type === 'BUY' ? styles.buyText : styles.sellText]}>{item.type}</Text>
                <Text style={styles.dateText}>{new Date(item.timestamp).toLocaleDateString()}</Text>
            </View>
             <View style={styles.row}>
                 <Text style={styles.detailLabel}>Qty:</Text>
                 <Text style={styles.detailValue}>{item.quantity.toLocaleString()}</Text>
             </View>
             <View style={styles.row}>
                 <Text style={styles.detailLabel}>Price:</Text>
                 <Text style={styles.detailValue}>₹ {item.price.toFixed(2)}</Text>
            </View>
        </View>
        <TouchableOpacity onPress={() => onEditRequest(item)} style={styles.editButton}>
             <Ionicons name="pencil" size={20} color={colors.primary} />
        </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}> 
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleContainer}>
                <Text style={styles.modalTitle}>{symbol} History</Text>
                {companyName && <Text style={styles.headerSubtitle}>{companyName}</Text>}
            </View>
             <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={30} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.listContainer}>
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
                  <Text style={styles.emptyText}>No transaction history found.</Text>
              </View>
            ) : (
              <FlatList
                data={transactions}
                renderItem={renderTransactionItem}
                keyExtractor={(item: PortfolioTransaction) => item.id!.toString()}
                ItemSeparatorComponent={() => <View style={styles.separator} />} 
                contentContainerStyle={{ paddingBottom: 20 }} // Removed flexGrow, rely on listContainer height
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 0, 
        paddingTop: 15,
        paddingBottom: 20,
        maxHeight: '75%', 
        flexShrink: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20, 
        marginBottom: 15,
    },
    headerTitleContainer: {
       flex: 1,
       marginRight: 10, 
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    closeButton: {
        padding: 5,
    },
    listContainer: {
        // Use fixed height that worked before
        height: 300, 
        paddingHorizontal: 20, 
    },
    centered: {
        // Make centered content take full container height if possible
        flexGrow: 1, 
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
    transactionItemContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    transactionDetails: {
        flex: 1,
        marginRight: 8,
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
        textTransform: 'uppercase',
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
        fontSize: 12,
        color: '#4B5563',
    },
    detailValue: {
        fontSize: 12,
        color: '#1F2937',
        fontWeight: '500',
    },
    separator: {
        height: 10,
    },
    editButton: {
        padding: 8,
    },
});

export default TransactionHistoryModal; 