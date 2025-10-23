import "dotenv/config";
import express, { Request, Response } from "express";
import usersRouter from "./routes/users.js";
import { agentSwarm } from "./swarm/agentSwarm.js";

const app = express();
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.send("PortfolioGuard Backend (Monolith) running");
});

// Add agent swarm status endpoint
app.get("/swarm/status", (_req: Request, res: Response) => {
  const status = agentSwarm.getStatus();
  res.json(status);
});

// Add agent swarm health check endpoint
app.get("/swarm/health", async (_req: Request, res: Response) => {
  try {
    const health = await agentSwarm.healthCheck();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error?.message || String(error),
    });
  }
});

app.use("/api", usersRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Initialize agent swarm and start server
async function startServer() {
  try {
    console.log("🚀 Starting PortfolioGuard Backend...");

    // Initialize the agent swarm
    await agentSwarm.initialize();

    // Start the Express server
    app.listen(PORT, () => {
      console.log(
        `✅ PortfolioGuard Backend running: http://localhost:${PORT}`
      );
      console.log(
        `📊 Agent Swarm Status: http://localhost:${PORT}/swarm/status`
      );
      console.log(
        `🏥 Agent Swarm Health: http://localhost:${PORT}/swarm/health`
      );
      console.log(
        `💬 Chat API: POST http://localhost:${PORT}/api/:userId/chat`
      );
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  try {
    await agentSwarm.shutdown();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  try {
    await agentSwarm.shutdown();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
});

startServer();
