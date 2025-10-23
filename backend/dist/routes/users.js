import express from "express";
import { monitorUser, refreshTokens, getHoldings, } from "../agents/portfolioAgent.js";
import { analyzeToken } from "../agents/newsAgent.js";
import { fetchPriceUSD } from "../services/price.js";
import { chatAgent } from "../agents/chatAgent.js";
const router = express.Router();
router.get("/_debug", (_req, res) => {
    try {
        const routes = router.stack
            .filter((l) => l.route)
            .map((l) => ({
            path: l.route.path,
            methods: Object.keys(l.route.methods),
        }));
        res.json({ ok: true, routes });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
});
router.post("/:userId/monitor", async (req, res) => {
    try {
        const { address } = req.body || {};
        if (!address)
            return res.status(400).json({ error: "Missing address" });
        await monitorUser(req.params.userId, address);
        const profile = await refreshTokens(req.params.userId);
        res.json({ ok: true, profile });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
});
router.get("/:userId/holdings", async (req, res) => {
    try {
        const holdings = await getHoldings(req.params.userId);
        res.json({ ok: true, holdings });
    }
    catch (e) {
        res.status(404).json({ ok: false, error: e?.message || String(e) });
    }
});
router.post("/:userId/holdings", async (req, res) => {
    try {
        const holdings = await getHoldings(req.params.userId);
        res.json({ ok: true, holdings });
    }
    catch (e) {
        res.status(404).json({ ok: false, error: e?.message || String(e) });
    }
});
router.post("/:userId/test-graph", async (req, res) => {
    try {
        const { token = "HBAR", timeframe = "7d", chartType = "price" } = req.body || {};
        const userId = req.params.userId;
        console.log(`📊 Graph test request from ${userId}: ${token} (${timeframe}, ${chartType})`);
        // Import MarketDataService to test graph generation directly
        const { MarketDataService } = await import("../services/marketData.js");
        const marketDataService = new MarketDataService();
        const startTime = Date.now();
        // Test token chart generation
        const chartData = await marketDataService.getTokenChartData(token, timeframe, chartType);
        const latency = Date.now() - startTime;
        if (chartData) {
            res.json({
                ok: true,
                chartData,
                latency,
                timestamp: new Date().toISOString(),
                test_info: {
                    token,
                    timeframe,
                    chartType,
                    data_points: chartData.data.length,
                    confidence: chartData.metadata.confidence
                }
            });
        }
        else {
            res.json({
                ok: false,
                error: `Failed to generate chart data for ${token}`,
                latency,
                timestamp: new Date().toISOString(),
                test_info: {
                    token,
                    timeframe,
                    chartType
                }
            });
        }
    }
    catch (e) {
        console.error("Graph test endpoint error:", e);
        res.status(500).json({
            ok: false,
            error: e?.message || String(e),
            timestamp: new Date().toISOString()
        });
    }
});
router.post("/:userId/chat", async (req, res) => {
    try {
        const { message, timeframe } = req.body || {};
        const userId = req.params.userId;
        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                ok: false,
                error: "Message is required",
            });
        }
        console.log(`💬 Chat request from ${userId}: ${message}`);
        // Process the message through the Chat Agent
        const response = await chatAgent.processUserCommand(message.trim(), userId);
        res.json({
            ok: true,
            response: response,
            timestamp: new Date().toISOString(),
            user_id: userId,
        });
    }
    catch (e) {
        console.error("Chat endpoint error:", e);
        res.status(500).json({
            ok: false,
            error: e?.message || String(e),
        });
    }
});
// New streaming chat endpoint
router.post("/:userId/chat-stream", async (req, res) => {
    try {
        const { message } = req.body || {};
        const { userId } = req.params;
        if (!message) {
            return res.status(400).json({ error: "Missing message" });
        }
        console.log(`💬 Streaming chat request from ${userId}: ${message}`);
        // Set up Server-Sent Events
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        });
        // Helper function to send SSE data
        const sendStep = (step, data) => {
            res.write(`event: ${step}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        try {
            // Process the message through the streaming Chat Agent
            await chatAgent.processUserCommandStreaming(message.trim(), userId, sendStep);
            // Send completion event
            sendStep("complete", { message: "Analysis complete" });
        }
        catch (error) {
            console.error("Streaming chat error:", error);
            sendStep("error", { error: error.message || String(error) });
        }
        res.end();
    }
    catch (e) {
        console.error("Chat streaming endpoint error:", e);
        res.status(500).json({
            ok: false,
            error: e?.message || String(e),
        });
    }
});
router.post("/:userId/start", async (_req, res) => {
    res.json({ ok: true, message: "Monitoring started" });
});
router.post("/:userId/x-test", async (req, res) => {
    try {
        const { token = "HBAR" } = req.body || {};
        const { news, x } = await analyzeToken(token);
        const price = await fetchPriceUSD(token);
        res.json({
            ok: true,
            token,
            sentiment: x.sentiment,
            price,
            headlines: news,
            xError: x.error,
        });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
});
export default router;
