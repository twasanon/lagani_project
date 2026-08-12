import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Assuming database utilities are correctly referenced from this new location
import { getAllCompanies, addStockToWatchlist, CompanyItem } from '../../src/utils/database';
import { colors } from '../../src/theme/colors'; // Import theme colors

interface AddStockModalProps {
  isVisible: boolean;
  onClose: () => void;
  onStockAdded: () => void;
}

const AddStockModal: React.FC<AddStockModalProps> = ({ isVisible, onClose, onStockAdded }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [allCompanies, setAllCompanies] = useState<CompanyItem[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyItem[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [companyLoadError, setCompanyLoadError] = useState<string | null>(null); // Added error state

  // --- Load Company Data ---
  const loadCompanies = useCallback(async () => {
    console.log("AddStockModal: Loading companies from database...");
    setIsLoadingCompanies(true);
    setCompanyLoadError(null); // Reset error state
    try {
      const companies = await getAllCompanies();
      setAllCompanies(companies);
      setFilteredCompanies(companies); // Initially show all
      console.log(`AddStockModal: Loaded ${companies.length} companies from DB.`);
      if (companies.length === 0) {
          setCompanyLoadError("No companies found in the database. Please wait for the initial sync or check logs.");
      }
    } catch (error: any) {
      console.error("AddStockModal: Failed to load companies from DB:", error.message);
      setCompanyLoadError("Could not load company list from the database."); // Set error message
    } finally {
      setIsLoadingCompanies(false);
    }
  }, []);

  // Load companies when the modal becomes visible if needed
  useEffect(() => {
    if (isVisible) {
      if (allCompanies.length === 0 || companyLoadError) {
          loadCompanies();
      }
      setSearchQuery(''); // Reset search query when modal opens
    } else {
      // Optional: Clear search/filtered results when modal closes to free memory?
      // setSearchQuery('');
      // setFilteredCompanies([]);
    }
  }, [isVisible, loadCompanies]); // Dependency on loadCompanies is fine here

  // --- Search Logic ---
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCompanies(allCompanies);
    } else {
      const lowerCaseQuery = searchQuery.toLowerCase();
      const filtered = allCompanies.filter(company =>
        company.symbol.toLowerCase().includes(lowerCaseQuery) ||
        company.name.toLowerCase().includes(lowerCaseQuery)
      );
      setFilteredCompanies(filtered);
    }
  }, [searchQuery, allCompanies]);

  // --- Add Stock to Watchlist ---
  const handleAddStockToWatchlist = async (company: CompanyItem) => {
    console.log(`AddStockModal: Adding ${company.symbol} to watchlist...`);
    try {
      await addStockToWatchlist(company);
      Alert.alert("Success", `${company.symbol} (${company.name}) added to your watchlist.`);
      onStockAdded();
      // Keep modal open for potentially adding more stocks
    } catch (error: any) {
      console.error(`AddStockModal: Failed to add ${company.symbol} to watchlist:`, error);
      Alert.alert("Error", `Could not add ${company.symbol} to watchlist. ${error.message || ''}`);
    }
  };

  // --- Render Search Result Item ---
  const renderSearchResultItem = ({ item }: { item: CompanyItem }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleAddStockToWatchlist(item)}
    >
      <View style={styles.resultTextContainer}>
        <Text style={styles.resultSymbol}>{item.symbol}</Text>
        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
      </View>
      <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose} // For Android back button
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} // Prevent overlay from changing opacity on touch
        onPressOut={onClose} // Close modal if user taps outside the container
      >
        <View 
          style={styles.modalContainer}
          onStartShouldSetResponder={() => true} // Prevent taps inside container from closing modal
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Stock to Watchlist</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={30} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by symbol or name..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="characters" // Suggest uppercase for symbols
              onSubmitEditing={() => Keyboard.dismiss()} // Dismiss keyboard on submit
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                 <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results List / Loading / Error */}
          <View style={styles.resultsContainer}>
            {isLoadingCompanies ? (
              <View style={styles.centeredMessage}>
                 <ActivityIndicator size="large" color={colors.primary} />
                 <Text style={styles.loadingText}>Loading Companies...</Text>
              </View>
            ) : companyLoadError ? (
               <View style={styles.centeredMessage}>
                  <Ionicons name="alert-circle-outline" size={40} color={colors.negative} />
                  <Text style={styles.errorText}>{companyLoadError}</Text>
                  <TouchableOpacity onPress={loadCompanies} style={styles.retryButton}>
                      <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
               </View>
            ) : (
              <FlatList
                data={filteredCompanies}
                renderItem={renderSearchResultItem}
                keyExtractor={(item: CompanyItem) => String(item.id)} // Use DB ID and explicit type
                ListEmptyComponent={() => (
                  <View style={styles.centeredMessage}>
                    <Text style={styles.noResultsText}>
                        {searchQuery.trim() !== '' 
                            ? 'No matching companies found.' 
                            : allCompanies.length === 0 
                                ? '' // Error message shown above if load failed 
                                : 'Start typing to search...' }
                    </Text>
                  </View>
                )}
                keyboardShouldPersistTaps="handled" // Keep keyboard if tap is on interactive element
                onScrollBeginDrag={Keyboard.dismiss} // Dismiss keyboard on scroll
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// Add the StyleSheet code here
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
    paddingHorizontal: 20,
    paddingTop: 20, // Padding for header
    paddingBottom: 30, // Padding at the bottom
    height: '85%', // Adjust height as needed
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
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 5, // Add padding for easier tap
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6', // Light gray background
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 45,
    fontSize: 16,
    color: '#1F2937',
  },
   clearButton: {
      marginLeft: 8,
      padding: 5, // Easier tap target
   },
  resultsContainer: {
    flex: 1,
    // Add some padding if needed, or rely on FlatList contentContainerStyle
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14, // Slightly more padding
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultTextContainer: {
    flex: 1, // Allow text to take available space
    marginRight: 10, // Space before the icon
  },
  resultSymbol: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  resultName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  centeredMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50, // Add some margin from the search bar
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
      marginTop: 10,
      fontSize: 16,
      color: colors.negative,
      textAlign: 'center',
      marginBottom: 15,
  },
  retryButton: {
      backgroundColor: '#4F46E5',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
  },
  retryButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '500',
  },
  noResultsText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  addButton: {
    padding: 5,
  },
  addButtonEnabled: {
    // Optional: Add slight visual cue if needed, but primary color is enough
  },
  companyName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default AddStockModal;
