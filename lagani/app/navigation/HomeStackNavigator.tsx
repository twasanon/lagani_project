import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import StockDetailScreen from '../screens/StockDetailScreen';

// Define Param list for the Home Stack
export type HomeStackParamList = {
  Home: undefined; // The initial screen in this stack
  StockDetail: { symbol: string; name?: string }; // The detail screen
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

const HomeStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="StockDetail" component={StockDetailScreen} />
      {/* Add other screens related to the Home flow here if needed */}
    </Stack.Navigator>
  );
};

export default HomeStackNavigator; 