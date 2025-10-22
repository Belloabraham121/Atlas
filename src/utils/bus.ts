import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

export type XNewsAlertPayload = {
  userId: string;
  token: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  priceUSD?: number;
  headlines?: Array<{ title: string; source?: string; url: string; publishedAt?: string }>;
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
  tokens: Record<string, {
    wallet_delta: number;
    x_volume_spike: string;
    risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
    top_tweets?: string[];
  }>;
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

  sendMessage(message: Omit<A2AMessage, 'id' | 'timestamp'>): void {
    const fullMessage: A2AMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    };

    this.messageHistory.push(fullMessage);
    
    // Log A2A communication
    console.log(`📡 A2A: ${fullMessage.from} → ${fullMessage.to} [${fullMessage.type}]`);
    
    // Emit to specific agent
    this.emit(`message:${fullMessage.to}`, fullMessage);
    
    // Also emit general message event for monitoring
    this.emit('a2a_message', fullMessage);
  }

  waitForResponses(agentName: string, expectedTypes: string[], timeoutMs: number = 3000): Promise<A2AMessage[]> {
    return new Promise((resolve, reject) => {
      const responses: A2AMessage[] = [];
      const expectedCount = expectedTypes.length;
      
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for responses: ${expectedTypes.join(', ')}`));
      }, timeoutMs);

      const messageHandler = (message: A2AMessage) => {
        if (message.to === agentName && expectedTypes.includes(message.type)) {
          responses.push(message);
          if (responses.length >= expectedCount) {
            clearTimeout(timeout);
            this.off(`message:${agentName}`, messageHandler);
            resolve(responses);
          }
        }
      };

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
