# BERT Backend

Serverless backend for BERT proof-of-personhood signing.

## What it does

- generates World ID RP signatures
- verifies World ID proofs in the backend
- binds a World nullifier to one BERT wallet
- signs the EIP-712 payload that `PoPVerifierUpgradeable` accepts on-chain

## Why this service exists

The Solidity verifier contract trusts exactly one `trustedSigner`. This backend owns that signer key and only signs payloads after a successful proof-of-personhood check.

## Endpoints

- `GET /api/health`
- `POST /api/world/rp-signature`
- `POST /api/pop/issue-proof`

## Important security note

`NULLIFIER_STORE_MODE=memory` is only safe for local development. It does not survive serverless cold starts or redeploys.

For production, switch to a durable store. The backend already supports a simple Redis REST mode through:

- `NULLIFIER_STORE_MODE=redis-rest`
- `NULLIFIER_STORE_REDIS_REST_URL`
- `NULLIFIER_STORE_REDIS_REST_TOKEN`

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in your World ID app secrets and BERT signer key.
3. Run `npm install`.
4. Run `vercel dev --listen 3001`.

## Frontend integration

The frontend should call this backend with:

- `NEXT_PUBLIC_POP_BACKEND_URL=http://localhost:3001`
- the same `WORLD_ACTION` / `NEXT_PUBLIC_WORLD_ACTION`
- the deployed `POP_VERIFIER_ADDRESS`
