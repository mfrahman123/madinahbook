# Security

## Automated Checks

This repository runs the following security and quality checks in GitHub Actions:

- `npm audit --audit-level=high`
- syntax, unit, content, and integration tests
- Selenium browser tests
- Playwright visual regression tests
- vocabulary load smoke tests
- CodeQL JavaScript analysis

Dependabot is configured for npm dependencies and GitHub Actions updates.

## Local Secret Scanning

Run a redacted git-history scan with gitleaks:

```sh
gitleaks detect --source . --redact
```

Run a local-only TruffleHog scan without contacting external providers:

```sh
trufflehog git "file://$(pwd)" --no-verification --no-update
```

Use TruffleHog verified mode only when you intentionally want it to contact providers to validate discovered credentials.

## Production Logs

Server logs are structured JSON and redact common secret-bearing fields before stdout or webhook forwarding. Treat log providers and webhook collectors as production systems: protect their credentials, restrict access, and avoid adding raw request bodies or secrets to future log events.

## GitHub Secret Protection

Enable these in GitHub repository settings when available for the account/plan:

1. `Settings` -> `Code security and analysis`.
2. Enable `Dependabot alerts`.
3. Enable `Dependabot security updates`.
4. Enable `Secret scanning`.
5. Enable `Push protection`.

Rotate any credential that was shared in chat, screenshots, local logs, or other external systems, even if local repository scans are clean.
