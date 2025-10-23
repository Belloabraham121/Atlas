import { AccountId, AccountBalanceQuery, TokenInfoQuery } from '@hashgraph/sdk';
import { client } from '../config/hedera.js';

export function resolveAccountId(address: string): AccountId {
  if (typeof address !== 'string') throw new Error('Invalid address');
  if (address.includes('.')) {
    return AccountId.fromString(address);
  }
  if (address.startsWith('0x')) {
    return AccountId.fromEvmAddress(0, 0, address);
  }
  throw new Error('Unsupported address format');
}

export async function detectTokensForAccount(accountId: AccountId): Promise<string[]> {
  const balance = await new AccountBalanceQuery().setAccountId(accountId).execute(client);
  const tokens: string[] = [];
  if (!balance.tokens) return tokens;
  for (const [tokenId, tokenBalance] of balance.tokens) {
    if (tokenBalance && tokenBalance.toString() !== '0') tokens.push(tokenId.toString());
  }
  return tokens;
}

export interface TokenHolding {
  tokenId: string;
  balance: string;
  decimals?: number;
  name?: string;
  symbol?: string;
}

export interface AccountHoldings {
  accountId: string;
  hbarTinybars: string;
  hbar: string;
  tokens: TokenHolding[];
}

export async function getAccountHoldings(accountId: AccountId): Promise<AccountHoldings> {
  const bal = await new AccountBalanceQuery().setAccountId(accountId).execute(client);
  const hbarTinybars = bal.hbars ? bal.hbars.toTinybars().toString() : '0';
  const hbar = bal.hbars ? bal.hbars.toString() : '0 ℏ';
  const tokens: TokenHolding[] = [];
  if (bal.tokens) {
    const pairs: Array<[any, any]> = [];
    for (const [tokenId, tokenBalance] of bal.tokens) {
      pairs.push([tokenId, tokenBalance]);
    }
    if (pairs.length) {
      const enriched: Array<TokenHolding | null> = await Promise.all(
        pairs.map(async ([tokenId, tokenBalance]) => {
          if (!tokenBalance || tokenBalance.toString() === '0') return null;
          try {
            const info = await new TokenInfoQuery().setTokenId(tokenId).execute(client);
            return {
              tokenId: tokenId.toString(),
              balance: tokenBalance.toString(),
              decimals: info.decimals,
              name: info.name,
              symbol: info.symbol,
            };
          } catch {
            return {
              tokenId: tokenId.toString(),
              balance: tokenBalance.toString(),
            };
          }
        })
      );
      for (const t of enriched) {
        if (t) tokens.push(t);
      }
    }
  }
  return { accountId: accountId.toString(), hbarTinybars, hbar, tokens };
}
