import { AccountId, AccountBalanceQuery, TokenInfoQuery } from '@hashgraph/sdk';
import { client } from '../config/hedera.js';
export function resolveAccountId(address) {
    if (typeof address !== 'string')
        throw new Error('Invalid address');
    if (address.includes('.')) {
        return AccountId.fromString(address);
    }
    if (address.startsWith('0x')) {
        return AccountId.fromEvmAddress(0, 0, address);
    }
    throw new Error('Unsupported address format');
}
export async function detectTokensForAccount(accountId) {
    const balance = await new AccountBalanceQuery().setAccountId(accountId).execute(client);
    const tokens = [];
    if (!balance.tokens)
        return tokens;
    for (const [tokenId, tokenBalance] of balance.tokens) {
        if (tokenBalance && tokenBalance.toString() !== '0')
            tokens.push(tokenId.toString());
    }
    return tokens;
}
export async function getAccountHoldings(accountId) {
    const bal = await new AccountBalanceQuery().setAccountId(accountId).execute(client);
    const hbarTinybars = bal.hbars ? bal.hbars.toTinybars().toString() : '0';
    const hbar = bal.hbars ? bal.hbars.toString() : '0 ℏ';
    const tokens = [];
    if (bal.tokens) {
        const pairs = [];
        for (const [tokenId, tokenBalance] of bal.tokens) {
            pairs.push([tokenId, tokenBalance]);
        }
        if (pairs.length) {
            const enriched = await Promise.all(pairs.map(async ([tokenId, tokenBalance]) => {
                if (!tokenBalance || tokenBalance.toString() === '0')
                    return null;
                try {
                    const info = await new TokenInfoQuery().setTokenId(tokenId).execute(client);
                    return {
                        tokenId: tokenId.toString(),
                        balance: tokenBalance.toString(),
                        decimals: info.decimals,
                        name: info.name,
                        symbol: info.symbol,
                    };
                }
                catch {
                    return {
                        tokenId: tokenId.toString(),
                        balance: tokenBalance.toString(),
                    };
                }
            }));
            for (const t of enriched) {
                if (t)
                    tokens.push(t);
            }
        }
    }
    return { accountId: accountId.toString(), hbarTinybars, hbar, tokens };
}
