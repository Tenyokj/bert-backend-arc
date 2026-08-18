import type { VercelRequest, VercelResponse } from "@vercel/node";

import { assertMethod, handlePreflight, sendJson } from "../lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (!assertMethod(req, res, "GET")) return;

  sendJson(res, 200, {
    ok: true,
    service: "bert-backend",
  });
}
