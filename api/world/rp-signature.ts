import type { VercelRequest, VercelResponse } from "@vercel/node";

import { env } from "../../lib/env.js";
import { assertMethod, handlePreflight, parseJsonBody, sendJson } from "../../lib/http.js";
import { createRpContext } from "../../lib/world.js";

type RpSignatureRequest = {
  action?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (!assertMethod(req, res, "POST")) return;

  try {
    const body = parseJsonBody<RpSignatureRequest>(req);
    const action = body.action || env.worldAction;
    if (action !== env.worldAction) {
      sendJson(res, 400, { error: "World ID action does not match the configured BERT action." });
      return;
    }
    const payload = createRpContext(action);
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Failed to create RP signature",
    });
  }
}
