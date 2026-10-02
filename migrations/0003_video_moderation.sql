ALTER TABLE generations ADD COLUMN moderation_state TEXT;
ALTER TABLE generations ADD COLUMN moderation_verdict TEXT;
ALTER TABLE generations ADD COLUMN moderation_key TEXT;
ALTER TABLE generations ADD COLUMN moderation_etag TEXT;
ALTER TABLE generations ADD COLUMN moderation_cleanup_pending INTEGER NOT NULL DEFAULT 0;
CREATE INDEX moderation_cleanup ON generations(moderation_cleanup_pending, status);
