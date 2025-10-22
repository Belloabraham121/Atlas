import { bus, A2AMessage, RiskSummaryPayload, GraphReadyPayload } from '../utils/bus.js';

export class ChatAgent {
  private agentName = 'chat@portfolio.guard';

  constructor() {
    bus.registerAgent(this.agentName);
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    // Note: We don't set up general message handlers here to avoid interfering
    // with waitForResponses. The waitForResponses method will handle specific
    // message types when needed.
  }

  async processUserCommand(message: string, userId: string): Promise<{
    response: string;
    graphs?: any[];
    latency: number;
  }> {
    const startTime = Date.now();
    
    console.log(`💬 Processing command: "${message}" for user: ${userId}`);

    try {
      // Send query to LLM agent for natural language processing
      bus.sendMessage({
        type: 'llm_query',
        from: this.agentName,
        to: 'llm@portfolio.guard',
        payload: { query: message, userId }
      });

      // Wait for LLM response (increased timeout for analysis processing)
      const responses = await bus.waitForResponses(this.agentName, ['llm_response'], 30000);
      const llmResponse = responses[0];

      if (llmResponse && llmResponse.payload.success) {
        // Check if the LLM response indicates a specific action should be taken
        const response = llmResponse.payload.response;
        
        // Parse if LLM suggests specific actions
        const intent = this.parseUserIntent(message);
        
        if (intent.type === 'scan_user') {
          // Execute scan and combine with LLM insights
          const scanResult = await this.handleScanUser(intent.userId || userId, intent.token || 'all', startTime);
          return {
            response: `${response}\n\n${scanResult.response}`,
            graphs: scanResult.graphs,
            latency: Date.now() - startTime
          };
        } else if (intent.type === 'generate_graph') {
          // Execute graph generation and combine with LLM insights
          const graphResult = await this.handleGenerateGraph(intent.userId || userId, startTime);
          return {
            response: `${response}\n\n${graphResult.response}`,
            graphs: graphResult.graphs,
            latency: Date.now() - startTime
          };
        } else {
          // Return LLM response for general queries
          return {
            response: response,
            latency: Date.now() - startTime
          };
        }
      } else {
        // Fallback to original parsing if LLM fails
        const intent = this.parseUserIntent(message);
        
        if (intent.type === 'scan_user') {
          return await this.handleScanUser(intent.userId || userId, intent.token || 'all', startTime);
        } else if (intent.type === 'generate_graph') {
          return await this.handleGenerateGraph(intent.userId || userId, startTime);
        } else {
          return {
            response: "🤖 I can help you scan user portfolios or generate graphs. Try:\n• 'check user1's thing'\n• 'check user1 graph'",
            latency: Date.now() - startTime
          };
        }
      }
    } catch (error: any) {
      console.error('Error processing user command:', error);
      
      // Fallback to original parsing if LLM fails
      const intent = this.parseUserIntent(message);
      
      if (intent.type === 'scan_user') {
        return await this.handleScanUser(intent.userId || userId, intent.token || 'all', startTime);
      } else if (intent.type === 'generate_graph') {
        return await this.handleGenerateGraph(intent.userId || userId, startTime);
      } else {
        return {
          response: "🤖 I can help you scan user portfolios or generate graphs. Try:\n• 'check user1's thing'\n• 'check user1 graph'",
          latency: Date.now() - startTime
        };
      }
    }
  }

  private parseUserIntent(message: string): {
    type: 'scan_user' | 'generate_graph' | 'unknown';
    userId?: string;
    token?: string;
  } {
    const lowerMessage = message.toLowerCase();
    
    // Extract user ID from message
    const userMatch = lowerMessage.match(/user(\w+)/);
    const userId = userMatch ? `user${userMatch[1]}` : undefined;

    if (lowerMessage.includes('check') && lowerMessage.includes('graph')) {
      return { type: 'generate_graph', userId };
    } else if (lowerMessage.includes('check') && (lowerMessage.includes('thing') || lowerMessage.includes('portfolio'))) {
      return { type: 'scan_user', userId, token: 'all' };
    }

    return { type: 'unknown' };
  }

