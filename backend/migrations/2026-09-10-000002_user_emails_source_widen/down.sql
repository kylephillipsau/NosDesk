-- Fails if any row already holds a value longer than 50, which is correct:
-- those rows cannot be represented in the old type, and silently truncating
-- an identity issuer would break the seat lookup that reads it.
ALTER TABLE user_emails ALTER COLUMN source TYPE VARCHAR(50);
