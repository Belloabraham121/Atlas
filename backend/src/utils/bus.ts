import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

export type XNewsAlertPayload = {
  userId: string;
  token: string;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  priceUSD?: number;
  headlines?: Array<{
    title: string;
    source?: string;
    url: string;
    publishedAt?: string;
  }>;
  timestamp: string;
  error?: string;
};

// A2A Message Types
export interface A2AMessage {
  id: string;
  type: string;
  from: string;
  to: string;
  payload: any;
  timestamp: string;
}

export interface ScanRequestPayload {
  userId: string;
  token: string;
}

export interface BalanceUpdatePayload {
  userId: string;
  token: string;
  balance: number;
  delta?: number;
  timestamp: string;
}

export interface RiskSummaryPayload {
  userId: string;
  tokens: Record<
    string,
    {
      wallet_delta: number;
      x_volume_spike: string;
      risk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE";
      top_tweets?: string[];
    }
  >;
  total_value: number;
  change_24h: number;
  onchain_proof?: string;
}

export interface GraphRequestPayload {
  userId: string;
  timeframe?: string;
}

export interface GraphReadyPayload {
  chart_id: string;
  config: any; // ChartJS configuration
}

export class A2ABus extends EventEmitter {
  private agents: Map<string, boolean> = new Map();
  private messageHistory: A2AMessage[] = [];

  registerAgent(agentName: string): void {
    this.agents.set(agentName, true);
    console.log(`🤖 Agent registered: ${agentName}`);
  }

  unregisterAgent(agentName: string): void {
    this.agents.delete(agentName);
    console.log(`🤖 Agent unregistered: ${agentName}`);
  }

  sendMessage(message: Omit<A2AMessage, "id" | "timestamp">): void {
    const fullMessage: A2AMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    this.messageHistory.push(fullMessage);

    // Log A2A communication
    console.log(
      `📡 A2A: ${fullMessage.from} → ${fullMessage.to} [${fullMessage.type}]`
    );

    // Emit to specific agent
    this.emit(`message:${fullMessage.to}`, fullMessage);

    // Also emit general message event for monitoring
    this.emit("a2a_message", fullMessage);
  }

  async waitForResponses(
    agentName: string,
    expectedTypes: string[],
    timeoutMs: number = 30000
  ): Promise<A2AMessage[]> {
    console.log(`🔄 waitForResponses: Starting wait for ${expectedTypes.join(', ')} on ${agentName} with ${timeoutMs}ms timeout`);
    
    return new Promise((resolve, reject) => {
      const responses: A2AMessage[] = [];
      const receivedTypes = new Set<string>();
      
      const messageHandler = (message: A2AMessage) => {
        console.log(`📨 waitForResponses: Received message type ${message.type} from ${message.from} to ${message.to}`);
        console.log(`📨 waitForResponses: Message payload:`, JSON.stringify(message.payload, null, 2));
        
        if (expectedTypes.includes(message.type)) {
          console.log(`✅ waitForResponses: Message type ${message.type} matches expected types`);
          responses.push(message);
          receivedTypes.add(message.type);
          
          // Check if we've received all expected types
          if (expectedTypes.every(type => receivedTypes.has(type))) {
            console.log(`🎯 waitForResponses: All expected types received, resolving`);
            this.off(`message:${agentName}`, messageHandler);
            clearTimeout(timeoutHandle);
            resolve(responses);
          }
        } else {
          console.log(`❌ waitForResponses: Message type ${message.type} not in expected types [${expectedTypes.join(', ')}]`);
        }
      };

      const timeoutHandle = setTimeout(() => {
        console.log(`⏰ waitForResponses: Timeout after ${timeoutMs}ms waiting for ${expectedTypes.join(', ')}`);
        console.log(`📊 waitForResponses: Received types so far: [${Array.from(receivedTypes).join(', ')}]`);
        console.log(`📊 waitForResponses: Total responses received: ${responses.length}`);
        this.off(`message:${agentName}`, messageHandler);
        reject(new Error(`Timeout waiting for responses: ${expectedTypes.join(', ')}`));
      }, timeoutMs);

      console.log(`👂 waitForResponses: Setting up listener on message:${agentName}`);
      this.on(`message:${agentName}`, messageHandler);
    });
  }

  getMessageHistory(): A2AMessage[] {
    return [...this.messageHistory];
  }

  getRegisteredAgents(): string[] {
    return Array.from(this.agents.keys());
  }
}

export const bus = new A2ABus();
