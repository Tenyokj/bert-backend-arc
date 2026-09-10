import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Address } from "viem";

import { issueVerificationPayload } from "../../lib/bert-pop.js";
import { env } from "../../lib/env.js";
import { assertMethod, handlePreflight, parseJsonBody, sendJson } from "../../lib/http.js";
import type { WorldVerificationRecord } from "../../lib/world.js";

// Arc Testnet's canonical chain ID. Never make demo credentials available on mainnet.
const ARC_TESTNET_CHAIN_ID = 5_042_002;
const DEMO_PROVIDER_ID = "BERT_TESTNET_DEMO";
const DEMO_ACTION = "bert-testnet-demo-verification";

type DemoProofRequest = {
  walletAddress: string;
  chainId: number;
  verifierAddress?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (!assertMethod(req, res, "POST")) return;

  // This is defense in depth: deployment configuration alone can never enable
  // demo verification for a non-Arc-testnet BERT deployment.
  if (!env.popDemoEnabled || env.chainId !== ARC_TESTNET_CHAIN_ID) {
    sendJson(res, 403, { error: "Demo verification is unavailable for this deployment." });
    return;
  }

  try {
    const body = parseJsonBody<DemoProofRequest>(req);
    const verifierAddress = (body.verifierAddress || env.popVerifierAddress) as Address;

    if (!/^0x[a-fA-F0-9]{40}$/.test(body.walletAddress)) {
      sendJson(res, 400, { error: "walletAddress must be a valid EVM address" });
      return;
    }
    if (Number(body.chainId) !== ARC_TESTNET_CHAIN_ID) {
      sendJson(res, 400, { error: `Demo verification requires Arc Testnet (${ARC_TESTNET_CHAIN_ID}).` });
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(verifierAddress)) {
      sendJson(res, 400, { error: "verifierAddress must be a valid EVM address" });
      return;
    }
    if (verifierAddress.toLowerCase() !== env.popVerifierAddress.toLowerCase()) {
      sendJson(res, 400, { error: "The requested verifierAddress does not match the configured backend verifier." });
      return;
    }

    const walletAddress = body.walletAddress as Address;
    const verification: WorldVerificationRecord = {
      protocolVersion: "4.0",
      // A deterministic per-wallet test credential supports renewal while making
      // it explicit that this proves nothing about a real human.
      nullifier: `demo:${ARC_TESTNET_CHAIN_ID}:${walletAddress.toLowerCase()}`,
      action: DEMO_ACTION,
      signalHash: walletAddress.toLowerCase(),
      expiresAtMin: null,
      issuerSchemaId: null,
    };

    const payload = await issueVerificationPayload(walletAddress, verifierAddress, verification, {
      providerId: DEMO_PROVIDER_ID,
    });
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 500, {
      error: "Failed to issue BERT testnet demo verification payload",
      details: error instanceof Error ? error.message : "Unknown backend error",
    });
  }
}
