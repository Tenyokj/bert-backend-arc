# BERT Backend

Serverless verification-signing service for the BERT Protocol. It issues EIP-712 payloads accepted by the deployed `PoPVerifier` contract.

The production endpoint is [bert-backend-arc.vercel.app](https://bert-backend-arc.vercel.app).

## Verification Policy

### Current Arc Testnet

BERT is in active development on Arc Testnet. With `POP_DEMO_ENABLED=true`, `/api/pop/demo-proof` issues an explicitly marked `BERT_TESTNET_DEMO` credential for the requesting testnet wallet. This lets any tester use real deployed contracts, protected actions and voting flows without depending on the shared World staging simulator.

Demo verification is **not** proof of personhood, does not prevent Sybil activity, and is hard-locked in code to Arc Testnet chain ID `5042002`. The endpoint returns `403` on every other deployment, including mainnet.

### Mainnet

Demo verification must remain disabled. The production path is World ID: this service verifies a World proof, binds one World nullifier to one BERT wallet in durable storage, then issues the on-chain payload. World IDs and private signer material never reach the browser.

## Trust Boundary

The Solidity verifier trusts one `trustedSigner`. This backend controls that signer key and must issue a payload only under the active deployment policy: World ID after valid proof and atomic nullifier binding on mainnet, or the deliberately non-human Arc Testnet Demo policy.

The frontend never receives `POP_SIGNER_PRIVATE_KEY`, `WORLD_RP_SIGNING_KEY`, Redis credentials, or Vercel environment variables. Do not place these values in source control or browser-exposed variables.

## API

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | `GET` | Service liveness check. It returns `{ "ok": true, "service": "bert-backend" }`. |
| `/api/world/rp-signature` | `POST` | Produces the relying-party context required by the World ID client flow. |
| `/api/pop/issue-proof` | `POST` | Verifies a World proof, enforces the nullifier-to-wallet binding, then returns the signed on-chain verification payload. |
| `/api/pop/demo-proof` | `POST` | Arc Testnet-only Demo payload for a connected wallet. It requires `POP_DEMO_ENABLED=true` and is rejected outside chain `5042002`. |

`/api/pop/issue-proof` rejects requests with the wrong chain ID, verifier address, malformed wallet, invalid World proof, or a nullifier already bound to another wallet.

## Repository Map

| Path | Purpose |
| --- | --- |
| `api` | Vercel serverless endpoint handlers. |
| `lib/world.ts` | World ID proof verification and RP context creation. |
| `lib/bert-pop.ts` | EIP-712 payload creation for the on-chain verifier. |
| `lib/store.ts` | Memory and Redis REST nullifier storage. |
| `lib/env.ts` | Strict environment validation at function startup. |

## Local Development

Requirements: Node.js 20 or newer, npm, and the Vercel CLI.

```bash
npm install
cp .env.example .env
npx vercel dev --listen 3001
```

Before starting the server, replace every placeholder in `.env`. The environment parser intentionally fails fast if a required address, private key or 32-byte World signing key is malformed.

Run the type check before opening a pull request:

```bash
npm run typecheck
```

## Environment Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `RPC_URL` | Yes | Arc Testnet RPC endpoint. |
| `BERT_CHAIN_ID` | Yes | Chain ID expected from each proof request. |
| `POP_VERIFIER_ADDRESS` | Yes | Deployed verifier that accepts backend payloads. |
| `POP_SIGNER_PRIVATE_KEY` | Yes | 32-byte private key matching the verifier's trusted signer. Keep secret. |
| `POP_DEMO_ENABLED` | Arc Testnet only | Set `true` only for the Arc Testnet deployment. The demo endpoint is still blocked in code outside chain `5042002`. Set `false` for mainnet. |
| `WORLD_APP_ID`, `WORLD_RP_ID` | Yes | World Developer Portal identifiers. |
| `WORLD_RP_SIGNING_KEY` | Yes | 32-byte World relying-party signing key. Keep secret. |
| `WORLD_ACTION`, `WORLD_ENVIRONMENT` | Yes | Must match the frontend and World Developer Portal configuration. |
| `CORS_ORIGIN` | Recommended | Set to the exact deployed frontend origin on Vercel. |
| `NULLIFIER_STORE_MODE` | Yes | Use `memory` only locally; use `redis-rest` on Vercel. |
| `NULLIFIER_STORE_REDIS_REST_URL`, `NULLIFIER_STORE_REDIS_REST_TOKEN` | For Redis | Upstash Redis REST credentials. Keep secret. |

## Vercel Deployment

Create a Vercel project from this repository and configure all variables from `.env.example` in Vercel Project Settings. For the deployed service:

1. Use `NULLIFIER_STORE_MODE=redis-rest` with a durable Upstash Redis database.
2. Set `CORS_ORIGIN` to the exact public BERT frontend origin, not `*`.
3. Ensure the signer key corresponds to the `trustedSigner` configured in `PoPVerifier`.
4. Verify `GET /api/health` returns HTTP 200.
5. On Arc Testnet, set `POP_DEMO_ENABLED=true` and activate Demo verification with a new test wallet. Confirm the resulting transaction through `PoPVerifier`.
6. Before mainnet, set `POP_DEMO_ENABLED=false`, configure production World ID values, and validate the full World nullifier-to-wallet binding flow with real credentials.

Redeploy after changing any Vercel environment variable. A passing health endpoint verifies configuration can load, but not the full World ID flow.

## Security and Disclosure

Read [SECURITY.md](./SECURITY.md) before testing or reporting a vulnerability. Use the central [BERT Core private advisory channel](https://github.com/Tenyokj/bert-core-arc/security/advisories/new), never public issues, for security reports.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). External users may fork the repository and open pull requests; only maintainers can merge code or access Vercel and World ID secrets.

## License

This repository is licensed under [GPL-3.0](./LICENSE).
