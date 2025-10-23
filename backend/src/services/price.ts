import axios from 'axios';

// Maps common ticker symbols to CoinGecko IDs
const TICKER_TO_COINGECKO: Record<string, string> = {
  HBAR: 'hedera-hashgraph',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDC: 'usd-coin',
  SOL: 'solana'
};

export async function fetchPriceUSD(tickerOrId: string): Promise<number> {
  const id = TICKER_TO_COINGECKO[tickerOrId.toUpperCase()] || tickerOrId;
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`;
  const resp = await axios.get(url);
  return resp.data?.[id]?.usd || 0;
}
