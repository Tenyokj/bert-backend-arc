import type { VercelRequest, VercelResponse } from "@vercel/node";

import { env } from "./env.js";

export function applyCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", env.corsOrigin);
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

export function handlePreflight(req: VercelRequest, res: VercelResponse) {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function assertMethod(req: VercelRequest, res: VercelResponse, method: string) {
  if (req.method !== method) {
    applyCors(res);
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }
  return true;
}

export function sendJson(res: VercelResponse, status: number, body: unknown) {
  applyCors(res);
  res.status(status).json(body);
}

export function parseJsonBody<T>(req: VercelRequest): T {
  if (typeof req.body === "string") {
    return JSON.parse(req.body) as T;
  }
  return req.body as T;
}
