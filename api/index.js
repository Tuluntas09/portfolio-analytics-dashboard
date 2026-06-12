// Vercel Serverless Function — market data proxy.
// Handles all /api/* routes. Route logic lives in server/market-data-server.mjs;
// this file adapts it to Vercel's request/response model.
//
// The handler instance (and its in-memory cache) persists across warm invocations
// within the same Vercel function instance — same behaviour as the local proxy.
// Cold starts begin with an empty cache, identical to restarting the local server.
//
// Environment variable required on Vercel:
//   FINNHUB_API_KEY  — set under Settings → Environment Variables (not VITE_* prefixed)

import { createRequestHandler } from "../server/market-data-server.mjs";

const handler = createRequestHandler();

export default handler;
