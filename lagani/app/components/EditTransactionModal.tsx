import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PortfolioTransaction, updatePortfolioTransaction } from '../../src/utils/database';

interface EditTransactionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onTransactionComplete: () => void;
  transaction: PortfolioTransaction | null; // The transaction to edit
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isVisible,
  onClose,
  onTransactionComplete,
  transaction,
}) => {
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form when the transaction prop changes (modal opens)
  useEffect(() => {
    if (transaction) {
      setQuantity(String(transaction.quantity));
      setPrice(String(transaction.price));
      setError(null); // Clear previous errors
    } else {
        // Reset form if transaction becomes null (e.g., modal closed incorrectly)
        setQuantity('');
        setPrice('');
        setError(null);
    }
  }, [transaction]);

  const handleSaveChanges = async () => {
    if (!transaction || !transaction.id) {
      Alert.alert("Error", "Cannot save changes. No transaction selected.");
      return;
    }

    const numQuantity = parseFloat(quantity);
    const numPrice = parseFloat(price);

    // Basic validation
    if (isNaN(numQuantity) || numQuantity <= 0 || isNaN(numPrice) || numPrice < 0) {
      setError("Please enter valid positive numbers for quantity and price.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await updatePortfolioTransaction(transaction.id, numQuantity, numPrice);
      Alert.alert("Success", "Transaction updated successfully.");
      onTransactionComplete(); // Trigger refresh and close
      // Optionally close here, or rely on parent closing via onTransactionComplete
      // onClose(); 
    } catch (err: any) {
      console.error("[EditTransactionModal] Failed to update transaction:", err);
      setError(`Failed to update: ${err.message || 'Unknown error'}`);
      Alert.alert("Update Failed", `Could not update transaction. ${err.message || ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!transaction) {
    // Should not happen if modal is controlled correctly, but handles edge case
    return null; 
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}> 
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {transaction.type} Transaction</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close-circle" size={30} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Form Content */}
            <View style={styles.contentContainer}>
                <Text style={styles.symbolText}>{transaction.symbol}</Text>
                <Text style={styles.dateText}>Original Date: {new Date(transaction.timestamp).toLocaleDateString()}</Text>

                {/* Quantity Input */}
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="e.g., 100"
                    keyboardType="numeric"
                    returnKeyType="next"
                    // onSubmitEditing={() => priceInputRef.current?.focus()} // Add ref if needed
                />

                {/* Price Input */}
                <Text style={styles.label}>Price per Share (Rs.)</Text>
                <TextInput
                    style={styles.input}
                    value={price}
                    onChangeText={setPrice}
                    placeholder="e.g., 250.50"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    // ref={priceInputRef} // Add ref if needed
                    onSubmitEditing={handleSaveChanges}
                />

                {/* Error Message */}
                {error && <Text style={styles.errorText}>{error}</Text>}

                {/* Submit Button */}
                <TouchableOpacity 
                    style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                    onPress={handleSaveChanges}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.submitButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
       </KeyboardAvoidingView>
    </Modal>
  );
};

// Styles (borrowing from other modals)
const styles = StyleSheet.create({
    keyboardAvoidingView: {
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 30, // Ensure space for button
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
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        flex: 1, // Allow title to take space
        marginRight: 10,
    },
    closeButton: {
        padding: 5,
    },
    contentContainer: {
        // Container for form elements
    },
    symbolText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 4,
        textAlign: 'center',
    },
    dateText: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 15,
        textAlign: 'center',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151', // Keep existing color for labels for now
        marginBottom: 6,
    },
    inputGroup: { // Define inputGroup style
        marginBottom: 15,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        fontSize: 16,
    },
    errorText: {
        color: '#EF4444',
        textAlign: 'center',
        marginBottom: 10,
        fontSize: 13,
    },
    submitButton: {
        backgroundColor: '#4F46E5', // Indigo
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    submitButtonDisabled: {
        backgroundColor: '#A5B4FC', // Lighter indigo
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default EditTransactionModal;
