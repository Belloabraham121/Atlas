import axios from 'axios';
import { getXBearer } from '../config/xAuth.js';

export interface Article {
  title: string;
  source?: string;
  description?: string;
  url: string;
  publishedAt?: string;
}

export interface SentimentResult {
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  tweets: Array<any>;
  error?: string;
}

export async function fetchNewsHeadlines(query: string): Promise<Article[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) throw new Error('Missing NEWSAPI_KEY');
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=10`;
  const resp = await axios.get(url, { headers: { 'X-Api-Key': key } });
  const articles = resp.data?.articles || [];
  return articles.map((a: any) => ({
    title: a.title,
    source: a.source?.name,
    description: a.description,
    url: a.url,
    publishedAt: a.publishedAt
  }));
}

export async function fetchXSentiment(query: string): Promise<SentimentResult> {
  const bearer = await getXBearer();
  if (!bearer) return { sentiment: 'NEUTRAL', tweets: [], error: 'Missing X bearer or API credentials' };
  try {
    const url = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&tweet.fields=public_metrics,created_at,lang`;
    const resp = await axios.get(url, { headers: { Authorization: `Bearer ${bearer}` } });
    const tweets = resp.data?.data || [];
    let score = 0;
    for (const t of tweets) {
      const text = (t.text || '').toLowerCase();
      if (text.includes('bullish') || text.includes('up') || text.includes('buy')) score += 1;
      if (text.includes('bearish') || text.includes('down') || text.includes('sell')) score -= 1;
    }
    const sentiment: SentimentResult['sentiment'] = score > 1 ? 'POSITIVE' : score < -1 ? 'NEGATIVE' : 'NEUTRAL';
    return { sentiment, tweets };
  } catch (e: any) {
    return { sentiment: 'NEUTRAL', tweets: [], error: e?.message || String(e) };
  }
}
