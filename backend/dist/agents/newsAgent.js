import { fetchNewsHeadlines, fetchXSentiment, } from "../services/news.js";
import { fetchPriceUSD } from "../services/price.js";
import { bus, } from "../utils/bus.js";
export async function analyzeToken(token) {
    const query = token.toUpperCase();
    const [news, x] = await Promise.all([
        fetchNewsHeadlines(query),
        fetchXSentiment(query),
    ]);
    return { token: query, news, x };
}
export async function sendXNewsAlert(userId, token) {
    const { news, x } = await analyzeToken(token);
    const priceUSD = await fetchPriceUSD(token);
    const payload = {
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
    agentName = "xtrend@portfolio.guard";
    constructor() {
        bus.registerAgent(this.agentName);
        this.setupMessageHandlers();
    }
    setupMessageHandlers() {
        bus.on(`message:${this.agentName}`, (message) => {
            console.log(`📰 XTrend Agent received: ${message.type} from ${message.from}`);
            this.handleMessage(message);
        });
    }
    async handleMessage(message) {
        switch (message.type) {
            case "scan_request":
                await this.handleScanRequest(message);
                break;
            default:
                console.log(`❓ XTrend Agent: Unknown message type: ${message.type}`);
        }
    }
    async handleScanRequest(message) {
        try {
            const payload = message.payload;
            console.log(`📰 Analyzing X sentiment for user: ${payload.userId}, token: ${payload.token}`);
            // Analyze token sentiment
            const { news, x } = await analyzeToken(payload.token);
            const priceUSD = await fetchPriceUSD(payload.token);
            // Calculate volume spike (simulated for demo)
            const volumeSpike = Math.floor(Math.random() * 500) + 10; // Random between 10-510%
            // Create X news alert payload
            const xNewsAlert = {
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
            console.log(`📰 Sent X sentiment analysis for ${payload.token} to portfolio agent`);
        }
        catch (error) {
            console.error("Error in XTrend scan:", error);
        }
    }
    destroy() {
        bus.unregisterAgent(this.agentName);
    }
}
export const xTrendAgent = new XTrendAgent();
