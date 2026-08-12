import React from 'react';
import { View, Dimensions, Platform } from 'react-native';
import WebView from 'react-native-webview';
import { ApiChartDataPoint } from '../../src/api/nepseScraper'; // Adjusted path
import { colors as themeColors } from '../../src/theme/colors'; // Adjusted path

interface StockHistoryChartProps {
  data: ApiChartDataPoint[];
  height?: number;
  chartType?: 'line' | 'candlestick';
  lineColor?: string;
  textColor?: string;
  gridColor?: string;
  chartBackgroundColor?: string;
  onCrosshairMove?: (dataPoint: { time: any; price?: number; prices?: { open?: number, high?: number, low?: number, close?: number } }) => void;
  onInteractionEnd?: () => void; // To reset a displayed value when interaction stops
}

const StockHistoryChart: React.FC<StockHistoryChartProps> = ({
  data,
  height = 250,
  chartType = 'line', // Default to line chart for now
  lineColor = themeColors.primary,
  textColor = themeColors.text,
  gridColor = themeColors.border,
  chartBackgroundColor = themeColors.background,
  onCrosshairMove,
  onInteractionEnd,
}) => {
  const screenWidth = Dimensions.get('window').width;

  // Prepare data for the selected chart type
  const chartData = data.map(item => ({
    time: item.t, // lightweight-charts handles Unix timestamps (seconds)
    ...(chartType === 'line' ? { value: item.c } : { open: item.o, high: item.h, low: item.l, close: item.c }),
  }));
  
  const lastDataPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  const chartHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background-color: ${chartBackgroundColor}; }
          #container { position: absolute; width: 100%; height: 100%; left: 0; right: 0; top: 0; bottom: 0; }
        </style>
      </head>
      <body>
        <div id="container"></div>
        <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
        <script>
          const container = document.getElementById('container');
          const chartWidth = container.clientWidth; // Use clientWidth for responsive behavior inside WebView
          const chartHeight = container.clientHeight;

          const chart = LightweightCharts.createChart(container, {
            width: chartWidth,
            height: chartHeight,
            layout: {
              background: { type: 'solid', color: '${chartBackgroundColor}' },
              textColor: '${textColor}',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            },
            grid: {
              vertLines: { color: '${gridColor}', visible: true },
              horzLines: { color: '${gridColor}', visible: true },
            },
            rightPriceScale: {
              borderColor: '${gridColor}',
              // entirelyVisible: true, // Ensure it's always visible without needing to scroll chart
            },
            timeScale: {
              borderColor: '${gridColor}',
              // fixLeftEdge: true,
              // fixRightEdge: true,
            },
            crosshair: {
              mode: LightweightCharts.CrosshairMode.Normal, // Or Magnet
              vertLine: { color: '${textColor}', width: 1, style: 2, visible: true, labelVisible: false }, // Style: 0-Solid, 1-Dotted, 2-Dashed, 3-LargeDashed
              horzLine: { color: '${textColor}', width: 1, style: 2, visible: true, labelVisible: true },
            },
            // handleScroll: {
            //   mouseWheel: true,
            //   pressedMouseMove: true,
            //   horzTouchDrag: true,
            //   vertTouchDrag: true,
            // },
            // handleScale: {
            //   mouseWheel: true,
            //   pinch: true,
            //   axisPressedMouseMove: true,
            // }
          });

          let series;
          const seriesData = ${JSON.stringify(chartData)};

          if ('${chartType}' === 'line') {
            series = chart.addLineSeries({
              color: '${lineColor}',
              lineWidth: 2,
              priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            });
          } else if ('${chartType}' === 'candlestick') {
            series = chart.addCandlestickSeries({
              upColor: '${themeColors.positive}', // Green for up candles
              downColor: '${themeColors.negative}', // Red for down candles
              borderVisible: true,
              wickUpColor: '${themeColors.positive}',
              wickDownColor: '${themeColors.negative}',
              priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            });
          }
          
          if (series && seriesData.length > 0) {
            series.setData(seriesData);
            chart.timeScale().fitContent();
          } else if (seriesData.length === 0) {
             // Handle no data case - maybe display a message via postMessage or a placeholder in HTML
            // For now, the chart will just be empty.
          }


          // Function to post data to React Native
          function postDataToReactNative(param) {
            if (!window.ReactNativeWebView) return;

            let messagePayload = { time: param.time };
            if (param.seriesPrices && series) {
                const priceData = param.seriesPrices.get(series);
                if (priceData) {
                    if ('${chartType}' === 'line' && priceData.value !== undefined) {
                        messagePayload.price = priceData.value;
                    } else if ('${chartType}' === 'candlestick' && priceData.open !== undefined) {
                        messagePayload.prices = priceData; // open, high, low, close
                    }
                }
            }
             // If no specific point is hovered (e.g. crosshair out of data area), send nothing or last known.
            if (Object.keys(messagePayload).length > 1) { // if we have price or prices
                window.ReactNativeWebView.postMessage(JSON.stringify(messagePayload));
            }
          }
          
          function postInteractionEnd() {
             if (window.ReactNativeWebView && typeof ${onInteractionEnd !== undefined} === 'boolean' && ${onInteractionEnd !== undefined}) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'interactionEnd' }));
             }
          }

          if (seriesData.length > 0 && typeof ${onCrosshairMove !== undefined} === 'boolean' && ${onCrosshairMove !== undefined}) {
            chart.subscribeCrosshairMove((param) => {
              if (param.time && param.point) { // Point must exist on chart
                postDataToReactNative(param);
              } else {
                // Crosshair is not on a data point or outside the chart
                postInteractionEnd();
              }
            });
          }
          
          // For touch devices, touchend might signify the end of scrubbing.
          // However, lightweight-charts' crosshair subscription should cover most cases.
          // Adding explicit touchend for safety if needed for onInteractionEnd.
           if (typeof ${onInteractionEnd !== undefined} === 'boolean' && ${onInteractionEnd !== undefined}) {
             container.addEventListener('mouseleave', postInteractionEnd); // For mouse
             if (Platform.OS !== 'web') { // Crude check, but WebView is usually not on web
                container.addEventListener('touchend', postInteractionEnd);
                container.addEventListener('touchcancel', postInteractionEnd);
             }
           }

        </script>
      </body>
    </html>
  `;

  return (
    <View style={{ height, width: '100%', backgroundColor: chartBackgroundColor }}>
      <WebView
        originWhitelist={['*']}
        source={{ html: chartHtml, baseUrl: Platform.OS === 'android' ? 'file:///android_asset/' : '' }}
        style={{ backgroundColor: chartBackgroundColor, height, width: '100%' }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false} // Disable WebView scroll, chart handles its own if enabled
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onMessage={(event) => {
          if (onCrosshairMove || onInteractionEnd) {
            try {
              const message = JSON.parse(event.nativeEvent.data);
              if (message.type === 'interactionEnd' && onInteractionEnd) {
                onInteractionEnd();
              } else if (onCrosshairMove && (message.price !== undefined || message.prices !== undefined)) {
                onCrosshairMove(message);
              }
            } catch (error) {
              console.error('Error parsing chart onMessage data:', error, event.nativeEvent.data);
            }
          }
        }}
        onError={(syntheticEvent) => {
          const {nativeEvent} = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        // scalesPageToFit={Platform.OS === 'android'} // this can help with scaling on Android
        // startInLoadingState={true} // Show a loading indicator
        // renderLoading={() => <ActivityIndicator size="large" color={themeColors.primary} style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}}/>}
      />
    </View>
  );
};

export default StockHistoryChart; 