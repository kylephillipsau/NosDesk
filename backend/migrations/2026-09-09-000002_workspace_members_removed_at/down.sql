-- Drop the soft-removed rows: with the column gone they would read as active
-- memberships, which is worse than losing them.
DELETE FROM workspace_members WHERE removed_at IS NOT NULL;

DROP INDEX IF EXISTS workspace_members_active_idx;
ALTER TABLE workspace_members DROP COLUMN removed_at;

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
    IF TG_OP = 'UPDATE' AND OLD.role IN ('owner', 'admin', 'agent') THEN
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
          AND user_uuid <> NEW.user_uuid;
    IF staff_count >= lim THEN
        RAISE EXCEPTION 'workspace % staff seat limit (%) reached', NEW.workspace_id, lim
            USING ERRCODE = 'check_violation', CONSTRAINT = 'workspace_seat_limit';
    END IF;
    RETURN NEW;
END;
$$;
