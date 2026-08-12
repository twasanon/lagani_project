import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, Alert, SafeAreaView, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors'; // Import theme colors
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { resetPaperTradingData } from '../../src/utils/database';
import Toast from 'react-native-toast-message';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AppTabs'>;

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

interface SettingsRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  action?: React.ReactNode;
  showChevron?: boolean;
  textStyle?: object; // Optional style for the label text
}

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  
  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [paperTradingEnabled, setPaperTradingEnabled] = useState(true);
  const [language, setLanguage] = useState('English');
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  // Paper trading settings
  const virtualBalance = 100000;

  // Navigate to paper trading
  const navigateToPaperTrading = () => {
    navigation.navigate('AppTabs', { screen: 'PaperTrading' });
  };

  // Reset paper trading confirmation
  const handleResetPaperTrading = () => {
    Alert.alert(
      'Reset Paper Trading',
      'Are you sure you want to reset paper trading data? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => { // Make the onPress async
            try {
              await resetPaperTradingData(); // Corrected function call
              Toast.show({
                type: 'success',
                text1: 'Paper Trading Reset',
                text2: 'Your paper trading history and balance have been reset.',
              });
            } catch (error) {
              console.error("Error resetting paper trading:", error);
              Toast.show({
                type: 'error',
                text1: 'Reset Failed',
                text2: 'Could not reset paper trading data.',
              });
            }
          },
        },
      ]
    );
  };

  // Setting sections
  const SettingSection = ({ title, children }: SettingSectionProps) => (
    <View className="mt-6">
      <Text className="mx-4 mb-2 text-lg font-bold text-dark">{title}</Text>
      <View className="bg-white rounded-xl overflow-hidden shadow-sm mx-4 border border-neutral">
        {children}
      </View>
    </View>
  );

  // Setting row
  const SettingsRow = ({ icon, label, value, onPress, action, showChevron = true, textStyle }: SettingsRowProps) => {
    // Use card background and remove bottom border, rely on spacing
    return (
        <TouchableOpacity
          style={styles.rowContainer}
          onPress={onPress}
          disabled={!onPress}
          activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={styles.rowLeft}>
                 <View style={styles.iconContainer}>
                     <Ionicons name={icon as any} size={18} color={colors.primary} />
                 </View>
                <Text style={[styles.rowLabel, textStyle]}>{label}</Text>
            </View>
            <View style={styles.rowRight}>
                {value && <Text style={styles.rowValue}>{value}</Text>}
                {action || (showChevron && (
                    <Ionicons name="chevron-forward" size={20} color={colors.border} />
                ))}
            </View>
        </TouchableOpacity>
    );
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
  };

  const toggleDarkMode = () => {
    setDarkModeEnabled(!darkModeEnabled);
  };

  const handleResetData = () => {
    // Implement the logic to reset all app data
    Alert.alert('Reset All App Data', 'Are you sure you want to reset all app data? This action cannot be undone.');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={styles.scrollContainer}>
        {/* Profile Section - Use card style */}
        <View style={styles.profileCard}>
            <Image 
                source={{ uri: 'https://via.placeholder.com/80' }} // Replace with actual user avatar URL if available
                style={styles.avatar}
            />
            <Text style={styles.profileName}>User Name</Text>
            <Text style={styles.profileEmail}>user@example.com</Text>
        </View>
        
        {/* Settings Sections - Grouped by cards */}
        <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Preferences</Text>
            <SettingsRow icon="notifications-outline" label="Notifications" action={
                <Switch
                    value={notificationsEnabled}
                    onValueChange={toggleNotifications}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.background} // Use background color for thumb
                />
            } showChevron={false} />
            <SettingsRow icon="moon-outline" label="Dark Mode" action={
                <Switch
                    value={darkModeEnabled}
                    onValueChange={toggleDarkMode}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.background}
                    disabled // Currently disabled
                />
            } showChevron={false} />
            <SettingsRow icon="language-outline" label="Language" value={language} onPress={() => {}} />
        </View>

        <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Data Management</Text>
            <SettingsRow icon="refresh-outline" label="Reset Tutorials" onPress={() => Alert.alert('Resetting...', 'Feature not yet implemented.')} />
            <SettingsRow icon="trash-outline" label="Reset All App Data" onPress={handleResetData} textStyle={styles.resetText} />
        </View>

        {/* Paper Trading Section - Update navigation if needed */}
        <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Paper Trading</Text>
            <SettingsRow icon="newspaper-outline" label="View Paper Account" onPress={navigateToPaperTrading} />
            <SettingsRow icon="cash-outline" label="Current Virtual Balance" value={`₹ ${virtualBalance.toLocaleString()}`} showChevron={false} />
            <SettingsRow icon="refresh-circle-outline" label="Reset Paper Trading" onPress={handleResetPaperTrading} textStyle={styles.resetText} />
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Help / Tutorial</Text>
          <TouchableOpacity 
            style={styles.settingItem} 
            onPress={() => navigation.navigate('Help')} // Navigate to Help screen
          >
            <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} style={styles.icon} />
            <Text style={styles.settingText}>Help / Tutorial</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    scrollContainer: {
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    profileCard: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 12,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    sectionContainer: {
        backgroundColor: colors.card,
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden', // Clip rows to rounded corners
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    rowContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14, 
        paddingHorizontal: 16,
        // Add border top for rows inside a section, except the first one
        // This will be handled by placing the header outside the rows
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 32, // Slightly larger icon background
        height: 32,
        borderRadius: 8,
        backgroundColor: colors.primary + '1A', // Primary with alpha
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rowLabel: {
        fontSize: 16,
        color: colors.text,
    },
    rowRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowValue: {
        fontSize: 16,
        color: colors.textSecondary,
        marginRight: 8,
    },
    resetText: {
        color: colors.negative, // Style for reset text color
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    icon: {
        marginRight: 16,
    },
    settingText: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
    },
});

export default SettingsScreen; 