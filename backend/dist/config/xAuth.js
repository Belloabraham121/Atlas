import axios from 'axios';
let cachedXBearer = null;
export async function getXBearer() {
    if (process.env.X_BEARER_TOKEN)
        return process.env.X_BEARER_TOKEN;
    if (cachedXBearer)
        return cachedXBearer;
    const key = process.env.X_API_KEY;
    const secret = process.env.X_API_SECRET;
    if (!key || !secret)
        return null;
    try {
        const basic = Buffer.from(`${key}:${secret}`).toString('base64');
        const resp = await axios.post('https://api.x.com/oauth2/token', 'grant_type=client_credentials', {
            headers: {
                Authorization: `Basic ${basic}`,
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            }
        });
        const token = resp.data?.access_token;
        if (token)
            cachedXBearer = token;
        return token || null;
    }
    catch (e) {
        console.warn('Failed to obtain X bearer token:', e?.message || e);
        return null;
    }
}
