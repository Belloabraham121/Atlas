import { bus, RiskSummaryPayload, GraphReadyPayload } from "../utils/bus.js";

export class ChatAgent {
  private agentName = "chat@portfolio.guard";

  constructor() {
    bus.registerAgent(this.agentName);
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    // Note: We don't set up general message handlers here to avoid interfering
    // with waitForResponses. The waitForResponses method will handle specific
    // message types when needed.
  }

  async processUserCommand(
    message: string,
    userId: string
  ): Promise<{
    response: string;
    graphs?: any[];
    latency: number;
  }> {
    const startTime = Date.now();

    console.log(`💬 Processing command: "${message}" for user: ${userId}`);

    try {
      // Send query to LLM agent for natural language processing
      bus.sendMessage({
        type: "llm_query",
        from: this.agentName,
        to: "llm@portfolio.guard",
        payload: { query: message, userId },
      });

      // Wait for LLM response (increased timeout for analysis processing)
      const responses = await bus.waitForResponses(
        this.agentName,
        ["llm_response"],
        30000
      );
      const llmResponse = responses[0];

      if (llmResponse && llmResponse.payload.success) {
        // Check if the LLM response indicates a specific action should be taken
        const response = llmResponse.payload.response;

        // Parse if LLM suggests specific actions
        const intent = this.parseUserIntent(message, userId);

        if (intent.type === "scan_user") {
          // Execute scan and combine with LLM insights
          const scanResult = await this.handleScanUser(
            intent.userId || userId,
            intent.token || "all",
            startTime
          );
          return {
            response: `${response}\n\n${scanResult.response}`,
            graphs: scanResult.graphs,
            latency: Date.now() - startTime,
          };
        } else if (intent.type === "generate_graph") {
          // Execute graph generation and combine with LLM insights
          const graphResult = await this.handleGenerateGraph(
            intent.userId || userId,
            startTime
          );
          return {
            response: `${response}\n\n${graphResult.response}`,
            graphs: graphResult.graphs,
            latency: Date.now() - startTime,
          };
        } else if (intent.type === "generate_token_chart") {
          // Execute token chart generation and combine with LLM insights
          const tokenChartResult = await this.handleGenerateTokenChart(
            intent.token || "HBAR",
            intent.timeframe || "24h",
            intent.chartType || "price",
            intent.userId || userId,
            startTime
          );
          return {
            response: `${response}\n\n${tokenChartResult.response}`,
            graphs: tokenChartResult.graphs,
            latency: Date.now() - startTime,
          };
        } else {
          // Return LLM response for general queries
          return {
            response: response,
            latency: Date.now() - startTime,
          };
        }
      } else {
        // Fallback to original parsing if LLM fails
        const intent = this.parseUserIntent(message, userId);

        if (intent.type === "scan_user") {
          return await this.handleScanUser(
            intent.userId || userId,
            intent.token || "all",
            startTime
          );
        } else if (intent.type === "generate_graph") {
          return await this.handleGenerateGraph(
            intent.userId || userId,
            startTime
          );
        } else if (intent.type === "generate_token_chart") {
          return await this.handleGenerateTokenChart(
            intent.token || "HBAR",
            intent.timeframe || "24h",
            intent.chartType || "price",
            intent.userId || userId,
            startTime
          );
        } else {
          return {
            response:
              "🤖 I can help you scan user portfolios, generate graphs, or create token charts. Try:\n• 'check user1's thing'\n• 'generate graph'\n• 'show me HBAR price history'\n• 'chart for token 0.0.123456'",
            latency: Date.now() - startTime,
          };
        }
      }
    } catch (error: any) {
      console.error("Error processing user command:", error);

      // Fallback to original parsing if LLM fails
      const intent = this.parseUserIntent(message, userId);

      if (intent.type === "scan_user") {
        return await this.handleScanUser(
          intent.userId || userId,
          intent.token || "all",
          startTime
        );
      } else if (intent.type === "generate_graph") {
        return await this.handleGenerateGraph(
          intent.userId || userId,
          startTime
        );
      } else if (intent.type === "generate_token_chart") {
        return await this.handleGenerateTokenChart(
          intent.token || "HBAR",
          intent.timeframe || "24h",
          intent.chartType || "price",
          intent.userId || userId,
          startTime
        );
      } else {
        return {
          response:
            "🤖 I can help you scan user portfolios, generate graphs, or create token charts. Try:\n• 'check user1's thing'\n• 'generate graph'\n• 'show me HBAR price history'\n• 'chart for token 0.0.123456'",
          latency: Date.now() - startTime,
        };
      }
    }
  }

  private parseUserIntent(
    message: string,
    contextUserId: string
  ): {
    type: "scan_user" | "generate_graph" | "generate_token_chart" | "summary_only" | "unknown";
    userId?: string;
    token?: string;
    chartType?: string;
    timeframe?: string;
    isSelfScan?: boolean;
    needsGraph?: boolean;
    needsFullAnalysis?: boolean;
    needsSummaryOnly?: boolean;
  } {
    const lowerMessage = message.toLowerCase();

    // Extract explicit addresses from message (Hedera account IDs like 0.0.2)
    const hederaAccountMatch = lowerMessage.match(/(\d+\.\d+\.\d+)/);
    const userMatch = lowerMessage.match(/user(\w+)/);

    // Extract token symbols and token IDs (ordered by length to prioritize longer matches)
    const tokenSymbolMatch = lowerMessage.match(/\b(ethereum|bitcoin|hedera|polygon|cardano|polkadot|chainlink|uniswap|compound|synthetix|balancer|sushiswap|decentraland|numeraire|republic|loopring|alchemix|olympus|liquity|sandbox|chromia|aragon|bancor|iexec|enjin|smooth|alien|convex|maker|yearn|curve|hbar|usdc|usdt|btc|eth|matic|ada|dot|link|uni|aave|comp|mkr|snx|yfi|1inch|crv|bal|sushi|alpha|cream|badger|rook|farm|pickle|cover|armor|bond|digg|bnt|knc|kyber|lrc|zrx|ren|storj|grt|uma|band|ocean|fet|agi|nmr|rlc|ant|mana|enj|sand|axs|axie|slp|chr|alice|tlm|audio|rari|tribe|fei|rai|lusd|frax|ohm|klima|time|memo|spell|ice|mim|cvx|fxs|alcx)\b/);
    const tokenIdMatch = lowerMessage.match(/token\s+(\d+\.\d+\.\d+)/);
    
    // Extract timeframe - enhanced to handle flexible formats
    const timeframeMatch = lowerMessage.match(/\b(1h|4h|24h|7d|30d|1y|all)\b/) || 
                          lowerMessage.match(/\b(hour|day|week|month|year)\b/) ||
                          lowerMessage.match(/\b(\d+)\s*(days?|hours?|weeks?|months?|years?)\b/) ||
                          lowerMessage.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*(days?|hours?|weeks?|months?|years?)\b/);
    
