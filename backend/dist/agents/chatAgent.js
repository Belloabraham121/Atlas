import { bus } from "../utils/bus.js";
export class ChatAgent {
    agentName = "chat@portfolio.guard";
    constructor() {
        bus.registerAgent(this.agentName);
        this.setupMessageHandlers();
    }
    setupMessageHandlers() {
        // Note: We don't set up general message handlers here to avoid interfering
        // with waitForResponses. The waitForResponses method will handle specific
        // message types when needed.
    }
    async processUserCommand(message, userId) {
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
            const responses = await bus.waitForResponses(this.agentName, ["llm_response"], 30000);
            const llmResponse = responses[0];
            if (llmResponse && llmResponse.payload.success) {
                // Check if the LLM response indicates a specific action should be taken
                const response = llmResponse.payload.response;
                // Parse if LLM suggests specific actions
                const intent = this.parseUserIntent(message, userId);
                if (intent.type === "scan_user") {
                    // Execute scan and combine with LLM insights
                    const scanResult = await this.handleScanUser(intent.userId || userId, intent.token || "all", startTime);
                    return {
                        response: `${response}\n\n${scanResult.response}`,
                        graphs: scanResult.graphs,
                        latency: Date.now() - startTime,
                    };
                }
                else if (intent.type === "generate_graph") {
                    // Execute graph generation and combine with LLM insights
                    const graphResult = await this.handleGenerateGraph(intent.userId || userId, startTime);
                    return {
                        response: `${response}\n\n${graphResult.response}`,
                        graphs: graphResult.graphs,
                        latency: Date.now() - startTime,
                    };
                }
                else if (intent.type === "generate_token_chart") {
                    // Execute token chart generation and combine with LLM insights
                    const tokenChartResult = await this.handleGenerateTokenChart(intent.token || "HBAR", intent.timeframe || "24h", intent.chartType || "price", intent.userId || userId, startTime);
                    return {
                        response: `${response}\n\n${tokenChartResult.response}`,
                        graphs: tokenChartResult.graphs,
                        latency: Date.now() - startTime,
                    };
                }
                else {
                    // Return LLM response for general queries
                    return {
                        response: response,
                        latency: Date.now() - startTime,
                    };
                }
            }
            else {
                // Fallback to original parsing if LLM fails
                const intent = this.parseUserIntent(message, userId);
                if (intent.type === "scan_user") {
                    return await this.handleScanUser(intent.userId || userId, intent.token || "all", startTime);
                }
                else if (intent.type === "generate_graph") {
                    return await this.handleGenerateGraph(intent.userId || userId, startTime);
                }
                else if (intent.type === "generate_token_chart") {
                    return await this.handleGenerateTokenChart(intent.token || "HBAR", intent.timeframe || "24h", intent.chartType || "price", intent.userId || userId, startTime);
                }
                else {
                    return {
                        response: "🤖 I can help you scan user portfolios, generate graphs, or create token charts. Try:\n• 'check user1's thing'\n• 'generate graph'\n• 'show me HBAR price history'\n• 'chart for token 0.0.123456'",
                        latency: Date.now() - startTime,
                    };
                }
            }
        }
        catch (error) {
            console.error("Error processing user command:", error);
            // Fallback to original parsing if LLM fails
            const intent = this.parseUserIntent(message, userId);
            if (intent.type === "scan_user") {
                return await this.handleScanUser(intent.userId || userId, intent.token || "all", startTime);
            }
            else if (intent.type === "generate_graph") {
                return await this.handleGenerateGraph(intent.userId || userId, startTime);
            }
            else if (intent.type === "generate_token_chart") {
                return await this.handleGenerateTokenChart(intent.token || "HBAR", intent.timeframe || "24h", intent.chartType || "price", intent.userId || userId, startTime);
            }
            else {
                return {
                    response: "🤖 I can help you scan user portfolios, generate graphs, or create token charts. Try:\n• 'check user1's thing'\n• 'generate graph'\n• 'show me HBAR price history'\n• 'chart for token 0.0.123456'",
                    latency: Date.now() - startTime,
                };
            }
        }
    }
    parseUserIntent(message, contextUserId) {
        const lowerMessage = message.toLowerCase();
        // Extract explicit addresses from message (Hedera account IDs like 0.0.2)
        const hederaAccountMatch = lowerMessage.match(/(\d+\.\d+\.\d+)/);
        const userMatch = lowerMessage.match(/user(\w+)/);
        // Extract token symbols and token IDs
        const tokenSymbolMatch = lowerMessage.match(/\b(hbar|usdc|usdt|btc|eth|matic|ada|dot|link|uni|aave|comp|mkr|snx|yfi|1inch|crv|bal|sushi|alpha|cream|badger|rook|farm|pickle|cover|armor|bond|digg|bnt|knc|lrc|zrx|ren|storj|grt|uma|band|ocean|fet|agi|nmr|rlc|ant|mana|enj|sand|axs|slp|chr|alice|tlm|audio|rari|tribe|fei|rai|lusd|frax|ohm|klima|time|memo|spell|ice|mim|cvx|fxs|alcx)\b/);
        const tokenIdMatch = lowerMessage.match(/token\s+(\d+\.\d+\.\d+)/);
        // Extract timeframe
        const timeframeMatch = lowerMessage.match(/\b(1h|4h|24h|7d|30d|1y|all)\b/) ||
            lowerMessage.match(/\b(hour|day|week|month|year)\b/);
        // Extract chart type
        const chartTypeMatch = lowerMessage.match(/\b(price|volume|market cap|correlation|performance|history)\b/);
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
        const isSelfReference = selfPatterns.some((pattern) => lowerMessage.includes(pattern));
        // Determine target address with context-aware routing
        let targetUserId;
        let isSelfScan = false;
        if (hederaAccountMatch) {
            // Explicit address provided - scan that specific address
            targetUserId = hederaAccountMatch[1];
            isSelfScan = false;
        }
        else if (userMatch) {
            // Legacy user format
            targetUserId = `user${userMatch[1]}`;
            isSelfScan = false;
        }
        else if (isSelfReference) {
            // Self-referential language - use context userId
            targetUserId = contextUserId;
            isSelfScan = true;
        }
        else if (lowerMessage.includes("scan") ||
            lowerMessage.includes("analyze") ||
            lowerMessage.includes("check")) {
            // Generic scan without specific target - default to self
            targetUserId = contextUserId;
            isSelfScan = true;
        }
        // Determine token for analysis
        let token = "HBAR"; // Default token
        if (tokenSymbolMatch) {
            token = tokenSymbolMatch[1].toUpperCase();
        }
        else if (tokenIdMatch) {
            token = tokenIdMatch[1];
        }
        // Determine timeframe
        let timeframe = "24h"; // Default timeframe
        if (timeframeMatch) {
            const tf = timeframeMatch[1];
            if (tf === "hour")
                timeframe = "1h";
            else if (tf === "day")
                timeframe = "24h";
            else if (tf === "week")
                timeframe = "7d";
            else if (tf === "month")
                timeframe = "30d";
            else if (tf === "year")
                timeframe = "1y";
            else
                timeframe = tf;
        }
        // Determine chart type
        let chartType = "price"; // Default chart type
        if (chartTypeMatch) {
            chartType = chartTypeMatch[1];
        }
        // Check for token-specific graph generation requests
        const tokenGraphPatterns = [
            "price history",
            "price chart",
            "token chart",
            "show me",
            "chart for",
            "graph for",
            "price of",
            "history of",
            "performance of"
        ];
        const isTokenGraphRequest = tokenGraphPatterns.some((pattern) => lowerMessage.includes(pattern)) && (tokenSymbolMatch || tokenIdMatch || lowerMessage.includes("token"));
        if (isTokenGraphRequest) {
            return {
                type: "generate_token_chart",
                userId: targetUserId,
                token,
                chartType,
                timeframe,
                isSelfScan,
            };
        }
        // Check for general graph generation requests
        if ((lowerMessage.includes("check") || lowerMessage.includes("generate")) &&
            lowerMessage.includes("graph")) {
            return {
                type: "generate_graph",
                userId: targetUserId,
                isSelfScan,
            };
        }
        // Check for scan/analysis requests
        else if (lowerMessage.includes("scan") ||
            lowerMessage.includes("analyze") ||
            (lowerMessage.includes("check") &&
                (lowerMessage.includes("thing") ||
                    lowerMessage.includes("portfolio"))) ||
            hederaAccountMatch || // If we found a Hedera account ID, assume it's a scan request
            isSelfReference // If self-referential language detected
        ) {
            return {
                type: "scan_user",
                userId: targetUserId,
                token: "all",
                isSelfScan,
            };
        }
        return { type: "unknown" };
    }
    async handleScanUser(userId, token, startTime) {
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
            const responses = await bus.waitForResponses(this.agentName, ["risk_summary"], 5000);
            const riskSummary = responses.find((r) => r.type === "risk_summary");
            if (riskSummary) {
                const payload = riskSummary.payload;
                const response = this.formatRiskSummaryResponse(payload, userId);
                return {
                    response,
                    latency: Date.now() - startTime,
                };
            }
            else {
                return {
                    response: `🤖 ⚠️ No response received for ${userId}. The user might not be monitored or agents are not responding.`,
                    latency: Date.now() - startTime,
                };
            }
        }
        catch (error) {
            console.error("Error in handleScanUser:", error);
            return {
                response: `🤖 ❌ Error scanning ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`,
                latency: Date.now() - startTime,
            };
        }
    }
    async handleGenerateGraph(userId, startTime) {
        try {
            // Request graph generation
            bus.sendMessage({
                type: "generate_graph",
                from: this.agentName,
                to: "graph@portfolio.guard",
                payload: { userId, timeframe: "24h" },
            });
            // Wait for graph response
            const responses = await bus.waitForResponses(this.agentName, ["graph_ready"], 5000);
            const graphResponse = responses.find((r) => r.type === "graph_ready");
            if (graphResponse) {
                const payload = graphResponse.payload;
                return {
                    response: `📊 Generated portfolio graph for ${userId}`,
                    graphs: [payload.config],
                    latency: Date.now() - startTime,
                };
            }
            else {
                return {
                    response: `🤖 ⚠️ No graph generated for ${userId}. The graph agent might not be responding.`,
                    latency: Date.now() - startTime,
                };
            }
        }
        catch (error) {
            console.error("Error in handleGenerateGraph:", error);
            return {
                response: `🤖 ❌ Error generating graph for ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`,
                latency: Date.now() - startTime,
            };
        }
    }
    async handleGenerateTokenChart(token, timeframe, chartType, userId, startTime) {
        try {
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
            const graphResponses = await bus.waitForResponses(this.agentName, ["token_chart_ready"], 30000);
            const graphResponse = graphResponses.find((r) => r.type === "token_chart_ready");
            if (graphResponse) {
                const payload = graphResponse.payload;
                return {
                    response: `📈 Generated ${chartType} chart for ${token} over ${timeframe} timeframe`,
                    graphs: [payload.config],
                    latency: Date.now() - startTime,
                };
            }
            else {
                return {
                    response: `🤖 ❌ No token chart response received for ${token}`,
                    latency: Date.now() - startTime,
                };
            }
        }
        catch (error) {
            console.error("Error in handleGenerateTokenChart:", error);
            return {
                response: `🤖 ❌ Error generating ${token} chart: ${error instanceof Error ? error.message : "Unknown error"}`,
                latency: Date.now() - startTime,
            };
        }
    }
    formatRiskSummaryResponse(payload, userId) {
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
        response += `📊 TOTAL PORTFOLIO: $${payload.total_value.toLocaleString()} (${changeSign}${payload.change_24h}% today)\n\n`;
        // Proof link
        if (payload.onchain_proof) {
            response += `🔗 Proof: Hashscan.io/tx/${payload.onchain_proof}`;
        }
        return response;
    }
    getRiskEmoji(risk) {
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
    getRiskScore(risk) {
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
    async processUserCommandStreaming(message, userId, sendStep) {
        const startTime = Date.now();
        // Send initial step
        sendStep("start", {
            message: "Starting analysis...",
            timestamp: new Date().toISOString(),
        });
        const intent = this.parseUserIntent(message, userId);
        if (intent.type === "scan_user") {
            const targetUserId = intent.userId || userId;
            const token = intent.token || "HBAR";
            const isSelfScan = intent.isSelfScan || targetUserId === userId;
            // Step 1: Scanner Agent with context-aware messaging
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
                const responses = await bus.waitForResponses(this.agentName, ["analysis_response"], 30000);
                const scannerResponse = responses.find((r) => r.type === "analysis_response");
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
                        query: `Analyze this portfolio data: ${JSON.stringify(scannerResponse.payload)}`,
                        userId: targetUserId,
                    },
                });
                const llmResponses = await bus.waitForResponses(this.agentName, ["llm_response"], 30000);
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
            }
            catch (error) {
                sendStep("error", {
                    message: "Analysis failed",
                    error: error.message || String(error),
                    agent: "system",
                });
            }
        }
        else if (intent.type === "generate_graph") {
            // Step 1: Graph Generation
            sendStep("graph_start", {
                message: "📊 Generating portfolio graphs...",
                agent: "graph@portfolio.guard",
            });
            try {
                bus.sendMessage({
                    from: this.agentName,
                    to: "graph@portfolio.guard",
                    type: "generate_graph",
                    payload: { userId },
                });
                const graphResponses = await bus.waitForResponses(this.agentName, ["token_chart_ready"], 30000);
                const graphResponse = graphResponses.find((r) => r.type === "token_chart_ready");
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
                    response: `📊 Generated ${graphResponse.payload.graphs?.length || 0} portfolio graphs for ${userId}`,
                    graphs: graphResponse.payload.graphs,
                    latency: latency,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                sendStep("error", {
                    message: "Graph generation failed",
                    error: error.message || String(error),
                    agent: "system",
                });
            }
        }
        else if (intent.type === "generate_token_chart") {
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
                const graphResponses = await bus.waitForResponses(this.agentName, ["graph_ready"], 30000);
                const graphResponse = graphResponses.find((r) => r.type === "graph_ready");
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
            }
            catch (error) {
                sendStep("error", {
                    message: "Token chart generation failed",
                    error: error.message || String(error),
                    agent: "system",
                });
            }
        }
        else {
            sendStep("error", {
                message: "Unknown command",
                error: 'I can help you scan portfolios or generate graphs. Try "scan user.hbar" or "generate graph"',
                agent: "system",
            });
        }
    }
    destroy() {
        bus.unregisterAgent(this.agentName);
    }
}
export const chatAgent = new ChatAgent();
