import express from "express";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./routers/trpc";

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => res.status(200).send("ok"));

// tRPC endpoint
app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Error handler so 500s show details in JSON
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    detail: String(err?.message ?? err),
  });
});

const PORT = Number(process.env.PORT) || 3001;

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(PORT, () =>
    console.log(`API running on http://localhost:${PORT}`)
  );

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `⚠️  Port ${PORT} is already in use. Did you start another server?`
      );
      process.exit(1);
    } else {
      throw err;
    }
  });
}

export default app;
