import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getActivePriceAlerts, deletePriceAlert, PriceAlert } from '../../src/utils/database'; // Adjust path as needed
import { colors } from '../../src/theme/colors';

interface PriceAlertsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const PriceAlertItem = ({ item, onDelete }: { item: PriceAlert; onDelete: (id: number) => void }) => {
  const handleDelete = () => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete the alert for ${item.symbol} at ${item.targetPrice}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            if (item.id) {
               onDelete(item.id);
            } else {
                console.error("Attempted to delete alert without ID:", item);
                Alert.alert("Error", "Could not delete alert: Missing ID.");
            }
           }
        },
      ]
    );
  };

  return (
    <View className="flex-row justify-between items-center p-4 mb-2 bg-card border border-border rounded-lg">
      <View className="flex-1 mr-2">
        <Text className="text-base font-semibold text-text">{item.symbol}</Text>
        <Text className="text-sm text-textSecondary">
          Notify when price is {item.condition.toLowerCase()} {item.targetPrice}
        </Text>
        <Text className="text-xs text-textSecondary mt-1">
           Created: {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
      <TouchableOpacity onPress={handleDelete} className="p-2">
        <Ionicons name="trash-outline" size={24} color={colors.negative} />
      </TouchableOpacity>
    </View>
  );
};

const PriceAlertsModal: React.FC<PriceAlertsModalProps> = ({ isVisible, onClose }) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadAlerts = useCallback(async () => {
    if (!isVisible) return; // Don't load if modal is not visible
    console.log("[PriceAlertsModal] Loading active alerts...");
    setIsLoading(true);
    try {
      const activeAlerts = await getActivePriceAlerts();
      setAlerts(activeAlerts);
      console.log(`[PriceAlertsModal] Loaded ${activeAlerts.length} active alerts.`);
    } catch (error) {
      console.error("[PriceAlertsModal] Failed to load alerts:", error);
      Alert.alert("Error", "Could not load price alerts.");
    } finally {
      setIsLoading(false);
    }
  }, [isVisible]);

  // Load alerts when the modal becomes visible
  useEffect(() => {
    if (isVisible) {
      loadAlerts();
    }
  }, [isVisible, loadAlerts]);

  const handleDeleteAlert = async (id: number) => {
     console.log(`[PriceAlertsModal] Attempting to delete alert ID: ${id}`);
     try {
        await deletePriceAlert(id);
        Alert.alert("Success", "Alert deleted successfully.");
        // Refresh the list after deletion
        loadAlerts(); 
     } catch (error) {
        console.error(`[PriceAlertsModal] Failed to delete alert ${id}:`, error);
        Alert.alert("Error", "Could not delete the alert.");
     }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <SafeAreaView style={styles.modalContentContainer}>
              <View style={styles.headerContainer}>
                <Text style={styles.headerText}>Active Price Alerts</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
        
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  data={alerts}
                  renderItem={({ item }: { item: PriceAlert }) => (
                    <PriceAlertItem item={item} onDelete={handleDeleteAlert} />
                  )}
                  keyExtractor={(item: PriceAlert) => item.id?.toString() ?? Math.random().toString()}
                  style={styles.listStyle}
                  contentContainerStyle={styles.listContentContainer}
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No active price alerts found.</Text>
                    </View>
                  )}
                />
              )}
            </SafeAreaView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContentContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    maxHeight: '80%',
    minHeight: '40%',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    fontSize: 20, 
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 150,
  },
  listStyle: {
      // Add any specific styles for the FlatList itself if needed
  },
  listContentContainer: {
    padding: 16, 
  },
   emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40, 
    paddingBottom: 40,
  },
  emptyText: {
    color: colors.textSecondary,
  },
});

export default PriceAlertsModal; 