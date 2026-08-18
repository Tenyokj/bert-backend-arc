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

export function makeNullifierKey(action: string, nullifier: string) {
  return `bert:world-nullifier:${action}:${nullifier.toLowerCase()}`;
}
