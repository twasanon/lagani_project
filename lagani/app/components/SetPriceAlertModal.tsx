import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors'; // Import theme colors

interface SetPriceAlertModalProps {
  isVisible: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number | null | undefined;
  onAlertSet: (targetPrice: number, condition: 'ABOVE' | 'BELOW') => void; // Callback when alert is set
}

const SetPriceAlertModal: React.FC<SetPriceAlertModalProps> = ({ 
  isVisible, 
  onClose, 
  symbol, 
  currentPrice, 
  onAlertSet 
}) => {
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE'); // Default condition
  const [error, setError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  const handleSetAlert = () => {
    setError(null);
    const target = parseFloat(targetPrice);

    if (isNaN(target) || target <= 0) {
      setPriceError('Please enter a valid positive price.');
      return;
    }

    if (condition === 'ABOVE' && currentPrice != null && target <= currentPrice) {
        setError(`Target price must be above the current price (${currentPrice.toFixed(2)}) for an 'Above' alert.`);
        return;
    }

    if (condition === 'BELOW' && currentPrice != null && target >= currentPrice) {
        setError(`Target price must be below the current price (${currentPrice.toFixed(2)}) for a 'Below' alert.`);
        return;
    }

    console.log(`[SetPriceAlertModal] User wants to set alert for ${symbol}: ${condition} ${target}`);
    // TODO: Add permission check here
    // TODO: Call DB function here
    onAlertSet(target, condition); // Pass data back to parent screen
    handleClose(); // Close after setting
  };

  const handleClose = () => {
    setTargetPrice(''); // Reset state on close
    setCondition('ABOVE');
    setError(null);
    setPriceError(null);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <TouchableOpacity 
            style={StyleSheet.absoluteFill} // Fill overlay
            activeOpacity={1}
            onPressOut={handleClose} // Close on tap outside
        />
        <View 
          style={styles.modalContainer}
          // Prevent taps inside container from closing modal
          onStartShouldSetResponder={() => true} 
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Price Alert for {symbol}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={30} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Current Price Info */}
          <Text style={styles.currentPriceText}>
            Current Price: {currentPrice != null ? `₹ ${currentPrice.toFixed(2)}` : 'N/A'}
          </Text>

          {/* Condition Selector */}
          <View style={styles.conditionSelector}>
            <TouchableOpacity
              style={[styles.conditionButton, condition === 'ABOVE' && styles.conditionButtonActive]}
              onPress={() => setCondition('ABOVE')}
            >
              <Ionicons name="trending-up-outline" size={20} color={condition === 'ABOVE' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.conditionButtonText, condition === 'ABOVE' && styles.conditionButtonTextActive]}>Above</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.conditionButton, condition === 'BELOW' && styles.conditionButtonActiveNegative]}
              onPress={() => setCondition('BELOW')}
            >
              <Ionicons name="trending-down-outline" size={20} color={condition === 'BELOW' ? colors.negative : colors.textSecondary} />
              <Text style={[styles.conditionButtonText, condition === 'BELOW' && styles.conditionButtonTextActiveNegative]}>Below</Text>
            </TouchableOpacity>
          </View>

          {/* Target Price Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Target Price (₹)</Text>
            <TextInput
              style={[styles.input, priceError ? styles.inputError : null]}
              placeholder="Enter target price"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={targetPrice}
              onChangeText={setTargetPrice}
            />
            {priceError ? <Text style={styles.errorText}>{priceError}</Text> : null}
          </View>
          
          {/* Error Message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose}>
              <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.setButton]} onPress={handleSetAlert}>
              <Text style={[styles.buttonText, styles.setButtonText]}>Set Alert</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    padding: 25,
    paddingBottom: 40, // More space at bottom
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
    flex: 1, // Allow title to wrap if long
    marginRight: 10,
  },
  closeButton: {
    padding: 5, // Easier tap target
  },
  currentPriceText: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 25,
  },
  conditionSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 25,
  },
  conditionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  conditionButtonActive: {
    backgroundColor: colors.primary + '1A', // Primary with alpha
    borderColor: colors.primary,
  },
  conditionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  conditionButtonTextActive: {
    color: colors.primary,
  },
  conditionButtonActiveNegative: {
    backgroundColor: colors.negative + '1A', // Negative with alpha
    borderColor: colors.negative,
  },
  conditionButtonTextActiveNegative: {
    color: colors.negative,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  inputError: {
    borderColor: colors.negative, // Use theme negative color
  },
  errorText: {
    color: colors.negative, // Use theme negative color
    fontSize: 12,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E5E7EB',
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#4B5563',
  },
  setButton: {
    backgroundColor: colors.primary, // Use theme primary color
    marginLeft: 10,
  },
  setButtonText: {
    color: 'white',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary, // Use theme primary color
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: colors.border, // Use theme border color
  },
});

export default SetPriceAlertModal; 