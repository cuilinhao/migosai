-- Existing orders remain historical Creem records and cannot be credited by Waffo events.
ALTER TABLE orders ADD COLUMN provider TEXT NOT NULL DEFAULT 'creem';
ALTER TABLE orders ADD COLUMN provider_mode TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE orders ADD COLUMN store_id TEXT;
CREATE INDEX orders_waffo_binding ON orders(provider,provider_mode,store_id,id);