    // Extract chart type
    const chartTypeMatch = lowerMessage.match(/\b(price|volume|market cap|correlation|performance|history)\b/);

    // Check for graph-related keywords
    const graphKeywords = [
      "graph", "chart", "visualization", "visual", "plot", "diagram", 
      "graph representation", "chart representation", "visual representation"
    ];
    const needsGraph = graphKeywords.some(keyword => lowerMessage.includes(keyword));
    


    // Check for summary-only keywords
    const summaryKeywords = [
      "summary", "summarize", "overview", "brief", "quick look", "tell me about",
      "what's in", "what does", "describe", "explain", "breakdown"
    ];
    const needsSummaryOnly = summaryKeywords.some(keyword => lowerMessage.includes(keyword));

    // Check for full analysis keywords
    const fullAnalysisKeywords = [
      "full analysis", "complete analysis", "detailed analysis", "deep dive",
      "comprehensive", "thorough", "in-depth", "analyze everything"
    ];
    const needsFullAnalysis = fullAnalysisKeywords.some(keyword => lowerMessage.includes(keyword));

    // Check for self-referential patterns
    const selfPatterns = [
      "my wallet",
      "my portfolio",
      "my account",
      "my holdings",
      "my balance",
      "my tokens",
      "my assets",
      "myself",
      "me",
      "i have",
      "i hold",
    ];
    const isSelfReference = selfPatterns.some((pattern) =>
      lowerMessage.includes(pattern)
    );

    // Determine target address with context-aware routing
    let targetUserId: string | undefined;
    let isSelfScan = false;

    if (hederaAccountMatch) {
      // Explicit address provided - scan that specific address
      targetUserId = hederaAccountMatch[1];
      isSelfScan = false;
    } else if (userMatch) {
      // Legacy user format
      targetUserId = `user${userMatch[1]}`;
      isSelfScan = false;
    } else if (isSelfReference) {
      // Self-referential language - use context userId
      targetUserId = contextUserId;
      isSelfScan = true;
    } else if (
      lowerMessage.includes("scan") ||
      lowerMessage.includes("analyze") ||
      lowerMessage.includes("check")
    ) {
      // Generic scan without specific target - default to self
      targetUserId = contextUserId;
      isSelfScan = true;
    }

    // Determine token for analysis
    let token = "HBAR"; // Default token
    if (tokenSymbolMatch) {
      const matchedToken = tokenSymbolMatch[1].toLowerCase();
      // Map full token names to symbols
      const tokenMapping: { [key: string]: string } = {
        'bitcoin': 'BTC',
        'ethereum': 'ETH',
        'hedera': 'HBAR',
        'polygon': 'MATIC',
        'cardano': 'ADA',
        'polkadot': 'DOT',
        'chainlink': 'LINK',
        'uniswap': 'UNI',
        'compound': 'COMP',
        'maker': 'MKR',
        'synthetix': 'SNX',
        'yearn': 'YFI',
        'curve': 'CRV',
        'balancer': 'BAL',
        'sushiswap': 'SUSHI',
        'bancor': 'BNT',
        'kyber': 'KNC',
        'loopring': 'LRC',
        'republic': 'REN',
        'graph': 'GRT',
        'numeraire': 'NMR',
        'iexec': 'RLC',
        'aragon': 'ANT',
        'decentraland': 'MANA',
        'enjin': 'ENJ',
        'sandbox': 'SAND',
        'axie': 'AXS',
        'smooth': 'SLP',
        'chromia': 'CHR',
        'alien': 'TLM',
        'liquity': 'LUSD',
        'olympus': 'OHM',
        'convex': 'CVX',
        'alchemix': 'ALCX'
      };
      
      token = tokenMapping[matchedToken] || matchedToken.toUpperCase();
    } else if (tokenIdMatch) {
      token = tokenIdMatch[1];
    }

    // Determine timeframe
    let timeframe = "24h"; // Default timeframe
    if (timeframeMatch) {
      const tf = timeframeMatch[1];
      const tf2 = timeframeMatch[2]; // For patterns with numbers and units
      
      // Handle exact formats (1h, 4h, 24h, 7d, 30d, 1y, all)
      if (tf && !tf2 && /^(1h|4h|24h|7d|30d|1y|all)$/.test(tf)) {
        timeframe = tf;
      }
      // Handle singular words (hour, day, week, month, year)
      else if (tf === "hour") timeframe = "1h";
      else if (tf === "day") timeframe = "24h";
      else if (tf === "week") timeframe = "7d";
      else if (tf === "month") timeframe = "30d";
      else if (tf === "year") timeframe = "1y";
      // Handle number + unit patterns (7 days, 2 weeks, etc.)
      else if (tf && tf2) {
        const num = parseInt(tf);
        const unit = tf2.toLowerCase();
        
        if (unit.startsWith('hour')) {
          timeframe = `${num}h`;
        } else if (unit.startsWith('day')) {
          timeframe = `${num}d`;
        } else if (unit.startsWith('week')) {
          timeframe = `${num * 7}d`;
        } else if (unit.startsWith('month')) {
          timeframe = `${num * 30}d`;
        } else if (unit.startsWith('year')) {
          timeframe = `${num}y`;
        }
      }
      // Handle word numbers (one, two, three, etc.)
      else if (tf && tf2 && /^(one|two|three|four|five|six|seven|eight|nine|ten)$/.test(tf)) {
        const wordToNumber: { [key: string]: number } = {
          'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
          'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
        };
        const num = wordToNumber[tf];
        const unit = tf2.toLowerCase();
        
        if (unit.startsWith('hour')) {
          timeframe = `${num}h`;
        } else if (unit.startsWith('day')) {
          timeframe = `${num}d`;
        } else if (unit.startsWith('week')) {
          timeframe = `${num * 7}d`;
        } else if (unit.startsWith('month')) {
          timeframe = `${num * 30}d`;
        } else if (unit.startsWith('year')) {
          timeframe = `${num}y`;
        }
      }
      else {
         timeframe = tf;
       }
    }

    // Determine chart type
    let chartType = "price"; // Default chart type
    if (chartTypeMatch) {
      chartType = chartTypeMatch[1];
    }

    // Check for news and market trends requests first (higher priority)
    const newsPatterns = [
      "news",
      "market trends",
      "market trend",
      "sentiment",
      "headlines",
      "what's happening",
      "latest news",
      "news about",
      "market analysis",
      "market update"
    ];
    
    const isNewsRequest = newsPatterns.some((pattern) =>
      lowerMessage.includes(pattern)
    );
    
    if (isNewsRequest) {
      // For news requests, default to contextUserId if no specific target is set
      const newsTargetUserId = targetUserId || contextUserId;
      return {
        type: "scan_user" as const,
        userId: newsTargetUserId,
        token: "all" as const,
        isSelfScan: targetUserId ? isSelfScan : true,
        needsGraph: false,
        needsFullAnalysis: true,
        needsSummaryOnly: false,
      };
    }

