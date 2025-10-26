"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount } from "wagmi";

export interface StreamStep {
  step: string;
  data: any;
  timestamp?: string;
}

export interface ChatStreamMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  graphs?: any[];
}

export interface UseChatStreamReturn {
  messages: ChatStreamMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  isConnected: boolean;
  hederaAccountId: string | null; // Contains EVM address for API calls
}

/**
 * Custom hook for handling chat streaming with the backend API
 * Automatically converts wallet address to Hedera account ID for API calls
 * Uses Server-Sent Events (SSE) for real-time streaming responses
 */
export function useChatStream(): UseChatStreamReturn {
  const { address, isConnected } = useAccount();
  const [messages, setMessages] = useState<ChatStreamMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentStreamingMessageRef = useRef<string>("");
  const hasHandledResponseRef = useRef<boolean>(false);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;

      // Use fallback address for testing if wallet is not connected
      const userAddress = address || "0x1234567890123456789012345678901234567890";
      if (!address || !isConnected) {
        setError("Please connect your wallet first to start chatting");
        return;
      }

      if (isStreaming) {
        setError("Please wait for the current message to complete");
        return;
      }

      setError(null);
      setIsStreaming(true);
      currentStreamingMessageRef.current = "";
      hasHandledResponseRef.current = false;

      // Add user message immediately
      const userMessage: ChatStreamMessage = {
        id: Date.now().toString(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // No need for placeholder assistant message since we create individual messages for each step
      const assistantMessageId = (Date.now() + 1).toString();

      try {
        // Convert EVM address to Hedera account ID format for the API
        let userId = userAddress;
        if (userAddress.startsWith("0x")) {
          // For EVM addresses, we need to convert them to Hedera account ID format
          // The backend resolveAccountId function expects this format
          console.log(
            "Debug - Converting EVM address to Hedera format:",
            userAddress
          );
          userId = userAddress; // Keep as EVM address, backend will handle conversion
        }

        console.log("Debug - wallet address:", userAddress);
        console.log("Debug - isConnected:", isConnected);
        console.log("Debug - userId for API:", userId);
        const apiUrl = `http://localhost:3001/api/${userId}/chat-stream`;
        console.log("Debug - API URL:", apiUrl);

        // Close any existing EventSource
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Send the message via POST and handle the SSE stream response
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            message: message.trim(),
            useContext: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body received");
        }

        // Read the SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = ""; // Buffer to accumulate incomplete data

        const readStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                finishStreaming(assistantMessageId);
                break;
              }

              // Decode chunk and add to buffer
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;

              // Process complete lines from buffer
              const lines = buffer.split("\n");
              // Keep the last line in buffer if it doesn't end with newline
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("event:")) {
                  // Extract event type
                  const eventType = line.substring(6).trim();
                  continue;
                }

                if (line.startsWith("data:")) {
                  try {
                    const dataStr = line.substring(5).trim();
                    if (dataStr) {
                      // Validate JSON before parsing
                      if (!isValidJSON(dataStr)) {
                        console.warn("Skipping invalid JSON:", dataStr);
                        continue;
                      }

                      const data = JSON.parse(dataStr);

                      // Handle different event types
                      if (data.step) {
                        handleStreamStep(data, assistantMessageId);
                      } else {
                        // Handle direct data events
                        handleStreamStep(
                          { step: "update", data },
                          assistantMessageId
                        );
                      }

                      // Check for completion
                      if (data.step === "complete" || data.step === "summary") {
                        finishStreaming(
                          assistantMessageId,
                          data.response,
                          data.graphs
                        );
                        break;
                      }

                      // Check for errors
                      if (data.step === "error") {
                        handleStreamError(
                          data.error || "An error occurred during streaming"
                        );
                        finishStreaming(
                          assistantMessageId,
                          `Error: ${data.error || "Unknown error"}`
                        );
                        break;
                      }
                    }
                  } catch (parseError) {
                    console.error("Error parsing SSE data:", parseError);
                    console.error(
                      "Problematic data:",
                      line.substring(5).trim()
                    );
                    // Continue processing other lines instead of breaking
                  }
                }
              }
            }
          } catch (streamError) {
            console.error("Error reading stream:", streamError);
            handleStreamError("Stream reading error occurred");
            finishStreaming(
              assistantMessageId,
              "Stream reading error occurred"
            );
          } finally {
            reader.releaseLock();
          }
        };

        // Helper function to validate JSON
        const isValidJSON = (str: string): boolean => {
          try {
            JSON.parse(str);
            return true;
          } catch {
            return false;
          }
        };

        // Start reading the stream
        readStream();
      } catch (err) {
        console.error("Error sending message:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);
        finishStreaming(assistantMessageId, `Error: ${errorMessage}`);
      }
    },
    [address, isConnected, isStreaming]
  );

  // Helper function to format market trends data
  const formatMarketTrends = (trends: any[]) => {
    if (!trends || trends.length === 0) return "";

    return trends
      .slice(0, 5)
      .map(
        (trend, index) =>
          `${index + 1}. **${trend.title}** (${trend.source})\n   ${
            trend.description || "No description available"
          }\n   🔗 [Read more](${trend.url})\n`
      )
      .join("\n");
  };

  // Helper function to format news data
  const formatNewsData = (newsData: any) => {
    console.log("🔧 formatNewsData called with:", newsData);

    if (!newsData) {
      console.log("❌ formatNewsData: No newsData provided");
      return "";
    }

    let formatted = "";

    // Handle marketData structure
    if (newsData.marketData) {
      const marketData = newsData.marketData;
      console.log("📊 Processing marketData:", marketData);

      if (marketData.sentiment) {
        formatted += `**📈 Market Sentiment:** ${marketData.sentiment.toUpperCase()}\n\n`;
        console.log("✅ Added market sentiment to formatted data");
      }

      if (marketData.searchTerms && marketData.searchTerms.length > 0) {
        formatted += `**🔍 Search Terms:** ${marketData.searchTerms.join(", ")}\n\n`;
        console.log("✅ Added search terms to formatted data");
      }

      if (marketData.trends && marketData.trends.length > 0) {
        formatted += `**📰 Latest Market Trends:**\n`;
        console.log(`✅ Processing ${marketData.trends.length} market trends`);
        marketData.trends
          .slice(0, 5)
          .forEach((trend: any, index: number) => {
            formatted += `${index + 1}. **${trend.title}**\n`;
            if (trend.description) {
              formatted += `   ${trend.description}\n`;
            }
            formatted += `   *Source: ${trend.source}* | [Read more](${trend.url})\n\n`;
          });
      }

      if (marketData.tokenAnalysis) {
        formatted += `**🪙 Token Analysis:**\n`;
        Object.entries(marketData.tokenAnalysis).forEach(([token, analysis]: [string, any]) => {
          formatted += `• **${token.toUpperCase()}**: ${analysis.sentiment || 'N/A'}\n`;
          if (analysis.mentions) {
            formatted += `  Mentions: ${analysis.mentions}\n`;
          }
        });
        formatted += "\n";
        console.log("✅ Added token analysis to formatted data");
      }

      if (marketData.xPosts && marketData.xPosts.length > 0) {
        formatted += `**🐦 Recent Social Posts:**\n`;
        marketData.xPosts
          .slice(0, 3)
          .forEach((post: any, index: number) => {
            formatted += `${index + 1}. ${post.text || post.content}\n`;
            if (post.author) {
              formatted += `   *by @${post.author}*\n`;
            }
            formatted += "\n";
          });
        console.log("✅ Added X posts to formatted data");
      }

      if (marketData.xSentiment) {
        formatted += `**🐦 Social Sentiment:** ${marketData.xSentiment}\n`;
        if (marketData.xPostsAnalyzed !== undefined) {
          formatted += `**Posts Analyzed:** ${marketData.xPostsAnalyzed}\n`;
        }
        formatted += "\n";
        console.log("✅ Added social sentiment to formatted data");
      }
    }

    // Handle direct newsAnalysis structure
    if (newsData.newsAnalysis) {
      const analysis = newsData.newsAnalysis;
      formatted += `**📊 News Analysis:**\n${analysis}\n\n`;
      console.log("✅ Added news analysis to formatted data");
    }

    // Handle direct trends array
    if (newsData.trends && Array.isArray(newsData.trends)) {
      formatted += `**📰 Market Trends:**\n`;
      formatted += formatMarketTrends(newsData.trends);
      console.log("✅ Added direct trends to formatted data");
    }

    console.log("📝 Final formatted news data:", formatted);
    return formatted;
  };

  // Helper function to format scanner data
  const formatScannerData = (scanData: any) => {
    console.log("🔧 formatScannerData called with:", scanData);

    if (!scanData) {
      console.log("❌ formatScannerData: No scanData provided");
      return "";
    }

    let formatted = "";

    if (scanData.address) {
      formatted += `**Address:** ${scanData.address}\n\n`;
      console.log("✅ Added address to formatted data");
    }

    if (scanData.riskScore !== undefined) {
      formatted += `**⚠️ Risk Score:** ${scanData.riskScore}/10\n\n`;
      console.log("✅ Added risk score to formatted data");
    }

    if (scanData.marketData) {
      console.log("📊 Processing marketData:", scanData.marketData);

      if (scanData.marketData.sentiment) {
        formatted += `**📈 Market Sentiment:** ${scanData.marketData.sentiment.toUpperCase()}\n\n`;
        console.log("✅ Added market sentiment to formatted data");
      }

      if (scanData.marketData.trends && scanData.marketData.trends.length > 0) {
        formatted += `**📰 Market Trends:**\n`;
        console.log(
          `✅ Processing ${scanData.marketData.trends.length} market trends`
        );
        scanData.marketData.trends
          .slice(0, 5)
          .forEach((trend: any, index: number) => {
            formatted += `${index + 1}. **${trend.title}**\n`;
            if (trend.description) {
              formatted += `   ${trend.description}\n`;
            }
            formatted += `   *Source: ${trend.source}* | [Read more](${trend.url})\n\n`;
          });
      }

      if (scanData.marketData.xSentiment) {
        formatted += `**🐦 Social Sentiment:** ${scanData.marketData.xSentiment}\n`;
        if (scanData.marketData.xPostsAnalyzed !== undefined) {
          formatted += `**Posts Analyzed:** ${scanData.marketData.xPostsAnalyzed}\n`;
        }
        if (scanData.marketData.xError) {
          formatted += `**⚠️ Social Analysis Error:** ${scanData.marketData.xError}\n`;
        }
        formatted += "\n";
        console.log("✅ Added social sentiment to formatted data");
      }
    }

    if (scanData.warnings && scanData.warnings.length > 0) {
      formatted += `**⚠️ Warnings:**\n`;
      scanData.warnings.forEach((warning: string) => {
        formatted += `• ${warning}\n`;
      });
      formatted += "\n";
      console.log("✅ Added warnings to formatted data");
    }

    if (scanData.recommendations && scanData.recommendations.length > 0) {
      formatted += `**💡 Recommendations:**\n`;
      scanData.recommendations.forEach((rec: string) => {
        formatted += `• ${rec}\n`;
      });
      formatted += "\n";
      console.log("✅ Added recommendations to formatted data");
    }

    console.log("📝 Final formatted scanner data:", formatted);
    return formatted;
  };

  // Helper function to format LLM data
  const formatLLMData = (llmData: any) => {
    console.log("🔧 formatLLMData called with:", llmData);

    if (!llmData) {
      console.log("❌ formatLLMData: No llmData provided");
      return "";
    }

    let formatted = "";

    if (llmData.userId) {
      formatted += `**🎯 Analysis Target:** ${llmData.userId}\n\n`;
      console.log("✅ Added userId to formatted data");
    }

    if (llmData.response) {
      formatted += `**🤖 AI Analysis:**\n${llmData.response}\n\n`;
      console.log("✅ Added response to formatted data");
    }

    if (llmData.query) {
      formatted += `**📝 Query Details:**\n${llmData.query.substring(0, 200)}${
        llmData.query.length > 200 ? "..." : ""
      }\n\n`;
      console.log("✅ Added query to formatted data");
    }

    if (llmData.success !== undefined) {
      formatted += `**✅ Status:** ${
        llmData.success ? "Analysis Completed Successfully" : "Analysis Failed"
      }\n`;
      console.log("✅ Added success status to formatted data");
    }

    console.log("📝 Final formatted LLM data:", formatted);
    return formatted;
  };

  const handleStreamStep = useCallback(
    (stepData: StreamStep, messageId: string) => {
      console.log("🔍 handleStreamStep received data:", stepData);

      const { step, data } = stepData;
      console.log(`📋 Processing step type: ${step}`);

      // Helper function to safely extract message from data
      const getMessageFromData = (data: any): string => {
        if (typeof data === "string") return data;
        if (data?.message) {
          if (typeof data.message === "string") return data.message;
          if (typeof data.message === "object" && data.message?.content) {
            return data.message.content;
          }
          // If message is an object, try to extract meaningful info
          if (typeof data.message === "object") {
            return JSON.stringify(data.message);
          }
        }
        return "";
      };

      // Check for scanner complete based on data content
      if (
        step === "update" &&
        data?.data &&
        typeof data.data === "object" &&
        "address" in data.data &&
        "riskScore" in data.data
      ) {
        console.log("🔍 Scanner complete event detected:", data);
        console.log("📊 Scanner data:", data.data);
        const formattedData = formatScannerData(data.data);
        console.log("✨ Formatted scanner data:", formattedData);

        const stepAssistantMessage: ChatStreamMessage = {
          id: (Date.now() + Math.random()).toString(),
          role: "assistant",
          content: `✅ Portfolio scan complete\n\n${formattedData}`,
          timestamp: new Date(),
          isStreaming: false,
        };
        setMessages((prev) => [...prev, stepAssistantMessage]);
        return;
      }

      // Check for LLM complete based on data content
      if (
        step === "update" &&
        data?.data &&
        typeof data.data === "object" &&
        "userId" in data.data &&
        "query" in data.data &&
        "response" in data.data
      ) {
        console.log("🤖 LLM complete event detected:", data);
        console.log("🧠 LLM data:", data.data);

        // Use the actual response content directly instead of just "analysis complete"
        const responseContent =
          data.data.response || "No response content available";
        console.log("📝 LLM response content:", responseContent);

        const stepAssistantMessage: ChatStreamMessage = {
          id: (Date.now() + Math.random()).toString(),
          role: "assistant",
          content: responseContent,
          timestamp: new Date(),
          isStreaming: false,
        };
        setMessages((prev) => [...prev, stepAssistantMessage]);
        hasHandledResponseRef.current = true; // Mark that we've handled the response
        return;
      }

      // Check for graph data in the response
      if (
        step === "update" &&
        data?.graphs &&
        Array.isArray(data.graphs) &&
        data.graphs.length > 0
      ) {
        console.log("📊 Graph data detected:", data);
        console.log("📈 Graph array:", data.graphs);

        // Get the response message
        const responseMessage =
          data.response || data.message || "Chart generated";

        const stepAssistantMessage: ChatStreamMessage = {
          id: (Date.now() + Math.random()).toString(),
          role: "assistant",
          content: responseMessage,
          timestamp: new Date(),
          isStreaming: false,
          graphs: data.graphs, // Store graph data for rendering
        };
        setMessages((prev) => [...prev, stepAssistantMessage]);
        return;
      }

      // Skip certain steps that shouldn't be displayed as separate messages
      if (step === "summary") {
        return;
      }

      // Special handling for assistant_message - this should be the final response
      if (step === "assistant_message") {
        console.log("🤖 assistant_message step data:", data);
        console.log("🔍 Assistant message data keys:", Object.keys(data || {}));
        
        const assistantMsg = getMessageFromData(data);
        
        // Try to get graphs from various possible fields
        let graphs = data?.responseGraphs || 
                    data?.data?.responseGraphs || 
                    data?.data?.graphs || 
                    data?.graphs || 
                    [];
        
        console.log("📊 Assistant message content:", assistantMsg);
        console.log("📈 Assistant message graphs:", graphs);
        
        if (assistantMsg) {
          // Create a new message for the final assistant response with graphs
          const finalAssistantMessage: ChatStreamMessage = {
            id: (Date.now() + Math.random()).toString(),
            role: "assistant",
            content: assistantMsg,
            timestamp: new Date(),
            isStreaming: false,
            graphs: Array.isArray(graphs) && graphs.length > 0 ? graphs : undefined,
          };
          setMessages((prev) => [...prev, finalAssistantMessage]);
        }
        return;
      }

      // Skip user_message as it's already handled when the user sends it
      if (step === "user_message") {
        return;
      }

      // Create step message content based on the step type
      let stepMessage = "";
      switch (step) {
        case "start":
          stepMessage = "🚀 Starting analysis...";
          break;
        case "processing":
          stepMessage = data.message || "🤔 Analyzing your request...";
          break;
        case "context":
          const contextMsg = getMessageFromData(data);
          stepMessage = `📋 ${contextMsg || "Understanding context..."}`;
          if (data.contextLength) {
            stepMessage += `\n📚 **Context Length**: ${data.contextLength} messages`;
          }
          break;
        case "intent":
          const intentMsg = getMessageFromData(data);
          stepMessage = `🔄 ${intentMsg || "Analyzing intent..."}`;
          if (data.intent) {
            stepMessage += `\n\n**Intent Details**:\n`;
            stepMessage += `• Type: ${data.intent.type}\n`;
            stepMessage += `• Target User: ${data.intent.userId}\n`;
            stepMessage += `• Token: ${data.intent.token}\n`;
            stepMessage += `• Self Scan: ${
              data.intent.isSelfScan ? "Yes" : "No"
            }`;
          }
          
          // Check for news data in the intent step and display it
          if (data.data) {
            console.log("📊 News data found in intent step:", data.data);
            const formattedData = formatNewsData(data.data);
            console.log("📝 Formatted news data in intent:", formattedData);
            if (formattedData) {
              stepMessage += `\n\n**📰 News Analysis**:\n${formattedData}`;
            }
          } else if (data.marketData) {
            // Handle case where marketData is directly in data
            console.log("📊 Direct marketData found in intent step:", data.marketData);
            const formattedData = formatNewsData(data);
            console.log("📝 Formatted direct news data in intent:", formattedData);
            if (formattedData) {
              stepMessage += `\n\n**📰 News Analysis**:\n${formattedData}`;
            }
          }
          break;
        case "action":
          stepMessage = `⚡ ${getMessageFromData(data) || "Taking action..."}`;
          break;
        case "scanner_start":
          stepMessage = `🔍 ${
            getMessageFromData(data) || "Scanning portfolio..."
          }`;
          if (data.targetAddress) {
            stepMessage += `\n🎯 **Target Address**: ${data.targetAddress}`;
          }
          if (data.agent) {
            stepMessage += `\n🤖 **Agent**: ${data.agent}`;
          }
          break;
        case "scanner_complete":
        case "scan_complete":
          console.log("🔍 scanner_complete step data:", data);
          stepMessage = `✅ ${
            getMessageFromData(data) || "Portfolio scan complete"
          }`;
          if (data.data) {
            console.log("📊 Scanner data found:", data.data);
            const formattedData = formatScannerData(data.data);
            console.log("📝 Formatted scanner data:", formattedData);
            stepMessage += `\n\n${formattedData}`;
          } else {
            console.log("❌ No scanner data found in data.data");
          }
          break;
        case "news_start":
          stepMessage = `📰 ${
            getMessageFromData(data) || "Fetching latest news..."
          }`;
          if (data.agent) {
            stepMessage += `\n🤖 **Agent**: ${data.agent}`;
          }
          break;
        case "news_complete":
          console.log("📰 news_complete step data:", data);
          stepMessage = `✅ ${
            getMessageFromData(data) || "News analysis complete"
          }`;
          
          // Only display news data if it wasn't already shown in the intent step
          // Check if we have news data and if it should be displayed here
          const hasNewsData = data.data || data.marketData;
          if (hasNewsData) {
            console.log("📊 News data found in news_complete:", hasNewsData);
            // For now, we'll show a summary since detailed data is in the intent step
            stepMessage += `\n\n📊 **Analysis Summary**: Market trends, sentiment analysis, and news insights have been processed and are available above.`;
          } else {
            console.log("❌ No news data found in data.data or data.marketData");
          }
          
          if (data.agent) {
            stepMessage += `\n🤖 **Agent**: ${data.agent}`;
          }
          break;
        case "llm_start":
        case "llm_query":
          stepMessage = `🤖 ${
            getMessageFromData(data) || "Generating AI analysis..."
          }`;
          if (data.agent) {
            stepMessage += `\n🤖 **Agent**: ${data.agent}`;
          }
          break;
        case "llm_complete":
          console.log("🤖 llm_complete step data:", data);
          stepMessage = `✅ ${
            getMessageFromData(data) || "AI analysis complete"
          }`;
          if (data.data) {
            console.log("🧠 LLM data found:", data.data);
            const formattedData = formatLLMData(data.data);
            console.log("📝 Formatted LLM data:", formattedData);
            stepMessage += `\n\n${formattedData}`;
          } else {
            console.log("❌ No LLM data found in data.data");
          }
          if (data.agent) {
            stepMessage += `\n🤖 **Agent**: ${data.agent}`;
          }
          break;
        case "graph_start":
          stepMessage = `📊 ${
            getMessageFromData(data) || "Generating portfolio graph..."
          }`;
          break;
        case "graph_complete":
          console.log("📊 graph_complete step data:", data);
          stepMessage = `✅ ${
            getMessageFromData(data) || "Portfolio graph generated"
          }`;

          // Check for graph data in graph_complete step
          if (
            data?.graphs &&
            Array.isArray(data.graphs) &&
            data.graphs.length > 0
          ) {
            console.log("📊 Graph data detected in graph_complete:", data);
            console.log("📈 Graph array:", data.graphs);

            const stepAssistantMessage: ChatStreamMessage = {
              id: (Date.now() + Math.random()).toString(),
              role: "assistant",
              content: stepMessage,
              timestamp: new Date(),
              isStreaming: false,
              graphs: data.graphs, // Store graph data for rendering
            };
            setMessages((prev) => [...prev, stepAssistantMessage]);
            return;
          }
          break;
        case "token_chart_start":
          stepMessage = `📈 ${
            getMessageFromData(data) || "Generating token chart..."
          }`;
          break;
        case "token_chart_complete":
        case "chart_complete":
          console.log("📈 token_chart_complete step data:", data);
          stepMessage = `✅ ${
            getMessageFromData(data) || "Token chart generated"
          }`;

          // Check for graph data in chart completion steps
          if (
            data?.graphs &&
            Array.isArray(data.graphs) &&
            data.graphs.length > 0
          ) {
            console.log("📊 Graph data detected in chart_complete:", data);
            console.log("📈 Graph array:", data.graphs);

            const stepAssistantMessage: ChatStreamMessage = {
              id: (Date.now() + Math.random()).toString(),
              role: "assistant",
              content: stepMessage,
              timestamp: new Date(),
              isStreaming: false,
              graphs: data.graphs, // Store graph data for rendering
            };
            setMessages((prev) => [...prev, stepAssistantMessage]);
            return;
          }
          break;
        case "complete":
          console.log("🎯 complete step data:", data);
          console.log("🔍 Complete step data keys:", Object.keys(data || {}));
          console.log("🔍 Complete step data.data:", data?.data);
          console.log("🔍 Complete step data.message:", data?.message);
          console.log("🔍 Complete step data.assistantResponse:", data?.assistantResponse);
          console.log("🔍 Complete step data.responseGraphs:", data?.responseGraphs);
          
          const completeMsg = getMessageFromData(data);
          
          // Try to get the final response from various possible fields
          let finalResponse = data?.assistantResponse || 
                             data?.data?.assistantResponse || 
                             data?.data?.response || 
                             data?.response || 
                             completeMsg || 
                             "Analysis complete";
          
          // Try to get graphs from various possible fields
          let graphs = data?.responseGraphs || 
                      data?.data?.responseGraphs || 
                      data?.data?.graphs || 
                      data?.graphs || 
                      [];

          console.log("📊 Final response to display:", finalResponse);
          console.log("📈 Graphs to display:", graphs);

          // Always create a comprehensive final message for the complete step
          const completeAssistantMessage: ChatStreamMessage = {
            id: (Date.now() + Math.random()).toString(),
            role: "assistant",
            content: finalResponse,
            timestamp: new Date(),
            isStreaming: false,
            graphs: Array.isArray(graphs) && graphs.length > 0 ? graphs : undefined,
          };
          setMessages((prev) => [...prev, completeAssistantMessage]);
          return;
        case "update":
          // Handle generic update events
          const updateMsg = getMessageFromData(data);
          stepMessage = `🔄 ${updateMsg || "Processing update..."}`;
          break;
        default:
          const defaultMsg = getMessageFromData(data);
          stepMessage = `🔄 ${defaultMsg || `Processing: ${step}`}`;
      }

      // Create a new assistant message for each step instead of accumulating
      if (stepMessage) {
        const stepAssistantMessage: ChatStreamMessage = {
          id: (Date.now() + Math.random()).toString(),
          role: "assistant",
          content: stepMessage,
          timestamp: new Date(),
          isStreaming: false,
          // Include graph data for graph-related steps
          ...((step === "graph_complete" ||
            step === "token_chart_complete" ||
            step === "chart_complete") &&
          data?.data
            ? { graphs: [data.data] }
            : {}),
        };
        setMessages((prev) => [...prev, stepAssistantMessage]);
      }
    },
    []
  );

  const handleStreamError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsStreaming(false);

    // Close EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const finishStreaming = useCallback(
    (messageId: string, finalContent?: string, graphs?: any[]) => {
      setIsStreaming(false);

      // Close EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // If we've already handled the response with individual messages, don't overwrite
      if (hasHandledResponseRef.current) {
        return;
      }

      // Combine accumulated streaming content with final content
      let combinedContent = currentStreamingMessageRef.current;

      if (finalContent) {
        // Add a separator and append the final content
        combinedContent += (combinedContent ? "\n\n" : "") + finalContent;
      }

      // Fallback if no content at all
      if (!combinedContent) {
        combinedContent = "Analysis complete";
      }

      // Update the message with combined content
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: combinedContent,
                isStreaming: false,
                graphs: graphs || undefined,
              }
            : msg
        )
      );

      // Reset streaming content
      currentStreamingMessageRef.current = "";
    },
    []
  );

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages,
    isConnected: isConnected,
    hederaAccountId: address || null, // Return EVM address for display purposes
  };
}
