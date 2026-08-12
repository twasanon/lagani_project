import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList,
  Pressable,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllCompanies, addPortfolioTransactionAndUpdateHolding, CompanyItem } from '../../src/utils/database';
import { colors } from '../../src/theme/colors'; // Import theme colors

interface AddStockHoldingModalProps {
  isVisible: boolean;
  onClose: () => void;
  onTransactionAdded: () => void; // Keep callback name generic for now
}

const AddStockHoldingModal: React.FC<AddStockHoldingModalProps> = ({ isVisible, onClose, onTransactionAdded }) => {
  // Company Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [allCompanies, setAllCompanies] = useState<CompanyItem[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyItem[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [companyLoadError, setCompanyLoadError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Transaction Details State
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  // --- Load Company Data ---
  const loadCompanies = useCallback(async () => {
    console.log("[AddStockHoldingModal] Loading companies...");
    setIsLoadingCompanies(true);
    setCompanyLoadError(null);
    try {
      const companies = await getAllCompanies();
      setAllCompanies(companies);
      setFilteredCompanies([]); // Don't show all initially
      console.log(`[AddStockHoldingModal] Loaded ${companies.length} companies.`);
    } catch (error: any) {
      console.error("[AddStockHoldingModal] Failed to load companies:", error.message);
      setCompanyLoadError("Could not load company list.");
    } finally {
      setIsLoadingCompanies(false);
    }
  }, []);

  // Load companies when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      if (allCompanies.length === 0 || companyLoadError) {
        loadCompanies();
      }
      // Reset form when modal opens
      resetForm();
    } else {
      // Clear data when modal closes
       setShowSuggestions(false);
    }
  }, [isVisible, loadCompanies]);

  // --- Search & Selection Logic ---
  useEffect(() => {
    if (!selectedCompany) {
        if (searchQuery.trim().length > 1) {
          const lowerCaseQuery = searchQuery.toLowerCase();
          const filtered = allCompanies.filter(company =>
            company.symbol.toLowerCase().includes(lowerCaseQuery) ||
            company.name.toLowerCase().includes(lowerCaseQuery)
          ).slice(0, 10); // Limit suggestions
          setFilteredCompanies(filtered);
          setShowSuggestions(true);
        } else {
          setFilteredCompanies([]);
          setShowSuggestions(false);
        }
    } else {
        // If a company is selected, hide suggestions
        setShowSuggestions(false);
    }
  }, [searchQuery, allCompanies, selectedCompany]);

  const handleSelectCompany = (company: CompanyItem) => {
    setSelectedCompany(company);
    setSearchQuery(company.symbol); // Fill search bar with symbol
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const resetForm = () => {
      setSearchQuery('');
      setSelectedCompany(null);
      setQuantity('');
      setPrice('');
      setIsSubmitting(false);
      setShowSuggestions(false);
      setQuantityError(null);
      setPriceError(null);
  };

  // --- Input Validation --- 
  const validateInputs = (): boolean => {
    let isValid = true;
    setQuantityError(null);
    setPriceError(null);

    const parsedQuantity = parseFloat(quantity);
    const parsedPrice = parseFloat(price);

    if (!quantity || isNaN(parsedQuantity) || parsedQuantity <= 0) {
      setQuantityError("Please enter a valid positive quantity.");
      isValid = false;
    }

    if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
      setPriceError("Please enter a valid positive price.");
      isValid = false;
    }
    
    if (!selectedCompany) {
      // Handle case where company is not selected (maybe show general error)
      Alert.alert("Missing Stock", "Please select a stock from the search results.");
      isValid = false;
    }

    return isValid;
  };

  // --- Submit Transaction --- 
  const handleSubmitTransaction = async () => {
    if (!validateInputs()) {
      return; // Stop if validation fails
    }
    
    // Assertion: selectedCompany, quantity, price are valid at this point due to validateInputs
    const parsedQuantity = parseFloat(quantity);
    const parsedPrice = parseFloat(price);

    setIsSubmitting(true);
    try {
      await addPortfolioTransactionAndUpdateHolding({
        symbol: selectedCompany!.symbol,
        type: 'BUY',
        quantity: parsedQuantity,
        price: parsedPrice,
      });
      Alert.alert("Success", `Successfully added ${parsedQuantity} shares of ${selectedCompany!.symbol} to your portfolio.`);
      onTransactionAdded();
      onClose(); // Close modal on success
    } catch (error: any) {
      console.error("[AddStockHoldingModal] Failed to add holding:", error);
      Alert.alert("Error", `Could not add holding. ${error.message || ''}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Search Suggestion Item ---
  const renderSuggestionItem = ({ item }: { item: CompanyItem }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSelectCompany(item)}
    >
      <Text style={styles.suggestionSymbol}>{item.symbol}</Text>
      <Text style={styles.suggestionName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

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
              <Text style={styles.modalTitle}>Add Stock Holding</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close-circle" size={30} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Form Content */}
            <View style={styles.formContentContainer}>
              {/* Stock Search/Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Stock Symbol / Name</Text>
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search (e.g., NABIL)"
                    placeholderTextColor={colors.textSecondary}
                    value={searchQuery}
                    onChangeText={(text) => {
                        setSearchQuery(text);
                        if (selectedCompany && text !== selectedCompany.symbol) {
                            setSelectedCompany(null); // Deselect if user modifies search after selection
                        }
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    autoCorrect={false}
                    autoCapitalize="characters"
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIconContainer}>
                      <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                  {isLoadingCompanies && <ActivityIndicator size="small" color={colors.primary} style={styles.searchLoader}/>}
                </View>
                {/* Suggestions List */}
                {showSuggestions && !selectedCompany && (
                    <View style={styles.suggestionsListContainer}>
                      {filteredCompanies.length > 0 ? (
                          <FlatList
                              data={filteredCompanies}
                              renderItem={renderSuggestionItem}
                              keyExtractor={(item: CompanyItem) => String(item.id)}
                              style={styles.suggestionsList}
                              nestedScrollEnabled={true}
                          />
                      ) : (
                         searchQuery.trim().length > 1 && !isLoadingCompanies
                            ? <Text style={styles.noSuggestionsText}>No matching companies found.</Text>
                            : null
                      )}
                   </View>
                )}
                {companyLoadError && <Text style={styles.errorTextSmall}>{companyLoadError}</Text>}
              </View>

              {/* Quantity Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={[styles.input, quantityError ? styles.inputError : null]}
                  placeholder="Number of shares"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />
                {quantityError ? <Text style={styles.errorText}>{quantityError}</Text> : null}
              </View>

              {/* Price Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Purchase Price (per share)</Text>
                <TextInput
                  style={[styles.input, priceError ? styles.inputError : null]}
                  placeholder="Price paid per share"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
                {priceError ? <Text style={styles.errorText}>{priceError}</Text> : null}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, (isSubmitting || !selectedCompany || !quantity || !price) && styles.submitButtonDisabled]}
                onPress={handleSubmitTransaction}
                disabled={isSubmitting || !selectedCompany || !quantity || !price}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add to Portfolio</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// Add the StyleSheet code here (similar to AddStockModal, adjust as needed)
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
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
      backgroundColor: '#F9FAFB', // Very light gray
      borderWidth: 1,
      borderColor: '#D1D5DB', // Gray border
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: '#1F2937',
  },
  searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F9FAFB',
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 10,
  },
  searchIcon: {
      marginRight: 8,
  },
  searchInput: {
      flex: 1,
      height: 44,
      fontSize: 16,
      color: '#1F2937',
  },
  suggestionsListContainer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    maxHeight: 150,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
   suggestionsList: {
      // Styles for the FlatList itself if needed
   },
  suggestionItem: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  suggestionSymbol: {
      fontSize: 15,
      fontWeight: '500',
      color: '#1F2937',
  },
  suggestionName: {
      fontSize: 12,
      color: '#6B7280',
  },
  noSuggestionsText: {
      padding: 15,
      textAlign: 'center',
      color: '#6B7280',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginHorizontal: 10,
  },
  activeSwitch: {
      color: '#1F2937', // Darker color when active
      fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary, // Use theme primary color
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: colors.border, // Use border color for disabled state
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorTextSmall: {
      fontSize: 12,
      color: colors.negative, // Use theme negative color
      marginTop: 4,
  },
  errorText: {
    color: colors.negative, // Use theme negative color
    fontSize: 12,
    marginTop: 4,
  },
  inputError: {
    borderColor: colors.negative, // Use theme negative color for error border
  },
  clearIconContainer: {
    padding: 5,
  },
  searchLoader: {
    position: 'absolute',
    right: 10,
    top: 12, // Adjust position as needed
  },
});

export default AddStockHoldingModal; 