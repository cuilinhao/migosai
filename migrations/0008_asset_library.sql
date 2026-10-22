CREATE TABLE asset_collections ( id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 64), source TEXT NOT NULL CHECK(source IN ('creation','uploaded')), created_at INTEGER NOT NULL DEFAULT(unixepoch()), UNIQUE(id,user_id) );
CREATE INDEX asset_collections_owner ON asset_collections(user_id,created_at);

-- Library removal hides an entry only; source uploads and generation history remain intact.
CREATE TABLE asset_library_items ( user_id TEXT NOT NULL REFERENCES users(id), asset_id TEXT NOT NULL, collection_id TEXT, hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)), updated_at INTEGER NOT NULL DEFAULT(unixepoch()), PRIMARY KEY(user_id,asset_id), FOREIGN KEY(collection_id,user_id) REFERENCES asset_collections(id,user_id) );
CREATE INDEX asset_library_collection ON asset_library_items(user_id,collection_id);
