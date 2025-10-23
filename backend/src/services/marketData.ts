import { fetchTokenAnalytics, fetchHistoricalPrices, TokenAnalytics, HistoricalPrice } from './price.js';
import { getAccountHoldings, resolveAccountId, TokenHolding } from '../utils/hedera.js';
import { AccountId } from '@hashgraph/sdk';

export interface HederaTokenMetrics {
  tokenId: string;
  symbol: string;
  name: string;
  totalSupply: number;
  decimals: number;
  holders: number;
  transactions24h: number;
  volume24h: number;
  priceUSD: number;
  marketCap: number;
}

export interface TokenChartData {
  token: string;
  symbol: string;
  name: string;
  timeframe: string;
  chartType: 'line' | 'candlestick' | 'volume' | 'correlation';
  data: ChartDataPoint[];
  analytics: TokenAnalytics;
  hederaMetrics?: HederaTokenMetrics;
  metadata: {
    lastUpdated: string;
    dataSource: string;
    confidence: number;
  };
}

export interface ChartDataPoint {
  timestamp: number;
  price: number;
  volume?: number;
  marketCap?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface PortfolioTokenChart {
  accountId: string;
  tokens: TokenChartData[];
  totalValue: number;
  totalChange24h: number;
  diversification: {
    token: string;
    percentage: number;
    value: number;
  }[];
}

export class MarketDataService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(token: string, timeframe: string, chartType: string): string {
    return `${token}_${timeframe}_${chartType}`;
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_TTL;
  }

  async getTokenChartData(
    token: string,
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h',
    chartType: 'line' | 'candlestick' | 'volume' | 'correlation' = 'line'
  ): Promise<TokenChartData | null> {
    const cacheKey = this.getCacheKey(token, timeframe, chartType);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isValidCache(cached.timestamp)) {
      return cached.data;
    }

    try {
      // Fetch comprehensive token analytics
      const analytics = await fetchTokenAnalytics(token, timeframe);
      if (!analytics) {
        return null;
      }

      // Convert historical prices to chart data points
      const chartData = this.convertToChartData(analytics.historical_prices, chartType);

      // Try to get Hedera-specific metrics if it's an HTS token
      const hederaMetrics = await this.getHederaTokenMetrics(token);

      const tokenChartData: TokenChartData = {
        token: analytics.token,
        symbol: token.toUpperCase(),
        name: analytics.token,
        timeframe,
        chartType,
        data: chartData,
        analytics,
        hederaMetrics,
        metadata: {
          lastUpdated: new Date().toISOString(),
          dataSource: 'CoinGecko + Hedera',
          confidence: hederaMetrics ? 0.95 : 0.85
        }
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: tokenChartData,
        timestamp: Date.now()
      });

