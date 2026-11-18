# Nozzle Man HQ — v1

A small Node.js web app for the private Nozzle Man Exterior Services owner dashboard.

## Features
- Owner-only password login with signed, HTTP-only session cookie
- Dashboard sections for overview, sales, marketing, approvals, operations, scheduling, finance, and reports
- No third-party runtime dependencies
- Health endpoint at `/health`

## Required environment variables
- `OWNER_EMAIL`: login email (defaults to `owner@nozzlemanexteriors.com`)
- `OWNER_PASSWORD`: strong password, at least 14 characters
- `SESSION_SECRET`: random secret, at least 32 characters

Generate a session secret with: `openssl rand -hex 32`

## Run locally
```bash
npm start
```

## Render deployment
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Add the three environment variables above in Render before first deployment.

## Important
This is the initial secure application shell. It does not yet connect to Jobber or HubSpot and does not store CRM, job, quote, invoice, or financial records. The empty metrics are intentional. Integrations and persistent storage will be added in a later release.
