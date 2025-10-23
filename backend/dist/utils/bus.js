import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
export class A2ABus extends EventEmitter {
    agents = new Map();
    messageHistory = [];
    registerAgent(agentName) {
        this.agents.set(agentName, true);
        console.log(`🤖 Agent registered: ${agentName}`);
    }
    unregisterAgent(agentName) {
        this.agents.delete(agentName);
        console.log(`🤖 Agent unregistered: ${agentName}`);
    }
    sendMessage(message) {
        const fullMessage = {
            ...message,
            id: uuidv4(),
            timestamp: new Date().toISOString(),
        };
        this.messageHistory.push(fullMessage);
        // Log A2A communication
        console.log(`📡 A2A: ${fullMessage.from} → ${fullMessage.to} [${fullMessage.type}]`);
        // Emit to specific agent
        this.emit(`message:${fullMessage.to}`, fullMessage);
        // Also emit general message event for monitoring
        this.emit("a2a_message", fullMessage);
    }
    waitForResponses(agentName, expectedTypes, timeoutMs = 3000) {
        return new Promise((resolve, reject) => {
            const responses = [];
            const expectedCount = expectedTypes.length;
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout waiting for responses: ${expectedTypes.join(", ")}`));
            }, timeoutMs);
            const messageHandler = (message) => {
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
    getMessageHistory() {
        return [...this.messageHistory];
    }
    getRegisteredAgents() {
        return Array.from(this.agents.keys());
    }
}
export const bus = new A2ABus();
