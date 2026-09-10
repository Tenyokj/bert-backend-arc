# Contributing to BERT Backend

This service is a security boundary between World ID, the browser and BERT's onchain verification-signing pipeline. Treat all changes as security-sensitive.

## Pull Requests

1. Branch from the current target branch and do not push directly to protected branches.
2. Keep verification behavior deterministic: chain ID, verifier address, World action and wallet binding must remain explicit checks.
3. Never weaken the Arc Testnet Demo guard: it must require explicit opt-in and chain ID `5042002`, and must reject every mainnet deployment.
4. Never commit private keys, World ID secrets, Redis credentials, API tokens, request payloads containing real proofs, or Vercel environment exports.
5. Run `npm run typecheck` before opening a pull request.
6. Describe security impact, expected request/response behavior and any required contract or frontend configuration change.

## Storage Requirements

`NULLIFIER_STORE_MODE=memory` is acceptable only for local development. Any deployment must use durable storage so a nullifier cannot be rebound after a cold start or redeploy.

## Security Reports

Do not publish security bugs in issues, pull requests, commits or discussions. Follow [SECURITY.md](./SECURITY.md) and use the private advisory channel.

## Review and Access

Anyone can fork a public repository and open a pull request. That does not grant write access, access to secrets, deployment rights or the ability to merge code. Maintainers alone approve and deploy accepted changes.
