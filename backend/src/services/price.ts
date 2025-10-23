import axios from 'axios';

// CoinGecko API configuration
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const getApiHeaders = () => {
  const headers: any = {
    'Accept': 'application/json',
  };
  if (COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = COINGECKO_API_KEY;
  }
  return headers;
};

// Maps common ticker symbols to CoinGecko IDs
const TICKER_TO_COINGECKO: Record<string, string> = {
  HBAR: 'hedera-hashgraph',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDC: 'usd-coin',
  SOL: 'solana',
  USDT: 'tether',
  ADA: 'cardano',
  DOT: 'polkadot',
  LINK: 'chainlink',
  MATIC: 'matic-network'
};

export interface TokenMarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d: number;
  price_change_percentage_30d: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

export interface HistoricalPrice {
  timestamp: number;
  price: number;
  market_cap?: number;
  total_volume?: number;
}

export interface TokenAnalytics {
  token: string;
  timeframe: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  volume_24h: number;
  market_cap: number;
  historical_prices: HistoricalPrice[];
  volatility: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  support_levels: number[];
  resistance_levels: number[];
}

export async function fetchPriceUSD(tickerOrId: string): Promise<number> {
  const id = TICKER_TO_COINGECKO[tickerOrId.toUpperCase()] || tickerOrId;
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`;
  const resp = await axios.get(url, { headers: getApiHeaders() });
  return resp.data?.[id]?.usd || 0;
}

export async function fetchTokenMarketData(tickerOrId: string): Promise<TokenMarketData | null> {
  try {
    const id = TICKER_TO_COINGECKO[tickerOrId.toUpperCase()] || tickerOrId;
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
    
    const resp = await axios.get(url, { headers: getApiHeaders() });
    const data = resp.data;
    
    if (!data.market_data) {
      return null;
    }
    
    return {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      current_price: data.market_data.current_price?.usd || 0,
      market_cap: data.market_data.market_cap?.usd || 0,
      market_cap_rank: data.market_cap_rank || 0,
      total_volume: data.market_data.total_volume?.usd || 0,
      price_change_24h: data.market_data.price_change_24h || 0,
      price_change_percentage_24h: data.market_data.price_change_percentage_24h || 0,
      price_change_percentage_7d: data.market_data.price_change_percentage_7d || 0,
      price_change_percentage_30d: data.market_data.price_change_percentage_30d || 0,
      circulating_supply: data.market_data.circulating_supply || 0,
      total_supply: data.market_data.total_supply || 0,
      max_supply: data.market_data.max_supply || 0,
      ath: data.market_data.ath?.usd || 0,
      ath_change_percentage: data.market_data.ath_change_percentage?.usd || 0,
      ath_date: data.market_data.ath_date?.usd || '',
      atl: data.market_data.atl?.usd || 0,
      atl_change_percentage: data.market_data.atl_change_percentage?.usd || 0,
      atl_date: data.market_data.atl_date?.usd || '',
      last_updated: data.last_updated || ''
    };
  } catch (error) {
    console.error(`Error fetching market data for ${tickerOrId}:`, error);
    return null;
  }
}

export async function fetchHistoricalPrices(
  tickerOrId: string, 
  days: number = 30,
  interval: 'daily' | 'hourly' = 'daily'
): Promise<HistoricalPrice[]> {
  try {
    const id = TICKER_TO_COINGECKO[tickerOrId.toUpperCase()] || tickerOrId;
    const intervalParam = interval === 'hourly' && days <= 1 ? 'hourly' : 'daily';
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=${intervalParam}`;
    
    const resp = await axios.get(url, { headers: getApiHeaders() });
    const data = resp.data;
    
    if (!data.prices) {
      return [];
    }
    
    return data.prices.map((price: [number, number], index: number) => ({
      timestamp: price[0],
      price: price[1],
      market_cap: data.market_caps?.[index]?.[1],
      total_volume: data.total_volumes?.[index]?.[1]
    }));
  } catch (error) {
    console.error(`Error fetching historical prices for ${tickerOrId}:`, error);
    return [];
  }
}

export async function fetchTokenAnalytics(
  tickerOrId: string,
  timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
): Promise<TokenAnalytics | null> {
  try {
    const marketData = await fetchTokenMarketData(tickerOrId);
    if (!marketData) {
      return null;
    }
    
    // Determine days for historical data based on timeframe
    const daysMap = { '1h': 1, '24h': 1, '7d': 7, '30d': 30 };
    const days = daysMap[timeframe];
    const interval = timeframe === '1h' ? 'hourly' : 'daily';
    
    const historicalPrices = await fetchHistoricalPrices(tickerOrId, days, interval);
    
    // Calculate volatility (standard deviation of price changes)
    const volatility = calculateVolatility(historicalPrices);
    
    // Determine trend based on recent price movements
    const trend = determineTrend(historicalPrices, marketData.price_change_percentage_24h);
    
    // Calculate support and resistance levels
    const { supportLevels, resistanceLevels } = calculateSupportResistance(historicalPrices);
    
    return {
      token: tickerOrId,
      timeframe,
      current_price: marketData.current_price,
      price_change_24h: marketData.price_change_24h,
      price_change_percentage_24h: marketData.price_change_percentage_24h,
      volume_24h: marketData.total_volume,
      market_cap: marketData.market_cap,
      historical_prices: historicalPrices,
      volatility,
      trend,
      support_levels: supportLevels,
      resistance_levels: resistanceLevels
    };
  } catch (error) {
    console.error(`Error fetching token analytics for ${tickerOrId}:`, error);
    return null;
  }
}

function calculateVolatility(prices: HistoricalPrice[]): number {
  if (prices.length < 2) return 0;
  
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const return_rate = (prices[i].price - prices[i-1].price) / prices[i-1].price;
    returns.push(return_rate);
  }
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance) * 100; // Return as percentage
}

function determineTrend(prices: HistoricalPrice[], priceChange24h: number): 'bullish' | 'bearish' | 'neutral' {
  if (prices.length < 2) {
    return priceChange24h > 2 ? 'bullish' : priceChange24h < -2 ? 'bearish' : 'neutral';
  }
  
  const recentPrices = prices.slice(-5); // Last 5 data points
  let upCount = 0;
  let downCount = 0;
  
  for (let i = 1; i < recentPrices.length; i++) {
    if (recentPrices[i].price > recentPrices[i-1].price) upCount++;
    else if (recentPrices[i].price < recentPrices[i-1].price) downCount++;
  }
  
  if (upCount > downCount && priceChange24h > 1) return 'bullish';
  if (downCount > upCount && priceChange24h < -1) return 'bearish';
  return 'neutral';
}

function calculateSupportResistance(prices: HistoricalPrice[]): { supportLevels: number[], resistanceLevels: number[] } {
  if (prices.length < 10) {
    return { supportLevels: [], resistanceLevels: [] };
  }
  
  const priceValues = prices.map(p => p.price);
  const sortedPrices = [...priceValues].sort((a, b) => a - b);
  
  // Simple support/resistance calculation based on price clusters
  const supportLevels = [
    sortedPrices[Math.floor(sortedPrices.length * 0.1)], // 10th percentile
    sortedPrices[Math.floor(sortedPrices.length * 0.25)], // 25th percentile
  ];
  
  const resistanceLevels = [
    sortedPrices[Math.floor(sortedPrices.length * 0.75)], // 75th percentile
    sortedPrices[Math.floor(sortedPrices.length * 0.9)], // 90th percentile
  ];
  
  return { supportLevels, resistanceLevels };
}
