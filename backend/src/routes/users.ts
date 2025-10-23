import express, { Request, Response } from "express";
import {
  monitorUser,
  refreshTokens,
  getHoldings,
} from "../agents/portfolioAgent.js";
import { analyzeToken, sendXNewsAlert } from "../agents/newsAgent.js";
import { fetchPriceUSD } from "../services/price.js";
import { chatAgent } from "../agents/chatAgent.js";
import {
  createNewChat,
  addMessageToChat,
  getContextualHistory,
  getUserContext,
} from "../store/chats.js";

const router = express.Router();

router.get("/_debug", (_req: Request, res: Response) => {
  try {
    const routes = (router as any).stack
      .filter((l: any) => l.route)
      .map((l: any) => ({
        path: l.route.path,
        methods: Object.keys(l.route.methods),
      }));
    res.json({ ok: true, routes });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post(
  "/:userId/monitor",
  async (
    req: Request<{ userId: string }, any, { address?: string }>,
    res: Response
  ) => {
    try {
      const { address } = req.body || {};
      if (!address) return res.status(400).json({ error: "Missing address" });
      await monitorUser(req.params.userId, address);
      const profile = await refreshTokens(req.params.userId);
      res.json({ ok: true, profile });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
);

router.get(
  "/:userId/holdings",
  async (req: Request<{ userId: string }>, res: Response) => {
    try {
      const holdings = await getHoldings(req.params.userId);
      res.json({ ok: true, holdings });
    } catch (e: any) {
      res.status(404).json({ ok: false, error: e?.message || String(e) });
    }
  }
);

router.post(
  "/:userId/holdings",
  async (req: Request<{ userId: string }>, res: Response) => {
    try {
      const holdings = await getHoldings(req.params.userId);
      res.json({ ok: true, holdings });
    } catch (e: any) {
      res.status(404).json({ ok: false, error: e?.message || String(e) });
    }
  }
);

router.post(
  "/:userId/test-graph",
  async (
    req: Request<
      { userId: string },
      any,
      { token?: string; timeframe?: string; chartType?: string }
    >,
    res: Response
  ) => {
    try {
      const { token = "HBAR", timeframe = "7d", chartType = "price" } = req.body || {};
      const userId = req.params.userId;

      console.log(`📊 Graph test request from ${userId}: ${token} (${timeframe}, ${chartType})`);

      // Import MarketDataService to test graph generation directly
      const { MarketDataService } = await import("../services/marketData.js");
      const marketDataService = new MarketDataService();

      const startTime = Date.now();

      // Test token chart generation
      const chartData = await marketDataService.getTokenChartData(
        token,
        timeframe as '1h' | '24h' | '7d' | '30d',
        chartType as 'line' | 'candlestick' | 'volume' | 'correlation'
      );

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
      } else {
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
    } catch (e: any) {
      console.error("Graph test endpoint error:", e);
      res.status(500).json({
        ok: false,
        error: e?.message || String(e),
        timestamp: new Date().toISOString()
      });
    }
  }
);

router.post(
  "/:userId/chat",
  async (
    req: Request<
      { userId: string },
      any,
      { message?: string; timeframe?: string; chatId?: string; useContext?: boolean }
    >,
    res: Response
  ) => {
    try {
      const { message, timeframe, chatId, useContext = true } = req.body || {};
      const userId = req.params.userId;

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          ok: false,
          error: "Message is required",
        });
      }

      console.log(`💬 Legacy chat request from ${userId}: ${message}`);

      // Create a new chat if no chatId provided (for backward compatibility)
      let activeChatId = chatId;
      if (!activeChatId) {
        const userContext = getUserContext(userId);
        if (userContext && userContext.currentChatId) {
          activeChatId = userContext.currentChatId;
        } else {
          const newChat = createNewChat(userId, "Legacy Chat");
          activeChatId = newChat.id;
        }
      }

      // Add user message to chat
      const userMessage = addMessageToChat(activeChatId, userId, "user", message.trim());

      // Get conversation context if requested
      let contextHistory: any[] = [];
      if (useContext) {
        const history = getContextualHistory(userId, activeChatId);
        contextHistory = history.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }));
      }

      // Process the message through the Chat Agent with context
      const response = await chatAgent.processUserCommandWithContext(
        message.trim(),
        userId,
        contextHistory
      );

      // Add assistant response to chat
      const assistantMessage = addMessageToChat(
        activeChatId,
        userId,
        "assistant",
        response.response,
        {
          graphs: response.graphs,
          latency: response.latency,
        }
      );

      res.json({
        ok: true,
        response: response.response,
        graphs: response.graphs,
        latency: response.latency,
        timestamp: new Date().toISOString(),
        user_id: userId,
        chat_id: activeChatId,
        user_message: userMessage,
        assistant_message: assistantMessage,
      });
    } catch (e: any) {
      console.error("Chat endpoint error:", e);
      res.status(500).json({
        ok: false,
        error: e?.message || String(e),
      });
    }
  }
);

