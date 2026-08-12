import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Modal, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons'; // For the close button

import NewsCard from '../components/NewsCard'; // Assuming path is correct
import { getNewsItems, NewsItem } from '../../src/utils/database'; // Adjust path if needed
import { syncNews } from '../../src/api/nepseScraper';
import { colors } from '../../src/theme/colors'; // For activity indicator

const NewsScreen = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedArticleUrl, setSelectedArticleUrl] = useState<string | null>(null);
  const [isWebViewVisible, setIsWebViewVisible] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadNews = useCallback(async () => {
    console.log("[NewsScreen] Loading news from DB...");
    setError(null);
    try {
      const items = await getNewsItems();
      setNews(items);
      console.log(`[NewsScreen] Loaded ${items.length} news items.`);
    } catch (error) {
      console.error("[NewsScreen] Failed to load news:", error);
      setError('Could not load saved news.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load news when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadNews();
    }, [loadNews])
  );

  const handleRefresh = useCallback(async () => {
    console.log("[NewsScreen] Refresh triggered.");
    setIsRefreshing(true);
    try {
      await syncNews();
      await loadNews(); // Reload from DB
    } catch (error) {
      console.error("[NewsScreen] Failed to refresh news:", error);
      setError(error instanceof Error ? error.message : 'Could not refresh news.');
      setIsRefreshing(false); // Ensure refreshing indicator stops on error
    }
  }, [loadNews]);

  const handleCardPress = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw new Error('Only secure links are supported.');
    } catch {
      Alert.alert('Cannot open article', 'This article has an invalid or insecure link.');
      return;
    }
    setSelectedArticleUrl(url);
    setIsWebViewVisible(true);
  };

  const renderItem = ({ item }: { item: NewsItem }) => {
    console.log("Rendering NewsCard for:", item.title, "Image URL:", item.imageUrl); // Keep console log for now
    return (
      <NewsCard 
        title={item.title}
        imageUrl={item.imageUrl || ''} // Ensure we pass at least an empty string
        date={item.date}
        source={item.source}
        onPress={() => handleCardPress(item.link)}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList 
          data={news}
          renderItem={renderItem}
          keyExtractor={(item: NewsItem) => item.link}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListHeaderComponent={error ? (
            <View className="mb-3 rounded-lg bg-red-50 p-3">
              <Text className="text-sm text-negative">{error}</Text>
            </View>
          ) : null}
          ListEmptyComponent={() => (
            <View className="flex-1 justify-center items-center mt-10">
              <Text className="text-textSecondary">No news available.</Text>
              <Text className="text-textSecondary mt-1">Pull down to refresh.</Text>
            </View>
          )}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]} // Android color
              tintColor={colors.primary} // iOS color
            />
          }
          className="flex-1" // Ensure FlatList tries to take available space
        />
      )}

      {/* WebView Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isWebViewVisible}
        onRequestClose={() => {
          setIsWebViewVisible(false);
          setSelectedArticleUrl(null);
        }}
      >
        <SafeAreaView className="flex-1 bg-background">
          <View className="flex-row justify-between items-center p-3 border-b border-border">
            <Text className="text-lg font-semibold text-text flex-1 mx-2" numberOfLines={1} ellipsizeMode="tail">
              {selectedArticleUrl ? (() => { try { return new URL(selectedArticleUrl).hostname; } catch { return 'News Article'; } })() : 'News Article'}
            </Text>
            <TouchableOpacity 
              onPress={() => setIsWebViewVisible(false)} 
              className="p-1"
              accessibilityRole="button"
              accessibilityLabel="Close article"
            >
              <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {selectedArticleUrl && (
             <WebView 
               source={{ uri: selectedArticleUrl }}
               originWhitelist={['https://*']}
               onShouldStartLoadWithRequest={(request) => request.url.startsWith('https://')}
               style={{ flex: 1 }}
               startInLoadingState={true}
               renderLoading={() => (
                 <ActivityIndicator 
                   color={colors.primary} 
                   size="large" 
                   style={{position: 'absolute', top: '50%', left: '50%'}}
                 />
               )}
             />
           )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default NewsScreen;