      return tokenChartData;
    } catch (error) {
      console.error(`Error fetching chart data for ${token}:`, error);
      return null;
    }
  }

  async getPortfolioChartData(accountId: string): Promise<PortfolioTokenChart | null> {
    try {
      // Get account holdings from Hedera
      const accountIdObj = resolveAccountId(accountId);
      const holdings = await getAccountHoldings(accountIdObj);
      if (!holdings || holdings.tokens.length === 0) {
        return null;
      }

      const tokenCharts: TokenChartData[] = [];
      let totalValue = 0;
      let totalChange24h = 0;

      // Process each token holding
      for (const holding of holdings.tokens) {
        const symbol = holding.symbol || holding.tokenId;
        const chartData = await this.getTokenChartData(symbol, '24h', 'line');
        if (chartData) {
          tokenCharts.push(chartData);
          const balance = parseFloat(holding.balance);
          const tokenValue = balance * chartData.analytics.current_price;
          totalValue += tokenValue;
          totalChange24h += tokenValue * (chartData.analytics.price_change_percentage_24h / 100);
        }
      }

      // Add HBAR if present
      const hbarBalance = parseFloat(holdings.hbar.replace(' ℏ', ''));
      if (hbarBalance > 0) {
        const hbarChart = await this.getTokenChartData('HBAR', '24h', 'line');
        if (hbarChart) {
          tokenCharts.push(hbarChart);
          const hbarValue = hbarBalance * hbarChart.analytics.current_price;
          totalValue += hbarValue;
          totalChange24h += hbarValue * (hbarChart.analytics.price_change_percentage_24h / 100);
        }
      }

      // Calculate diversification
      const diversification = tokenCharts.map(chart => {
        let tokenValue = 0;
        if (chart.token === 'HBAR') {
          tokenValue = hbarBalance * chart.analytics.current_price;
        } else {
          const holding = holdings.tokens.find((t: TokenHolding) => t.symbol === chart.symbol);
          if (holding) {
            tokenValue = parseFloat(holding.balance) * chart.analytics.current_price;
          }
        }
        
        return {
          token: chart.symbol,
          percentage: totalValue > 0 ? (tokenValue / totalValue) * 100 : 0,
          value: tokenValue
        };
      }).sort((a, b) => b.percentage - a.percentage);

      return {
        accountId,
        tokens: tokenCharts,
        totalValue,
        totalChange24h,
        diversification
      };
    } catch (error) {
      console.error(`Error fetching portfolio chart data for ${accountId}:`, error);
      return null;
    }
  }

  async getMultiTokenCorrelation(tokens: string[], timeframe: '7d' | '30d' = '30d'): Promise<{
    correlationMatrix: number[][];
    tokens: string[];
    chartData: TokenChartData[];
  } | null> {
    try {
      const chartDataPromises = tokens.map(token => 
        this.getTokenChartData(token, timeframe, 'correlation')
      );
      
      const chartDataResults = await Promise.all(chartDataPromises);
      const validChartData = chartDataResults.filter(data => data !== null) as TokenChartData[];
      
      if (validChartData.length < 2) {
        return null;
      }

      // Calculate correlation matrix
      const correlationMatrix = this.calculateCorrelationMatrix(validChartData);
      
      return {
        correlationMatrix,
        tokens: validChartData.map(data => data.symbol),
        chartData: validChartData
      };
    } catch (error) {
      console.error('Error calculating token correlation:', error);
      return null;
    }
  }

  private convertToChartData(historicalPrices: HistoricalPrice[], chartType: string): ChartDataPoint[] {
    return historicalPrices.map(price => {
      const basePoint: ChartDataPoint = {
        timestamp: price.timestamp,
        price: price.price,
        volume: price.total_volume,
        marketCap: price.market_cap
      };

      // For candlestick charts, we'd need OHLC data
      // Since CoinGecko doesn't provide this in the free tier, we'll simulate it
      if (chartType === 'candlestick') {
        const volatility = price.price * 0.02; // 2% volatility simulation
        basePoint.open = price.price * (0.98 + Math.random() * 0.04);
        basePoint.high = price.price + volatility * Math.random();
        basePoint.low = price.price - volatility * Math.random();
        basePoint.close = price.price;
      }

      return basePoint;
    });
  }

  private async getHederaTokenMetrics(token: string): Promise<HederaTokenMetrics | undefined> {
    // This would integrate with Hedera Mirror Node API for HTS tokens
    // For now, we'll return undefined for non-Hedera tokens
    if (token.toUpperCase() !== 'HBAR') {
      return undefined;
    }

    // Mock Hedera metrics for HBAR
    return {
      tokenId: '0.0.0',
      symbol: 'HBAR',
      name: 'Hedera Hashgraph',
      totalSupply: 50000000000,
      decimals: 8,
      holders: 150000,
      transactions24h: 25000,
      volume24h: 5000000,
      priceUSD: 0.05, // This would be fetched from price service
      marketCap: 2500000000
    };
  }

  private calculateCorrelationMatrix(chartData: TokenChartData[]): number[][] {
    const n = chartData.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1; // Perfect correlation with itself
        } else {
          matrix[i][j] = this.calculatePearsonCorrelation(
            chartData[i].data.map(d => d.price),
            chartData[j].data.map(d => d.price)
          );
        }
      }
    }

    return matrix;
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Method to clear cache (useful for testing or manual refresh)
  clearCache(): void {
    this.cache.clear();
  }

  // Method to get cache statistics
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const marketDataService = new MarketDataService();