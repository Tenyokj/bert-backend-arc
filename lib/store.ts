import { env } from "./env.js";

type StoredNullifierRecord = {
  walletAddress: string;
  firstVerifiedAt: string;
  lastIssuedAt: string;
};

const memoryStore = new Map<string, StoredNullifierRecord>();

async function redisGet(key: string) {
  if (!env.redisRestUrl || !env.redisRestToken) {
    throw new Error("Redis REST mode requires NULLIFIER_STORE_REDIS_REST_URL and TOKEN");
  }

  const response = await fetch(`${env.redisRestUrl}/get/${encodeURIComponent(key)}`, {
    headers: {
      Authorization: `Bearer ${env.redisRestToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Redis GET failed with status ${response.status}`);
  }

  const data = (await response.json()) as { result: string | null };
  return data.result ? (JSON.parse(data.result) as StoredNullifierRecord) : null;
}

async function redisSet(key: string, value: StoredNullifierRecord) {
  if (!env.redisRestUrl || !env.redisRestToken) {
    throw new Error("Redis REST mode requires NULLIFIER_STORE_REDIS_REST_URL and TOKEN");
  }

  const response = await fetch(`${env.redisRestUrl}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.redisRestToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(value)),
  });

  if (!response.ok) {
    throw new Error(`Redis SET failed with status ${response.status}`);
  }
}

/**
 * Atomically creates a nullifier binding only when it does not exist yet.
 * A separate GET followed by SET would allow two concurrent serverless
 * invocations to bind the same World credential to different wallets.
 */
async function redisSetIfAbsent(key: string, value: StoredNullifierRecord) {
  if (!env.redisRestUrl || !env.redisRestToken) {
    throw new Error("Redis REST mode requires NULLIFIER_STORE_REDIS_REST_URL and TOKEN");
  }

  const response = await fetch(env.redisRestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.redisRestToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(["SET", key, JSON.stringify(value), "NX"]),
  });

  if (!response.ok) {
    throw new Error(`Redis SET NX failed with status ${response.status}`);
  }

  const data = (await response.json()) as { result: "OK" | null };
  return data.result === "OK";
}

export async function getNullifierRecord(key: string) {
  if (env.nullifierStoreMode === "redis-rest") {
    return redisGet(key);
  }

  return memoryStore.get(key) || null;
}

export async function setNullifierRecord(key: string, value: StoredNullifierRecord) {
  if (env.nullifierStoreMode === "redis-rest") {
    await redisSet(key, value);
    return;
  }

  memoryStore.set(key, value);
}

/**
 * Reserves a previously unseen World nullifier for exactly one wallet.
 * @return True only when this invocation created the record.
 */
export async function reserveNullifierRecord(key: string, value: StoredNullifierRecord) {
  if (env.nullifierStoreMode === "redis-rest") {
    return redisSetIfAbsent(key, value);
  }

  if (memoryStore.has(key)) return false;
  memoryStore.set(key, value);
  return true;
}

export function makeNullifierKey(action: string, nullifier: string) {
  return `bert:world-nullifier:${action}:${nullifier.toLowerCase()}`;
}
