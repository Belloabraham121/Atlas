import type { AccountHoldings } from "../utils/hedera.js";
import type { XNewsAlertPayload } from "../utils/bus.js";

export interface UserProfile {
  userId: string;
  accountId?: string;
  tokens: string[];
  lastUpdated?: number;
  holdings?: AccountHoldings;
  lastXNewsAlert?: XNewsAlertPayload;
  risk?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const USERS = new Map<string, UserProfile>();

export function getUser(userId: string): UserProfile | undefined {
  return USERS.get(userId);
}

export function updateUser(userId: string, profile: UserProfile): void {
  profile.lastUpdated = Date.now();
  USERS.set(userId, profile);
}
