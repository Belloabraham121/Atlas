import dotenv from "dotenv";
dotenv.config();
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Client, PrivateKey, AccountBalanceQuery, AccountId, } from "@hashgraph/sdk";
import { bus } from "../utils/bus.js";
export class HederaLLMAgent {
    agentName = "llm@portfolio.guard";
    llm = null;
    client = null;
    isInitialized = false;
    constructor() {
        bus.registerAgent(this.agentName);
        this.setupMessageHandlers();
    }
    setupMessageHandlers() {
        bus.on(`message:${this.agentName}`, (message) => {
            console.log(`🤖 LLM Agent received: ${message.type} from ${message.from}`);
            this.handleMessage(message);
        });
    }
    async handleMessage(message) {
        switch (message.type) {
            case "llm_query":
                await this.handleLLMQuery(message);
                break;
            case "analysis_response":
                console.log(`🤖 LLM Agent processing analysis response from ${message.from}`);
                // This is handled by the promise in handleAddressAnalysis
                break;
            default:
                console.log(`❓ Unknown message type: ${message.type}`);
        }
    }
    async handleLLMQuery(message) {
        try {
            const { query, userId } = message.payload;
            console.log(`🤖 Processing LLM query for ${userId}: ${query}`);
            if (!this.isInitialized) {
                await this.initialize();
            }
            // Check if this is an address analysis request
            const addressAnalysis = this.parseAddressAnalysisRequest(query);
            if (addressAnalysis.isAddressAnalysis && addressAnalysis.address) {
                console.log(`🔍 Detected address analysis request for: ${addressAnalysis.address}`);
                const response = await this.handleAddressAnalysis(addressAnalysis.address, userId, query);
                // Send response back to the requesting agent
                bus.sendMessage({
                    type: "llm_response",
                    from: this.agentName,
                    to: message.from,
                    payload: {
                        userId,
                        query,
                        response: response,
                        success: true,
                    },
                });
                return;
            }
            // Handle regular LLM queries
            let response;
            if (!this.llm) {
                // Fallback response when LLM is not available
                response = this.generateFallbackResponse(query, userId);
            }
            else {
                try {
                    // Get context about the user and their portfolio
                    const context = await this.getPortfolioContext(userId);
                    // Create system message with portfolio context
                    const systemMessage = new SystemMessage(`You are PortfolioGuard, an AI assistant specialized in Hedera network portfolio management and analysis.

You help users with:
- Portfolio scanning and risk analysis  
- HBAR and token balance queries
- Transaction monitoring
- Market sentiment analysis
- Hedera network operations

Current user context:
${context}

Always provide clear, actionable insights about portfolio risks and opportunities.
Format responses in a clear, professional manner with relevant emojis for better readability.
Keep responses concise but informative.`);
                    const humanMessage = new HumanMessage(`User ${userId} asks: ${query}`);
                    // Get response from LLM
                    const llmResponse = await this.llm.invoke([
                        systemMessage,
                        humanMessage,
                    ]);
                    response = llmResponse.content;
                }
                catch (llmError) {
                    console.warn("LLM API error, using fallback:", llmError.message);
                    response = this.generateFallbackResponse(query, userId);
                }
            }
            // Send response back to the requesting agent
            bus.sendMessage({
                type: "llm_response",
                from: this.agentName,
                to: message.from,
                payload: {
                    userId,
                    query,
                    response: response,
                    success: true,
                },
            });
            console.log(`🤖 LLM response sent for ${userId}`);
        }
        catch (error) {
            console.error("Error in handleLLMQuery:", error);
            // Send fallback response
            bus.sendMessage({
                type: "llm_response",
                from: this.agentName,
                to: message.from,
                payload: {
                    userId: message.payload.userId,
                    query: message.payload.query,
                    response: this.generateFallbackResponse(message.payload.query, message.payload.userId),
                    success: true,
                },
            });
        }
    }
    parseAddressAnalysisRequest(query) {
        const lowerQuery = query.toLowerCase();
        // Look for Hedera address patterns (0.0.xxxxx)
        const addressMatch = query.match(/0\.0\.\d+/);
        if (addressMatch) {
            return {
                isAddressAnalysis: true,
                address: addressMatch[0],
            };
        }
        // Look for analysis keywords combined with address-like patterns
        if ((lowerQuery.includes("analyze") ||
            lowerQuery.includes("check") ||
            lowerQuery.includes("scan")) &&
            (lowerQuery.includes("address") || lowerQuery.includes("account"))) {
            // Try to extract any address-like pattern
            const possibleAddress = query.match(/0\.0\.\d+/);
            if (possibleAddress) {
                return {
                    isAddressAnalysis: true,
                    address: possibleAddress[0],
                };
            }
        }
        return { isAddressAnalysis: false };
    }
    async handleAddressAnalysis(address, userId, originalQuery) {
        try {
            console.log(`🔍 Starting address analysis for ${address}`);
            // Send analysis request to scanner agent via A2A messaging
            const analysisData = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Analysis timeout"));
                }, 30000); // 30 second timeout
                // Listen for the response
                const responseHandler = (responseMessage) => {
                    if (responseMessage.type === "analysis_response" &&
                        responseMessage.payload.address === address) {
                        clearTimeout(timeout);
                        bus.off(`message:${this.agentName}`, responseHandler);
                        if (responseMessage.payload.success) {
                            resolve(responseMessage.payload.analysis);
                        }
                        else {
                            reject(new Error(responseMessage.payload.error || "Analysis failed"));
                        }
                    }
                };
                bus.on(`message:${this.agentName}`, responseHandler);
                // Send analysis request
                bus.sendMessage({
                    type: "analyze_address",
                    from: this.agentName,
                    to: "scanner@portfolio.guard",
                    payload: {
                        address,
                        userId,
                        requestId: `analysis_${Date.now()}`,
                    },
                });
            });
            // Now let the LLM handle the raw data naturally
            if (!this.llm) {
                return `Analysis data for ${address}: ${JSON.stringify(analysisData, null, 2)}`;
            }
            const systemMessage = new SystemMessage(`You are PortfolioGuard, an AI assistant specialized in Hedera network portfolio analysis.
        You have received raw analysis data for address ${address}. 
        Analyze this data and provide insights in a natural, conversational way.
        The user asked: "${originalQuery}"
        Provide a helpful response based on the analysis data. 
        Be natural and conversational, not overly formatted.`);
            const humanMessage = new HumanMessage(`Here is the analysis data for ${address}:

${JSON.stringify(analysisData, null, 2)}

Please analyze this data and respond to the user's query: "${originalQuery}"`);
            const llmResponse = await this.llm.invoke([systemMessage, humanMessage]);
            return llmResponse.content;
        }
        catch (error) {
            console.error(`Error analyzing address ${address}:`, error);
            return `I encountered an issue analyzing address ${address}: ${error.message}. Please try again.`;
        }
    }
    generateFallbackResponse(query, userId) {
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes("portfolio") ||
            lowerQuery.includes("analyze") ||
            lowerQuery.includes("risk")) {
            return `🔍 I understand you want to analyze ${userId}'s portfolio and assess risks. Let me scan your holdings and check for any potential issues. I'll examine your HBAR balance, token holdings, and recent transaction patterns to provide you with a comprehensive risk assessment.`;
        }
        else if (lowerQuery.includes("graph") ||
            lowerQuery.includes("chart") ||
            lowerQuery.includes("visual")) {
            return `📊 I'll generate a visual representation of ${userId}'s portfolio performance. This will include balance trends, risk indicators, and market sentiment analysis to help you understand your portfolio's current state.`;
        }
        else if (lowerQuery.includes("balance") ||
            lowerQuery.includes("hbar") ||
            lowerQuery.includes("token")) {
            return `💰 I'll check ${userId}'s current HBAR and token balances across all monitored addresses. This includes real-time balance information and any recent changes that might affect your portfolio.`;
        }
        else if (lowerQuery.includes("help") ||
            lowerQuery.includes("what") ||
            lowerQuery.includes("how")) {
            return `🤖 I'm PortfolioGuard, your Hedera portfolio assistant! I can help you:
• 📊 Analyze portfolio risks and opportunities
• 💰 Check HBAR and token balances
• 📈 Generate portfolio performance graphs
• 🔍 Monitor transactions and market trends
• ⚠️ Alert you to potential risks

Try asking me to "analyze my portfolio" or "check my balances"!`;
        }
        else {
            return `🤖 I'm here to help with your Hedera portfolio management! I can analyze your holdings, check balances, generate graphs, and assess risks. What would you like me to help you with regarding ${userId}'s portfolio?`;
        }
    }
    async getPortfolioContext(userId) {
        try {
            // Try to get basic account info if we have Hedera client
            if (this.client && userId.startsWith("0.0.")) {
                const accountId = AccountId.fromString(userId);
                const balance = await new AccountBalanceQuery()
                    .setAccountId(accountId)
                    .execute(this.client);
                return `User ${userId} has ${balance.hbars.toString()} HBAR in their account.`;
            }
            return `User ${userId} is requesting portfolio information.`;
        }
        catch (error) {
            console.log(`Could not fetch portfolio context for ${userId}:`, error);
            return `User ${userId} is requesting portfolio information.`;
        }
    }
    async initialize() {
        try {
            console.log("🤖 Initializing Hedera LLM Agent...");
            // Check for required environment variables
            if (!process.env.OPENAI_API_KEY) {
                throw new Error("OPENAI_API_KEY environment variable is required");
            }
            // Initialize OpenAI LLM
            this.llm = new ChatOpenAI({
                model: "gpt-4o-mini",
                apiKey: process.env.OPENAI_API_KEY,
                temperature: 0.7,
            });
            // Hedera client setup (optional)
            if (process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY) {
                if (process.env.HEDERA_NETWORK === "mainnet") {
                    this.client = Client.forMainnet();
                }
                else {
                    this.client = Client.forTestnet();
                }
                this.client.setOperator(process.env.HEDERA_OPERATOR_ID, PrivateKey.fromStringDer(process.env.HEDERA_OPERATOR_KEY));
                console.log("✅ Hedera client initialized");
            }
            else {
                console.log("⚠️ Hedera operator credentials not found. Portfolio queries will be limited.");
            }
            this.isInitialized = true;
            console.log("✅ Hedera LLM Agent initialized successfully!");
        }
        catch (error) {
            console.error("❌ Failed to initialize Hedera LLM Agent:", error);
            throw error;
        }
    }
    getStatus() {
        return {
            name: this.agentName,
            status: this.isInitialized ? "online" : "offline",
            initialized: this.isInitialized,
        };
    }
    destroy() {
        bus.unregisterAgent(this.agentName);
        console.log(`🤖 ${this.agentName} destroyed`);
    }
}
export const hederaLLMAgent = new HederaLLMAgent();
