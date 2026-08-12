import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addPortfolioTransactionAndUpdateHolding } from '../../src/utils/database';
import { colors } from '../../src/theme/colors'; // Import theme colors

interface SellStockModalProps {
  isVisible: boolean;
  onClose: () => void;
  onTransactionComplete: () => void; // Callback after successful transaction
  symbol: string;
  companyName?: string;
  currentQuantity: number;
}

const SellStockModal: React.FC<SellStockModalProps> = ({ 
    isVisible, 
    onClose, 
    onTransactionComplete, 
    symbol, 
    companyName,
    currentQuantity 
}) => {
  // Transaction Details State
  const [sellQuantity, setSellQuantity] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset form when modal becomes visible or props change
  useEffect(() => {
    if (isVisible) {
      setSellQuantity('');
      setSellPrice('');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isVisible, symbol]); // Reset if symbol changes too (though unlikely in modal context)

  // --- Submit Sell Transaction --- 
  const handleSubmitSell = async () => {
    setErrorMsg(null);
    Keyboard.dismiss();

    if (!sellQuantity || !sellPrice) {
      setErrorMsg("Please enter quantity and price.");
      return;
    }

    const parsedQuantity = parseFloat(sellQuantity);
    const parsedPrice = parseFloat(sellPrice);

    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        setErrorMsg("Please enter a valid positive quantity.");
        return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
       setErrorMsg("Please enter a valid positive price.");
       return;
    }

    if (parsedQuantity > currentQuantity) {
      setErrorMsg(`Cannot sell ${parsedQuantity} shares. You only own ${currentQuantity}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addPortfolioTransactionAndUpdateHolding({
        symbol: symbol,
        type: 'SELL',
        quantity: parsedQuantity,
        price: parsedPrice,
      });
      Alert.alert("Success", `Successfully recorded sale of ${parsedQuantity} shares of ${symbol} at ₹ ${parsedPrice.toFixed(2)}.`);
      onTransactionComplete(); // Trigger callback to update source screen
      onClose(); // Close modal after success
    } catch (error: any) {
      console.error("[SellStockModal] Failed to add SELL transaction:", error);
      // The DB function might throw specific errors (like trying to sell more than owned)
      // which could be caught here, but we also have frontend validation.
      setErrorMsg(`Error: ${error.message || 'Could not record sale.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
         behavior={Platform.OS === "ios" ? "padding" : "height"} 
         style={styles.keyboardAvoidingContainer}
      >
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}> 
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sell {symbol}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close-circle" size={30} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Form Content */} 
            <View style={styles.formContentContainer}> 
              {companyName && <Text style={styles.companyNameText}>{companyName}</Text>}
              <Text style={styles.currentHoldingText}>Currently holding: {currentQuantity} shares</Text>
            
              {/* Sell Quantity Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Quantity to Sell</Text>
                <TextInput
                  style={[styles.input, errorMsg?.includes('quantity') && styles.inputError ]}
                  placeholder={`Max ${currentQuantity}`}
                  placeholderTextColor={colors.textSecondary}
                  value={sellQuantity}
                  onChangeText={setSellQuantity}
                  keyboardType="numeric"
                  editable={!isSubmitting}
                  autoFocus={true} // Focus quantity first
                />
              </View>

              {/* Sell Price Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Price per Share (₹)</Text>
                <TextInput
                  style={[styles.input, errorMsg?.includes('price') && styles.inputError ]}
                  placeholder="e.g., 600.00"
                  placeholderTextColor={colors.textSecondary}
                  value={sellPrice}
                  onChangeText={setSellPrice}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
              </View>

               {/* Error Message Display */}
               {errorMsg && (
                  <Text style={styles.errorText}>{errorMsg}</Text>
               )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, (isSubmitting || !sellQuantity || !sellPrice) && styles.submitButtonDisabled]}
                onPress={handleSubmitSell}
                disabled={isSubmitting || !sellQuantity || !sellPrice}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Confirm Sale</Text>
                )}
              </TouchableOpacity>
            </View> 

          </Pressable>
        </Pressable>
       </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
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
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  formContentContainer: {
      paddingBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15, // Reduced margin
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
   companyNameText: {
      fontSize: 14,
      color: '#4B5563', // Slightly darker gray
      marginBottom: 4,
   },
   currentHoldingText: {
       fontSize: 13,
       color: '#6B7280',
       marginBottom: 15,
   },
  closeButton: {
    padding: 5,
  },
  inputGroup: {
      marginBottom: 15,
  },
  label: {
      fontSize: 14,
      fontWeight: '500',
      color: '#374151',
      marginBottom: 6,
  },
  input: {
      backgroundColor: '#F9FAFB',
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: '#1F2937',
  },
  inputError: {
      borderColor: colors.negative, // Use theme negative color for error border
  },
  submitButton: {
    backgroundColor: colors.negative, // Use theme negative color for sell button
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: colors.negative + '80', // Use negative with alpha for disabled sell
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
      color: colors.negative, // Use theme negative color
      fontSize: 12,
      marginTop: 4,
  }
});

export default SellStockModal; 