import { Client } from '@hashgraph/sdk';

const NETWORK: string = process.env.HEDERA_NETWORK || 'testnet';
const client: Client = NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

if (process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY) {
  try {
    client.setOperator(process.env.HEDERA_OPERATOR_ID, process.env.HEDERA_OPERATOR_KEY);
  } catch (e: any) {
    console.warn('Hedera operator not set:', e?.message || e);
  }
}

export { client };
