-- Portal refresh tokens must not be exchangeable for agent sessions.
--
-- Portal sign-in mints a portal-scoped ACCESS token but a generic refresh
-- token, stored here with nothing marking which realm issued it. POST
-- /api/auth/refresh looks a token up by hash and mints a standard agent access
-- token, so a customer-portal credential could be exchanged for a staff
-- session.
ALTER TABLE refresh_tokens
    ADD COLUMN audience VARCHAR(16) NOT NULL DEFAULT 'agent';

-- Rows written before this column cannot be classified retroactively: portal
-- and agent refresh tokens are byte-identical in this table. Defaulting them to
-- 'agent' would leave the escalation live for the remaining lifetime of every
-- portal token already issued, so revoke instead. Cost is one extra sign-in:
-- staff re-authenticate, portal customers request a fresh magic link.
UPDATE refresh_tokens SET revoked_at = now() WHERE revoked_at IS NULL;

-- Refresh lookups already filter by hash; audience is only ever read alongside
-- one, so no index is needed.
