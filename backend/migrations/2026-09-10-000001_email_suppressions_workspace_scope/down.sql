-- Collapse back to one global list. Duplicate addresses across workspaces
-- fold into the row with the highest bounce_count, since the column loses its
-- per-tenant meaning.
DROP POLICY IF EXISTS email_suppressions_workspace_isolation ON email_suppressions;
ALTER TABLE email_suppressions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE email_suppressions DISABLE ROW LEVEL SECURITY;

DELETE FROM email_suppressions es
 WHERE EXISTS (
   SELECT 1 FROM email_suppressions keep
    WHERE keep.email = es.email
      AND (keep.bounce_count, keep.workspace_id) > (es.bounce_count, es.workspace_id)
 );

ALTER TABLE email_suppressions DROP CONSTRAINT email_suppressions_pkey;
ALTER TABLE email_suppressions DROP CONSTRAINT email_suppressions_workspace_id_fkey;
ALTER TABLE email_suppressions DROP COLUMN workspace_id;
ALTER TABLE email_suppressions ADD PRIMARY KEY (email);
