import { bus } from '../utils/bus.js';
import { getUser } from '../store/users.js';
import { resolveAccountId, getAccountHoldings } from '../utils/hedera.js';
export class WalletAgent {
    agentName = 'wallet@portfolio.guard';
    constructor() {
        bus.registerAgent(this.agentName);
        this.setupMessageHandlers();
    }
    setupMessageHandlers() {
        bus.on(`message:${this.agentName}`, (message) => {
            console.log(`💰 Wallet Agent received: ${message.type} from ${message.from}`);
            this.handleMessage(message);
        });
    }
    async handleMessage(message) {
        switch (message.type) {
            case 'scan_request':
                await this.handleScanRequest(message);
                break;
            default:
                console.log(`❓ Wallet Agent: Unknown message type: ${message.type}`);
        }
    }
    async handleScanRequest(message) {
        try {
            const payload = message.payload;
            console.log(`💰 Scanning wallet for user: ${payload.userId}, token: ${payload.token}`);
            // Get user profile
            const user = getUser(payload.userId);
            if (!user || !user.accountId) {
                console.log(`❌ User ${payload.userId} not found or no account ID`);
                return;
            }
            // Get current holdings
            const accountId = await resolveAccountId(user.accountId);
            const holdings = await getAccountHoldings(accountId);
            // Calculate deltas (simplified - in real implementation, you'd compare with previous state)
            const balanceUpdates = {};
            // Process HBAR balance
            const hbarBalance = parseFloat(holdings.hbar.replace(' ℏ', '')) || 0;
            // Simulate some delta for demo purposes
            const hbarDelta = Math.floor(Math.random() * 5000) - 2500; // Random delta between -2500 and +2500
            balanceUpdates.HBAR = {
                userId: payload.userId,
                token: 'HBAR',
                balance: hbarBalance,
                delta: hbarDelta,
                timestamp: new Date().toISOString()
            };
            // Process token holdings
            if (holdings.tokens) {
                for (const token of holdings.tokens) {
                    const balance = parseFloat(token.balance) || 0;
                    const delta = Math.floor(Math.random() * 1000) - 500; // Random delta for demo
                    const tokenSymbol = token.symbol || token.tokenId;
                    balanceUpdates[tokenSymbol] = {
                        userId: payload.userId,
                        token: tokenSymbol,
                        balance: balance,
                        delta: delta,
                        timestamp: new Date().toISOString()
                    };
                }
            }
            // Send balance updates to portfolio agent
            for (const [tokenSymbol, balanceUpdate] of Object.entries(balanceUpdates)) {
                bus.sendMessage({
                    type: 'balance_update',
                    from: this.agentName,
                    to: 'portfolio@portfolio.guard',
                    payload: balanceUpdate
                });
            }
            console.log(`💰 Sent ${Object.keys(balanceUpdates).length} balance updates for ${payload.userId}`);
        }
        catch (error) {
            console.error('Error in wallet scan:', error);
        }
    }
    destroy() {
        bus.unregisterAgent(this.agentName);
    }
}
export const walletAgent = new WalletAgent();
