import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; // Assuming Ionicons are available
import { colors } from '../../src/theme/colors';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
}

const AccordionItem: React.FC<AccordionItemProps> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.accordionItem}>
      <TouchableOpacity onPress={() => setIsOpen(!isOpen)} style={styles.accordionHeader}>
        <Text style={styles.accordionTitle}>{title}</Text>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.accordionContent}>
          {children}
        </View>
      )}
    </View>
  );
};

const HelpScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
        <Text style={styles.header}>Help & Tutorial</Text>

        <AccordionItem title="1. Overview">
          <Text style={styles.contentText}>
            Lagani helps you track your Nepal stock market investments, monitor market trends, stay updated with news, set price alerts, and practice trading with a virtual portfolio.
          </Text>
        </AccordionItem>

        <AccordionItem title="2. Main Sections (Bottom Tabs)">
          <Text style={styles.contentText}>The app is organized into several main sections accessible via the bottom tabs:</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Home:</Text> Your dashboard showing market status, top movers, portfolio summary, and quick access via header icons to search (🔍) and view/manage active price alerts (🔔).</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Portfolio:</Text> Detailed view of your real stock holdings and transactions.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Paper:</Text> A virtual trading simulator to practice buying and selling stocks.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Watchlist:</Text> A list of stocks you want to monitor closely.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>News:</Text> Recent financial news headlines.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Settings:</Text> App settings and options (currently basic).</Text>
        </AccordionItem>

        <AccordionItem title="3. Key Features & How to Use Them">
          <Text style={styles.subHeader}>3.1. Home Screen</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Market Status:</Text> See if the NEPSE market is currently Open or Closed.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Top Gainers/Losers:</Text> Quickly view the day's top-performing and worst-performing stocks.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Portfolio Summary:</Text> A snapshot of your total investment, current value, and overall profit/loss (based on manually entered transactions).</Text>
          <Text style={styles.subHeaderSmall}>Header Actions:</Text>
          <Text style={styles.listItemIndent}>• <Text style={styles.boldText}>Search (Magnifying Glass Icon 🔍):</Text> Tap to reveal the search bar. Type a symbol or name, tap a result to view its `Stock Detail Screen`.</Text>
          <Text style={styles.listItemIndent}>• <Text style={styles.boldText}>Price Alerts (Bell Icon 🔔):</Text> Tap to open the `Price Alerts Modal`. View active alerts and tap the trash icon (🗑️) to delete one.</Text>
          <Text style={styles.subHeaderSmall}>Quick Action Buttons:</Text>
          <Text style={styles.listItemIndent}>• <Text style={styles.boldText}>+ Add:</Text> Tap to navigate to the Portfolio tab to record a new BUY/SELL transaction.</Text>
          <Text style={styles.listItemIndent}>• <Text style={styles.boldText}>News:</Text> Tap to navigate to the News tab.</Text>

          <Text style={styles.subHeader}>3.2. Viewing Stock Details</Text>
          <Text style={styles.listItem}>• You can access the `Stock Detail Screen` for any stock by tapping it from search results, top movers, Watchlist, Portfolio, or Paper Trading.</Text>
          <Text style={styles.listItem}>• This screen shows detailed price information, basic stats (*note: some stats might be placeholders*), and a chart (*note: chart is currently a placeholder*).</Text>
          <Text style={styles.subHeaderSmall}>Actions (Header Icons):</Text>
          <Text style={styles.listItemIndent}>• <Text style={styles.boldText}>Watchlist (Star Icon ⭐/★):</Text> Tap to add/remove the stock from your Watchlist.</Text>
          <Text style={styles.listItemIndent}>• <Text style={styles.boldText}>Set Alert (Bell Icon 🔔):</Text> Tap to open the `Set Price Alert Modal` (see section 3.6).</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Navigation Note:</Text> When you navigate to the `Stock Detail Screen` from the `Home` screen (or elements originating from Home like search results or top movers), the bottom tabs remain visible due to the nested navigation structure. Accessing from Portfolio or Watchlist might behave differently based on the root navigation.</Text>

          <Text style={styles.subHeader}>3.3. Managing Your Portfolio</Text>
          <Text style={styles.listItem}>• Go to the <Text style={styles.boldText}>Portfolio</Text> tab.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Adding Transactions:</Text> Use the "+ Add" button on the Home screen (which navigates here) or potentially a dedicated button on this screen in the future.</Text>
          <Text style={styles.listItemIndent}>  ◦ Select BUY or SELL.</Text>
          <Text style={styles.listItemIndent}>  ◦ Enter the Stock Symbol, Quantity, and Price per share.</Text>
          <Text style={styles.listItemIndent}>  ◦ Tap "Add Transaction".</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Viewing Holdings:</Text> Your holdings are grouped by stock symbol. You see the total quantity and average buy price. (*Current value/P&L display is pending*).</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Viewing/Managing Individual Lots:</Text> Tap on a stock symbol to expand it. Here you can see individual transactions and use the Sell (redirects to Sell Modal), Edit (✏️), or Delete (🗑️) icons for that specific lot.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>History:</Text> Tap the "Transaction History" button to view all past transactions.</Text>

          <Text style={styles.subHeader}>3.4. Paper Trading</Text>
          <Text style={styles.listItem}>• Go to the <Text style={styles.boldText}>Paper</Text> tab.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Virtual Balance & Reset:</Text> Manage your virtual funds.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Placing Orders:</Text> Enter Symbol and Quantity, tap Buy/Sell.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Viewing Paper Portfolio:</Text> See virtual holdings.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Portfolio Chart:</Text> Visualize paper portfolio performance.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Transaction History:</Text> View simulated trades.</Text>

          <Text style={styles.subHeader}>3.5. Using the Watchlist</Text>
          <Text style={styles.listItem}>• Go to the <Text style={styles.boldText}>Watchlist</Text> tab.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Adding/Removing Stocks:</Text> Use the star icon (⭐/★) on the `Stock Detail Screen`.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Viewing:</Text> See current price and change for watched stocks.</Text>

          <Text style={styles.subHeader}>3.6. Setting Price Alerts</Text>
          <Text style={styles.listItem}>• Navigate to the `Stock Detail Screen` for the desired stock.</Text>
          <Text style={styles.listItem}>• Tap the <Text style={styles.boldText}>Set Alert</Text> bell icon (🔔) in the header.</Text>
          <Text style={styles.listItem}>• In the modal, enter the target price and choose the condition (Above/Below).</Text>
          <Text style={styles.listItem}>• Tap "Set Alert".</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Notifications:</Text> The app checks locally stored prices against your alerts periodically in the background and sends a notification if a condition is met.</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Managing Alerts:</Text> Use the <Text style={styles.boldText}>View Alerts</Text> bell icon (🔔) on the `Home` screen header to open the modal where you can view and delete active alerts.</Text>

          <Text style={styles.subHeader}>3.7. Reading News</Text>
          <Text style={styles.listItem}>• Go to the <Text style={styles.boldText}>News</Text> tab.</Text>
          <Text style={styles.listItem}>• Displays recent headlines fetched from the backend cache (sourced from Merolagani & Nepalipaisa).</Text>
          <Text style={styles.listItem}>• Each item shows headline, source, image (using `expo-image`), and date (*Note: Dates may be missing for some sources*).</Text>
          <Text style={styles.listItem}>• <Text style={styles.boldText}>Read Full Article:</Text> Tap a news card to open a modal with the article in a `WebView`.</Text>
        </AccordionItem>

        <AccordionItem title="4. Settings">
            <Text style={styles.listItem}>• Go to the <Text style={styles.boldText}>Settings</Text> tab.</Text>
            <Text style={styles.listItem}>• Provides basic options and the button to reset Paper Trading data.</Text>
        </AccordionItem>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContentContainer: {
    paddingTop: 10,
    paddingBottom: 30, // Add padding at the bottom
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  accordionItem: {
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    // Removed borderBottom for cleaner look between header and content
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  accordionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16, // Add padding at the bottom of content
    borderTopWidth: 1, // Add separator line here
    borderTopColor: colors.border,
  },
  subHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  subHeaderSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  contentText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4, // Add margin top for standalone content text
  },
  listItem: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  listItemIndent: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
    marginLeft: 16, // Indent sub-items
  },
  boldText: {
      fontWeight: '600',
      color: colors.text, // Use primary text color for emphasis
  }
});

export default HelpScreen; 