import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons'; // For the close button

import NewsCard from '../components/NewsCard'; // Assuming path is correct
import { getNewsItems, NewsItem } from '../../src/utils/database'; // Adjust path if needed
import { refreshAllData } from '../../src/api/nepseScraper'; // Adjust path if needed
import { colors } from '../../src/theme/colors'; // For activity indicator

const AD_PLACEHOLDER_HEIGHT = 70; // Height for the ad banner space

const NewsScreen = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedArticleUrl, setSelectedArticleUrl] = useState<string | null>(null);
  const [isWebViewVisible, setIsWebViewVisible] = useState<boolean>(false);

  const loadNews = useCallback(async () => {
    console.log("[NewsScreen] Loading news from DB...");
    try {
      const items = await getNewsItems();
      setNews(items);
      console.log(`[NewsScreen] Loaded ${items.length} news items.`);
    } catch (error) {
      console.error("[NewsScreen] Failed to load news:", error);
      // Optionally show an error message to the user
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
      await refreshAllData(); // Fetch latest from API and save to DB
      await loadNews(); // Reload from DB
    } catch (error) {
      console.error("[NewsScreen] Failed to refresh news:", error);
      // Optionally show an error message
      setIsRefreshing(false); // Ensure refreshing indicator stops on error
    }
  }, [loadNews]);

  const handleCardPress = (url: string) => {
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
          contentContainerStyle={{ 
            paddingHorizontal: 16, 
            paddingBottom: AD_PLACEHOLDER_HEIGHT + 16 // Add ad height + some extra padding
          }} 
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

      {/* Fixed Ad Placeholder View */}
      {!isLoading && ( // Only show when not loading initially
         <View 
           style={{
             height: AD_PLACEHOLDER_HEIGHT,
             backgroundColor: 'yellow', // Keep yellow for visibility
             position: 'absolute', // Position it absolutely
             bottom: 0, // Anchor to the bottom
             left: 0, 
             right: 0,
             // You might need to adjust based on SafeAreaView edges or tab bar
             // borderTopWidth: 1, // Optional border
             // borderTopColor: colors.border, 
           }}
         >
            {/* You can add placeholder text here if needed */}
            {/* <Text style={{textAlign: 'center', paddingTop: 10}}>Ad Placeholder</Text> */}
         </View>
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
              {selectedArticleUrl ? new URL(selectedArticleUrl).hostname : 'News Article'}
            </Text>
            <TouchableOpacity 
              onPress={() => setIsWebViewVisible(false)} 
              className="p-1"
            >
              <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {selectedArticleUrl && (
             <WebView 
               source={{ uri: selectedArticleUrl }}
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