import {
  fetchNewsHeadlines,
  fetchXSentiment,
  Article,
  SentimentResult,
} from "../services/news.js";
import { fetchPriceUSD } from "../services/price.js";
import {
  bus,
  XNewsAlertPayload,
  A2AMessage,
  ScanRequestPayload,
} from "../utils/bus.js";
import { chatAgent } from "./chatAgent.js";

export interface AnalyzeTokenResult {
  token: string;
  news: Article[];
  x: SentimentResult;
}

export async function analyzeToken(token: string): Promise<AnalyzeTokenResult> {
  const query = token.toUpperCase();
  const [news, x] = await Promise.all([
    fetchNewsHeadlines(query),
    fetchXSentiment(query),
  ]);
  return { token: query, news, x };
}

export async function analyzeMultipleTokens(tokens: string[]): Promise<AnalyzeTokenResult[]> {
  console.log(`📰 Analyzing multiple tokens: ${tokens.join(", ")}`);
  
  // Analyze each token in parallel
  const results = await Promise.all(
    tokens.map(token => analyzeToken(token))
  );
  
  return results;
}

export async function analyzeFlexibleQueryFromPrompt(
  userPrompt: string, 
  userId: string
): Promise<{
  combinedNews: Article[];
  tokenAnalysis: AnalyzeTokenResult[];
  overallSentiment: string;
  searchTerms: string[];
}> {
  console.log(`🤖 Analyzing news based on user prompt: "${userPrompt}"`);
  
  // Use LLM to extract relevant search terms from the user prompt
  const searchTerms = await chatAgent.extractNewsSearchTerms(userPrompt, userId);
  
  // Perform flexible analysis with the extracted terms
  const analysis = await analyzeFlexibleQuery(searchTerms);
  
  return {
    ...analysis,
    searchTerms
  };
}

export async function analyzeFlexibleQuery(searchTerms: string[]): Promise<{
  combinedNews: Article[];
  tokenAnalysis: AnalyzeTokenResult[];
  overallSentiment: string;
}> {
  console.log(`🔍 Flexible news analysis for terms: ${searchTerms.join(", ")}`);
  
  // Analyze each search term
  const tokenAnalysis = await analyzeMultipleTokens(searchTerms);
  
  // Combine all news articles
  const combinedNews: Article[] = [];
  let totalSentimentScore = 0;
  let validSentiments = 0;
  
  tokenAnalysis.forEach(result => {
    combinedNews.push(...result.news);
    
    // Calculate overall sentiment
    if (result.x.sentiment && result.x.sentiment !== 'NEUTRAL') {
      if (result.x.sentiment === 'POSITIVE') {
        totalSentimentScore += 1;
      } else if (result.x.sentiment === 'NEGATIVE') {
        totalSentimentScore -= 1;
      }
      validSentiments++;
    }
  });
  
  // Determine overall sentiment
  let overallSentiment = 'neutral';
  if (validSentiments > 0) {
    const avgSentiment = totalSentimentScore / validSentiments;
    if (avgSentiment > 0.2) {
      overallSentiment = 'positive';
    } else if (avgSentiment < -0.2) {
      overallSentiment = 'negative';
    }
  }
  
  // Remove duplicates and sort by date
  const uniqueNews = combinedNews.filter((article, index, self) => 
    index === self.findIndex(a => a.url === article.url)
  ).sort((a, b) => {
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return dateB - dateA;
  });
  
  return {
    combinedNews: uniqueNews.slice(0, 20), // Limit to top 20 articles
    tokenAnalysis,
    overallSentiment
  };
}

export async function sendXNewsAlert(
  userId: string,
  token: string
): Promise<XNewsAlertPayload> {
  const { news, x } = await analyzeToken(token);
  const priceUSD = await fetchPriceUSD(token);
  const payload: XNewsAlertPayload = {
    userId,
    token: token.toUpperCase(),
    sentiment: x.sentiment,
    priceUSD,
    headlines: news.map((n) => ({
      title: n.title,
      source: n.source,
      url: n.url,
      publishedAt: n.publishedAt,
    })),
    timestamp: new Date().toISOString(),
    error: x.error,
  };
  bus.emit("x_news_alert", payload);
  return payload;
}

// XTrend Agent Class for A2A messaging
export class XTrendAgent {
  private agentName = "xtrend@portfolio.guard";

  constructor() {
    bus.registerAgent(this.agentName);
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    bus.on(`message:${this.agentName}`, (message: A2AMessage) => {
      console.log(
        `📰 XTrend Agent received: ${message.type} from ${message.from}`
      );
      this.handleMessage(message);
    });
  }

  private async handleMessage(message: A2AMessage): Promise<void> {
    switch (message.type) {
      case "scan_request":
        await this.handleScanRequest(message);
        break;
      default:
        console.log(`❓ XTrend Agent: Unknown message type: ${message.type}`);
    }
  }

  private async handleScanRequest(message: A2AMessage): Promise<void> {
    try {
      const payload = message.payload as ScanRequestPayload;
      console.log(
        `📰 Analyzing X sentiment for user: ${payload.userId}, token: ${payload.token}`
      );

      // Analyze token sentiment
      const { news, x } = await analyzeToken(payload.token);
      const priceUSD = await fetchPriceUSD(payload.token);

      // Calculate volume spike (simulated for demo)
      const volumeSpike = Math.floor(Math.random() * 500) + 10; // Random between 10-510%

      // Create X news alert payload
      const xNewsAlert: XNewsAlertPayload = {
        userId: payload.userId,
        token: payload.token.toUpperCase(),
        sentiment: x.sentiment,
        priceUSD,
        headlines: news.map((n) => ({
          title: n.title,
          source: n.source,
          url: n.url,
          publishedAt: n.publishedAt,
        })),
        timestamp: new Date().toISOString(),
        error: x.error,
      };

      // Send to portfolio agent
      bus.sendMessage({
        type: "x_news_alert",
        from: this.agentName,
        to: "portfolio@portfolio.guard",
        payload: {
          ...xNewsAlert,
          volume_spike: `${volumeSpike}%`,
          top_tweets: x.tweets
            .slice(0, 3)
            .map((t) => t.text || "Tweet content"),
        },
      });

      console.log(
        `📰 Sent X sentiment analysis for ${payload.token} to portfolio agent`
      );
    } catch (error) {
      console.error("Error in XTrend scan:", error);
    }
  }

  destroy(): void {
    bus.unregisterAgent(this.agentName);
  }
}

export const xTrendAgent = new XTrendAgent();
