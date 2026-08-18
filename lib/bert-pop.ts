import { keccak256, stringToBytes, createPublicClient, createWalletClient, custom, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

import { env } from "./env.js";
import type { WorldVerificationRecord } from "./world.js";

const verifierAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "latestNonce",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const publicClient = createPublicClient({
  transport: http(env.rpcUrl),
});

const signerAccount = privateKeyToAccount(env.popSignerPrivateKey);
const walletClient = createWalletClient({
  account: signerAccount,
  transport: custom({
    async request() {
      throw new Error("No RPC requests should be sent through the signer client.");
    },
  }),
});

function normalizeProviderId(value: string): Hex {
  if (/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return value as Hex;
  }
  return keccak256(stringToBytes(value));
}

export async function issueVerificationPayload(
  walletAddress: Address,
  verifierAddress: Address,
  verification: WorldVerificationRecord
) {
  const latestNonce = (await publicClient.readContract({
    address: verifierAddress,
    abi: verifierAbi,
    functionName: "latestNonce",
    args: [walletAddress],
  })) as bigint;

  const nextNonce = latestNonce + 1n;
  const verifiedUntil = BigInt(Math.floor(Date.now() / 1000) + env.popVerificationWindowSeconds);
  const provider = normalizeProviderId(env.popProviderId);
  const credentialHash = keccak256(
    stringToBytes(
      JSON.stringify({
        action: verification.action,
        nullifier: verification.nullifier,
        signalHash: verification.signalHash,
        issuerSchemaId: verification.issuerSchemaId,
        expiresAtMin: verification.expiresAtMin,
      })
    )
  );

  const signature = await walletClient.signTypedData({
    account: signerAccount,
    domain: {
      name: "BERT PoP Verifier",
      version: "1",
      chainId: env.chainId,
      verifyingContract: verifierAddress,
    },
    primaryType: "Verification",
    types: {
      Verification: [
        { name: "user", type: "address" },
        { name: "verifiedUntil", type: "uint64" },
        { name: "nonce", type: "uint256" },
        { name: "provider", type: "bytes32" },
        { name: "credentialHash", type: "bytes32" },
      ],
    },
    message: {
      user: walletAddress,
      verifiedUntil,
      nonce: nextNonce,
      provider,
      credentialHash,
    },
  });

  return {
    verifierAddress,
    verifiedUntil: Number(verifiedUntil),
    nonce: nextNonce.toString(),
    provider,
    credentialHash,
    signature,
    nullifier: verification.nullifier,
  };
}
