CREATE TABLE password_credentials(user_id TEXT PRIMARY KEY REFERENCES users(id),password_hash TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE one_tap_nonces(nonce_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
CREATE INDEX one_tap_nonces_expiry ON one_tap_nonces(expires_at);
CREATE TABLE auth_rate_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX auth_rate_limits_expiry ON auth_rate_limits(expires_at);
CREATE INDEX users_email_folded ON users(lower(email));
-- Preserve legacy records while blocking new case-variant duplicate accounts atomically.
CREATE TRIGGER users_email_unique_insert BEFORE INSERT ON users WHEN EXISTS(SELECT 1 FROM users WHERE lower(email)=lower(NEW.email)) BEGIN SELECT RAISE(ABORT,'email_already_registered'); END;
CREATE TRIGGER users_email_unique_update BEFORE UPDATE OF email ON users WHEN EXISTS(SELECT 1 FROM users WHERE lower(email)=lower(NEW.email) AND id!=OLD.id) BEGIN SELECT RAISE(ABORT,'email_already_registered'); END;
