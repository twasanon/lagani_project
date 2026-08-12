import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ComponentType } from 'react';

// Import screens
import PortfolioScreen from '../screens/PortfolioScreen';
import StockDetailScreen from '../screens/StockDetailScreen';
import PaperTradingScreen from '../screens/PaperTradingScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';

// Define the parameter types for routes
export type MainStackParamList = {
  Portfolio: undefined;
  StockDetail: { symbol: string; name?: string };
  TransactionHistory: { symbol: string; companyName?: string };
  PaperTrading: { symbol?: string; currentPrice?: number } | undefined;
};

// Define proper types for navigation props
export type PortfolioRouteProp = RouteProp<MainStackParamList, 'Portfolio'>;
export type PortfolioNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Portfolio'>;

export type StockDetailRouteProp = RouteProp<MainStackParamList, 'StockDetail'>;
export type StockDetailNavigationProp = NativeStackNavigationProp<MainStackParamList, 'StockDetail'>;

export type TransactionHistoryRouteProp = RouteProp<MainStackParamList, 'TransactionHistory'>;
export type TransactionHistoryNavigationProp = NativeStackNavigationProp<MainStackParamList, 'TransactionHistory'>;

export type PaperTradingRouteProp = RouteProp<MainStackParamList, 'PaperTrading'>;
export type PaperTradingNavigationProp = NativeStackNavigationProp<MainStackParamList, 'PaperTrading'>;

const Stack = createNativeStackNavigator<MainStackParamList>();

const MainStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName="Portfolio"
    >
      <Stack.Screen 
        name="Portfolio"
        component={PortfolioScreen as ComponentType<any>}
      />
      <Stack.Screen 
        name="StockDetail" 
        component={StockDetailScreen as ComponentType<any>} 
      />
      <Stack.Screen 
        name="TransactionHistory"
        component={TransactionHistoryScreen as ComponentType<any>}
      />
      <Stack.Screen 
        name="PaperTrading" 
        component={PaperTradingScreen as ComponentType<any>} 
      />
    </Stack.Navigator>
  );
};

export default MainStackNavigator;