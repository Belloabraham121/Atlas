import {
  bus,
  A2AMessage,
  GraphRequestPayload,
  GraphReadyPayload,
} from "../utils/bus.js";
import { getUser } from "../store/users.js";

export class GraphAgent {
  private agentName = "graph@portfolio.guard";

  constructor() {
    bus.registerAgent(this.agentName);
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    bus.on(`message:${this.agentName}`, (message: A2AMessage) => {
      console.log(
        `📈 Graph Agent received: ${message.type} from ${message.from}`
      );
      this.handleMessage(message);
    });
  }

  private async handleMessage(message: A2AMessage): Promise<void> {
    switch (message.type) {
      case "generate_graph":
        await this.handleGenerateGraph(message);
        break;
      default:
        console.log(`❓ Graph Agent: Unknown message type: ${message.type}`);
    }
  }

  private async handleGenerateGraph(message: A2AMessage): Promise<void> {
    try {
      const payload = message.payload as GraphRequestPayload;
      console.log(
        `📈 Generating graph for user: ${payload.userId}, timeframe: ${
          payload.timeframe || "24h"
        }`
      );

      // Get user data
      const user = getUser(payload.userId);
      if (!user) {
        console.log(`❌ User ${payload.userId} not found`);
        return;
      }

      // Generate mock historical data for demo
      const chartConfig = this.generateChartConfig(
        payload.userId,
        payload.timeframe || "24h"
      );

      // Send graph ready message
      bus.sendMessage({
        type: "graph_ready",
        from: this.agentName,
        to: message.from,
        payload: {
          chart_id: `portfolio_trends_${payload.timeframe || "24h"}`,
          config: chartConfig,
        } as GraphReadyPayload,
      });

      console.log(`📈 Graph generated and sent for ${payload.userId}`);
    } catch (error) {
      console.error("Error generating graph:", error);
    }
  }

  private generateChartConfig(userId: string, timeframe: string): any {
    // Generate mock time labels based on timeframe
    const labels = this.generateTimeLabels(timeframe);

    // Generate mock portfolio value data
    const portfolioData = this.generatePortfolioData(labels.length);

    // Generate mock sentiment data
    const sentimentData = this.generateSentimentData(labels.length);

    return {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Portfolio Value ($)",
            data: portfolioData,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            yAxisID: "y",
          },
          {
            label: "X Sentiment Score",
            data: sentimentData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: `Portfolio Trends - ${userId} (${timeframe})`,
          },
          legend: {
            display: true,
            position: "top",
          },
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: "Time",
            },
          },
          y: {
            type: "linear",
            display: true,
            position: "left",
            title: {
              display: true,
              text: "Portfolio Value ($)",
            },
            grid: {
              drawOnChartArea: false,
            },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            title: {
              display: true,
              text: "Sentiment Score",
            },
            min: -1,
            max: 1,
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    };
  }

  private generateTimeLabels(timeframe: string): string[] {
    const now = new Date();
    const labels: string[] = [];

    if (timeframe === "24h") {
      // Generate hourly labels for last 24 hours
      for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        labels.push(
          time.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      }
    } else if (timeframe === "7d") {
      // Generate daily labels for last 7 days
      for (let i = 6; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        labels.push(
          time.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        );
      }
    } else {
      // Default to 15-minute intervals for last 2 hours
      for (let i = 7; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 15 * 60 * 1000);
        labels.push(
          time.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      }
    }

    return labels;
  }

  private generatePortfolioData(length: number): number[] {
    const baseValue = 12000 + Math.random() * 5000; // Base portfolio value between $12k-$17k
    const data: number[] = [];
    let currentValue = baseValue;

    for (let i = 0; i < length; i++) {
      // Add some realistic volatility
      const change = (Math.random() - 0.5) * 500; // Random change up to ±$250
      currentValue += change;

      // Ensure value doesn't go below $5k
      currentValue = Math.max(5000, currentValue);

      data.push(Math.round(currentValue));
    }

    return data;
  }

  private generateSentimentData(length: number): number[] {
    const data: number[] = [];

    for (let i = 0; i < length; i++) {
      // Generate sentiment score between -1 and 1
      const sentiment = (Math.random() - 0.5) * 2;
      data.push(Math.round(sentiment * 100) / 100); // Round to 2 decimal places
    }

    return data;
  }

  destroy(): void {
    bus.unregisterAgent(this.agentName);
  }
}

export const graphAgent = new GraphAgent();
