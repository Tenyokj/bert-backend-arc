import type { IDKitResult } from "@worldcoin/idkit-core";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { signRequest } from "@worldcoin/idkit-core/signing";

import { env } from "./env.js";

export type WorldVerificationRecord = {
  nullifier: string;
  action: string;
  signalHash: string;
  expiresAtMin: number;
  issuerSchemaId: number;
};

export function createRpContext(action: string) {
  const signature = signRequest({
    signingKeyHex: env.worldRpSigningKey,
    action,
  });

  return {
    rp_id: env.worldRpId,
    nonce: signature.nonce,
    created_at: signature.createdAt,
    expires_at: signature.expiresAt,
    signature: signature.sig,
    action,
  };
}

export async function verifyWorldProof(result: IDKitResult, walletAddress: string, expectedAction: string) {
  if (result.protocol_version !== "4.0" || !("action" in result)) {
    throw new Error("Only World ID 4.0 uniqueness proofs are supported.");
  }

  if (result.action !== expectedAction) {
    throw new Error("World ID action mismatch.");
  }

  const response = await fetch(`https://developer.world.org/api/v4/verify/${env.worldRpId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(result),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`World proof verification failed: ${text}`);
  }

  const firstCredential = result.responses[0];
  if (!firstCredential) {
    throw new Error("World proof did not include any credentials.");
  }

  const expectedSignalHash = hashSignal(walletAddress.toLowerCase());
  if ((firstCredential.signal_hash || "0x0").toLowerCase() !== expectedSignalHash.toLowerCase()) {
    throw new Error("World proof signal hash does not match the connected wallet.");
  }

  return {
    nullifier: firstCredential.nullifier.toLowerCase(),
    action: result.action,
    signalHash: (firstCredential.signal_hash || "0x0").toLowerCase(),
    expiresAtMin: firstCredential.expires_at_min,
    issuerSchemaId: firstCredential.issuer_schema_id,
  } satisfies WorldVerificationRecord;
}