  private async handleScanUser(userId: string, token: string, startTime: number): Promise<{
    response: string;
    graphs?: any[];
    latency: number;
  }> {
    try {
      // Broadcast scan requests to wallet and xtrend agents
      bus.sendMessage({
        type: 'scan_request',
        from: this.agentName,
        to: 'wallet@portfolio.guard',
        payload: { userId, token }
      });

      bus.sendMessage({
        type: 'scan_request',
        from: this.agentName,
        to: 'xtrend@portfolio.guard',
        payload: { userId, token }
      });

      // Wait for responses
      const responses = await bus.waitForResponses(
        this.agentName,
        ['risk_summary'],
        5000
      );

      const riskSummary = responses.find(r => r.type === 'risk_summary');
      
      if (riskSummary) {
        const payload = riskSummary.payload as RiskSummaryPayload;
        const response = this.formatRiskSummaryResponse(payload, userId);
        
        return {
          response,
          latency: Date.now() - startTime
        };
      } else {
        return {
          response: `🤖 ⚠️ No response received for ${userId}. The user might not be monitored or agents are not responding.`,
          latency: Date.now() - startTime
        };
      }
    } catch (error) {
      console.error('Error in handleScanUser:', error);
      return {
        response: `🤖 ❌ Error scanning ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        latency: Date.now() - startTime
      };
    }
  }

  private async handleGenerateGraph(userId: string, startTime: number): Promise<{
    response: string;
    graphs?: any[];
    latency: number;
  }> {
    try {
      // Request graph generation
      bus.sendMessage({
        type: 'generate_graph',
        from: this.agentName,
        to: 'graph@portfolio.guard',
        payload: { userId, timeframe: '24h' }
      });

      // Wait for graph response
      const responses = await bus.waitForResponses(
        this.agentName,
        ['graph_ready'],
        5000
      );

      const graphResponse = responses.find(r => r.type === 'graph_ready');
      
      if (graphResponse) {
        const payload = graphResponse.payload as GraphReadyPayload;
        
        return {
          response: `📈 Graph generated for ${userId}`,
          graphs: [payload.config],
          latency: Date.now() - startTime
        };
      } else {
        return {
          response: `🤖 ⚠️ No graph generated for ${userId}. The graph agent might not be responding.`,
          latency: Date.now() - startTime
        };
      }
    } catch (error) {
      console.error('Error in handleGenerateGraph:', error);
      return {
        response: `🤖 ❌ Error generating graph for ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        latency: Date.now() - startTime
      };
    }
  }

  private formatRiskSummaryResponse(payload: RiskSummaryPayload, userId: string): string {
    let response = `🤖 🔍 LIVE SCAN: ${userId} (Completed)\n\n`;

    // Format token information
    for (const [tokenSymbol, tokenData] of Object.entries(payload.tokens)) {
      const riskEmoji = this.getRiskEmoji(tokenData.risk);
      const deltaSign = tokenData.wallet_delta >= 0 ? '+' : '';
      
      response += `${tokenSymbol}: ${riskEmoji} ${tokenData.risk}\n`;
      response += `├── Wallet: ${deltaSign}${tokenData.wallet_delta.toLocaleString()} ${tokenSymbol}\n`;
      response += `├── X Trends: ${tokenData.x_volume_spike} volume spike\n`;
      
      if (tokenData.top_tweets && tokenData.top_tweets.length > 0) {
        response += `│   └── ${tokenData.top_tweets[0]}\n`;
      }
      
      response += `└── Risk Score: ${this.getRiskScore(tokenData.risk)}/10\n\n`;
    }

    // Portfolio summary
    const changeSign = payload.change_24h >= 0 ? '+' : '';
    response += `📊 TOTAL PORTFOLIO: $${payload.total_value.toLocaleString()} (${changeSign}${payload.change_24h}% today)\n\n`;

    // Proof link
    if (payload.onchain_proof) {
      response += `🔗 Proof: Hashscan.io/tx/${payload.onchain_proof}`;
    }

    return response;
  }

  private getRiskEmoji(risk: string): string {
    switch (risk) {
      case 'CRITICAL': return '🚨';
      case 'HIGH': return '🔴';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      case 'SAFE': return '🟢';
      default: return '❓';
    }
  }

  private getRiskScore(risk: string): string {
    switch (risk) {
      case 'CRITICAL': return '9.2';
      case 'HIGH': return '7.5';
      case 'MEDIUM': return '5.0';
      case 'LOW': return '2.5';
      case 'SAFE': return '1.4';
      default: return '5.0';
    }
  }

  destroy(): void {
    bus.unregisterAgent(this.agentName);
  }
}

export const chatAgent = new ChatAgent();