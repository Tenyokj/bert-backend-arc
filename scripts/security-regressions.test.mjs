import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach, beforeEach } from "node:test";
import ts from "typescript";
import * as viem from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as hashing from "@worldcoin/idkit-core/hashing";
import * as signing from "@worldcoin/idkit-core/signing";

// Public test-only material. Every RPC and World verification request is stubbed.
const testKey = `0x${"11".repeat(32)}`;
const wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const verifier = "0x1111111111111111111111111111111111111111";
const otherVerifier = "0x2222222222222222222222222222222222222222";
const realFetch = globalThis.fetch;
beforeEach(() => { globalThis.fetch = async () => { throw Error("Unexpected external request in backend tests"); }; });
afterEach(() => { globalThis.fetch = realFetch; });

function backend(options = {}) {
  const env = {
    rpcUrl: "http://127.0.0.1:1", chainId: 5042002,
    popVerifierAddress: verifier, popSignerPrivateKey: testKey,
    popVerificationWindowSeconds: 3600, popProviderId: "WORLD_ID",
    worldAppId: "app_test", worldRpId: "rp_test", worldRpSigningKey: testKey,
    worldAction: "bert-vote-human-verification", worldEnvironment: "production",
    corsOrigin: "https://test.invalid", nullifierStoreMode: "memory",
    popDemoEnabled: true, ...options,
  };
  let rpcReads = 0;
  const dependencies = {
    viem: {
      ...viem,
      createPublicClient: () => ({
        async readContract(request) {
          rpcReads++;
          assert.equal(request.functionName, "latestNonce");
          assert.equal(request.address, verifier);
          return 7n;
        },
      }),
    },
    "viem/accounts": { privateKeyToAccount },
    "@worldcoin/idkit-core/hashing": hashing,
    "@worldcoin/idkit-core/signing": signing,
  };
  const cache = new Map();
  function load(url) {
    if (url.pathname.endsWith("/lib/env.ts")) return { env };
    if (cache.has(url.href)) return cache.get(url.href);
    const module = { exports: {} };
    cache.set(url.href, module.exports);
    const js = ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("exports", "require", "module", js)(module.exports, (name) => {
      if (name in dependencies) return dependencies[name];
      if (name.startsWith(".")) return load(new URL(name.replace(/\.js$/, ".ts"), url));
      throw Error(`Unexpected dependency ${name}`);
    }, module);
    return module.exports;
  }
  return { env, load: (path) => load(new URL(`../${path}`, import.meta.url)), get rpcReads() { return rpcReads; } };
}

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}
async function invoke(context, route, body, method = "POST") {
  const res = response();
  await context.load(route).default({ method, body }, res);
  return res;
}
const validRequest = { walletAddress: wallet, chainId: 5042002, verifierAddress: verifier };
function proof(nullifier = "0x1234") {
  return { protocol_version: "4.0", action: "bert-vote-human-verification", responses: [{ nullifier, signal_hash: hashing.hashSignal(wallet.toLowerCase()) }] };
}
function allowWorld() {
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "https://developer.world.org/api/v4/verify/rp_test");
    return new Response("{}", { status: 200 });
  };
}

test("health, method rejection and CORS preflight work without RPC", async () => {
  const context = backend();
  const health = await invoke(context, "api/health.ts", null, "GET");
  assert.deepEqual(health.body, { ok: true, service: "bert-backend" });
  assert.equal(health.headers["Access-Control-Allow-Origin"], "https://test.invalid");
  assert.equal((await invoke(context, "api/health.ts", null, "POST")).statusCode, 405);
  assert.equal((await invoke(context, "api/pop/demo-proof.ts", null, "OPTIONS")).statusCode, 204);
  assert.equal(context.rpcReads, 0);
});

test("demo cannot be enabled outside Arc Testnet or when disabled", async () => {
  for (const options of [{ popDemoEnabled: false }, { chainId: 1 }, { chainId: 5042 }, { chainId: 31337 }]) {
    const context = backend(options);
    assert.equal((await invoke(context, "api/pop/demo-proof.ts", validRequest)).statusCode, 403);
    assert.equal(context.rpcReads, 0);
  }
});

test("demo rejects wrong chain, verifier and malformed wallet before requesting nonce", async () => {
  for (const change of [{ chainId: 1 }, { verifierAddress: otherVerifier }, { walletAddress: "invalid" }]) {
    const context = backend();
    assert.equal((await invoke(context, "api/pop/demo-proof.ts", { ...validRequest, ...change })).statusCode, 400);
    assert.equal(context.rpcReads, 0);
  }
});

