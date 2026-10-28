# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately to **maanavkrishna@gmail.com** with the subject "Aftershock security", or through [GitHub's private vulnerability reporting](https://github.com/MaanavKrishna/Aftershock/security/advisories/new). Do not open a public issue.

Include what you found, how to reproduce it, and the impact you expect. You will get a reply within 3 working days, and a fix or mitigation plan within 14 days for confirmed issues.

## Supported versions

Only the latest release and the hosted service at https://aftershock-mk.vercel.app receive security fixes.

## How Aftershock is built to be safe

See the [security model](docs/architecture.md#security-model): runs happen in isolated microVMs without secrets or network access, runners use read-only single-repository tokens, untrusted text is fenced before it reaches a model, webhooks are verified before anything is parsed, sign-in sessions are server-side and revocable, and signed-in pages run under a nonce-based Content Security Policy.
