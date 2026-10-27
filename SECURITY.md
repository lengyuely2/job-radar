# Security and private data

Run Job Radar only on your own computer. It is intentionally a loopback-only, single-user application, not an internet-facing service.

Do not publish `local-data`, API keys, `.env` files, resumes, screenshots of personal searches, or exported job/application records. Local state includes plaintext credentials. If a key is accidentally disclosed, revoke it with the provider; deleting a Git commit alone does not invalidate the key.

Do not include secrets or personal data in GitHub issues. Report a reproducible issue using synthetic records. Do not test SSRF or link-verification behavior against systems you do not own or have permission to test.