test("demo signs a valid EIP-712 payload with the next on-chain nonce using viem", async () => {
  const context = backend();
  const res = await invoke(context, "api/pop/demo-proof.ts", validRequest);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.nonce, "8");
  assert.equal(context.rpcReads, 1);
  assert.equal(res.body.provider, viem.keccak256(viem.stringToBytes("BERT_TESTNET_DEMO")));
  assert.ok(Math.abs(res.body.verifiedUntil - (Math.floor(Date.now() / 1000) + 3600)) < 5);
  const { verifiedUntil, nonce, provider, credentialHash, signature } = res.body;
  const verification = {
    address: privateKeyToAccount(testKey).address,
    domain: { name: "BERT PoP Verifier", version: "1", chainId: 5042002, verifyingContract: verifier },
    primaryType: "Verification",
    types: { Verification: [{ name: "user", type: "address" }, { name: "verifiedUntil", type: "uint64" }, { name: "nonce", type: "uint256" }, { name: "provider", type: "bytes32" }, { name: "credentialHash", type: "bytes32" }] },
    message: { user: wallet, verifiedUntil: BigInt(verifiedUntil), nonce: BigInt(nonce), provider, credentialHash }, signature,
  };
  assert.equal(await viem.verifyTypedData(verification), true);
  assert.equal(await viem.verifyTypedData({ ...verification, domain: { ...verification.domain, chainId: 1 } }), false);
  assert.equal(await viem.verifyTypedData({ ...verification, domain: { ...verification.domain, verifyingContract: otherVerifier } }), false);
  assert.equal(await viem.verifyTypedData({ ...verification, message: { ...verification.message, user: otherVerifier } }), false);
  assert.equal("popSignerPrivateKey" in res.body, false);
});

test("World proof requests reject changed deployment/action before verification", async () => {
  for (const change of [{ chainId: 1 }, { verifierAddress: otherVerifier }, { action: "wrong" }]) {
    const context = backend();
    assert.equal((await invoke(context, "api/pop/issue-proof.ts", { ...validRequest, proof: proof(), ...change })).statusCode, 400);
    assert.equal(context.rpcReads, 0);
  }
});

test("invalid World proofs and wrong wallet signals never receive a signature", async () => {
  for (const change of [{ protocol_version: "2.0" }, { action: "wrong" }, { responses: [{ nullifier: "0x1234", signal_hash: "0x00" }] }]) {
    const context = backend();
    allowWorld();
    const res = await invoke(context, "api/pop/issue-proof.ts", { ...validRequest, proof: { ...proof(), ...change } });
    assert.notEqual(res.statusCode, 200);
    assert.equal(context.rpcReads, 0);
    assert.equal("signature" in res.body, false);
  }
});

test("a World nullifier may renew for its owner but cannot be rebound to another wallet", async () => {
  const context = backend();
  allowWorld();
  assert.equal((await invoke(context, "api/pop/issue-proof.ts", { ...validRequest, proof: proof() })).statusCode, 200);
  assert.equal((await invoke(context, "api/pop/issue-proof.ts", { ...validRequest, proof: proof() })).statusCode, 200);
  const otherWalletProof = proof();
  otherWalletProof.responses[0].signal_hash = hashing.hashSignal(otherVerifier.toLowerCase());
  const res = await invoke(context, "api/pop/issue-proof.ts", { ...validRequest, walletAddress: otherVerifier, proof: otherWalletProof });
  assert.equal(res.statusCode, 409);
  assert.equal(context.rpcReads, 2);
});

test("nullifier reservation is atomic within the in-memory test store", async () => {
  const store = backend().load("lib/store.ts");
  const key = store.makeNullifierKey("action", "0xAB");
  const record = { walletAddress: wallet, firstVerifiedAt: "test", lastIssuedAt: "test" };
  const outcomes = await Promise.all([store.reserveNullifierRecord(key, record), store.reserveNullifierRecord(key, { ...record, walletAddress: otherVerifier })]);
  assert.deepEqual(outcomes, [true, false]);
  assert.equal((await store.getNullifierRecord(key)).walletAddress, wallet);
});

test("Vercel runtime and installed builder stay aligned", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.functions["api/**/*.ts"].runtime, `@vercel/node@${pkg.devDependencies["@vercel/node"]}`);
});
