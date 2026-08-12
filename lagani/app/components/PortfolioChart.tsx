import React from 'react';
import { View, Dimensions } from 'react-native';
import WebView from 'react-native-webview';

interface PortfolioChartProps {
  data: { time: string; value: number }[];
  height?: number;
  onValueSelect?: (value: number, time: string) => void;
}

const PortfolioChart: React.FC<PortfolioChartProps> = ({ data, height = 200, onValueSelect }) => {
  const screenWidth = Dimensions.get('window').width;

  const chartHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            background-color: transparent;
          }
          #container {
            position: absolute;
            width: 100%;
            height: 100%;
            left: 0;
            right: 0;
            top: 0;
            bottom: 0;
          }
        </style>
      </head>
      <body>
        <div id="container"></div>
        <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
        <script>
          const container = document.getElementById('container');
          const chart = LightweightCharts.createChart(container, {
            width: ${screenWidth - 32},
            height: ${height},
            layout: {
              background: { type: 'solid', color: 'transparent' },
              textColor: '#9B9B9B',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            },
            grid: {
              vertLines: { visible: false },
              horzLines: { visible: false },
            },
            rightPriceScale: {
              visible: false,
            },
            timeScale: {
              visible: false,
              fixLeftEdge: true,
              fixRightEdge: true,
              borderVisible: false,
            },
            crosshair: {
              vertLine: {
                color: '#6E5FF8',
                width: 1,
                style: 3,
                visible: true,
                labelVisible: false,
              },
              horzLine: {
                visible: false,
                labelVisible: false,
              },
            },
            handleScroll: false,
            handleScale: false,
          });

          const areaSeries = chart.addAreaSeries({
            lineColor: '#00C805',
            topColor: 'rgba(0, 200, 5, 0.3)',
            bottomColor: 'rgba(0, 200, 5, 0.0)',
            lineWidth: 2,
            priceFormat: {
              type: 'price',
              precision: 2,
              minMove: 0.01,
            },
          });

          const chartData = ${JSON.stringify(data)};
          areaSeries.setData(chartData);
          
          // Fit the chart content
          chart.timeScale().fitContent();

          let lastValue = chartData[chartData.length - 1].value;
          let lastTime = chartData[chartData.length - 1].time;

          // Set initial value
          window.ReactNativeWebView.postMessage(JSON.stringify({
            value: lastValue,
            time: lastTime,
          }));

          // Subscribe to crosshair move to get hover values
          chart.subscribeCrosshairMove((param) => {
            if (param === undefined || param.time === undefined || !param.point) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                value: lastValue,
                time: lastTime,
              }));
              return;
            }

            const price = param.seriesPrices.get(areaSeries);
            if (price !== undefined) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                value: price,
                time: param.time,
              }));
            }
          });

          // Handle touch events for mobile
          container.addEventListener('touchstart', (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const coordinate = chart.timeScale().coordinateToLogical(x);
            if (coordinate !== null && coordinate < chartData.length) {
              const dataPoint = chartData[Math.floor(coordinate)];
              window.ReactNativeWebView.postMessage(JSON.stringify({
                value: dataPoint.value,
                time: dataPoint.time,
              }));
            }
          });

          container.addEventListener('touchmove', (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const coordinate = chart.timeScale().coordinateToLogical(x);
            if (coordinate !== null && coordinate < chartData.length) {
              const dataPoint = chartData[Math.floor(coordinate)];
              window.ReactNativeWebView.postMessage(JSON.stringify({
                value: dataPoint.value,
                time: dataPoint.time,
              }));
            }
          });

          container.addEventListener('touchend', () => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              value: lastValue,
              time: lastTime,
            }));
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={{ height, width: '100%', backgroundColor: 'transparent' }}>
      <WebView
        source={{ html: chartHtml }}
        style={{ backgroundColor: 'transparent', height, width: '100%' }}
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            onValueSelect?.(data.value, data.time);
          } catch (error) {
            console.error('Error parsing chart data:', error);
          }
        }}
      />
    </View>
  );
};

export default PortfolioChart; 