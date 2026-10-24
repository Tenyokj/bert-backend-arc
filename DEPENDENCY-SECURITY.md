# Verification Backend Dependency Review - 2026-10-24

## Changes

- viem 2.45.2 -> 2.57.11; attestation domain, fields and trust policy are unchanged.
- @vercel/node resolved 5.10.1 -> pinned 5.10.2. `vercel.json` also moves its explicit
  runtime from 5.3.24 to 5.10.2; changing package.json alone would leave that pin old.
- Scoped same-major overrides select ajv 8.18.0, path-to-regexp 6.3.0 and undici
  5.29.0. No undici 5 -> 6/7 or Vercel builder downgrade is forced.
- Compatible transitive updates use `npm audit fix --ignore-scripts`, never `--force`.
- No signer keys, environment values, verifier addresses or contract sources changed.

## Audit Snapshot

| Scope | Before | After |
| --- | --- | --- |
| All dependencies | 15: 12 high, 3 moderate | 3: 2 high, 1 moderate |
| `npm audit --omit=dev` | 3: 2 high, 1 moderate | 0 |

This is not a declaration that the deployed service is vulnerability-free.
The explicit Vercel runtime/builder and deployed Node runtime also need review;
`--omit=dev` only describes this repository's application dependency tree.

### Open Findings

- **undici 5 / @fastify/busboy 2:** still pulled by @vercel/node 5.10.2. Moving undici
  to the fixed 6/7 branch or busboy to 3 crosses major-version boundaries. The
  same-major undici 5.29.0 update fixes some advisories, not the complete set.
- **@vercel/node:** the third, propagated finding follows its dependency chain.
  Imports of package undici were found in its dev-server bundle. BERT API handlers
  do not directly import it, but that does not prove all builder/runtime paths safe.
- Keep these findings open. Do not downgrade to @vercel/node 4 merely because npm
  proposes it as an automatic resolution. Review an upstream patch or a managed
  runtime migration separately.

References: [multipart DoS](https://github.com/advisories/GHSA-x8mw-p69m-v3mx),
[multipart CRLF injection](https://github.com/advisories/GHSA-gxm5-99cw-xjw9),
[undici decompression DoS](https://github.com/advisories/GHSA-g9mf-h72j-4rw9).

## Regression Tests

Run `npm test` and `npm run typecheck` before merging. Tests exercise the actual
TypeScript handler/payload code and viem cryptography with public dummy key material.
RPC reads and World verification responses are stubbed; no `.env` secrets are read,
no credential is requested from a deployed backend and no transaction is broadcast.

The nine tests cover health/CORS/methods, demo rejection outside Arc Testnet,
wrong chain/verifier/wallet rejection, EIP-712 signature recovery and domain/user
binding, invalid World proofs, signal binding, nullifier ownership/renewal,
atomic in-memory reservation, and builder/config version alignment.

These tests do not validate actual World ID verification, Redis concurrency across
serverless instances or Vercel deployment packaging. They are not full protocol E2E
and are not an independent audit. The in-memory store remains unsuitable for
durable multi-instance production identity binding.

## Deployment

Merge into `main`, deploy the merged commit on Vercel and verify `/api/health`.
Then exercise the Arc Testnet verification flow with a dedicated test wallet.
Do not change signer or World/Redis configuration simply to get tests passing.
