-- Soft-remove workspace memberships.
--
-- `remove_membership` hard-deleted the row, which makes membership-joined
-- identity resolution impossible: everyone who ever left renders as an unknown
-- user on their historical tickets, comments and audit entries. Keep the row
-- and mark it instead.
--
-- No backfill: every existing row is an active membership, which is exactly
-- what NULL means here. Adding a nullable column with no default is a
-- metadata-only change in Postgres, so no row rewrite and no audit-trigger
-- storm (the hazard that requires DISABLE TRIGGER on audited tables).
ALTER TABLE workspace_members ADD COLUMN removed_at TIMESTAMPTZ;

COMMENT ON COLUMN workspace_members.removed_at IS
    'When the membership was revoked. NULL means active. Identity resolution '
    'reads rows regardless; every role, permission and seat-counting read must '
    'filter removed_at IS NULL.';

-- Finding a removed member is a rare, targeted read; finding the active ones
-- is on the hot path for every request that resolves a role.
CREATE INDEX IF NOT EXISTS workspace_members_active_idx
    ON workspace_members (workspace_id, user_uuid)
    WHERE removed_at IS NULL;

-- The seat-limit trigger needs two changes, not one.
--
-- 1. The staff count must ignore removed members, or a revoked staff member
--    keeps consuming a licensed seat forever.
--
-- 2. The UPDATE short-circuit gains the same condition. This one is
--    defence-in-depth rather than a live fix, and the distinction is worth
--    recording. The short-circuit reads "an UPDATE that keeps a staff role
--    consumes no new seat", which was true when the only way to leave was
--    DELETE; under soft-remove, re-activating a removed staff member is an
--    UPDATE whose OLD.role is still staff, so it looks like a bypass. It is
--    not, today: re-activation happens through `add_membership`'s
--    ON CONFLICT DO UPDATE, and Postgres fires BEFORE INSERT *and then*
--    BEFORE UPDATE for a conflicting upsert (verified, not assumed), so the
--    INSERT pass runs the full count and refuses. The condition matters the
--    moment anyone writes a direct `UPDATE ... SET removed_at = NULL`, where
--    the UPDATE pass would be the only check, and it costs nothing now.
CREATE OR REPLACE FUNCTION public.enforce_workspace_seat_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
    lim INTEGER;
    staff_count INTEGER;
BEGIN
    IF NEW.role NOT IN ('owner', 'admin', 'agent') THEN
        RETURN NEW;
    END IF;
    -- A removed member consumes nothing, so removing one never needs a check.
    IF NEW.removed_at IS NOT NULL THEN
        RETURN NEW;
    END IF;
    -- An UPDATE that keeps an ALREADY-ACTIVE staff role consumes no new seat.
    -- Re-activating a removed one does, and falls through to the count below.
    IF TG_OP = 'UPDATE'
       AND OLD.role IN ('owner', 'admin', 'agent')
       AND OLD.removed_at IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT seat_limit INTO lim FROM workspaces WHERE id = NEW.workspace_id;
    IF lim IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT count(*) INTO staff_count
        FROM workspace_members
        WHERE workspace_id = NEW.workspace_id
          AND role IN ('owner', 'admin', 'agent')
          AND removed_at IS NULL
          AND user_uuid <> NEW.user_uuid;
    IF staff_count >= lim THEN
        RAISE EXCEPTION 'workspace % staff seat limit (%) reached', NEW.workspace_id, lim
            USING ERRCODE = 'check_violation', CONSTRAINT = 'workspace_seat_limit';
    END IF;
    RETURN NEW;
END;
$$;
