import express, { Request, Response } from "express";
import {
  createNewChat,
  getUserChats,
  getChatById,
  getChatMessages,
  addMessageToChat,
  getUserContext,
  getContextualHistory,
  deleteChat,
  updateChatTitle,
  getChatStats,
  searchChats,
} from "../store/chats.js";
import { chatAgent } from "../agents/chatAgent.js";

const router = express.Router();

// Get all chats for a user
router.get("/:userId/chats", (req: Request<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;
    const chats = getUserChats(userId);
    
    res.json({
      ok: true,
      chats,
      count: chats.length,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
});

// Create a new chat
router.post("/:userId/chats", (req: Request<{ userId: string }, any, { title?: string }>, res: Response) => {
  try {
    const { userId } = req.params;
    const { title } = req.body || {};
    
    const newChat = createNewChat(userId, title);
    
    res.json({
      ok: true,
      chat: newChat,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
});

// Get a specific chat with its messages
router.get("/:userId/chats/:chatId", (req: Request<{ userId: string; chatId: string }>, res: Response) => {
  try {
    const { userId, chatId } = req.params;
    
    const chat = getChatById(chatId);
    if (!chat || chat.userId !== userId) {
      return res.status(404).json({
        ok: false,
        error: "Chat not found",
      });
    }
    
    const messages = getChatMessages(chatId);
    
    res.json({
      ok: true,
      chat,
      messages,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
});

// Send a message to a chat
router.post(
  "/:userId/chats/:chatId/messages",
  async (
    req: Request<{ userId: string; chatId: string }, any, { message: string; useContext?: boolean }>,
    res: Response
  ) => {
    try {
      const { userId, chatId } = req.params;
      const { message, useContext = true } = req.body || {};

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          ok: false,
          error: "Message is required",
        });
      }

      // Verify chat exists and belongs to user
      const chat = getChatById(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({
          ok: false,
          error: "Chat not found",
        });
      }

      console.log(`💬 Chat message from ${userId} in chat ${chatId}: ${message}`);

      // Add user message to chat
      const userMessage = addMessageToChat(chatId, userId, "user", message.trim());

      // Get conversation context if requested
      let contextHistory: any[] = [];
      if (useContext) {
        const history = getContextualHistory(userId, chatId);
        // Convert to format expected by chat agent (last 10 messages for context)
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
        chatId,
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
        userMessage,
        assistantMessage,
        response: response.response,
        graphs: response.graphs,
        latency: response.latency,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Chat message endpoint error:", error);
      res.status(500).json({
        ok: false,
        error: error?.message || String(error),
      });
    }
  }
);

// Send a streaming message to a chat
router.post(
  "/:userId/chats/:chatId/messages/stream",
  async (
    req: Request<{ userId: string; chatId: string }, any, { message: string; useContext?: boolean }>,
    res: Response
  ) => {
    try {
      const { userId, chatId } = req.params;
      const { message, useContext = true } = req.body || {};

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          ok: false,
          error: "Message is required",
        });
      }

      // Verify chat exists and belongs to user
      const chat = getChatById(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({
          ok: false,
          error: "Chat not found",
        });
      }

      console.log(`💬 Streaming chat message from ${userId} in chat ${chatId}: ${message}`);

      // Add user message to chat
      const userMessage = addMessageToChat(chatId, userId, "user", message.trim());

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
        try {
          const jsonData = JSON.stringify(data, (key, value) => {
            // Handle circular references and non-serializable objects
            if (typeof value === 'object' && value !== null) {
              if (value.constructor && value.constructor.name !== 'Object' && value.constructor.name !== 'Array') {
                return `[${value.constructor.name}]`;
              }
            }
            return value;
          });
          res.write(`event: ${step}\n`);
          res.write(`data: ${jsonData}\n\n`);
        } catch (error) {
          console.error(`Error serializing SSE data for step ${step}:`, error);
          console.error('Data that failed to serialize:', data);
          // Send a safe error message instead
          res.write(`event: ${step}\n`);
          res.write(`data: ${JSON.stringify({ error: 'Serialization failed', step })}\n\n`);
        }
      };

      // Send user message confirmation
      sendStep("user_message", { message: userMessage });

      let assistantResponse = "";
      let responseGraphs: any[] = [];

      try {
        // Get conversation context if requested
        let contextHistory: any[] = [];
        if (useContext) {
          const history = getContextualHistory(userId, chatId);
          contextHistory = history.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
          }));
        }

        // Process the message through the streaming Chat Agent
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
            chatId,
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
        sendStep("complete", { message: "Analysis complete" });
      } catch (error: any) {
        console.error("Streaming chat error:", error);
        sendStep("error", { error: error.message || String(error) });
      }

      res.end();
    } catch (error: any) {
      console.error("Chat streaming endpoint error:", error);
      res.status(500).json({
        ok: false,
        error: error?.message || String(error),
      });
    }
  }
);

