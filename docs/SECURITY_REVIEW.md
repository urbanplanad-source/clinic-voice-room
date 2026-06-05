# Security Review Notes

Last updated: 2026-06-05

## Applied

- Rate limiting now prefers Upstash Redis / Vercel KV REST via `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` or compatible `KV_REST_API_*` env vars.
- Production rate limiting fails closed when Redis REST env vars are missing, unless `ALLOW_IN_MEMORY_RATE_LIMIT_IN_PRODUCTION=true` is explicitly set.
- Client IP extraction now trusts forwarded IP headers only on Vercel (`VERCEL=1`) or when `TRUST_PROXY_HEADERS=true` is explicitly set. Local development may still use `x-forwarded-for` fallback.
- Staff sessions now include a dedicated `StaffUser.sessionVersion`; password resets increment it and invalidate older cookies.
- Login remember-me is no longer enabled by default.
- Realtime staff tokens always require an authenticated staff session, even when a `direction` parameter is present.
- Patient join responses now expose only the room fields needed by the UI plus `hospital.name`.
- Speaking usage events are rate-limited and capped so accumulated speaking seconds cannot exceed credible room elapsed time.
- Message polling accepts patient room tokens via `x-room-token` header only for legacy clients; web clients no longer send `messages?roomToken=...`.
- Message read markers now use explicit `POST /api/rooms/{roomId}/messages/read`; `GET /api/rooms/{roomId}/messages` no longer writes read state.
- New rooms generate a separate `patientJoinCode` for QR links. After patient entry, the server issues a short-lived HttpOnly patient room cookie and redirects the patient to `/room/patient/{roomId}`, so the ongoing patient room URL no longer contains `roomToken`.
- Staff-facing room API responses now use a restricted room snapshot and omit `roomToken`; clients receive `patientJoinCode` for QR handoff instead.
- Legacy `/api/rooms/by-token/{roomToken}` is disabled by default in production and can only be re-enabled with `ALLOW_LEGACY_ROOM_TOKEN_LOOKUP=true` for rollback.
- Stale room cleanup writes were removed from normal room/admin GET paths; cleanup should run through `/api/rooms/cleanup-stale`.
- Baseline security headers are configured in `next.config.mjs`, including CSP, HSTS, frame blocking, no-referrer, and Permissions-Policy.
- Login timing is partially equalized with a dummy bcrypt comparison for nonexistent accounts.

## Still Open

- Legacy `/room/{roomToken}` no longer renders the patient room directly; it redirects to the join screen and then to the token-free patient URL after entry. Disable this page entirely after deployed clients have fully moved to `patientJoinCode` + patient cookie flow.
- Consultation messages still store plaintext `sourceText` and `text` until room cleanup deletes them. This should be reconciled with privacy/consent wording before production.
- Login timing is reduced but not mathematically equalized across all infrastructure conditions.
