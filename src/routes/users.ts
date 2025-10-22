import express, { Request, Response } from 'express';
import { monitorUser, refreshTokens, getHoldings } from '../agents/portfolioAgent.js';
import { analyzeToken, sendXNewsAlert } from '../agents/newsAgent.js';
import { fetchPriceUSD } from '../services/price.js';
import { chatAgent } from '../agents/chatAgent.js';

const router = express.Router();

router.get('/_debug', (_req: Request, res: Response) => {
  try {
    const routes = (router as any).stack
      .filter((l: any) => l.route)
      .map((l: any) => ({ path: l.route.path, methods: Object.keys(l.route.methods) }));
    res.json({ ok: true, routes });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post('/:userId/monitor', async (req: Request<{ userId: string }, any, { address?: string }>, res: Response) => {
  try {
    const { address } = req.body || {};
    if (!address) return res.status(400).json({ error: 'Missing address' });
    await monitorUser(req.params.userId, address);
    const profile = await refreshTokens(req.params.userId);
    res.json({ ok: true, profile });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

router.get('/:userId/holdings', async (req: Request<{ userId: string }>, res: Response) => {
  try {
    const holdings = await getHoldings(req.params.userId);
    res.json({ ok: true, holdings });
  } catch (e: any) {
    res.status(404).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post('/:userId/holdings', async (req: Request<{ userId: string }>, res: Response) => {
  try {
    const holdings = await getHoldings(req.params.userId);
    res.json({ ok: true, holdings });
  } catch (e: any) {
    res.status(404).json({ ok: false, error: e?.message || String(e) });
  }
});

router.post('/:userId/chat', async (req: Request<{ userId: string }, any, { message?: string; timeframe?: string }>, res: Response) => {
  try {
    const { message, timeframe } = req.body || {};
    const userId = req.params.userId;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Message is required' 
      });
    }

    console.log(`💬 Chat request from ${userId}: ${message}`);

    // Process the message through the Chat Agent
     const response = await chatAgent.processUserCommand(message.trim(), userId);

    res.json({
      ok: true,
      response: response,
      timestamp: new Date().toISOString(),
      user_id: userId
    });

  } catch (e: any) {
    console.error('Chat endpoint error:', e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || String(e) 
    });
  }
});

// New streaming chat endpoint
router.post('/:userId/chat-stream', async (req: Request<{ userId: string }, any, { message?: string }>, res: Response) => {
  try {
    const { message } = req.body || {};
    const { userId } = req.params;
    
    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    console.log(`💬 Streaming chat request from ${userId}: ${message}`);

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Helper function to send SSE data
    const sendStep = (step: string, data: any) => {
      res.write(`event: ${step}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Process the message through the streaming Chat Agent
      await chatAgent.processUserCommandStreaming(message.trim(), userId, sendStep);
      
      // Send completion event
      sendStep('complete', { message: 'Analysis complete' });
      
    } catch (error: any) {
      console.error('Streaming chat error:', error);
      sendStep('error', { error: error.message || String(error) });
    }

    res.end();

  } catch (e: any) {
    console.error('Chat streaming endpoint error:', e);
    res.status(500).json({ 
      ok: false, 
      error: e?.message || String(e) 
    });
  }
});

router.post('/:userId/start', async (_req: Request, res: Response) => {
  res.json({ ok: true, message: 'Monitoring started' });
});

router.post('/:userId/x-test', async (req: Request<{ userId: string }, any, { token?: string }>, res: Response) => {
  try {
    const { token = 'HBAR' } = req.body || {};
    const { news, x } = await analyzeToken(token);
    const price = await fetchPriceUSD(token);
    res.json({ ok: true, token, sentiment: x.sentiment, price, headlines: news, xError: x.error });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

export default router;
