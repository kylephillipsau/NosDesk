-- Fails if any row already holds an issuer longer than 50 characters, which is
-- correct: those identities cannot be represented in the old type, and
-- truncating one would orphan the account it belongs to.
ALTER TABLE user_auth_identities ALTER COLUMN provider_type TYPE VARCHAR(50);
