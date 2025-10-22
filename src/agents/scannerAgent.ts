import { A2AMessage, bus } from '../utils/bus.js';
import axios from 'axios';
import { fetchNewsHeadlines, fetchXSentiment } from '../services/news.js';

interface AnalysisResult {
  address: string;
  balance?: {
    hbars: string;
    tokens: any[];
  };
  riskScore?: number;
  recentTransactions?: any[];
  warnings?: string[];
  recommendations?: string[];
  marketData?: {
    sentiment: string;
    trends: any[];
  };
}

export class ScannerAgent {
  private agentName = 'scanner@portfolio.guard';
  private baseUrl = 'http://localhost:3000';

  constructor() {
    bus.registerAgent(this.agentName);
    this.initialize();
  }

  private initialize(): void {
    console.log(`🔍 Initializing Scanner Agent: ${this.agentName}`);
    
    // Register message handlers
    bus.on(`message:${this.agentName}`, this.handleMessage.bind(this));
    
    console.log(`✅ Scanner Agent initialized: ${this.agentName}`);
  }

  private async handleMessage(message: A2AMessage): Promise<void> {
    console.log(`🔍 Scanner received message:`, message.type, 'from', message.from);
    
    switch (message.type) {
      case 'analyze_address':
        await this.handleAddressAnalysis(message);
        break;
      default:
        console.log(`🔍 Unknown message type: ${message.type}`);
    }
  }

  private async handleAddressAnalysis(message: A2AMessage): Promise<void> {
    try {
      const { address, userId, requestId } = message.payload;
      console.log(`🔍 Starting comprehensive analysis for address: ${address}`);

      // Perform comprehensive analysis
      const analysis = await this.performComprehensiveAnalysis(address, userId);

      // Send response back to LLM agent
      bus.sendMessage({
        type: 'analysis_response',
        from: this.agentName,
        to: message.from,
        payload: {
          address,
          userId,
          requestId,
          analysis,
          success: true
        }
      });

      console.log(`✅ Analysis completed for ${address}`);
    } catch (error: any) {
      console.error(`❌ Analysis failed for ${message.payload.address}:`, error);
      
      // Send error response
      bus.sendMessage({
        type: 'analysis_response',
        from: this.agentName,
        to: message.from,
        payload: {
          address: message.payload.address,
          userId: message.payload.userId,
          requestId: message.payload.requestId,
          analysis: null,
          success: false,
          error: error.message
        }
      });
    }
  }

  private async performComprehensiveAnalysis(address: string, userId: string): Promise<AnalysisResult> {
    const analysis: AnalysisResult = {
      address,
      warnings: [],
      recommendations: []
    };

    try {
      // Create a unique analysis userId to avoid conflicts
      const analysisUserId = `analysis-${address.replace(/\./g, '-')}-${Date.now()}`;
      
      // 1. Get token holdings using existing endpoint
      console.log(`📊 Fetching holdings for ${address}...`);
      const holdingsResponse = await this.getTokenHoldings(address, analysisUserId);
      if (holdingsResponse) {
        analysis.balance = holdingsResponse;
      }

      // 2. Get market trends using X-trend endpoint
      console.log(`📈 Fetching market trends...`);
      const trendsResponse = await this.getMarketTrends(analysisUserId);
      if (trendsResponse) {
        analysis.marketData = trendsResponse;
      }

      // 3. Calculate risk score based on holdings and trends
      analysis.riskScore = this.calculateRiskScore(analysis);

      // 4. Generate warnings and recommendations
      this.generateInsights(analysis);

      console.log(`✅ Comprehensive analysis completed for ${address}`);
      return analysis;

    } catch (error: any) {
      console.error(`Error in comprehensive analysis:`, error);
      throw error;
    }
  }

  private async getTokenHoldings(address: string, userId: string): Promise<any> {
    try {
      // First, monitor the address for this user
      console.log(`📊 Monitoring address ${address} for user ${userId}...`);
      const monitorUrl = `${this.baseUrl}/api/${userId}/monitor`;
      console.log(`📊 Monitor URL: ${monitorUrl}`);
      
      const monitorResponse = await axios.post(monitorUrl, {
        address: address
      });

      console.log(`📊 Monitor response status: ${monitorResponse.status}`);
      console.log(`📊 Monitor response data:`, monitorResponse.data);

      if (!monitorResponse.data || !monitorResponse.data.ok) {
        console.warn(`Failed to monitor address ${address} for user ${userId}`);
        return null;
      }

      // Now get the holdings for the monitored user
      const holdingsUrl = `${this.baseUrl}/api/${userId}/holdings`;
      console.log(`📊 Holdings URL: ${holdingsUrl}`);
      
      const response = await axios.get(holdingsUrl);
      
      console.log(`📊 Holdings response status: ${response.status}`);
      console.log(`📊 Holdings response data:`, response.data);
      
      if (response.data && response.data.ok) {
        return {
          hbars: response.data.holdings?.hbar || '0',
          tokens: response.data.holdings?.tokens || []
        };
      }
      
      return null;
    } catch (error: any) {
      console.warn(`Failed to fetch holdings for ${address}:`, error.message);
      console.warn(`Error details:`, error.response?.status, error.response?.data);
      return null;
    }
  }

