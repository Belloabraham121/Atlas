import { resolveAccountId, detectTokensForAccount } from "../utils/hedera.js";
import { getAccountHoldings } from "../utils/hedera.js";
import { getUser, updateUser } from "../store/users.js";
import { bus, } from "../utils/bus.js";
// Listen for A2A x_news_alerts and update user risk/profile
bus.on("x_news_alert", (payload) => {
    const profile = getUser(payload.userId);
    if (!profile)
        return;
    // Simple risk heuristic: NEGATIVE -> HIGH, POSITIVE -> LOW, NEUTRAL -> MEDIUM
    const risk = payload.sentiment === "NEGATIVE"
        ? "HIGH"
        : payload.sentiment === "POSITIVE"
            ? "LOW"
            : "MEDIUM";
    profile.lastXNewsAlert = payload;
    profile.risk = risk;
    updateUser(payload.userId, profile);
});
export async function monitorUser(userId, addressOrId) {
    const accountId = await resolveAccountId(addressOrId);
    let profile = getUser(userId) || {
        userId,
        accountId: accountId.toString(),
        tokens: [],
    };
    profile.accountId = accountId.toString();
    updateUser(userId, profile);
    return profile;
}
export async function refreshTokens(userId) {
    const profile = getUser(userId);
    if (!profile || !profile.accountId)
        throw new Error("User not monitored or missing accountId");
    const accountId = await resolveAccountId(profile.accountId);
    const tokens = await detectTokensForAccount(accountId);
    profile.tokens = tokens;
    // also refresh holdings
    profile.holdings = await getAccountHoldings(accountId);
    updateUser(userId, profile);
    return profile;
}
export async function getHoldings(userId) {
    const profile = getUser(userId);
    if (!profile || !profile.accountId)
        throw new Error("User not monitored or missing accountId");
    const accountId = await resolveAccountId(profile.accountId);
    const holdings = await getAccountHoldings(accountId);
    profile.holdings = holdings;
    updateUser(userId, profile);
    return holdings;
}
// A2A Portfolio Agent Class
export class PortfolioAgent {
    agentName = "portfolio@portfolio.guard";
    pendingData = new Map();
    constructor() {
        bus.registerAgent(this.agentName);
        this.setupMessageHandlers();
    }
    setupMessageHandlers() {
        bus.on(`message:${this.agentName}`, (message) => {
            console.log(`📊 Portfolio Agent received: ${message.type} from ${message.from}`);
            this.handleMessage(message);
        });
    }
    async handleMessage(message) {
        switch (message.type) {
            case "balance_update":
                await this.handleBalanceUpdate(message);
                break;
            case "x_news_alert":
                await this.handleXNewsAlert(message);
                break;
            default:
                console.log(`❓ Portfolio Agent: Unknown message type: ${message.type}`);
        }
    }
    async handleBalanceUpdate(message) {
        const payload = message.payload;
        console.log(`📊 Received balance update for ${payload.userId}: ${payload.token}`);
        // Store balance update
        if (!this.pendingData.has(payload.userId)) {
            this.pendingData.set(payload.userId, {
                balanceUpdates: new Map(),
                xNewsAlerts: new Map(),
                timestamp: Date.now(),
            });
        }
        const userData = this.pendingData.get(payload.userId);
        userData.balanceUpdates.set(payload.token, payload);
        // Check if we have enough data to generate risk summary
        this.checkAndGenerateRiskSummary(payload.userId);
    }
    async handleXNewsAlert(message) {
        const payload = message.payload;
        console.log(`📊 Received X news alert for ${payload.userId}: ${payload.token}`);
        // Store X news alert
        if (!this.pendingData.has(payload.userId)) {
            this.pendingData.set(payload.userId, {
                balanceUpdates: new Map(),
                xNewsAlerts: new Map(),
                timestamp: Date.now(),
            });
        }
        const userData = this.pendingData.get(payload.userId);
        userData.xNewsAlerts.set(payload.token, payload);
        // Check if we have enough data to generate risk summary
        this.checkAndGenerateRiskSummary(payload.userId);
    }
    checkAndGenerateRiskSummary(userId) {
        const userData = this.pendingData.get(userId);
        if (!userData)
            return;
        // Wait for at least one balance update and one X news alert, or timeout after 2 seconds
        const hasBalanceData = userData.balanceUpdates.size > 0;
        const hasXData = userData.xNewsAlerts.size > 0;
        const isTimedOut = Date.now() - userData.timestamp > 2000;
        if ((hasBalanceData && hasXData) || isTimedOut) {
            this.generateRiskSummary(userId);
        }
    }
    generateRiskSummary(userId) {
        const userData = this.pendingData.get(userId);
        if (!userData)
            return;
        console.log(`📊 Generating risk summary for ${userId}`);
        const tokens = {};
        let totalValue = 0;
        let totalChange = 0;
        // Process balance updates
        for (const [tokenSymbol, balanceUpdate] of userData.balanceUpdates) {
            const xAlert = userData.xNewsAlerts.get(tokenSymbol);
            // Calculate risk based on sentiment and wallet delta
            let risk = "MEDIUM";
            if (balanceUpdate.delta && balanceUpdate.delta < -1000) {
                risk = "CRITICAL";
            }
            else if (xAlert && xAlert.sentiment === "NEGATIVE") {
                risk = "HIGH";
            }
            else if (xAlert && xAlert.sentiment === "POSITIVE") {
                risk = "LOW";
            }
            else if (balanceUpdate.delta && balanceUpdate.delta > 0) {
                risk = "SAFE";
            }
            tokens[tokenSymbol] = {
                wallet_delta: balanceUpdate.delta || 0,
                x_volume_spike: xAlert?.volume_spike || "0%",
                risk: risk,
                top_tweets: xAlert?.top_tweets || [],
            };
            // Calculate portfolio value (simplified)
            if (tokenSymbol === "HBAR") {
                totalValue += balanceUpdate.balance * 0.05; // Assume $0.05 per HBAR
                totalChange += (balanceUpdate.delta || 0) * 0.05;
            }
            else {
                totalValue += balanceUpdate.balance * 1; // Assume $1 per token for demo
                totalChange += (balanceUpdate.delta || 0) * 1;
            }
        }
        // Calculate percentage change
        const changePercent = totalValue > 0 ? (totalChange / totalValue) * 100 : 0;
        const riskSummary = {
            userId,
            tokens,
            total_value: Math.round(totalValue),
            change_24h: Math.round(changePercent * 100) / 100,
            onchain_proof: `0.0.${Math.floor(Math.random() * 100000)}:${Math.random()
                .toString(36)
                .substring(7)}`,
        };
        // Send risk summary to chat agent
        bus.sendMessage({
            type: "risk_summary",
            from: this.agentName,
            to: "chat@portfolio.guard",
            payload: riskSummary,
        });
        // Clean up pending data
        this.pendingData.delete(userId);
        console.log(`📊 Risk summary sent for ${userId}`);
    }
    destroy() {
        bus.unregisterAgent(this.agentName);
    }
}
export const portfolioAgent = new PortfolioAgent();
