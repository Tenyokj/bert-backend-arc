import type { IDKitResult } from "@worldcoin/idkit-core";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Address } from "viem";

import { issueVerificationPayload } from "../../lib/bert-pop.js";
import { env } from "../../lib/env.js";
import { assertMethod, handlePreflight, parseJsonBody, sendJson } from "../../lib/http.js";
import { getNullifierRecord, makeNullifierKey, setNullifierRecord } from "../../lib/store.js";
import { verifyWorldProof } from "../../lib/world.js";

type IssueProofRequest = {
  walletAddress: string;
  chainId: number;
  verifierAddress?: string;
  action?: string;
  proof: IDKitResult;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (!assertMethod(req, res, "POST")) return;

  try {
    const body = parseJsonBody<IssueProofRequest>(req);
    const action = body.action || env.worldAction;
    const verifierAddress = (body.verifierAddress || env.popVerifierAddress) as Address;

    if (!/^0x[a-fA-F0-9]{40}$/.test(body.walletAddress)) {
      sendJson(res, 400, { error: "walletAddress must be a valid EVM address" });
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(verifierAddress)) {
      sendJson(res, 400, { error: "verifierAddress must be a valid EVM address" });
      return;
    }

    if (Number(body.chainId) !== env.chainId) {
      sendJson(res, 400, {
        error: `Invalid chainId. Expected ${env.chainId}, received ${body.chainId}`,
      });
      return;
    }

    if (verifierAddress.toLowerCase() !== env.popVerifierAddress.toLowerCase()) {
      sendJson(res, 400, {
        error: "The requested verifierAddress does not match the configured backend verifier.",
      });
      return;
    }

    const walletAddress = body.walletAddress as Address;
    const verifiedWorldProof = await verifyWorldProof(body.proof, walletAddress, action);
    const nullifierKey = makeNullifierKey(verifiedWorldProof.action, verifiedWorldProof.nullifier);
    const existingRecord = await getNullifierRecord(nullifierKey);

    if (
      existingRecord &&
      existingRecord.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    ) {
      sendJson(res, 409, {
        error: "This human verification credential is already bound to another wallet in BERT.",
      });
      return;
    }

    const payload = await issueVerificationPayload(walletAddress, verifierAddress, verifiedWorldProof);

    const nowIso = new Date().toISOString();
    await setNullifierRecord(nullifierKey, {
      walletAddress,
      firstVerifiedAt: existingRecord?.firstVerifiedAt || nowIso,
      lastIssuedAt: nowIso,
    });

    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 500, {
      error: "Failed to issue BERT PoP verification payload",
      details: error instanceof Error ? error.message : "Unknown backend error",
    });
  }
}
