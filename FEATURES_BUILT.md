# Biznest platform expansion

Implemented in this build:
- Store-scoped automation data model and allow-listed automation engine (notifications, approvals, activity).
- Store-scoped approval requests with server-side authorization.
- Store-scoped business document vault records with entity linking and expiry metadata.
- Reusable report definitions layered on existing Analytics.
- Industry workflow foundations for Real Estate, Automotive, Photography, and Fashion/Tailoring.
- Dashboard navigation entries for the new platform modules.
- Removed public demo/seed/admin-bootstrap API routes.
- Sanitized secret-bearing values from .env.example.

Deployment validation still required: npm ci, npm test, npm run lint, npm run build, and a live two-store authorization test.