// Legacy streaming chat endpoint
router.post(
  "/:userId/chat-stream",
  async (
    req: Request<{ userId: string }, any, { message?: string; chatId?: string; useContext?: boolean }>,
    res: Response
  ) => {
    try {
      const { message, chatId, useContext = true } = req.body || {};
      const { userId } = req.params;

      if (!message) {
        return res.status(400).json({ error: "Missing message" });
      }

      console.log(`💬 Legacy streaming chat request from ${userId}: ${message}`);

      // Create a new chat if no chatId provided (for backward compatibility)
      let activeChatId = chatId;
      if (!activeChatId) {
        const userContext = getUserContext(userId);
        if (userContext && userContext.currentChatId) {
          activeChatId = userContext.currentChatId;
        } else {
          const newChat = createNewChat(userId, "Legacy Stream Chat");
          activeChatId = newChat.id;
        }
      }

      // Add user message to chat
      const userMessage = addMessageToChat(activeChatId, userId, "user", message.trim());

      // Set up Server-Sent Events
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      });

      // Helper function to send SSE data
      const sendStep = (step: string, data: any) => {
        res.write(`event: ${step}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Send user message confirmation
      sendStep("user_message", { message: userMessage });

      let assistantResponse = "";
      let responseGraphs: any[] = [];

      try {
        // Get conversation context if requested
        let contextHistory: any[] = [];
        if (useContext) {
          const history = getContextualHistory(userId, activeChatId);
          contextHistory = history.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
          }));
        }

        // Process the message through the streaming Chat Agent with context
        await chatAgent.processUserCommandStreamingWithContext(
          message.trim(),
          userId,
          contextHistory,
          (step: string, data: any) => {
            sendStep(step, data);
            
            // Capture the final response
            if (step === "complete" && data.response) {
              assistantResponse = data.response;
              responseGraphs = data.graphs || [];
            }
          }
        );

        // Add assistant response to chat if we got one
        if (assistantResponse) {
          const assistantMessage = addMessageToChat(
            activeChatId,
            userId,
            "assistant",
            assistantResponse,
            {
              graphs: responseGraphs,
            }
          );
          
          sendStep("assistant_message", { message: assistantMessage });
        }

        // Send completion event
        sendStep("complete", { message: "Analysis complete", chatId: activeChatId });
      } catch (error: any) {
        console.error("Streaming chat error:", error);
        sendStep("error", { error: error.message || String(error) });
      }

      res.end();
    } catch (e: any) {
      console.error("Chat streaming endpoint error:", e);
      res.status(500).json({
        ok: false,
        error: e?.message || String(e),
      });
    }
  }
);

router.post("/:userId/start", async (_req: Request, res: Response) => {
  res.json({ ok: true, message: "Monitoring started" });
});

router.post(
  "/:userId/x-test",
  async (
    req: Request<{ userId: string }, any, { token?: string }>,
    res: Response
  ) => {
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
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
);

export default router;
