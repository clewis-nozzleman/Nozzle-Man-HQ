# Nozzle Man HQ — Scout v2

Private Node.js owner dashboard.

## Scout Sales & Leads
- Includes 20 initial prospect targets sourced from public directories and company websites.
- Search and filter prospects; update pipeline statuses; add owner-entered leads; export CSV.
- Lead records are stored in the browser's localStorage on the device/browser used. They are not yet synced across devices or to Jobber/HubSpot.
- Fit ratings are initial prioritization estimates, not confirmed buying intent. Verify contacts and vendor processes before outreach.
- No emails are sent by this version.

## Required environment variables
- `OWNER_EMAIL` (optional; defaults to owner@nozzlemanexteriors.com)
- `OWNER_PASSWORD` (14+ characters)
- `SESSION_SECRET` (32+ characters)

## Render
- Build command: `npm install`
- Start command: `npm start`

## Next build stages
AI-assisted live prospect research, persistent server-side lead storage, approval queue, and Jobber integration.
