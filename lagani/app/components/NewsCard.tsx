import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';

interface NewsCardProps {
  title: string;
  imageUrl: string;
  date?: string;
  source?: string;
  onPress?: () => void;
}

const NewsCard: React.FC<NewsCardProps> = ({
  title,
  imageUrl,
  date,
  source,
  onPress
}) => {
  const hasImage = imageUrl && imageUrl.trim() !== '';

  return (
    <TouchableOpacity 
      className="flex-row p-4 mb-3 bg-card rounded-lg shadow-sm border border-border"
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel={`Read ${title}`}
    >
      {hasImage ? (
        <Image 
          source={{ uri: imageUrl }} 
          style={{ 
            width: 64, 
            height: 64, 
            backgroundColor: colors.border, 
            borderRadius: 8 // Approximately matches rounded-lg
          }} 
          contentFit="cover"
          transition={300}
        />
      ) : (
        <View className="w-16 h-16 rounded-lg bg-border items-center justify-center">
          <Ionicons name="newspaper-outline" size={32} color={colors.textSecondary} />
        </View>
      )}
      <View className="flex-1 ml-3">
        <Text className="text-base font-medium mb-1 text-text" numberOfLines={2}>{title}</Text>
        <Text className="text-xs text-textSecondary mt-auto" numberOfLines={1}>
          {[source, date].filter(Boolean).join(' • ')}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default NewsCard;
