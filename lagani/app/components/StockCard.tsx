import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StockCardProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  onPress?: () => void;
}

const StockCard: React.FC<StockCardProps> = ({ 
  symbol, 
  name, 
  price, 
  change, 
  onPress 
}) => {
  const isPositive = change >= 0;

  return (
    <TouchableOpacity 
      className="flex-row justify-between items-center p-4 mb-2 bg-white rounded-xl shadow-sm border border-neutral"
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <View className="bg-gray-200 w-10 h-10 rounded-lg items-center justify-center">
          <Text className="font-bold">{symbol.substring(0, 1)}</Text>
        </View>
        <View className="ml-3">
          <Text className="font-medium text-dark">{symbol}</Text>
          <Text className="text-gray-500 text-xs">{name}</Text>
        </View>
      </View>
      
      <View className="items-end">
        <Text className="font-medium text-dark">₹ {price}</Text>
        <Text className={`text-xs ${isPositive ? 'text-secondary' : 'text-danger'}`}>
          {isPositive ? '+' : ''}{change}%
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default StockCard; 