    // Check for token-specific graph generation requests (more specific patterns)
    const tokenGraphPatterns = [
      "price history",
      "price chart",
      "token chart",
      "show me chart",
      "show me graph",
      "show me a chart",
      "show me a graph",
      "show me price",
      "chart for",
      "graph for",
      "graph of",
      "chart of",
      "price of",
      "history of",
      "performance chart",
      "performance graph"
    ];
    
    const hasTokenGraphPattern = tokenGraphPatterns.some((pattern) =>
      lowerMessage.includes(pattern)
    );
    const hasTokenCondition = tokenSymbolMatch || tokenIdMatch || lowerMessage.includes("token");
    const isTokenGraphRequest = hasTokenGraphPattern && hasTokenCondition;

    if (isTokenGraphRequest) {
      return {
        type: "generate_token_chart" as const,
        userId: targetUserId,
        token,
        chartType,
        timeframe,
        isSelfScan,
        needsGraph: true,
        needsFullAnalysis: false,
        needsSummaryOnly: false,
      };
    }

    // Check for general graph generation requests
    if (
      (lowerMessage.includes("check") || lowerMessage.includes("generate")) &&
      lowerMessage.includes("graph")
    ) {
      return {
        type: "generate_graph" as const,
        userId: targetUserId,
        isSelfScan,
        needsGraph: true,
        needsFullAnalysis: false,
        needsSummaryOnly: false,
      };
    }

    // Check for summary-only requests (new intent type)
    if (needsSummaryOnly && (targetUserId || isSelfReference)) {
      return {
        type: "summary_only" as const,
        userId: targetUserId,
        token: "all" as const,
        isSelfScan,
        needsGraph: false,
        needsFullAnalysis: false,
        needsSummaryOnly: true,
      };
    }

    // Check for scan/analysis requests
    if (
      lowerMessage.includes("scan") ||
      lowerMessage.includes("analyze") ||
      (lowerMessage.includes("check") &&
        (lowerMessage.includes("thing") ||
          lowerMessage.includes("portfolio"))) ||
      hederaAccountMatch || // If we found a Hedera account ID, assume it's a scan request
      isSelfReference // If self-referential language detected
    ) {

      return {
        type: "scan_user" as const,
        userId: targetUserId,
        token: "all" as const,
        isSelfScan,
        needsGraph,
        needsFullAnalysis,
        needsSummaryOnly: false,
      };
    }

