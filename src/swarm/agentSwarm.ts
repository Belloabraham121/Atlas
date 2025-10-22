import { chatAgent } from '../agents/chatAgent.js';
import { walletAgent } from '../agents/walletAgent.js';
import { xTrendAgent } from '../agents/newsAgent.js';
import { portfolioAgent } from '../agents/portfolioAgent.js';
import { graphAgent } from '../agents/graphAgent.js';
import { hederaLLMAgent } from '../agents/hederaLLMAgent.js';
import { scannerAgent } from '../agents/scannerAgent.js';
import { bus } from '../utils/bus.js';

export class AgentSwarm {
  private agents: any[] = [];
  private isInitialized = false;

  constructor() {
    console.log('🚀 Initializing Agent Swarm...');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ Agent Swarm already initialized');
      return;
    }

    try {
      console.log('📡 Starting A2A Message Bus...');
      
      // Initialize all agents (they auto-register with the bus)
      console.log('🤖 Initializing Chat Agent...');
      this.agents.push(chatAgent);

      console.log('💰 Initializing Wallet Agent...');
      this.agents.push(walletAgent);

      console.log('📈 Initializing XTrend Agent...');
      this.agents.push(xTrendAgent);

      console.log('📊 Initializing Portfolio Agent...');
      this.agents.push(portfolioAgent);

      console.log('📉 Initializing Graph Agent...');
      this.agents.push(graphAgent);

      console.log('🤖 Initializing LLM Agent...');
      await hederaLLMAgent.initialize();
      this.agents.push(hederaLLMAgent);

      console.log('🔍 Initializing Scanner Agent...');
      this.agents.push(scannerAgent);

      // Wait a moment for all agents to register
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all agents are registered
      const registeredAgents = bus.getRegisteredAgents();
      console.log('✅ Registered agents:', registeredAgents);

      this.isInitialized = true;
      console.log('🎉 Agent Swarm initialized successfully!');
      console.log('📋 Available agents:');
      console.log('  • chat@portfolio.guard - Orchestrates user commands');
      console.log('  • wallet@portfolio.guard - Handles balance queries');
      console.log('  • xtrend@portfolio.guard - Analyzes X sentiment & trends');
      console.log('  • portfolio@portfolio.guard - Calculates risk scores');
      console.log('  • graph@portfolio.guard - Generates ChartJS configs');
      console.log('  • llm@portfolio.guard - Processes natural language with AI');
      console.log('  • scanner@portfolio.guard - Performs comprehensive address analysis');

    } catch (error) {
      console.error('❌ Failed to initialize Agent Swarm:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      console.log('⚠️ Agent Swarm not initialized');
      return;
    }

    try {
      console.log('🛑 Shutting down Agent Swarm...');

      // Destroy all agents
      for (const agent of this.agents) {
        if (agent && typeof agent.destroy === 'function') {
          agent.destroy();
        }
      }

      this.agents = [];
      this.isInitialized = false;

      console.log('✅ Agent Swarm shutdown complete');

    } catch (error) {
      console.error('❌ Error during Agent Swarm shutdown:', error);
      throw error;
    }
  }

  getStatus(): {
    initialized: boolean;
    agentCount: number;
    registeredAgents: string[];
  } {
    return {
      initialized: this.isInitialized,
      agentCount: this.agents.length,
      registeredAgents: bus.getRegisteredAgents()
    };
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    agents: { [key: string]: 'online' | 'offline' };
    busStatus: 'active' | 'inactive';
  }> {
    const registeredAgents = bus.getRegisteredAgents();
    const expectedAgents = [
      'chat@portfolio.guard',
      'wallet@portfolio.guard', 
      'xtrend@portfolio.guard',
      'portfolio@portfolio.guard',
      'graph@portfolio.guard',
      'llm@portfolio.guard',
      'scanner@portfolio.guard'
    ];

    const agentStatus: { [key: string]: 'online' | 'offline' } = {};
    let healthyCount = 0;

    for (const agent of expectedAgents) {
      const isOnline = registeredAgents.includes(agent);
      agentStatus[agent] = isOnline ? 'online' : 'offline';
      if (isOnline) healthyCount++;
    }

    const isHealthy = healthyCount === expectedAgents.length && this.isInitialized;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      agents: agentStatus,
      busStatus: this.isInitialized ? 'active' : 'inactive'
    };
  }
}

export const agentSwarm = new AgentSwarm();