import type { Address, Hex } from "viem";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function parseAddress(name: string): Address {
  const value = required(name);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a valid EVM address`);
  }
  return value as Address;
}

function parseHex32(name: string): Hex {
  const value = required(name);
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${name} must be a 32-byte hex value`);
  }
  return value as Hex;
}

function parseInteger(name: string, fallback?: number): number {
  const raw = optional(name);
  if (!raw && fallback !== undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function parseEnvironment() {
  const env = optional("WORLD_ENVIRONMENT") || "production";
  if (env !== "production" && env !== "staging" && env !== "sandbox") {
    throw new Error("WORLD_ENVIRONMENT must be production, staging, or sandbox");
  }
  return env;
}

export const env = {
  rpcUrl: required("RPC_URL"),
  chainId: parseInteger("BERT_CHAIN_ID"),
  popVerifierAddress: parseAddress("POP_VERIFIER_ADDRESS"),
  popSignerPrivateKey: parseHex32("POP_SIGNER_PRIVATE_KEY"),
  popVerificationWindowSeconds: parseInteger("POP_VERIFICATION_WINDOW_SECONDS", 14 * 24 * 60 * 60),
  popProviderId: optional("POP_PROVIDER_ID") || "WORLD_ID",
  worldAppId: required("WORLD_APP_ID"),
  worldRpId: required("WORLD_RP_ID"),
  worldRpSigningKey: parseHex32("WORLD_RP_SIGNING_KEY"),
  worldAction: optional("WORLD_ACTION") || "bert-vote-human-verification",
  worldEnvironment: parseEnvironment(),
  corsOrigin: optional("CORS_ORIGIN") || "*",
  nullifierStoreMode: optional("NULLIFIER_STORE_MODE") || "memory",
  redisRestUrl: optional("NULLIFIER_STORE_REDIS_REST_URL"),
  redisRestToken: optional("NULLIFIER_STORE_REDIS_REST_TOKEN"),
} as const;
