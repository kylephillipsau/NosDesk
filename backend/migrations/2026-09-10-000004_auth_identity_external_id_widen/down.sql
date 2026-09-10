-- Fails if any row already holds a subject longer than 255 characters, which
-- is correct: those identities cannot be represented in the old type, and
-- truncating one would orphan the account it belongs to.
ALTER TABLE user_auth_identities ALTER COLUMN external_id TYPE VARCHAR(255);
