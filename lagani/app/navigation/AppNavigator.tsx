import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { NavigatorScreenParams } from '@react-navigation/native';
import { colors } from '../../src/theme/colors'; // Import theme colors

// Import screens and navigators
import HomeStackNavigator from './HomeStackNavigator'; // Import the new Home Stack
import { HomeStackParamList } from './HomeStackNavigator'; // Import the nested stack's param list
import PortfolioScreen from '../screens/PortfolioScreen';
import WatchlistScreen from '../screens/WatchlistScreen'; // Use this component directly again
import SettingsScreen from '../screens/SettingsScreen';
import PaperTradingScreen from '../screens/PaperTradingScreen';
import NewsScreen from '../screens/NewsScreen'; // Import NewsScreen

// Create a type for the root tab navigator
export type RootTabParamList = {
  HomeStack: NavigatorScreenParams<HomeStackParamList>;
  Portfolio: undefined;
  // Allow optional symbol param for pre-filling the form
  PaperTrading: { symbol?: string } | undefined;
  Watchlist: undefined; // This represents the screen again
  News: undefined; // Add News to the type
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// Temporarily use placeholder components for screens we haven't created yet
const PlaceholderScreen = ({ name }: { name: string }) => (
  <View className="flex-1 items-center justify-center bg-white">
    <Text className="text-xl font-bold text-gray-800">{name} Screen</Text>
    <Text className="text-gray-600 mt-2">Coming soon</Text>
  </View>
);

const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'HomeStack') { // Check for HomeStack
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Portfolio') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'PaperTrading') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Watchlist') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'News') { // Add icon for News
            iconName = focused ? 'newspaper' : 'newspaper-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-circle-outline';
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary, // Use theme primary color
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
          justifyContent: 'space-around',
        },
        tabBarItemStyle: {
          flex: 1,
          paddingHorizontal: 0,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          paddingBottom: 2,
        },
      })}
    >
      <Tab.Screen 
        name="HomeStack" 
        component={HomeStackNavigator} 
        options={{ title: 'Home' }} // Set the tab label
      />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen 
        name="PaperTrading" 
        component={PaperTradingScreen}
        options={{
          title: 'Paper Trade'
        }}
      />
      <Tab.Screen 
        name="Watchlist" 
        component={WatchlistScreen} 
      />
      <Tab.Screen name="News" component={NewsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export default AppNavigator; 