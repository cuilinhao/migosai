ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0 CHECK(is_guest IN (0,1));
CREATE TABLE guest_wallets(user_id TEXT PRIMARY KEY REFERENCES users(id),recovery_hash TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL DEFAULT(unixepoch()));
