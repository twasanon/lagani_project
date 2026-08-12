import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator, { RootTabParamList } from './AppNavigator'; // Import the Tab Navigator
// Remove import StockDetailScreen from '../screens/StockDetailScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
// Remove import SearchScreen from '../screens/SearchScreen';
// Import other screens that should live outside/above tabs if needed
import HelpScreen from '../screens/HelpScreen'; // Import the new screen
import { colors } from '../../src/theme/colors'; // Import colors

// Define Param list for the Root Stack
export type RootStackParamList = {
  AppTabs: { screen?: keyof RootTabParamList; params?: any }; // Screen containing the tabs
  // Remove StockDetail: { symbol: string; name?: string };
  TransactionHistory: { symbol: string; companyName?: string };
  // Remove Search: undefined;
  // Add other modal/full-screen routes here
  Help: undefined; // Route for the Help screen, expects no params
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  return (
    <NavigationContainer>{/* NavigationContainer now lives here */}
      <Stack.Navigator
        initialRouteName="AppTabs"
        screenOptions={{
          headerShown: false, // Hide header globally for the root stack
        }}
      >
        <Stack.Screen 
          name="AppTabs" 
          component={AppNavigator} // Render the Tab Navigator component
        />
        {/* Remove StockDetailScreen from here */}
        {/* <Stack.Screen 
          name="StockDetail" 
          component={StockDetailScreen} 
        /> */}
        <Stack.Screen 
          name="TransactionHistory" 
          component={TransactionHistoryScreen} 
        />
        {/* Remove <Stack.Screen name="Search" ... /> */}
        <Stack.Screen
          name="Help" // Add Help screen to the stack
          component={HelpScreen}
          options={{
            headerShown: true, // Show header specifically for HelpScreen
            title: 'Help & Tutorial', // Set the header title
            // Optional: Customize header style if needed
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        {/* Add other Stack.Screen instances here */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator; 