// Delete a chat
router.delete("/:userId/chats/:chatId", (req: Request<{ userId: string; chatId: string }>, res: Response) => {
  try {
    const { userId, chatId } = req.params;
    
    // Verify chat exists and belongs to user
    const chat = getChatById(chatId);
    if (!chat || chat.userId !== userId) {
      return res.status(404).json({
        ok: false,
        error: "Chat not found",
      });
    }
    
    const deleted = deleteChat(chatId);
    
    if (deleted) {
      res.json({
        ok: true,
        message: "Chat deleted successfully",
      });
    } else {
      res.status(500).json({
        ok: false,
        error: "Failed to delete chat",
      });
    }
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
});

// Update chat title
router.patch(
  "/:userId/chats/:chatId",
  (req: Request<{ userId: string; chatId: string }, any, { title: string }>, res: Response) => {
    try {
      const { userId, chatId } = req.params;
      const { title } = req.body || {};

      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          ok: false,
          error: "Title is required",
        });
      }

      // Verify chat exists and belongs to user
      const chat = getChatById(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({
          ok: false,
          error: "Chat not found",
        });
      }

      const updated = updateChatTitle(chatId, title.trim());

      if (updated) {
        const updatedChat = getChatById(chatId);
        res.json({
          ok: true,
          chat: updatedChat,
        });
      } else {
        res.status(500).json({
          ok: false,
          error: "Failed to update chat title",
        });
      }
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: error?.message || String(error),
      });
    }
  }
);

// Get user's chat context and statistics
router.get("/:userId/context", (req: Request<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;
    
    const context = getUserContext(userId);
    const stats = getChatStats(userId);
    
    res.json({
      ok: true,
      context,
      stats,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
});

// Search chats
router.get("/:userId/chats/search/:query", (req: Request<{ userId: string; query: string }>, res: Response) => {
  try {
    const { userId, query } = req.params;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        ok: false,
        error: "Search query must be at least 2 characters",
      });
    }
    
    const results = searchChats(userId, query.trim());
    
    res.json({
      ok: true,
      results,
      count: results.length,
      query: query.trim(),
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
});

// Get messages from a specific chat with pagination
router.get(
  "/:userId/chats/:chatId/messages",
  (req: Request<{ userId: string; chatId: string }, any, any, { limit?: string; offset?: string }>, res: Response) => {
    try {
      const { userId, chatId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // Verify chat exists and belongs to user
      const chat = getChatById(chatId);
      if (!chat || chat.userId !== userId) {
        return res.status(404).json({
          ok: false,
          error: "Chat not found",
        });
      }

      const allMessages = getChatMessages(chatId);
      const totalMessages = allMessages.length;
      
      // Apply pagination
      const messages = allMessages.slice(offset, offset + limit);

      res.json({
        ok: true,
        messages,
        pagination: {
          total: totalMessages,
          limit,
          offset,
          hasMore: offset + limit < totalMessages,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: error?.message || String(error),
      });
    }
  }
);

export default router;