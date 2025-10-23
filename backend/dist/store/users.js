export const USERS = new Map();
export function getUser(userId) {
    return USERS.get(userId);
}
export function updateUser(userId, profile) {
    profile.lastUpdated = Date.now();
    USERS.set(userId, profile);
}
