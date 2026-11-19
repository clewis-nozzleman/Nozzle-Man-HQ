# Nozzle Man HQ

Private owner dashboard for Nozzle Man Exterior Services.

## Current capabilities
- Owner sign-in with server-signed 12-hour sessions.
- Scout prospect board: search, filter, update stages, add prospects, export CSV.
- Employee workspaces for Mack, Scout, Riley, Frankie, and Diesel.
- Shared local task queue with assignment and completion tracking.
- Approval policy reminder: external messages, quotes, job acceptance, scheduling changes, spending, and commitments require owner approval.
- Export/restore a JSON backup of Scout prospects, employee tasks, and approvals.

## Important limitations
- Employee profiles are structured workspaces, not autonomous AI agents. They do not independently reason, browse, send messages, or run in the background.
- The site does not yet have a direct Jobber API integration or an AI model/API connection.
- Operational data is stored in the browser's localStorage. It is specific to this browser and can be lost if browser site data is cleared. Export backups regularly.
- Scout's starter prospects are public-source research leads, not confirmed buying signals. Verify contact details and vendor processes before outreach.
- No email, quote, scheduling, payment, or external action is automatically sent or committed.

## Required environment variables
- OWNER_EMAIL (optional; defaults to owner@nozzlemanexteriors.com)
- OWNER_PASSWORD (14+ characters)
- SESSION_SECRET (32+ characters)

## Render
- Build command: npm install
- Start command: npm start
- Current service: https://nozzle-man-hq.onrender.com