  private async getMarketTrends(userId: string): Promise<any> {
    try {
      const token = 'HBAR';
      console.log(`📈 Fetching market trends for ${token}...`);
      
      // Always fetch NewsAPI headlines
      const newsHeadlines = await fetchNewsHeadlines(token);
      console.log(`📰 Fetched ${newsHeadlines.length} news headlines`);
      
      // Fetch X sentiment (respects ENABLE_X_DATA internally)
      const xSentiment = await fetchXSentiment(token);
      console.log(`🐦 X sentiment: ${xSentiment.sentiment}${xSentiment.error ? ` (${xSentiment.error})` : ''}`);
      
      // Determine overall sentiment (prioritize X if available, fallback to neutral)
      let overallSentiment = 'neutral';
      if (!xSentiment.error && xSentiment.sentiment !== 'NEUTRAL') {
        overallSentiment = xSentiment.sentiment.toLowerCase();
      }
      
      const marketData = {
        sentiment: overallSentiment,
        trends: newsHeadlines,
        xSentiment: xSentiment.sentiment,
        xError: xSentiment.error,
        xTweets: xSentiment.tweets.slice(0, 3) // Top 3 tweets
      };
      
      console.log(`📈 Processed market data:`, {
        sentiment: marketData.sentiment,
        newsCount: newsHeadlines.length,
        xSentiment: marketData.xSentiment,
        xEnabled: !xSentiment.error?.includes('disabled')
      });
      
      return marketData;
    } catch (error: any) {
      console.warn(`📈 Failed to fetch market trends:`, error.message);
      return {
        sentiment: 'neutral',
        trends: [],
        xSentiment: 'NEUTRAL',
        xError: error.message
      };
    }
  }

  private calculateRiskScore(analysis: AnalysisResult): number {
    let riskScore = 5; // Base risk score

    // Adjust based on balance
    if (analysis.balance) {
      const hbarBalance = parseFloat(analysis.balance.hbars) || 0;
      
      // Very low balance increases risk
      if (hbarBalance < 10) {
        riskScore += 2;
      } else if (hbarBalance > 1000) {
        riskScore -= 1; // Large balance reduces risk slightly
      }

      // Token diversification
      const tokenCount = analysis.balance.tokens?.length || 0;
      if (tokenCount === 0) {
        riskScore += 1; // No diversification
      } else if (tokenCount > 5) {
        riskScore -= 1; // Good diversification
      }
    }

    // Adjust based on market sentiment
    if (analysis.marketData) {
      const sentiment = analysis.marketData.sentiment.toLowerCase();
      if (sentiment.includes('bearish') || sentiment.includes('negative')) {
        riskScore += 2;
      } else if (sentiment.includes('bullish') || sentiment.includes('positive')) {
        riskScore -= 1;
      }
    }

    // Ensure score is between 1-10
    return Math.max(1, Math.min(10, Math.round(riskScore)));
  }

  private generateInsights(analysis: AnalysisResult): void {
    const warnings = analysis.warnings!;
    const recommendations = analysis.recommendations!;

    // Balance-based insights
    if (analysis.balance) {
      const hbarBalance = parseFloat(analysis.balance.hbars) || 0;
      const tokenCount = analysis.balance.tokens?.length || 0;

      if (hbarBalance < 10) {
        warnings.push('Low HBAR balance may limit transaction capabilities');
        recommendations.push('Consider maintaining at least 10 HBAR for network fees');
      }

      if (tokenCount === 0) {
        recommendations.push('Consider diversifying with other Hedera tokens');
      } else if (tokenCount > 10) {
        warnings.push('High token diversification may increase management complexity');
      }
    }

    // Market-based insights
    if (analysis.marketData) {
      const sentiment = analysis.marketData.sentiment.toLowerCase();
      
      if (sentiment.includes('bearish')) {
        warnings.push('Current market sentiment is bearish - consider risk management');
        recommendations.push('Monitor positions closely and consider stop-loss strategies');
      } else if (sentiment.includes('bullish')) {
        recommendations.push('Positive market sentiment - good time for strategic investments');
      }
    }

    // Risk-based insights
    if (analysis.riskScore && analysis.riskScore > 7) {
      warnings.push('High risk profile detected');
      recommendations.push('Review portfolio allocation and consider risk reduction strategies');
    } else if (analysis.riskScore && analysis.riskScore < 3) {
      recommendations.push('Conservative portfolio - consider opportunities for growth');
    }
  }
}

// Export singleton instance
export const scannerAgent = new ScannerAgent();