    return { 
      type: "unknown" as const, 
      needsGraph,
      needsFullAnalysis: false,
      needsSummaryOnly: false,
    };
  }

  private async handleScanUser(
    userId: string,
    token: string,
    startTime: number
  ): Promise<{
    response: string;
    graphs?: any[];
    latency: number;
  }> {
    try {
      // Broadcast scan requests to wallet and xtrend agents
      bus.sendMessage({
        type: "scan_request",
        from: this.agentName,
        to: "wallet@portfolio.guard",
        payload: { userId, token },
      });

      bus.sendMessage({
        type: "scan_request",
        from: this.agentName,
        to: "xtrend@portfolio.guard",
        payload: { userId, token },
      });

      // Wait for responses
      const responses = await bus.waitForResponses(
        this.agentName,
        ["risk_summary"],
        5000
      );

      const riskSummary = responses.find((r) => r.type === "risk_summary");

      if (riskSummary) {
        const payload = riskSummary.payload as RiskSummaryPayload;
        const response = this.formatRiskSummaryResponse(payload, userId);

        return {
          response,
          latency: Date.now() - startTime,
        };
      } else {
        return {
          response: `🤖 ⚠️ No response received for ${userId}. The user might not be monitored or agents are not responding.`,
          latency: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.error("Error in handleScanUser:", error);
      return {
        response: `🤖 ❌ Error scanning ${userId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        latency: Date.now() - startTime,
      };
    }
  }

  private async handleGenerateGraph(
    userId: string,
    startTime: number
  ): Promise<{
    response: string;
    graphs?: any[];
    latency: number;
  }> {
    try {
      console.log(`🔍 Requesting graph generation for user: ${userId}`);
      
      // Set up response listener BEFORE sending the message to avoid race condition
      console.log(`⏳ Setting up listener for graph_ready response...`);
      const responsePromise = bus.waitForResponses(
        this.agentName,
        ["graph_ready"],
        15000
      );
      
      // Request graph generation
      bus.sendMessage({
        type: "generate_graph",
        from: this.agentName,
        to: "graph@portfolio.guard",
        payload: { userId, timeframe: "24h" },
      });

      console.log(`⏳ Waiting for graph_ready response...`);
      
      // Wait for graph response
      const responses = await responsePromise;

      console.log(`📊 Received ${responses.length} responses:`, responses.map(r => r.type));
      
      const graphResponse = responses.find((r) => r.type === "graph_ready");

      if (graphResponse) {
        const payload = graphResponse.payload as GraphReadyPayload;
        console.log(`✅ Graph response payload:`, JSON.stringify(payload, null, 2));

        return {
          response: `📊 Generated portfolio graph for ${userId}`,
          graphs: [payload.config],
          latency: Date.now() - startTime,
        };
      } else {
        return {
          response: `🤖 ⚠️ No graph generated for ${userId}. The graph agent might not be responding.`,
          latency: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.error("Error in handleGenerateGraph:", error);
      return {
        response: `🤖 ❌ Error generating graph for ${userId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        latency: Date.now() - startTime,
      };
    }
  }

  private async handleGenerateTokenChart(
    token: string,
    timeframe: string,
    chartType: string,
    userId: string,
    startTime: number
  ): Promise<{
    response: string;
    graphs?: any[];
    latency: number;
  }> {
    try {
      // Set up response listener BEFORE sending the message to avoid race condition
      const responsePromise = bus.waitForResponses(
        this.agentName,
        ["token_chart_ready"],
        30000
      );
      
      // Request token chart generation
      bus.sendMessage({
        type: "generate_token_chart",
        from: this.agentName,
        to: "graph@portfolio.guard",
        payload: { 
          token,
          timeframe,
          chartType: chartType === "history" ? "price" : chartType,
          userId 
        },
      });

      // Wait for token chart response
      const graphResponses = await responsePromise;
      const graphResponse = graphResponses.find(
        (r) => r.type === "token_chart_ready"
      );

      if (graphResponse) {
         const payload = graphResponse.payload as GraphReadyPayload;
         return {
           response: `📈 Generated ${chartType} chart for ${token} over ${timeframe} timeframe`,
           graphs: [payload.config],
           latency: Date.now() - startTime,
         };
       } else {
        return {
          response: `🤖 ❌ No token chart response received for ${token}`,
          latency: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.error("Error in handleGenerateTokenChart:", error);
      return {
        response: `🤖 ❌ Error generating ${token} chart: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        latency: Date.now() - startTime,
      };
    }
  }

  private formatRiskSummaryResponse(
    payload: RiskSummaryPayload,
    userId: string
  ): string {
    let response = `🤖 🔍 LIVE SCAN: ${userId} (Completed)\n\n`;

    // Format token information
    for (const [tokenSymbol, tokenData] of Object.entries(payload.tokens)) {
      const riskEmoji = this.getRiskEmoji(tokenData.risk);
      const deltaSign = tokenData.wallet_delta >= 0 ? "+" : "";

      response += `${tokenSymbol}: ${riskEmoji} ${tokenData.risk}\n`;
      response += `├── Wallet: ${deltaSign}${tokenData.wallet_delta.toLocaleString()} ${tokenSymbol}\n`;
      response += `├── X Trends: ${tokenData.x_volume_spike} volume spike\n`;

      if (tokenData.top_tweets && tokenData.top_tweets.length > 0) {
        response += `│   └── ${tokenData.top_tweets[0]}\n`;
      }

      response += `└── Risk Score: ${this.getRiskScore(tokenData.risk)}/10\n\n`;
    }

    // Portfolio summary
    const changeSign = payload.change_24h >= 0 ? "+" : "";
    response += `📊 TOTAL PORTFOLIO: $${payload.total_value.toLocaleString()} (${changeSign}${
      payload.change_24h
    }% today)\n\n`;

    // Proof link
    if (payload.onchain_proof) {
      response += `🔗 Proof: Hashscan.io/tx/${payload.onchain_proof}`;
    }

    return response;
  }

  private getRiskEmoji(risk: string): string {
    switch (risk) {
      case "CRITICAL":
        return "🚨";
      case "HIGH":
        return "🔴";
      case "MEDIUM":
        return "🟡";
      case "LOW":
        return "🟢";
      case "SAFE":
        return "🟢";
      default:
        return "❓";
    }
  }

  private getRiskScore(risk: string): string {
    switch (risk) {
      case "CRITICAL":
        return "9.2";
      case "HIGH":
        return "7.5";
      case "MEDIUM":
        return "5.0";
      case "LOW":
        return "2.5";
      case "SAFE":
        return "1.4";
      default:
        return "5.0";
    }
  }

  async processUserCommandStreaming(
    message: string,
    userId: string,
    sendStep: (step: string, data: any) => void
  ): Promise<void> {
    const startTime = Date.now();

    // Send initial step
    sendStep("start", {
      message: "Starting analysis...",
      timestamp: new Date().toISOString(),
    });

    const intent = this.parseUserIntent(message, userId);
    console.log(`🎯 Intent parsed for "${message}":`, intent);

    if (intent.type === "scan_user") {
      const targetUserId = intent.userId || userId;
      const token = intent.token || "HBAR";
      const isSelfScan = intent.isSelfScan || targetUserId === userId;

      // Check if this is a news request (token === "all")
      const isNewsRequest = token === "all";

      if (isNewsRequest) {
        // Handle news requests with dynamic token extraction
        sendStep("news_start", {
          message: "📰 Extracting search terms and fetching market trends...",
          agent: "news@portfolio.guard",
        });

        try {
          // Extract search terms from user message
          const searchTerms = await this.extractNewsSearchTerms(message, userId);
          console.log(`🔍 Extracted search terms for news: ${searchTerms.join(", ")}`);

          // Import and use the news agent directly
          const { analyzeFlexibleQuery } = await import("./newsAgent.js");
          const newsAnalysis = await analyzeFlexibleQuery(searchTerms);

          const marketData = {
            sentiment: newsAnalysis.overallSentiment,
            trends: newsAnalysis.combinedNews,
            searchTerms: searchTerms,
            tokenAnalysis: newsAnalysis.tokenAnalysis,
            xSentiment: newsAnalysis.overallSentiment,
            xTweets: newsAnalysis.tokenAnalysis.flatMap(analysis => analysis.x.tweets).slice(0, 5),
            xPostsAnalyzed: newsAnalysis.tokenAnalysis.flatMap(analysis => analysis.x.tweets).length,
          };

          sendStep("news_complete", {
            message: "✅ Market analysis complete",
            data: marketData,
            agent: "news@portfolio.guard",
          });

          // Step 3: LLM Analysis for news
          sendStep("llm_start", {
            message: "🤖 Generating AI analysis...",
            agent: "llm@portfolio.guard",
          });

          // Create a news-focused analysis payload
          const newsAnalysisPayload = {
            address: targetUserId,
            analysis: {
              address: targetUserId,
              marketData: marketData,
              riskScore: 50, // Neutral for news-only requests
              warnings: [],
              recommendations: [`Based on current market sentiment for ${searchTerms.join(", ")}: ${newsAnalysis.overallSentiment}`],
            },
            success: true,
          };

          // Continue with LLM analysis...
          const llmQuery = `Analyze the following market news and trends data for ${searchTerms.join(", ")}:

Market Data:
- Overall Sentiment: ${marketData.sentiment}
- Search Terms: ${searchTerms.join(", ")}
- News Articles: ${marketData.trends.length} articles
- X Posts Analyzed: ${marketData.xPostsAnalyzed}

Recent News Headlines:
${marketData.trends.slice(0, 5).map((article: any) => `- ${article.title}`).join('\n')}

Please provide:
1. A comprehensive market analysis
2. Key insights from the news
3. Potential market implications
4. Risk assessment for these tokens/topics

Keep the response informative and actionable.`;

          bus.sendMessage({
            type: "llm_query",
            from: this.agentName,
            to: "llm@portfolio.guard",
            payload: { query: llmQuery, userId: targetUserId },
          });

          const llmResponses = await bus.waitForResponses(
            this.agentName,
            ["llm_response"],
            30000
          );
          const llmResponse = llmResponses.find((r) => r.type === "llm_response");

          if (!llmResponse || !llmResponse.payload.success) {
            throw new Error("LLM analysis failed");
          }

          sendStep("llm_complete", {
            message: "✅ AI analysis complete",
            data: { response: llmResponse.payload.response },
            agent: "llm@portfolio.guard",
          });

          sendStep("complete", {
            message: "✅ News analysis complete",
            timestamp: new Date().toISOString(),
            analysis: newsAnalysisPayload.analysis,
            llmResponse: llmResponse.payload.response,
          });

        } catch (error: any) {
          console.error("News analysis error:", error);
          sendStep("error", {
            message: `❌ News analysis failed: ${error.message}`,
            error: error.message,
          });
        }
        return;
      }

      // Regular portfolio scan flow
      const scanMessage = isSelfScan
        ? `🔍 Scanning your portfolio (${targetUserId})...`
        : `🔍 Scanning ${targetUserId}'s portfolio...`;

      sendStep("scanner_start", {
        message: scanMessage,
        agent: "scanner@portfolio.guard",
        isSelfScan,
        targetAddress: targetUserId,
      });

      try {
        // Send analyze address request to scanner
        bus.sendMessage({
          from: this.agentName,
          to: "scanner@portfolio.guard",
          type: "analyze_address",
          payload: { address: targetUserId, userId: targetUserId },
        });

        // Wait for scanner response
        const responses = await bus.waitForResponses(
          this.agentName,
          ["analysis_response"],
          30000
        );
        const scannerResponse = responses.find(
          (r) => r.type === "analysis_response"
        );

        if (!scannerResponse) {
          throw new Error("No scanner response received");
        }

        const analysisPayload = scannerResponse.payload;
        if (!analysisPayload.success) {
          throw new Error(`Scanner analysis failed: ${analysisPayload.error}`);
        }

        sendStep("scanner_complete", {
          message: "✅ Portfolio scan complete",
          data: analysisPayload.analysis,
          agent: "scanner@portfolio.guard",
        });

        // Step 2: News/Market Data
        sendStep("news_start", {
          message: "📰 Fetching market trends and news...",
          agent: "news@portfolio.guard",
        });

        // The scanner already fetched market data, extract it
        const marketData = scannerResponse.payload.marketData;

        sendStep("news_complete", {
          message: "✅ Market analysis complete",
          data: marketData,
          agent: "news@portfolio.guard",
        });

        // Step 3: LLM Analysis
        sendStep("llm_start", {
          message: "🤖 Generating AI analysis...",
          agent: "llm@portfolio.guard",
        });

        // Send to LLM for final analysis
        bus.sendMessage({
          from: this.agentName,
          to: "llm@portfolio.guard",
          type: "llm_query",
          payload: {
            query: `Analyze this portfolio data: ${JSON.stringify(
              scannerResponse.payload
            )}`,
            userId: targetUserId,
          },
        });

        const llmResponses = await bus.waitForResponses(
          this.agentName,
          ["llm_response"],
          30000
        );
        const llmResponse = llmResponses.find((r) => r.type === "llm_response");

        if (llmResponse) {
          sendStep("llm_complete", {
            message: "✅ AI analysis complete",
            data: llmResponse.payload,
            agent: "llm@portfolio.guard",
          });
        }

        // Final Summary
        const latency = Date.now() - startTime;
        const analysis = analysisPayload.analysis;

        let summaryResponse = `🤖 🔍 PORTFOLIO ANALYSIS: ${targetUserId}\n\n`;

        if (analysis.balance) {
          summaryResponse += `💰 Balance: ${analysis.balance.hbars}\n`;
          if (analysis.balance.tokens && analysis.balance.tokens.length > 0) {
            summaryResponse += `🪙 Tokens: ${analysis.balance.tokens.length} different tokens\n`;
          }
        }

        if (analysis.riskScore !== undefined) {
          summaryResponse += `⚠️ Risk Score: ${analysis.riskScore}/10\n`;
        }

        if (analysis.marketData) {
          summaryResponse += `📈 Market Sentiment: ${analysis.marketData.sentiment}\n`;
        }

        summaryResponse += `\n⏱️ Analysis completed in ${latency}ms`;

        sendStep("summary", {
          message: "Analysis Complete",
          response: summaryResponse,
          latency: latency,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        sendStep("error", {
          message: "Analysis failed",
          error: error.message || String(error),
          agent: "system",
        });
      }
    } else if (intent.type === "generate_graph") {
      // Step 1: Graph Generation
      sendStep("graph_start", {
        message: "📊 Generating portfolio graphs...",
        agent: "graph@portfolio.guard",
      });

      try {
        // Set up response listener BEFORE sending the message to avoid race condition
        const responsePromise = bus.waitForResponses(
          this.agentName,
          ["token_chart_ready"],
          30000
        );
        
        bus.sendMessage({
          from: this.agentName,
          to: "graph@portfolio.guard",
          type: "generate_graph",
          payload: { userId },
        });

        const graphResponses = await responsePromise;
        const graphResponse = graphResponses.find(
          (r) => r.type === "token_chart_ready"
        );

        if (!graphResponse) {
          throw new Error("No graph response received");
        }

        sendStep("graph_complete", {
          message: "✅ Graphs generated successfully",
          data: graphResponse.payload,
          agent: "graph@portfolio.guard",
        });

        const latency = Date.now() - startTime;
        sendStep("summary", {
          message: "Graph Generation Complete",
          response: `📊 Generated ${
            graphResponse.payload.graphs?.length || 0
          } portfolio graphs for ${userId}`,
          graphs: graphResponse.payload.graphs,
          latency: latency,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        sendStep("error", {
          message: "Graph generation failed",
          error: error.message || String(error),
          agent: "system",
        });
      }
    } else if (intent.type === "generate_token_chart") {
      // Step 1: Token Chart Generation
      const token = intent.token || "HBAR";
      const timeframe = intent.timeframe || "24h";
      const chartType = intent.chartType || "price";
      
      sendStep("token_chart_start", {
        message: `📈 Generating ${chartType} chart for ${token} (${timeframe})...`,
        agent: "graph@portfolio.guard",
        token,
        timeframe,
        chartType,
      });

      try {
        // Set up response listener BEFORE sending the message to avoid race condition
        const responsePromise = bus.waitForResponses(
          this.agentName,
          ["graph_ready"],
          30000
        );
        
        bus.sendMessage({
          from: this.agentName,
          to: "graph@portfolio.guard",
          type: "generate_token_chart",
          payload: { 
            token,
            timeframe,
            chartType: chartType === "history" ? "price" : chartType,
            userId 
          },
        });

        const graphResponses = await responsePromise;
        const graphResponse = graphResponses.find(
          (r) => r.type === "graph_ready"
        );

        if (!graphResponse) {
          throw new Error("No token chart response received");
        }

        sendStep("token_chart_complete", {
          message: `✅ ${token} ${chartType} chart generated successfully`,
          data: graphResponse.payload,
          agent: "graph@portfolio.guard",
          token,
          timeframe,
        });

        const latency = Date.now() - startTime;
        sendStep("summary", {
          message: "Token Chart Generation Complete",
          response: `📈 Generated ${chartType} chart for ${token} over ${timeframe} timeframe`,
          graphs: graphResponse.payload.graphs,
          latency: latency,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        sendStep("error", {
          message: "Token chart generation failed",
          error: error.message || String(error),
          agent: "system",
        });
      }
    } else {
      sendStep("error", {
        message: "Unknown command",
        error:
          'I can help you scan portfolios or generate graphs. Try "scan user.hbar" or "generate graph"',
        agent: "system",
      });
    }
  }

  // Context-aware version of processUserCommand
  async processUserCommandWithContext(
    message: string,
    userId: string,
    contextHistory: Array<{ role: string; content: string; timestamp: number }> = []
  ): Promise<{
    response: string;
    graphs?: any[];
    latency: number;
  }> {
    const startTime = Date.now();

    console.log(`💬 Processing command with context: "${message}" for user: ${userId}`);
    console.log(`📚 Context history: ${contextHistory.length} messages`);

    try {
      // Prepare context-enhanced query for LLM
      let enhancedQuery = message;
      if (contextHistory.length > 0) {
        const contextSummary = this.buildContextSummary(contextHistory);
        enhancedQuery = `Context from previous conversation:\n${contextSummary}\n\nCurrent message: ${message}`;
      }

      // Send query to LLM agent for natural language processing
      bus.sendMessage({
        type: "llm_query",
        from: this.agentName,
        to: "llm@portfolio.guard",
        payload: { 
          query: enhancedQuery, 
          userId,
          hasContext: contextHistory.length > 0,
          contextLength: contextHistory.length
        },
      });

      // Wait for LLM response (increased timeout for analysis processing)
      const responses = await bus.waitForResponses(
        this.agentName,
        ["llm_response"],
        30000
      );
      const llmResponse = responses[0];

      if (llmResponse && llmResponse.payload.success) {
        // Check if the LLM response indicates a specific action should be taken
        const response = llmResponse.payload.response;

        // Parse if LLM suggests specific actions (using original message for intent parsing)
        const intent = this.parseUserIntent(message, userId);

        if (intent.type === "scan_user") {
          // Execute scan and combine with LLM insights
          const scanResult = await this.handleScanUser(
            intent.userId || userId,
            intent.token || "all",
            startTime
          );
          return {
            response: `${response}\n\n${scanResult.response}`,
            graphs: scanResult.graphs,
            latency: Date.now() - startTime,
          };
        } else if (intent.type === "generate_graph") {
          // Execute graph generation and combine with LLM insights
          const graphResult = await this.handleGenerateGraph(
            intent.userId || userId,
            startTime
          );
          return {
            response: `${response}\n\n${graphResult.response}`,
            graphs: graphResult.graphs,
            latency: Date.now() - startTime,
          };
        } else if (intent.type === "generate_token_chart") {
          // Execute token chart generation and combine with LLM insights
          const tokenChartResult = await this.handleGenerateTokenChart(
            intent.token || "HBAR",
            intent.timeframe || "24h",
            intent.chartType || "price",
            intent.userId || userId,
            startTime
          );
          return {
            response: `${response}\n\n${tokenChartResult.response}`,
            graphs: tokenChartResult.graphs,
            latency: Date.now() - startTime,
          };
        } else {
          // Return LLM response for general queries
          return {
            response: response,
            latency: Date.now() - startTime,
          };
        }
      } else {
        // Fallback to original parsing if LLM fails
        const intent = this.parseUserIntent(message, userId);

        if (intent.type === "scan_user") {
          return await this.handleScanUser(
            intent.userId || userId,
            intent.token || "all",
            startTime
          );
        } else if (intent.type === "generate_graph") {
          return await this.handleGenerateGraph(
            intent.userId || userId,
            startTime
          );
        } else if (intent.type === "generate_token_chart") {
          return await this.handleGenerateTokenChart(
            intent.token || "HBAR",
            intent.timeframe || "24h",
            intent.chartType || "price",
            intent.userId || userId,
            startTime
          );
        } else {
          return {
            response: "I'm sorry, I couldn't understand your request. Could you please rephrase it?",
            latency: Date.now() - startTime,
          };
        }
      }
    } catch (error: any) {
      console.error("Chat agent error:", error);
      return {
        response: `I encountered an error while processing your request: ${error?.message || String(error)}`,
        latency: Date.now() - startTime,
      };
    }
  }

  // Context-aware version of processUserCommandStreaming
  async processUserCommandStreamingWithContext(
    message: string,
    userId: string,
    contextHistory: Array<{ role: string; content: string; timestamp: number }> = [],
    sendStep: (step: string, data: any) => void
  ): Promise<void> {
    const startTime = Date.now();
    console.log(`💬 Processing streaming command with context: "${message}" for user: ${userId}`);
    console.log(`📚 Context history: ${contextHistory.length} messages`);

    try {
      // Prepare context-enhanced query for LLM
      let enhancedQuery = message;
      if (contextHistory.length > 0) {
        const contextSummary = this.buildContextSummary(contextHistory);
        enhancedQuery = `Context from previous conversation:\n${contextSummary}\n\nCurrent message: ${message}`;
        
        sendStep("context", { 
          message: "Using conversation context", 
          contextLength: contextHistory.length 
        });
      }

      // Send initial processing step
      sendStep("processing", { message: "Analyzing your request..." });

      // Parse user intent first
      const intent = this.parseUserIntent(message, userId);
      sendStep("intent", { 
        message: `Detected intent: ${intent.type}`, 
        intent: intent 
      });

      if (intent.type === "scan_user") {
        const targetUserId = intent.userId || userId;
        const isSelfScan = intent.isSelfScan || targetUserId === userId;
        
        // Check for explicit news-related keywords to route to market news
        const isNewsRequest = /\b(news|market trends?|sentiment|headlines|market (analysis|update))\b/i.test(message);
        console.log(`🔍 Debug - Intent token: ${intent.token}, isNewsRequest: ${isNewsRequest}`);
        
        if (isNewsRequest) {
          // Handle news request by extracting search terms from the user's message
          console.log(`📰 Processing news request: "${message}"`);
          
          const searchTerms = await this.extractNewsSearchTerms(message, userId);
          console.log(`🔍 Extracted search terms: ${JSON.stringify(searchTerms)}`);
          
          // Step 1: News Analysis
          sendStep("news_start", {
            message: "📰 Fetching latest news and market trends...",
            agent: "news@portfolio.guard",
          });

          const { analyzeFlexibleQuery } = await import("./newsAgent.js");
          const newsAnalysis = await analyzeFlexibleQuery(searchTerms);
          
          sendStep("news_complete", {
            message: "✅ News analysis complete",
            data: newsAnalysis,
            agent: "news@portfolio.guard",
          });

          const marketData = {
            searchTerms,
            newsAnalysis,
            timestamp: new Date().toISOString(),
          };

          // Step 2: LLM Analysis
          sendStep("llm_start", {
            message: "🤖 Generating comprehensive market report...",
            agent: "llm@portfolio.guard",
          });

          bus.sendMessage({
            from: this.agentName,
            to: "llm@portfolio.guard",
            type: "llm_query",
            payload: {
              query: `Analyze this news and market data: ${JSON.stringify(marketData)}`,
              userId: targetUserId,
            },
          });

          const llmResponses = await bus.waitForResponses(
            this.agentName,
            ["llm_response"],
            30000
          );
          const llmResponse = llmResponses.find((r) => r.type === "llm_response");

          if (llmResponse) {
            sendStep("llm_complete", {
              message: "✅ Market analysis complete",
              data: llmResponse.payload,
              agent: "llm@portfolio.guard",
            });
          }

          const latency = Date.now() - startTime;
          let summaryResponse = `📰 **MARKET NEWS & TRENDS**\n\n`;
          summaryResponse += `🔍 **Search Terms**: ${searchTerms.join(", ")}\n`;
          summaryResponse += `📈 **Market Sentiment**: ${newsAnalysis?.overallSentiment || "neutral"}\n`;
          summaryResponse += `\n⏱️ Summary generated in ${latency}ms\n`;
          summaryResponse += `\n💡 *For detailed analysis, ask for a "full analysis" or "complete scan"*`;

          sendStep("complete", {
            response: summaryResponse,
            latency,
          });

          return;
        }
        
        // Original portfolio scanning logic
        const scanMessage = isSelfScan
          ? `📋 Getting summary of your portfolio (${targetUserId})...`
          : `📋 Getting summary of ${targetUserId}'s portfolio...`;

        sendStep("scanner_start", {
          message: scanMessage,
          agent: "scanner@portfolio.guard",
          isSelfScan,
          targetAddress: targetUserId,
        });

        try {
          // Send analyze address request to scanner
          bus.sendMessage({
            from: this.agentName,
            to: "scanner@portfolio.guard",
            type: "analyze_address",
            payload: { address: targetUserId, userId: targetUserId },
          });

          // Wait for scanner response
          const responses = await bus.waitForResponses(
            this.agentName,
            ["analysis_response"],
            30000
          );
          const scannerResponse = responses.find(
            (r) => r.type === "analysis_response"
          );

          if (!scannerResponse) {
            throw new Error("No scanner response received");
          }

          const analysisPayload = scannerResponse.payload;
          if (!analysisPayload.success) {
            throw new Error(`Scanner analysis failed: ${analysisPayload.error}`);
          }

          sendStep("scanner_complete", {
            message: "✅ Portfolio scan complete",
            data: analysisPayload.analysis,
            agent: "scanner@portfolio.guard",
          });

          // Step 2: News/Market Data
          sendStep("news_start", {
            message: "📰 Fetching market trends and news...",
            agent: "news@portfolio.guard",
          });

          // The scanner already fetched market data, extract it
          const marketData = scannerResponse.payload.marketData;

          sendStep("news_complete", {
            message: "✅ Market analysis complete",
            data: marketData,
            agent: "news@portfolio.guard",
          });

          // Step 3: LLM Analysis
          sendStep("llm_start", {
            message: "🤖 Generating AI analysis...",
            agent: "llm@portfolio.guard",
          });

          // Send to LLM for final analysis
          bus.sendMessage({
            from: this.agentName,
            to: "llm@portfolio.guard",
            type: "llm_query",
            payload: {
              query: `Analyze this portfolio data: ${JSON.stringify(
                scannerResponse.payload
              )}`,
              userId: targetUserId,
            },
          });

          const llmResponses = await bus.waitForResponses(
            this.agentName,
            ["llm_response"],
            30000
          );
          const llmResponse = llmResponses.find((r) => r.type === "llm_response");

          if (llmResponse) {
            sendStep("llm_complete", {
              message: "✅ AI analysis complete",
              data: llmResponse.payload,
              agent: "llm@portfolio.guard",
            });
          }

          // Final Summary
          const latency = Date.now() - startTime;
          const analysis = analysisPayload.analysis;

          let summaryResponse = `🤖 🔍 PORTFOLIO ANALYSIS: ${targetUserId}\n\n`;

          if (analysis.balance) {
            summaryResponse += `💰 **Balance**: ${analysis.balance.hbars}\n`;
            if (analysis.balance.tokens && analysis.balance.tokens.length > 0) {
              summaryResponse += `🪙 **Tokens**: ${analysis.balance.tokens.length} different tokens\n`;
              
              // Show top 3 tokens by balance
              const topTokens = analysis.balance.tokens
                .slice(0, 3)
                .map((token: any) => `• ${token.symbol || token.tokenId}: ${token.balance}`)
                .join('\n');
              summaryResponse += `\n**Top Holdings**:\n${topTokens}\n`;
            }
          }

          if (analysis.riskScore !== undefined) {
            summaryResponse += `\n⚠️ **Risk Score**: ${analysis.riskScore}/10\n`;
          }

          if (analysis.marketData) {
            summaryResponse += `📈 **Market Sentiment**: ${analysis.marketData.sentiment}\n`;
          }

          summaryResponse += `\n⏱️ Summary generated in ${latency}ms`;
          summaryResponse += `\n\n💡 *For detailed analysis, ask for a "full analysis" or "complete scan"*`;

          sendStep("summary_complete", { 
            message: "Portfolio summary completed"
          });

          sendStep("complete", { 
            response: summaryResponse,
            latency: latency
          });

        } catch (error: any) {
          sendStep("error", {
            message: "Summary generation failed",
            error: error.message || String(error),
            agent: "system",
          });
        }
        
      } else if (intent.type === "generate_graph") {
        sendStep("action", { message: "Generating portfolio graph..." });
        
        const graphResult = await this.handleGenerateGraph(
          intent.userId || userId,
          Date.now()
        );
        
        sendStep("graph_complete", { 
          message: "Graph generation completed",
          graphs: graphResult.graphs 
        });
        
        sendStep("complete", { 
          response: graphResult.response,
          graphs: graphResult.graphs,
          latency: graphResult.latency
        });
        
      } else if (intent.type === "generate_token_chart") {
        sendStep("action", { message: `Generating ${intent.token} chart...` });
        
        const tokenChartResult = await this.handleGenerateTokenChart(
          intent.token || "HBAR",
          intent.timeframe || "24h",
          intent.chartType || "price",
          intent.userId || userId,
          Date.now()
        );
        
        sendStep("chart_complete", { 
          message: "Token chart generation completed",
          graphs: tokenChartResult.graphs 
        });
        
        sendStep("complete", { 
          response: tokenChartResult.response,
          graphs: tokenChartResult.graphs,
          latency: tokenChartResult.latency
        });
        
      } else if (intent.type === "summary_only") {
        // Summary-only requests: Only use scanner, skip news and LLM for faster response
        const targetUserId = intent.userId || userId;
        const isSelfScan = intent.isSelfScan || targetUserId === userId;
        
        const scanMessage = isSelfScan
          ? `📋 Getting summary of your portfolio (${targetUserId})...`
          : `📋 Getting summary of ${targetUserId}'s portfolio...`;

        sendStep("scanner_start", {
          message: scanMessage,
          agent: "scanner@portfolio.guard",
          isSelfScan,
          targetAddress: targetUserId,
        });

        try {
          // Send analyze address request to scanner
          bus.sendMessage({
            from: this.agentName,
            to: "scanner@portfolio.guard",
            type: "analyze_address",
            payload: { address: targetUserId, userId: targetUserId },
          });

          // Wait for scanner response
          const responses = await bus.waitForResponses(
            this.agentName,
            ["analysis_response"],
            30000
          );
          const scannerResponse = responses.find(
            (r) => r.type === "analysis_response"
          );

          if (!scannerResponse) {
            throw new Error("No scanner response received");
          }

          const analysisPayload = scannerResponse.payload;
          if (!analysisPayload.success) {
            throw new Error(`Scanner analysis failed: ${analysisPayload.error}`);
          }

          sendStep("scanner_complete", {
            message: "✅ Portfolio summary ready",
            data: analysisPayload.analysis,
            agent: "scanner@portfolio.guard",
          });

          // Generate quick summary without LLM analysis
          const latency = Date.now() - startTime;
          const analysis = analysisPayload.analysis;

          let summaryResponse = `📋 **PORTFOLIO SUMMARY**: ${targetUserId}\n\n`;

          if (analysis.balance) {
            summaryResponse += `💰 **Balance**: ${analysis.balance.hbars}\n`;
            if (analysis.balance.tokens && analysis.balance.tokens.length > 0) {
              summaryResponse += `🪙 **Tokens**: ${analysis.balance.tokens.length} different tokens\n`;
              
              // Show top 3 tokens by balance
              const topTokens = analysis.balance.tokens
                .slice(0, 3)
                .map((token: any) => `• ${token.symbol || token.tokenId}: ${token.balance}`)
                .join('\n');
              summaryResponse += `\n**Top Holdings**:\n${topTokens}\n`;
            }
          }

          if (analysis.riskScore !== undefined) {
            summaryResponse += `\n⚠️ **Risk Score**: ${analysis.riskScore}/10\n`;
          }

          if (analysis.marketData) {
            summaryResponse += `📈 **Market Sentiment**: ${analysis.marketData.sentiment}\n`;
          }

          summaryResponse += `\n⏱️ Summary generated in ${latency}ms`;
          summaryResponse += `\n\n💡 *For detailed analysis, ask for a "full analysis" or "complete scan"*`;

          sendStep("summary_complete", { 
            message: "Portfolio summary completed"
          });

          sendStep("complete", { 
            response: summaryResponse,
            latency: latency
          });

        } catch (error: any) {
          sendStep("error", {
            message: "Summary generation failed",
            error: error.message || String(error),
            agent: "system",
          });
        }
        
      } else {
        // For general queries, use LLM with context
        sendStep("llm_query", { message: "Consulting AI assistant..." });
        
        // Set up response listener BEFORE sending the message to avoid race condition
        const responsePromise = bus.waitForResponses(
          this.agentName,
          ["llm_response"],
          30000
        );
        
        bus.sendMessage({
          type: "llm_query",
          from: this.agentName,
          to: "llm@portfolio.guard",
          payload: { 
            query: enhancedQuery, 
            userId,
            hasContext: contextHistory.length > 0,
            contextLength: contextHistory.length
          },
        });

        // Wait for LLM response
        const responses = await responsePromise;
        const llmResponse = responses[0];

        if (llmResponse && llmResponse.payload.success) {
          sendStep("llm_complete", { message: "AI analysis completed" });
          sendStep("complete", { 
            response: llmResponse.payload.response,
            latency: Date.now() - Date.now()
          });
        } else {
          sendStep("error", { 
            error: "Failed to get AI response" 
          });
        }
      }

      // Handle combined requests (summary + graph)
      
      if (intent.needsGraph && (intent.type === "scan_user" || intent.type === "summary_only")) {
        sendStep("graph_start", { 
          message: "📊 Generating portfolio graph..." 
        });
        
        try {
          const targetUserId = intent.userId || userId;
          const graphResult = await this.handleGenerateGraph(
            targetUserId,
            Date.now()
          );
          
          sendStep("graph_complete", { 
            message: "✅ Graph generation completed",
            graphs: graphResult.graphs 
          });
          
          // Send updated complete event with graphs
          sendStep("complete", { 
            response: "📊 Portfolio analysis and graph generated successfully!",
            graphs: graphResult.graphs,
            latency: Date.now() - startTime
          });
          
        } catch (error: any) {
          sendStep("error", {
            message: "Graph generation failed",
            error: error.message || String(error),
            agent: "graph@portfolio.guard",
          });
        }
      }
    } catch (error: any) {
      console.error("Streaming chat agent error:", error);
      sendStep("error", { 
        error: error?.message || String(error) 
      });
    }
  }

  private buildContextSummary(contextHistory: Array<{ role: string; content: string; timestamp: number }>): string {
    // Build a concise summary of the conversation context
    const recentMessages = contextHistory.slice(-6); // Last 6 messages for context
    
    return recentMessages.map(msg => {
      const timeAgo = this.getTimeAgo(msg.timestamp);
      return `${msg.role === 'user' ? 'User' : 'Assistant'} (${timeAgo}): ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}`;
    }).join('\n');
  }

  private getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  async extractNewsSearchTerms(message: string, userId: string): Promise<string[]> {
    try {
      console.log(`🔍 Extracting news search terms from: "${message}"`);
      
      // Create a specialized prompt for extracting search terms
      const extractionPrompt = `
        Analyze this user message and extract relevant cryptocurrency/token symbols, company names, or financial topics that would be useful for news searches.
        
        User message: "${message}"
        
        Return ONLY a comma-separated list of search terms (max 5 terms). Focus on:
        - Cryptocurrency symbols (BTC, ETH, HBAR, etc.)
        - Company names mentioned
        - Financial topics or events
        - Market-related keywords
        
        If no specific terms are found, return "HBAR" as default.
        
        Example responses:
        - "BTC, Bitcoin, cryptocurrency"
        - "HBAR, Hedera, DeFi"
        - "Tesla, TSLA, electric vehicles"
      `;

      // Send extraction query to LLM
      bus.sendMessage({
        type: "llm_query",
        from: this.agentName,
        to: "llm@portfolio.guard",
        payload: { query: extractionPrompt, userId },
      });

      // Wait for LLM response
      const responses = await bus.waitForResponses(
        this.agentName,
        ["llm_response"],
        10000
      );
      
      const llmResponse = responses[0];
      
      if (llmResponse && llmResponse.payload.success) {
        const response = llmResponse.payload.response.trim();
        
        // Parse the comma-separated response
        const terms = response
          .split(',')
          .map((term: string) => term.trim().toUpperCase())
          .filter((term: string) => term.length > 0 && term.length < 20) // Filter out invalid terms
          .slice(0, 5); // Limit to 5 terms
        
        console.log(`🔍 Extracted search terms: ${terms.join(", ")}`);
        return terms.length > 0 ? terms : ["HBAR"];
      } else {
        console.warn(`🔍 Failed to extract search terms, using default`);
        return ["HBAR"];
      }
    } catch (error: any) {
      console.error(`🔍 Error extracting search terms:`, error.message);
      return ["HBAR"];
    }
  }

  destroy(): void {
    bus.unregisterAgent(this.agentName);
  }
}

export const chatAgent = new ChatAgent();
